// Basic smoke tests for gdpr routes
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

describe('gdpr routes', () => {
    test('should require authentication', async () => {
        const res = await fetch(`${BASE_URL}/gdpr/consents`);
        expect([401, 403, 404]).toContain(res.status);
    });

    test('GET /gdpr/consents responds', async () => {
        const res = await fetch(`${BASE_URL}/gdpr/consents`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404]).toContain(res.status);
    });

    test('GET /gdpr/deletion-status responds', async () => {
        const res = await fetch(`${BASE_URL}/gdpr/deletion-status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Accept success or expected errors (404 if no data, 500 if dependency missing)
        expect([200, 404]).toContain(res.status);
    });
});
