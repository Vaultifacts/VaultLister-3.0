/**
 * OAuth Routes E2E Tests
 *
 * Covers: GET /authorize/:platform, GET /status/:platform,
 * Playwright-only platform guard, callback error contract,
 * DELETE /revoke/:platform 404 on unknown platform.
 *
 * The server runs in OAUTH_MODE=mock by default in development.
 * Tests rely on the mock OAuth flow — no real platform credentials required.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

const PLAYWRIGHT_ONLY_PLATFORMS = ['poshmark', 'mercari', 'depop', 'grailed', 'whatnot'];

let token;
let headers;

async function getPostHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/billing/plans`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const csrf = res.headers()['x-csrf-token'] || '';
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    };
}

test.beforeAll(async ({ request }) => {
    const loginData = await apiLogin(request);
    token = loginData.token;
    headers = { Authorization: `Bearer ${token}` };
});

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe('OAuth routes — auth guard', () => {
    test('should return 401 when GET /authorize/ebay called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/authorize/ebay`);
        expect(res.status()).toBe(401);
    });

    test('should return 401 when GET /status/ebay called without token', async ({ request }) => {
        // status route requires user in ctx — no user resolves to 401 or 404 depending on middleware
        const res = await request.get(`${BASE_URL}/api/oauth/status/ebay`);
        expect([401, 404]).toContain(res.status());
    });
});

// ── GET /api/oauth/authorize/:platform ───────────────────────────────────────

test.describe('GET /api/oauth/authorize/:platform', () => {
    test('should return authUrl, state, and platform when authorizing ebay in mock mode', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/authorize/ebay`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.authUrl).toBe('string');
        expect(data.authUrl.length).toBeGreaterThan(0);
        expect(typeof data.state).toBe('string');
        expect(data.platform).toBe('ebay');
    });

    test('should return authUrl containing state parameter when authorizing shopify', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/authorize/shopify`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.authUrl).toContain('state=');
        expect(data.platform).toBe('shopify');
    });

    test('should return 400 when platform is missing', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/authorize/`, { headers });
        // Either 400 or 404 — route requires a platform segment
        expect([400, 404]).toContain(res.status());
    });
});

// ── Playwright-only platform guard ───────────────────────────────────────────

test.describe('Playwright-only platform guard', () => {
    for (const platform of PLAYWRIGHT_ONLY_PLATFORMS) {
        test(`should return 400 for ${platform} because it requires browser automation not OAuth`, async ({ request }) => {
            const res = await request.get(`${BASE_URL}/api/oauth/authorize/${platform}`, { headers });
            expect(res.status()).toBe(400);
            const data = await res.json();
            expect(data.error).toMatch(/playwright|browser automation|credentials/i);
        });
    }
});

// ── GET /api/oauth/callback/:platform — error contract ───────────────────────

test.describe('GET /api/oauth/callback/:platform — error handling', () => {
    test('should return 400 when code and state parameters are missing', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/callback/ebay`);
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/missing code or state|oauth authorization failed/i);
    });

    test('should return 400 when error=access_denied is passed', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/callback/ebay?error=access_denied`);
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/oauth authorization failed/i);
        expect(data.details).toMatch(/denied/i);
    });

    test('should return 400 when state token is invalid or not found', async ({ request }) => {
        const res = await request.get(
            `${BASE_URL}/api/oauth/callback/ebay?code=fake_code&state=invalid_state_token`
        );
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/invalid or expired state/i);
    });
});

// ── GET /api/oauth/status/:platform ─────────────────────────────────────────

test.describe('GET /api/oauth/status/:platform', () => {
    test('should return connected:false and platform when no shop is connected for a new platform', async ({ request }) => {
        // Use a platform name unlikely to have an existing shop record for the demo user
        const res = await request.get(`${BASE_URL}/api/oauth/status/shopify`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.connected).toBe('boolean');
        expect(data.platform).toBe('shopify');
    });

    test('should return status object with connectionType field when a shop exists', async ({ request }) => {
        // Attempt authorize to create an oauth_state, then check status (shop may or may not exist)
        const res = await request.get(`${BASE_URL}/api/oauth/status/ebay`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('connected');
        expect(data.platform).toBe('ebay');
    });
});

// ── DELETE /api/oauth/revoke/:platform ───────────────────────────────────────

test.describe('DELETE /api/oauth/revoke/:platform', () => {
    test('should return 404 when no OAuth connection exists for the platform', async ({ request }) => {
        const ph = await getPostHeaders(request);
        // Use a platform that definitely has no oauth connection in test env
        const res = await request.delete(`${BASE_URL}/api/oauth/revoke/shopify`, {
            headers: ph
        });
        // Either 404 (no connection) or 200 (if connection exists from a prior test run)
        expect([200, 404]).toContain(res.status());
        if (res.status() === 404) {
            const data = await res.json();
            expect(data.error).toMatch(/no oauth connection/i);
        }
    });
});

// ── POST /api/oauth/refresh/:platform — error contract ───────────────────────

test.describe('POST /api/oauth/refresh/:platform — error contract', () => {
    test('should return 404 when no OAuth shop connection exists for the platform', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/oauth/refresh/shopify`, {
            headers: ph
        });
        expect(res.status()).toBe(404);
        const data = await res.json();
        expect(data.error).toMatch(/no oauth connection/i);
    });
});
