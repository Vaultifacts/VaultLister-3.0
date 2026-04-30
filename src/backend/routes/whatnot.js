// Whatnot Live Selling Routes
// Manages live selling events, scheduling, and inventory assignment

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

const ALLOWED_EVENT_FIELDS = new Set([
    'title',
    'description',
    'start_time',
    'category',
    'estimated_duration',
    'shipping_option',
    'status',
    'notes',
]);

export async function whatnotRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/whatnot/events - List live events
    if (method === 'GET' && (path === '' || path === '/')) {
        const { status, upcoming } = queryParams;
        try {
            let sql = 'SELECT * FROM whatnot_events WHERE user_id = ?';
            const params = [user.id];
            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }
            if (upcoming === 'true') {
                sql += ' AND start_time > NOW()';
            }
            sql += ' ORDER BY start_time DESC LIMIT 500';
            const events = await query.all(sql, params);
            return { status: 200, data: { events } };
        } catch (error) {
            logger.error('[Whatnot] Failed to fetch events', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch events' } };
        }
    }

    // GET /api/whatnot/events/:id - Get single event with items
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/) && !path.startsWith('/stats')) {
        const eventId = path.slice(1);
        try {
            const event = await query.get('SELECT * FROM whatnot_events WHERE id = ? AND user_id = ?', [
                eventId,
                user.id,
            ]);
            if (!event) return { status: 404, data: { error: 'Event not found' } };

            let items = [];
            try {
                items = await query.all(
                    'SELECT wei.*, i.title as inventory_title, i.images FROM whatnot_event_items wei LEFT JOIN inventory i ON wei.inventory_id = i.id WHERE wei.event_id = ? ORDER BY wei.sort_order ASC',
                    [eventId],
                );
            } catch (error) {
                logger.error('[Whatnot] Failed to fetch event items', user?.id, { detail: error?.message });
                return { status: 500, data: { error: 'Failed to fetch event items' } };
            }

            event.items = items;
            return { status: 200, data: { event } };
        } catch (error) {
            return { status: 500, data: { error: 'Failed to fetch event' } };
        }
    }

    // POST /api/whatnot/events - Create live event
    if (method === 'POST' && (path === '' || path === '/')) {
        const { title, description, start_time, category, estimated_duration, shipping_option, notes } = body;
        if (!title || !start_time) {
            return { status: 400, data: { error: 'Title and start time are required' } };
        }
        const eventId = uuidv4();
        const now = new Date().toISOString();
        const event = await query.transaction(async () => {
            await query.run(
                `
                INSERT INTO whatnot_events (id, user_id, title, description, start_time, category, estimated_duration, shipping_option, notes, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
            `,
                [
                    eventId,
                    user.id,
                    title,
                    description || null,
                    start_time,
                    category || 'general',
                    estimated_duration || 60,
                    shipping_option || 'standard',
                    notes || null,
                    now,
                    now,
                ],
            );
            return await query.get('SELECT * FROM whatnot_events WHERE id = ?', [eventId]);
        });
        return { status: 201, data: { event, message: 'Event created' } };
    }

    // PUT /api/whatnot/events/:id - Update event
    if (method === 'PUT' && path.match(/^\/[a-f0-9-]+$/)) {
        const eventId = path.slice(1);
        const existing = await query.get('SELECT * FROM whatnot_events WHERE id = ? AND user_id = ?', [
            eventId,
            user.id,
        ]);
        if (!existing) return { status: 404, data: { error: 'Event not found' } };

        const { title, description, start_time, category, estimated_duration, shipping_option, status, notes } = body;
        const updates = [];
        const params = [];
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (start_time !== undefined) {
            updates.push('start_time = ?');
            params.push(start_time);
        }
        if (category !== undefined) {
            updates.push('category = ?');
            params.push(category);
        }
        if (estimated_duration !== undefined) {
            updates.push('estimated_duration = ?');
            params.push(estimated_duration);
        }
        if (shipping_option !== undefined) {
            updates.push('shipping_option = ?');
            params.push(shipping_option);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length > 0) {
            updates.push('updated_at = NOW()');
            params.push(eventId, user.id);
            await query.run(`UPDATE whatnot_events SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
        }
        const event = await query.get('SELECT * FROM whatnot_events WHERE id = ?', [eventId]);
        return { status: 200, data: { event } };
    }

    // DELETE /api/whatnot/events/:id - Delete event
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        const eventId = path.slice(1);
        const event = await query.get('SELECT id FROM whatnot_events WHERE id = ? AND user_id = ?', [eventId, user.id]);
        if (!event) return { status: 404, data: { error: 'Event not found' } };
        try {
            await query.run('DELETE FROM whatnot_event_items WHERE event_id = ?', [eventId]);
        } catch (error) {
            logger.error('[Whatnot] Failed to delete event items', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to delete event items' } };
        }
        await query.run('DELETE FROM whatnot_events WHERE id = ? AND user_id = ?', [eventId, user.id]);
        return { status: 200, data: { message: 'Event deleted' } };
    }

    // POST /api/whatnot/events/:id/items - Add items to event
    if (method === 'POST' && path.match(/^\/[^/]+\/items$/)) {
        const eventId = path.split('/')[1];
        const event = await query.get('SELECT id FROM whatnot_events WHERE id = ? AND user_id = ?', [eventId, user.id]);
        if (!event) return { status: 404, data: { error: 'Event not found' } };
        const { inventory_id, starting_price, buy_now_price, min_price } = body;
        if (!inventory_id) return { status: 400, data: { error: 'Inventory ID required' } };

        const itemId = uuidv4();
        const item = await query.transaction(async () => {
            const maxOrder = await query.get(
                'SELECT MAX(sort_order) as max FROM whatnot_event_items WHERE event_id = ?',
                [eventId],
            );
            const sortOrder = (maxOrder?.max || 0) + 1;
            await query.run(
                `
                INSERT INTO whatnot_event_items (id, event_id, inventory_id, starting_price, buy_now_price, min_price, sort_order, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
            `,
                [itemId, eventId, inventory_id, starting_price || 0, buy_now_price || null, min_price || 0, sortOrder],
            );
            return await query.get('SELECT * FROM whatnot_event_items WHERE id = ?', [itemId]);
        });
        return { status: 201, data: { item } };
    }

    // DELETE /api/whatnot/events/:id/items/:itemId - Remove item from event
    if (method === 'DELETE' && path.match(/^\/[^/]+\/items\/[^/]+$/)) {
        const parts = path.split('/');
        const eventId = parts[1];
        const itemId = parts[3];

        // Verify user owns the event
        const event = await query.get('SELECT id FROM whatnot_events WHERE id = ? AND user_id = ?', [eventId, user.id]);
        if (!event) {
            return { status: 404, data: { error: 'Event not found' } };
        }

        const result = await query.run('DELETE FROM whatnot_event_items WHERE id = ? AND event_id = ?', [
            itemId,
            eventId,
        ]);

        if (result.changes === 0) {
            return { status: 404, data: { error: 'Item not found' } };
        }

        return { status: 200, data: { message: 'Item removed' } };
    }

    // GET /api/whatnot/stats - Event statistics
    if (method === 'GET' && path === '/stats') {
        try {
            const stats = {
                total_events:
                    Number(
                        (await query.get('SELECT COUNT(*) as count FROM whatnot_events WHERE user_id = ?', [user.id]))
                            ?.count,
                    ) || 0,
                upcoming:
                    Number(
                        (
                            await query.get(
                                "SELECT COUNT(*) as count FROM whatnot_events WHERE user_id = ? AND status = 'scheduled' AND start_time > NOW()",
                                [user.id],
                            )
                        )?.count,
                    ) || 0,
                completed:
                    Number(
                        (
                            await query.get(
                                "SELECT COUNT(*) as count FROM whatnot_events WHERE user_id = ? AND status = 'completed'",
                                [user.id],
                            )
                        )?.count,
                    ) || 0,
                total_items_sold:
                    Number(
                        (
                            await query.get(
                                "SELECT COUNT(*) as count FROM whatnot_event_items wei JOIN whatnot_events we ON wei.event_id = we.id WHERE we.user_id = ? AND wei.status = 'sold'",
                                [user.id],
                            )
                        )?.count,
                    ) || 0,
            };
            return { status: 200, data: { stats } };
        } catch (error) {
            logger.error('[Whatnot] Whatnot stats error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch statistics' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
