// Token Refresh Scheduler for VaultLister
// Automatically refreshes OAuth tokens before they expire

import { query } from '../db/database.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';
import { createOAuthNotification, NotificationTypes } from './notificationService.js';
import logger from '../shared/logger.js';

// Configuration
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_EXPIRY_BUFFER_MS = 30 * 60 * 1000; // Refresh tokens expiring within 30 minutes
const MAX_CONSECUTIVE_FAILURES = 5; // Auto-disconnect after this many failures
const FAILURE_RESET_HOURS = 24; // Reset failure count after this many hours of no errors

let schedulerInterval = null;
let isRunning = false;

/**
 * Start the token refresh scheduler
 */
export function startTokenRefreshScheduler() {
    if (schedulerInterval) {
        logger.info('[TokenRefresh] Scheduler already running');
        return;
    }

    logger.info('[TokenRefresh] Starting token refresh scheduler...');
    logger.info(`[TokenRefresh] Interval: ${REFRESH_INTERVAL_MS / 1000}s, Buffer: ${TOKEN_EXPIRY_BUFFER_MS / 60000}min`);

    // Run immediately on start
    refreshExpiringTokens();

    // Then run on interval
    schedulerInterval = setInterval(refreshExpiringTokens, REFRESH_INTERVAL_MS);

    logger.info('[TokenRefresh] Scheduler started');
}

/**
 * Stop the token refresh scheduler
 */
export function stopTokenRefreshScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('[TokenRefresh] Scheduler stopped');
    }
}

/**
 * Find and refresh all tokens expiring soon
 */
export async function refreshExpiringTokens() {
    if (isRunning) {
        logger.info('[TokenRefresh] Previous refresh cycle still running, skipping...');
        return;
    }

    isRunning = true;

    try {
        const expiryThreshold = new Date(Date.now() + TOKEN_EXPIRY_BUFFER_MS).toISOString();

        // Find shops with tokens expiring soon
        // Use a simpler query that doesn't rely on optional columns
        let expiringShops;
        try {
            expiringShops = query.all(`
                SELECT s.*, u.id as owner_user_id
                FROM shops s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.connection_type = 'oauth'
                AND s.is_connected = 1
                AND s.oauth_refresh_token IS NOT NULL
                AND s.oauth_token_expires_at IS NOT NULL
                AND s.oauth_token_expires_at <= ?
                AND (s.consecutive_refresh_failures < ? OR s.consecutive_refresh_failures IS NULL)
            `, [expiryThreshold, MAX_CONSECUTIVE_FAILURES]);
        } catch (err) {
            // Fallback query without consecutive_refresh_failures column
            if (err.message.includes('no such column')) {
                logger.info('[TokenRefresh] Using fallback query (missing columns)');
                expiringShops = query.all(`
                    SELECT s.*, u.id as owner_user_id
                    FROM shops s
                    LEFT JOIN users u ON s.user_id = u.id
                    WHERE s.connection_type = 'oauth'
                    AND s.is_connected = 1
                    AND s.oauth_refresh_token IS NOT NULL
                    AND s.oauth_token_expires_at IS NOT NULL
                    AND s.oauth_token_expires_at <= ?
                `, [expiryThreshold]);
            } else {
                throw err;
            }
        }

        if (expiringShops.length === 0) {
            return;
        }

        logger.info(`[TokenRefresh] Found ${expiringShops.length} token(s) expiring soon`);

        // Refresh each token sequentially to avoid rate limits
        for (const shop of expiringShops) {
            try {
                await refreshShopToken(shop);
                logger.info(`[TokenRefresh] Successfully refreshed token for ${shop.platform} (shop: ${shop.id})`);
            } catch (error) {
                logger.error(`[TokenRefresh] Failed to refresh token for ${shop.platform} (shop: ${shop.id}):`, error.message);
            }

            // Small delay between refreshes to be kind to APIs
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        logger.error('[TokenRefresh] Error in refresh cycle:', error);
    } finally {
        isRunning = false;
    }
}

/**
 * Refresh a single shop's OAuth token
 * @param {Object} shop - Shop record from database
 */
export async function refreshShopToken(shop) {
    const oauthMode = process.env.OAUTH_MODE || 'mock';
    const config = getOAuthConfig(shop.platform, oauthMode);

    if (!config.tokenUrl) {
        throw new Error(`No token URL configured for platform: ${shop.platform}`);
    }

    // Decrypt refresh token
    const refreshToken = decryptToken(shop.oauth_refresh_token);

    try {
        // Perform token refresh
        const tokenResponse = await performTokenRefresh(shop.platform, refreshToken, config, oauthMode);

        // Encrypt new tokens
        const encryptedAccessToken = encryptToken(tokenResponse.access_token);
        const encryptedRefreshToken = tokenResponse.refresh_token
            ? encryptToken(tokenResponse.refresh_token)
            : shop.oauth_refresh_token;

        const expiresAt = new Date(Date.now() + (tokenResponse.expires_in || 3600) * 1000);
        const now = new Date().toISOString();

        // Update shop with new tokens
        // Use a try-catch to handle missing columns gracefully
        try {
            query.run(`
                UPDATE shops SET
                    oauth_token = ?,
                    oauth_refresh_token = ?,
                    oauth_token_expires_at = ?,
                    last_token_refresh_at = ?,
                    token_refresh_error = NULL,
                    token_refresh_error_at = NULL,
                    consecutive_refresh_failures = 0,
                    updated_at = ?
                WHERE id = ?
            `, [
                encryptedAccessToken,
                encryptedRefreshToken,
                expiresAt.toISOString(),
                now,
                now,
                shop.id
            ]);
        } catch (err) {
            // Fallback update without optional columns
            if (err.message.includes('no such column')) {
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
                    now,
                    shop.id
                ]);
            } else {
                throw err;
            }
        }

        return { success: true, expiresAt };

    } catch (error) {
        // Record failure
        const now = new Date().toISOString();
        const failures = (shop.consecutive_refresh_failures || 0) + 1;

        // Try to record the error, but handle missing columns gracefully
        try {
            query.run(`
                UPDATE shops SET
                    token_refresh_error = ?,
                    token_refresh_error_at = ?,
                    consecutive_refresh_failures = ?,
                    updated_at = ?
                WHERE id = ?
            `, [error.message, now, failures, now, shop.id]);
        } catch (updateErr) {
            if (updateErr.message.includes('no such column')) {
                // Just update the timestamp if columns don't exist
                query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`, [now, shop.id]);
            }
        }

        // Create notification for user
        if (shop.user_id) {
            try {
                createOAuthNotification(
                    shop.user_id,
                    shop.platform,
                    NotificationTypes.TOKEN_REFRESH_FAILED,
                    { error: error.message, failures }
                );
            } catch (notifyErr) {
                logger.error('[TokenRefresh] Failed to create notification:', notifyErr.message);
            }
        }

        // Auto-disconnect after too many failures
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
            logger.info(`[TokenRefresh] Auto-disconnecting ${shop.platform} after ${failures} failures`);

            query.run(`
                UPDATE shops SET
                    is_connected = 0,
                    updated_at = ?
                WHERE id = ?
            `, [now, shop.id]);

            if (shop.user_id) {
                try {
                    createOAuthNotification(
                        shop.user_id,
                        shop.platform,
                        NotificationTypes.OAUTH_DISCONNECTED,
                        { reason: 'Repeated token refresh failures' }
                    );
                } catch (notifyErr) {
                    logger.error('[TokenRefresh] Failed to create disconnect notification:', notifyErr.message);
                }
            }
        }

        throw error;
    }
}

/**
 * Perform the actual token refresh request
 */
async function performTokenRefresh(platform, refreshToken, config, mode) {
    if (mode === 'mock') {
        // Mock token refresh - instant success
        return {
            access_token: `mock_access_token_${platform}_${Date.now()}_refreshed`,
            refresh_token: refreshToken, // Return same refresh token
            expires_in: 3600,
            token_type: 'Bearer'
        };
    }

    // Real token refresh
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };

    // eBay uses Basic auth for token requests
    if (platform === 'ebay' && config.clientId && config.clientSecret) {
        headers['Authorization'] = 'Basic ' + Buffer.from(
            `${config.clientId}:${config.clientSecret}`
        ).toString('base64');
    }

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers,
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Get OAuth configuration for a platform
 * Exported so it can be used by other modules
 */
export function getOAuthConfig(platform, mode) {
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

    // Real platform configurations
    const ebayEnvironment = process.env.EBAY_ENVIRONMENT || 'sandbox';
    const ebayAuthBase = ebayEnvironment === 'production'
        ? 'https://auth.ebay.com'
        : 'https://auth.sandbox.ebay.com';
    const ebayApiBase = ebayEnvironment === 'production'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';

    const configs = {
        ebay: {
            authorizationUrl: `${ebayAuthBase}/oauth2/authorize`,
            tokenUrl: `${ebayApiBase}/identity/v1/oauth2/token`,
            userInfoUrl: `${ebayApiBase}/commerce/identity/v1/user/`,
            revokeUrl: `${ebayApiBase}/identity/v1/oauth2/revoke`,
            clientId: process.env.EBAY_CLIENT_ID,
            clientSecret: process.env.EBAY_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: [
                'https://api.ebay.com/oauth/api_scope/sell.inventory',
                'https://api.ebay.com/oauth/api_scope/sell.account',
                'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
            ]
        },
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
        mercari: {
            authorizationUrl: process.env.MERCARI_OAUTH_URL,
            tokenUrl: process.env.MERCARI_TOKEN_URL,
            userInfoUrl: process.env.MERCARI_USER_URL,
            clientId: process.env.MERCARI_CLIENT_ID,
            clientSecret: process.env.MERCARI_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: []
        },
        depop: {
            authorizationUrl: process.env.DEPOP_OAUTH_URL,
            tokenUrl: process.env.DEPOP_TOKEN_URL,
            userInfoUrl: process.env.DEPOP_USER_URL,
            clientId: process.env.DEPOP_CLIENT_ID,
            clientSecret: process.env.DEPOP_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: []
        },
        grailed: {
            authorizationUrl: process.env.GRAILED_OAUTH_URL,
            tokenUrl: process.env.GRAILED_TOKEN_URL,
            userInfoUrl: process.env.GRAILED_USER_URL,
            clientId: process.env.GRAILED_CLIENT_ID,
            clientSecret: process.env.GRAILED_CLIENT_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: []
        },
        facebook: {
            authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
            tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
            userInfoUrl: 'https://graph.facebook.com/v18.0/me',
            clientId: process.env.FACEBOOK_APP_ID,
            clientSecret: process.env.FACEBOOK_APP_SECRET,
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            scopes: ['marketplace_management']
        }
    };

    return configs[platform] || configs.ebay;
}

/**
 * Manually trigger token refresh for a specific shop
 * Used by API endpoints
 */
export async function manualRefreshToken(shopId, userId) {
    const shop = query.get(`
        SELECT * FROM shops
        WHERE id = ? AND user_id = ? AND connection_type = 'oauth'
    `, [shopId, userId]);

    if (!shop) {
        throw new Error('Shop not found or not an OAuth connection');
    }

    if (!shop.oauth_refresh_token) {
        throw new Error('No refresh token available');
    }

    return await refreshShopToken(shop);
}

/**
 * Get token refresh status for monitoring
 */
export function getRefreshSchedulerStatus() {
    let stats;
    try {
        stats = query.get(`
            SELECT
                COUNT(*) as total_oauth_shops,
                SUM(CASE WHEN is_connected = 1 THEN 1 ELSE 0 END) as connected_shops,
                SUM(CASE WHEN consecutive_refresh_failures > 0 THEN 1 ELSE 0 END) as shops_with_errors,
                SUM(CASE WHEN oauth_token_expires_at <= datetime('now', '+15 minutes') AND is_connected = 1 THEN 1 ELSE 0 END) as expiring_soon
            FROM shops
            WHERE connection_type = 'oauth'
        `);
    } catch (err) {
        // Fallback query without optional columns
        if (err.message.includes('no such column')) {
            stats = query.get(`
                SELECT
                    COUNT(*) as total_oauth_shops,
                    SUM(CASE WHEN is_connected = 1 THEN 1 ELSE 0 END) as connected_shops,
                    0 as shops_with_errors,
                    SUM(CASE WHEN oauth_token_expires_at <= datetime('now', '+15 minutes') AND is_connected = 1 THEN 1 ELSE 0 END) as expiring_soon
                FROM shops
                WHERE connection_type = 'oauth'
            `);
        } else {
            stats = { total_oauth_shops: 0, connected_shops: 0, shops_with_errors: 0, expiring_soon: 0 };
        }
    }

    return {
        isRunning: schedulerInterval !== null,
        intervalMs: REFRESH_INTERVAL_MS,
        bufferMs: TOKEN_EXPIRY_BUFFER_MS,
        maxFailures: MAX_CONSECUTIVE_FAILURES,
        ...stats
    };
}
