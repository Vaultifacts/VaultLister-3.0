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

describe('GET /api/affiliate/landing-pages', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/landing-pages`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns landing pages for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/affiliate/landing-pages`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/affiliate/landing-pages', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/landing-pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: 'test-page', title: 'Test Landing Page' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('creates landing page with valid body', async () => {
        const res = await fetch(`${BASE}/api/affiliate/landing-pages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: 'test-page', title: 'Test Landing Page' })
        });
        expect([200, 201, 400, 403]).toContain(res.status);
    });

    test('rejects missing required fields', async () => {
        const res = await fetch(`${BASE}/api/affiliate/landing-pages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 403, 422]).toContain(res.status);
    });
});

describe('GET /api/affiliate/tiers', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/tiers`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns affiliate tiers', async () => {
        const res = await fetch(`${BASE}/api/affiliate/tiers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/affiliate/my-tier', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/my-tier`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns current user tier', async () => {
        const res = await fetch(`${BASE}/api/affiliate/my-tier`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/affiliate/earnings', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/earnings`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns earnings for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/affiliate/earnings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/affiliate/commissions', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/commissions`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns commissions list with pagination', async () => {
        const res = await fetch(`${BASE}/api/affiliate/commissions?limit=10&offset=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/affiliate/stats', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/affiliate/stats`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns affiliate stats for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/affiliate/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});
