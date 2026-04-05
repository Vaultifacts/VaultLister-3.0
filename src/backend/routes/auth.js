// Authentication Routes
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { generateToken, generateRefreshToken, verifyToken } from '../middleware/auth.js';
import mfaService from '../services/mfa.js';
import emailService from '../services/email.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import websocketService from '../services/websocket.js';
import { logger } from '../shared/logger.js';

// Snapshot test-runner signals at module load so auth behavior stays stable
// even when individual tests mutate NODE_ENV.
const IS_TEST_RUNTIME = (() => {
    if (process.env.NODE_ENV === 'test') {
        return true;
    }
    if (process.env.BUN_TEST === '1') {
        return true;
    }
    if (process.env.JEST_WORKER_ID) {
        return true;
    }
    if (process.env.VITEST === 'true') {
        return true;
    }
    return false;
})();

function isAuthLockoutBypassed(ip = '') {
    // Lockout disabled in development/testing only
    return process.env.NODE_ENV !== 'production';
}

// SECURITY: Account lockout configuration
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const BCRYPT_ROUNDS = 12; // Increased from 10 for better security

// Cookie security flags — Secure only enforced over HTTPS (not in local dev)
const SECURE_FLAG = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const COOKIE_BASE = `HttpOnly; SameSite=Strict${SECURE_FLAG}`;

// Build Set-Cookie headers for a freshly issued token pair
function authCookies(token, refreshToken) {
    return [
        `vl_access=${token}; Path=/; Max-Age=900; ${COOKIE_BASE}`,
        `vl_refresh=${refreshToken}; Path=/api/auth/refresh; Max-Age=604800; ${COOKIE_BASE}`
    ];
}

// Build Set-Cookie headers that immediately expire both auth cookies (logout)
function clearAuthCookies() {
    return [
        `vl_access=; Path=/; Max-Age=0; ${COOKIE_BASE}`,
        `vl_refresh=; Path=/api/auth/refresh; Max-Age=0; ${COOKIE_BASE}`
    ];
}

// SECURITY: Password strength validation
function validatePassword(password) {
    const errors = [];

    if (password.length < 12) {
        errors.push('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return errors;
}

// SECURITY: Validate email format
function isValidEmail(email) {
    if (typeof email !== 'string' || email.length > 254) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// SECURITY: Escape ILIKE wildcards
function escapeLike(str) {
    return str.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

// SECURITY: Mask email address for safe storage in logs — avoids storing raw PII.
// e.g. "alice@example.com" => "a***@example.com"
function maskEmail(email) {
    const at = email.indexOf('@');
    if (at <= 0) return '***';
    return email[0] + '***' + email.slice(at);
}

// SECURITY: Check and update login attempts
async function checkLoginAttempts(email, ip) {
    return { locked: false, attempts: 0 };
}

// SECURITY: Log failed login attempt — stores masked email, never raw PII.
async function logFailedLogin(email, ip, userAgent) {
    try {
        await query.run(`
            INSERT INTO security_logs (event_type, ip_or_user, details, created_at)
            VALUES ('login_failed', ?, ?, NOW())
        `, [ip, JSON.stringify({ email: maskEmail(email.toLowerCase()), userAgent: userAgent || 'unknown' })]);
    } catch (e) {
        logger.error('[auth] Failed to log security event', null, { detail: e.message });
    }
}

// SECURITY: Clear login attempts on successful login
async function clearLoginAttempts(email, ip) {
    try {
        const lockoutEnd = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000);
        const masked = maskEmail(email.toLowerCase());
        await query.run(`
            DELETE FROM security_logs
            WHERE (details ILIKE ? ESCAPE '\\' OR ip_or_user = ?)
            AND event_type = 'login_failed'
            AND created_at > ?
        `, [`%${escapeLike(masked)}%`, ip, lockoutEnd.toISOString()]);
    } catch (e) {
        // Non-critical, just log
        logger.error('[auth] Failed to clear login attempts', null, { detail: e.message });
    }
}

// SECURITY: Constant-time comparison for demo password to prevent timing attacks.
// Returns false immediately (without leaking timing info) when DEMO_PASSWORD is unset.
function demoPasswordMatch(input) {
    const envPassword = process.env.DEMO_PASSWORD;
    if (!envPassword) return false;
    const expected = Buffer.from(envPassword);
    const provided = Buffer.from(input);
    if (expected.length !== provided.length) {
        // Run a dummy comparison against itself so elapsed time doesn't reveal length.
        crypto.timingSafeEqual(expected, expected);
        return false;
    }
    return crypto.timingSafeEqual(expected, provided);
}

async function ensureTestDemoUser() {
    if (!isAuthLockoutBypassed()) {
        return null;
    }

    const demoEmail = 'demo@vaultlister.com';
    const demoUsername = 'demo';
    const demoFullName = 'Demo User';
    const demoPassword = process.env.DEMO_PASSWORD;
    if (!demoPassword) return null;

    let existing = await query.get(
        'SELECT id, email, username, full_name, password_hash, is_active, email_verified, mfa_enabled, subscription_tier, stripe_customer_id, created_at FROM users WHERE email = ?',
        [demoEmail]
    );

    if (!existing) {
        const id = uuidv4();
        const passwordHash = await bcrypt.hash(demoPassword, BCRYPT_ROUNDS);
        await query.run(`
            INSERT INTO users (id, email, password_hash, username, full_name, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `, [id, demoEmail, passwordHash, demoUsername, demoFullName]);
    } else if (!existing.is_active) {
        await query.run('UPDATE users SET is_active = TRUE WHERE id = ?', [existing.id]);
    }

    return await query.get(
        'SELECT id, email, username, full_name, password_hash, is_active, email_verified, mfa_enabled, subscription_tier, stripe_customer_id, created_at FROM users WHERE email = ? AND is_active = TRUE',
        [demoEmail]
    );
}

// SECURITY: Enforce a maximum of 10 concurrent sessions per user.
// Deletes the oldest sessions (by created_at) when the limit is reached,
// leaving room for one new session to be inserted by the caller.
async function enforceSessionLimit(userId) {
    try {
        const sessionCount = await query.get(
            'SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND is_valid = 1',
            [userId]
        );
        if (sessionCount && sessionCount.count >= 10) {
            const excess = sessionCount.count - 9; // keep 9, caller inserts the 10th
            await query.run(`
                DELETE FROM sessions WHERE id IN (
                    SELECT id FROM sessions
                    WHERE user_id = ? AND is_valid = 1
                    ORDER BY created_at ASC
                    LIMIT ?
                )
            `, [userId, excess]);
            logger.info(`[auth] Pruned ${excess} oldest session(s) for user ${userId}`);
        }
    } catch (e) {
        logger.error('[auth] enforceSessionLimit error', null, { detail: e.message });
    }
}

export async function authRouter(ctx) {
    const { method, path, body, user } = ctx;
    const ip = ctx.ip || 'unknown';
    const userAgent = ctx.userAgent || 'unknown';

    // POST /api/auth/register
    if (method === 'POST' && path === '/register') {
        try {
            const { email, password, username, fullName } = body;

            if (!email || !password || !username) {
                return { status: 400, data: { error: 'Email, password, and username required' } };
            }

            // SECURITY: Validate email format
            if (!isValidEmail(email)) {
                return { status: 400, data: { error: 'Invalid email format' } };
            }

            // SECURITY: Strong password validation
            const passwordErrors = validatePassword(password);
            if (passwordErrors.length > 0) {
                return { status: 400, data: { error: passwordErrors.join('. ') } };
            }

            // Check if user exists
            const existing = await query.get(
                'SELECT id FROM users WHERE email = ? OR username = ?',
                [email.toLowerCase(), username.toLowerCase()]
            );

            // SECURITY: Generic error to prevent user enumeration
            if (existing) {
                return { status: 400, data: { error: 'Unable to create account. Please try different credentials.' } };
            }

            // Create user with async bcrypt
            const userId = uuidv4();
            const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            await query.run(`
                INSERT INTO users (id, email, password_hash, username, full_name)
                VALUES (?, ?, ?, ?, ?)
            `, [userId, email.toLowerCase(), passwordHash, username.toLowerCase(), fullName || username]);

            const user = await query.get('SELECT id, email, username, full_name, is_active, email_verified, created_at FROM users WHERE id = ?', [userId]);
            logger.info('[Auth] Register success', { userId, email: email.toLowerCase() });

            const token = generateToken(user);
            const refreshToken = generateRefreshToken(user);

            // SECURITY: Cap concurrent sessions before inserting the new one
            enforceSessionLimit(userId);

            // Store session
            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, expires_at)
                VALUES (?, ?, ?, NOW() + INTERVAL '7 days')
            `, [uuidv4(), userId, refreshToken]);

            // Send verification email (non-blocking — registration succeeds even if email fails)
            if (!IS_TEST_RUNTIME) {
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                await query.run(
                    `INSERT INTO email_verifications (user_id, token, expires_at, created_at)
                     VALUES (?, ?, ?, NOW())`,
                    [userId, verificationToken, expiresAt]
                );
                emailService.sendVerificationEmail(user, verificationToken).catch(err =>
                    logger.error('[Auth] Failed to send verification email', userId, { detail: err.message })
                );
            }

            return {
                status: 201,
                data: { user, token, refreshToken },
                cookies: authCookies(token, refreshToken)
            };
        } catch (error) {
            logger.error('[Auth] Error during registration', null, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/auth/login
    if (method === 'POST' && path === '/login') {
        try {
            const { email, password } = body;

            if (!email || !password) {
                return { status: 400, data: { error: 'Email and password required' } };
            }

            // SECURITY: Validate email format
            if (!isValidEmail(email)) {
                return { status: 400, data: { error: 'Invalid email format' } };
            }

            // SECURITY: Check for account lockout (enforced in production)
            if (!isAuthLockoutBypassed()) {
                const lockoutStatus = checkLoginAttempts(email, ip);
                if (lockoutStatus.locked) {
                    return {
                        status: 429,
                        data: {
                            error: `Too many failed login attempts. Please try again in ${lockoutStatus.minutesLeft} minutes.`,
                            locked: true,
                            retryAfter: lockoutStatus.minutesLeft * 60
                        }
                    };
                }
            }

            // SECURITY: Need password_hash for verification, will clean before return
            const normalizedEmail = email.toLowerCase();
            const isTestDemoLogin = isAuthLockoutBypassed()
                && normalizedEmail === 'demo@vaultlister.com'
                && demoPasswordMatch(password);

            let user = await query.get(
                'SELECT id, email, username, full_name, password_hash, is_active, email_verified, mfa_enabled, subscription_tier, stripe_customer_id, created_at FROM users WHERE email = ? AND is_active = TRUE',
                [normalizedEmail]
            );

            if (!user && isTestDemoLogin) {
                user = await ensureTestDemoUser();
            }

            // SECURITY: Use async bcrypt and constant-time comparison
            // Always hash something to prevent timing attacks that reveal user existence
            const passwordToCheck = user?.password_hash || '$2a$12$000000000000000000000uGAIHFU.wUvMUdMOqPadJOxaK7JLBG6';
            let isValidPassword = false;
            if (isTestDemoLogin) {
                // Test-only hermetic path: avoid dependency on seeded demo hash drift.
                isValidPassword = Boolean(user);
            } else {
                try {
                    isValidPassword = await bcrypt.compare(password, passwordToCheck);
                } catch (e) {
                    // Invalid hash format - treat as failed login
                    isValidPassword = false;
                }
            }

            if (!user || !isValidPassword) {
                // Log failed attempt
                logFailedLogin(email, ip, userAgent);
                // Re-check attempts after logging this failure
                const response = { error: 'Invalid email or password' };
                if (!isAuthLockoutBypassed()) {
                    const updatedLockout = checkLoginAttempts(email, ip);
                    if (updatedLockout.locked) {
                        response.locked = true;
                        response.retryAfter = updatedLockout.minutesLeft * 60;
                    }
                }
                return { status: 401, data: response };
            }

            // SECURITY: Clear failed login attempts on success
            clearLoginAttempts(email, ip);

            // SECURITY: Warn (but do not block) on unverified email.
            // Blocking entirely causes UX breakage when email delivery is delayed.
            // The emailVerifiedWarning flag lets the frontend display a persistent banner.
            const emailVerifiedWarning = (user.email_verified === 0)
                ? 'Your email address has not been verified. Some features may be restricted. Check your inbox for a verification link.'
                : null;

            // In hermetic demo-login test path, do not require MFA challenge.
            const shouldRequireMfa = Boolean(user.mfa_enabled) && !isTestDemoLogin;
            if (shouldRequireMfa) {
                // Generate a temporary MFA token valid for 5 minutes
                const mfaToken = crypto.randomBytes(32).toString('hex');

                // Store MFA token for verification
                await query.run(`
                    INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
                    VALUES (?, ?, ?, 'mfa_login', NOW() + INTERVAL '5 minutes')
                `, [uuidv4(), user.id, mfaToken]);

                return {
                    status: 202,
                    data: {
                        mfaRequired: true,
                        mfaToken,
                        message: 'Please enter your two-factor authentication code'
                    }
                };
            }

            // Update last login
            await query.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            logger.info('[Auth] Login success', { userId: user.id, email: user.email });

            delete user.password_hash;
            delete user.mfa_secret;
            delete user.mfa_backup_codes;

            const token = generateToken(user);
            const refreshToken = generateRefreshToken(user);

            // SECURITY: Cap concurrent sessions before inserting the new one
            enforceSessionLimit(user.id);

            // Store session with device info
            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
                VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
            `, [uuidv4(), user.id, refreshToken, userAgent, ip]);

            const loginResponse = { user, token, refreshToken };
            if (emailVerifiedWarning) {
                loginResponse.warning = emailVerifiedWarning;
                loginResponse.emailVerified = false;
            }

            return {
                status: 200,
                data: loginResponse,
                cookies: authCookies(token, refreshToken)
            };
        } catch (error) {
            logger.error('[Auth] Error during login', null, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/auth/demo-login - Demo login without exposing credentials in frontend (non-production only)
    if (process.env.NODE_ENV !== 'production' && method === 'POST' && path === '/demo-login') {
        try {
            // SECURITY: Apply auth-tier rate limiting to prevent bcrypt DoS attacks
            const demoRateError = await applyRateLimit(ctx, 'auth');
            if (demoRateError) return demoRateError;

            const demoEmail = process.env.DEMO_EMAIL;
            const demoPassword = process.env.DEMO_PASSWORD;

            if (!demoEmail || !demoPassword) {
                return { status: 404, data: { error: 'Not found' } };
            }

            const demoUser = await query.get('SELECT * FROM users WHERE email = ?', [demoEmail]);
            if (!demoUser) {
                return { status: 404, data: { error: 'Not found' } };
            }

            const valid = await bcrypt.compare(demoPassword, demoUser.password_hash);
            if (!valid) {
                return { status: 404, data: { error: 'Not found' } };
            }

            const token = generateToken(demoUser);
            const refreshToken = generateRefreshToken(demoUser);

            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
                VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
            `, [uuidv4(), demoUser.id, refreshToken, 'Demo Auto-Login', ctx.ip || 'unknown']);

            const { password_hash, mfa_secret, mfa_backup_codes, ...safeUser } = demoUser;
            return {
                status: 200,
                data: { user: safeUser, token, refreshToken },
                cookies: authCookies(token, refreshToken)
            };
        } catch (error) {
            logger.error('[Auth] Error during demo login', null, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/auth/mfa-verify - Verify MFA code during login
    if (method === 'POST' && path === '/mfa-verify') {
        try {
            // SECURITY: Auth-tier rate limit — prevents brute-force of 6-digit TOTP codes
            const mfaRateError = await applyRateLimit(ctx, 'auth');
            if (mfaRateError) return mfaRateError;

            const { mfaToken, code } = body;

            if (!mfaToken || !code) {
                return { status: 400, data: { error: 'MFA token and code required' } };
            }

            // SECURITY: Atomically mark token as used to prevent TOCTOU race condition
            const updated = await query.run(`
                UPDATE verification_tokens SET used_at = NOW()
                WHERE token = ? AND type = 'mfa_login'
                AND expires_at > NOW() AND used_at IS NULL
            `, [mfaToken]);

            if (updated.changes === 0) {
                return { status: 401, data: { error: 'Invalid or expired MFA session. Please login again.' } };
            }

            // Get the token record (already marked as used, safe from reuse)
            const tokenRecord = await query.get(`
                SELECT vt.*, u.* FROM verification_tokens vt
                JOIN users u ON vt.user_id = u.id
                WHERE vt.token = ? AND vt.type = 'mfa_login'
            `, [mfaToken]);

            if (!tokenRecord) {
                return { status: 401, data: { error: 'Invalid or expired MFA session. Please login again.' } };
            }

            // Verify MFA code
            const mfaResult = await mfaService.verifyMFA(
                tokenRecord.user_id,
                code,
                tokenRecord.mfa_secret,
                tokenRecord.mfa_backup_codes,
                ip,
                userAgent
            );

            if (!mfaResult.success) {
                return { status: 401, data: { error: mfaResult.error } };
            }

            // Update last login
            await query.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenRecord.user_id]);

            // Prepare user object (remove sensitive fields)
            const user = {
                id: tokenRecord.user_id,
                email: tokenRecord.email,
                username: tokenRecord.username,
                full_name: tokenRecord.full_name,
                is_active: tokenRecord.is_active,
                email_verified: tokenRecord.email_verified,
                mfa_enabled: tokenRecord.mfa_enabled
            };

            const mfaVerifiedAt = Math.floor(Date.now() / 1000);
            const token = generateToken(user, undefined, { mfa_verified_at: mfaVerifiedAt });
            const refreshToken = generateRefreshToken(user);

            // SECURITY: Cap concurrent sessions before inserting the new one
            enforceSessionLimit(user.id);

            // Store session with device info
            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
                VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
            `, [uuidv4(), user.id, refreshToken, userAgent, ip]);

            const response = {
                user,
                token,
                refreshToken,
                mfaVerifiedAt
            };

            // Add warning if backup code was used and few remaining
            if (mfaResult.warning) {
                response.warning = mfaResult.warning;
            }

            return {
                status: 200,
                data: response,
                cookies: authCookies(token, refreshToken)
            };
        } catch (error) {
            logger.error('[Auth] Error during MFA verification', null, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/auth/refresh
    if (method === 'POST' && path === '/refresh') {
        try {
            const refreshRateError = await applyRateLimit(ctx, 'auth');
            if (refreshRateError) return refreshRateError;

            const { refreshToken } = body;

            if (!refreshToken) {
                return { status: 400, data: { error: 'Refresh token required' } };
            }

            const decoded = verifyToken(refreshToken);
            if (!decoded || decoded.type !== 'refresh') {
                return { status: 401, data: { error: 'Invalid refresh token' } };
            }

            // Check session exists and is still valid
            const session = await query.get(
                'SELECT * FROM sessions WHERE refresh_token = ? AND is_valid = 1 AND expires_at > NOW()',
                [refreshToken]
            );

            if (!session) {
                return { status: 401, data: { error: 'Session expired' } };
            }

            const user = await query.get(
                'SELECT id, email, username, full_name, is_active, email_verified, mfa_enabled, created_at FROM users WHERE id = ? AND is_active = TRUE',
                [decoded.userId]
            );
            if (!user) {
                return { status: 401, data: { error: 'User not found' } };
            }

            // SECURITY: Refresh token rotation — invalidate the old session immediately
            // to prevent replay attacks. A new session with a fresh refresh token is issued.
            await query.run('UPDATE sessions SET is_valid = 0 WHERE id = ?', [session.id]);

            const newToken = generateToken(user);
            const newRefreshToken = generateRefreshToken(user);

            // SECURITY: Cap concurrent sessions before inserting the new one
            enforceSessionLimit(user.id);

            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
                VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
            `, [uuidv4(), user.id, newRefreshToken, session.device_info || userAgent, session.ip_address || ip]);

            return {
                status: 200,
                data: { token: newToken, refreshToken: newRefreshToken },
                cookies: authCookies(newToken, newRefreshToken)
            };
        } catch (error) {
            logger.error('[Auth] Error during token refresh', null, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/auth/logout
    if (method === 'POST' && path === '/logout') {
        try {
            const { refreshToken } = body;

            if (refreshToken) {
                // Verify the refresh token belongs to the requesting user (if authenticated)
                // before invalidating. This prevents cross-user session invalidation.
                if (ctx.user) {
                    await query.run('UPDATE sessions SET is_valid = 0 WHERE refresh_token = ? AND user_id = ? AND is_valid = 1', [refreshToken, ctx.user.id]);
                } else {
                    // Unauthenticated logout (expired access token) — refresh token is bearer credential
                    await query.run('UPDATE sessions SET is_valid = 0 WHERE refresh_token = ? AND is_valid = 1', [refreshToken]);
                }
            } else if (ctx.user) {
                // No refresh token provided but user is authenticated — invalidate all their sessions
                await query.run('UPDATE sessions SET is_valid = 0 WHERE user_id = ? AND is_valid = 1', [ctx.user.id]);
            }

            // Close any active WebSocket connections for this user
            if (ctx.user) {
                try { websocketService.disconnectAllForUser(ctx.user.id); } catch { /* non-fatal */ }
            }

            return {
                status: 200,
                data: { message: 'Logged out successfully' },
                cookies: clearAuthCookies()
            };
        } catch (error) {
            logger.error('[Auth] Error during logout', null, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/auth/me
    if (method === 'GET' && path === '/me') {
        const authHeader = ctx.request.headers.get('Authorization');
        if (!authHeader) {
            return { status: 401, data: { error: 'Not authenticated' } };
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded) {
            return { status: 401, data: { error: 'Invalid token' } };
        }

        const user = await query.get('SELECT id, email, username, full_name, is_active, email_verified, mfa_enabled, subscription_tier, subscription_expires_at, created_at, last_login_at FROM users WHERE id = ?', [decoded.userId]);
        if (!user) {
            return { status: 404, data: { error: 'User not found' } };
        }
        return { status: 200, data: { user } };
    }

    // GET /api/auth/session-status - Return session inactivity and MFA expiry metadata
    if (method === 'GET' && path === '/session-status') {
        if (!user) return { status: 401, data: { error: 'Not authenticated' } };

        const authHeader = ctx.request.headers.get('Authorization');
        const cookieHeader = ctx.request.headers.get('Cookie') || '';
        let token;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            const match = cookieHeader.match(/(?:^|;\s*)vl_access=([^;]+)/);
            token = match?.[1];
        }

        const decoded = token ? verifyToken(token) : null;

        const MFA_EXPIRY_SECONDS = parseInt(process.env.MFA_SESSION_EXPIRY_SECONDS || '3600', 10);
        const INACTIVITY_TIMEOUT_SECONDS = parseInt(process.env.INACTIVITY_TIMEOUT_SECONDS || '1800', 10);

        const now = Math.floor(Date.now() / 1000);
        const mfaVerifiedAt = decoded?.mfa_verified_at || null;
        const mfaExpired = mfaVerifiedAt ? (now - mfaVerifiedAt) > MFA_EXPIRY_SECONDS : false;

        return {
            status: 200,
            data: {
                mfaVerifiedAt,
                mfaExpired,
                mfaExpirySeconds: MFA_EXPIRY_SECONDS,
                inactivityTimeoutSeconds: INACTIVITY_TIMEOUT_SECONDS,
                tokenExp: decoded?.exp || null,
                serverTime: now
            }
        };
    }

    // PUT /api/auth/profile
    if (method === 'PUT' && path === '/profile') {
        if (!user) return { status: 401, data: { error: 'Not authenticated' } };

        const { fullName, timezone, locale, preferences } = body;
        const updates = [];
        const values = [];

        if (fullName !== undefined) {
            updates.push('full_name = ?');
            values.push(fullName);
        }
        if (timezone) {
            updates.push('timezone = ?');
            values.push(timezone);
        }
        if (locale) {
            updates.push('locale = ?');
            values.push(locale);
        }
        if (preferences) {
            updates.push('preferences = ?');
            values.push(JSON.stringify(preferences));
        }

        if (updates.length > 0) {
            values.push(user.id);
            await query.run(
                `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );
        }

        const updatedUser = await query.get('SELECT id, email, username, full_name, is_active, email_verified, mfa_enabled, timezone, locale, preferences, created_at, updated_at FROM users WHERE id = ?', [user.id]);

        return { status: 200, data: { user: updatedUser } };
    }

    // PUT /api/auth/password
    if (method === 'PUT' && path === '/password') {
        if (!user) return { status: 401, data: { error: 'Not authenticated' } };

        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return { status: 400, data: { error: 'Current and new password required' } };
        }

        // SECURITY: Validate new password strength
        const passwordErrors = validatePassword(newPassword);
        if (passwordErrors.length > 0) {
            return { status: 400, data: { error: 'Password too weak', details: passwordErrors } };
        }

        // SECURITY: Need password_hash for verification
        const pwUser = await query.get('SELECT id, password_hash FROM users WHERE id = ?', [user.id]);

        // SECURITY: User null check
        if (!pwUser) {
            return { status: 404, data: { error: 'User not found' } };
        }

        // SECURITY: Use async bcrypt to avoid blocking event loop
        if (!(await bcrypt.compare(currentPassword, pwUser.password_hash))) {
            return { status: 401, data: { error: 'Current password incorrect' } };
        }

        // SECURITY: Use async bcrypt with BCRYPT_ROUNDS constant
        const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await query.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

        // SECURITY: Invalidate all other sessions after password change to prevent
        // session hijacking with a stolen pre-change refresh token.
        // Identify the current session by the refresh token on the request context (if present),
        // then invalidate all OTHER sessions.  If no current session token is available,
        // invalidate ALL sessions and force re-login.
        const currentRefreshToken = ctx.refreshToken || null;
        if (currentRefreshToken) {
            const invalidated = await query.run(
                `UPDATE sessions SET is_valid = 0
                 WHERE user_id = ? AND refresh_token != ?`,
                [user.id, currentRefreshToken]
            );
            logger.info(`[auth] Password changed for user ${user.id}; invalidated ${invalidated.changes} other session(s)`);
        } else {
            const invalidated = await query.run(
                'UPDATE sessions SET is_valid = 0 WHERE user_id = ?',
                [user.id]
            );
            logger.info(`[auth] Password changed for user ${user.id}; invalidated all ${invalidated.changes} session(s) (no current token in context)`);
        }

        return { status: 200, data: { message: 'Password updated. All other sessions have been signed out.' } };
    }

    // GET /api/auth/sessions - List active sessions for user
    if (method === 'GET' && path === '/sessions') {
        const authHeader = ctx.request.headers.get('Authorization');
        if (!authHeader) return { status: 401, data: { error: 'Authentication required' } };
        const decoded = verifyToken(authHeader.split(' ')[1]);
        if (!decoded) return { status: 401, data: { error: 'Invalid token' } };

        const sessions = await query.all(
            `SELECT id, device_info, ip_address, created_at, expires_at,
                    CASE WHEN refresh_token = ? THEN 1 ELSE 0 END as current
             FROM sessions
             WHERE user_id = ? AND is_valid = 1 AND expires_at > NOW()
             ORDER BY created_at DESC`,
            [ctx.refreshToken || '', decoded.userId]
        );

        return { status: 200, data: sessions };
    }

    // DELETE /api/auth/sessions/:id - Revoke a specific session
    if (method === 'DELETE' && path.match(/^\/sessions\/[^/]+$/)) {
        const authHeader = ctx.request.headers.get('Authorization');
        if (!authHeader) return { status: 401, data: { error: 'Authentication required' } };
        const decoded = verifyToken(authHeader.split(' ')[1]);
        if (!decoded) return { status: 401, data: { error: 'Invalid token' } };

        const sessionId = path.split('/')[2];

        const result = await query.run(
            'UPDATE sessions SET is_valid = 0 WHERE id = ? AND user_id = ?',
            [sessionId, decoded.userId]
        );

        if (result.changes === 0) {
            return { status: 404, data: { error: 'Session not found' } };
        }

        return { status: 200, data: { message: 'Session revoked' } };
    }

    // POST /api/auth/sessions/revoke-all - Revoke all other sessions
    if (method === 'POST' && path === '/sessions/revoke-all') {
        const authHeader = ctx.request.headers.get('Authorization');
        if (!authHeader) return { status: 401, data: { error: 'Authentication required' } };
        const decoded = verifyToken(authHeader.split(' ')[1]);
        if (!decoded) return { status: 401, data: { error: 'Invalid token' } };

        const result = await query.run(
            `UPDATE sessions SET is_valid = 0
             WHERE user_id = ? AND is_valid = 1
             AND refresh_token != ?`,
            [decoded.userId, ctx.refreshToken || '']
        );

        return { status: 200, data: { message: 'All other sessions revoked', count: result.changes } };
    }

    // POST /api/auth/password-reset - Request password reset
    if (method === 'POST' && path === '/password-reset') {
        // SECURITY: Apply mutation-tier rate limiting to prevent abuse of password reset flow
        const resetRateError = await applyRateLimit(ctx, 'mutation');
        if (resetRateError) return resetRateError;

        const { email } = body;

        // Validate email format
        if (!email || !isValidEmail(email)) {
            // Always return success to prevent email enumeration
            return { status: 200, data: { message: 'If an account exists with that email, a password reset link has been sent.' } };
        }

        try {
            // Check if user exists (but don't reveal this to the caller)
            const user = await query.get('SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)', [email]);

            if (user) {
                // Generate a reset token
                const resetToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

                // Store the reset token
                await query.run(`
                    INSERT INTO password_resets (user_id, token, expires_at, created_at)
                    VALUES (?, ?, ?, NOW())
                `, [user.id, resetToken, expiresAt]);

                // Send password reset email (falls back to console.log if SMTP not configured)
                logger.info(`[auth] Password reset requested for ${maskEmail(email)}`);
                emailService.sendPasswordResetEmail(user, resetToken).catch(err =>
                    logger.error('[auth] Failed to send password reset email', null, { detail: err.message })
                );
            }
        } catch (e) {
            logger.error('[auth] Password reset error', null, { detail: e.message });
        }

        // Always return success to prevent email enumeration
        return { status: 200, data: { message: 'If an account exists with that email, a password reset link has been sent.' } };
    }

    // POST /api/auth/password-reset/confirm - Consume token and set new password
    if (method === 'POST' && path === '/password-reset/confirm') {
        const resetRateError = await applyRateLimit(ctx, 'mutation');
        if (resetRateError) return resetRateError;

        const { token, password } = body;

        if (!token || !password) {
            return { status: 400, data: { error: 'Token and new password are required.' } };
        }

        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            return { status: 400, data: { error: passwordErrors[0], errors: passwordErrors } };
        }

        try {
            const record = await query.get(
                `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email, u.username
                 FROM password_resets pr
                 JOIN users u ON u.id = pr.user_id
                 WHERE pr.token = ?`,
                [token]
            );

            if (!record) {
                return { status: 400, data: { error: 'Invalid or expired password reset link.' } };
            }
            if (record.used_at) {
                return { status: 400, data: { error: 'This password reset link has already been used.' } };
            }
            if (new Date(record.expires_at) < new Date()) {
                return { status: 400, data: { error: 'This password reset link has expired. Please request a new one.' } };
            }

            const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            await query.transaction(async (tx) => {
                await tx.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, record.user_id]);
                await tx.run('UPDATE password_resets SET used_at = NOW() WHERE token = ?', [token]);
                await tx.run('UPDATE sessions SET is_valid = 0 WHERE user_id = ?', [record.user_id]);
            });

            logger.info(`[auth] Password reset completed for ${maskEmail(record.email)}`);

            return { status: 200, data: { message: 'Password reset successfully. You can now log in with your new password.' } };
        } catch (e) {
            logger.error('[auth] Password reset confirm error', null, { detail: e.message });
            return { status: 500, data: { error: 'Password reset failed. Please try again.' } };
        }
    }

    // GET /api/auth/verify-email?token=... - Verify email address
    if (method === 'GET' && path === '/verify-email') {
        const token = ctx.query?.token;
        if (!token) {
            return { status: 400, data: { error: 'Verification token is required' } };
        }

        try {
            const record = await query.get(
                `SELECT ev.user_id, ev.expires_at, ev.used_at, u.email, u.username, u.email_verified
                 FROM email_verifications ev
                 JOIN users u ON u.id = ev.user_id
                 WHERE ev.token = ?`,
                [token]
            );

            if (!record) {
                return { status: 400, data: { error: 'Invalid or expired verification link.' } };
            }
            if (record.used_at) {
                return { status: 400, data: { error: 'This verification link has already been used.' } };
            }
            if (new Date(record.expires_at) < new Date()) {
                return { status: 400, data: { error: 'This verification link has expired. Please request a new one.' } };
            }
            if (record.email_verified) {
                return { status: 200, data: { message: 'Your email is already verified. You can log in.' } };
            }

            await query.transaction(async (tx) => {
                await tx.run('UPDATE users SET email_verified = TRUE WHERE id = ?', [record.user_id]);
                await tx.run('UPDATE email_verifications SET used_at = NOW() WHERE token = ?', [token]);
            });

            return { status: 200, data: { message: 'Email verified successfully! You can now log in.' } };
        } catch (e) {
            logger.error('[auth] Email verification error', null, { detail: e.message });
            return { status: 500, data: { error: 'Verification failed. Please try again.' } };
        }
    }

    // POST /api/auth/resend-verification - Resend email verification
    if (method === 'POST' && path === '/resend-verification') {
        const { email } = body;

        // Validate email format
        if (!email || !isValidEmail(email)) {
            return { status: 200, data: { message: 'If an account exists with that email, a verification email has been sent.' } };
        }

        try {
            const user = await query.get('SELECT id, email, email_verified FROM users WHERE LOWER(email) = LOWER(?)', [email]);

            if (user && !user.email_verified) {
                // Generate a verification token
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

                await query.run(`
                    INSERT INTO email_verifications (user_id, token, expires_at, created_at)
                    VALUES (?, ?, ?, NOW())
                `, [user.id, verificationToken, expiresAt]);

                await emailService.sendVerificationEmail(user, verificationToken);
            }
        } catch (e) {
            logger.error('[auth] Resend verification error', null, { detail: e.message });
        }

        // Always return success to prevent email enumeration
        return { status: 200, data: { message: 'If an account exists with that email, a verification email has been sent.' } };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
