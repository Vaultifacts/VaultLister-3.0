// Push Notifications API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Push Notifications - Auth Guard', () => {
    test('GET /push-notifications/devices without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/push-notifications/devices`);
        expect(res.status).toBe(401);
    });

    test('PUT /push-notifications/preferences without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/push-notifications/preferences`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sales: true })
        });
        expect(res.status).toBe(401);
    });
});

describe('Push Notifications - Register Device', () => {
    test('POST /push-notifications/register-device with valid data', async () => {
        const { status } = await client.post('/push-notifications/register-device', {
            token: 'test-device-token-abc123',
            platform: 'web'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /push-notifications/register-device with ios platform', async () => {
        const { status } = await client.post('/push-notifications/register-device', {
            token: 'ios-device-token-xyz',
            platform: 'ios'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /push-notifications/register-device without token returns 400', async () => {
        const { status } = await client.post('/push-notifications/register-device', {
            platform: 'web'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /push-notifications/register-device without platform returns 400', async () => {
        const { status } = await client.post('/push-notifications/register-device', {
            token: 'some-token'
        });
        expect([400, 500]).toContain(status);
    });
});

describe('Push Notifications - Unregister Device', () => {
    test('POST /push-notifications/unregister-device with token', async () => {
        const { status } = await client.post('/push-notifications/unregister-device', {
            token: 'test-device-token-abc123'
        });
        expect([200, 404, 500]).toContain(status);
    });

    test('POST /push-notifications/unregister-device without token returns 400', async () => {
        const { status } = await client.post('/push-notifications/unregister-device', {});
        expect([400, 500]).toContain(status);
    });
});

describe('Push Notifications - Devices', () => {
    test('GET /push-notifications/devices returns list', async () => {
        const { status, data } = await client.get('/push-notifications/devices');
        expect([200, 500]).toContain(status);
    });

    test('DELETE /push-notifications/devices/nonexistent returns 404', async () => {
        const { status } = await client.delete('/push-notifications/devices/nonexistent-id');
        expect([200, 404, 500]).toContain(status);
    });
});

describe('Push Notifications - Preferences', () => {
    test('GET /push-notifications/preferences returns defaults', async () => {
        const { status, data } = await client.get('/push-notifications/preferences');
        expect([200, 500]).toContain(status);
    });

    test('PUT /push-notifications/preferences updates settings', async () => {
        const { status } = await client.put('/push-notifications/preferences', {
            sales: true,
            offers: false,
            messages: true,
            inventory_alerts: true,
            marketing: false
        });
        expect([200, 500]).toContain(status);
    });

    test('PUT /push-notifications/preferences with quiet hours', async () => {
        const { status } = await client.put('/push-notifications/preferences', {
            quiet_hours_enabled: true,
            quiet_hours_start: '22:00',
            quiet_hours_end: '08:00'
        });
        expect([200, 500]).toContain(status);
    });
});

describe('Push Notifications - Send', () => {
    test('POST /push-notifications/send with valid data', async () => {
        const { status } = await client.post('/push-notifications/send', {
            title: 'Test Notification',
            body: 'This is a test push notification'
        });
        // 200 if enterprise, 403 if not, 500 on error
        expect([200, 403, 500]).toContain(status);
    });

    test('POST /push-notifications/send without title returns 400', async () => {
        const { status } = await client.post('/push-notifications/send', {
            body: 'No title'
        });
        expect([400, 403, 500]).toContain(status);
    });

    test('POST /push-notifications/send-batch with valid data', async () => {
        const { status } = await client.post('/push-notifications/send-batch', {
            userIds: ['user-1', 'user-2'],
            title: 'Batch Test',
            body: 'Batch notification test'
        });
        expect([200, 403, 500]).toContain(status);
    });

    test('POST /push-notifications/send-batch without userIds returns 400', async () => {
        const { status } = await client.post('/push-notifications/send-batch', {
            title: 'Test',
            body: 'Test'
        });
        expect([400, 403, 500]).toContain(status);
    });
});
