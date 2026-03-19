// Security Routes
// Handles email verification, MFA setup, and security settings

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import emailService from '../services/email.js';
import mfaService from '../services/mfa.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { auditLog } from '../services/auditLog.js';
import { logger } from '../shared/logger.js';

/**
 * Security Router
 */
export async function securityRouter(ctx) {
    const { method, path, body, user } = ctx;
    const ip = ctx.ip || 'unknown';
    const userAgent = ctx.userAgent || 'unknown';

    // ==================== EMAIL VERIFICATION ====================

    // POST /api/security/send-verification - Send verification email
    if (method === 'POST' && path === '/send-verification') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const userData = query.get('SELECT id, email, username, full_name, email_verified FROM users WHERE id = ?', [user.id]);

            if (userData.email_verified) {
                return { status: 400, data: { error: 'Email already verified' } };
            }

            // Check for existing pending token
            const existingToken = query.get(`
                SELECT * FROM verification_tokens
                WHERE user_id = ? AND type = 'email_verification'
                AND expires_at > datetime('now') AND used_at IS NULL
            `, [user.id]);

            if (existingToken) {
                return { status: 429, data: { error: 'Verification email already sent. Please check your inbox or wait before requesting another.' } };
            }

            // Generate verification token
            const token = crypto.randomBytes(32).toString('hex');

            query.run(`
                INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
                VALUES (?, ?, ?, 'email_verification', datetime('now', '+24 hours'))
            `, [uuidv4(), user.id, token]);

            // Send verification email
            await emailService.sendVerificationEmail(userData, token);

            return {
                status: 200,
                data: { message: 'Verification email sent. Please check your inbox.' }
            };
        } catch (error) {
            logger.error('[Security] Error sending verification email', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/security/verify-email - Verify email with token
    if (method === 'POST' && path === '/verify-email') {
        try {
            const verifyRateError = applyRateLimit(ctx, 'auth');
            if (verifyRateError) return verifyRateError;

            const { token } = body;

            if (!token) {
                return { status: 400, data: { error: 'Verification token required' } };
            }

            // SECURITY: Atomically mark token as used to prevent TOCTOU race condition
            const updated = query.run(`
                UPDATE verification_tokens SET used_at = datetime('now')
                WHERE token = ? AND type = 'email_verification'
                AND expires_at > datetime('now') AND used_at IS NULL
            `, [token]);

            if (updated.changes === 0) {
                return { status: 400, data: { error: 'Invalid or expired verification link' } };
            }

            // Get the token record (already marked as used, safe from reuse)
            const tokenRecord = query.get(`
                SELECT vt.*, u.email FROM verification_tokens vt
                JOIN users u ON vt.user_id = u.id
                WHERE vt.token = ? AND vt.type = 'email_verification'
            `, [token]);

            // Mark email as verified
            query.run(`
                UPDATE users
                SET email_verified = 1, email_verified_at = datetime('now'), updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [tokenRecord.user_id]);

            return {
                status: 200,
                data: { message: 'Email verified successfully!' }
            };
        } catch (error) {
            logger.error('[Security] Error verifying email', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ==================== PASSWORD RESET ====================

    // POST /api/security/forgot-password - Request password reset
    if (method === 'POST' && path === '/forgot-password') {
        try {
            // SECURITY: Auth-tier rate limit to prevent password reset abuse / email flooding
            const resetRateError = applyRateLimit(ctx, 'auth');
            if (resetRateError) return resetRateError;

            const { email } = body;

            if (!email) {
                return { status: 400, data: { error: 'Email required' } };
            }

            // Always return success to prevent email enumeration
            const successResponse = {
                status: 200,
                data: { message: 'If an account exists with that email, you will receive a password reset link.' }
            };

            const userData = query.get('SELECT id, email, username, full_name FROM users WHERE email = ?', [email.toLowerCase()]);

            if (!userData) {
                return successResponse;
            }

            // Invalidate any existing reset tokens
            query.run(`
                UPDATE verification_tokens SET used_at = datetime('now')
                WHERE user_id = ? AND type = 'password_reset' AND used_at IS NULL
            `, [userData.id]);

            // Generate reset token
            const token = crypto.randomBytes(32).toString('hex');

            query.run(`
                INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
                VALUES (?, ?, ?, 'password_reset', datetime('now', '+1 hour'))
            `, [uuidv4(), userData.id, token]);

            // Send reset email
            await emailService.sendPasswordResetEmail(userData, token);

            return successResponse;
        } catch (error) {
            logger.error('[Security] Error requesting password reset', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/security/reset-password - Reset password with token
    if (method === 'POST' && path === '/reset-password') {
        try {
            const resetRateError = applyRateLimit(ctx, 'auth');
            if (resetRateError) return resetRateError;

            const { token, password } = body;

            if (!token || !password) {
                return { status: 400, data: { error: 'Token and new password required' } };
            }

            // Validate password strength
            const passwordErrors = validatePassword(password);
            if (passwordErrors.length > 0) {
                return { status: 400, data: { error: passwordErrors.join('. ') } };
            }

            // SECURITY: Atomically mark token as used to prevent TOCTOU race condition
            const updated = query.run(`
                UPDATE verification_tokens SET used_at = datetime('now')
                WHERE token = ? AND type = 'password_reset'
                AND expires_at > datetime('now') AND used_at IS NULL
            `, [token]);

            if (updated.changes === 0) {
                return { status: 400, data: { error: 'Invalid or expired reset link' } };
            }

            // Get the token record (already marked as used, safe from reuse)
            const tokenRecord = query.get(`
                SELECT * FROM verification_tokens
                WHERE token = ? AND type = 'password_reset'
            `, [token]);

            if (!tokenRecord) {
                return { status: 400, data: { error: 'Invalid or expired reset link' } };
            }

            const bcrypt = await import('bcryptjs');
            const passwordHash = await bcrypt.hash(password, 12);

            // Update password
            query.run(`
                UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `, [passwordHash, tokenRecord.user_id]);

            // Invalidate all sessions
            query.run('UPDATE sessions SET is_valid = 0 WHERE user_id = ?', [tokenRecord.user_id]);

            // Send security alert
            const userData = query.get('SELECT id, email, username, full_name FROM users WHERE id = ?', [tokenRecord.user_id]);
            await emailService.sendSecurityAlertEmail(userData, 'password_changed', { ip, time: new Date().toISOString() });

            return {
                status: 200,
                data: { message: 'Password reset successfully. Please login with your new password.' }
            };
        } catch (error) {
            logger.error('[Security] Error resetting password', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ==================== MFA SETUP ====================

    // POST /api/security/mfa/setup - Initialize MFA setup
    if (method === 'POST' && path === '/mfa/setup') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const userData = query.get('SELECT id, email, username, full_name, mfa_enabled FROM users WHERE id = ?', [user.id]);

            if (userData.mfa_enabled) {
                return { status: 400, data: { error: 'MFA is already enabled' } };
            }

            const setupData = await mfaService.setupMFA(user.id, userData.email);

            return {
                status: 200,
                data: {
                    qrCode: setupData.qrCode,
                    secret: setupData.secret, // For manual entry
                    setupToken: setupData.setupToken
                }
            };
        } catch (error) {
            logger.error('[Security] Error setting up MFA', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/security/mfa/verify-setup - Verify and enable MFA
    if (method === 'POST' && path === '/mfa/verify-setup') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            // SECURITY: Auth-tier rate limit — 6-digit TOTP codes are brute-forceable at 30 req/min
            const mfaRateError = applyRateLimit(ctx, 'auth');
            if (mfaRateError) return mfaRateError;

            const { setupToken, code, secret } = body;

            if (!setupToken || !code || !secret) {
                return { status: 400, data: { error: 'Setup token, code, and secret required' } };
            }

            // Verify the setup token
            const tokenRecord = query.get(`
                SELECT * FROM verification_tokens
                WHERE user_id = ? AND token = ? AND type = 'mfa_setup'
                AND expires_at > datetime('now') AND used_at IS NULL
            `, [user.id, setupToken]);

            if (!tokenRecord) {
                return { status: 400, data: { error: 'Invalid or expired setup session. Please start over.' } };
            }

            // Complete MFA setup
            const result = mfaService.completeSetup(user.id, secret, code, ip, userAgent);

            if (!result.success) {
                return { status: 400, data: { error: result.error } };
            }

            // Mark setup token as used
            query.run('UPDATE verification_tokens SET used_at = datetime(\'now\') WHERE id = ?', [tokenRecord.id]);

            // Send notification email
            const userData = query.get('SELECT id, email, username, full_name FROM users WHERE id = ?', [user.id]);
            await emailService.sendMFAEnabledEmail(userData);

            return {
                status: 200,
                data: {
                    message: 'Two-factor authentication enabled successfully!',
                    backupCodes: result.backupCodes,
                    warning: 'Save these backup codes in a safe place. You will not be able to see them again.'
                }
            };
        } catch (error) {
            logger.error('[Security] Error verifying MFA setup', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/security/mfa/disable - Disable MFA
    if (method === 'POST' && path === '/mfa/disable') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const { password } = body;

            if (!password) {
                return { status: 400, data: { error: 'Password required to disable MFA' } };
            }

            const userData = query.get('SELECT id, email, username, full_name, mfa_enabled, password_hash FROM users WHERE id = ?', [user.id]);

            if (!userData.mfa_enabled) {
                return { status: 400, data: { error: 'MFA is not enabled' } };
            }

            const result = await mfaService.disableMFA(user.id, password, userData.password_hash, ip, userAgent);

            if (!result.success) {
                return { status: 400, data: { error: result.error } };
            }

            // Send notification email
            await emailService.sendMFADisabledEmail(userData);

            // Log to central audit trail
            try {
                await auditLog.log({
                    userId: user.id, action: 'mfa_disabled', category: 'security',
                    severity: 'warning', ip: ctx.ip, userAgent: ctx.userAgent,
                    details: { username: userData.username }
                });
            } catch (e) {
                logger.error('[Security] Failed to write audit log for MFA disable', user?.id || null, { detail: e.message });
            }

            return {
                status: 200,
                data: { message: 'Two-factor authentication disabled.' }
            };
        } catch (error) {
            logger.error('[Security] Error disabling MFA', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/security/mfa/regenerate-codes - Regenerate backup codes
    if (method === 'POST' && path === '/mfa/regenerate-codes') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const { password } = body;

            if (!password) {
                return { status: 400, data: { error: 'Password required' } };
            }

            const userData = query.get('SELECT id, email, username, full_name, mfa_enabled, password_hash FROM users WHERE id = ?', [user.id]);

            if (!userData.mfa_enabled) {
                return { status: 400, data: { error: 'MFA is not enabled' } };
            }

            const result = await mfaService.regenerateBackupCodes(user.id, password, userData.password_hash, ip, userAgent);

            if (!result.success) {
                return { status: 400, data: { error: result.error } };
            }

            return {
                status: 200,
                data: {
                    message: 'New backup codes generated.',
                    backupCodes: result.backupCodes,
                    warning: 'Your old backup codes are now invalid. Save these new codes in a safe place.'
                }
            };
        } catch (error) {
            logger.error('[Security] Error regenerating MFA backup codes', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/security/mfa/status - Get MFA status
    if (method === 'GET' && path === '/mfa/status') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const userData = query.get('SELECT mfa_enabled, mfa_backup_codes FROM users WHERE id = ?', [user.id]);
            const backupCodes = JSON.parse(userData.mfa_backup_codes || '[]');
            const remainingCodes = backupCodes.filter(c => c !== null).length;

            return {
                status: 200,
                data: {
                    mfaEnabled: !!userData.mfa_enabled,
                    backupCodesRemaining: userData.mfa_enabled ? remainingCodes : 0
                }
            };
        } catch (error) {
            logger.error('[Security] Error fetching MFA status', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ==================== SECURITY EVENTS ====================

    // GET /api/security/events - Get security events for user
    if (method === 'GET' && path === '/events') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const events = query.all(`
                SELECT event_type, ip_address, user_agent, created_at
                FROM mfa_events
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            `, [user.id]);

            // Query uses masked email because logFailedLogin stores only the masked form — never raw PII.
            const maskedEmail = user.email.length > 0
                ? user.email[0] + '***' + user.email.slice(user.email.indexOf('@'))
                : '***';
            const escapedEmail = maskedEmail.replace(/[%_\\]/g, '\\$&');
            const loginEvents = query.all(`
                SELECT 'login' as event_type, ip_or_user as ip_address, details, created_at
                FROM security_logs
                WHERE details LIKE ? ESCAPE '\\'
                ORDER BY created_at DESC
                LIMIT 50
            `, [`%"email":"${escapedEmail}"%`]);

            return {
                status: 200,
                data: {
                    mfaEvents: events,
                    loginEvents: loginEvents
                }
            };
        } catch (error) {
            logger.error('[Security] Error fetching security events', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}

// Password validation helper
function validatePassword(password) {
    const errors = [];
    if (password.length < 12) errors.push('Password must be at least 12 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Password must contain at least one special character');
    return errors;
}

export default securityRouter;
