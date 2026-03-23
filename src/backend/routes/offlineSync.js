// Offline Sync Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Allowed columns per table for offline sync (prevents SQL injection via dynamic keys)
const ALLOWED_SYNC_COLUMNS = {
    inventory: ['id', 'sku', 'title', 'description', 'brand', 'category', 'subcategory', 'size', 'color', 'condition', 'cost_price', 'list_price', 'quantity', 'low_stock_threshold', 'weight', 'dimensions', 'material', 'tags', 'images', 'thumbnail_url', 'status', 'location', 'notes', 'custom_fields'],
    listings: ['id', 'inventory_id', 'platform', 'platform_listing_id', 'platform_url', 'title', 'description', 'price', 'original_price', 'shipping_price', 'category_path', 'condition_tag', 'status', 'images', 'platform_specific_data', 'listed_at', 'notes'],
    orders: ['id', 'order_number', 'platform', 'status', 'buyer_username', 'buyer_email', 'buyer_address', 'item_id', 'item_title', 'item_sku', 'sale_price', 'shipping_cost', 'platform_fee', 'tracking_number', 'shipping_provider', 'shipping_label_url', 'expected_delivery', 'actual_delivery', 'notes', 'shipped_at', 'delivered_at']
};

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

function sanitizeSyncPayload(payload, table) {
    const allowed = ALLOWED_SYNC_COLUMNS[table];
    if (!allowed) return {};
    const clean = {};
    for (const [k, v] of Object.entries(payload)) {
        if (allowed.includes(k)) clean[k] = v;
    }
    return clean;
}

export async function offlineSyncRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/offline/queue - List pending sync items
    if (method === 'GET' && path === '/queue') {
        try {
            const { status: queueStatus } = queryParams;

            let sql = 'SELECT * FROM offline_sync_queue WHERE user_id = ?';
            const params = [user.id];

            if (queueStatus) {
                sql += ' AND status = ?';
                params.push(queueStatus);
            }

            sql += ' ORDER BY created_at ASC LIMIT 1000';

            const queue = query.all(sql, params);

            // Parse payload JSON for each item
            const enrichedQueue = queue.map(item => ({
                ...item,
                payload: safeJsonParse(item.payload, null)
            }));

            return { status: 200, data: enrichedQueue };
        } catch (error) {
            logger.error('[OfflineSync] Get queue error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to load sync queue' } };
        }
    }

    // POST /api/offline/queue - Add item to sync queue
    if (method === 'POST' && path === '/queue') {
        try {
            const { action, entity_type, entity_id, payload } = body;

            if (!action) {
                return { status: 400, data: { error: 'action required (create, update, delete)' } };
            }

            if (!entity_type) {
                return { status: 400, data: { error: 'entity_type required (inventory, listing, order, etc.)' } };
            }

            const validActions = ['create', 'update', 'delete'];
            if (!validActions.includes(action)) {
                return { status: 400, data: { error: `Invalid action. Must be: ${validActions.join(', ')}` } };
            }

            const id = uuidv4();

            query.run(
                `INSERT INTO offline_sync_queue
                (id, user_id, action, entity_type, entity_id, payload, status)
                VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [id, user.id, action, entity_type, entity_id || null, payload ? JSON.stringify(payload) : null]
            );

            const queueItem = query.get('SELECT * FROM offline_sync_queue WHERE id = ?', [id]);

            return {
                status: 201,
                data: {
                    ...queueItem,
                    payload: safeJsonParse(queueItem.payload, null)
                }
            };
        } catch (error) {
            logger.error('[OfflineSync] Add to queue error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to add to sync queue' } };
        }
    }

    // POST /api/offline/sync - Process all pending queue items
    if (method === 'POST' && path === '/sync') {
        try {
            const pendingItems = query.all(
                'SELECT * FROM offline_sync_queue WHERE user_id = ? AND status = ? ORDER BY created_at ASC',
                [user.id, 'pending']
            );

            let synced = 0;
            let failed = 0;
            const errors = [];

            for (const item of pendingItems) {
                try {
                    const payload = safeJsonParse(item.payload, {});

                    // Execute the corresponding action
                    switch (item.entity_type) {
                        case 'inventory':
                            await syncInventoryItem(item, payload, user.id);
                            break;
                        case 'listing':
                            await syncListingItem(item, payload, user.id);
                            break;
                        case 'order':
                            await syncOrderItem(item, payload, user.id);
                            break;
                        default:
                            throw new Error(`Unsupported entity_type: ${item.entity_type}`);
                    }

                    // Mark as synced
                    query.run(
                        'UPDATE offline_sync_queue SET status = ?, synced_at = CURRENT_TIMESTAMP WHERE id = ?',
                        ['synced', item.id]
                    );

                    synced++;
                } catch (syncError) {
                    // Mark as failed
                    query.run(
                        'UPDATE offline_sync_queue SET status = ?, error_message = ? WHERE id = ?',
                        ['failed', syncError.message, item.id]
                    );

                    failed++;
                    errors.push({
                        queue_id: item.id,
                        entity_type: item.entity_type,
                        action: item.action,
                        error: syncError.message
                    });
                }
            }

            return {
                status: 200,
                data: {
                    message: 'Sync completed',
                    synced,
                    failed,
                    total: pendingItems.length,
                    errors: errors.length > 0 ? errors : undefined
                }
            };
        } catch (error) {
            logger.error('[OfflineSync] Sync error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to process sync queue' } };
        }
    }

    // DELETE /api/offline/queue/:id - Remove item from queue
    if (method === 'DELETE' && path.match(/^\/queue\/[a-f0-9-]+$/)) {
        try {
            const queueId = path.split('/')[2];

            const existing = query.get(
                'SELECT id FROM offline_sync_queue WHERE id = ? AND user_id = ?',
                [queueId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Queue item not found' } };
            }

            query.run('DELETE FROM offline_sync_queue WHERE id = ? AND user_id = ?', [queueId, user.id]);

            return { status: 200, data: { message: 'Queue item removed' } };
        } catch (error) {
            logger.error('[OfflineSync] Delete queue item error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to remove queue item' } };
        }
    }

    // GET /api/offline/status - Overall sync status
    if (method === 'GET' && path === '/status') {
        try {
            const pendingCount = query.get(
                'SELECT COUNT(*) as count FROM offline_sync_queue WHERE user_id = ? AND status = ?',
                [user.id, 'pending']
            );

            const failedCount = query.get(
                'SELECT COUNT(*) as count FROM offline_sync_queue WHERE user_id = ? AND status = ?',
                [user.id, 'failed']
            );

            const lastSync = query.get(
                'SELECT MAX(synced_at) as last_sync FROM offline_sync_queue WHERE user_id = ? AND status = ?',
                [user.id, 'synced']
            );

            return {
                status: 200,
                data: {
                    pending_count: pendingCount?.count || 0,
                    failed_count: failedCount?.count || 0,
                    last_sync_at: lastSync?.last_sync || null,
                    is_online: true // Client determines this
                }
            };
        } catch (error) {
            logger.error('[OfflineSync] Get status error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to load sync status' } };
        }
    }

    // POST /api/offline/manifest - Return PWA manifest data and notification badge count
    if (method === 'POST' && path === '/manifest') {
        try {
            // Count pending orders
            const pendingOrders = query.get(
                'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = ?',
                [user.id, 'pending']
            );

            // Count low stock items
            const lowStock = query.get(
                `SELECT COUNT(*) as count FROM inventory
                WHERE user_id = ? AND quantity > 0 AND quantity <= low_stock_threshold`,
                [user.id]
            );

            // Count upcoming events (next 7 days)
            const upcomingEvents = query.get(
                `SELECT COUNT(*) as count FROM calendar_events
                WHERE user_id = ? AND start_time > datetime('now')
                AND start_time <= datetime('now', '+7 days')`,
                [user.id]
            );

            const badgeCount = (pendingOrders?.count || 0) + (lowStock?.count || 0) + (upcomingEvents?.count || 0);

            const notifications = [];

            if (pendingOrders?.count > 0) {
                notifications.push({
                    type: 'pending_orders',
                    count: pendingOrders.count,
                    message: `${pendingOrders.count} pending order${pendingOrders.count > 1 ? 's' : ''}`
                });
            }

            if (lowStock?.count > 0) {
                notifications.push({
                    type: 'low_stock',
                    count: lowStock.count,
                    message: `${lowStock.count} low stock alert${lowStock.count > 1 ? 's' : ''}`
                });
            }

            if (upcomingEvents?.count > 0) {
                notifications.push({
                    type: 'upcoming_events',
                    count: upcomingEvents.count,
                    message: `${upcomingEvents.count} upcoming event${upcomingEvents.count > 1 ? 's' : ''}`
                });
            }

            return {
                status: 200,
                data: {
                    badge_count: badgeCount,
                    notifications,
                    manifest: {
                        name: 'VaultLister',
                        short_name: 'VaultLister',
                        description: 'Reselling management platform',
                        start_url: '/',
                        display: 'standalone',
                        background_color: '#1f2937',
                        theme_color: '#6366f1',
                        icons: [
                            {
                                src: '/assets/icon-192.png',
                                sizes: '192x192',
                                type: 'image/png'
                            },
                            {
                                src: '/assets/icon-512.png',
                                sizes: '512x512',
                                type: 'image/png'
                            }
                        ]
                    }
                }
            };
        } catch (error) {
            logger.error('[OfflineSync] Manifest error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to generate manifest' } };
        }
    }

    return { status: 404, data: { error: 'Offline Sync endpoint not found' } };
}

// Helper functions to sync different entity types
async function syncInventoryItem(item, payload, userId) {
    payload = sanitizeSyncPayload(payload, 'inventory');
    switch (item.action) {
        case 'create':
            if (!payload.id) payload.id = uuidv4();
            const keys = Object.keys(payload);
            const values = Object.values(payload);
            const placeholders = keys.map(() => '?').join(', ');
            query.run(
                `INSERT INTO inventory (${keys.join(', ')}, user_id) VALUES (${placeholders}, ?)`,
                [...values, userId]
            );
            break;

        case 'update':
            if (!item.entity_id) throw new Error('entity_id required for update');
            const updateKeys = Object.keys(payload);
            if (updateKeys.length === 0) throw new Error('No valid fields to update');
            const updateValues = Object.values(payload);
            const set = updateKeys.map(k => `${k} = ?`).join(', ');
            query.run(
                `UPDATE inventory SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                [...updateValues, item.entity_id, userId]
            );
            break;

        case 'delete':
            if (!item.entity_id) throw new Error('entity_id required for delete');
            query.run('DELETE FROM inventory WHERE id = ? AND user_id = ?', [item.entity_id, userId]);
            break;

        default:
            throw new Error(`Unsupported action: ${item.action}`);
    }
}

async function syncListingItem(item, payload, userId) {
    payload = sanitizeSyncPayload(payload, 'listings');
    switch (item.action) {
        case 'create':
            if (!payload.id) payload.id = uuidv4();
            const keys = Object.keys(payload);
            const values = Object.values(payload);
            const placeholders = keys.map(() => '?').join(', ');
            query.run(
                `INSERT INTO listings (${keys.join(', ')}, user_id) VALUES (${placeholders}, ?)`,
                [...values, userId]
            );
            break;

        case 'update':
            if (!item.entity_id) throw new Error('entity_id required for update');
            const updateKeys = Object.keys(payload);
            if (updateKeys.length === 0) throw new Error('No valid fields to update');
            const updateValues = Object.values(payload);
            const set = updateKeys.map(k => `${k} = ?`).join(', ');
            query.run(
                `UPDATE listings SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                [...updateValues, item.entity_id, userId]
            );
            break;

        case 'delete':
            if (!item.entity_id) throw new Error('entity_id required for delete');
            query.run('DELETE FROM listings WHERE id = ? AND user_id = ?', [item.entity_id, userId]);
            break;

        default:
            throw new Error(`Unsupported action: ${item.action}`);
    }
}

async function syncOrderItem(item, payload, userId) {
    payload = sanitizeSyncPayload(payload, 'orders');
    switch (item.action) {
        case 'create':
            if (!payload.id) payload.id = uuidv4();
            const keys = Object.keys(payload);
            const values = Object.values(payload);
            const placeholders = keys.map(() => '?').join(', ');
            query.run(
                `INSERT INTO orders (${keys.join(', ')}, user_id) VALUES (${placeholders}, ?)`,
                [...values, userId]
            );
            break;

        case 'update':
            if (!item.entity_id) throw new Error('entity_id required for update');
            const updateKeys = Object.keys(payload);
            if (updateKeys.length === 0) throw new Error('No valid fields to update');
            const updateValues = Object.values(payload);
            const set = updateKeys.map(k => `${k} = ?`).join(', ');
            query.run(
                `UPDATE orders SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                [...updateValues, item.entity_id, userId]
            );
            break;

        case 'delete':
            if (!item.entity_id) throw new Error('entity_id required for delete');
            query.run('DELETE FROM orders WHERE id = ? AND user_id = ?', [item.entity_id, userId]);
            break;

        default:
            throw new Error(`Unsupported action: ${item.action}`);
    }
}
