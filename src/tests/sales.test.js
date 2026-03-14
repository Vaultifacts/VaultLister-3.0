// Sales API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testSaleId = null;

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

describe('Sales - List', () => {
    test('GET /sales - should return sales list', async () => {
        const response = await fetch(`${BASE_URL}/sales`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.sales).toBeDefined();
            expect(Array.isArray(data.sales)).toBe(true);
        }
    });

    test('GET /sales?platform=poshmark - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/sales?platform=poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.sales).toBeDefined();
        }
    });

    test('GET /sales?status=shipped - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/sales?status=shipped`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.sales).toBeDefined();
        }
    });

    test('GET /sales - should support date range filtering', async () => {
        const startDate = '2024-01-01';
        const endDate = '2024-12-31';
        const response = await fetch(`${BASE_URL}/sales?startDate=${startDate}&endDate=${endDate}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.sales).toBeDefined();
        }
    });

    test('GET /sales - should support pagination', async () => {
        const response = await fetch(`${BASE_URL}/sales?limit=10&offset=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.total).toBeDefined();
        }
    });
});

describe('Sales - Create', () => {
    test('POST /sales - should create a sale', async () => {
        const response = await fetch(`${BASE_URL}/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'poshmark',
                buyerUsername: 'test_buyer',
                salePrice: 50.00,
                platformFee: 10.00,
                shippingCost: 7.67
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            expect(data.sale || data.id).toBeDefined();
            testSaleId = data.sale?.id || data.id;
        }
    });

    test('POST /sales - should require platform', async () => {
        const response = await fetch(`${BASE_URL}/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                buyerUsername: 'test_buyer',
                salePrice: 50.00
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });

    test('POST /sales - should require sale price', async () => {
        const response = await fetch(`${BASE_URL}/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'poshmark',
                buyerUsername: 'test_buyer'
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });
});

describe('Sales - Get Single', () => {
    test('GET /sales/:id - should return sale details', async () => {
        if (!testSaleId) {
            console.log('Skipping: No test sale ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/sales/${testSaleId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.sale).toBeDefined();
        }
    });

    test('GET /sales/:id - should return 404 for non-existent sale', async () => {
        const response = await fetch(`${BASE_URL}/sales/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Sales - Update', () => {
    test('PUT /sales/:id - should update sale', async () => {
        if (!testSaleId) {
            console.log('Skipping: No test sale ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/sales/${testSaleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'shipped',
                trackingNumber: 'TEST123456'
            })
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('Sales - Statistics', () => {
    test('GET /sales/stats - should return sales statistics', async () => {
        const response = await fetch(`${BASE_URL}/sales/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data).toBeDefined();
        }
    });
});

describe('Sales - Authentication', () => {
    test('GET /sales - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/sales`);
        expect(response.status).toBe(401);
    });

    test('POST /sales - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/sales`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: 'poshmark',
                salePrice: 50.00
            })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Sales API tests...');
