/**
 * Billing Routes E2E Tests
 *
 * Covers: GET /plans, GET /usage, GET /subscription, POST /change-plan,
 * POST /prorate, POST /usage/refresh.
 * All tests are API-level. Stripe-dependent endpoints (checkout, portal, cancel)
 * are tested only for their error contracts since Stripe keys are not present in CI.
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let headers;
let originalTier;

async function getPostHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/billing/plans`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const csrf = res.headers()['x-csrf-token'] || '';
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    };
}

test.beforeAll(async ({ request }) => {
    const loginData = await apiLogin(request);
    token = loginData.token;
    headers = { Authorization: `Bearer ${token}` };

    // Record original tier so we can restore it after plan-change tests
    const subRes = await request.get(`${BASE_URL}/api/billing/subscription`, { headers });
    const subData = await subRes.json();
    originalTier = subData.tier || 'free';
});

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe('Billing routes — auth guard', () => {
    test('should return 401 when GET /plans called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/plans`);
        expect(res.status()).toBe(401);
    });

    test('should return 401 when GET /usage called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/usage`);
        expect(res.status()).toBe(401);
    });
});

// ── GET /api/billing/plans ───────────────────────────────────────────────────

test.describe('GET /api/billing/plans', () => {
    test('should return all four plans with name, price, limits, and features', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/plans`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.plans)).toBe(true);
        expect(data.plans.length).toBe(4);

        const planNames = data.plans.map(p => p.name);
        expect(planNames).toContain('free');
        expect(planNames).toContain('starter');
        expect(planNames).toContain('pro');
        expect(planNames).toContain('business');

        for (const plan of data.plans) {
            expect(typeof plan.price).toBe('number');
            expect(plan.limits).toHaveProperty('listings');
            expect(Array.isArray(plan.features)).toBe(true);
            expect(plan.features.length).toBeGreaterThan(0);
        }
    });

    test('should show free plan price as 0', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/plans`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        const freePlan = data.plans.find(p => p.name === 'free');
        expect(freePlan).toBeDefined();
        expect(freePlan.price).toBe(0);
    });
});

// ── GET /api/billing/usage ───────────────────────────────────────────────────

test.describe('GET /api/billing/usage', () => {
    test('should return usage array with metric and percentage_used fields', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/usage`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.usage)).toBe(true);

        for (const metric of data.usage) {
            expect(typeof metric.metric).toBe('string');
            expect(typeof metric.current_value).toBe('number');
            expect(typeof metric.percentage_used).toBe('number');
            expect(['none', 'warning', 'critical']).toContain(metric.warning_level);
        }
    });
});

// ── GET /api/billing/subscription ────────────────────────────────────────────

test.describe('GET /api/billing/subscription', () => {
    test('should return tier and stripe_active fields', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/subscription`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.tier).toBe('string');
        expect(typeof data.stripe_active).toBe('boolean');
    });

    test('should return stripe_active false and subscription null when no Stripe subscription exists', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/billing/subscription`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // Demo user has no Stripe subscription in test environment
        if (!data.stripe_active) {
            expect(data.subscription).toBeNull();
        }
    });
});

// ── POST /api/billing/change-plan ────────────────────────────────────────────

test.describe('POST /api/billing/change-plan', () => {
    test.describe.configure({ mode: 'serial' });

    test('should return 400 when planId is invalid', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/billing/change-plan`, {
            headers: ph,
            data: { planId: 'enterprise_ultra' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/invalid plan/i);
    });

    test('should return 400 when planId matches current plan', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/billing/change-plan`, {
            headers: ph,
            data: { planId: originalTier }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/already on this plan/i);
    });

    test('should successfully change plan to starter and return plan info', async ({ request }) => {
        if (originalTier === 'starter') test.skip();
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/billing/change-plan`, {
            headers: ph,
            data: { planId: 'starter' }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.plan).toBe('starter');
        expect(data.previous_plan).toBe(originalTier);
    });

    test('should restore original plan after change-plan test', async ({ request }) => {
        // Restore — skip if already on original tier
        const ph = await getPostHeaders(request);
        const subRes = await request.get(`${BASE_URL}/api/billing/subscription`, { headers });
        const subData = await subRes.json();
        if (subData.tier === originalTier) return;

        const res = await request.post(`${BASE_URL}/api/billing/change-plan`, {
            headers: ph,
            data: { planId: originalTier }
        });
        expect(res.status()).toBe(200);
    });
});

// ── POST /api/billing/prorate ─────────────────────────────────────────────────

test.describe('POST /api/billing/prorate', () => {
    test('should return proration amounts when valid billing cycle and plans are provided', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const now = new Date();
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const res = await request.post(`${BASE_URL}/api/billing/prorate`, {
            headers: ph,
            data: {
                current_plan: 'free',
                new_plan: 'pro',
                billing_cycle_start: cycleStart,
                billing_cycle_end: cycleEnd
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.prorated_charge).toBe('number');
        expect(typeof data.prorated_credit).toBe('number');
        expect(typeof data.amount_due).toBe('number');
        expect(data.current_plan).toBe('free');
        expect(data.new_plan).toBe('pro');
    });

    test('should return 400 when required fields are missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/billing/prorate`, {
            headers: ph,
            data: { current_plan: 'free', new_plan: 'pro' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/missing required fields/i);
    });

    test('should return 400 when plan name is invalid', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const now = new Date();
        const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        const res = await request.post(`${BASE_URL}/api/billing/prorate`, {
            headers: ph,
            data: {
                current_plan: 'ghost_plan',
                new_plan: 'pro',
                billing_cycle_start: cycleStart,
                billing_cycle_end: cycleEnd
            }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/invalid plan/i);
    });
});

// ── POST /api/billing/usage/refresh ──────────────────────────────────────────

test.describe('POST /api/billing/usage/refresh', () => {
    test('should return refreshed metrics with current_value and plan_limit', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/billing/usage/refresh`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toMatch(/refreshed/i);
        expect(Array.isArray(data.metrics)).toBe(true);
        for (const metric of data.metrics) {
            expect(typeof metric.metric).toBe('string');
            expect(typeof metric.current_value).toBe('number');
            expect(typeof metric.plan_limit).toBe('number');
        }
    });
});

// ── POST /api/billing/checkout — Stripe error contract ───────────────────────

test.describe('POST /api/billing/checkout — error contract', () => {
    test('should return 400 when planId is invalid or not a paid plan', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/billing/checkout`, {
            headers: ph,
            data: { planId: 'free' }
        });
        // free plan has no Stripe price ID — route returns 400
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/invalid planid/i);
    });
});
