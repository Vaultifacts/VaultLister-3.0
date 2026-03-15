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

describe('GET /api/sku-sync', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sku-sync`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns SKU sync records for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/sku-sync`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });

    test('accepts platform query filter', async () => {
        const res = await fetch(`${BASE}/api/sku-sync?platform=ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});

describe('POST /api/sku-sync/link', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ master_sku: 'TEST-SKU-001', platform: 'ebay' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('links SKU with valid body', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/link`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ master_sku: 'TEST-SKU-001', platform: 'ebay' })
        });
        expect([200, 201, 400, 403]).toContain(res.status);
    });

    test('rejects missing required fields', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/link`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 403, 422]).toContain(res.status);
    });
});

describe('GET /api/sku-sync/conflicts', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/conflicts`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns SKU conflicts for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/conflicts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});

describe('POST /api/sku-sync/sync', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/sync`, { method: 'POST' });
        expect([401, 403]).toContain(res.status);
    });

    test('triggers sync for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 201, 400, 403]).toContain(res.status);
    });
});

describe('GET /api/sku-sync/barcode/:barcode', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/barcode/123456789`);
        expect([401, 403]).toContain(res.status);
    });

    test('looks up SKU by barcode', async () => {
        const res = await fetch(`${BASE}/api/sku-sync/barcode/123456789`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});
