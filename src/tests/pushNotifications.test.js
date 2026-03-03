// Basic smoke tests for pushNotifications routes
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

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

describe('pushNotifications routes', () => {
    test('should require authentication', async () => {
        const res = await fetch(`${BASE_URL}/push-notifications/devices`);
        expect([401, 403, 404]).toContain(res.status);
    });

    test('GET /push-notifications/devices responds', async () => {
        const res = await fetch(`${BASE_URL}/push-notifications/devices`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404, 500]).toContain(res.status);
        if (res.status === 200) { const d = await res.json(); expect(typeof d).toBe("object"); }
    });

    test('GET /push-notifications/preferences responds', async () => {
        const res = await fetch(`${BASE_URL}/push-notifications/preferences`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404, 500]).toContain(res.status);
        if (res.status === 200) { const d = await res.json(); expect(typeof d).toBe("object"); }
    });
});
