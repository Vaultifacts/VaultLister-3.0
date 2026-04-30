// Enhanced Multi-Factor Authentication Service
// WebAuthn/FIDO2, Backup Codes, SMS Fallback

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import redis from './redis.js';

// WebAuthn configuration
const RP_NAME = 'VaultLister';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

// Generate random bytes as base64url
function generateChallenge() {
    return crypto.randomBytes(32).toString('base64url');
}

// Generate backup codes
function generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
        // Generate 8-character alphanumeric codes
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
}

// Hash backup code for storage (salted with HMAC)
function hashBackupCode(code) {
    const normalized = code.replaceAll('-', '');
    const hmacKey = process.env.BACKUP_CODE_SECRET || 'dev-backup-code-secret';
    return crypto.createHmac('sha256', hmacKey).update(normalized).digest('hex');
}

// Enhanced MFA Service
const enhancedMFA = {
    // ========================================
    // WebAuthn/FIDO2
    // ========================================

    // Start WebAuthn registration
    async startRegistration(userId) {
        const user = await query.get('SELECT id, email, username FROM users WHERE id = ?', [userId]);
        if (!user) throw new Error('User not found');

        // Get existing credentials to exclude
        const existingCredentials =
            (await query.all('SELECT credential_id FROM webauthn_credentials WHERE user_id = ?', [userId])) || [];

        const challenge = generateChallenge();

        // Store challenge temporarily
        await redis.setJson(
            'mfa:challenge:' + userId,
            {
                challenge,
                type: 'registration',
                timestamp: Date.now(),
            },
            120,
        );

        return {
            challenge,
            rp: {
                name: RP_NAME,
                id: RP_ID,
            },
            user: {
                id: Buffer.from(userId).toString('base64url'),
                name: user.email,
                displayName: user.username || user.email.split('@')[0],
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' }, // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            timeout: 60000,
            attestation: 'none',
            excludeCredentials: existingCredentials.map((c) => ({
                id: c.credential_id,
                type: 'public-key',
                transports: ['usb', 'ble', 'nfc', 'internal'],
            })),
            authenticatorSelection: {
                authenticatorAttachment: 'cross-platform',
                requireResidentKey: false,
                userVerification: 'preferred',
            },
        };
    },

    // Complete WebAuthn registration
    async completeRegistration(userId, credential, deviceName) {
        const stored = await redis.getJson('mfa:challenge:' + userId);
        if (!stored || stored.type !== 'registration') {
            throw new Error('No registration in progress');
        }

        if (Date.now() - stored.timestamp > 60000) {
            await redis.del('mfa:challenge:' + userId);
            throw new Error('Challenge expired');
        }

        await redis.del('mfa:challenge:' + userId);

        // In production, verify attestation properly
        // For now, store the credential
        const credentialId = uuidv4();

        await query.run(
            `
            INSERT INTO webauthn_credentials (
                id, user_id, credential_id, public_key, sign_count,
                device_name, created_at, last_used_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
            [
                credentialId,
                userId,
                credential.id,
                credential.response.publicKey || credential.response.attestationObject,
                0,
                deviceName || 'Security Key',
            ],
        );

        // Enable MFA if not already
        await query.run(
            `
            UPDATE users SET mfa_enabled = TRUE, mfa_method = 'webauthn', updated_at = NOW()
            WHERE id = ? AND mfa_enabled = FALSE
        `,
            [userId],
        );

        return { credentialId, message: 'Security key registered successfully' };
    },

    // Start WebAuthn authentication
    async startAuthentication(userId) {
        const credentials = await query.all('SELECT credential_id FROM webauthn_credentials WHERE user_id = ?', [
            userId,
        ]);

        if (!credentials || credentials.length === 0) {
            throw new Error('No security keys registered');
        }

        const challenge = generateChallenge();

        await redis.setJson(
            'mfa:challenge:' + userId,
            {
                challenge,
                type: 'authentication',
                timestamp: Date.now(),
            },
            120,
        );

        return {
            challenge,
            timeout: 60000,
            rpId: RP_ID,
            allowCredentials: credentials.map((c) => ({
                id: c.credential_id,
                type: 'public-key',
                transports: ['usb', 'ble', 'nfc', 'internal'],
            })),
            userVerification: 'preferred',
        };
    },

    // Complete WebAuthn authentication
    async completeAuthentication(userId, assertion) {
        const stored = await redis.getJson('mfa:challenge:' + userId);
        if (!stored || stored.type !== 'authentication') {
            throw new Error('No authentication in progress');
        }

        if (Date.now() - stored.timestamp > 60000) {
            await redis.del('mfa:challenge:' + userId);
            throw new Error('Challenge expired');
        }

        await redis.del('mfa:challenge:' + userId);

        // Verify the credential exists
        const credential = await query.get(
            'SELECT * FROM webauthn_credentials WHERE user_id = ? AND credential_id = ?',
            [userId, assertion.id],
        );

        if (!credential) {
            throw new Error('Unknown credential');
        }

        // In production, verify signature properly
        // Update sign count and last used
        await query.run(
            `
            UPDATE webauthn_credentials
            SET sign_count = sign_count + 1, last_used_at = NOW()
            WHERE id = ?
        `,
            [credential.id],
        );

        return { success: true, message: 'Authentication successful' };
    },

    // List registered security keys
    async listSecurityKeys(userId) {
        return (
            (await query.all(
                `
            SELECT id, device_name, created_at, last_used_at
            FROM webauthn_credentials
            WHERE user_id = ?
            ORDER BY created_at DESC
        `,
                [userId],
            )) || []
        );
    },

    // Remove security key
    async removeSecurityKey(userId, credentialId) {
        const remaining = await query.get(
            'SELECT COUNT(*) as count FROM webauthn_credentials WHERE user_id = ? AND id != ?',
            [userId, credentialId],
        );

        // Check if user has other MFA methods
        const user = await query.get('SELECT mfa_method FROM users WHERE id = ?', [userId]);
        const hasBackupCodes = await query.get(
            'SELECT COUNT(*) as count FROM backup_codes WHERE user_id = ? AND used_at IS NULL',
            [userId],
        );

        if (
            remaining.count === 0 &&
            user?.mfa_method === 'webauthn' &&
            (!hasBackupCodes || hasBackupCodes.count === 0)
        ) {
            throw new Error('Cannot remove last security key without other MFA methods');
        }

        await query.run('DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?', [credentialId, userId]);

        return { message: 'Security key removed' };
    },

    // ========================================
    // Backup Codes
    // ========================================

    // Generate new backup codes
    async generateBackupCodes(userId) {
        // Delete existing unused codes
        await query.run('DELETE FROM backup_codes WHERE user_id = ? AND used_at IS NULL', [userId]);

        const codes = generateBackupCodes(10);
        const batchId = uuidv4();

        for (const code of codes) {
            await query.run(
                `
                INSERT INTO backup_codes (id, user_id, code_hash, batch_id, created_at)
                VALUES (?, ?, ?, ?, NOW())
            `,
                [uuidv4(), userId, hashBackupCode(code), batchId],
            );
        }

        // Enable MFA if not already
        await query.run(
            `
            UPDATE users SET mfa_enabled = TRUE, updated_at = NOW()
            WHERE id = ? AND mfa_enabled = FALSE
        `,
            [userId],
        );

        return {
            codes,
            message: 'Save these codes securely. They can only be shown once.',
            warning: 'Each code can only be used once.',
        };
    },

    // Verify backup code
    async verifyBackupCode(userId, code) {
        const codeHash = hashBackupCode(code.replaceAll('-', '').replaceAll(' ', ''));

        const backupCode = await query.get(
            `
            SELECT * FROM backup_codes
            WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
        `,
            [userId, codeHash],
        );

        if (!backupCode) {
            return { success: false, message: 'Invalid or already used code' };
        }

        // Mark as used
        await query.run(
            `
            UPDATE backup_codes SET used_at = NOW() WHERE id = ?
        `,
            [backupCode.id],
        );

        // Count remaining codes
        const remaining = await query.get(
            `
            SELECT COUNT(*) as count FROM backup_codes
            WHERE user_id = ? AND used_at IS NULL
        `,
            [userId],
        );

        return {
            success: true,
            remainingCodes: remaining.count,
            warning: remaining.count < 3 ? 'Running low on backup codes. Generate new ones soon.' : null,
        };
    },

    // Get backup code status
    async getBackupCodeStatus(userId) {
        const stats = await query.get(
            `
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN used_at IS NULL THEN 1 END) as remaining,
                COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used
            FROM backup_codes
            WHERE user_id = ?
        `,
            [userId],
        );

        return {
            total: stats?.total || 0,
            remaining: stats?.remaining || 0,
            used: stats?.used || 0,
        };
    },

    // ========================================
    // SMS Fallback
    // ========================================

    // Register phone number for SMS MFA
    async registerPhone(userId, phoneNumber) {
        // Basic phone validation
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
            throw new Error('Invalid phone number');
        }

        // Generate verification code using cryptographically secure random
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Hash the code before storing
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        await query.run(
            `
            UPDATE users SET
                pending_phone = ?,
                phone_verification_code = ?,
                phone_verification_expires = ?,
                updated_at = NOW()
            WHERE id = ?
        `,
            [cleanPhone, hashedCode, expiresAt.toISOString(), userId],
        );

        // In production, send via Twilio/SNS — never log codes in production
        if (process.env.NODE_ENV !== 'production') {
            logger.info(`[EnhancedMFA] SMS verification code for ${cleanPhone}: ${code}`);
        }

        return {
            message: 'Verification code sent',
            phoneLastFour: cleanPhone.slice(-4),
        };
    },

    // Verify phone number
    async verifyPhone(userId, code) {
        const user = await query.get(
            `
            SELECT pending_phone, phone_verification_code, phone_verification_expires
            FROM users WHERE id = ?
        `,
            [userId],
        );

        if (!user?.pending_phone) {
            throw new Error('No phone verification pending');
        }

        if (new Date(user.phone_verification_expires) < new Date()) {
            throw new Error('Verification code expired');
        }

        const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
        if (
            !crypto.timingSafeEqual(Buffer.from(user.phone_verification_code, 'hex'), Buffer.from(hashedInput, 'hex'))
        ) {
            throw new Error('Invalid verification code');
        }

        await query.run(
            `
            UPDATE users SET
                phone_number = pending_phone,
                pending_phone = NULL,
                phone_verification_code = NULL,
                phone_verification_expires = NULL,
                phone_verified = 1,
                updated_at = NOW()
            WHERE id = ?
        `,
            [userId],
        );

        return { success: true, message: 'Phone number verified' };
    },

    // Send SMS code for authentication
    async sendSMSCode(userId) {
        const user = await query.get('SELECT phone_number, phone_verified FROM users WHERE id = ?', [userId]);

        if (!user?.phone_number || !user.phone_verified) {
            throw new Error('No verified phone number');
        }

        // Use cryptographically secure random for verification code
        const code = crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Hash code before storing
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        await query.run(
            `
            INSERT INTO sms_codes (id, user_id, code, expires_at, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `,
            [uuidv4(), userId, hashedCode, expiresAt.toISOString()],
        );

        // In production, send via Twilio/SNS — never log codes in production
        if (process.env.NODE_ENV !== 'production') {
            logger.info(`[EnhancedMFA] SMS code for user ${userId}: ${code}`);
        }

        return {
            message: 'Code sent',
            phoneLastFour: user.phone_number.slice(-4),
        };
    },

    // Verify SMS code
    async verifySMSCode(userId, code) {
        // Hash the input code to match stored hash
        const hashedInput = crypto.createHash('sha256').update(code).digest('hex');
        const smsCode = await query.get(
            `
            SELECT * FROM sms_codes
            WHERE user_id = ? AND code = ? AND used_at IS NULL
            ORDER BY created_at DESC LIMIT 1
        `,
            [userId, hashedInput],
        );

        if (!smsCode) {
            return { success: false, message: 'Invalid code' };
        }

        if (new Date(smsCode.expires_at) < new Date()) {
            return { success: false, message: 'Code expired' };
        }

        await query.run('UPDATE sms_codes SET used_at = NOW() WHERE id = ?', [smsCode.id]);

        return { success: true };
    },

    // ========================================
    // MFA Management
    // ========================================

    // Get MFA status for user
    async getMFAStatus(userId) {
        const user = await query.get(
            `
            SELECT mfa_enabled, mfa_method, phone_number, phone_verified
            FROM users WHERE id = ?
        `,
            [userId],
        );

        const securityKeys = await this.listSecurityKeys(userId);
        const backupStatus = await this.getBackupCodeStatus(userId);

        const hasTOTP = await query.get('SELECT 1 FROM totp_secrets WHERE user_id = ? AND verified = 1', [userId]);

        return {
            enabled: user?.mfa_enabled === 1,
            primaryMethod: user?.mfa_method,
            methods: {
                totp: !!hasTOTP,
                webauthn: securityKeys.length > 0,
                sms: user?.phone_verified === 1,
                backupCodes: backupStatus.remaining > 0,
            },
            securityKeys,
            backupCodes: backupStatus,
            phone: user?.phone_number
                ? {
                      verified: user.phone_verified === 1,
                      lastFour: user.phone_number.slice(-4),
                  }
                : null,
        };
    },

    // Disable MFA
    async disableMFA(userId, password) {
        // Verify password
        const user = await query.get('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (user?.password_hash) {
            const bcrypt = await import('bcryptjs');
            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                throw new Error('Invalid password');
            }
        }

        // Remove all MFA data
        await query.run('DELETE FROM webauthn_credentials WHERE user_id = ?', [userId]);
        await query.run('DELETE FROM backup_codes WHERE user_id = ?', [userId]);
        await query.run('DELETE FROM totp_secrets WHERE user_id = ?', [userId]);
        await query.run('DELETE FROM sms_codes WHERE user_id = ?', [userId]);

        await query.run(
            `
            UPDATE users SET
                mfa_enabled = FALSE,
                mfa_method = NULL,
                phone_number = NULL,
                phone_verified = 0,
                updated_at = NOW()
            WHERE id = ?
        `,
            [userId],
        );

        return { message: 'MFA disabled' };
    },
};

// Router
export async function enhancedMFARouter(ctx) {
    const { method, path, user, body } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/mfa/status - Get MFA status
    if (method === 'GET' && path === '/status') {
        const status = await enhancedMFA.getMFAStatus(user.id);
        return { status: 200, data: status };
    }

    // POST /api/mfa/disable - Disable MFA
    if (method === 'POST' && path === '/disable') {
        try {
            const result = await enhancedMFA.disableMFA(user.id, body.password);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // ========== WebAuthn ==========

    // POST /api/mfa/webauthn/register/start
    if (method === 'POST' && path === '/webauthn/register/start') {
        const options = await enhancedMFA.startRegistration(user.id);
        return { status: 200, data: options };
    }

    // POST /api/mfa/webauthn/register/complete
    if (method === 'POST' && path === '/webauthn/register/complete') {
        try {
            const result = await enhancedMFA.completeRegistration(user.id, body.credential, body.deviceName);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // POST /api/mfa/webauthn/authenticate/start
    if (method === 'POST' && path === '/webauthn/authenticate/start') {
        try {
            const options = await enhancedMFA.startAuthentication(user.id);
            return { status: 200, data: options };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // POST /api/mfa/webauthn/authenticate/complete
    if (method === 'POST' && path === '/webauthn/authenticate/complete') {
        try {
            const result = await enhancedMFA.completeAuthentication(user.id, body.assertion);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // GET /api/mfa/webauthn/keys
    if (method === 'GET' && path === '/webauthn/keys') {
        const keys = await enhancedMFA.listSecurityKeys(user.id);
        return { status: 200, data: { keys } };
    }

    // DELETE /api/mfa/webauthn/keys/:id
    if (method === 'DELETE' && path.startsWith('/webauthn/keys/')) {
        const keyId = path.split('/').pop();
        try {
            const result = await enhancedMFA.removeSecurityKey(user.id, keyId);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // ========== Backup Codes ==========

    // POST /api/mfa/backup-codes/generate
    if (method === 'POST' && path === '/backup-codes/generate') {
        const result = await enhancedMFA.generateBackupCodes(user.id);
        return { status: 200, data: result };
    }

    // POST /api/mfa/backup-codes/verify
    if (method === 'POST' && path === '/backup-codes/verify') {
        const result = await enhancedMFA.verifyBackupCode(user.id, body.code);
        return { status: result.success ? 200 : 400, data: result };
    }

    // GET /api/mfa/backup-codes/status
    if (method === 'GET' && path === '/backup-codes/status') {
        const status = await enhancedMFA.getBackupCodeStatus(user.id);
        return { status: 200, data: status };
    }

    // ========== SMS ==========

    // POST /api/mfa/sms/register
    if (method === 'POST' && path === '/sms/register') {
        try {
            const result = await enhancedMFA.registerPhone(user.id, body.phoneNumber);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // POST /api/mfa/sms/verify-phone
    if (method === 'POST' && path === '/sms/verify-phone') {
        try {
            const result = await enhancedMFA.verifyPhone(user.id, body.code);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // POST /api/mfa/sms/send
    if (method === 'POST' && path === '/sms/send') {
        try {
            const result = await enhancedMFA.sendSMSCode(user.id);
            return { status: 200, data: result };
        } catch (error) {
            return { status: 400, data: { error: error.message } };
        }
    }

    // POST /api/mfa/sms/verify
    if (method === 'POST' && path === '/sms/verify') {
        const result = await enhancedMFA.verifySMSCode(user.id, body.code);
        return { status: result.success ? 200 : 400, data: result };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Tables created by pg-schema.sql (managed by migration system)
export const migration = '';

export { enhancedMFA };
export default enhancedMFA;
