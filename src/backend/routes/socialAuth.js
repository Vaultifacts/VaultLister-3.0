// Social Authentication Routes
// Google and Apple OAuth sign-in

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/database.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { logger } from '../shared/logger.js';

function safeJsonParse(str, fallback = null) {
    try { return JSON.parse(str); } catch { return fallback; }
}

// Apple JWKS cache for signature verification
let appleJwksCache = null;
let appleJwksCacheTime = 0;
const JWKS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getApplePublicKey(kid) {
    if (!appleJwksCache || Date.now() - appleJwksCacheTime > JWKS_CACHE_TTL) {
        const res = await fetch('https://appleid.apple.com/auth/keys', { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error('Failed to fetch Apple JWKS');
        appleJwksCache = await res.json();
        appleJwksCacheTime = Date.now();
    }
    const key = appleJwksCache.keys.find(k => k.kid === kid);
    if (!key) throw new Error('Apple signing key not found');
    return crypto.createPublicKey({ key, format: 'jwk' });
}

const USER_SELECT_COLUMNS = 'id, email, username, full_name, display_name, avatar_url, subscription_tier, is_active, email_verified, created_at, updated_at, last_login_at';

// OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/social-auth/google/callback';

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/api/social-auth/apple/callback';

// State tokens for CSRF protection
const stateTokens = new Map();

// Generate state token
const MAX_STATE_TOKENS = 10000;

function generateStateToken() {
    const state = crypto.randomBytes(32).toString('hex');

    // Clean up old tokens (older than 10 minutes)
    for (const [key, value] of stateTokens.entries()) {
        if (Date.now() - value.created > 600000) {
            stateTokens.delete(key);
        }
    }

    // Enforce max size to prevent memory exhaustion
    if (stateTokens.size >= MAX_STATE_TOKENS) {
        const oldest = stateTokens.keys().next().value;
        stateTokens.delete(oldest);
    }

    stateTokens.set(state, { created: Date.now() });

    return state;
}

// Verify state token
function verifyStateToken(state) {
    if (!stateTokens.has(state)) {
        return false;
    }
    const tokenData = stateTokens.get(state);
    stateTokens.delete(state);
    return Date.now() - tokenData.created < 600000;
}

// Find or create user from OAuth profile
async function findOrCreateUser(provider, profile) {
    const { id: providerId, email, name, picture } = profile;

    // Check if user exists with this OAuth provider
    let user = query.get(`
        SELECT ${USER_SELECT_COLUMNS} FROM users u
        JOIN oauth_accounts oa ON u.id = oa.user_id
        WHERE oa.provider = ? AND oa.provider_user_id = ?
    `, [provider, providerId]);

    if (user) {
        // Update last login
        query.run('UPDATE users SET last_login_at = datetime("now") WHERE id = ?', [user.id]);
        return user;
    }

    // Check if user exists with this email
    user = query.get(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE email = ?`, [email?.toLowerCase()]);

    if (user) {
        // Link OAuth account to existing user
        query.run(`
            INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [uuidv4(), user.id, provider, providerId, email]);

        query.run('UPDATE users SET last_login_at = datetime("now") WHERE id = ?', [user.id]);
        return user;
    }

    // Create new user
    const userId = uuidv4();
    const username = email ? email.split('@')[0] + '_' + crypto.randomUUID().split('-')[0] : 'user_' + uuidv4().substring(0, 8);

    query.run(`
        INSERT INTO users (id, email, username, full_name, avatar_url, email_verified, email_verified_at, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'), datetime('now'))
    `, [userId, email?.toLowerCase(), username, name, picture]);

    // Link OAuth account
    query.run(`
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [uuidv4(), userId, provider, providerId, email]);

    return query.get(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`, [userId]);
}

export async function socialAuthRouter(ctx) {
    const { method, path, query: queryParams } = ctx;

    // ========================================
    // Google OAuth
    // ========================================

    // GET /api/social-auth/google - Start Google OAuth flow
    if (method === 'GET' && path === '/google') {
        if (!GOOGLE_CLIENT_ID) {
            return { status: 503, data: { error: 'Google OAuth not configured' } };
        }

        const state = generateStateToken();
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: GOOGLE_REDIRECT_URI,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent'
        });

        return {
            status: 302,
            headers: {
                'Location': `https://accounts.google.com/o/oauth2/v2/auth?${params}`
            },
            data: {}
        };
    }

    // GET /api/social-auth/google/callback - Google OAuth callback
    if (method === 'GET' && path === '/google/callback') {
        const { code, state, error } = queryParams;

        if (error) {
            return {
                status: 302,
                headers: { 'Location': '/#login?error=oauth_denied' },
                data: {}
            };
        }

        if (!verifyStateToken(state)) {
            return {
                status: 302,
                headers: { 'Location': '/#login?error=invalid_state' },
                data: {}
            };
        }

        try {
            // Exchange code for tokens
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                signal: AbortSignal.timeout(15000),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: GOOGLE_CLIENT_ID,
                    client_secret: GOOGLE_CLIENT_SECRET,
                    redirect_uri: GOOGLE_REDIRECT_URI,
                    grant_type: 'authorization_code'
                })
            });

            const tokens = await tokenResponse.json();

            if (!tokens.access_token) {
                throw new Error('Failed to get access token');
            }

            // Get user info
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                signal: AbortSignal.timeout(10000),
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });

            const profile = await userResponse.json();

            // Reject if no email from Google profile
            if (!profile.email) {
                try {
                    query.run(
                        `INSERT INTO security_logs (id, event_type, ip_or_user, details, created_at)
                         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [uuidv4(), 'oauth_missing_email', 'google_callback', JSON.stringify({ profileId: profile.id })]
                    );
                } catch (_) { /* best-effort logging */ }
                return {
                    status: 302,
                    headers: { 'Location': '/#login?error=email_required' },
                    data: {}
                };
            }

            // Find or create user
            const user = await findOrCreateUser('google', {
                id: profile.id,
                email: profile.email,
                name: profile.name,
                picture: profile.picture
            });

            // Generate tokens
            delete user.password_hash;
            const token = generateToken(user);
            const refreshToken = generateRefreshToken(user);

            // Store session
            query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, expires_at)
                VALUES (?, ?, ?, datetime('now', '+30 days'))
            `, [uuidv4(), user.id, refreshToken]);

            // Redirect with token in secure HttpOnly cookie (not URL)
            return {
                status: 302,
                headers: {
                    'Location': '/#/auth/callback',
                    'Set-Cookie': [
                        `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${24 * 60 * 60}; Path=/`,
                        `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`
                    ]
                },
                data: {}
            };
        } catch (error) {
            logger.error('[SocialAuth] Google OAuth error', null, { detail: error?.message || 'Unknown error' });
            return {
                status: 302,
                headers: { 'Location': '/#login?error=oauth_failed' },
                data: {}
            };
        }
    }

    // ========================================
    // Apple OAuth
    // ========================================

    // GET /api/social-auth/apple - Start Apple OAuth flow
    if (method === 'GET' && path === '/apple') {
        if (!APPLE_CLIENT_ID) {
            return { status: 503, data: { error: 'Apple OAuth not configured' } };
        }

        const state = generateStateToken();
        const params = new URLSearchParams({
            client_id: APPLE_CLIENT_ID,
            redirect_uri: APPLE_REDIRECT_URI,
            response_type: 'code id_token',
            scope: 'name email',
            state,
            response_mode: 'form_post'
        });

        return {
            status: 302,
            headers: {
                'Location': `https://appleid.apple.com/auth/authorize?${params}`
            },
            data: {}
        };
    }

    // POST /api/social-auth/apple/callback - Apple OAuth callback
    if (method === 'POST' && path === '/apple/callback') {
        const { code, state, id_token, user: userJson, error } = ctx.body;

        if (error) {
            return {
                status: 302,
                headers: { 'Location': '/#login?error=oauth_denied' },
                data: {}
            };
        }

        if (!verifyStateToken(state)) {
            return {
                status: 302,
                headers: { 'Location': '/#login?error=invalid_state' },
                data: {}
            };
        }

        try {
            // Verify the id_token (JWT) signature using Apple's public keys
            if (!id_token || typeof id_token !== 'string') {
                return { status: 302, headers: { 'Location': '/#login?error=missing_token' }, data: {} };
            }
            const tokenParts = id_token.split('.');
            if (tokenParts.length !== 3 || !tokenParts[0]) {
                return { status: 302, headers: { 'Location': '/#login?error=invalid_token' }, data: {} };
            }

            // Decode header to get kid, then verify signature with Apple's public key
            const header = safeJsonParse(Buffer.from(tokenParts[0], 'base64url').toString(), {});
            const publicKey = await getApplePublicKey(header.kid);
            const payload = jwt.verify(id_token, publicKey, {
                algorithms: ['RS256'],
                issuer: 'https://appleid.apple.com',
                audience: APPLE_CLIENT_ID
            });

            // Parse user info if provided (only on first authorization)
            let userInfo = {};
            if (userJson) {
                try {
                    userInfo = JSON.parse(userJson);
                } catch (e) {
                    logger.error('[SocialAuth] Failed to parse Apple user info', null, { detail: e?.message || 'Unknown error' });
                    try {
                        query.run(
                            `INSERT INTO security_logs (id, event_type, ip_or_user, details, created_at)
                             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                            [uuidv4(), 'oauth_parse_error', 'apple_callback', JSON.stringify({ error: e.message })]
                        );
                    } catch (_) { /* best-effort logging */ }
                    userInfo = {};
                }
            }

            // Reject if no email in token payload
            if (!payload.email) {
                try {
                    query.run(
                        `INSERT INTO security_logs (id, event_type, ip_or_user, details, created_at)
                         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [uuidv4(), 'oauth_missing_email', 'apple_callback', JSON.stringify({ sub: payload.sub })]
                    );
                } catch (_) { /* best-effort logging */ }
                return {
                    status: 302,
                    headers: { 'Location': '/#login?error=email_required' },
                    data: {}
                };
            }

            // Find or create user
            const user = await findOrCreateUser('apple', {
                id: payload.sub,
                email: payload.email,
                name: userInfo.name ? `${userInfo.name.firstName || ''} ${userInfo.name.lastName || ''}`.trim() : null,
                picture: null
            });

            // Generate tokens
            delete user.password_hash;
            const token = generateToken(user);
            const refreshToken = generateRefreshToken(user);

            // Store session
            query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, expires_at)
                VALUES (?, ?, ?, datetime('now', '+30 days'))
            `, [uuidv4(), user.id, refreshToken]);

            // Redirect with token in secure HttpOnly cookie (not URL)
            return {
                status: 302,
                headers: {
                    'Location': '/#/auth/callback',
                    'Set-Cookie': [
                        `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${24 * 60 * 60}; Path=/`,
                        `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}; Path=/`
                    ]
                },
                data: {}
            };
        } catch (error) {
            logger.error('[SocialAuth] Apple OAuth error', null, { detail: error?.message || 'Unknown error' });
            return {
                status: 302,
                headers: { 'Location': '/#login?error=oauth_failed' },
                data: {}
            };
        }
    }

    // GET /api/social-auth/providers - List available providers
    if (method === 'GET' && (path === '/providers' || path === '/')) {
        return {
            status: 200,
            data: {
                providers: [
                    { id: 'google', name: 'Google', enabled: !!GOOGLE_CLIENT_ID },
                    { id: 'apple', name: 'Apple', enabled: !!APPLE_CLIENT_ID }
                ]
            }
        };
    }

    // DELETE /api/social-auth/:provider - Unlink provider
    if (method === 'DELETE' && path.match(/^\/[a-zA-Z0-9_-]+$/) && ctx.user) {
        const provider = path.substring(1);

        // Check if user has password or other OAuth accounts
        const user = query.get('SELECT password_hash FROM users WHERE id = ?', [ctx.user.id]);
        const oauthCount = query.get('SELECT COUNT(*) as count FROM oauth_accounts WHERE user_id = ?', [ctx.user.id]);

        if (!user.password_hash && oauthCount.count <= 1) {
            return { status: 400, data: { error: 'Cannot unlink last authentication method. Set a password first.' } };
        }

        query.run('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?', [ctx.user.id, provider]);

        return { status: 200, data: { message: `${provider} account unlinked` } };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Database migration
export const migration = `
-- OAuth accounts table
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_user_id);
`;
