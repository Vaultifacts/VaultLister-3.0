// Google OAuth 2.0 Service
// Shared by Google Drive and Google Calendar integrations
// All tokens are encrypted with AES-256-CBC before storage

import { encryptToken, decryptToken, generateStateToken } from '../utils/encryption.js';
import { query } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

const SCOPES = {
    drive: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email'
    ],
    calendar: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email'
    ],
    drive_and_calendar: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email'
    ]
};

/**
 * Check whether Google OAuth credentials are present in env
 */
export function isGoogleConfigured() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Build a Google authorization URL and persist the state token
 * @param {string} userId
 * @param {string} scope - 'drive' | 'calendar' | 'drive_and_calendar'
 * @param {string} baseUrl
 * @returns {{ authorizationUrl: string, state: string }}
 */
export function buildGoogleAuthUrl(userId, scope, baseUrl) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${baseUrl}/api/integrations/google/callback`;
    const scopes = SCOPES[scope] || SCOPES.drive;

    const stateToken = generateStateToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    query.run(
        `INSERT INTO google_oauth_states (id, user_id, scope, state_token, redirect_uri, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), userId, scope, stateToken, redirectUri, expiresAt]
    );

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('state', stateToken);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');

    return { authorizationUrl: url.toString(), state: stateToken };
}

/**
 * Exchange an authorization code for tokens, persist them, return the email
 * @param {string} code
 * @param {string} state
 * @returns {{ email: string, userId: string, scope: string }}
 */
export async function exchangeGoogleCode(code, state) {
    const stateRecord = query.get(
        `SELECT * FROM google_oauth_states WHERE state_token = ? AND expires_at > datetime('now')`,
        [state]
    );
    if (!stateRecord) {
        const err = new Error('Invalid or expired state token');
        err.status = 400;
        throw err;
    }

    query.run('DELETE FROM google_oauth_states WHERE id = ?', [stateRecord.id]);

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code,
            redirect_uri: stateRecord.redirect_uri,
            grant_type: 'authorization_code'
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!tokenResponse.ok) {
        const text = await tokenResponse.text();
        throw new Error(`Google token exchange failed: ${text}`);
    }

    const tokens = await tokenResponse.json();

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(10000)
    });
    if (!userResponse.ok) throw new Error('Failed to fetch Google user info');
    const userInfo = await userResponse.json();

    const encryptedAccess = encryptToken(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const now = new Date().toISOString();

    const existing = query.get(
        `SELECT id, oauth_refresh_token FROM google_tokens WHERE user_id = ? AND scope = ?`,
        [stateRecord.user_id, stateRecord.scope]
    );

    if (existing) {
        query.run(
            `UPDATE google_tokens SET
                oauth_token = ?,
                oauth_refresh_token = COALESCE(?, oauth_refresh_token),
                oauth_token_expires_at = ?,
                email = ?,
                is_connected = 1,
                updated_at = ?
             WHERE id = ?`,
            [encryptedAccess, encryptedRefresh, expiresAt, userInfo.email, now, existing.id]
        );
    } else {
        query.run(
            `INSERT INTO google_tokens
                (id, user_id, scope, oauth_token, oauth_refresh_token, oauth_token_expires_at, email, is_connected, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [uuidv4(), stateRecord.user_id, stateRecord.scope, encryptedAccess, encryptedRefresh, expiresAt, userInfo.email, now, now]
        );
    }

    logger.info('[GoogleOAuth] Token stored', stateRecord.user_id, { scope: stateRecord.scope, email: userInfo.email });
    return { email: userInfo.email, userId: stateRecord.user_id, scope: stateRecord.scope };
}

/**
 * Get a live (refreshed if necessary) access token for a user + scope
 * Returns null if no connection exists
 */
export async function getAccessToken(userId, scope) {
    const record = query.get(
        `SELECT * FROM google_tokens WHERE user_id = ? AND scope = ? AND is_connected = 1`,
        [userId, scope]
    );
    if (!record) return null;

    const expiresAt = new Date(record.oauth_token_expires_at);
    const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry
    if (expiresAt.getTime() - Date.now() > bufferMs) {
        return decryptToken(record.oauth_token);
    }

    if (!record.oauth_refresh_token) return null;

    try {
        const refreshed = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: decryptToken(record.oauth_refresh_token),
                grant_type: 'refresh_token'
            }),
            signal: AbortSignal.timeout(30000)
        });

        if (!refreshed.ok) throw new Error(`Refresh failed: ${refreshed.status}`);
        const tokens = await refreshed.json();

        const newEncrypted = encryptToken(tokens.access_token);
        const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
        query.run(
            `UPDATE google_tokens SET oauth_token = ?, oauth_token_expires_at = ?, updated_at = ? WHERE id = ?`,
            [newEncrypted, newExpiry, new Date().toISOString(), record.id]
        );
        return tokens.access_token;
    } catch (err) {
        logger.error('[GoogleOAuth] Token refresh failed', userId, { detail: err.message, scope });
        return null;
    }
}

/**
 * Revoke Google tokens and mark disconnected
 */
export async function revokeGoogleToken(userId, scope) {
    const record = query.get(
        `SELECT * FROM google_tokens WHERE user_id = ? AND scope = ?`,
        [userId, scope]
    );
    if (!record) return;

    try {
        if (record.oauth_token) {
            const token = decryptToken(record.oauth_token);
            await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                signal: AbortSignal.timeout(10000)
            });
        }
    } catch (err) {
        logger.warn('[GoogleOAuth] Revoke request failed (best-effort)', userId, { detail: err.message });
    }

    query.run(
        `UPDATE google_tokens SET is_connected = 0, oauth_token = NULL, oauth_refresh_token = NULL, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), record.id]
    );
}

/**
 * Get connection status for a user + scope (no tokens exposed)
 */
export function getConnectionStatus(userId, scope) {
    const record = query.get(
        `SELECT id, email, is_connected, oauth_token_expires_at, created_at, updated_at
         FROM google_tokens WHERE user_id = ? AND scope = ?`,
        [userId, scope]
    );
    if (!record || !record.is_connected) {
        return { connected: false };
    }
    return {
        connected: true,
        email: record.email,
        tokenExpiresAt: record.oauth_token_expires_at,
        connectedAt: record.created_at,
        updatedAt: record.updated_at
    };
}
