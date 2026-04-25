import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../../db/database.js';
import { applyRateLimit } from '../../middleware/rateLimiter.js';
import emailService from '../../services/email.js';
import { logger } from '../../shared/logger.js';
import {
    BCRYPT_ROUNDS,
    validatePassword,
    isValidEmail,
    maskEmail
} from './helpers.js';

export async function handleProfile(ctx) {
    const { body, user } = ctx;
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

export async function handlePassword(ctx) {
    const { body, user } = ctx;
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

export async function handlePasswordReset(ctx) {
    const { body } = ctx;
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

export async function handlePasswordResetConfirm(ctx) {
    const { body } = ctx;
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
