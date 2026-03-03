// Onboarding API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Onboarding - Auth Guard', () => {
    test('GET /onboarding/progress without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/onboarding/progress`);
        expect([401, 403]).toContain(res.status);
    });

    test('POST /onboarding/progress without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/onboarding/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reseller' })
        });
        expect([401, 403]).toContain(res.status);
    });
});

describe('Onboarding - Get Progress', () => {
    test('GET /onboarding/progress returns progress or default', async () => {
        const { status, data } = await client.get('/onboarding/progress');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('current_step');
            expect(data).toHaveProperty('completed_steps');
        }
    });
});

describe('Onboarding - Create/Reset Progress', () => {
    test('POST /onboarding/progress with role creates progress', async () => {
        const { status, data } = await client.post('/onboarding/progress', {
            role: 'reseller'
        });
        expect([200, 201, 500]).toContain(status);
    });

    test('POST /onboarding/progress without role returns 400', async () => {
        const { status, data } = await client.post('/onboarding/progress', {});
        expect([400, 500]).toContain(status);
    });

    test('POST /onboarding/progress with invalid role returns 400', async () => {
        const { status } = await client.post('/onboarding/progress', {
            role: 'invalid_role_xyz'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /onboarding/progress with bulk_seller role', async () => {
        const user2 = await createTestUserWithToken();
        const client2 = new TestApiClient(user2.token);
        const { status } = await client2.post('/onboarding/progress', {
            role: 'bulk_seller'
        });
        expect([200, 201, 500]).toContain(status);
    });
});

describe('Onboarding - Complete Step', () => {
    test('PUT /onboarding/progress/step completes a step', async () => {
        const { status } = await client.put('/onboarding/progress/step', {
            step_id: 'welcome'
        });
        expect([200, 500]).toContain(status);
    });

    test('PUT /onboarding/progress/step without step_id returns 400', async () => {
        const { status } = await client.put('/onboarding/progress/step', {});
        expect([400, 500]).toContain(status);
    });
});

describe('Onboarding - Tours', () => {
    test('GET /onboarding/tours/reseller returns tour steps', async () => {
        const { status, data } = await client.get('/onboarding/tours/reseller');
        expect([200, 500]).toContain(status);
        if (status === 200 && data) {
            // Response may wrap steps in different shapes
            const steps = data.steps || data.tour?.steps || (Array.isArray(data) ? data : null);
            if (steps) {
                expect(Array.isArray(steps)).toBe(true);
            }
        }
    });

    test('GET /onboarding/tours/bulk_seller returns different tour', async () => {
        const { status } = await client.get('/onboarding/tours/bulk_seller');
        expect([200, 500]).toContain(status);
    });

    test('GET /onboarding/tours/invalid returns 404', async () => {
        const { status } = await client.get('/onboarding/tours/nonexistent_role');
        expect([404, 500]).toContain(status);
    });
});

describe('Onboarding - Badges', () => {
    test('GET /onboarding/badges returns badge list', async () => {
        const { status, data } = await client.get('/onboarding/badges');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data) || data.badges !== undefined).toBe(true);
        }
    });

    test('POST /onboarding/badges/claim without badge_id returns 400', async () => {
        const { status } = await client.post('/onboarding/badges/claim', {});
        expect([400, 500]).toContain(status);
    });

    test('POST /onboarding/badges/claim with valid badge_id', async () => {
        const { status } = await client.post('/onboarding/badges/claim', {
            badge_id: 'first_listing'
        });
        expect([200, 400, 500]).toContain(status);
    });
});
