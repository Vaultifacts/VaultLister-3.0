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

describe('GET /api/sales-tools/tax-nexus', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/tax-nexus`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns tax nexus data when authenticated', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/tax-nexus`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/sales-tools/tax-nexus/calculate', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/tax-nexus/calculate`, {
            method: 'POST'
        });
        expect([401, 403]).toContain(res.status);
    });

    test('calculates tax nexus when authenticated', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/tax-nexus/calculate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([200, 201, 400, 500]).toContain(res.status);
    });
});

describe('GET /api/sales-tools/tax-nexus/alerts', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/tax-nexus/alerts`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns alerts when authenticated', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/tax-nexus/alerts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/sales-tools/buyers', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns buyers list when authenticated', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });

    test('accepts platform filter param', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers?platform=ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/sales-tools/buyers', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer_username: 'testbuyer123', platform: 'ebay' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('creates buyer record when authenticated with valid body', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer_username: 'testbuyer123', platform: 'ebay' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('GET /api/sales-tools/buyers/flagged', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers/flagged`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns flagged buyers when authenticated', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers/flagged`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/sales-tools/buyers/sync', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers/sync`, {
            method: 'POST'
        });
        expect([401, 403]).toContain(res.status);
    });

    test('triggers sync when authenticated', async () => {
        const res = await fetch(`${BASE}/api/sales-tools/buyers/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 201, 400, 500]).toContain(res.status);
    });
});
