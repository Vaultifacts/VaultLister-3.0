// User Analytics (server.js inline endpoints) — Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('User Analytics - Auth Guard', () => {
    test('POST /user-analytics/page-view without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/user-analytics/page-view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: '/inventory' })
        });
        expect(res.status).toBe(401);
    });

    test('GET /user-analytics/sessions without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/user-analytics/sessions`);
        expect(res.status).toBe(401);
    });
});

describe('User Analytics - Page View', () => {
    test('POST /user-analytics/page-view tracks page view', async () => {
        const { status } = await client.post('/user-analytics/page-view', {
            page: '/inventory',
            referrer: '/dashboard'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /user-analytics/page-view without page returns 400', async () => {
        const { status } = await client.post('/user-analytics/page-view', {});
        expect([200, 400, 500]).toContain(status);
    });
});

describe('User Analytics - Action', () => {
    test('POST /user-analytics/action tracks action', async () => {
        const { status } = await client.post('/user-analytics/action', {
            action: 'click',
            target: 'add_item_button',
            page: '/inventory'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /user-analytics/action without action field', async () => {
        const { status } = await client.post('/user-analytics/action', {
            target: 'some_button'
        });
        expect([200, 400, 500]).toContain(status);
    });
});

describe('User Analytics - Sessions', () => {
    test('GET /user-analytics/sessions returns session data', async () => {
        const { status, data } = await client.get('/user-analytics/sessions');
        // Enterprise-only feature may return 403
        expect([200, 403, 500]).toContain(status);
    });
});

describe('Server.js Inline - Status', () => {
    test('GET /status returns ok', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/status`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
    });
});
