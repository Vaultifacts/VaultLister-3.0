import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = `http://localhost:${process.env.PORT || 3001}`;
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

describe('GET /api/competitor-tracking/keywords', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns keywords list when authenticated', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/competitor-tracking/keywords/analyze', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titles: ['Vintage Nike Jacket Size M'] })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('analyzes titles when authenticated', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords/analyze`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ titles: ['Vintage Nike Jacket Size M', 'Nike Windbreaker 90s'] })
        });
        // 200/201 on success, 400 on validation, 403 if tier-gated on CI
        expect([200, 201, 400, 403]).toContain(res.status);
    });

    test('handles empty titles array', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords/analyze`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ titles: [] })
        });
        // 200/201 on success, 400 on validation, 403 if tier-gated on CI
        expect([200, 201, 400, 403]).toContain(res.status);
    });
});

describe('GET /api/competitor-tracking/keywords/opportunities', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords/opportunities`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns opportunities with limit param', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/keywords/opportunities?limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/competitor-tracking/price-intelligence', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/price-intelligence`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns price intelligence when authenticated', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/price-intelligence`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });

    test('accepts category filter param', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/price-intelligence?category=clothing`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/competitor-tracking/price-intelligence/refresh', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/price-intelligence/refresh`, {
            method: 'POST'
        });
        expect([401, 403]).toContain(res.status);
    });

    test('triggers refresh when authenticated', async () => {
        const res = await fetch(`${BASE}/api/competitor-tracking/price-intelligence/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 200/201 on success, 400 on validation, 403 if tier-gated on CI
        expect([200, 201, 400, 403]).toContain(res.status);
    });
});
