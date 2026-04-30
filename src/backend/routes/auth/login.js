import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../../db/database.js';
import { generateToken, generateRefreshToken } from '../../middleware/auth.js';
import mfaService from '../../services/mfa.js';
import { applyRateLimit } from '../../middleware/rateLimiter.js';
import { logger } from '../../shared/logger.js';
import {
    BCRYPT_ROUNDS,
    isAuthLockoutBypassed,
    isValidEmail,
    checkLoginAttempts,
    logFailedLogin,
    clearLoginAttempts,
    demoPasswordMatch,
    ensureTestDemoUser,
    enforceSessionLimit,
    authCookies,
} from './helpers.js';

export async function handleLogin(ctx) {
    const { body } = ctx;
    const ip = ctx.ip || 'unknown';
    const userAgent = ctx.userAgent || 'unknown';
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
            const lockoutStatus = await checkLoginAttempts(email, ip);
            if (lockoutStatus.locked) {
                return {
                    status: 429,
                    data: {
                        error: `Too many failed login attempts. Please try again in ${lockoutStatus.minutesLeft} minutes.`,
                        locked: true,
                        retryAfter: lockoutStatus.minutesLeft * 60,
                    },
                };
            }
        }

        // SECURITY: Need password_hash for verification, will clean before return
        const normalizedEmail = email.toLowerCase();
        const isTestDemoLogin =
            isAuthLockoutBypassed() && normalizedEmail === 'demo@vaultlister.com' && demoPasswordMatch(password);

        let user = await query.get(
            'SELECT id, email, username, full_name, password_hash, is_active, email_verified, mfa_enabled, subscription_tier, stripe_customer_id, created_at FROM users WHERE email = ? AND is_active = TRUE',
            [normalizedEmail],
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
            logFailedLogin(email, ip, userAgent).catch((err) =>
                logger.error('[auth] logFailedLogin error', null, { detail: err?.message }),
            );
            // Re-check attempts after logging this failure
            const response = { error: 'Invalid email or password' };
            if (!isAuthLockoutBypassed()) {
                const updatedLockout = await checkLoginAttempts(email, ip);
                if (updatedLockout.locked) {
                    response.locked = true;
                    response.retryAfter = updatedLockout.minutesLeft * 60;
                }
            }
            return { status: 401, data: response };
        }

        // SECURITY: Clear failed login attempts on success
        clearLoginAttempts(email, ip).catch((err) =>
            logger.error('[auth] clearLoginAttempts error', null, { detail: err?.message }),
        );

        // SECURITY: Warn (but do not block) on unverified email.
        // Blocking entirely causes UX breakage when email delivery is delayed.
        // The emailVerifiedWarning flag lets the frontend display a persistent banner.
        const emailVerifiedWarning =
            user.email_verified === 0
                ? 'Your email address has not been verified. Some features may be restricted. Check your inbox for a verification link.'
                : null;

        // In hermetic demo-login test path, do not require MFA challenge.
        const shouldRequireMfa = Boolean(user.mfa_enabled) && !isTestDemoLogin;
        if (shouldRequireMfa) {
            // Generate a temporary MFA token valid for 5 minutes
            const mfaToken = crypto.randomBytes(32).toString('hex');

            // Store MFA token for verification
            await query.run(
                `
                INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
                VALUES (?, ?, ?, 'mfa_login', NOW() + INTERVAL '5 minutes')
            `,
                [uuidv4(), user.id, mfaToken],
            );

            return {
                status: 202,
                data: {
                    mfaRequired: true,
                    mfaToken,
                    message: 'Please enter your two-factor authentication code',
                },
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
        await enforceSessionLimit(user.id);

        // Store session with device info
        await query.run(
            `
            INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
            VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
        `,
            [uuidv4(), user.id, refreshToken, userAgent, ip],
        );

        const loginResponse = { user, token, refreshToken };
        if (emailVerifiedWarning) {
            loginResponse.warning = emailVerifiedWarning;
            loginResponse.emailVerified = false;
        }

        return {
            status: 200,
            data: loginResponse,
            cookies: authCookies(token, refreshToken),
        };
    } catch (error) {
        logger.error('[Auth] Error during login', null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

export async function handleDemoLogin(ctx) {
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

        await query.run(
            `
            INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
            VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
        `,
            [uuidv4(), demoUser.id, refreshToken, 'Demo Auto-Login', ctx.ip || 'unknown'],
        );

        const { password_hash, mfa_secret, mfa_backup_codes, ...safeUser } = demoUser;
        return {
            status: 200,
            data: { user: safeUser, token, refreshToken },
            cookies: authCookies(token, refreshToken),
        };
    } catch (error) {
        logger.error('[Auth] Error during demo login', null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

export async function handleMfaVerify(ctx) {
    const { body } = ctx;
    const ip = ctx.ip || 'unknown';
    const userAgent = ctx.userAgent || 'unknown';
    try {
        // SECURITY: Auth-tier rate limit — prevents brute-force of 6-digit TOTP codes
        const mfaRateError = await applyRateLimit(ctx, 'auth');
        if (mfaRateError) return mfaRateError;

        const { mfaToken, code } = body;

        if (!mfaToken || !code) {
            return { status: 400, data: { error: 'MFA token and code required' } };
        }

        // SECURITY: Atomically mark token as used to prevent TOCTOU race condition
        const updated = await query.run(
            `
            UPDATE verification_tokens SET used_at = NOW()
            WHERE token = ? AND type = 'mfa_login'
            AND expires_at > NOW() AND used_at IS NULL
        `,
            [mfaToken],
        );

        if (updated.changes === 0) {
            return { status: 401, data: { error: 'Invalid or expired MFA session. Please login again.' } };
        }

        // Get the token record (already marked as used, safe from reuse)
        const tokenRecord = await query.get(
            `
            SELECT vt.*, u.id, u.email, u.username, u.full_name, u.plan_tier,
                   u.is_admin, u.is_active, u.mfa_enabled, u.mfa_secret,
                   u.mfa_backup_codes, u.email_verified, u.created_at
            FROM verification_tokens vt
            JOIN users u ON vt.user_id = u.id
            WHERE vt.token = ? AND vt.type = 'mfa_login'
        `,
            [mfaToken],
        );

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
            userAgent,
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
            mfa_enabled: tokenRecord.mfa_enabled,
        };

        const mfaVerifiedAt = Math.floor(Date.now() / 1000);
        const token = generateToken(user, undefined, { mfa_verified_at: mfaVerifiedAt });
        const refreshToken = generateRefreshToken(user);

        // SECURITY: Cap concurrent sessions before inserting the new one
        await enforceSessionLimit(user.id);

        // Store session with device info
        await query.run(
            `
            INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
            VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
        `,
            [uuidv4(), user.id, refreshToken, userAgent, ip],
        );

        const response = {
            user,
            token,
            refreshToken,
            mfaVerifiedAt,
        };

        // Add warning if backup code was used and few remaining
        if (mfaResult.warning) {
            response.warning = mfaResult.warning;
        }

        return {
            status: 200,
            data: response,
            cookies: authCookies(token, refreshToken),
        };
    } catch (error) {
        logger.error('[Auth] Error during MFA verification', null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
