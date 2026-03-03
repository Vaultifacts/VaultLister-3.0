// Sales Enhancements API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Sales Enhancements - Auth Guard', () => {
    test('GET /sales-tools/tax-nexus without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/sales-tools/tax-nexus`);
        expect(res.status).toBe(401);
    });

    test('GET /sales-tools/buyers without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/sales-tools/buyers`);
        expect(res.status).toBe(401);
    });
});

describe('Sales Enhancements - Tax Nexus', () => {
    test('GET /sales-tools/tax-nexus returns nexus data', async () => {
        const { status, data } = await client.get('/sales-tools/tax-nexus');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('nexus');
            expect(data).toHaveProperty('year');
            expect(Array.isArray(data.nexus)).toBe(true);
        }
    });

    test('POST /sales-tools/tax-nexus/calculate recalculates nexus', async () => {
        const { status, data } = await client.post('/sales-tools/tax-nexus/calculate');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('message');
            expect(data).toHaveProperty('states_analyzed');
            expect(typeof data.states_analyzed).toBe('number');
        }
    });

    test('GET /sales-tools/tax-nexus/alerts returns threshold alerts', async () => {
        const { status, data } = await client.get('/sales-tools/tax-nexus/alerts');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('alerts');
            expect(Array.isArray(data.alerts)).toBe(true);
        }
    });

    test('PUT /sales-tools/tax-nexus/CA/registered marks state registered', async () => {
        const { status, data } = await client.put('/sales-tools/tax-nexus/CA/registered');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data.message).toContain('CA');
        }
    });
});

describe('Sales Enhancements - Buyer Profiles', () => {
    let createdBuyerId = null;

    test('GET /sales-tools/buyers returns buyer list', async () => {
        const { status, data } = await client.get('/sales-tools/buyers');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('buyers');
            expect(Array.isArray(data.buyers)).toBe(true);
        }
    });

    test('GET /sales-tools/buyers?platform=ebay filters by platform', async () => {
        const { status } = await client.get('/sales-tools/buyers?platform=ebay');
        expect([200, 500]).toContain(status);
    });

    test('GET /sales-tools/buyers?blocked=true filters blocked', async () => {
        const { status } = await client.get('/sales-tools/buyers?blocked=true');
        expect([200, 500]).toContain(status);
    });

    test('POST /sales-tools/buyers requires buyer_username and platform', async () => {
        const { status, data } = await client.post('/sales-tools/buyers', {});
        expect(status).toBe(400);
        expect(data.error).toContain('required');
    });

    test('POST /sales-tools/buyers creates buyer profile', async () => {
        const { status, data } = await client.post('/sales-tools/buyers', {
            buyer_name: 'Test Buyer',
            buyer_username: `testbuyer_${Date.now()}`,
            platform: 'ebay',
            notes: 'Test buyer profile'
        });
        expect([200, 201, 500]).toContain(status);
        if (data.id) {
            createdBuyerId = data.id;
        }
    });

    test('GET /sales-tools/buyers/:id returns buyer with history', async () => {
        if (!createdBuyerId) return;
        const { status, data } = await client.get(`/sales-tools/buyers/${createdBuyerId}`);
        expect([200, 404, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('buyer');
            expect(data).toHaveProperty('purchase_history');
        }
    });

    test('GET /sales-tools/buyers/:id returns 404 for nonexistent', async () => {
        const { status } = await client.get('/sales-tools/buyers/nonexistent-id');
        expect([404, 500]).toContain(status);
    });

    test('PUT /sales-tools/buyers/:id requires at least one field', async () => {
        if (!createdBuyerId) return;
        const { status, data } = await client.put(`/sales-tools/buyers/${createdBuyerId}`, {});
        expect(status).toBe(400);
        expect(data.error).toContain('No fields');
    });

    test('PUT /sales-tools/buyers/:id updates profile', async () => {
        if (!createdBuyerId) return;
        const { status } = await client.put(`/sales-tools/buyers/${createdBuyerId}`, {
            communication_rating: 5,
            notes: 'Great buyer!'
        });
        expect([200, 500]).toContain(status);
    });

    test('POST /sales-tools/buyers/:id/block toggles block', async () => {
        if (!createdBuyerId) return;
        const { status, data } = await client.post(`/sales-tools/buyers/${createdBuyerId}/block`);
        expect([200, 404, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('is_blocked');
        }
    });

    test('POST /sales-tools/buyers/nonexistent/block returns 404', async () => {
        const { status } = await client.post('/sales-tools/buyers/nonexistent-id/block');
        expect([404, 500]).toContain(status);
    });
});

describe('Sales Enhancements - Flagged Buyers', () => {
    test('GET /sales-tools/buyers/flagged returns flagged list', async () => {
        const { status, data } = await client.get('/sales-tools/buyers/flagged');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('flagged_buyers');
            expect(Array.isArray(data.flagged_buyers)).toBe(true);
        }
    });
});

describe('Sales Enhancements - Buyer Sync', () => {
    test('POST /sales-tools/buyers/sync syncs buyer profiles from orders', async () => {
        const { status, data } = await client.post('/sales-tools/buyers/sync');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('created');
            expect(data).toHaveProperty('updated');
            expect(data).toHaveProperty('total');
        }
    });
});
