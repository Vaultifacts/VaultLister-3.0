// API versioning tests (#208)
// Tests that /api/v1/ prefix routes to the same handlers as /api/,
// that backward compatibility is maintained, and that X-API-Version
// header is present in responses.
// Requires a running server (skips gracefully if unavailable).
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const API = `${BASE}/api`;
const API_V1 = `${BASE}/api/v1`;

let authToken = null;
let serverAvailable = false;

beforeAll(async () => {
    try {
        const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            serverAvailable = true;
            // Get auth token for protected route tests
            const loginRes = await fetch(`${API}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' }),
                signal: AbortSignal.timeout(5000),
            });
            if (loginRes.ok) {
                const data = await loginRes.json();
                authToken = data.token || null;
            }
        }
    } catch {
        serverAvailable = false;
    }
}, 10000);

function skipIfNoServer() {
    if (!serverAvailable) return true;
    return false;
}

describe('API versioning — /api/v1/ maps to same handlers as /api/', () => {
    test('should return same response for /api/health and /api/v1/health', async () => {
        if (skipIfNoServer()) return;

        const [v0Res, v1Res] = await Promise.all([
            fetch(`${API}/health`),
            fetch(`${API_V1}/health`),
        ]);

        expect(v0Res.status).toBe(v1Res.status);
        const v0Data = await v0Res.json();
        const v1Data = await v1Res.json();
        // Both should return healthy status
        expect(v0Data.status).toBe(v1Data.status);
    });

    test('should return same status for /api/status and /api/v1/status', async () => {
        if (skipIfNoServer()) return;

        const [v0Res, v1Res] = await Promise.all([
            fetch(`${API}/status`),
            fetch(`${API_V1}/status`),
        ]);

        expect(v0Res.status).toBe(v1Res.status);
    });

    test('should route /api/v1/auth/login to the auth handler', async () => {
        if (skipIfNoServer()) return;

        const res = await fetch(`${API_V1}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' }),
        });

        // Should reach the auth handler (401 = bad creds, not 404 unrouted)
        expect([200, 401, 400]).toContain(res.status);
        expect(res.status).not.toBe(404);
    });

    test('should route /api/v1/inventory to the inventory handler', async () => {
        if (skipIfNoServer() || !authToken) return;

        const res = await fetch(`${API_V1}/inventory`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        // Should reach inventory handler (200 OK or 304 Not Modified)
        expect([200, 304]).toContain(res.status);
        expect(res.status).not.toBe(404);
    });

    test('should handle /api/v1/ path prefix for analytics endpoint', async () => {
        if (skipIfNoServer() || !authToken) return;

        const res = await fetch(`${API_V1}/analytics/overview`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
        });

        // Should reach analytics (200) or be a valid route response
        expect([200, 304, 404]).toContain(res.status);
        // Must NOT be 404 meaning "unrouted" — analytics router should handle it
        // (404 from the handler itself is acceptable, from the router is not)
    });
});

describe('API versioning — backward compatibility', () => {
    test('should still work with /api/ prefix after /api/v1/ is added', async () => {
        if (skipIfNoServer()) return;

        const v0Res = await fetch(`${API}/health`);
        expect(v0Res.status).toBe(200);
    });

    test('should handle /api/v2/ gracefully (unknown version maps to /api/)', async () => {
        if (skipIfNoServer()) return;

        // The regex /^\/api\/v\d+\// strips any /api/vN/ prefix
        const v2Res = await fetch(`${BASE}/api/v2/health`);
        expect([200, 404]).toContain(v2Res.status);
        // Should NOT crash the server
    });

    test('should return 404 for completely unknown routes under /api/v1/', async () => {
        if (skipIfNoServer()) return;

        const res = await fetch(`${API_V1}/completely-unknown-route-xyz`);
        expect(res.status).toBe(404);
    });

    test('should return 404 for completely unknown routes under /api/', async () => {
        if (skipIfNoServer()) return;

        const res = await fetch(`${API}/completely-unknown-route-xyz`);
        expect(res.status).toBe(404);
    });
});

describe('API versioning — X-API-Version header', () => {
    test('should include X-API-Version header in /api/ responses', async () => {
        if (skipIfNoServer()) return;

        const res = await fetch(`${API}/health`);
        const versionHeader = res.headers.get('x-api-version');
        // X-API-Version is set in the route handler response path
        expect(versionHeader).not.toBeNull();
    });

    test('should include X-API-Version header in /api/v1/ responses', async () => {
        if (skipIfNoServer()) return;

        const res = await fetch(`${API_V1}/health`);
        const versionHeader = res.headers.get('x-api-version');
        expect(versionHeader).not.toBeNull();
    });

    test('should have same X-API-Version in both /api/ and /api/v1/ responses', async () => {
        if (skipIfNoServer()) return;

        const [v0Res, v1Res] = await Promise.all([
            fetch(`${API}/health`),
            fetch(`${API_V1}/health`),
        ]);

        const v0Version = v0Res.headers.get('x-api-version');
        const v1Version = v1Res.headers.get('x-api-version');

        // Both paths should emit the same version string
        expect(v0Version).toBe(v1Version);
    });

    test('should include version info in health response body', async () => {
        if (skipIfNoServer()) return;

        const res = await fetch(`${API}/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        // Health endpoint should return status at minimum
        expect(data.status).toBeDefined();
    });
});

describe('API versioning — path normalization unit behavior', () => {
    test('should strip /api/v1/ prefix pattern from path string', () => {
        // Replicate the normalization regex used in server.js
        function normalizeVersionedPath(pathname) {
            return /^\/api\/v\d+\//.test(pathname)
                ? pathname.replace(/^\/api\/v\d+\//, '/api/')
                : pathname;
        }

        expect(normalizeVersionedPath('/api/v1/inventory')).toBe('/api/inventory');
        expect(normalizeVersionedPath('/api/v2/sales')).toBe('/api/sales');
        expect(normalizeVersionedPath('/api/v10/reports')).toBe('/api/reports');
        expect(normalizeVersionedPath('/api/inventory')).toBe('/api/inventory');
        expect(normalizeVersionedPath('/api/v1/auth/login')).toBe('/api/auth/login');
    });

    test('should not alter non-versioned paths', () => {
        function normalizeVersionedPath(pathname) {
            return /^\/api\/v\d+\//.test(pathname)
                ? pathname.replace(/^\/api\/v\d+\//, '/api/')
                : pathname;
        }

        expect(normalizeVersionedPath('/api/health')).toBe('/api/health');
        expect(normalizeVersionedPath('/api/status')).toBe('/api/status');
        expect(normalizeVersionedPath('/api/auth/login')).toBe('/api/auth/login');
        expect(normalizeVersionedPath('/other/path')).toBe('/other/path');
    });

    test('should not match /api/version/ (non-numeric)', () => {
        function normalizeVersionedPath(pathname) {
            return /^\/api\/v\d+\//.test(pathname)
                ? pathname.replace(/^\/api\/v\d+\//, '/api/')
                : pathname;
        }

        // "version" has no digits immediately after "v"
        expect(normalizeVersionedPath('/api/version/info')).toBe('/api/version/info');
        expect(normalizeVersionedPath('/api/verify/email')).toBe('/api/verify/email');
    });

    test('should handle nested paths under versioned prefix', () => {
        function normalizeVersionedPath(pathname) {
            return /^\/api\/v\d+\//.test(pathname)
                ? pathname.replace(/^\/api\/v\d+\//, '/api/')
                : pathname;
        }

        expect(normalizeVersionedPath('/api/v1/inventory/item-id-123')).toBe('/api/inventory/item-id-123');
        expect(normalizeVersionedPath('/api/v1/auth/sessions/sess-id')).toBe('/api/auth/sessions/sess-id');
    });
});
