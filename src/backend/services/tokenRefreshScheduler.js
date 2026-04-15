// Token Refresh Scheduler for VaultLister
// Automatically refreshes OAuth tokens before they expire

import { query } from '../db/database.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';
import { createOAuthNotification, NotificationTypes } from './notificationService.js';
import { set as setRedisValue } from './redis.js';
import { acquireRedisLock, withRedisLock } from './redisLock.js';
import logger from '../shared/logger.js';
import { fetchWithTimeout } from '../shared/fetchWithTimeout.js';

// Configuration
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_EXPIRY_BUFFER_MS = 30 * 60 * 1000; // Refresh tokens expiring within 30 minutes
const MAX_CONSECUTIVE_FAILURES = 5; // Auto-disconnect after this many failures
const MAX_TRANSIENT_FAILURES = 10; // Higher threshold for transient errors (timeouts, 500s)
const PERMANENT_ERROR_PATTERNS = ['invalid_client', 'invalid_grant', 'unauthorized_client'];
const FAILURE_RESET_HOURS = 24; // Reset failure count after this many hours of no errors
const HEARTBEAT_KEY = 'worker:health:tokenRefreshScheduler';
const HEARTBEAT_TTL_SECONDS = 1800;
const REFRESH_LOCK_KEY = 'worker:lock:tokenRefreshScheduler';
const REFRESH_LOCK_TTL_MS = 30 * 60 * 1000;
const POSHMARK_KEEPALIVE_LOCK_KEY = 'worker:lock:poshmarkKeepAlive';
const POSHMARK_KEEPALIVE_LOCK_TTL_MS = 30 * 60 * 1000;

let schedulerInterval = null;
let poshmarkKeepAliveInterval = null;
let isRunning = false;
let lastRun = 0;
const POSHMARK_KEEPALIVE_MS = 6 * 60 * 60 * 1000; // 6 hours

async function writeHeartbeat() {
    const heartbeatTime = lastRun || Date.now();
    await setRedisValue(
        HEARTBEAT_KEY,
        JSON.stringify({ lastRun: new Date(heartbeatTime).toISOString(), status: 'running' }),
        HEARTBEAT_TTL_SECONDS
    );
}

function scheduleStartupHeartbeats() {
    lastRun = Date.now();
    const writeStartupHeartbeat = () => {
        writeHeartbeat().catch(heartbeatError => {
            logger.warn('[TokenRefresh] Failed to write startup heartbeat:', heartbeatError.message);
        });
    };
    writeStartupHeartbeat();
    for (const delayMs of [5000, 15000]) {
        const timer = setTimeout(writeStartupHeartbeat, delayMs);
        timer.unref?.();
    }
}

/**
 * Start the token refresh scheduler
 */
export async function startTokenRefreshScheduler() {
    if (schedulerInterval) {
        logger.info('[TokenRefresh] Scheduler already running');
        return;
    }

    logger.info('[TokenRefresh] Starting token refresh scheduler...');
    logger.info(`[TokenRefresh] Interval: ${REFRESH_INTERVAL_MS / 1000}s, Buffer: ${TOKEN_EXPIRY_BUFFER_MS / 60000}min`);
    scheduleStartupHeartbeats();

    // Auto-reset shops that were disconnected due to refresh failures
    // This allows retry on server restart (e.g. after .env credentials are updated)
    try {
        const resetResult = await query.run(`
            UPDATE shops SET
                is_connected = TRUE,
                consecutive_refresh_failures = 0,
                token_refresh_error = NULL,
                token_refresh_error_at = NULL,
                updated_at = NOW()
            WHERE is_connected = FALSE
              AND consecutive_refresh_failures >= ?
              AND oauth_refresh_token IS NOT NULL
              AND connection_type = 'oauth'
        `, [MAX_CONSECUTIVE_FAILURES]);

        if (resetResult.changes > 0) {
            logger.info(`[TokenRefresh] Auto-reset ${resetResult.changes} shop(s) disconnected by refresh failures — will retry`);
        }
    } catch (err) {
        if (!err.message.includes('no such column')) {
            logger.warn('[TokenRefresh] Failed to auto-reset shops:', err.message);
        }
    }

    // Run immediately on start
    refreshExpiringTokens();

    // Then run on interval
    schedulerInterval = setInterval(refreshExpiringTokens, REFRESH_INTERVAL_MS);

    // Start Poshmark session keep-alive (every 6 hours)
    try {
        const { refreshPoshmarkSession } = await import('../../../scripts/poshmark-keepalive.js');
        // Run after a 30s delay (let server fully start first)
        setTimeout(async () => {
            try {
                await withRedisLock(
                    POSHMARK_KEEPALIVE_LOCK_KEY,
                    POSHMARK_KEEPALIVE_LOCK_TTL_MS,
                    refreshPoshmarkSession,
                    { name: 'Poshmark keep-alive' }
                );
            } catch (e) {
                logger.warn('[TokenRefresh] Poshmark keep-alive initial run failed:', e.message);
            }
        }, 30000);
        poshmarkKeepAliveInterval = setInterval(async () => {
            try {
                await withRedisLock(
                    POSHMARK_KEEPALIVE_LOCK_KEY,
                    POSHMARK_KEEPALIVE_LOCK_TTL_MS,
                    refreshPoshmarkSession,
                    { name: 'Poshmark keep-alive' }
                );
            } catch (e) {
                logger.warn('[TokenRefresh] Poshmark keep-alive failed:', e.message);
            }
        }, POSHMARK_KEEPALIVE_MS);
        logger.info('[TokenRefresh] Poshmark session keep-alive scheduled (every 6h)');
    } catch (e) {
        logger.info('[TokenRefresh] Poshmark keep-alive not available (playwright not installed or script missing)');
    }

    logger.info('[TokenRefresh] Scheduler started');
}

/**
 * Stop the token refresh scheduler
 */
export function stopTokenRefreshScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
    if (poshmarkKeepAliveInterval) {
        clearInterval(poshmarkKeepAliveInterval);
        poshmarkKeepAliveInterval = null;
    }
    logger.info('[TokenRefresh] Scheduler stopped');
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
    lastRun = Date.now();
    const lock = await acquireRedisLock(
        REFRESH_LOCK_KEY,
        REFRESH_LOCK_TTL_MS,
        { name: 'token refresh scheduler' }
    );

    if (!lock.acquired) {
        isRunning = false;
        return;
    }

    try {
        const expiryThreshold = new Date(Date.now() + TOKEN_EXPIRY_BUFFER_MS).toISOString();

        // Find shops with tokens expiring soon
        // Use a simpler query that doesn't rely on optional columns
        let expiringShops;
        try {
            expiringShops = await query.all(`
                SELECT s.*, u.id as owner_user_id
                FROM shops s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.connection_type = 'oauth'
                AND s.is_connected = TRUE
                AND s.oauth_refresh_token IS NOT NULL
                AND s.oauth_token_expires_at IS NOT NULL
                AND s.oauth_token_expires_at <= ?
                AND (s.consecutive_refresh_failures < ? OR s.consecutive_refresh_failures IS NULL)
            `, [expiryThreshold, MAX_CONSECUTIVE_FAILURES]);
        } catch (err) {
            // Fallback query without consecutive_refresh_failures column
            if (err.message.includes('no such column')) {
                logger.info('[TokenRefresh] Using fallback query (missing columns)');
                expiringShops = await query.all(`
                    SELECT s.*, u.id as owner_user_id
                    FROM shops s
                    LEFT JOIN users u ON s.user_id = u.id
                    WHERE s.connection_type = 'oauth'
                    AND s.is_connected = TRUE
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
        // Platform health alerts check — run alongside token refresh
        try {
            await checkPlatformHealthAlerts();
        } catch (healthErr) {
            logger.error('[TokenRefresh] Health alert check failed:', healthErr.message);
        }
        // Inventory forecast alerts check
        try {
            await checkInventoryForecastAlerts();
        } catch (forecastErr) {
            logger.error('[TokenRefresh] Forecast alert check failed:', forecastErr.message);
        }
        // Profit margin alerts check
        try {
            await checkProfitMarginAlerts();
        } catch (marginErr) {
            logger.error('[TokenRefresh] Margin alert check failed:', marginErr.message);
        }
    } catch (error) {
        logger.error('[TokenRefresh] Error in refresh cycle:', error);
    } finally {
        try {
            await writeHeartbeat();
        } catch (heartbeatError) {
            logger.warn('[TokenRefresh] Failed to write heartbeat:', heartbeatError.message);
        }
        await lock.release();
        isRunning = false;
    }
}

/**
 * Check platform health and alert users when scores drop below threshold
 */
async function checkPlatformHealthAlerts() {
    const HEALTH_THRESHOLD = 50; // Alert when below this score
    const allShops = await query.all(`
        SELECT s.id, s.user_id, s.platform, s.platform_username, s.is_connected,
            s.oauth_token_expires_at, s.consecutive_refresh_failures, s.last_sync_at,
            s.connection_type, s.sync_status
        FROM shops s WHERE s.is_connected = TRUE
    `);

    for (const shop of allShops) {
        const now = Date.now();
        const tokenExpiry = shop.oauth_token_expires_at ? new Date(shop.oauth_token_expires_at).getTime() : null;
        const lastSync = shop.last_sync_at ? new Date(shop.last_sync_at).getTime() : null;
        const failures = shop.consecutive_refresh_failures || 0;

        let score = 100;
        const issues = [];

        if (shop.connection_type === 'oauth') {
            if (!tokenExpiry) { score -= 30; issues.push('No OAuth token'); }
            else if (tokenExpiry < now) { score -= 40; issues.push('Token expired'); }
            else if (tokenExpiry - now < 3600000) { score -= 15; issues.push('Token expiring soon'); }
        }
        if (failures >= 5) { score -= 30; issues.push('5+ refresh failures'); }
        else if (failures >= 3) { score -= 15; issues.push(`${failures} refresh failures`); }
        if (!lastSync) { score -= 10; issues.push('Never synced'); }
        else if (now - lastSync > 86400000 * 7) { score -= 15; issues.push('Sync stale >7 days'); }

        const listingErrors = await query.get(
            "SELECT COUNT(*) as cnt FROM listings WHERE user_id = ? AND platform = ? AND status = 'error'",
            [shop.user_id, shop.platform]
        )?.cnt || 0;
        if (listingErrors > 0) { score -= Math.min(10, listingErrors * 2); issues.push(`${listingErrors} listing errors`); }

        score = Math.max(0, score);

        if (score < HEALTH_THRESHOLD && issues.length > 0) {
            // Check if we already sent a health alert in the last 6 hours
            const recentAlert = await query.get(`
                SELECT id FROM notifications WHERE user_id = ? AND type = 'platform_health'
                    AND data ILIKE ? AND created_at >= NOW() - INTERVAL '6 hours'
            `, [shop.user_id, `%${shop.platform}%`]);

            if (!recentAlert) {
                try {
                    const { createNotification } = await import('./notificationService.js');
                    createNotification(shop.user_id, {
                        type: 'platform_health',
                        title: `${shop.platform.charAt(0).toUpperCase() + shop.platform.slice(1)} health alert`,
                        message: `Health score dropped to ${score}/100. Issues: ${issues.join(', ')}`,
                        data: JSON.stringify({ platform: shop.platform, score, issues })
                    });

                    const { websocketService } = await import('./websocket.js');
                    websocketService.sendToUser(shop.user_id, {
                        type: 'notification',
                        notification: {
                            type: 'platform_health',
                            title: `${shop.platform} health: ${score}/100`,
                            message: issues.join(', '),
                            data: { platform: shop.platform, score }
                        }
                    });
                } catch (_) { /* notification service not available */ }
            }
        }
    }
}

/**
 * Check inventory forecast and alert users when categories have critical/low stock
 */
async function checkInventoryForecastAlerts() {
    const users = await query.all('SELECT DISTINCT user_id FROM inventory WHERE status = ?', ['active']);

    for (const { user_id } of users) {
        const velocity = await query.all(`
            SELECT i.category,
                COUNT(DISTINCT i.id) as total_items,
                COUNT(DISTINCT s.id) as sold_items,
                COUNT(DISTINCT CASE WHEN i.status = 'active' THEN i.id END) as active_count
            FROM inventory i
            LEFT JOIN sales s ON s.inventory_id = i.id AND s.created_at >= NOW() - INTERVAL '90 days'
            WHERE i.user_id = ?
            GROUP BY i.category
            HAVING active_count > 0
        `, [user_id]);

        const alerts = [];
        for (const v of velocity) {
            const monthlyVelocity = (v.sold_items || 0) / 3;
            if (monthlyVelocity <= 0) continue;
            const daysOfSupply = Math.round(v.active_count / monthlyVelocity * 30);
            if (daysOfSupply < 14) {
                alerts.push({ category: v.category || 'Uncategorized', daysOfSupply, active: v.active_count, health: 'critical' });
            } else if (daysOfSupply < 30) {
                alerts.push({ category: v.category || 'Uncategorized', daysOfSupply, active: v.active_count, health: 'low' });
            }
        }

        if (alerts.length === 0) continue;

        // 6-hour dedup
        const recentAlert = await query.get(
            `SELECT id FROM notifications WHERE user_id = ? AND type = 'inventory_forecast' AND created_at >= NOW() - INTERVAL '6 hours'`,
            [user_id]
        );
        if (recentAlert) continue;

        const criticalCount = alerts.filter(a => a.health === 'critical').length;
        const lowCount = alerts.filter(a => a.health === 'low').length;
        const title = criticalCount > 0
            ? `${criticalCount} categor${criticalCount === 1 ? 'y' : 'ies'} critically low on stock`
            : `${lowCount} categor${lowCount === 1 ? 'y' : 'ies'} running low`;
        const message = alerts.map(a => `${a.category}: ${a.daysOfSupply}d supply (${a.active} items)`).join('; ');

        try {
            const { createNotification } = await import('./notificationService.js');
            createNotification(user_id, {
                type: 'inventory_forecast',
                title,
                message,
                data: JSON.stringify({ alerts })
            });

            const { websocketService } = await import('./websocket.js');
            websocketService.sendToUser(user_id, {
                type: 'notification',
                notification: { type: 'inventory_forecast', title, message, data: { alerts } }
            });
        } catch (_) { /* notification service not available */ }
    }
}

/**
 * Check inventory profit margins and alert when below threshold
 */
async function checkProfitMarginAlerts() {
    const MARGIN_THRESHOLD = 0.15; // Alert when margin drops below 15%
    const users = await query.all('SELECT DISTINCT user_id FROM inventory WHERE status = ?', ['active']);

    for (const { user_id } of users) {
        const lowMarginItems = await query.all(`
            SELECT i.category, COUNT(*) as item_count,
                AVG(CASE WHEN i.list_price > 0 THEN (i.list_price - COALESCE(i.cost_price, 0)) / i.list_price ELSE 0 END) as avg_margin,
                MIN(CASE WHEN i.list_price > 0 THEN (i.list_price - COALESCE(i.cost_price, 0)) / i.list_price ELSE 0 END) as min_margin
            FROM inventory i
            WHERE i.user_id = ? AND i.status = 'active' AND i.cost_price > 0 AND i.list_price > 0
            GROUP BY i.category
            HAVING avg_margin < ?
        `, [user_id, MARGIN_THRESHOLD]);

        if (lowMarginItems.length === 0) continue;

        // 6-hour dedup
        const recentAlert = await query.get(
            `SELECT id FROM notifications WHERE user_id = ? AND type = 'margin_alert' AND created_at >= NOW() - INTERVAL '6 hours'`,
            [user_id]
        );
        if (recentAlert) continue;

        const title = `${lowMarginItems.length} categor${lowMarginItems.length === 1 ? 'y' : 'ies'} below ${Math.round(MARGIN_THRESHOLD * 100)}% margin`;
        const message = lowMarginItems.map(c =>
            `${c.category || 'Uncategorized'}: ${Math.round((c.avg_margin || 0) * 100)}% avg (${c.item_count} items)`
        ).join('; ');

        try {
            const { createNotification } = await import('./notificationService.js');
            createNotification(user_id, {
                type: 'margin_alert',
                title,
                message,
                data: JSON.stringify({ categories: lowMarginItems })
            });
            const { websocketService } = await import('./websocket.js');
            websocketService.sendToUser(user_id, {
                type: 'notification',
                notification: { type: 'margin_alert', title, message, data: { categories: lowMarginItems } }
            });
        } catch (_) { /* notification service not available */ }
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
            await query.run(`
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
                await query.run(`
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
            await query.run(`
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
                await query.run(`UPDATE shops SET updated_at = ? WHERE id = ?`, [now, shop.id]);
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

        // Determine if this is a permanent error (no point retrying) or transient
        const errorMsg = error.message || '';
        const isPermanent = PERMANENT_ERROR_PATTERNS.some(p => errorMsg.includes(p));
        const maxForThisError = isPermanent ? 2 : MAX_TRANSIENT_FAILURES;

        // Auto-disconnect after too many failures
        if (failures >= maxForThisError) {
            logger.info(`[TokenRefresh] Auto-disconnecting ${shop.platform} after ${failures} ${isPermanent ? 'permanent' : 'transient'} failures`);

            await query.run(`
                UPDATE shops SET
                    is_connected = FALSE,
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

    const response = await fetchWithTimeout(config.tokenUrl, {
        method: 'POST',
        timeoutMs: 15000,
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
    const ebayEnvironment = process.env.EBAY_ENVIRONMENT || 'production';
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
        // Facebook: No OAuth/Commerce API path — listing handled via Chrome extension browser automation
        facebook: null
    };

    return configs[platform] || configs.ebay;
}

/**
 * Manually trigger token refresh for a specific shop
 * Used by API endpoints
 */
export async function manualRefreshToken(shopId, userId) {
    const shop = await query.get(`
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
export async function getRefreshSchedulerStatus() {
    let stats;
    try {
        stats = await query.get(`
            SELECT
                COUNT(*) as total_oauth_shops,
                SUM(CASE WHEN is_connected = TRUE THEN 1 ELSE 0 END) as connected_shops,
                SUM(CASE WHEN consecutive_refresh_failures > 0 THEN 1 ELSE 0 END) as shops_with_errors,
                SUM(CASE WHEN oauth_token_expires_at <= NOW() + INTERVAL '15 minutes' AND is_connected = TRUE THEN 1 ELSE 0 END) as expiring_soon
            FROM shops
            WHERE connection_type = 'oauth'
        `);
    } catch (err) {
        // Fallback query without optional columns
        if (err.message.includes('no such column')) {
            stats = await query.get(`
                SELECT
                    COUNT(*) as total_oauth_shops,
                    SUM(CASE WHEN is_connected = TRUE THEN 1 ELSE 0 END) as connected_shops,
                    0 as shops_with_errors,
                    SUM(CASE WHEN oauth_token_expires_at <= NOW() + INTERVAL '15 minutes' AND is_connected = TRUE THEN 1 ELSE 0 END) as expiring_soon
                FROM shops
                WHERE connection_type = 'oauth'
            `);
        } else {
            stats = { total_oauth_shops: 0, connected_shops: 0, shops_with_errors: 0, expiring_soon: 0 };
        }
    }

    return {
        running: schedulerInterval !== null,
        isRunning: schedulerInterval !== null,
        intervalMs: REFRESH_INTERVAL_MS,
        bufferMs: TOKEN_EXPIRY_BUFFER_MS,
        maxFailures: MAX_CONSECUTIVE_FAILURES,
        lastRun: lastRun ? new Date(lastRun).toISOString() : null,
        ...stats
    };
}
