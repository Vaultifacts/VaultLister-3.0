import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
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

describe('GET /api/rate-limits/stats', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/stats`);
        expect([401, 403]).toContain(res.status);
    });

    test('regular user returns 403 (enterprise only)', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/rate-limits/blocked-ips', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/blocked-ips`);
        expect([401, 403]).toContain(res.status);
    });

    test('regular user returns 403 (enterprise only)', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/blocked-ips`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/rate-limits/blocked-users', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/blocked-users`);
        expect([401, 403]).toContain(res.status);
    });

    test('regular user returns 403 (enterprise only)', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/blocked-users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/rate-limits/history', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/history`);
        expect([401, 403]).toContain(res.status);
    });

    test('regular user returns 403 (enterprise only)', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/history?hours=24`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/rate-limits/alerts', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/alerts`);
        expect([401, 403]).toContain(res.status);
    });

    test('regular user returns 403 (enterprise only)', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/alerts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});

describe('POST /api/rate-limits/reset', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/reset`, { method: 'POST' });
        expect([401, 403]).toContain(res.status);
    });

    test('regular user returns 403 (enterprise only)', async () => {
        const res = await fetch(`${BASE}/api/rate-limits/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect(res.status).toBe(403);
    });
});
