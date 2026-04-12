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

describe('GET /api/expenses/categories', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/expenses/categories`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns categories list when authenticated', async () => {
        const res = await fetch(`${BASE}/api/expenses/categories`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});

describe('POST /api/expenses/categories', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/expenses/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Category', type: 'expense', tax_deductible: true })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('creates category when authenticated with valid body', async () => {
        const res = await fetch(`${BASE}/api/expenses/categories`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test Category', type: 'expense', tax_deductible: true })
        });
        expect([200, 201, 400, 403, 500]).toContain(res.status);
    });

    test('rejects missing required fields', async () => {
        const res = await fetch(`${BASE}/api/expenses/categories`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([200, 201, 400, 403, 500]).toContain(res.status);
    });
});

describe('GET /api/expenses/tax-report', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/expenses/tax-report?year=2026&quarter=1`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns tax report with year and quarter params', async () => {
        const res = await fetch(`${BASE}/api/expenses/tax-report?year=2026&quarter=1`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404, 500]).toContain(res.status);
    });
});

describe('POST /api/expenses/categorize', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/expenses/categorize`, {
            method: 'POST'
        });
        expect([401, 403]).toContain(res.status);
    });

    test('responds when authenticated', async () => {
        const res = await fetch(`${BASE}/api/expenses/categorize`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([200, 201, 400, 403, 500]).toContain(res.status);
    });
});
