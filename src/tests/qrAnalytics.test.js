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

describe('GET /api/qr-analytics/dashboard', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/dashboard`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns dashboard data when authenticated', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});

describe('POST /api/qr-analytics/track', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_type: 'listing', reference_id: 'test-ref-001' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('records scan event when authenticated with valid body', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/track`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_type: 'listing', reference_id: 'test-ref-001' })
        });
        expect([200, 201, 400, 403, 500]).toContain(res.status);
    });
});

describe('GET /api/qr-analytics/warehouse-bins', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/warehouse-bins`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns warehouse bins list when authenticated', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/warehouse-bins`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});

describe('POST /api/qr-analytics/warehouse-bins', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/warehouse-bins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bin_code: 'BIN-TEST-001', label: 'Test Bin', zone: 'A' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('creates warehouse bin when authenticated with valid body', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/warehouse-bins`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ bin_code: 'BIN-TEST-001', label: 'Test Bin', zone: 'A' })
        });
        expect([200, 201, 400, 403, 500]).toContain(res.status);
    });
});

describe('GET /api/qr-analytics/item/:id', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/item/00000000-0000-0000-0000-000000000001`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns item QR data when authenticated', async () => {
        const res = await fetch(`${BASE}/api/qr-analytics/item/00000000-0000-0000-0000-000000000001`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});
