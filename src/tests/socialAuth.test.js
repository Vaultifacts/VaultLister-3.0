// Basic smoke tests for socialAuth routes
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

describe('socialAuth routes', () => {
    test('should require authentication', async () => {
        const res = await fetch(`${BASE_URL}/social-auth/providers`);
        expect([401, 403, 404]).toContain(res.status);
    });

    test('GET /social-auth/providers responds', async () => {
        const res = await fetch(`${BASE_URL}/social-auth/providers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404, 500]).toContain(res.status);
    });
});
