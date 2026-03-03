// Token encryption utilities for OAuth tokens
// Uses AES-256-CBC encryption for secure token storage

import crypto from 'crypto';
import { logger } from '../shared/logger.js';

const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
    logger.error('[Encryption] FATAL: OAUTH_ENCRYPTION_KEY is required in production');
    process.exit(1);
}

const EFFECTIVE_KEY = ENCRYPTION_KEY || 'dev-only-key-not-for-production!!';

const ALGORITHM = 'aes-256-cbc';

// Validate encryption key length
if (EFFECTIVE_KEY.length < 32) {
    if (process.env.NODE_ENV === 'production') {
        logger.error('[Encryption] FATAL: OAUTH_ENCRYPTION_KEY must be at least 32 characters');
        process.exit(1);
    } else {
        logger.warn('[Encryption] OAUTH_ENCRYPTION_KEY should be at least 32 characters for maximum security');
    }
}

/**
 * Encrypt a token using AES-256-CBC
 * @param {string} token - The token to encrypt
 * @returns {string} Encrypted token in format: "iv:encryptedText"
 */
export function encryptToken(token) {
    if (!token) return null;

    try {
        // Generate random initialization vector
        const iv = crypto.randomBytes(16);

        // Create cipher with key (first 32 bytes) and IV
        const cipher = crypto.createCipheriv(
            ALGORITHM,
            Buffer.from(EFFECTIVE_KEY.slice(0, 32)),
            iv
        );

        // Encrypt the token
        let encrypted = cipher.update(token, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Return IV:encrypted format for later decryption
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        logger.error('[Encryption] Token encryption error', error);
        throw new Error('Failed to encrypt token');
    }
}

/**
 * Decrypt a token that was encrypted with encryptToken
 * @param {string} encrypted - The encrypted token in format: "iv:encryptedText"
 * @returns {string} Decrypted token
 */
export function decryptToken(encrypted) {
    if (!encrypted) return null;

    try {
        // Split IV and encrypted text
        const parts = encrypted.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted token format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        // Create decipher with key and IV
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            Buffer.from(EFFECTIVE_KEY.slice(0, 32)),
            iv
        );

        // Decrypt the token
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        logger.error('[Encryption] Token decryption error', error);
        throw new Error('Failed to decrypt token');
    }
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
