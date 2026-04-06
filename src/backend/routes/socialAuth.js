// Social Authentication Routes
// Google and Apple OAuth sign-in

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/database.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { logger } from '../shared/logger.js';
import redis from '../services/redis.js';
import { safeJsonParse } from '../shared/utils.js';


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

const USER_SELECT_COLUMNS = 'id, email, username, full_name, avatar_url, subscription_tier, is_active, email_verified, created_at, updated_at, last_login_at';
const USER_SELECT_ALIASED = 'u.id, u.email, u.username, u.full_name, u.avatar_url, u.subscription_tier, u.is_active, u.email_verified, u.created_at, u.updated_at, u.last_login_at';

// OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || (process.env.NODE_ENV === 'production' ? 'https://vaultlister.com/api/social-auth/google/callback' : 'http://localhost:3000/api/social-auth/google/callback');

const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
const APPLE_REDIRECT_URI = process.env.APPLE_REDIRECT_URI || 'http://localhost:3000/api/social-auth/apple/callback';

// Cookie security flags — matches auth.js pattern
const SECURE_FLAG = process.env.NODE_ENV === 'production' ? '; Secure' : '';
const COOKIE_BASE = `HttpOnly; SameSite=Strict${SECURE_FLAG}`;

async function generateStateToken() {
    const state = crypto.randomBytes(32).toString('hex');
    await redis.setJson('oauth:state:' + state, { created: Date.now() }, 600);
    return state;
}

async function verifyStateToken(state) {
    const tokenData = await redis.getJson('oauth:state:' + state);
    if (!tokenData) return false;
    await redis.del('oauth:state:' + state);
    return Date.now() - tokenData.created < 600000;
}

// Find or create user from OAuth profile
async function findOrCreateUser(provider, profile) {
    const { id: providerId, email, name, picture } = profile;

    // Check if user exists with this OAuth provider
    let user = await query.get(`
        SELECT ${USER_SELECT_ALIASED} FROM users u
        JOIN oauth_accounts oa ON u.id = oa.user_id
        WHERE oa.provider = ? AND oa.provider_user_id = ?
    `, [provider, providerId]);

    if (user) {
        // Update last login
        await query.run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        return user;
    }

    // Check if user exists with this email
    user = email ? await query.get(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE email = ?`, [email.toLowerCase()]) : null;

    if (user) {
        // Link OAuth account to existing user
        await query.run(`
            INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [uuidv4(), user.id, provider, providerId, email ?? null]);

        await query.run('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
        return user;
    }

    // Create new user
    const userId = uuidv4();
    const username = email ? email.split('@')[0] + '_' + crypto.randomUUID().split('-')[0] : 'user_' + uuidv4().substring(0, 8);

    await query.run(`
        INSERT INTO users (id, email, username, full_name, avatar_url, email_verified, email_verified_at, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW(), NOW(), NOW())
    `, [userId, email?.toLowerCase() ?? null, username, name ?? null, picture ?? null]);

    // Link OAuth account
    await query.run(`
        INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    `, [uuidv4(), userId, provider, providerId, email ?? null]);

    return await query.get(`SELECT ${USER_SELECT_COLUMNS} FROM users WHERE id = ?`, [userId]);
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

        const state = await generateStateToken();
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
                headers: { 'Location': '/?app=1#login?error=oauth_denied' },
                data: {}
            };
        }

        if (!(await verifyStateToken(state))) {
            return {
                status: 302,
                headers: { 'Location': '/?app=1#login?error=invalid_state' },
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
                throw new Error(`Google token exchange failed: ${tokens.error || 'no access_token'} — ${tokens.error_description || '(no description)'}`);
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
                    await query.run(
                        `INSERT INTO security_logs (id, event_type, ip_or_user, details, created_at)
                         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [uuidv4(), 'oauth_missing_email', 'google_callback', JSON.stringify({ profileId: profile.id })]
                    );
                } catch (_) { /* best-effort logging */ }
                return {
                    status: 302,
                    headers: { 'Location': '/?app=1#login?error=email_required' },
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

            // Store session — session ID doubles as the one-time exchange token
            const sessionId = uuidv4();
            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, expires_at)
                VALUES (?, ?, ?, NOW() + INTERVAL '30 days')
            `, [sessionId, user.id, refreshToken]);

            return {
                status: 302,
                headers: {
                    'Location': `/?app=1#auth-callback?ott=${sessionId}`
                },
                data: {}
            };
        } catch (error) {
            logger.error('[SocialAuth] Google OAuth error', null, { detail: error?.message || 'Unknown error', redirectUri: GOOGLE_REDIRECT_URI });
            return {
                status: 302,
                headers: { 'Location': '/?app=1#login?error=oauth_failed' },
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

        const state = await generateStateToken();
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
                headers: { 'Location': '/?app=1#login?error=oauth_denied' },
                data: {}
            };
        }

        if (!(await verifyStateToken(state))) {
            return {
                status: 302,
                headers: { 'Location': '/?app=1#login?error=invalid_state' },
                data: {}
            };
        }

        try {
            // Verify the id_token (JWT) signature using Apple's public keys
            if (!id_token || typeof id_token !== 'string') {
                return { status: 302, headers: { 'Location': '/?app=1#login?error=missing_token' }, data: {} };
            }
            const tokenParts = id_token.split('.');
            if (tokenParts.length !== 3 || !tokenParts[0]) {
                return { status: 302, headers: { 'Location': '/?app=1#login?error=invalid_token' }, data: {} };
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
                        await query.run(
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
                    await query.run(
                        `INSERT INTO security_logs (id, event_type, ip_or_user, details, created_at)
                         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [uuidv4(), 'oauth_missing_email', 'apple_callback', JSON.stringify({ sub: payload.sub })]
                    );
                } catch (_) { /* best-effort logging */ }
                return {
                    status: 302,
                    headers: { 'Location': '/?app=1#login?error=email_required' },
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

            // Store session — session ID doubles as the one-time exchange token
            const sessionId = uuidv4();
            await query.run(`
                INSERT INTO sessions (id, user_id, refresh_token, expires_at)
                VALUES (?, ?, ?, NOW() + INTERVAL '30 days')
            `, [sessionId, user.id, refreshToken]);

            return {
                status: 302,
                headers: {
                    'Location': `/?app=1#auth-callback?ott=${sessionId}`
                },
                data: {}
            };
        } catch (error) {
            logger.error('[SocialAuth] Apple OAuth error', null, { detail: error?.message || 'Unknown error' });
            return {
                status: 302,
                headers: { 'Location': '/?app=1#login?error=oauth_failed' },
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
        const user = await query.get('SELECT password_hash FROM users WHERE id = ?', [ctx.user.id]);
        const oauthCount = await query.get('SELECT COUNT(*) as count FROM oauth_accounts WHERE user_id = ?', [ctx.user.id]);

        if (!user.password_hash && oauthCount.count <= 1) {
            return { status: 400, data: { error: 'Cannot unlink last authentication method. Set a password first.' } };
        }

        await query.run('DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?', [ctx.user.id, provider]);

        return { status: 200, data: { message: `${provider} account unlinked` } };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Table created by pg-schema.sql (managed by migration system)
export const migration = '';
