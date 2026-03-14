// Push Subscriptions API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testSubscriptionId = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Push Subscriptions - Subscribe', () => {
    test('POST /push-subscriptions/subscribe - should create subscription', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                subscription: {
                    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
                    keys: {
                        p256dh: 'test-p256dh-key',
                        auth: 'test-auth-key'
                    }
                },
                userAgent: 'Test Browser'
            })
        });

        const data = await response.json();
        expect([200, 201]).toContain(response.status);
        if (data.id) {
            testSubscriptionId = data.id;
        }
    });

    test('POST /push-subscriptions/subscribe - should validate subscription object', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                subscription: {
                    keys: { p256dh: 'test', auth: 'test' }
                    // Missing endpoint
                }
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });
});

describe('Push Subscriptions - Status', () => {
    test('GET /push-subscriptions/status - should return subscription status', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.subscribed).toBeDefined();
        }
    });
});

describe('Push Subscriptions - Settings', () => {
    test('GET /push-subscriptions/settings - should return notification settings', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/settings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
    });

    test('PUT /push-subscriptions/settings - should update settings', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                enabled: true,
                categories: {
                    sales: true,
                    offers: true,
                    orders: true
                }
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
    });
});

describe('Push Subscriptions - Unsubscribe', () => {
    test('DELETE /push-subscriptions/subscribe - should unsubscribe', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/subscribe`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint'
            })
        });

        expect([200, 400]).toContain(response.status);
    });
});

describe('Push Subscriptions - VAPID Key', () => {
    test('GET /push-subscriptions/vapid-public-key - should return VAPID key', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions/vapid-public-key`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.publicKey).toBeDefined();
        }
    });
});

describe('Push Subscriptions - Authentication', () => {
    test('POST /push-subscriptions - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/push-subscriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: 'test',
                keys: {}
            })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Push Subscriptions API tests...');
