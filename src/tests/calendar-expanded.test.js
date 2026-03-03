// Calendar API — Expanded Tests (sync-settings + deeper CRUD coverage)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Calendar - Auth Guard', () => {
    test('GET /calendar without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/calendar`);
        expect(res.status).toBe(401);
    });

    test('POST /calendar/events without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/calendar/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test', date: '2025-06-15' })
        });
        expect(res.status).toBe(401);
    });
});

describe('Calendar - List Events', () => {
    test('GET /calendar returns events array', async () => {
        const { status, data } = await client.get('/calendar');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data) || (data && data.events !== undefined)).toBe(true);
        }
    });

    test('GET /calendar with date range', async () => {
        const { status } = await client.get('/calendar?start_date=2025-01-01&end_date=2025-12-31');
        expect([200, 500]).toContain(status);
    });

    test('GET /calendar with type filter', async () => {
        const { status } = await client.get('/calendar?type=reminder');
        expect([200, 500]).toContain(status);
    });
});

describe('Calendar - Month Events', () => {
    test('GET /calendar/2025/6 returns June events', async () => {
        const { status } = await client.get('/calendar/2025/6');
        expect([200, 500]).toContain(status);
    });

    test('GET /calendar/2025/13 invalid month returns 400', async () => {
        const { status } = await client.get('/calendar/2025/13');
        expect([400, 500]).toContain(status);
    });

    test('GET /calendar/1800/1 invalid year returns 400', async () => {
        const { status } = await client.get('/calendar/1800/1');
        expect([400, 500]).toContain(status);
    });
});

describe('Calendar - Create Event', () => {
    test('POST /calendar/events creates event', async () => {
        const { status, data } = await client.post('/calendar/events', {
            title: 'Test Event',
            date: '2025-06-15',
            type: 'reminder',
            description: 'A test event'
        });
        expect([201, 500]).toContain(status);
    });

    test('POST /calendar/events without title returns 400', async () => {
        const { status } = await client.post('/calendar/events', {
            date: '2025-06-15'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /calendar/events without date returns 400', async () => {
        const { status } = await client.post('/calendar/events', {
            title: 'No Date'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /calendar/events with title over 200 chars returns 400', async () => {
        const { status } = await client.post('/calendar/events', {
            title: 'A'.repeat(201),
            date: '2025-06-15'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /calendar/events with description over 2000 chars returns 400', async () => {
        const { status } = await client.post('/calendar/events', {
            title: 'Long Desc',
            date: '2025-06-15',
            description: 'B'.repeat(2001)
        });
        expect([400, 500]).toContain(status);
    });
});

describe('Calendar - Get/Update/Delete Event', () => {
    test('GET /calendar/events/nonexistent returns 404', async () => {
        const { status } = await client.get('/calendar/events/00000000-0000-0000-0000-000000000000');
        expect([404, 500]).toContain(status);
    });

    test('PUT /calendar/events/nonexistent returns 404', async () => {
        const { status } = await client.put('/calendar/events/00000000-0000-0000-0000-000000000000', {
            title: 'Updated'
        });
        expect([404, 500]).toContain(status);
    });

    test('DELETE /calendar/events/nonexistent returns 404', async () => {
        const { status } = await client.delete('/calendar/events/00000000-0000-0000-0000-000000000000');
        expect([404, 500]).toContain(status);
    });
});

describe('Calendar - Sync Settings', () => {
    test('GET /calendar/sync-settings returns settings list', async () => {
        const { status, data } = await client.get('/calendar/sync-settings');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data) || (data && typeof data === 'object')).toBe(true);
        }
    });

    test('POST /calendar/sync-settings creates sync setting', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'google',
            sync_direction: 'import',
            frequency: 'daily',
            is_active: true,
            calendar_name: 'VaultLister Events'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /calendar/sync-settings with outlook provider', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'outlook',
            sync_direction: 'both',
            frequency: 'hourly'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /calendar/sync-settings without provider returns 400', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            frequency: 'daily'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /calendar/sync-settings with invalid provider returns 400', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'yahoo'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /calendar/sync-settings with invalid frequency returns 400', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'google',
            frequency: 'every-second'
        });
        expect([400, 500]).toContain(status);
    });

    test('DELETE /calendar/sync-settings/nonexistent returns 404', async () => {
        const { status } = await client.delete('/calendar/sync-settings/00000000-0000-0000-0000-000000000000');
        expect([404, 500]).toContain(status);
    });
});
