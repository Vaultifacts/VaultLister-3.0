// Calendar Routes
// Calendar events for listings, orders, automations, and custom events

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

/**
 * Calendar router
 */
export async function calendarRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    if (!user) {
        return {
            status: 401,
            data: { error: 'Authentication required' }
        };
    }

    // ============================================
    // CALENDAR EVENTS
    // ============================================

    // GET /api/calendar - List events (with optional date range filter)
    if (method === 'GET' && (path === '' || path === '/')) {
        const { start_date, end_date, type } = queryParams;

        try {
            let sql = `SELECT * FROM calendar_events WHERE user_id = ?`;
            const params = [user.id];

            if (start_date) {
                sql += ` AND date >= ?`;
                params.push(start_date);
            }

            if (end_date) {
                sql += ` AND date <= ?`;
                params.push(end_date);
            }

            if (type) {
                sql += ` AND type = ?`;
                params.push(type);
            }

            sql += ` ORDER BY date ASC, time ASC`;

            // SECURITY: Default LIMIT when no date range to prevent unbounded result sets
            if (!start_date && !end_date) {
                sql += ' LIMIT 500';
            }

            const events = query.all(sql, params);

            return {
                status: 200,
                data: { events }
            };
        } catch (error) {
            logger.error('[Calendar] Error fetching calendar events', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch events' }
            };
        }
    }

    // GET /api/calendar/:year/:month - Get events for specific month
    if (method === 'GET' && path.match(/^\/\d{4}\/\d{1,2}$/)) {
        const [_, year, month] = path.split('/');

        try {
            // Parse and validate year and month
            const parsedYear = parseInt(year);
            const parsedMonth = parseInt(month);

            // Validate ranges
            if (isNaN(parsedYear) || parsedYear < 1900 || parsedYear > 2100) {
                return {
                    status: 400,
                    data: { error: 'Invalid year. Must be between 1900 and 2100' }
                };
            }

            if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
                return {
                    status: 400,
                    data: { error: 'Invalid month. Must be between 1 and 12' }
                };
            }

            // Calculate start and end dates for the month
            const startDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-01`;
            const daysInMonth = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
            const endDate = `${parsedYear}-${String(parsedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const events = query.all(
                `SELECT * FROM calendar_events WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, time ASC`,
                [user.id, startDate, endDate]
            );

            return {
                status: 200,
                data: { events, year: parsedYear, month: parsedMonth }
            };
        } catch (error) {
            logger.error('[Calendar] Error fetching month events', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch events' }
            };
        }
    }

    // GET /api/calendar/events/:id - Get single event
    if (method === 'GET' && path.startsWith('/events/') && path.split('/').length === 3) {
        const eventId = path.split('/')[2];

        try {
            const event = query.get(
                `SELECT * FROM calendar_events WHERE id = ? AND user_id = ?`,
                [eventId, user.id]
            );

            if (!event) {
                return {
                    status: 404,
                    data: { error: 'Event not found' }
                };
            }

            return {
                status: 200,
                data: { event }
            };
        } catch (error) {
            logger.error('[Calendar] Error fetching event', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch event' }
            };
        }
    }

    // POST /api/calendar/events - Create new event
    if (method === 'POST' && path === '/events') {
        if (!body) {
            return {
                status: 400,
                data: { error: 'Request body required' }
            };
        }

        const { title, description, date, time, type, color, related_id, related_type, all_day, depends_on } = body;

        // Validation
        if (!title || !date) {
            return {
                status: 400,
                data: { error: 'Title and date are required' }
            };
        }
        if (title.length > 200) return { status: 400, data: { error: 'Title must be 200 characters or less' } };
        if (description && description.length > 2000) return { status: 400, data: { error: 'Description must be 2000 characters or less' } };

        // Validate date format and range
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return {
                status: 400,
                data: { error: 'Invalid date format' }
            };
        }
        const year = parsedDate.getFullYear();
        if (year < 2000 || year > 2100) {
            return {
                status: 400,
                data: { error: 'Date must be between year 2000 and 2100' }
            };
        }

        const validTypes = ['listing', 'order', 'automation', 'reminder', 'custom', 'sale', 'shipment', 'restock', 'live', 'personal', 'deadline'];
        if (type && !validTypes.includes(type)) {
            return {
                status: 400,
                data: { error: 'Invalid event type' }
            };
        }

        try {
            const eventId = nanoid();
            query.run(
                `INSERT INTO calendar_events (id, user_id, title, description, date, time, type, color, related_id, related_type, all_day, depends_on)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    eventId,
                    user.id,
                    title,
                    description || null,
                    date,
                    time || null,
                    type || 'custom',
                    color || '#6366f1',
                    related_id || null,
                    related_type || null,
                    all_day ? 1 : 0,
                    depends_on || null
                ]
            );

            const event = query.get(`SELECT * FROM calendar_events WHERE id = ?`, [eventId]);

            return {
                status: 201,
                data: { event }
            };
        } catch (error) {
            logger.error('[Calendar] Error creating event', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to create event' }
            };
        }
    }

    // PUT /api/calendar/events/:id - Update event
    if (method === 'PUT' && path.startsWith('/events/') && path.split('/').length === 3) {
        const eventId = path.split('/')[2];

        try {
            const event = query.get(
                `SELECT * FROM calendar_events WHERE id = ? AND user_id = ?`,
                [eventId, user.id]
            );

            if (!event) {
                return {
                    status: 404,
                    data: { error: 'Event not found' }
                };
            }

            const { title, description, date, time, type, color, completed, all_day, depends_on } = body;

            query.run(
                `UPDATE calendar_events SET
                    title = ?, description = ?, date = ?, time = ?, type = ?, color = ?, completed = ?, all_day = ?, depends_on = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    title || event.title,
                    description !== undefined ? description : event.description,
                    date || event.date,
                    time !== undefined ? time : event.time,
                    type || event.type,
                    color || event.color,
                    completed !== undefined ? (completed ? 1 : 0) : event.completed,
                    all_day !== undefined ? (all_day ? 1 : 0) : event.all_day,
                    depends_on !== undefined ? (depends_on || null) : (event.depends_on || null),
                    eventId
                ]
            );

            const updatedEvent = query.get(`SELECT * FROM calendar_events WHERE id = ?`, [eventId]);

            return {
                status: 200,
                data: { event: updatedEvent }
            };
        } catch (error) {
            logger.error('[Calendar] Error updating event', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to update event' }
            };
        }
    }

    // DELETE /api/calendar/events/:id - Delete event
    if (method === 'DELETE' && path.startsWith('/events/') && path.split('/').length === 3) {
        const eventId = path.split('/')[2];

        try {
            const event = query.get(
                `SELECT * FROM calendar_events WHERE id = ? AND user_id = ?`,
                [eventId, user.id]
            );

            if (!event) {
                return {
                    status: 404,
                    data: { error: 'Event not found' }
                };
            }

            const result = query.run(`DELETE FROM calendar_events WHERE id = ? AND user_id = ?`, [eventId, user.id]);

            // Cascade delete dependent events
            query.run(`DELETE FROM calendar_events WHERE depends_on = ? AND user_id = ?`, [eventId, user.id]);

            if (result.changes === 0) {
                return {
                    status: 404,
                    data: { error: 'Event not found' }
                };
            }

            return {
                status: 200,
                data: { message: 'Event deleted successfully' }
            };
        } catch (error) {
            logger.error('[Calendar] Error deleting event', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to delete event' }
            };
        }
    }

    // ============================================
    // CALENDAR SYNC SETTINGS
    // ============================================

    // GET /api/calendar/sync-settings - List user's sync configurations
    if (method === 'GET' && path === '/sync-settings') {
        try {
            const settings = query.all(
                'SELECT * FROM calendar_sync_settings WHERE user_id = ? ORDER BY created_at ASC',
                [user.id]
            );
            return { status: 200, data: { settings } };
        } catch (error) {
            logger.error('[Calendar] Error fetching sync settings', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to fetch sync settings' } };
        }
    }

    // POST /api/calendar/sync-settings - Create or update sync config
    if (method === 'POST' && path === '/sync-settings') {
        const { provider, sync_direction, frequency, is_active, calendar_name } = body;

        if (!provider || !['google', 'outlook', 'ical'].includes(provider)) {
            return { status: 400, data: { error: 'Invalid provider. Must be google, outlook, or ical' } };
        }

        if (sync_direction && !['import', 'export', 'both'].includes(sync_direction)) {
            return { status: 400, data: { error: 'Invalid sync direction' } };
        }

        if (frequency && !['realtime', 'hourly', 'daily', 'manual'].includes(frequency)) {
            return { status: 400, data: { error: 'Invalid frequency' } };
        }

        try {
            // Upsert by user_id + provider
            const existing = query.get(
                'SELECT id FROM calendar_sync_settings WHERE user_id = ? AND provider = ?',
                [user.id, provider]
            );

            if (existing) {
                query.run(`
                    UPDATE calendar_sync_settings
                    SET sync_direction = ?, frequency = ?, is_active = ?, calendar_name = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    sync_direction || 'both',
                    frequency || 'daily',
                    is_active ? 1 : 0,
                    calendar_name || null,
                    existing.id
                ]);
                return { status: 200, data: { message: 'Sync settings updated', id: existing.id } };
            } else {
                const id = nanoid();
                query.run(`
                    INSERT INTO calendar_sync_settings (id, user_id, provider, sync_direction, frequency, is_active, calendar_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [id, user.id, provider, sync_direction || 'both', frequency || 'daily', is_active ? 1 : 0, calendar_name || null]);
                return { status: 201, data: { message: 'Sync settings created', id } };
            }
        } catch (error) {
            logger.error('[Calendar] Error saving sync settings', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to save sync settings' } };
        }
    }

    // DELETE /api/calendar/sync-settings/:id - Remove sync config
    if (method === 'DELETE' && path.startsWith('/sync-settings/')) {
        const settingId = path.substring('/sync-settings/'.length);

        try {
            const setting = query.get(
                'SELECT id FROM calendar_sync_settings WHERE id = ? AND user_id = ?',
                [settingId, user.id]
            );

            if (!setting) {
                return { status: 404, data: { error: 'Sync setting not found' } };
            }

            const result = query.run('DELETE FROM calendar_sync_settings WHERE id = ? AND user_id = ?', [settingId, user.id]);

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Sync setting not found' } };
            }

            return { status: 200, data: { message: 'Sync setting deleted' } };
        } catch (error) {
            logger.error('[Calendar] Error deleting sync setting', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to delete sync setting' } };
        }
    }

    // 404
    return {
        status: 404,
        data: { error: 'Endpoint not found' }
    };
}
