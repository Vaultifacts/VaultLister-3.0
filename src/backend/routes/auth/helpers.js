import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../../db/database.js';
import { logger } from '../../shared/logger.js';

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
        `vl_refresh=${refreshToken}; Path=/api/auth/refresh; Max-Age=604800; ${COOKIE_BASE}`,
    ];
}

// Build Set-Cookie headers that immediately expire both auth cookies (logout)
function clearAuthCookies() {
    return [
        `vl_access=; Path=/; Max-Age=0; ${COOKIE_BASE}`,
        `vl_refresh=; Path=/api/auth/refresh; Max-Age=0; ${COOKIE_BASE}`,
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
    try {
        const windowStart = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000);
        const masked = maskEmail(email.toLowerCase());
        const attempts = await query.all(
            `
            SELECT created_at FROM security_logs
            WHERE (details ILIKE ? ESCAPE '\\' OR ip_or_user = ?)
            AND event_type = 'login_failed'
            AND created_at > ?
            ORDER BY created_at ASC
        `,
            [`%${escapeLike(masked)}%`, ip, windowStart.toISOString()],
        );

        if (attempts.length >= MAX_LOGIN_ATTEMPTS) {
            const oldestAttempt = new Date(attempts[0].created_at);
            const lockoutExpires = new Date(oldestAttempt.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
            const minutesLeft = Math.ceil((lockoutExpires - Date.now()) / 60000);
            return { locked: true, attempts: attempts.length, minutesLeft: Math.max(1, minutesLeft) };
        }
        return { locked: false, attempts: attempts.length };
    } catch (e) {
        logger.error('[auth] Failed to check login attempts', null, { detail: e.message });
        return { locked: false, attempts: 0 }; // Fail open to avoid lockout on DB error
    }
}

// SECURITY: Log failed login attempt — stores masked email, never raw PII.
async function logFailedLogin(email, ip, userAgent) {
    try {
        await query.run(
            `
            INSERT INTO security_logs (event_type, ip_or_user, details, created_at)
            VALUES ('login_failed', ?, ?, NOW())
        `,
            [ip, JSON.stringify({ email: maskEmail(email.toLowerCase()), userAgent: userAgent || 'unknown' })],
        );
    } catch (e) {
        logger.error('[auth] Failed to log security event', null, { detail: e.message });
    }
}

// SECURITY: Clear login attempts on successful login
async function clearLoginAttempts(email, ip) {
    try {
        const lockoutEnd = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000);
        const masked = maskEmail(email.toLowerCase());
        await query.run(
            `
            DELETE FROM security_logs
            WHERE (details ILIKE ? ESCAPE '\\' OR ip_or_user = ?)
            AND event_type = 'login_failed'
            AND created_at > ?
        `,
            [`%${escapeLike(masked)}%`, ip, lockoutEnd.toISOString()],
        );
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
        [demoEmail],
    );

    if (!existing) {
        const id = uuidv4();
        const passwordHash = await bcrypt.hash(demoPassword, BCRYPT_ROUNDS);
        await query.run(
            `
            INSERT INTO users (id, email, password_hash, username, full_name, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        `,
            [id, demoEmail, passwordHash, demoUsername, demoFullName],
        );
    } else if (!existing.is_active) {
        await query.run('UPDATE users SET is_active = TRUE WHERE id = ?', [existing.id]);
    }

    return await query.get(
        'SELECT id, email, username, full_name, password_hash, is_active, email_verified, mfa_enabled, subscription_tier, stripe_customer_id, created_at FROM users WHERE email = ? AND is_active = TRUE',
        [demoEmail],
    );
}

// SECURITY: Enforce a maximum of 10 concurrent sessions per user.
// Deletes the oldest sessions (by created_at) when the limit is reached,
// leaving room for one new session to be inserted by the caller.
async function enforceSessionLimit(userId) {
    try {
        const sessionCount = await query.get(
            'SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND is_valid = 1',
            [userId],
        );
        if (sessionCount && sessionCount.count >= 10) {
            const excess = sessionCount.count - 9; // keep 9, caller inserts the 10th
            await query.run(
                `
                DELETE FROM sessions WHERE id IN (
                    SELECT id FROM sessions
                    WHERE user_id = ? AND is_valid = 1
                    ORDER BY created_at ASC
                    LIMIT ?
                )
            `,
                [userId, excess],
            );
            logger.info(`[auth] Pruned ${excess} oldest session(s) for user ${userId}`);
        }
    } catch (e) {
        logger.error('[auth] enforceSessionLimit error', null, { detail: e.message });
    }
}

export {
    IS_TEST_RUNTIME,
    isAuthLockoutBypassed,
    MAX_LOGIN_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
    BCRYPT_ROUNDS,
    SECURE_FLAG,
    COOKIE_BASE,
    authCookies,
    clearAuthCookies,
    validatePassword,
    isValidEmail,
    escapeLike,
    maskEmail,
    checkLoginAttempts,
    logFailedLogin,
    clearLoginAttempts,
    demoPasswordMatch,
    ensureTestDemoUser,
    enforceSessionLimit,
};
