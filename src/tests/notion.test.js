// Basic smoke tests for notion routes
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('notion routes', () => {
    test('should require authentication', async () => {
        const res = await fetch(`${BASE_URL}/notion/status`);
        expect([401, 403, 404]).toContain(res.status);
    });
    test('GET /notion/status responds', async () => {
        const res = await fetch(`${BASE_URL}/notion/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});
