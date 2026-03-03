// Offers API Tests
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

describe('Offers - List', () => {
    test('GET /offers - should return offers list', async () => {
        const response = await fetch(`${BASE_URL}/offers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.offers).toBeDefined();
        expect(Array.isArray(data.offers)).toBe(true);
        expect(data.total).toBeDefined();
        expect(data.pending).toBeDefined();
    });

    test('GET /offers?platform=poshmark - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/offers?platform=poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.offers).toBeDefined();
    });

    test('GET /offers?status=pending - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/offers?status=pending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.offers).toBeDefined();
    });

    test('GET /offers?limit=10&offset=0 - should paginate', async () => {
        const response = await fetch(`${BASE_URL}/offers?limit=10&offset=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.offers.length).toBeLessThanOrEqual(10);
    });
});

describe('Offers - Get Single', () => {
    test('GET /offers/:id - should return 404 for non-existent offer', async () => {
        const response = await fetch(`${BASE_URL}/offers/00000000-0000-0000-0000-000000000000`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Offers - Accept', () => {
    test('POST /offers/:id/accept - should return 404 for non-existent offer', async () => {
        const response = await fetch(`${BASE_URL}/offers/00000000-0000-0000-0000-000000000000/accept`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Offers - Decline', () => {
    test('POST /offers/:id/decline - should return 404 for non-existent offer', async () => {
        const response = await fetch(`${BASE_URL}/offers/00000000-0000-0000-0000-000000000000/decline`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Offers - Counter', () => {
    test('POST /offers/:id/counter - should require amount', async () => {
        const response = await fetch(`${BASE_URL}/offers/00000000-0000-0000-0000-000000000000/counter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('POST /offers/:id/counter - should return 404 for non-existent offer', async () => {
        const response = await fetch(`${BASE_URL}/offers/00000000-0000-0000-0000-000000000000/counter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ amount: 45.00 })
        });

        expect(response.status).toBe(404);
    });
});

describe('Offers - Rules', () => {
    test('GET /offers/rules - should return offer rules', async () => {
        const response = await fetch(`${BASE_URL}/offers/rules`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.rules).toBeDefined();
        expect(Array.isArray(data.rules)).toBe(true);
    });

    test('POST /offers/rules - should create offer rule', async () => {
        const response = await fetch(`${BASE_URL}/offers/rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Auto Accept 90%+ Offers',
                platform: 'poshmark',
                conditions: {
                    minPercentage: 90
                },
                actions: {
                    action: 'accept'
                },
                isEnabled: true
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.rule).toBeDefined();
        expect(data.rule.id).toBeDefined();
        expect(data.rule.name).toBe('Auto Accept 90%+ Offers');

        testRuleId = data.rule.id;
    });

    test('POST /offers/rules - should require name, conditions, and actions', async () => {
        const response = await fetch(`${BASE_URL}/offers/rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Missing fields'
                // Missing conditions and actions
            })
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('PUT /offers/rules/:id - should update offer rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/offers/rules/${testRuleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Auto Accept Rule',
                conditions: {
                    minPercentage: 85
                },
                isEnabled: false
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.rule).toBeDefined();
        expect(data.rule.name).toBe('Updated Auto Accept Rule');
    });

    test('PUT /offers/rules/:id - should return 404 for non-existent rule', async () => {
        const response = await fetch(`${BASE_URL}/offers/rules/00000000-0000-0000-0000-000000000000`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        expect(response.status).toBe(404);
    });
});

describe('Offers - Statistics', () => {
    test('GET /offers/stats - should return offer statistics', async () => {
        const response = await fetch(`${BASE_URL}/offers/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.stats).toBeDefined();
        expect(data.stats.total).toBeDefined();
        expect(data.stats.pending).toBeDefined();
        expect(data.stats.accepted).toBeDefined();
        expect(data.stats.declined).toBeDefined();
        expect(data.stats.avgOfferPercentage).toBeDefined();
        expect(data.stats.acceptRate).toBeDefined();
    });
});

describe('Offers - Delete Rule', () => {
    test('DELETE /offers/rules/:id - should delete offer rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/offers/rules/${testRuleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.message).toContain('deleted');
    });

    test('DELETE /offers/rules/:id - should return 404 for non-existent rule', async () => {
        const response = await fetch(`${BASE_URL}/offers/rules/00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Offers - Authentication', () => {
    test('GET /offers - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/offers`);
        expect(response.status).toBe(401);
    });

    test('POST /offers/rules - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/offers/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test', conditions: {}, actions: {} })
        });
        expect(response.status).toBe(401);
    });

    test('GET /offers/stats - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/offers/stats`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Offers API tests...');
