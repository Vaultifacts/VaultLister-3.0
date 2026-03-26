// MFA (Multi-Factor Authentication) Service
// Handles TOTP generation, verification, and backup codes

import { OTP, generateSecret as otpGenerateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger.js';

const APP_NAME = 'VaultLister';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

// Create OTP instance with TOTP strategy and tolerance for clock drift
const otp = new OTP({ strategy: 'totp' });

/**
 * Generate a new MFA secret for a user
 */
export function generateSecret(email) {
    const secret = otp.generateSecret();
    const otpauth = generateURI({
        issuer: APP_NAME,
        label: email,
        secret: secret,
        algorithm: 'sha1',
        digits: 6,
        period: 30
    });

    return {
        secret,
        otpauth
    };
}

/**
 * Generate QR code data URL from OTP auth URI
 */
export async function generateQRCode(otpauthUrl) {
    try {
        return await QRCode.toDataURL(otpauthUrl, {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });
    } catch (error) {
        logger.error('[MFA] QR code generation failed', null, { detail: error.message });
        throw new Error('Failed to generate QR code');
    }
}

/**
 * Verify a TOTP token
 */
export function verifyToken(token, secret) {
    try {
        const result = verifySync({
            token,
            secret,
            algorithm: 'sha1',
            digits: 6,
            period: 30,
            epochTolerance: 1 // Allow 1 step before/after for clock drift
        });
        return result !== null;
    } catch (error) {
        logger.error('[MFA] Token verification error', null, { detail: error.message });
        return false;
    }
}

/**
 * Generate backup codes
 */
export function generateBackupCodes() {
    const codes = [];
    const hashedCodes = [];

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        // Generate random code
        const code = crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString('hex').toUpperCase();
        const formattedCode = `${code.slice(0, 4)}-${code.slice(4)}`;

        codes.push(formattedCode);
        // Hash the code for storage
        hashedCodes.push(bcrypt.hashSync(formattedCode, 12));
    }

    return {
        codes,        // Plain text codes to show user once
        hashedCodes   // Hashed codes for storage
    };
}

/**
 * Verify a backup code
 */
export async function verifyBackupCode(code, hashedCodes) {
    const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`;

    for (let i = 0; i < hashedCodes.length; i++) {
        if (hashedCodes[i] && await bcrypt.compare(formattedCode, hashedCodes[i])) {
            // Invalidate used code by setting to null
            hashedCodes[i] = null;
            return { valid: true, updatedCodes: hashedCodes, index: i };
        }
    }

    return { valid: false };
}

/**
 * Setup MFA for a user
 */
export async function setupMFA(userId, email) {
    const { secret, otpauth } = generateSecret(email);
    const qrCode = await generateQRCode(otpauth);

    // Store setup token for verification
    const setupToken = crypto.randomBytes(32).toString('hex');

    await query.run(`
        INSERT INTO verification_tokens (id, user_id, token, type, expires_at)
        VALUES (?, ?, ?, 'mfa_setup', NOW() + INTERVAL '10 minutes')
    `, [uuidv4(), userId, setupToken]);

    // Store secret temporarily on user record (not yet activated — mfa_enabled stays 0)
    await query.run('UPDATE users SET mfa_secret = ? WHERE id = ?', [secret, userId]);

    return {
        setupToken,
        secret,
        qrCode,
        manualEntry: secret // For manual entry if QR doesn't work
    };
}

/**
 * Verify and enable MFA for a user
 */
export async function enableMFA(userId, setupToken, totpCode) {
    // Get setup token
    const tokenRecord = await query.get(`
        SELECT * FROM verification_tokens
        WHERE user_id = ? AND token = ? AND type = 'mfa_setup'
        AND expires_at > NOW() AND used_at IS NULL
    `, [userId, setupToken]);

    if (!tokenRecord) {
        return { success: false, error: 'Invalid or expired setup token' };
    }

    // Get user's temporary secret (stored in a temp field or cache)
    const user = await query.get('SELECT mfa_secret FROM users WHERE id = ?', [userId]);

    // For now, we need to get the secret from the request since we don't store it yet
    // In production, you might store it temporarily in Redis

    // Mark token as used
    await query.run('UPDATE verification_tokens SET used_at = datetime(\'now\') WHERE id = ?', [tokenRecord.id]);

    // Generate backup codes
    const { codes, hashedCodes } = generateBackupCodes();

    return {
        success: true,
        backupCodes: codes,
        hashedCodes
    };
}

/**
 * Complete MFA setup with secret verification
 */
export function completeSetup(userId, secret, totpCode, ip, userAgent) {
    // Verify the TOTP code
    if (!verifyToken(totpCode, secret)) {
        return { success: false, error: 'Invalid verification code' };
    }

    // Generate backup codes
    const { codes, hashedCodes } = generateBackupCodes();

    // Store MFA settings
    await query.run(`
        UPDATE users
        SET mfa_enabled = 1,
            mfa_secret = ?,
            mfa_backup_codes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [secret, JSON.stringify(hashedCodes), userId]);

    // Log MFA event
    await query.run(`
        INSERT INTO mfa_events (user_id, event_type, ip_address, user_agent)
        VALUES (?, 'enabled', ?, ?)
    `, [userId, ip, userAgent]);

    return {
        success: true,
        backupCodes: codes // Return plain codes to show user once
    };
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId, password, userPasswordHash, ip, userAgent) {
    // Verify password before disabling
    if (!await bcrypt.compare(password, userPasswordHash)) {
        return { success: false, error: 'Invalid password' };
    }

    // Clear MFA settings
    await query.run(`
        UPDATE users
        SET mfa_enabled = 0,
            mfa_secret = NULL,
            mfa_backup_codes = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [userId]);

    // Log MFA event
    await query.run(`
        INSERT INTO mfa_events (user_id, event_type, ip_address, user_agent)
        VALUES (?, 'disabled', ?, ?)
    `, [userId, ip, userAgent]);

    return { success: true };
}

/**
 * Verify MFA during login
 */
export async function verifyMFA(userId, code, secret, backupCodesJson, ip, userAgent) {
    // Try TOTP first
    if (verifyToken(code, secret)) {
        // Log successful verification
        await query.run(`
            INSERT INTO mfa_events (user_id, event_type, ip_address, user_agent)
            VALUES (?, 'verified', ?, ?)
        `, [userId, ip, userAgent]);

        return { success: true, method: 'totp' };
    }

    // Try backup code
    const hashedCodes = JSON.parse(backupCodesJson || '[]');
    const backupResult = await verifyBackupCode(code, hashedCodes);

    if (backupResult.valid) {
        // Update backup codes (mark used code as null)
        await query.run(`
            UPDATE users SET mfa_backup_codes = ? WHERE id = ?
        `, [JSON.stringify(backupResult.updatedCodes), userId]);

        // Log backup code usage
        await query.run(`
            INSERT INTO mfa_events (user_id, event_type, ip_address, user_agent)
            VALUES (?, 'backup_used', ?, ?)
        `, [userId, ip, userAgent]);

        // Count remaining backup codes
        const remaining = backupResult.updatedCodes.filter(c => c !== null).length;

        return {
            success: true,
            method: 'backup',
            backupCodesRemaining: remaining,
            warning: remaining <= 2 ? 'You have few backup codes remaining. Consider generating new ones.' : null
        };
    }

    // Log failed attempt
    await query.run(`
        INSERT INTO mfa_events (user_id, event_type, ip_address, user_agent)
        VALUES (?, 'failed', ?, ?)
    `, [userId, ip, userAgent]);

    return { success: false, error: 'Invalid verification code' };
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId, password, userPasswordHash, ip, userAgent) {
    // Verify password
    if (!await bcrypt.compare(password, userPasswordHash)) {
        return { success: false, error: 'Invalid password' };
    }

    const { codes, hashedCodes } = generateBackupCodes();

    // Update backup codes
    await query.run(`
        UPDATE users SET mfa_backup_codes = ? WHERE id = ?
    `, [JSON.stringify(hashedCodes), userId]);

    return {
        success: true,
        backupCodes: codes
    };
}

export default {
    generateSecret,
    generateQRCode,
    verifyToken,
    generateBackupCodes,
    verifyBackupCode,
    setupMFA,
    completeSetup,
    disableMFA,
    verifyMFA,
    regenerateBackupCodes
};
