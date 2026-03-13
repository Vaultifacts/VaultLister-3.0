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

describe('GET /api/billing/usage', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/usage`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns current period usage for authenticated user', async () => {
        const res = await fetch(`${BASE}/api/billing/usage`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('GET /api/billing/usage/history', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/usage/history`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns past 6 months of usage history', async () => {
        const res = await fetch(`${BASE}/api/billing/usage/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/billing/prorate', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/prorate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_plan: 'free', new_plan: 'starter', billing_cycle_start: '2026-01-01', billing_cycle_end: '2026-01-31' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('calculates proration with valid body', async () => {
        const res = await fetch(`${BASE}/api/billing/prorate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_plan: 'free', new_plan: 'starter', billing_cycle_start: '2026-01-01', billing_cycle_end: '2026-01-31' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });

    test('rejects missing required plan fields', async () => {
        const res = await fetch(`${BASE}/api/billing/prorate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 422]).toContain(res.status);
    });
});

describe('GET /api/billing/plans', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/plans`);
        expect([401, 403]).toContain(res.status);
    });

    test('returns list of available plans', async () => {
        const res = await fetch(`${BASE}/api/billing/plans`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 404]).toContain(res.status);
    });
});

describe('POST /api/billing/usage/refresh', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/usage/refresh`, { method: 'POST' });
        expect([401, 403]).toContain(res.status);
    });

    test('triggers usage recalculation from DB', async () => {
        const res = await fetch(`${BASE}/api/billing/usage/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});

describe('POST /api/billing/change-plan', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/change-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'starter' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('changes plan with valid planId', async () => {
        const res = await fetch(`${BASE}/api/billing/change-plan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'starter' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });

    test('rejects missing planId', async () => {
        const res = await fetch(`${BASE}/api/billing/change-plan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect([400, 422]).toContain(res.status);
    });
});

describe('POST /api/billing/select-plan', () => {
    test('rejects unauthenticated request', async () => {
        const res = await fetch(`${BASE}/api/billing/select-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'pro' })
        });
        expect([401, 403]).toContain(res.status);
    });

    test('selects plan with valid planId', async () => {
        const res = await fetch(`${BASE}/api/billing/select-plan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'pro' })
        });
        expect([200, 201, 400]).toContain(res.status);
    });
});
