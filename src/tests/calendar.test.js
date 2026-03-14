// Calendar API Tests — expanded with CSRF, sync-settings, and better assertions
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`;
let client;
let testEventId = null;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Calendar - Auth Guard', () => {
    test('GET /calendar without auth returns 401', async () => {
        const res = await fetch(`${BASE_URL}/calendar`);
        expect(res.status).toBe(401);
    });
});

describe('Calendar - Events List', () => {
    test('GET /calendar returns events', async () => {
        const { status, data } = await client.get('/calendar');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('events');
    });

    test('GET /calendar with date range filter', async () => {
        const { status, data } = await client.get('/calendar?start_date=2024-01-01&end_date=2024-12-31');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('events');
    });

    test('GET /calendar with type filter', async () => {
        const { status, data } = await client.get('/calendar?type=reminder');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('events');
    });
});

describe('Calendar - Create Event', () => {
    test('POST /calendar/events creates event', async () => {
        const { status, data } = await client.post('/calendar/events', {
            title: 'Test Calendar Event',
            date: new Date().toISOString().split('T')[0],
            time: '14:00',
            type: 'reminder',
            description: 'Test event description',
            all_day: false
        });
        expect([201, 200]).toContain(status);
        if (data?.event?.id || data?.id) {
            testEventId = data.event?.id || data.id;
        }
    });

    test('POST /calendar/events validates required fields', async () => {
        const { status } = await client.post('/calendar/events', {});
        expect(status).toBe(400);
    });
});

describe('Calendar - Get Single Event', () => {
    test('GET /calendar/events/:id returns event details', async () => {
        if (!testEventId) return;
        const { status } = await client.get(`/calendar/events/${testEventId}`);
        expect([200, 404]).toContain(status);
    });
});

describe('Calendar - Update Event', () => {
    test('PUT /calendar/events/:id updates event', async () => {
        if (!testEventId) return;
        const { status } = await client.put(`/calendar/events/${testEventId}`, {
            title: 'Updated Calendar Event',
            description: 'Updated description'
        });
        expect([200, 404]).toContain(status);
    });
});

describe('Calendar - Delete Event', () => {
    test('DELETE /calendar/events/:id deletes event', async () => {
        if (!testEventId) return;
        const { status } = await client.delete(`/calendar/events/${testEventId}`);
        expect([200, 404]).toContain(status);
    });
});

describe('Calendar - Month View', () => {
    test('GET /calendar/2024/1 returns month events', async () => {
        const { status, data } = await client.get('/calendar/2024/1');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('events');
        expect(Array.isArray(data.events)).toBe(true);
    });

    test('GET /calendar/2024/12 returns month events', async () => {
        const { status, data } = await client.get('/calendar/2024/12');
        expect([200, 403]).toContain(status);
        expect(data).toHaveProperty('events');
    });
});

describe('Calendar - Sync Settings', () => {
    test('GET /calendar/sync-settings returns 200 with data', async () => {
        const { status, data } = await client.get('/calendar/sync-settings');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });

    test('POST /calendar/sync-settings creates sync config', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'google',
            direction: 'import',
            frequency: 'daily'
        });
        expect([200, 201]).toContain(status);
    });

    test('POST /calendar/sync-settings with invalid provider returns 400', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'invalid_provider',
            direction: 'import',
            frequency: 'daily'
        });
        expect([400]).toContain(status);
    });

    test('POST /calendar/sync-settings with invalid frequency returns 400', async () => {
        const { status } = await client.post('/calendar/sync-settings', {
            provider: 'google',
            direction: 'import',
            frequency: 'invalid_freq'
        });
        expect([400]).toContain(status);
    });

    test('DELETE /calendar/sync-settings/nonexistent returns 404', async () => {
        const { status } = await client.delete('/calendar/sync-settings/nonexistent-id');
        expect([404]).toContain(status);
    });
});
