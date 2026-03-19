// Calendar Routes
// Calendar events for listings, orders, automations, and custom events
// Also handles Google Calendar OAuth flow (#17)

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';
import {
    isGoogleConfigured,
    buildGoogleAuthUrl,
    getAccessToken,
    revokeGoogleToken,
    getConnectionStatus
} from '../services/googleOAuth.js';
import { validateCSRF } from '../middleware/csrf.js';

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

    // ============================================================
    // GOOGLE CALENDAR OAUTH (#17)
    // ============================================================

    const calendarSyncEnabled = process.env.FEATURE_CALENDAR_SYNC !== 'false';

    // GET /api/calendar/google/authorize — start Google Calendar OAuth
    if (method === 'GET' && path === '/google/authorize') {
        if (!calendarSyncEnabled) {
            return { status: 503, data: { error: 'Google Calendar sync is not enabled.' } };
        }
        if (!isGoogleConfigured()) {
            return {
                status: 400,
                data: {
                    error: 'Google Calendar not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.',
                    configured: false
                }
            };
        }
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const { authorizationUrl, state } = buildGoogleAuthUrl(user.id, 'calendar', baseUrl);
        logger.info('[Calendar] Google Calendar OAuth initiated', user.id);
        return { status: 200, data: { authorizationUrl, state } };
    }

    // GET /api/calendar/google/status — connection status
    if (method === 'GET' && path === '/google/status') {
        const status = getConnectionStatus(user.id, 'calendar');
        return {
            status: 200,
            data: {
                ...status,
                configured: isGoogleConfigured(),
                featureEnabled: calendarSyncEnabled
            }
        };
    }

    // POST /api/calendar/google/sync — push local events to Google Calendar
    if (method === 'POST' && path === '/google/sync') {
        if (!calendarSyncEnabled) {
            return { status: 503, data: { error: 'Google Calendar sync is not enabled.' } };
        }

        const csrf = validateCSRF(ctx);
        if (!csrf.valid) return { status: csrf.status || 403, data: { error: csrf.error } };

        const accessToken = await getAccessToken(user.id, 'calendar');
        if (!accessToken) {
            return { status: 401, data: { error: 'Google Calendar not connected. Authorize first via /api/calendar/google/authorize.' } };
        }

        try {
            const { start_date, end_date } = body || {};

            let sql = `SELECT * FROM calendar_events WHERE user_id = ? AND completed = 0`;
            const params = [user.id];
            if (start_date) { sql += ' AND date >= ?'; params.push(start_date); }
            if (end_date) { sql += ' AND date <= ?'; params.push(end_date); }
            sql += ' ORDER BY date ASC LIMIT 250';

            const events = query.all(sql, params);

            let pushed = 0;
            let failed = 0;

            for (const ev of events) {
                try {
                    const gcalEvent = buildGoogleCalendarEvent(ev);
                    const resp = await fetch(
                        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                        {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(gcalEvent),
                            signal: AbortSignal.timeout(10000)
                        }
                    );
                    if (resp.ok) {
                        pushed++;
                    } else {
                        failed++;
                        logger.warn('[Calendar] Failed to push event to Google Calendar', user.id, { eventId: ev.id, status: resp.status });
                    }
                } catch (evErr) {
                    failed++;
                    logger.warn('[Calendar] Error pushing event', user.id, { eventId: ev.id, detail: evErr.message });
                }
            }

            // Update last_synced_at in sync settings
            query.run(
                `UPDATE calendar_sync_settings SET last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = ? AND provider = 'google'`,
                [user.id]
            );

            logger.info('[Calendar] Google Calendar sync complete', user.id, { pushed, failed, total: events.length });
            return {
                status: 200,
                data: { success: true, pushed, failed, total: events.length }
            };
        } catch (err) {
            logger.error('[Calendar] Google Calendar sync error', user.id, { detail: err.message });
            return { status: 500, data: { error: 'Google Calendar sync failed.' } };
        }
    }

    // DELETE /api/calendar/google/revoke — disconnect Google Calendar
    if (method === 'DELETE' && path === '/google/revoke') {
        const csrf = validateCSRF(ctx);
        if (!csrf.valid) return { status: csrf.status || 403, data: { error: csrf.error } };

        try {
            await revokeGoogleToken(user.id, 'calendar');
            logger.info('[Calendar] Google Calendar token revoked', user.id);
            return { status: 200, data: { success: true, message: 'Google Calendar disconnected.' } };
        } catch (err) {
            logger.error('[Calendar] Google Calendar revoke error', user.id, { detail: err.message });
            return { status: 500, data: { error: 'Failed to revoke Google Calendar connection.' } };
        }
    }

    // 404
    return {
        status: 404,
        data: { error: 'Endpoint not found' }
    };
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function buildGoogleCalendarEvent(ev) {
    const dateStr = ev.date; // YYYY-MM-DD
    if (ev.all_day || !ev.time) {
        return {
            summary: ev.title,
            description: ev.description || '',
            start: { date: dateStr },
            end: { date: dateStr },
            colorId: gcalColorId(ev.color)
        };
    }
    const startDt = `${dateStr}T${ev.time}:00`;
    const endDt = `${dateStr}T${ev.time}:00`; // same time — event duration managed on Google side
    return {
        summary: ev.title,
        description: ev.description || '',
        start: { dateTime: startDt, timeZone: 'UTC' },
        end: { dateTime: endDt, timeZone: 'UTC' },
        colorId: gcalColorId(ev.color)
    };
}

const COLOR_MAP = {
    '#ef4444': '11', '#f97316': '6', '#eab308': '5',
    '#22c55e': '2', '#3b82f6': '9', '#8b5cf6': '3',
    '#6366f1': '9', '#ec4899': '4'
};

function gcalColorId(hex) {
    return COLOR_MAP[hex?.toLowerCase()] || '9';
}
