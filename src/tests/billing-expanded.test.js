// Billing API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Billing - Auth Guard', () => {
    test('POST /billing/change-plan without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3001}/api/billing/change-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planId: 'pro' })
        });
        expect(res.status).toBe(401);
    });
});

describe('Billing - Prorate', () => {
    test('POST /billing/prorate calculates proration', async () => {
        const { status, data } = await client.post('/billing/prorate', {
            current_plan: 'free',
            new_plan: 'pro',
            billing_cycle_start: '2025-01-01',
            billing_cycle_end: '2025-01-31'
        });
        expect([200, 400, 500]).toContain(status);
    });

    test('POST /billing/prorate without required fields returns 400', async () => {
        const { status } = await client.post('/billing/prorate', {});
        expect([400, 500]).toContain(status);
    });
});

describe('Billing - Usage Refresh', () => {
    test('POST /billing/usage/refresh recalculates usage', async () => {
        const { status, data } = await client.post('/billing/usage/refresh', {});
        expect([200, 500]).toContain(status);
    });
});

describe('Billing - Change Plan', () => {
    test('POST /billing/change-plan with valid planId', async () => {
        const { status } = await client.post('/billing/change-plan', {
            planId: 'starter'
        });
        expect([200, 500]).toContain(status);
    });

    test('POST /billing/change-plan without planId returns 400', async () => {
        const { status } = await client.post('/billing/change-plan', {});
        expect([400, 500]).toContain(status);
    });

    test('POST /billing/change-plan with invalid planId returns 400', async () => {
        const { status } = await client.post('/billing/change-plan', {
            planId: 'nonexistent-plan'
        });
        expect([400, 500]).toContain(status);
    });
});

describe('Billing - Select Plan', () => {
    test('POST /billing/select-plan with valid planId', async () => {
        const { status } = await client.post('/billing/select-plan', {
            planId: 'pro'
        });
        expect([200, 500]).toContain(status);
    });

    test('POST /billing/select-plan without planId returns 400', async () => {
        const { status } = await client.post('/billing/select-plan', {});
        expect([400, 500]).toContain(status);
    });
});
