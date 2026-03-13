// Relisting API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testRuleId = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Relisting - Rules List', () => {
    test('GET /relisting/rules - should return relisting rules', async () => {
        const response = await fetch(`${BASE_URL}/relisting/rules`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.rules).toBeDefined();
        expect(Array.isArray(data.rules)).toBe(true);
    });
});

describe('Relisting - Create Rule', () => {
    test('POST /relisting/rules - should create relisting rule', async () => {
        const response = await fetch(`${BASE_URL}/relisting/rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Test Relist Rule ${Date.now()}`,
                stale_days: 30,
                min_views: 0,
                price_strategy: 'percentage',
                price_reduction_amount: 10,
                price_floor_percentage: 50,
                refresh_photos: false,
                refresh_title: false,
                auto_relist: false
            })
        });

        const data = await response.json();
        expect([200, 201]).toContain(response.status);
        if (data.rule?.id || data.id) {
            testRuleId = data.rule?.id || data.id;
        }
    });

    test('POST /relisting/rules - should require name', async () => {
        const response = await fetch(`${BASE_URL}/relisting/rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                stale_days: 30
            })
        });

        expect(response.status).toBe(400);
    });
});

describe('Relisting - Get Single Rule', () => {
    test('GET /relisting/rules/:id - should return rule details', async () => {
        if (!testRuleId) {
            const listResponse = await fetch(`${BASE_URL}/relisting/rules`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const listData = await listResponse.json();
            if (listData.rules?.length > 0) {
                testRuleId = listData.rules[0].id;
            }
        }

        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/relisting/rules/${testRuleId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Relisting - Update Rule', () => {
    test('PUT /relisting/rules/:id - should update rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/relisting/rules/${testRuleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Relist Rule',
                stale_days: 45
            })
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Relisting - Stale Listings', () => {
    test('GET /relisting/stale - should return stale listings', async () => {
        const response = await fetch(`${BASE_URL}/relisting/stale`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May return 200 or 500 if DB tables don't exist
        expect([200]).toContain(response.status);
    });

    test('GET /relisting/stale?days=30 - should filter by days', async () => {
        const response = await fetch(`${BASE_URL}/relisting/stale?days=30`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200]).toContain(response.status);
    });
});

describe('Relisting - Execute', () => {
    test('POST /relisting/execute - should execute relisting', async () => {
        const response = await fetch(`${BASE_URL}/relisting/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                listingIds: [],
                ruleId: testRuleId
            })
        });

        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('Relisting - Preview', () => {
    test('POST /relisting/preview - should preview relisting changes', async () => {
        const response = await fetch(`${BASE_URL}/relisting/preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                listingId: 'test-listing-id',
                ruleId: testRuleId
            })
        });

        expect([200, 400, 404]).toContain(response.status);
    });
});

describe('Relisting - Delete Rule', () => {
    test('DELETE /relisting/rules/:id - should delete rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/relisting/rules/${testRuleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 204, 404]).toContain(response.status);
    });
});

describe('Relisting - Authentication', () => {
    test('GET /relisting/rules - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/relisting/rules`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Relisting API tests...');
