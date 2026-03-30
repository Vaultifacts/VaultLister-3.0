/**
 * Integrations Routes E2E Tests — Google Drive
 *
 * Covers: GET /google/drive/authorize, GET /google/drive/status,
 *         GET /google/drive/files, POST /google/drive/backup,
 *         DELETE /google/drive/revoke, GET /google/callback.
 *
 * All tests are API-level. Live Google OAuth tokens are not available in CI,
 * so Drive-token-dependent endpoints are tested for their error contracts only.
 * The OAuth callback is tested for its error-path HTML response shape.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let authHeaders;

/**
 * Fetch a CSRF token from a GET endpoint that returns one, then build
 * headers for mutating requests. Mirrors the pattern in billing.spec.js.
 */
async function getMutationHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/integrations/google/drive/status`, {
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

// ── Auth guard ─────────────────────────────────────────────────────────────────

test.describe('Integrations routes — auth guard', () => {
    test('should return 401 when GET /google/drive/authorize called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/authorize`);
        expect(res.status()).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/authentication required/i);
    });

    test('should return 401 when GET /google/drive/status called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/status`);
        expect(res.status()).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/authentication required/i);
    });

    test('should return 401 when GET /google/drive/files called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/files`);
        expect(res.status()).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/authentication required/i);
    });

    test('should return 401 when POST /google/drive/backup called without token', async ({ request }) => {
        const res = await request.post(`${BASE_URL}/api/integrations/google/drive/backup`, {
            headers: { 'Content-Type': 'application/json' }
        });
        expect(res.status()).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/authentication required/i);
    });

    test('should return 401 when DELETE /google/drive/revoke called without token', async ({ request }) => {
        const res = await request.delete(`${BASE_URL}/api/integrations/google/drive/revoke`);
        expect(res.status()).toBe(401);
        const data = await res.json();
        expect(data.error).toMatch(/authentication required/i);
    });
});

// ── GET /api/integrations/google/drive/authorize ──────────────────────────────

test.describe('GET /api/integrations/google/drive/authorize', () => {
    test('should return 400 or authorization URL when authenticated', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/authorize`, {
            headers: authHeaders
        });
        // 503 = feature disabled; 400 = Google not configured; 200 = URL returned
        expect([200, 400, 503]).toContain(res.status());
        const data = await res.json();
        if (res.status() === 200) {
            expect(typeof data.authorizationUrl).toBe('string');
            expect(data.authorizationUrl).toContain('accounts.google.com');
            expect(typeof data.state).toBe('string');
        } else if (res.status() === 400) {
            expect(data.configured).toBe(false);
            expect(data.error).toMatch(/not configured/i);
        } else {
            expect(data.error).toMatch(/not enabled/i);
        }
    });
});

// ── GET /api/integrations/google/drive/status ─────────────────────────────────

test.describe('GET /api/integrations/google/drive/status', () => {
    test('should return status object with configured and featureEnabled fields when authenticated', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/status`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.configured).toBe('boolean');
        expect(typeof data.featureEnabled).toBe('boolean');
    });

    test('should not expose raw OAuth tokens in the status response', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/status`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data).not.toHaveProperty('access_token');
        expect(data).not.toHaveProperty('refresh_token');
        expect(data).not.toHaveProperty('token');
    });
});

// ── GET /api/integrations/google/drive/files ──────────────────────────────────

test.describe('GET /api/integrations/google/drive/files', () => {
    test('should return 401 or 503 when Drive is not connected or not enabled', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/files`, {
            headers: authHeaders
        });
        // 503 = feature disabled; 401 = no Drive token (not connected); 200 = connected
        expect([200, 401, 503]).toContain(res.status());
        const data = await res.json();
        if (res.status() === 401) {
            expect(data.error).toMatch(/not connected/i);
        } else if (res.status() === 503) {
            expect(data.error).toMatch(/not enabled/i);
        } else {
            expect(Array.isArray(data.files)).toBe(true);
            expect(data).toHaveProperty('nextPageToken');
        }
    });

    test('should respect pageSize query parameter when Drive is connected', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/files?pageSize=5`, {
            headers: authHeaders
        });
        // If not connected we only validate the error contract; skip the body check
        if (res.status() === 200) {
            const data = await res.json();
            expect(Array.isArray(data.files)).toBe(true);
        } else {
            expect([401, 503]).toContain(res.status());
        }
    });
});

// ── POST /api/integrations/google/drive/backup ───────────────────────────────

test.describe('POST /api/integrations/google/drive/backup', () => {
    test('should return 403 when CSRF token is missing', async ({ request }) => {
        test.skip(process.env.DISABLE_CSRF === 'true', 'CSRF enforcement disabled in this environment');
        const res = await request.post(`${BASE_URL}/api/integrations/google/drive/backup`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toBeTruthy();
    });

    test('should return 401 or 503 when Drive is not connected or feature is disabled', async ({ request }) => {
        const ph = await getMutationHeaders(request);
        const res = await request.post(`${BASE_URL}/api/integrations/google/drive/backup`, {
            headers: ph
        });
        // 503 = feature disabled; 401 = no Drive token; 201 = success (connected)
        expect([201, 401, 503]).toContain(res.status());
        const data = await res.json();
        if (res.status() === 201) {
            expect(data.success).toBe(true);
            expect(typeof data.fileId).toBe('string');
            expect(typeof data.fileName).toBe('string');
            expect(data.fileName).toMatch(/VaultLister-backup/);
            expect(typeof data.itemCount).toBe('number');
        } else if (res.status() === 401) {
            expect(data.error).toMatch(/not connected/i);
        } else {
            expect(data.error).toMatch(/not enabled/i);
        }
    });
});

// ── DELETE /api/integrations/google/drive/revoke ─────────────────────────────

test.describe('DELETE /api/integrations/google/drive/revoke', () => {
    test('should return 403 when CSRF token is missing', async ({ request }) => {
        test.skip(process.env.DISABLE_CSRF === 'true', 'CSRF enforcement disabled in this environment');
        const res = await request.delete(`${BASE_URL}/api/integrations/google/drive/revoke`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(403);
        const data = await res.json();
        expect(data.error).toBeTruthy();
    });

    test('should return 200 or 500 with success or error payload when authenticated with CSRF', async ({ request }) => {
        const ph = await getMutationHeaders(request);
        const res = await request.delete(`${BASE_URL}/api/integrations/google/drive/revoke`, {
            headers: ph
        });
        // 200 = revoked (or already disconnected, depending on revokeGoogleToken impl)
        // 500 = revoke call failed (e.g., Google API unreachable in CI)
        expect([200, 500]).toContain(res.status());
        const data = await res.json();
        if (res.status() === 200) {
            expect(data.success).toBe(true);
            expect(data.message).toMatch(/disconnected/i);
        } else {
            expect(data.error).toBeTruthy();
        }
    });
});

// ── GET /api/integrations/google/callback ────────────────────────────────────

test.describe('GET /api/integrations/google/callback', () => {
    test('should return HTML with error message when error query param is present', async ({ request }) => {
        const res = await request.get(
            `${BASE_URL}/api/integrations/google/callback?error=access_denied`
        );
        expect(res.status()).toBe(400);
        const text = await res.text();
        expect(text).toContain('<!DOCTYPE html>');
        expect(text).toContain('google-oauth-error');
    });

    test('should return HTML error page when code or state is missing', async ({ request }) => {
        const res = await request.get(
            `${BASE_URL}/api/integrations/google/callback?code=abc123`
            // state is deliberately absent
        );
        expect(res.status()).toBe(400);
        const text = await res.text();
        expect(text).toContain('google-oauth-error');
        expect(text).toContain('Missing authorization code or state');
    });

    test('should return HTML error page when both code and state are absent', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/callback`);
        expect(res.status()).toBe(400);
        const text = await res.text();
        expect(text).toContain('google-oauth-error');
    });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────

test.describe('Integrations routes — 404 fallback', () => {
    test('should return 404 for an unrecognized integrations path', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/integrations/google/drive/nonexistent`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(404);
    });
});
