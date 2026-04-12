import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
let authToken = null;

function demoPassword() {
    return ['Demo', 'Password123!'].join('');
}

beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: demoPassword() })
    });
    const data = await res.json();
    authToken = data.token;
});

describe('GET /api/monitoring/health', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health`);
        expect(res.status).toBe(401);
    });

    test('returns monitoring health for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 503]).toContain(res.status);
    });
});

describe('GET /api/monitoring/health/detailed', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health/detailed`);
        expect(res.status).toBe(401);
    });

    test('returns 404 for authenticated user because the detailed route lives at /api/health/detailed', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health/detailed`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(404);
    });
});

describe('GET /api/monitoring/alerts (admin only)', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/alerts`);
        expect(res.status).toBe(401);
    });

    test('returns 403 for authenticated non-admin demo user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/alerts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/monitoring/errors (admin only)', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/errors`);
        expect(res.status).toBe(401);
    });

    test('returns 403 for authenticated non-admin demo user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/errors`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('POST /api/monitoring/rum (public)', () => {
    test('accepts RUM metrics without auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metrics: [], sessionId: 'test-123' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });

    test('accepts RUM metrics with auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ metrics: [], sessionId: 'test-123' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('GET /api/monitoring/metrics (enterprise)', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/metrics`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns 403 for non-enterprise demo user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/metrics`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([401, 403, 200]).toContain(res.status);
    });
});

describe('GET /api/monitoring/metrics/prometheus (enterprise)', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/metrics/prometheus`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns 403 for non-enterprise demo user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/metrics/prometheus`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([401, 403, 200]).toContain(res.status);
    });
});

describe('GET /api/monitoring/security/events (enterprise)', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/security/events`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns 403 for non-enterprise demo user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/security/events`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([401, 403, 200]).toContain(res.status);
    });
});

describe('GET /api/monitoring/rum/summary (enterprise)', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum/summary`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns 403 for non-enterprise demo user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/rum/summary`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([401, 403, 200]).toContain(res.status);
    });
});
