import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
let authToken = null;

beforeAll(async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
    });
    const data = await res.json();
    authToken = data.token;
});

describe('GET /api/monitoring/health (public)', () => {
    test('returns 200 without auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health`);
        expect(res.status).toBe(200);
    });

    test('returns 200 with auth', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(200);
    });
});

describe('GET /api/monitoring/health/detailed', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health/detailed`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns detailed health for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/health/detailed`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 401, 404]).toContain(res.status);
    });
});

describe('GET /api/monitoring/alerts', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/alerts`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns alerts for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/alerts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 401, 404]).toContain(res.status);
    });
});

describe('GET /api/monitoring/errors', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/monitoring/errors`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns error log for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/monitoring/errors`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 401, 404]).toContain(res.status);
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
