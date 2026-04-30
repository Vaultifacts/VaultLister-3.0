// Token encryption utilities for OAuth tokens
// Uses AES-256-GCM encryption for secure token storage

import crypto from 'crypto';
import { logger } from '../shared/logger.js';

const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY;
const ENCRYPTION_KEY_OLD = process.env.OAUTH_ENCRYPTION_KEY_OLD || null; // For key rotation

if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    logger.error('[Encryption] FATAL: OAUTH_ENCRYPTION_KEY is required in production');
    process.exit(1);
}

const EFFECTIVE_KEY = ENCRYPTION_KEY || 'dev-only-key-not-for-production!!';

const ALGORITHM_GCM = 'aes-256-gcm';
const ALGORITHM_CBC = 'aes-256-cbc'; // Legacy — decrypt only

// Validate encryption key length
if (EFFECTIVE_KEY.length < 32) {
    if (process.env.NODE_ENV === 'production') {
        logger.error('[Encryption] FATAL: OAUTH_ENCRYPTION_KEY must be at least 32 characters');
        process.exit(1);
    } else {
        logger.warn('[Encryption] OAUTH_ENCRYPTION_KEY should be at least 32 characters for maximum security');
    }
}

function decodeKey(key) {
    if (!key) return null;
    // If it looks like a hex string (even length, all hex chars), decode from hex
    if (/^[0-9a-fA-F]+$/.test(key) && key.length >= 64) {
        return Buffer.from(key, 'hex').subarray(0, 32);
    }
    // Otherwise treat as raw bytes
    return Buffer.from(key).subarray(0, 32);
}
const KEY_BUFFER = decodeKey(EFFECTIVE_KEY);
const OLD_KEY_BUFFER = ENCRYPTION_KEY_OLD ? decodeKey(ENCRYPTION_KEY_OLD) : null;

if (OLD_KEY_BUFFER) {
    logger.info('[Encryption] OAUTH_ENCRYPTION_KEY_OLD is set — dual-key decryption enabled for rotation window');
}

/**
 * Encrypt a token using AES-256-GCM (authenticated encryption)
 * @param {string} token - The token to encrypt
 * @returns {string} Encrypted token in format: "gcm:iv:authTag:ciphertext"
 */
export function encryptToken(token) {
    if (!token) return null;

    try {
        const iv = crypto.randomBytes(12); // 96-bit IV for GCM
        const cipher = crypto.createCipheriv(ALGORITHM_GCM, KEY_BUFFER, iv, { authTagLength: 16 });

        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        // Prefix with "gcm:" to distinguish from legacy CBC tokens
        return 'gcm:' + iv.toString('hex') + ':' + authTag + ':' + encrypted;
    } catch (error) {
        logger.error('[Encryption] Token encryption error', error);
        throw new Error('Failed to encrypt token');
    }
}

/**
 * Decrypt a token — supports both GCM (new) and CBC (legacy) formats
 * @param {string} encrypted - The encrypted token
 * @returns {string} Decrypted token
 */
export function decryptToken(encrypted) {
    if (!encrypted) return null;

    try {
        return _decryptWithKey(encrypted, KEY_BUFFER);
    } catch (error) {
        // During key rotation: try the old key before failing
        if (OLD_KEY_BUFFER) {
            try {
                return _decryptWithKey(encrypted, OLD_KEY_BUFFER);
            } catch {
                // Both keys failed
            }
        }
        logger.error('[Encryption] Token decryption error', error);
        throw new Error('Failed to decrypt token');
    }
}

function _decryptWithKey(encrypted, keyBuffer) {
    // New GCM format: "gcm:iv:authTag:ciphertext"
    if (encrypted.startsWith('gcm:')) {
        const parts = encrypted.slice(4).split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid GCM encrypted token format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const ciphertext = parts[2];

        const decipher = crypto.createDecipheriv(ALGORITHM_GCM, keyBuffer, iv, { authTagLength: 16 }); // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    // Legacy CBC format: "iv:ciphertext"
    const parts = encrypted.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM_CBC, keyBuffer, iv); // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length  // nosemgrep: javascript.crypto.weak-symmetric-mode.weak-symmetric-mode -- legacy CBC decrypt-only; all new tokens use AES-GCM

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Generate a secure random state token for OAuth CSRF protection
 * @returns {string} 64-character hex string
 */
export function generateStateToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for comparison (one-way)
 * Useful for storing refresh tokens in a more secure manner
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hash of the token
 */
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
