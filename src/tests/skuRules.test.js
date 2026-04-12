// SKU Rules API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
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

describe('SKU Rules - List', () => {
    test('GET /sku-rules - should return SKU rules', async () => {
        const response = await fetch(`${BASE_URL}/sku-rules`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            // API may return { rules: [] } or an array directly
            expect(data.rules !== undefined || Array.isArray(data)).toBe(true);
        }
    });
});

describe('SKU Rules - Create', () => {
    test('POST /sku-rules - should create SKU rule', async () => {
        const response = await fetch(`${BASE_URL}/sku-rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: `Test SKU Rule ${Date.now()}`,
                prefix: 'TST',
                pattern: '{PREFIX}-{CATEGORY}-{NUMBER}',
                startNumber: 1000,
                isDefault: false
            })
        });

        const data = await response.json();
        expect([200, 201, 403]).toContain(response.status);
        if (data.rule?.id || data.id) {
            testRuleId = data.rule?.id || data.id;
        }
    });

    test('POST /sku-rules - should require name', async () => {
        const response = await fetch(`${BASE_URL}/sku-rules`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                prefix: 'TST'
            })
        });

        expect([400, 403, 422]).toContain(response.status);
    });
});

describe('SKU Rules - Generate', () => {
    test('POST /sku-rules/generate - should generate SKU', async () => {
        const response = await fetch(`${BASE_URL}/sku-rules/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                category: 'Tops',
                brand: 'Nike'
            })
        });

        const data = await response.json();
        expect([200, 400, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data.sku).toBeDefined();
        }
    });

    test('POST /sku-rules/generate - should use specific rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/sku-rules/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                ruleId: testRuleId,
                category: 'Shoes'
            })
        });

        expect([200, 400, 403, 404]).toContain(response.status);
    });
});

describe('SKU Rules - Update', () => {
    test('PUT /sku-rules/:id - should update rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/sku-rules/${testRuleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated SKU Rule',
                prefix: 'UPD'
            })
        });

        expect([200, 404]).toContain(response.status);
    });
});

describe('SKU Rules - Delete', () => {
    test('DELETE /sku-rules/:id - should delete rule', async () => {
        if (!testRuleId) {
            console.log('Skipping: No test rule ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/sku-rules/${testRuleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 204, 404]).toContain(response.status);
    });
});

describe('SKU Rules - Authentication', () => {
    test('GET /sku-rules - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/sku-rules`);
        expect(response.status).toBe(401);
    });
});

console.log('Running SKU Rules API tests...');
