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
    test('should return 401 when no auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/status`);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('should return 401 when an invalid auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/status`, {
            headers: { 'Authorization': 'Bearer invalid.token.value' }
        });
        expect(res.status).toBe(401);
    });

    test('should return status payload when authenticated', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        const res = await fetch(`${DRIVE_BASE}/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        // Must include feature gate field — does not expose raw tokens
        expect(typeof data.featureEnabled).toBe('boolean');
        expect(typeof data.configured).toBe('boolean');
        expect(data.token).toBeUndefined();
        expect(data.accessToken).toBeUndefined();
    });
});

// ─── GET /api/integrations/google/drive/authorize ────────────────────────────

describe('GET /api/integrations/google/drive/authorize', () => {
    test('should return 401 when no auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/authorize`);
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('should return 401 when an invalid auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/authorize`, {
            headers: { 'Authorization': 'Bearer bad.token.here' }
        });
        expect(res.status).toBe(401);
    });

    test('should return 503 when FEATURE_GOOGLE_DRIVE is disabled', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        // The route reads process.env.FEATURE_GOOGLE_DRIVE at request time.
        // Temporarily disable it for this test only.
        const original = process.env.FEATURE_GOOGLE_DRIVE;
        process.env.FEATURE_GOOGLE_DRIVE = 'false';

        try {
            const res = await fetch(`${DRIVE_BASE}/authorize`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            expect(res.status).toBe(503);
            const data = await res.json();
            expect(data.error).toBeDefined();
        } finally {
            if (original === undefined) {
                delete process.env.FEATURE_GOOGLE_DRIVE;
            } else {
                process.env.FEATURE_GOOGLE_DRIVE = original;
            }
        }
    });

    test('should return 400 or 200 when feature is enabled and authenticated', async () => {
        if (!authToken) {
            console.log('Skipping: no auth token available');
            return;
        }
        // When FEATURE_GOOGLE_DRIVE is not 'false', the route either returns 400
        // (Google not configured — missing GOOGLE_CLIENT_ID/SECRET) or 200 with an authorizationUrl.
        const res = await fetch(`${DRIVE_BASE}/authorize`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 400]).toContain(res.status);
        if (res.status === 200) {
            const data = await res.json();
            expect(data.authorizationUrl).toBeDefined();
        }
        if (res.status === 400) {
            const data = await res.json();
            expect(data.configured).toBe(false);
        }
    });
});

// ─── POST /api/integrations/google/drive/backup ──────────────────────────────

describe('POST /api/integrations/google/drive/backup', () => {
    test('should return 401 when no auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('should return 401 when an invalid auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/backup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid.token.value'
            },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(401);
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
    test('should return 401 when no auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(401);
        const data = await res.json();
        expect(data.error).toBeDefined();
    });

    test('should return 401 when an invalid auth token is provided', async () => {
        const res = await fetch(`${DRIVE_BASE}/revoke`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer invalid.token.value' }
        });
        expect(res.status).toBe(401);
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
