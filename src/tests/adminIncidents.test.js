// Admin Incidents API Tests (audit #30) — validates status-page incident management
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { adminIncidentsRouter } from '../backend/routes/adminIncidents.js';
import { query, initializeDatabase, closeDatabase } from '../backend/db/database.js';

async function runRoute(ctx) {
    if (!ctx.path) ctx.path = '';
    return adminIncidentsRouter(ctx);
}

const admin = { id: 'u-admin', email: 'admin@test', is_admin: true };
const user  = { id: 'u-user',  email: 'user@test',  is_admin: false };

beforeAll(async () => {
    await initializeDatabase();
    await query.run('DELETE FROM platform_incidents WHERE title LIKE ?', ['__test_%']);
}, 60_000);

afterAll(async () => {
    await query.run('DELETE FROM platform_incidents WHERE title LIKE ?', ['__test_%']);
    await closeDatabase();
}, 10_000);

describe('adminIncidents — auth guard', () => {
    test('unauthenticated request returns 401', async () => {
        const res = await runRoute({ method: 'GET', path: '', body: null, user: null });
        expect(res.status).toBe(401);
    });

    test('non-admin user returns 403', async () => {
        const res = await runRoute({ method: 'GET', path: '', body: null, user });
        expect(res.status).toBe(403);
    });
});

describe('adminIncidents — validation', () => {
    test('POST rejects unknown platform_id', async () => {
const res = await runRoute({
            method: 'POST', path: '',
            body: { platform_id: 'bogus', kind: 'market', title: '__test_x' },
            user: admin
        });
        expect(res.status).toBe(400);
        expect(res.data.error).toBe('Validation failed');
    });

    test('POST rejects invalid kind', async () => {
const res = await runRoute({
            method: 'POST', path: '',
            body: { platform_id: 'ebay', kind: 'bogus', title: '__test_x' },
            user: admin
        });
        expect(res.status).toBe(400);
    });

    test('POST rejects javascript: postmortem_url (XSS defense)', async () => {
const res = await runRoute({
            method: 'POST', path: '',
            body: {
                platform_id: 'ebay', kind: 'market', title: '__test_xss',
                postmortem_url: 'javascript:alert(1)'
            },
            user: admin
        });
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.data.details)).toContain('postmortem_url');
    });

    test('POST accepts valid relative postmortem_url', async () => {
const res = await runRoute({
            method: 'POST', path: '',
            body: {
                platform_id: 'ebay', kind: 'market', title: '__test_ok',
                postmortem_url: '/incidents/2026-04-18-test'
            },
            user: admin
        });
        expect(res.status).toBe(201);
        expect(typeof res.data.id).toBe('number');
    });
});

describe('adminIncidents — lifecycle', () => {
    test('create → update status → resolve round-trip', async () => {
const create = await runRoute({
            method: 'POST', path: '',
            body: { platform_id: 'shopify', kind: 'vl', title: '__test_lifecycle' },
            user: admin
        });
        expect(create.status).toBe(201);
        const id = create.data.id;

        const update = await runRoute({
            method: 'PATCH', path: '/' + id,
            body: { status: 'monitoring' },
            user: admin
        });
        expect(update.status).toBe(200);

        const resolve = await runRoute({
            method: 'POST', path: '/' + id + '/resolve',
            body: null,
            user: admin
        });
        expect(resolve.status).toBe(200);
        expect(resolve.data.resolved).toBe(true);

        // Confirm resolved_at now populated
        const row = await query.get('SELECT resolved_at FROM platform_incidents WHERE id = ?', [id]);
        expect(row.resolved_at).not.toBe(null);

        // Cleanup
        await query.run('DELETE FROM platform_incidents WHERE id = ?', [id]);
    });

    test('double-resolve returns 404', async () => {
const create = await runRoute({
            method: 'POST', path: '',
            body: { platform_id: 'depop', kind: 'market', title: '__test_double_resolve' },
            user: admin
        });
        const id = create.data.id;
        await runRoute({ method: 'POST', path: '/' + id + '/resolve', body: null, user: admin });
        const second = await runRoute({ method: 'POST', path: '/' + id + '/resolve', body: null, user: admin });
        expect(second.status).toBe(404);
        await query.run('DELETE FROM platform_incidents WHERE id = ?', [id]);
    });
});

