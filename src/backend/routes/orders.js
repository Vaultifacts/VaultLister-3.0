// Orders Routes
// Manages order tracking and fulfillment

import { query } from '../db/database.js';
import { randomInt } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger.js';
import { parsePagination } from '../shared/helpers.js';
import { syncEbayShop } from '../services/platformSync/ebaySync.js';

const ALLOWED_ORDER_FIELDS = new Set(['priority', 'priority_note']);
const ALLOWED_RETURN_FIELDS = new Set(['return_status', 'return_tracking']);

// Cryptographically secure random helpers (replaces Math.random())
function secureRandomInt(max) {
    return randomInt(max);
}
function secureRandomFloat() {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000;
}

// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

// SECURITY: Status state machine — only allow valid forward/reverse transitions.
// Prevents e.g. jumping from 'pending' straight to 'completed' or re-opening
// a 'refunded' order.
const VALID_TRANSITIONS = {
    pending:   ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped:   ['delivered', 'returned'],
    delivered: ['returned', 'completed'],
    returned:  ['refunded'],
    completed: [],
    cancelled: [],
    refunded:  []
};

function isValidStatusTransition(currentStatus, newStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed) return false; // unknown current status — deny
    return allowed.includes(newStatus);
}

/**
 * Orders router - handles order management
 */
export async function ordersRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Require authentication for all routes
    if (!user) {
        return {
            status: 401,
            data: { error: 'Authentication required' }
        };
    }

    // GET /api/orders - List all orders (pending and shipped by default)
    if (method === 'GET' && (path === '' || path === '/')) {
        const { status, platform, search, include_delivered } = queryParams;

        try {
            const { limit, offset } = parsePagination(queryParams, { maxLimit: 200, limit: 50 });

            // Helper function to escape ILIKE wildcards
            const escapeLike = (str) => {
                return str.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
            };

            // Count total matching orders first
            let countSql = `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`;
            const countParams = [user.id];

            // By default, only show pending and shipped orders
            // Use include_delivered=true to see all (case-insensitive)
            if (include_delivered?.toLowerCase() !== 'true') {
                countSql += ` AND status IN ('pending', 'confirmed', 'shipped')`;
            }

            if (status && status !== 'all') {
                countSql += ` AND status = ?`;
                countParams.push(status);
            }

            if (platform && platform !== 'all') {
                countSql += ` AND platform = ?`;
                countParams.push(platform);
            }

            if (search) {
                countSql += ` AND (buyer_username ILIKE ? ESCAPE '\\' OR item_title ILIKE ? ESCAPE '\\' OR tracking_number ILIKE ? ESCAPE '\\' OR order_number ILIKE ? ESCAPE '\\')`;
                const escapedSearch = escapeLike(search);
                const searchPattern = `%${escapedSearch}%`;
                countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
            }

            const { total } = await query.get(countSql, countParams);

            // Now fetch paginated results
            let sql = `SELECT * FROM orders WHERE user_id = ?`;
            const params = [user.id];

            if (include_delivered?.toLowerCase() !== 'true') {
                sql += ` AND status IN ('pending', 'confirmed', 'shipped')`;
            }

            if (status && status !== 'all') {
                sql += ` AND status = ?`;
                params.push(status);
            }

            if (platform && platform !== 'all') {
                sql += ` AND platform = ?`;
                params.push(platform);
            }

            if (search) {
                sql += ` AND (buyer_username ILIKE ? ESCAPE '\\' OR item_title ILIKE ? ESCAPE '\\' OR tracking_number ILIKE ? ESCAPE '\\' OR order_number ILIKE ? ESCAPE '\\')`;
                const escapedSearch = escapeLike(search);
                const searchPattern = `%${escapedSearch}%`;
                params.push(searchPattern, searchPattern, searchPattern, searchPattern);
            }

            sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const orders = await query.all(sql, params);

            // Count stats from full database (not paginated results)
            const statsRow = await query.get(`
                SELECT
                    COUNT(*) as total_all,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                    SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped,
                    SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                    COALESCE(SUM(sale_price), 0) as total_value
                FROM orders WHERE user_id = ?
            `, [user.id]);
            const stats = {
                total,
                total_all: statsRow?.total_all || 0,
                pending: statsRow?.pending || 0,
                confirmed: statsRow?.confirmed || 0,
                shipped: statsRow?.shipped || 0,
                delivered: statsRow?.delivered || 0,
                cancelled: statsRow?.cancelled || 0,
                total_value: statsRow?.total_value || 0
            };

            return {
                status: 200,
                data: { orders, stats, total, limit, offset }
            };
        } catch (error) {
            logger.error('[Orders] error fetching orders', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch orders' }
            };
        }
    }

    // GET /api/orders/:id - Get single order
    if (method === 'GET' && path.match(/^\/[^/]+$/)) {
        const orderId = path.slice(1);

        try {
            const order = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!order) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            return {
                status: 200,
                data: { order }
            };
        } catch (error) {
            logger.error('[Orders] error fetching order', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch order' }
            };
        }
    }

    // POST /api/orders - Create new order
    if (method === 'POST' && (path === '' || path === '/')) {
        const {
            order_number,
            platform,
            buyer_username,
            buyer_email,
            buyer_address,
            item_id,
            item_title,
            item_sku,
            sale_price,
            shipping_cost,
            platform_fee,
            shipping_provider,
            expected_delivery,
            notes,
            priority,
            priority_note
        } = body;

        // Validation
        if (!platform || !item_title) {
            return {
                status: 400,
                data: { error: 'Platform and item title are required' }
            };
        }

        // Validate priority if provided
        if (priority && !['low', 'normal', 'high', 'urgent'].includes(priority)) {
            return {
                status: 400,
                data: { error: 'Priority must be one of: low, normal, high, urgent' }
            };
        }

        // Validate string length limits
        const MAX_FIELD_LENGTH = 1000;
        const MAX_NOTES_LENGTH = 5000;
        if (buyer_username && buyer_username.length > MAX_FIELD_LENGTH) {
            return { status: 400, data: { error: 'Buyer username exceeds maximum length' } };
        }
        if (buyer_email && buyer_email.length > MAX_FIELD_LENGTH) {
            return { status: 400, data: { error: 'Buyer email exceeds maximum length' } };
        }
        if (buyer_address && buyer_address.length > MAX_FIELD_LENGTH) {
            return { status: 400, data: { error: 'Buyer address exceeds maximum length' } };
        }
        if (item_title && item_title.length > 500) {
            return { status: 400, data: { error: 'Item title exceeds maximum length' } };
        }
        if (notes && notes.length > MAX_NOTES_LENGTH) {
            return { status: 400, data: { error: 'Notes exceed maximum length' } };
        }

        try {
            const orderId = uuidv4();
            const now = new Date().toISOString();

            await query.run(`
                INSERT INTO orders (
                    id, user_id, order_number, platform, status,
                    buyer_username, buyer_email, buyer_address,
                    item_id, item_title, item_sku, sale_price,
                    shipping_cost, platform_fee, shipping_provider,
                    expected_delivery, notes, priority, priority_note,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                orderId, user.id, order_number || `ORD-${Date.now()}`, platform,
                buyer_username || null, buyer_email || null, buyer_address || null,
                item_id || null, item_title, item_sku || null, sale_price || 0,
                shipping_cost || 0, platform_fee || 0, shipping_provider || null,
                expected_delivery || null, notes || null, priority || 'normal', priority_note || null,
                now, now
            ]);

            const order = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);

            return {
                status: 201,
                data: { order, message: 'Order created successfully' }
            };
        } catch (error) {
            logger.error('[Orders] error creating order', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to create order' }
            };
        }
    }

    // PUT /api/orders/:id - Update order
    if (method === 'PUT' && path.match(/^\/[^/]+$/)) {
        const orderId = path.slice(1);

        try {
            const existing = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!existing) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            const {
                status,
                tracking_number,
                shipping_provider,
                shipping_label_url,
                expected_delivery,
                notes,
                priority,
                priority_note
            } = body;

            const updates = [];
            const params = [];

            if (status !== undefined) {
                // SECURITY: Enforce state machine — reject invalid status transitions.
                if (status !== existing.status && !isValidStatusTransition(existing.status, status)) {
                    return {
                        status: 400,
                        data: {
                            error: `Invalid status transition from '${existing.status}' to '${status}'. ` +
                                   `Allowed next statuses: ${(VALID_TRANSITIONS[existing.status] || []).join(', ') || 'none'}`
                        }
                    };
                }

                updates.push('status = ?');
                params.push(status);

                // Auto-set shipped_at when status changes to shipped
                if (status === 'shipped' && existing.status !== 'shipped') {
                    updates.push('shipped_at = ?');
                    params.push(new Date().toISOString());
                }

                // Auto-set delivered_at when status changes to delivered
                if (status === 'delivered' && existing.status !== 'delivered') {
                    updates.push('delivered_at = ?');
                    params.push(new Date().toISOString());
                }
            }

            if (tracking_number !== undefined) {
                updates.push('tracking_number = ?');
                params.push(tracking_number);
            }

            if (shipping_provider !== undefined) {
                updates.push('shipping_provider = ?');
                params.push(shipping_provider);
            }

            if (shipping_label_url !== undefined) {
                updates.push('shipping_label_url = ?');
                params.push(shipping_label_url);
            }

            if (expected_delivery !== undefined) {
                updates.push('expected_delivery = ?');
                params.push(expected_delivery);
            }

            if (notes !== undefined) {
                updates.push('notes = ?');
                params.push(notes);
            }

            if (priority !== undefined) {
                // Validate priority
                if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
                    return {
                        status: 400,
                        data: { error: 'Priority must be one of: low, normal, high, urgent' }
                    };
                }
                updates.push('priority = ?');
                params.push(priority);
            }

            if (priority_note !== undefined) {
                updates.push('priority_note = ?');
                params.push(priority_note);
            }

            if (updates.length === 0) {
                return {
                    status: 400,
                    data: { error: 'No updates provided' }
                };
            }

            updates.push('updated_at = ?');
            params.push(new Date().toISOString());
            params.push(orderId);

            params.push(user.id);
            await query.run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

            const order = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);

            return {
                status: 200,
                data: { order, message: 'Order updated successfully' }
            };
        } catch (error) {
            logger.error('[Orders] error updating order', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update order' }
            };
        }
    }

    // POST /api/orders/:id/ship - Mark order as shipped
    if (method === 'POST' && path.match(/^\/[^/]+\/ship$/)) {
        const orderId = path.split('/')[1];
        const { tracking_number, shipping_provider } = body;

        try {
            const existing = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!existing) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            // Validate status transition — only pending/processing orders can be shipped
            if (!['pending', 'processing', 'confirmed'].includes(existing.status)) {
                return {
                    status: 400,
                    data: { error: `Cannot ship order with status '${existing.status}'` }
                };
            }

            const now = new Date().toISOString();

            await query.run(`
                UPDATE orders SET
                    status = 'shipped',
                    tracking_number = COALESCE(?, tracking_number),
                    shipping_provider = COALESCE(?, shipping_provider),
                    shipped_at = ?,
                    updated_at = ?
                WHERE id = ? AND user_id = ?
            `, [tracking_number, shipping_provider, now, now, orderId, user.id]);

            const order = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);

            return {
                status: 200,
                data: { order, message: 'Order marked as shipped' }
            };
        } catch (error) {
            logger.error('[Orders] error shipping order', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to ship order' }
            };
        }
    }

    // POST /api/orders/:id/deliver - Mark order as delivered
    if (method === 'POST' && path.match(/^\/[^/]+\/deliver$/)) {
        const orderId = path.split('/')[1];

        try {
            const existing = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!existing) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            // Validate status transition — only shipped orders can be delivered
            if (existing.status !== 'shipped') {
                return {
                    status: 400,
                    data: { error: `Cannot mark order as delivered with status '${existing.status}'` }
                };
            }

            const now = new Date().toISOString();

            await query.run(`
                UPDATE orders SET
                    status = 'delivered',
                    delivered_at = ?,
                    actual_delivery = ?,
                    updated_at = ?
                WHERE id = ? AND user_id = ?
            `, [now, now.split('T')[0], now, orderId, user.id]);

            const order = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);

            return {
                status: 200,
                data: { order, message: 'Order marked as delivered' }
            };
        } catch (error) {
            logger.error('[Orders] error marking order delivered', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to mark order as delivered' }
            };
        }
    }

    // DELETE /api/orders/:id - Delete order
    if (method === 'DELETE' && path.match(/^\/[^/]+$/)) {
        const orderId = path.slice(1);

        try {
            const result = await query.run(
                `DELETE FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (result.changes === 0) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            return {
                status: 200,
                data: { message: 'Order deleted successfully' }
            };
        } catch (error) {
            logger.error('[Orders] error deleting order', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to delete order' }
            };
        }
    }

    // POST /api/orders/:id/return - Initiate a return
    if (method === 'POST' && path.match(/^\/[^/]+\/return$/)) {
        const orderId = path.split('/')[1];

        try {
            const order = await query.get(
                'SELECT * FROM orders WHERE id = ? AND user_id = ?',
                [orderId, user.id]
            );

            if (!order) {
                return { status: 404, data: { error: 'Order not found' } };
            }

            const { return_reason, refund_amount, return_tracking } = body;

            if (!return_reason) {
                return { status: 400, data: { error: 'Return reason is required' } };
            }

            await query.run(
                `UPDATE orders SET return_status = 'requested', return_reason = ?, refund_amount = ?, return_tracking = ?, return_requested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                [return_reason, refund_amount || null, return_tracking || null, orderId, user.id]
            );

            const updated = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);
            return { status: 200, data: { order: updated, message: 'Return initiated successfully' } };
        } catch (error) {
            logger.error('[Orders] error initiating return', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to initiate return' } };
        }
    }

    // PATCH /api/orders/:id/return - Update return status
    if (method === 'PATCH' && path.match(/^\/[^/]+\/return$/)) {
        const orderId = path.split('/')[1];

        try {
            const order = await query.get(
                'SELECT * FROM orders WHERE id = ? AND user_id = ?',
                [orderId, user.id]
            );

            if (!order) {
                return { status: 404, data: { error: 'Order not found' } };
            }

            const { return_status, return_tracking } = body;
            const validStatuses = ['requested', 'approved', 'shipped_back', 'received', 'refunded', 'cancelled'];

            if (!return_status || !validStatuses.includes(return_status)) {
                return { status: 400, data: { error: 'Invalid return status' } };
            }

            const updates = ['return_status = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const params = [return_status];

            if (return_tracking) {
                updates.push('return_tracking = ?');
                params.push(return_tracking);
            }

            if (return_status === 'refunded') {
                updates.push('refund_processed_at = CURRENT_TIMESTAMP');
            }

            params.push(orderId);
            params.push(user.id);
            await query.run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);

            const updated = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);
            return { status: 200, data: { order: updated, message: 'Return status updated' } };
        } catch (error) {
            logger.error('[Orders] error updating return', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to update return status' } };
        }
    }

    // POST /api/orders/sync-all - Sync orders from all connected platforms
    if (method === 'POST' && path === '/sync-all') {
        try {
            // Find all connected shops for this user
            const shops = await query.all(
                'SELECT id, platform FROM shops WHERE user_id = ? AND is_connected = 1',
                [user.id]
            );

            if (shops.length === 0) {
                return {
                    status: 200,
                    data: {
                        message: 'No connected platforms found. Connect a marketplace in My Shops to sync orders.',
                        platformsSynced: 0,
                        newOrders: 0
                    }
                };
            }

            // Queue a sync task for each connected shop
            const { queueTask } = await import('../workers/taskWorker.js');
            const queuedTasks = [];

            for (const shop of shops) {
                const task = queueTask('sync_shop', {
                    shopId: shop.id,
                    userId: user.id
                });
                queuedTasks.push({ platform: shop.platform, taskId: task.id });
            }

            return {
                status: 200,
                data: {
                    message: `Queued order sync for ${shops.length} connected platform(s). Results will appear shortly.`,
                    platformsSynced: shops.length,
                    tasks: queuedTasks
                }
            };
        } catch (error) {
            logger.error('[Orders] error syncing orders', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to sync orders' }
            };
        }
    }

    // POST /api/orders/sync/:platform - Sync orders from specific platform
    if (method === 'POST' && path.match(/^\/sync\/[a-z]+$/)) {
        const platform = path.split('/')[2];

        try {
            if (platform === 'ebay') {
                const shop = await query.get(
                    "SELECT * FROM shops WHERE user_id = ? AND platform = 'ebay' AND is_connected = 1",
                    [user.id]
                );
                if (!shop) {
                    return { status: 400, data: { error: 'No connected eBay shop. Connect eBay in Settings → My Shops first.' } };
                }
                const result = await syncEbayShop(shop);
                return {
                    status: 200,
                    data: {
                        message: `eBay sync complete`,
                        platform: 'ebay',
                        newOrders: result.orders.created,
                        listings: result.listings,
                        orders: result.orders
                    }
                };
            }

            // Other platforms: not yet integrated
            return {
                status: 200,
                data: {
                    message: `${platform} order sync not yet integrated`,
                    platform,
                    newOrders: 0
                }
            };
        } catch (error) {
            logger.error('[Orders] error syncing platform orders', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to sync orders from ' + platform }
            };
        }
    }

    // PATCH /api/orders/:id/priority - Update order priority
    if (method === 'PATCH' && path.match(/^\/[^/]+\/priority$/)) {
        const orderId = path.split('/')[1];

        try {
            const existing = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!existing) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            const { priority, priority_note } = body;

            // Validate priority
            if (!priority || !['low', 'normal', 'high', 'urgent'].includes(priority)) {
                return {
                    status: 400,
                    data: { error: 'Priority must be one of: low, normal, high, urgent' }
                };
            }

            const now = new Date().toISOString();

            await query.run(`
                UPDATE orders SET
                    priority = ?,
                    priority_note = ?,
                    updated_at = ?
                WHERE id = ? AND user_id = ?
            `, [priority, priority_note || null, now, orderId, user.id]);

            const order = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);

            return {
                status: 200,
                data: { order, message: 'Order priority updated successfully' }
            };
        } catch (error) {
            logger.error('[Orders] error updating order priority', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update order priority' }
            };
        }
    }

    // POST /api/orders/:id/split - Split order into multiple shipments
    if (method === 'POST' && path.match(/^\/[^/]+\/split$/)) {
        const orderId = path.split('/')[1];

        try {
            const existing = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!existing) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            // Check if already split
            if (existing.is_split_shipment) {
                return {
                    status: 400,
                    data: { error: 'Order has already been split' }
                };
            }

            const { shipment_count } = body;

            // Validate shipment count
            if (!shipment_count || shipment_count < 2 || shipment_count > 10) {
                return {
                    status: 400,
                    data: { error: 'Shipment count must be between 2 and 10' }
                };
            }

            const now = new Date().toISOString();

            // Wrap split in transaction for atomicity
            const { parent, childOrders } = await query.transaction(async () => {
                // Mark parent as split
                await query.run(`
                    UPDATE orders SET
                        is_split_shipment = 1,
                        total_shipments = ?,
                        updated_at = ?
                    WHERE id = ? AND user_id = ?
                `, [shipment_count, now, orderId, user.id]);

                // Create child shipment orders
                const children = [];
                for (let i = 1; i <= shipment_count; i++) {
                    const childId = uuidv4();

                    await query.run(`
                        INSERT INTO orders (
                            id, user_id, order_number, platform, status,
                            buyer_username, buyer_email, buyer_address,
                            item_id, item_title, item_sku,
                            shipping_provider, expected_delivery,
                            parent_order_id, shipment_number, total_shipments,
                            priority, priority_note,
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        childId,
                        user.id,
                        `${existing.order_number}-SHIP${i}`,
                        existing.platform,
                        'pending',
                        existing.buyer_username,
                        existing.buyer_email,
                        existing.buyer_address,
                        existing.item_id,
                        `${existing.item_title} (Shipment ${i}/${shipment_count})`,
                        existing.item_sku,
                        existing.shipping_provider,
                        existing.expected_delivery,
                        orderId,
                        i,
                        shipment_count,
                        existing.priority,
                        existing.priority_note,
                        now,
                        now
                    ]);

                    const child = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [childId, user.id]);
                    children.push(child);
                }

                const p = await query.get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, user.id]);
                return { parent: p, childOrders: children };
            });

            return {
                status: 200,
                data: {
                    parent,
                    shipments: childOrders,
                    message: `Order split into ${shipment_count} shipments successfully`
                }
            };
        } catch (error) {
            logger.error('[Orders] error splitting order', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to split order' }
            };
        }
    }

    // GET /api/orders/:id/shipments - Get child shipments for a split order
    if (method === 'GET' && path.match(/^\/[^/]+\/shipments$/)) {
        const orderId = path.split('/')[1];

        try {
            const parent = await query.get(
                `SELECT * FROM orders WHERE id = ? AND user_id = ?`,
                [orderId, user.id]
            );

            if (!parent) {
                return {
                    status: 404,
                    data: { error: 'Order not found' }
                };
            }

            if (!parent.is_split_shipment) {
                return {
                    status: 400,
                    data: { error: 'Order has not been split into shipments' }
                };
            }

            const shipments = await query.all(
                `SELECT * FROM orders WHERE parent_order_id = ? AND user_id = ? ORDER BY shipment_number ASC`,
                [orderId, user.id]
            );

            return {
                status: 200,
                data: {
                    parent,
                    shipments,
                    total: shipments.length
                }
            };
        } catch (error) {
            logger.error('[Orders] error fetching shipments', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch shipments' }
            };
        }
    }

    return {
        status: 404,
        data: { error: 'Route not found' }
    };
}
