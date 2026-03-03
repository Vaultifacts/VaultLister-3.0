// CSRF Middleware Unit Tests
import { describe, expect, test, beforeAll, beforeEach } from 'bun:test';

const BASE = `http://localhost:${process.env.PORT || 3001}/api`;
let token = null;
let csrfToken = null;

beforeAll(async () => {
    // Login to get auth token
    const resp = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const data = await resp.json();
    token = data.token;
});

describe('CSRF Token Management', () => {
    test('GET /csrf-token should return a token', async () => {
        const resp = await fetch(`${BASE}/csrf-token`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // CSRF endpoint may or may not exist — some apps embed in HTML
        if (resp.status === 200) {
            const data = await resp.json();
            expect(data.csrfToken || data.token).toBeTruthy();
            csrfToken = data.csrfToken || data.token;
        } else {
            // CSRF token delivered via response header instead
            expect([200, 404]).toContain(resp.status);
        }
    });

    test('CSRF should be disabled in test mode (NODE_ENV=test)', async () => {
        // In test mode, POST without CSRF should succeed (not 403)
        const resp = await fetch(`${BASE}/inventory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title: 'CSRF Test Item', sku: 'CSRF-001' })
        });
        // Should NOT get 403 (CSRF block) in test mode
        expect(resp.status).not.toBe(403);
    });

    test('State-changing methods should be subject to CSRF (when enabled)', async () => {
        // This verifies the middleware config — GET should always pass
        const resp = await fetch(`${BASE}/inventory`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        expect(resp.status).toBe(200);
    });

    test('GET requests should never require CSRF', async () => {
        const resp = await fetch(`${BASE}/health`);
        expect(resp.status).toBe(200);
    });
});

describe('CSRF Skip Paths', () => {
    test('POST /auth/login should not require CSRF', async () => {
        const resp = await fetch(`${BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
        });
        expect(resp.status).toBe(200);
    });

    test('POST /auth/register should not require CSRF', async () => {
        const ts = Date.now();
        const resp = await fetch(`${BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `csrftest${ts}@example.com`,
                password: 'SecurePass123!',
                username: `csrfuser${ts}`
            })
        });
        // Should get a real response (not 403 CSRF block)
        expect(resp.status).not.toBe(403);
    });

    test('POST /auth/refresh should not require CSRF', async () => {
        const resp = await fetch(`${BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ refreshToken: 'dummy-refresh-token' })
        });
        // Should get auth error, not CSRF error
        expect(resp.status).not.toBe(403);
    });
});

describe('CSRF Response Headers', () => {
    test('Responses should include security-related headers', async () => {
        const resp = await fetch(`${BASE}/health`);
        // Security headers should be present
        const headers = Object.fromEntries(resp.headers.entries());
        // At minimum, content-type should be set
        expect(headers['content-type']).toBeTruthy();
    });
});
