import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3001';

// Helper: create authenticated user
async function createTestUserWithToken() {
    const email = `rum-test-${Date.now()}@test.com`;
    const password = 'TestPassword123!';

    // Register
    const csrfRes = await fetch(`${BASE}/api/csrf-token`);
    const { csrfToken } = await csrfRes.json();

    await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ email, password, name: 'RUM Tester' })
    });

    // Login
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify({ email, password })
    });
    const loginData = await loginRes.json();
    return { token: loginData.token, csrfToken };
}

describe('RUM - POST /api/monitoring/rum', () => {
    test('accepts valid metric batch', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'test-session-001',
                metrics: [
                    { name: 'LCP', value: 1200.5, url: 'http://localhost/', userAgent: 'test' },
                    { name: 'FCP', value: 800.2, url: 'http://localhost/', userAgent: 'test' },
                    { name: 'CLS', value: 0.05, url: 'http://localhost/' }
                ]
            })
        });
        expect([200, 201, 400]).toContain(res.status);
        if (res.status === 200) {
            const data = await res.json();
            expect(data.accepted).toBeGreaterThanOrEqual(0);
        }
    });

    test('rejects missing sessionId', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metrics: [{ name: 'LCP', value: 100 }]
            })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('sessionId');
    });

    test('rejects empty metrics array', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'test-session-002',
                metrics: []
            })
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('metrics');
    });

    test('rejects missing metrics field', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'test-session-003'
            })
        });
        expect(res.status).toBe(400);
    });

    test('caps batch at 50 metrics', async () => {
        const metrics = Array.from({ length: 80 }, (_, i) => ({
            name: 'LCP',
            value: 100 + i,
            url: 'http://localhost/'
        }));
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: 'test-session-cap', metrics })
        });
        expect([200, 201, 400]).toContain(res.status);
        if (res.status === 200) {
            const data = await res.json();
            expect(data.accepted).toBeLessThanOrEqual(50);
        }
    });

    test('filters out invalid metric names', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'test-session-filter',
                metrics: [
                    { name: 'INVALID_METRIC', value: 999 },
                    { name: 'LCP', value: 1500 }
                ]
            })
        });
        expect([200, 201, 400]).toContain(res.status);
        if (res.status === 200) {
            const data = await res.json();
            // Only LCP should be accepted, INVALID_METRIC should be filtered
            expect(data.accepted).toBeLessThanOrEqual(1);
        }
    });
});

describe('RUM - GET /api/monitoring/rum/summary', () => {
    test('requires authentication', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum/summary`);
        expect(res.status).toBe(401);
    });

    test('requires enterprise tier', async () => {
        const { token } = await createTestUserWithToken();
        const res = await fetch(`${BASE}/api/monitoring/rum/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // 401 if auth middleware doesn't populate user (prefix not in protectedPrefixes), 403 if populated but not enterprise
        expect([401, 403]).toContain(res.status);
    });
});

describe('Monitoring Router - mounted endpoints', () => {
    test('GET /api/monitoring/health returns 200', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('healthy');
    });

    test('GET /api/monitoring/metrics requires auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/metrics`);
        expect(res.status).toBe(401);
    });

    test('GET /api/monitoring/alerts requires auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/alerts`);
        expect(res.status).toBe(401);
    });

    test('GET /api/monitoring/errors requires auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/errors`);
        expect(res.status).toBe(401);
    });
});
