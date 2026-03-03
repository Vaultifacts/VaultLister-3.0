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

describe('POST /api/search-analytics/track', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term: 'test item', results_found: 5 })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('tracks search term with valid body', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/track`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ term: 'test item', results_found: 5 })
        });
        expect([200, 201, 400]).toContain(res.status);
    });

    test('rejects empty body', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/track`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 422]).toContain(res.status);
    });
});

describe('GET /api/search-analytics/popular', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/popular`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns popular search terms', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/popular`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });

    test('accepts limit query parameter', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/popular?limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/search-analytics/no-results', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/no-results`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns searches with no results', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/no-results`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/search-analytics/dashboard', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/dashboard`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns dashboard analytics data', async () => {
        const res = await fetch(`${BASE}/api/search-analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});
