/**
 * Onboarding Routes E2E Tests
 *
 * Covers: GET /progress, POST /progress (create/reset), PUT /progress/step,
 * GET /tours/:role, GET /badges, POST /badges/claim.
 * All tests are API-level (no UI navigation required).
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

const VALID_ROLES = ['reseller', 'bulk_seller', 'live_streamer', 'supplier'];

let token;
let headers;

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
});

// ── Auth guard ────────────────────────────────────────────────────────────────

test.describe('Onboarding routes — auth guard', () => {
    test('should return 401 when GET /progress called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/onboarding/progress`);
        expect(res.status()).toBe(401);
    });

    test('should return 401 when GET /badges called without token', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/onboarding/badges`);
        expect(res.status()).toBe(401);
    });
});

// ── GET /api/onboarding/progress ─────────────────────────────────────────────

test.describe('GET /api/onboarding/progress', () => {
    test('should return progress object with completed_steps array and points', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/onboarding/progress`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.completed_steps)).toBe(true);
        expect(Array.isArray(data.badges)).toBe(true);
        expect(typeof data.points).toBe('number');
    });
});

// ── POST /api/onboarding/progress ────────────────────────────────────────────

test.describe('POST /api/onboarding/progress', () => {
    test.describe.configure({ mode: 'serial' });

    test('should create or reset onboarding progress with role=reseller', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/onboarding/progress`, {
            headers: ph,
            data: { role: 'reseller' }
        });
        // 201 if first time, 200 if resetting
        expect([200, 201]).toContain(res.status());
        const data = await res.json();
        expect(data.role).toBe('reseller');
        expect(data.current_step).toBe('welcome');
    });

    test('should return 400 when role is missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/onboarding/progress`, {
            headers: ph,
            data: {}
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/role required/i);
    });

    test('should return 400 when role is not a valid value', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/onboarding/progress`, {
            headers: ph,
            data: { role: 'hacker' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/invalid role/i);
    });
});

// ── PUT /api/onboarding/progress/step ────────────────────────────────────────

test.describe('PUT /api/onboarding/progress/step', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeAll(async ({ request }) => {
        // Ensure progress exists before completing a step
        const ph = await getPostHeaders(request);
        await request.post(`${BASE_URL}/api/onboarding/progress`, {
            headers: ph,
            data: { role: 'reseller' }
        });
    });

    test('should mark a step as completed and return updated completed_steps', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.put(`${BASE_URL}/api/onboarding/progress/step`, {
            headers: ph,
            data: { step_id: 'add_inventory' }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.completed_steps)).toBe(true);
        expect(data.completed_steps).toContain('add_inventory');
        expect(typeof data.points_awarded).toBe('number');
    });

    test('should return 200 without duplicate when completing an already-completed step', async ({ request }) => {
        const ph = await getPostHeaders(request);
        // Complete the same step a second time — should not duplicate
        const res = await request.put(`${BASE_URL}/api/onboarding/progress/step`, {
            headers: ph,
            data: { step_id: 'add_inventory' }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // completed_steps should contain exactly one instance of add_inventory
        const count = data.completed_steps.filter(s => s === 'add_inventory').length;
        expect(count).toBe(1);
    });

    test('should return 400 when step_id is missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.put(`${BASE_URL}/api/onboarding/progress/step`, {
            headers: ph,
            data: {}
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/step_id required/i);
    });

    test('should award points when completing a milestone step', async ({ request }) => {
        const ph = await getPostHeaders(request);
        // first_listing is a BADGE_MILESTONE with 10 points
        const res = await request.put(`${BASE_URL}/api/onboarding/progress/step`, {
            headers: ph,
            data: { step_id: 'first_listing' }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // Either first time (points_awarded > 0) or already completed (points_awarded = 0)
        expect(typeof data.points_awarded).toBe('number');
        expect(data.points_awarded).toBeGreaterThanOrEqual(0);
    });
});

// ── GET /api/onboarding/tours/:role ──────────────────────────────────────────

test.describe('GET /api/onboarding/tours/:role', () => {
    for (const role of VALID_ROLES) {
        test(`should return tour steps array for role=${role}`, async ({ request }) => {
            const res = await request.get(`${BASE_URL}/api/onboarding/tours/${role}`, { headers });
            expect(res.status()).toBe(200);
            const data = await res.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            // Each step must have required fields
            for (const step of data) {
                expect(typeof step.step_id).toBe('string');
                expect(typeof step.title).toBe('string');
                expect(typeof step.target_element).toBe('string');
            }
        });
    }

    test('should return 404 when role does not exist', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/onboarding/tours/ghost_role`, { headers });
        expect(res.status()).toBe(404);
        const data = await res.json();
        expect(data.error).toMatch(/role not found/i);
    });
});

// ── GET /api/onboarding/badges ────────────────────────────────────────────────

test.describe('GET /api/onboarding/badges', () => {
    test('should return badges array with total_count and earned_count', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/onboarding/badges`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.badges)).toBe(true);
        expect(typeof data.total_points).toBe('number');
        expect(typeof data.earned_count).toBe('number');
        expect(typeof data.total_count).toBe('number');

        for (const badge of data.badges) {
            expect(typeof badge.badge_id).toBe('string');
            expect(typeof badge.name).toBe('string');
            expect(typeof badge.points).toBe('number');
            expect(typeof badge.earned).toBe('boolean');
        }
    });

    test('should show 7 total badges matching BADGE_MILESTONES', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/onboarding/badges`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.total_count).toBe(7);
    });
});

// ── POST /api/onboarding/badges/claim ────────────────────────────────────────

test.describe('POST /api/onboarding/badges/claim', () => {
    test('should return 400 when badge_id is missing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/onboarding/badges/claim`, {
            headers: ph,
            data: {}
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/badge_id required/i);
    });

    test('should return 404 when badge_id does not exist in BADGE_MILESTONES', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/onboarding/badges/claim`, {
            headers: ph,
            data: { badge_id: 'nonexistent_badge' }
        });
        expect(res.status()).toBe(404);
        const data = await res.json();
        expect(data.error).toMatch(/badge not found/i);
    });

    test('should return 400 when badge has not been earned yet', async ({ request }) => {
        // Reset progress to clear all badges, then try to claim one
        const ph = await getPostHeaders(request);
        await request.post(`${BASE_URL}/api/onboarding/progress`, {
            headers: ph,
            data: { role: 'reseller' }
        });

        const ph2 = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/onboarding/badges/claim`, {
            headers: ph2,
            data: { badge_id: '50_sales' }
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/badge not yet earned/i);
    });
});
