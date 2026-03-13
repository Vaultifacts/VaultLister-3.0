// Whatnot Enhanced Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { requireFeature } from '../middleware/featureFlags.js';

export async function whatnotEnhancedRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Feature flag gate (REM-17)
    if (requireFeature('FEATURE_WHATNOT_INTEGRATION', ctx)) return ctx.res;

    // GET /api/whatnot-enhanced/cohosts - List co-hosts for user's events
    if (method === 'GET' && path === '/cohosts') {
        try {
            const { event_id } = queryParams;

            let sql = `SELECT wc.*, we.title as event_title, we.start_time
                      FROM whatnot_cohosts wc
                      LEFT JOIN whatnot_events we ON wc.event_id = we.id
                      WHERE wc.user_id = ?`;
            const params = [user.id];

            if (event_id) {
                sql += ' AND wc.event_id = ?';
                params.push(event_id);
            }

            sql += ' ORDER BY wc.created_at DESC LIMIT 500';

            const cohosts = query.all(sql, params);

            return { status: 200, data: cohosts };
        } catch (error) {
            logger.error('[Whatnot] Get cohosts error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load co-hosts' } };
        }
    }

    // POST /api/whatnot-enhanced/cohosts - Add co-host to event
    if (method === 'POST' && path === '/cohosts') {
        try {
            const { event_id, cohost_name, role, revenue_split, notes } = body;

            if (!event_id) {
                return { status: 400, data: { error: 'event_id required' } };
            }

            if (!cohost_name || !cohost_name.trim()) {
                return { status: 400, data: { error: 'cohost_name required' } };
            }

            // Verify event exists and belongs to user
            const event = query.get(
                'SELECT id FROM whatnot_events WHERE id = ? AND user_id = ?',
                [event_id, user.id]
            );

            if (!event) {
                return { status: 404, data: { error: 'Event not found' } };
            }

            // Validate revenue split if provided
            const split = revenue_split !== undefined ? revenue_split : 0;
            if (split < 0 || split > 100) {
                return { status: 400, data: { error: 'revenue_split must be between 0 and 100' } };
            }

            const id = uuidv4();

            query.run(
                `INSERT INTO whatnot_cohosts (id, user_id, event_id, cohost_name, role, revenue_split, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, user.id, event_id, cohost_name.trim(), role || 'co-host', split, notes || null, 'active']
            );

            const cohost = query.get('SELECT * FROM whatnot_cohosts WHERE id = ?', [id]);

            return { status: 201, data: cohost };
        } catch (error) {
            logger.error('[Whatnot] Create cohost error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to add co-host' } };
        }
    }

    // PUT /api/whatnot-enhanced/cohosts/:id - Update co-host
    if (method === 'PUT' && path.match(/^\/cohosts\/[a-f0-9-]+$/)) {
        try {
            const cohostId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM whatnot_cohosts WHERE id = ? AND user_id = ?',
                [cohostId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Co-host not found' } };
            }

            const { cohost_name, role, revenue_split, status: cohostStatus, notes } = body;
            const updates = [];
            const values = [];

            if (cohost_name !== undefined) {
                if (!cohost_name.trim()) {
                    return { status: 400, data: { error: 'Co-host name cannot be empty' } };
                }
                updates.push('cohost_name = ?');
                values.push(cohost_name.trim());
            }

            if (role !== undefined) {
                updates.push('role = ?');
                values.push(role);
            }

            if (revenue_split !== undefined) {
                if (revenue_split < 0 || revenue_split > 100) {
                    return { status: 400, data: { error: 'revenue_split must be between 0 and 100' } };
                }
                updates.push('revenue_split = ?');
                values.push(revenue_split);
            }

            if (cohostStatus !== undefined) {
                const validStatuses = ['active', 'inactive', 'removed'];
                if (!validStatuses.includes(cohostStatus)) {
                    return { status: 400, data: { error: `Invalid status. Must be: ${validStatuses.join(', ')}` } };
                }
                updates.push('status = ?');
                values.push(cohostStatus);
            }

            if (notes !== undefined) {
                updates.push('notes = ?');
                values.push(notes);
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            values.push(cohostId);

            values.push(user.id);
            query.run(
                `UPDATE whatnot_cohosts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );

            const updated = query.get('SELECT * FROM whatnot_cohosts WHERE id = ? AND user_id = ?', [cohostId, user.id]);

            return { status: 200, data: updated };
        } catch (error) {
            logger.error('[Whatnot] Update cohost error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to update co-host' } };
        }
    }

    // DELETE /api/whatnot-enhanced/cohosts/:id - Remove co-host
    if (method === 'DELETE' && path.match(/^\/cohosts\/[a-f0-9-]+$/)) {
        try {
            const cohostId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM whatnot_cohosts WHERE id = ? AND user_id = ?',
                [cohostId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Co-host not found' } };
            }

            query.run('DELETE FROM whatnot_cohosts WHERE id = ? AND user_id = ?', [cohostId, user.id]);

            return { status: 200, data: { message: 'Co-host removed successfully' } };
        } catch (error) {
            logger.error('[Whatnot] Delete cohost error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to remove co-host' } };
        }
    }

    // GET /api/whatnot-enhanced/staging - List staged items for upcoming streams
    if (method === 'GET' && path === '/staging') {
        try {
            const { event_id } = queryParams;

            let sql = `SELECT ws.*, i.title, i.sku, i.cost_price, i.quantity, i.list_price,
                      we.title as event_title, we.start_time
                      FROM stream_staging ws
                      LEFT JOIN inventory i ON ws.inventory_id = i.id
                      LEFT JOIN whatnot_events we ON ws.event_id = we.id
                      WHERE ws.user_id = ?`;
            const params = [user.id];

            if (event_id) {
                sql += ' AND ws.event_id = ?';
                params.push(event_id);
            }

            sql += ' ORDER BY ws.display_order, ws.created_at LIMIT 500';

            const staged = query.all(sql, params);

            return { status: 200, data: staged };
        } catch (error) {
            logger.error('[Whatnot] Get staging error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load staged items' } };
        }
    }

    // POST /api/whatnot-enhanced/staging - Stage inventory item
    if (method === 'POST' && path === '/staging') {
        try {
            const { event_id, inventory_id, display_order, flash_price, bundle_group, notes } = body;

            if (!event_id) {
                return { status: 400, data: { error: 'event_id required' } };
            }

            if (!inventory_id) {
                return { status: 400, data: { error: 'inventory_id required' } };
            }

            // Verify event exists
            const event = query.get(
                'SELECT id FROM whatnot_events WHERE id = ? AND user_id = ?',
                [event_id, user.id]
            );

            if (!event) {
                return { status: 404, data: { error: 'Event not found' } };
            }

            // Verify inventory exists
            const item = query.get(
                'SELECT id, quantity FROM inventory WHERE id = ? AND user_id = ?',
                [inventory_id, user.id]
            );

            if (!item) {
                return { status: 404, data: { error: 'Inventory item not found' } };
            }

            // Check if already staged
            const alreadyStaged = query.get(
                'SELECT id FROM stream_staging WHERE event_id = ? AND inventory_id = ?',
                [event_id, inventory_id]
            );

            if (alreadyStaged) {
                return { status: 409, data: { error: 'Item already staged for this event' } };
            }

            const id = uuidv4();

            query.run(
                `INSERT INTO stream_staging
                (id, user_id, event_id, inventory_id, display_order, flash_price, bundle_group, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, user.id, event_id, inventory_id, display_order || 0, flash_price || null, bundle_group || null, notes || null]
            );

            const staged = query.get('SELECT * FROM stream_staging WHERE id = ?', [id]);

            return { status: 201, data: staged };
        } catch (error) {
            logger.error('[Whatnot] Create staging error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to stage item' } };
        }
    }

    // PUT /api/whatnot-enhanced/staging/:id - Update staging
    if (method === 'PUT' && path.match(/^\/staging\/[a-f0-9-]+$/)) {
        try {
            const stagingId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM stream_staging WHERE id = ? AND user_id = ?',
                [stagingId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Staged item not found' } };
            }

            const { display_order, flash_price, bundle_group, notes } = body;
            const updates = [];
            const values = [];

            if (display_order !== undefined) {
                updates.push('display_order = ?');
                values.push(display_order);
            }

            if (flash_price !== undefined) {
                updates.push('flash_price = ?');
                values.push(flash_price);
            }

            if (bundle_group !== undefined) {
                updates.push('bundle_group = ?');
                values.push(bundle_group);
            }

            if (notes !== undefined) {
                updates.push('notes = ?');
                values.push(notes);
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            values.push(stagingId);

            values.push(user.id);
            query.run(
                `UPDATE stream_staging SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
                values
            );

            const updated = query.get('SELECT * FROM stream_staging WHERE id = ? AND user_id = ?', [stagingId, user.id]);

            return { status: 200, data: updated };
        } catch (error) {
            logger.error('[Whatnot] Update staging error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to update staged item' } };
        }
    }

    // DELETE /api/whatnot-enhanced/staging/:id - Remove from staging
    if (method === 'DELETE' && path.match(/^\/staging\/[a-f0-9-]+$/)) {
        try {
            const stagingId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM stream_staging WHERE id = ? AND user_id = ?',
                [stagingId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Staged item not found' } };
            }

            query.run('DELETE FROM stream_staging WHERE id = ? AND user_id = ?', [stagingId, user.id]);

            return { status: 200, data: { message: 'Item removed from staging' } };
        } catch (error) {
            logger.error('[Whatnot] Delete staging error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to remove staged item' } };
        }
    }

    // POST /api/whatnot-enhanced/staging/auto-suggest - Auto-suggest items
    if (method === 'POST' && path === '/staging/auto-suggest') {
        try {
            const { event_id, limit = 20 } = body;

            if (!event_id) {
                return { status: 400, data: { error: 'event_id required' } };
            }

            // Verify event exists
            const event = query.get(
                'SELECT id FROM whatnot_events WHERE id = ? AND user_id = ?',
                [event_id, user.id]
            );

            if (!event) {
                return { status: 404, data: { error: 'Event not found' } };
            }

            // Get items with highest profit margins, older than 30 days, not already staged
            const suggested = query.all(
                `SELECT i.id, i.title, i.sku, i.cost_price, i.list_price, i.quantity,
                (i.list_price - i.cost_price) as profit_margin,
                julianday('now') - julianday(i.created_at) as age_days
                FROM inventory i
                WHERE i.user_id = ?
                AND i.status = 'active'
                AND i.quantity > 0
                AND julianday('now') - julianday(i.created_at) > 30
                AND i.id NOT IN (SELECT inventory_id FROM stream_staging WHERE event_id = ?)
                ORDER BY profit_margin DESC, age_days DESC
                LIMIT ?`,
                [user.id, event_id, Math.min(parseInt(limit) || 20, 100)]
            );

            return { status: 200, data: suggested };
        } catch (error) {
            logger.error('[Whatnot] Auto-suggest error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to generate suggestions' } };
        }
    }

    // GET /api/whatnot-enhanced/staging/bundles - List bundle groups in staging
    if (method === 'GET' && path === '/staging/bundles') {
        try {
            const { event_id } = queryParams;

            let sql = `SELECT bundle_group, COUNT(*) as item_count,
                SUM(flash_price) as total_flash_price
                FROM stream_staging
                WHERE user_id = ? AND bundle_group IS NOT NULL`;
            const params = [user.id];

            if (event_id) {
                sql += ' AND event_id = ?';
                params.push(event_id);
            }

            sql += ' GROUP BY bundle_group ORDER BY bundle_group';

            const bundles = query.all(sql, params);

            return { status: 200, data: bundles };
        } catch (error) {
            logger.error('[Whatnot] Get bundles error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to load bundles' } };
        }
    }

    return { status: 404, data: { error: 'Whatnot Enhanced endpoint not found' } };
}
