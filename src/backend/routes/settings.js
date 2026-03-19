// Settings Routes
// System-level settings: announcement banner

import { query } from '../db/database.js';

export async function settingsRouter(ctx) {
    const { method, path, body, user } = ctx;

    // GET /api/settings/announcement - Public: fetch active announcement
    if (method === 'GET' && path === '/announcement') {
        try {
            const row = query.get(
                `SELECT value FROM app_settings WHERE key = 'announcement' LIMIT 1`
            );
            if (!row || !row.value) {
                return { status: 200, data: { announcement: null } };
            }
            let parsed;
            try { parsed = JSON.parse(row.value); } catch (_) { parsed = null; }
            return { status: 200, data: { announcement: parsed } };
        } catch (_) {
            return { status: 200, data: { announcement: null } };
        }
    }

    // PUT /api/settings/announcement - Admin only: set or clear announcement
    if (method === 'PUT' && path === '/announcement') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }
        const { text, color } = body || {};
        if (!text || !text.trim()) {
            query.run(`DELETE FROM app_settings WHERE key = 'announcement'`);
            return { status: 200, data: { success: true, announcement: null } };
        }
        const value = JSON.stringify({ text: text.trim(), color: color || 'primary' });
        query.run(
            `INSERT INTO app_settings (key, value, updated_at)
             VALUES ('announcement', ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [value]
        );
        return { status: 200, data: { success: true, announcement: { text: text.trim(), color: color || 'primary' } } };
    }

    return { status: 404, data: { error: 'Not found' } };
}
