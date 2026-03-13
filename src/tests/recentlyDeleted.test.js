// Basic smoke tests for recentlyDeleted routes
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

describe('recentlyDeleted routes', () => {
    test('should require authentication', async () => {
        const res = await fetch(`${BASE_URL}/recently-deleted/`);
        expect([401, 403, 404]).toContain(res.status);
    });

    test('GET /recently-deleted/ responds', async () => {
        const res = await fetch(`${BASE_URL}/recently-deleted/`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404]).toContain(res.status);
    });

    test('GET /recently-deleted/stats responds', async () => {
        const res = await fetch(`${BASE_URL}/recently-deleted/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404]).toContain(res.status);
    });
});
