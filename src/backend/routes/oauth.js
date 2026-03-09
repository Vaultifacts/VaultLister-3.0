// OAuth 2.0 Routes for Platform Authentication
// Supports both mock OAuth (for demo) and real platform OAuth

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { encryptToken, decryptToken, generateStateToken } from '../utils/encryption.js';
import { createHash, randomBytes } from 'crypto';
import { queueTask } from '../workers/taskWorker.js';
import { logger } from '../shared/logger.js';

export async function oauthRouter(ctx) {
    const { method, path, body, user, query: queryParams } = ctx;

    // GET /api/oauth/authorize/:platform - Initiate OAuth flow
    if (method === 'GET' && path.startsWith('/authorize/')) {
        const platform = path.split('/')[2];

        if (!platform) {
            return { status: 400, data: { error: 'Platform required' } };
        }

        // Generate state token for CSRF protection (include platform prefix for callback routing)
        const stateToken = platform + '_' + generateStateToken();
        const stateId = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        const redirectUri = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/oauth-callback';

        // Generate PKCE values for platforms that require it (Etsy v3)
        const PKCE_PLATFORMS = new Set(['etsy']);
        let codeVerifier = null;
        let codeChallenge = null;
        if (PKCE_PLATFORMS.has(platform)) {
            codeVerifier = randomBytes(32).toString('base64url'); // 43 chars, URL-safe
            codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
        }

        // Store state in database (code_verifier stored for PKCE token exchange)
        query.run(`
            INSERT INTO oauth_states (id, user_id, platform, state_token, redirect_uri, expires_at, code_verifier)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [stateId, user.id, platform, stateToken, redirectUri, expiresAt.toISOString(), codeVerifier]);

        // Get OAuth config based on mode
        const oauthMode = process.env.OAUTH_MODE || 'mock';
        let config;
        try {
            config = getOAuthConfig(platform, oauthMode);
        } catch (configErr) {
            return { status: configErr.status || 503, data: { error: configErr.message } };
        }

        // Build authorization URL
        const authUrl = new URL(config.authorizationUrl);
        authUrl.searchParams.set('client_id', config.clientId);
        authUrl.searchParams.set('redirect_uri', config.redirectUri || redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', stateToken);
        if (codeChallenge) {
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
        }
        // Scope URLs must NOT be percent-encoded (eBay rejects %3A%2F%2F).
        // Manually append scope with only spaces encoded as %20.
        const scopeParam = config.scopes.join(' ').replace(/ /g, '%20');
        const finalAuthUrl = authUrl.toString() + '&scope=' + scopeParam;

        return {
            status: 200,
            data: {
                authUrl: finalAuthUrl,
                state: stateToken,
                platform
            }
        };
    }

    // GET /api/oauth/callback/:platform - Handle OAuth callback
    if (method === 'GET' && path.startsWith('/callback/')) {
        const platform = path.split('/')[2];
        const { code, state, error: oauthError } = queryParams;

        if (oauthError) {
            return {
                status: 400,
                data: {
                    error: 'OAuth authorization failed',
                    details: oauthError === 'access_denied' ? 'User denied authorization' : oauthError
                }
            };
        }

        if (!code || !state) {
            return { status: 400, data: { error: 'Missing code or state parameter' } };
        }

        // Verify state token (state_token is unique, no need to filter by platform)
        const stateRecord = query.get(`
            SELECT * FROM oauth_states
            WHERE state_token = ? AND used = 0
        `, [state]);

        if (!stateRecord) {
            return { status: 400, data: { error: 'Invalid or expired state token' } };
        }

        if (new Date(stateRecord.expires_at) < new Date()) {
            return { status: 400, data: { error: 'State token expired' } };
        }

        // Mark state as used
        query.run('UPDATE oauth_states SET used = 1 WHERE id = ?', [stateRecord.id]);

        // Exchange code for tokens
        const oauthMode = process.env.OAUTH_MODE || 'mock';
        let config;
        try {
            config = getOAuthConfig(platform, oauthMode);
        } catch (configErr) {
            return { status: configErr.status || 503, data: { error: configErr.message } };
        }

        try {
            const tokenResponse = await exchangeCodeForTokens(platform, code, config, oauthMode, stateRecord.code_verifier);

            // Encrypt tokens before storage
            const encryptedAccessToken = encryptToken(tokenResponse.access_token);
            const encryptedRefreshToken = tokenResponse.refresh_token
                ? encryptToken(tokenResponse.refresh_token)
                : null;

            const expiresAt = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000);

            // Get platform user info
            const platformUserInfo = await fetchPlatformUserInfo(
                platform,
                tokenResponse.access_token,
                oauthMode,
                config
            );

            // Create or update shop connection
            const existingShop = query.get(`
                SELECT id FROM shops WHERE user_id = ? AND platform = ?
            `, [stateRecord.user_id, platform]);

            const now = new Date().toISOString();

            if (existingShop) {
                query.run(`
                    UPDATE shops SET
                        connection_type = 'oauth',
                        oauth_provider = ?,
                        oauth_token = ?,
                        oauth_refresh_token = ?,
                        oauth_token_expires_at = ?,
                        oauth_scopes = ?,
                        platform_username = ?,
                        platform_user_id = ?,
                        is_connected = 1,
                        updated_at = ?
                    WHERE id = ?
                `, [
                    oauthMode,
                    encryptedAccessToken,
                    encryptedRefreshToken,
                    expiresAt.toISOString(),
                    JSON.stringify(tokenResponse.scope?.split(' ') || []),
                    platformUserInfo.username,
                    platformUserInfo.id,
                    now,
                    existingShop.id
                ]);
            } else {
                const shopId = uuidv4();
                query.run(`
                    INSERT INTO shops (
                        id, user_id, platform, connection_type, oauth_provider,
                        oauth_token, oauth_refresh_token, oauth_token_expires_at,
                        oauth_scopes, platform_username, platform_user_id,
                        is_connected, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    shopId, stateRecord.user_id, platform, 'oauth', oauthMode,
                    encryptedAccessToken, encryptedRefreshToken, expiresAt.toISOString(),
                    JSON.stringify(tokenResponse.scope?.split(' ') || []),
                    platformUserInfo.username, platformUserInfo.id,
                    1, now, now
                ]);
            }

            return {
                status: 200,
                data: {
                    success: true,
                    platform,
                    username: platformUserInfo.username,
                    message: 'OAuth connection successful'
                }
            };

        } catch (error) {
            logger.error('[OAuth] OAuth token exchange error', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to complete OAuth flow' }
            };
        }
    }

    // POST /api/oauth/refresh/:platform - Refresh access token
    if (method === 'POST' && path.startsWith('/refresh/')) {
        const platform = path.split('/')[2];

        const shop = query.get(`
            SELECT * FROM shops
            WHERE user_id = ? AND platform = ? AND connection_type = 'oauth'
        `, [user.id, platform]);

        if (!shop || !shop.oauth_refresh_token) {
            return { status: 404, data: { error: 'No OAuth connection found or no refresh token available' } };
        }

        try {
            const refreshToken = decryptToken(shop.oauth_refresh_token);
            const oauthMode = process.env.OAUTH_MODE || 'mock';
            const config = getOAuthConfig(platform, oauthMode);

            const tokenResponse = await refreshAccessToken(platform, refreshToken, config, oauthMode);

            const encryptedAccessToken = encryptToken(tokenResponse.access_token);
            const encryptedRefreshToken = tokenResponse.refresh_token
                ? encryptToken(tokenResponse.refresh_token)
                : shop.oauth_refresh_token; // Keep old refresh token if not provided

            const expiresAt = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000);

            query.run(`
                UPDATE shops SET
                    oauth_token = ?,
                    oauth_refresh_token = ?,
                    oauth_token_expires_at = ?,
                    updated_at = ?
                WHERE id = ?
            `, [
                encryptedAccessToken,
                encryptedRefreshToken,
                expiresAt.toISOString(),
                new Date().toISOString(),
                shop.id
            ]);

            return {
                status: 200,
                data: {
                    success: true,
                    message: 'Token refreshed successfully',
                    expiresAt: expiresAt.toISOString()
                }
            };

        } catch (error) {
            logger.error('[OAuth] Token refresh error', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to refresh token' }
            };
        }
    }

    // DELETE /api/oauth/revoke/:platform - Revoke OAuth connection
    if (method === 'DELETE' && path.startsWith('/revoke/')) {
        const platform = path.split('/')[2];

        const shop = query.get(`
            SELECT * FROM shops
            WHERE user_id = ? AND platform = ? AND connection_type = 'oauth'
        `, [user.id, platform]);

        if (!shop) {
            return { status: 404, data: { error: 'No OAuth connection found' } };
        }

        try {
            // Optionally revoke token with platform (for real OAuth)
            if (process.env.OAUTH_MODE !== 'mock' && shop.oauth_token) {
                const accessToken = decryptToken(shop.oauth_token);
                const config = getOAuthConfig(platform, process.env.OAUTH_MODE);
                await revokeToken(platform, accessToken, config);
            }

            // Remove OAuth data from shop (but keep manual connection capability)
            query.run(`
                UPDATE shops SET
                    connection_type = 'manual',
                    oauth_provider = NULL,
                    oauth_token = NULL,
                    oauth_refresh_token = NULL,
                    oauth_token_expires_at = NULL,
                    oauth_scopes = NULL,
                    is_connected = 0,
                    updated_at = ?
                WHERE id = ?
            `, [new Date().toISOString(), shop.id]);

            return {
                status: 200,
                data: {
                    success: true,
                    message: 'OAuth connection revoked'
                }
            };

        } catch (error) {
            logger.error('[OAuth] OAuth revoke error', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to revoke OAuth connection' }
            };
        }
    }

    // POST /api/oauth/sync/:platform - Trigger platform sync
    if (method === 'POST' && path.startsWith('/sync/')) {
        const platform = path.split('/')[2];

        const shop = query.get(`
            SELECT * FROM shops
            WHERE user_id = ? AND platform = ? AND connection_type = 'oauth' AND is_connected = 1
        `, [user.id, platform]);

        if (!shop) {
            return { status: 404, data: { error: 'No connected OAuth shop found for this platform' } };
        }

        try {
            // Queue sync task for background processing
            const task = queueTask('sync_shop', {
                shopId: shop.id,
                userId: user.id,
                platform
            }, { priority: 1 });

            return {
                status: 202,
                data: {
                    success: true,
                    message: 'Sync task queued',
                    taskId: task.id,
                    platform
                }
            };
        } catch (error) {
            logger.error('[OAuth] Sync queue error', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to queue sync task' }
            };
        }
    }

    // GET /api/oauth/status/:platform - Get OAuth and sync status
    if (method === 'GET' && path.startsWith('/status/')) {
        const platform = path.split('/')[2];

        // Query without optional columns to avoid errors on older schemas
        const shop = query.get(`
            SELECT id, platform, connection_type, is_connected, oauth_provider,
                   oauth_token_expires_at, platform_username, created_at, updated_at
            FROM shops
            WHERE user_id = ? AND platform = ?
        `, [user.id, platform]);

        if (!shop) {
            return {
                status: 200,
                data: {
                    connected: false,
                    platform,
                    message: 'No shop connection found'
                }
            };
        }

        // Build response with available fields
        const response = {
            connected: Boolean(shop.is_connected),
            platform: shop.platform,
            connectionType: shop.connection_type,
            oauthProvider: shop.oauth_provider,
            username: shop.platform_username,
            tokenExpiresAt: shop.oauth_token_expires_at,
            createdAt: shop.created_at,
            updatedAt: shop.updated_at
        };

        // Try to get optional columns if they exist
        try {
            const extendedShop = query.get(`
                SELECT last_token_refresh_at, token_refresh_error,
                       last_sync_at, sync_error, consecutive_refresh_failures
                FROM shops WHERE id = ?
            `, [shop.id]);

            if (extendedShop) {
                response.lastTokenRefresh = extendedShop.last_token_refresh_at;
                response.tokenRefreshError = extendedShop.token_refresh_error;
                response.consecutiveFailures = extendedShop.consecutive_refresh_failures;
                response.lastSync = extendedShop.last_sync_at;
                response.syncError = extendedShop.sync_error;
            }
        } catch (err) {
            // Columns don't exist yet, that's fine
        }

        return {
            status: 200,
            data: response
        };
    }

    return { status: 404, data: { error: 'Route not found' } };
}

// ===== Helper Functions =====

/**
 * Get OAuth configuration for a platform
 */
function getOAuthConfig(platform, mode) {
    if (mode === 'mock') {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        return {
            authorizationUrl: `${baseUrl}/mock-oauth/${platform}/authorize`,
            tokenUrl: `${baseUrl}/mock-oauth/${platform}/token`,
            userInfoUrl: `${baseUrl}/mock-oauth/${platform}/user`,
            revokeUrl: `${baseUrl}/mock-oauth/${platform}/revoke`,
            clientId: `mock-${platform}-client-id`,
            clientSecret: `mock-${platform}-client-secret`,
            redirectUri: process.env.OAUTH_REDIRECT_URI || `${baseUrl}/oauth-callback`,
            scopes: ['read', 'write', 'listings']
        };
    }

    // Real platform configurations (to be filled in when switching from mock)
    const configs = {
        poshmark: {
            authorizationUrl: process.env.POSHMARK_OAUTH_URL || 'https://poshmark.com/oauth/authorize',
            tokenUrl: process.env.POSHMARK_TOKEN_URL || 'https://poshmark.com/oauth/token',
            userInfoUrl: process.env.POSHMARK_USER_URL || 'https://api.poshmark.com/v1/user',
            revokeUrl: process.env.POSHMARK_REVOKE_URL || 'https://api.poshmark.com/v1/oauth/revoke',
            clientId: process.env.POSHMARK_CLIENT_ID,
            clientSecret: process.env.POSHMARK_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['listings.read', 'listings.write', 'profile']
        },
        ebay: (() => {
            const env = process.env.EBAY_ENVIRONMENT || 'sandbox';
            const authBase = env === 'production' ? 'https://auth.ebay.com' : 'https://auth.sandbox.ebay.com';
            const apiBase = env === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
            const apizBase = env === 'production' ? 'https://apiz.ebay.com' : 'https://apiz.sandbox.ebay.com';
            return {
                authorizationUrl: `${authBase}/oauth2/authorize`,
                tokenUrl: `${apiBase}/identity/v1/oauth2/token`,
                userInfoUrl: `${apizBase}/commerce/identity/v1/user/`,
                revokeUrl: `${apiBase}/identity/v1/oauth2/revoke`,
                clientId: process.env.EBAY_CLIENT_ID,
                clientSecret: process.env.EBAY_CLIENT_SECRET,
                redirectUri: process.env.EBAY_REDIRECT_URI || process.env.OAUTH_REDIRECT_URI,
                scopes: [
                    'https://api.ebay.com/oauth/api_scope',
                    'https://api.ebay.com/oauth/api_scope/buy.order.readonly',
                    'https://api.ebay.com/oauth/api_scope/buy.guest.order',
                    'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.marketing',
                    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.inventory',
                    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.account',
                    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
                    'https://api.ebay.com/oauth/api_scope/sell.analytics.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.marketplace.insights.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.catalog.readonly',
                    'https://api.ebay.com/oauth/api_scope/buy.shopping.cart',
                    'https://api.ebay.com/oauth/api_scope/buy.offer.auction',
                    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.identity.email.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.identity.phone.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.identity.address.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.identity.name.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.identity.status.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.finances',
                    'https://api.ebay.com/oauth/api_scope/sell.payment.dispute',
                    'https://api.ebay.com/oauth/api_scope/sell.item.draft',
                    'https://api.ebay.com/oauth/api_scope/sell.item',
                    'https://api.ebay.com/oauth/api_scope/sell.reputation',
                    'https://api.ebay.com/oauth/api_scope/sell.reputation.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
                    'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription.readonly',
                    'https://api.ebay.com/oauth/api_scope/sell.stores',
                    'https://api.ebay.com/oauth/api_scope/sell.stores.readonly',
                    'https://api.ebay.com/oauth/api_scope/commerce.vero',
                    'https://api.ebay.com/oauth/api_scope/sell.inventory.mapping',
                    'https://api.ebay.com/oauth/api_scope/commerce.message',
                    'https://api.ebay.com/oauth/api_scope/commerce.feedback',
                    'https://api.ebay.com/oauth/api_scope/commerce.shipping'
                ]
            };
        })(),
        mercari: {
            authorizationUrl: 'https://www.mercari.com/oauth/authorize',
            tokenUrl: 'https://www.mercari.com/oauth/token',
            userInfoUrl: 'https://api.mercari.com/v1/user',
            revokeUrl: 'https://api.mercari.com/v1/oauth/revoke',
            clientId: process.env.MERCARI_CLIENT_ID,
            clientSecret: process.env.MERCARI_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['read', 'write']
        },
        depop: {
            authorizationUrl: 'https://www.depop.com/oauth/authorize',
            tokenUrl: 'https://www.depop.com/oauth/token',
            userInfoUrl: 'https://api.depop.com/v1/user',
            revokeUrl: 'https://api.depop.com/v1/oauth/revoke',
            clientId: process.env.DEPOP_CLIENT_ID,
            clientSecret: process.env.DEPOP_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['read', 'write', 'listings']
        },
        grailed: {
            authorizationUrl: 'https://www.grailed.com/oauth/authorize',
            tokenUrl: 'https://www.grailed.com/oauth/token',
            userInfoUrl: 'https://api.grailed.com/v1/user',
            revokeUrl: 'https://api.grailed.com/v1/oauth/revoke',
            clientId: process.env.GRAILED_CLIENT_ID,
            clientSecret: process.env.GRAILED_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['read', 'write', 'listings']
        },
        facebook: {
            authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
            tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
            userInfoUrl: 'https://graph.facebook.com/v18.0/me',
            revokeUrl: 'https://graph.facebook.com/v18.0/me/permissions',
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['commerce_account.read', 'commerce_account.write']
        },
        whatnot: {
            authorizationUrl: 'https://www.whatnot.com/oauth/authorize',
            tokenUrl: 'https://api.whatnot.com/oauth/token',
            userInfoUrl: 'https://api.whatnot.com/v1/user',
            revokeUrl: 'https://api.whatnot.com/v1/oauth/revoke',
            clientId: process.env.WHATNOT_CLIENT_ID,
            clientSecret: process.env.WHATNOT_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['read', 'write', 'listings', 'live']
        },
        shopify: {
            authorizationUrl: 'https://accounts.shopify.com/oauth/authorize',
            tokenUrl: 'https://accounts.shopify.com/oauth/token',
            userInfoUrl: 'https://accounts.shopify.com/api/user',
            revokeUrl: 'https://accounts.shopify.com/oauth/revoke',
            clientId: process.env.SHOPIFY_CLIENT_ID,
            clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['read_products', 'write_products', 'read_orders', 'write_orders']
        },
        etsy: {
            authorizationUrl: 'https://www.etsy.com/oauth/connect',
            tokenUrl: 'https://api.etsy.com/v3/public/oauth/token',
            userInfoUrl: 'https://openapi.etsy.com/v3/application/users/me',
            revokeUrl: 'https://api.etsy.com/v3/public/oauth/revoke',
            clientId: process.env.ETSY_CLIENT_ID,
            clientSecret: process.env.ETSY_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['listings_r', 'listings_w', 'transactions_r', 'profile_r']
        }
    };

    const config = configs[platform] || configs.poshmark;

    // In real (non-mock) mode, reject if credentials are missing
    // PKCE platforms (Etsy) only need clientId — no clientSecret
    const isPKCE = platform === 'etsy';
    if (mode !== 'mock' && (!config.clientId || (!isPKCE && !config.clientSecret))) {
        const err = new Error(`${platform} OAuth not configured`);
        err.status = 503;
        throw err;
    }

    return config;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
async function exchangeCodeForTokens(platform, code, config, mode, codeVerifier = null) {
    if (mode === 'mock') {
        // Mock token exchange - instant success
        return {
            access_token: `mock_access_token_${platform}_${Date.now()}`,
            refresh_token: `mock_refresh_token_${platform}_${Date.now()}`,
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'read write listings'
        };
    }

    // Build token request body
    const bodyParams = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri
    };

    // PKCE flow: include code_verifier + client_id in body instead of Basic Auth
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (codeVerifier) {
        bodyParams.client_id = config.clientId;
        bodyParams.code_verifier = codeVerifier;
    } else {
        // Standard confidential client flow: Basic Auth with client_id:client_secret
        headers['Authorization'] = 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    }

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers,
        body: new URLSearchParams(bodyParams),
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorData}`);
    }

    return await response.json();
}

/**
 * Fetch platform user information
 */
async function fetchPlatformUserInfo(platform, accessToken, mode, config) {
    if (mode === 'mock') {
        return {
            id: `mock_user_${platform}_${crypto.randomUUID().split('-')[0]}`,
            username: `demo_${platform}_user`,
            email: `demo@${platform}.com`,
            display_name: `Demo ${platform.charAt(0).toUpperCase() + platform.slice(1)} User`
        };
    }

    // Platform-specific headers
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };

    // eBay requires Accept header
    if (platform === 'ebay') {
        headers['Accept'] = 'application/json';
    }

    const response = await fetch(config.userInfoUrl, { headers, signal: AbortSignal.timeout(30000) });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user info: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Normalize user info across platforms
    return normalizeUserInfo(platform, data);
}

/**
 * Normalize user info from different platforms to a common format
 */
function normalizeUserInfo(platform, data) {
    switch (platform) {
        case 'ebay':
            return {
                id: data.userId || data.username,
                username: data.username || data.userId,
                email: data.email,
                display_name: data.username
            };
        case 'poshmark':
            return {
                id: data.id || data.username,
                username: data.username,
                email: data.email,
                display_name: data.display_name || data.username
            };
        default:
            return {
                id: data.id || data.user_id || data.username,
                username: data.username || data.login || data.name,
                email: data.email,
                display_name: data.display_name || data.name || data.username
            };
    }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(platform, refreshToken, config, mode) {
    if (mode === 'mock') {
        return {
            access_token: `mock_access_token_${platform}_${Date.now()}_refreshed`,
            refresh_token: refreshToken, // Same refresh token
            expires_in: 3600,
            token_type: 'Bearer'
        };
    }

    // Real token refresh (to be implemented when switching from mock)
    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Revoke an access token
 */
async function revokeToken(platform, accessToken, config) {
    // Platform-specific revocation (to be implemented for real OAuth)
    try {
        if (config.revokeUrl) {
            await fetch(config.revokeUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
                },
                body: new URLSearchParams({
                    token: accessToken
                }),
                signal: AbortSignal.timeout(30000)
            });
        }
        logger.info(`[OAuth] Token revoked for ${platform}`);
    } catch (error) {
        logger.warn(`[OAuth] Failed to revoke token for ${platform}`);
        // Don't throw - revocation is best-effort
    }
}

// Export helper functions for use by other modules
export {
    getOAuthConfig,
    exchangeCodeForTokens,
    refreshAccessToken,
    fetchPlatformUserInfo,
    revokeToken
};
