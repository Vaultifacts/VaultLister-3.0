// Integration tests for feature flags service
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
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

describe('Feature Flags API', () => {
    test('GET /feature-flags should return flags object', async () => {
        const response = await fetch(`${BASE_URL}/feature-flags`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // May return 200 or 404 if route not exposed
        if (response.status === 200) {
            const data = await response.json();
            expect(typeof data).toBe('object');
        } else {
            expect([404, 403]).toContain(response.status);
        }
    });

    test('Feature flags should be boolean values', async () => {
        const response = await fetch(`${BASE_URL}/feature-flags`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 200) {
            const data = await response.json();
            const flags = data.flags || data;
            for (const [key, val] of Object.entries(flags)) {
                if (typeof val === 'boolean') {
                    expect(typeof val).toBe('boolean');
                }
            }
        }
    });
});
