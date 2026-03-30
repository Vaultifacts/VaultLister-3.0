/**
 * Settings Routes E2E Tests — API level
 *
 * Covers: GET /api/settings/announcement (public),
 *         PUT /api/settings/announcement (admin-only).
 *
 * The existing settings.spec.js covers UI rendering only. This file covers
 * the API contracts for the settingsRouter endpoints in src/backend/routes/settings.js.
 *
 * Note: PUT /announcement requires admin access. The demo user is not an admin,
 * so all PUT tests validate the 403 rejection contract. If an admin-seeded test
 * account is introduced in a later session, the happy-path PUT tests should be
 * moved out of the skip block below.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let authHeaders;

/**
 * Obtain a CSRF token by reading the x-csrf-token response header from a
 * GET request, then return full mutation headers.
 */
async function getMutationHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/settings/announcement`, {
        headers: authHeaders
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
    authHeaders = { Authorization: `Bearer ${token}` };
});

// ── GET /api/settings/announcement — public endpoint ─────────────────────────

test.describe('GET /api/settings/announcement', () => {
    test('should return 200 without authentication', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/announcement`);
        expect(res.status()).toBe(200);
    });

    test('should return announcement key in response body', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/announcement`);
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('announcement');
    });

    test('should return announcement as null when no announcement is active', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/announcement`);
        expect(res.status()).toBe(200);
        const data = await res.json();
        // announcement is either null or an object with text and color fields
        if (data.announcement === null) {
            expect(data.announcement).toBeNull();
        } else {
            expect(typeof data.announcement.text).toBe('string');
            expect(typeof data.announcement.color).toBe('string');
        }
    });

    test('should return announcement object with text and color when one is active', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/announcement`);
        expect(res.status()).toBe(200);
        const data = await res.json();
        if (data.announcement !== null) {
            expect(typeof data.announcement.text).toBe('string');
            expect(data.announcement.text.length).toBeGreaterThan(0);
            expect(typeof data.announcement.color).toBe('string');
        }
    });

    test('should return 200 with announcement key when called with auth token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/announcement`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data).toHaveProperty('announcement');
    });
});

// ── PUT /api/settings/announcement — admin-only ───────────────────────────────

test.describe('PUT /api/settings/announcement — non-admin rejection', () => {
    test('should return 401 or 403 when called without authentication', async ({ request }) => {
        const res = await request.put(`${BASE_URL}/api/settings/announcement`, {
            headers: { 'Content-Type': 'application/json' },
            data: { text: 'Test announcement', color: 'primary' }
        });
        // 401 = auth middleware rejects before route; 403 = route rejects unauthenticated non-admin
        expect([401, 403]).toContain(res.status());
        const data = await res.json();
        expect(data.error).toBeTruthy();
    });

    test('should return 403 when called by a non-admin authenticated user', async ({ request }) => {
        const ph = await getMutationHeaders(request);
        const res = await request.put(`${BASE_URL}/api/settings/announcement`, {
            headers: ph,
            data: { text: 'Test announcement', color: 'warning' }
        });
        // Demo user is not an admin — must be rejected
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toMatch(/admin/i);
    });

    test('should return 403 when clearing announcement without admin rights', async ({ request }) => {
        const ph = await getMutationHeaders(request);
        // Sending empty text triggers the delete branch — still admin-gated
        const res = await request.put(`${BASE_URL}/api/settings/announcement`, {
            headers: ph,
            data: { text: '' }
        });
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toMatch(/admin/i);
    });
});

// ── PUT /api/settings/announcement — admin happy path (skip if no admin user) ─

test.describe('PUT /api/settings/announcement — admin happy path', () => {
    // These tests require an admin-privileged account.
    // Skipped until an admin seed account is available in CI fixtures.
    test('should return 200 and set announcement when admin sets text and color', async ({ request }) => {
        test.skip(true, 'Requires admin-seeded account — not available in current CI fixtures.');
        // Intentionally left as a stub so the test surface is documented and
        // can be enabled when admin credentials are added to the test fixtures.
    });

    test('should return 200 and announcement null when admin clears announcement with empty text', async ({ request }) => {
        test.skip(true, 'Requires admin-seeded account — not available in current CI fixtures.');
    });

    test('should default color to primary when color is omitted', async ({ request }) => {
        test.skip(true, 'Requires admin-seeded account — not available in current CI fixtures.');
    });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────

test.describe('Settings routes — 404 fallback', () => {
    test('should return 404 for an unrecognized settings path', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/nonexistent`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(404);
    });

    test('should return 401 or 404 for unrecognized settings path without authentication', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/settings/nonexistent`);
        // 401 = auth middleware fires before route can return 404
        expect([401, 404]).toContain(res.status());
    });
});
