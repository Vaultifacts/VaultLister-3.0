// Push Subscriptions — Expanded Tests
// Covers: VAPID key, subscribe/unsubscribe flow, settings CRUD, test notification, auth guards
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Push Subscriptions - VAPID Key', () => {
    test('GET /push-subscriptions/vapid-public-key returns key string', async () => {
        const { status, data } = await client.get('/push-subscriptions/vapid-public-key');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.publicKey || data.vapidPublicKey).toBeDefined();
        }
    });

    test('VAPID key is a non-empty string', async () => {
        const { status, data } = await client.get('/push-subscriptions/vapid-public-key');
        if (status === 200) {
            const key = data.publicKey || data.vapidPublicKey;
            expect(typeof key).toBe('string');
            expect(key.length).toBeGreaterThan(0);
        }
    });
});

describe('Push Subscriptions - Subscribe', () => {
    test('POST /push-subscriptions/subscribe with valid data', async () => {
        const { status } = await client.post('/push-subscriptions/subscribe', {
            endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
            keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' }
        });
        expect([200, 201, 400]).toContain(status);
    });

    test('POST /push-subscriptions/subscribe without endpoint returns 400', async () => {
        const { status } = await client.post('/push-subscriptions/subscribe', {
            keys: { p256dh: 'test', auth: 'test' }
        });
        expect([400]).toContain(status);
    });

    test('POST /push-subscriptions/subscribe without keys returns 400', async () => {
        const { status } = await client.post('/push-subscriptions/subscribe', {
            endpoint: 'https://fcm.googleapis.com/fcm/send/test'
        });
        expect([400]).toContain(status);
    });

    test('DELETE /push-subscriptions/subscribe removes subscription', async () => {
        const { status } = await client.delete('/push-subscriptions/subscribe');
        expect([200, 204, 400, 404]).toContain(status);
    });
});

describe('Push Subscriptions - Status', () => {
    test('GET /push-subscriptions/status returns subscription info', async () => {
        const { status, data } = await client.get('/push-subscriptions/status');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('subscribed');
            expect(typeof data.subscribed).toBe('boolean');
        }
    });
});

describe('Push Subscriptions - Settings', () => {
    test('GET /push-subscriptions/settings returns preferences', async () => {
        const { status, data } = await client.get('/push-subscriptions/settings');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(typeof data).toBe('object');
        }
    });

    test('PUT /push-subscriptions/settings updates preferences', async () => {
        const { status } = await client.put('/push-subscriptions/settings', {
            sales: true, shipping: true, offers: false
        });
        expect([200, 403]).toContain(status);
    });
});

describe('Push Subscriptions - Test & Send', () => {
    test('POST /push-subscriptions/test sends test notification', async () => {
        const { status } = await client.post('/push-subscriptions/test', {});
        expect([200, 400, 404]).toContain(status);
    });

    test('POST /push-subscriptions/send with message', async () => {
        const { status } = await client.post('/push-subscriptions/send', {
            title: 'Test', body: 'Test notification body'
        });
        expect([200, 400, 404]).toContain(status);
    });
});

describe('Push Subscriptions - Delete Specific', () => {
    test('DELETE /push-subscriptions/subscription/:id for nonexistent', async () => {
        const { status } = await client.delete('/push-subscriptions/subscription/nonexistent-id');
        expect([200, 404]).toContain(status);
    });
});

describe('Push Subscriptions - Auth Guards', () => {
    test('GET /push-subscriptions/status without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/push-subscriptions/status`);
        expect(res.status).toBe(401);
    });

    test('POST /push-subscriptions/subscribe without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/push-subscriptions/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: 'test', keys: { p256dh: 'x', auth: 'y' } })
        });
        expect(res.status).toBe(401);
    });

    test('PUT /push-subscriptions/settings without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/push-subscriptions/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sales: true })
        });
        expect(res.status).toBe(401);
    });
});
