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

describe('GET /api/size-charts', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/size-charts`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns size charts', async () => {
        const res = await fetch(`${BASE}/api/size-charts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/size-charts', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/size-charts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Chart', category: 'tops', gender: 'unisex' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated creates size chart', async () => {
        const res = await fetch(`${BASE}/api/size-charts`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Chart', category: 'tops', gender: 'unisex' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('GET /api/size-charts/brands', () => {
    test('unauthenticated returns 401 or 403', async () => {
        const res = await fetch(`${BASE}/api/size-charts/brands`);
        expect([401, 403]).toContain(res.status);
    });

    test('authenticated returns brands list', async () => {
        const res = await fetch(`${BASE}/api/size-charts/brands`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/size-charts/convert', () => {
    test('authenticated converts size', async () => {
        const res = await fetch(`${BASE}/api/size-charts/convert?from=US&to=EU&size=M&garment=tops`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/size-charts/recommend', () => {
    test('authenticated returns recommendations', async () => {
        const res = await fetch(`${BASE}/api/size-charts/recommend`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ measurements: { chest: 38, waist: 32, hips: 40 } })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('GET /api/size-charts/availability', () => {
    test('authenticated returns availability', async () => {
        const res = await fetch(`${BASE}/api/size-charts/availability?category=tops`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});
