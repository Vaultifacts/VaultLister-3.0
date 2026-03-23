// Shops/Connected Platforms Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { logger } from '../shared/logger.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';
import { cacheForUser } from '../middleware/cache.js';

function safeJsonParse(str, fallback = null) {
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function shopsRouter(ctx) {
    const { method, path, body, user } = ctx;
// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

    // GET /api/shops - List connected shops
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const shops = query.all('SELECT * FROM shops WHERE user_id = ?', [user.id]);

            shops.forEach(shop => {
                shop.settings = safeJsonParse(shop.settings, {});
                shop.stats = safeJsonParse(shop.stats, {});
                // Don't expose credentials
                delete shop.credentials;
            });

            return { status: 200, data: { shops }, cacheControl: cacheForUser(60) };
        } catch (error) {
            logger.error('[Shops] Error listing connected shops', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shops/:platform - Get specific shop
    if (method === 'GET' && path.match(/^\/[a-z]+$/)) {
        try {
            const platform = path.slice(1);
            const shop = query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ?',
                [user.id, platform]
            );

            if (!shop) {
                return { status: 404, data: { error: 'Shop not found' } };
            }

            shop.settings = safeJsonParse(shop.settings || '{}', {});
            shop.stats = safeJsonParse(shop.stats || '{}', {});
            delete shop.credentials;

            return { status: 200, data: { shop } };
        } catch (error) {
            logger.error('[Shops] Error fetching shop', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shops - Connect new shop
    if (method === 'POST' && (path === '/' || path === '')) {
        try {
            const { platform, username, credentials } = body;

            if (!platform) {
                return { status: 400, data: { error: 'Platform required' } };
            }

            // Check tier limits
            const permission = checkTierPermission(user, 'platforms');
            if (!permission.allowed) {
                return {
                    status: 403,
                    data: {
                        error: 'Platform limit reached',
                        limit: permission.limit,
                        current: permission.current
                    }
                };
            }

            // Check if already connected
            const existing = query.get(
                'SELECT id FROM shops WHERE user_id = ? AND platform = ?',
                [user.id, platform]
            );

            if (existing) {
                return { status: 409, data: { error: 'Platform already connected' } };
            }

            if (credentials && (typeof credentials !== 'object' || Array.isArray(credentials))) {
                return { status: 400, data: { error: 'Credentials must be an object' } };
            }

            const id = uuidv4();

            query.run(`
                INSERT INTO shops (id, user_id, platform, platform_username, credentials, is_connected)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                id, user.id, platform, username,
                credentials ? encryptToken(JSON.stringify(credentials)) : null,
                1
            ]);

            const shop = query.get('SELECT * FROM shops WHERE id = ?', [id]);
            delete shop.credentials;

            return { status: 201, data: { shop } };
        } catch (error) {
            logger.error('[Shops] Error connecting new shop', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/shops/:platform - Update shop settings
    if (method === 'PUT' && path.match(/^\/[a-z]+$/)) {
        try {
            const platform = path.slice(1);

            const existing = query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ?',
                [user.id, platform]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Shop not found' } };
            }

            const { username, credentials, settings, isConnected, auto_sync_enabled, auto_sync_interval_minutes } = body;

            const updates = [];
            const values = [];

            if (username !== undefined) {
                updates.push('platform_username = ?');
                values.push(username);
            }

            if (credentials !== undefined) {
                updates.push('credentials = ?');
                values.push(encryptToken(JSON.stringify(credentials)));
            }

            if (settings !== undefined) {
                updates.push('settings = ?');
                values.push(JSON.stringify(settings));
            }

            if (isConnected !== undefined) {
                updates.push('is_connected = ?');
                values.push(isConnected ? 1 : 0);
            }

            if (auto_sync_enabled !== undefined) {
                updates.push('auto_sync_enabled = ?');
                values.push(auto_sync_enabled ? 1 : 0);
            }

            if (auto_sync_interval_minutes !== undefined) {
                const interval = parseInt(auto_sync_interval_minutes, 10);
                if (![5, 15, 30, 60].includes(interval)) {
                    return { status: 400, data: { error: 'auto_sync_interval_minutes must be 5, 15, 30, or 60' } };
                }
                updates.push('auto_sync_interval_minutes = ?');
                values.push(interval);
            }

            if (updates.length > 0) {
                values.push(platform, user.id);
                query.run(
                    `UPDATE shops SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
                     WHERE platform = ? AND user_id = ?`,
                    values
                );
            }

            const shop = query.get('SELECT * FROM shops WHERE user_id = ? AND platform = ?', [user.id, platform]);
            shop.settings = safeJsonParse(shop.settings || '{}', {});
            shop.stats = safeJsonParse(shop.stats || '{}', {});
            delete shop.credentials;

            return { status: 200, data: { shop } };
        } catch (error) {
            logger.error('[Shops] Error updating shop settings', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/shops/:platform - Disconnect shop
    if (method === 'DELETE' && path.match(/^\/[a-z]+$/)) {
        try {
            const platform = path.slice(1);

            const existing = query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ?',
                [user.id, platform]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Shop not found' } };
            }

            // Soft disconnect
            query.run(
                'UPDATE shops SET is_connected = 0, credentials = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND platform = ?',
                [user.id, platform]
            );

            return { status: 200, data: { message: 'Shop disconnected' } };
        } catch (error) {
            logger.error('[Shops] Error disconnecting shop', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shops/:platform/sync - Sync shop data
    if (method === 'POST' && path.match(/^\/[a-z]+\/sync$/)) {
        try {
            const platform = path.split('/')[1];

            const shop = query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ? AND is_connected = 1',
                [user.id, platform]
            );

            if (!shop) {
                return { status: 404, data: { error: 'Shop not connected' } };
            }

            // Queue sync task
            const taskId = uuidv4();
            query.run(`
                INSERT INTO tasks (id, user_id, type, payload, status)
                VALUES (?, ?, ?, ?, ?)
            `, [taskId, user.id, 'sync_shop', JSON.stringify({ platform, shopId: shop.id }), 'pending']);

            // Update sync status
            query.run(
                'UPDATE shops SET sync_status = ? WHERE id = ?',
                ['syncing', shop.id]
            );

            return { status: 200, data: { message: 'Sync started', taskId } };
        } catch (error) {
            logger.error('[Shops] Error starting shop sync', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shops/:platform/stats - Get shop statistics
    if (method === 'GET' && path.match(/^\/[a-z]+\/stats$/)) {
        try {
            const platform = path.split('/')[1];

            const shop = query.get(
                'SELECT * FROM shops WHERE user_id = ? AND platform = ?',
                [user.id, platform]
            );

            if (!shop) {
                return { status: 404, data: { error: 'Shop not found' } };
            }

            const stats = {
                listings: query.get(
                    'SELECT COUNT(*) as total, SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active FROM listings WHERE user_id = ? AND platform = ?',
                    [user.id, platform]
                ),
                sales: query.get(
                    'SELECT COUNT(*) as count, SUM(sale_price) as revenue FROM sales WHERE user_id = ? AND platform = ?',
                    [user.id, platform]
                ),
                offers: query.get(
                    'SELECT COUNT(*) as total, SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending FROM offers WHERE user_id = ? AND platform = ?',
                    [user.id, platform]
                )
            };

            return { status: 200, data: { stats } };
        } catch (error) {
            logger.error('[Shops] Error fetching shop statistics', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/shops/sync-all - Sync all connected shops
    if (method === 'POST' && path === '/sync-all') {
        try {
            const shops = query.all(
                'SELECT * FROM shops WHERE user_id = ? AND is_connected = 1',
                [user.id]
            );

            if (shops.length === 0) {
                return { status: 404, data: { error: 'No connected shops found' } };
            }

            const platformsSynced = [];
            const taskIds = [];

            for (const shop of shops) {
                try {
                    // Queue sync task for each platform
                    const taskId = uuidv4();
                    query.run(`
                        INSERT INTO tasks (id, user_id, type, payload, status)
                        VALUES (?, ?, ?, ?, ?)
                    `, [taskId, user.id, 'sync_shop', JSON.stringify({ platform: shop.platform, shopId: shop.id }), 'pending']);

                    // Update sync status
                    query.run(
                        'UPDATE shops SET sync_status = ? WHERE id = ?',
                        ['syncing', shop.id]
                    );

                    platformsSynced.push(shop.platform);
                    taskIds.push(taskId);
                } catch (error) {
                    logger.error(`[Shops] Error syncing ${shop.platform}`, user?.id || null, { detail: error.message });
                }
            }

            return {
                status: 200,
                data: {
                    platforms_synced: platformsSynced,
                    total: platformsSynced.length,
                    status: 'completed',
                    taskIds
                }
            };
        } catch (error) {
            logger.error('[Shops] Error syncing all shops', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shops/health - Platform connection health dashboard
    if (method === 'GET' && path === '/health') {
        try {
            const shops = query.all(
                `SELECT id, platform, platform_username, is_connected, last_sync_at, sync_status,
                    oauth_token_expires_at, consecutive_refresh_failures, last_token_refresh_at,
                    token_refresh_error, connection_type, created_at, updated_at
                FROM shops WHERE user_id = ?`,
                [user.id]
            );

            const health = shops.map(shop => {
                const now = Date.now();
                const tokenExpiry = shop.oauth_token_expires_at ? new Date(shop.oauth_token_expires_at).getTime() : null;
                const lastSync = shop.last_sync_at ? new Date(shop.last_sync_at).getTime() : null;
                const refreshFailures = shop.consecutive_refresh_failures || 0;

                // Calculate health score (0-100)
                let score = 100;
                let issues = [];

                // Token health
                if (shop.connection_type === 'oauth') {
                    if (!tokenExpiry) {
                        score -= 30;
                        issues.push('No OAuth token');
                    } else if (tokenExpiry < now) {
                        score -= 40;
                        issues.push('Token expired');
                    } else if (tokenExpiry - now < 3600000) {
                        score -= 15;
                        issues.push('Token expiring soon');
                    }
                }

                // Refresh failures
                if (refreshFailures >= 5) {
                    score -= 30;
                    issues.push('Auto-disconnected (5+ failures)');
                } else if (refreshFailures >= 3) {
                    score -= 15;
                    issues.push(`${refreshFailures} consecutive refresh failures`);
                }

                // Sync freshness
                if (!lastSync) {
                    score -= 10;
                    issues.push('Never synced');
                } else if (now - lastSync > 86400000 * 7) {
                    score -= 15;
                    issues.push('Last sync > 7 days ago');
                } else if (now - lastSync > 86400000) {
                    score -= 5;
                    issues.push('Last sync > 24h ago');
                }

                // Connection status
                if (!shop.is_connected) {
                    score = Math.min(score, 20);
                    issues.push('Disconnected');
                }

                // Get listing/error counts for this platform
                const listingStats = query.get(
                    `SELECT COUNT(*) as total,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
                    FROM listings WHERE user_id = ? AND platform = ?`,
                    [user.id, shop.platform]
                ) || { total: 0, active: 0, errors: 0 };

                if (listingStats.errors > 0) {
                    score -= Math.min(10, listingStats.errors * 2);
                    issues.push(`${listingStats.errors} listing errors`);
                }

                return {
                    platform: shop.platform,
                    username: shop.platform_username,
                    is_connected: !!shop.is_connected,
                    connection_type: shop.connection_type || 'manual',
                    health_score: Math.max(0, score),
                    status: score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
                    issues,
                    token_expires_at: shop.oauth_token_expires_at,
                    last_sync_at: shop.last_sync_at,
                    sync_status: shop.sync_status || 'idle',
                    refresh_failures: refreshFailures,
                    last_refresh_error: shop.token_refresh_error,
                    listings: listingStats,
                    connected_since: shop.created_at
                };
            });

            const overall = health.length > 0
                ? Math.round(health.reduce((sum, h) => sum + h.health_score, 0) / health.length)
                : 0;

            return { status: 200, data: { platforms: health, overall_health: overall } };
        } catch (error) {
            logger.error('[Shops] Error fetching platform health', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/shops/sync-status - Get sync status for all shops
    if (method === 'GET' && path === '/sync-status') {
        try {
            const shops = query.all(
                'SELECT platform, sync_status, last_sync_at FROM shops WHERE user_id = ?',
                [user.id]
            );

            const syncStatus = shops.map(shop => ({
                platform: shop.platform,
                status: shop.sync_status || 'never_synced',
                last_synced: shop.last_sync_at
            }));

            return { status: 200, data: { shops: syncStatus } };
        } catch (error) {
            logger.error('[Shops] Error fetching sync status', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
