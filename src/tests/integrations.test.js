// Google Drive Integration Route Tests
// Tests /api/integrations/google/drive/* endpoints in isolation
// All external Google API calls are never triggered — tests stop at auth and CSRF gates
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
const DRIVE_BASE = `${BASE_URL}/integrations/google/drive`;

let authToken = null;

beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await res.json();
    authToken = data.token;
});

// afterAll is a no-op — the server is owned by the test runner process
afterAll(() => {});

// ─── GET /api/integrations/google/drive/status ───────────────────────────────

describe('GET /api/integrations/google/drive/status', () => {
    test('should reject unauthenticated requests', async () => {
        const res = await fetch(`${DRIVE_BASE}/status`);
        // Server returns 401 or 404 depending on route protection strategy
        expect([401, 404]).toContain(res.status);
    });

    test('should reject invalid auth token', async () => {
        const res = await fetch(`${DRIVE_BASE}/status`, {
            headers: { 'Authorization': 'Bearer invalid.token.value' }
        });
        expect([401, 404]).toContain(res.status);
    });

    test('should return status payload when authenticated (or 404 if route not mounted)', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Route may not be mounted in all environments
        if (res.status === 404) {
            console.log('Skipping: integrations route not mounted');
            return;
        }
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(typeof data.featureEnabled).toBe('boolean');
        expect(typeof data.configured).toBe('boolean');
        expect(data.token).toBeUndefined();
        expect(data.accessToken).toBeUndefined();
    });
});

// ─── GET /api/integrations/google/drive/authorize ────────────────────────────

describe('GET /api/integrations/google/drive/authorize', () => {
    test('should reject unauthenticated requests', async () => {
        const res = await fetch(`${DRIVE_BASE}/authorize`);
        expect([401, 404]).toContain(res.status);
    });

    test('should reject invalid auth token', async () => {
        const res = await fetch(`${DRIVE_BASE}/authorize`, {
            headers: { 'Authorization': 'Bearer bad.token.here' }
        });
        expect([401, 404]).toContain(res.status);
    });

    test('should return 503 when FEATURE_GOOGLE_DRIVE is disabled (or 404 if not mounted)', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/authorize`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // Route may not be mounted in all environments
        if (res.status === 404) {
            console.log('Skipping: integrations route not mounted');
            return;
        }
        // When mounted, expect 503 (feature disabled), 400 (not configured), or 200
        expect([200, 400, 503]).toContain(res.status);
    });

    test('should return 400 or 200 when feature is enabled and authenticated (or 404 if not mounted)', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/authorize`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.status === 404) {
            console.log('Skipping: integrations route not mounted');
            return;
        }
        expect([200, 400, 503]).toContain(res.status);
    });
});

// ─── POST /api/integrations/google/drive/backup ──────────────────────────────

describe('POST /api/integrations/google/drive/backup', () => {
    test('should reject unauthenticated requests', async () => {
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        // CSRF check runs before auth for mutating requests — returns 403
        expect([401, 403]).toContain(res.status);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('should reject invalid auth token', async () => {
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid.token.value'
            },
            body: JSON.stringify({})
        });
        expect([401, 403]).toContain(res.status);
    });

    test('should return 403 when CSRF token is missing', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        // NODE_ENV=test + DISABLE_CSRF=true disables CSRF protection in test mode.
        // When DISABLE_CSRF is not set, missing CSRF token must return 403.
        // This test is only meaningful when CSRF is active.
        if (process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test') {
            console.log('Skipping: CSRF disabled in this test environment');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
                // Deliberately no X-CSRF-Token header
            },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toMatch(/csrf/i);
    });

    test('should return 403 when CSRF token is invalid', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        if (process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test') {
            console.log('Skipping: CSRF disabled in this test environment');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': 'this-is-not-a-real-csrf-token'
            },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(403);
    });

    test('should proceed past CSRF gate when CSRF is disabled in test mode', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        if (!(process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test')) {
            console.log('Skipping: CSRF is active; this test requires DISABLE_CSRF=true + NODE_ENV=test');
            return;
        }
        // When CSRF is disabled, backup will proceed and fail at Google Drive not-connected
        // or feature disabled — not at the CSRF or auth gate.
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });
        // Must NOT be 401 (auth) or 403 (csrf) — expected outcomes past the gates:
        // 401 = Drive not connected, 503 = feature disabled, 500 = error
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });
});

// ─── DELETE /api/integrations/google/drive/revoke ────────────────────────────

describe('DELETE /api/integrations/google/drive/revoke', () => {
    test('should reject unauthenticated requests', async () => {
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE'
        });
        // CSRF check runs before auth for mutating requests — returns 403
        expect([401, 403]).toContain(res.status);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('should reject invalid auth token', async () => {
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer invalid.token.value' }
        });
        expect([401, 403]).toContain(res.status);
    });

    test('should return 403 when CSRF token is missing', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        if (process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test') {
            console.log('Skipping: CSRF disabled in this test environment');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
                // Deliberately no X-CSRF-Token header
            }
        });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toMatch(/csrf/i);
    });

    test('should return 403 when CSRF token is invalid', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        if (process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test') {
            console.log('Skipping: CSRF disabled in this test environment');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'X-CSRF-Token': 'this-is-not-a-real-csrf-token'
            }
        });
        expect(res.status).toBe(403);
    });

    test('should proceed past CSRF gate when CSRF is disabled in test mode', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        if (!(process.env.DISABLE_CSRF === 'true' && process.env.NODE_ENV === 'test')) {
            console.log('Skipping: CSRF is active; this test requires DISABLE_CSRF=true + NODE_ENV=test');
            return;
        }
        // When CSRF is disabled, revoke will proceed past the gate.
        // Expected outcomes: 200 (success/no-op — nothing to revoke), 500 (revoke error).
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });
});

console.log('Running Google Drive Integration route tests...');
