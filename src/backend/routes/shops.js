// Shops/Connected Platforms Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { logger } from '../shared/logger.js';

export async function shopsRouter(ctx) {
    const { method, path, body, user } = ctx;
// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

    // GET /api/shops - List connected shops
    if (method === 'GET' && (path === '/' || path === '')) {
        try {
            const shops = query.all('SELECT * FROM shops WHERE user_id = ?', [user.id]);

            shops.forEach(shop => {
                shop.settings = JSON.parse(shop.settings || '{}');
                shop.stats = JSON.parse(shop.stats || '{}');
                // Don't expose credentials
                delete shop.credentials;
            });

            return { status: 200, data: { shops } };
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

            shop.settings = JSON.parse(shop.settings || '{}');
            shop.stats = JSON.parse(shop.stats || '{}');
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
                credentials ? JSON.stringify(credentials) : null,
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

            const { username, credentials, settings, isConnected } = body;

            const updates = [];
            const values = [];

            if (username !== undefined) {
                updates.push('platform_username = ?');
                values.push(username);
            }

            if (credentials !== undefined) {
                updates.push('credentials = ?');
                values.push(JSON.stringify(credentials));
            }

            if (settings !== undefined) {
                updates.push('settings = ?');
                values.push(JSON.stringify(settings));
            }

            if (isConnected !== undefined) {
                updates.push('is_connected = ?');
                values.push(isConnected ? 1 : 0);
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
            shop.settings = JSON.parse(shop.settings || '{}');
            shop.stats = JSON.parse(shop.stats || '{}');
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
