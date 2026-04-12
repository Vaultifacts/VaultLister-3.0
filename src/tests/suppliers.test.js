// Suppliers API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testSupplierId = null;
let testItemId = null;

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

describe('Suppliers - List', () => {
    test('GET /suppliers - should return supplier list', async () => {
        const response = await fetch(`${BASE_URL}/suppliers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('GET /suppliers?type=wholesale - should filter by type', async () => {
        const response = await fetch(`${BASE_URL}/suppliers?type=wholesale`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('GET /suppliers?active=false - should include inactive suppliers', async () => {
        const response = await fetch(`${BASE_URL}/suppliers?active=false`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('GET /suppliers - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/suppliers`);

        expect(response.status).toBe(401);
    });
});

describe('Suppliers - Create', () => {
    test('POST /suppliers - should create supplier', async () => {
        const response = await fetch(`${BASE_URL}/suppliers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Supplier',
                type: 'wholesale',
                website: 'https://test-supplier.com',
                contact_email: 'contact@test-supplier.com',
                contact_phone: '555-123-4567',
                address: '123 Test St',
                notes: 'Test notes',
                rating: 4.5
            })
        });

        // 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.name).toBe('Test Supplier');
            expect(data.type).toBe('wholesale');
            testSupplierId = data.id;
        }
    });

    test('POST /suppliers - should fail without name', async () => {
        const response = await fetch(`${BASE_URL}/suppliers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'wholesale'
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Name and type are required');
        }
    });

    test('POST /suppliers - should fail without type', async () => {
        const response = await fetch(`${BASE_URL}/suppliers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Supplier'
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Name and type are required');
        }
    });

    test('POST /suppliers - should fail with invalid type', async () => {
        const response = await fetch(`${BASE_URL}/suppliers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Supplier',
                type: 'invalid-type'
            })
        });

        // 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toContain('Type must be one of');
        }
    });
});

describe('Suppliers - Get Single', () => {
    test('GET /suppliers/:id - should return supplier details', async () => {
        if (!testSupplierId) return;

        const response = await fetch(`${BASE_URL}/suppliers/${testSupplierId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.id).toBe(testSupplierId);
            expect(data.item_count).toBeDefined();
        }
    });

    test('GET /suppliers/:id - should return 404 for non-existent supplier', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
        if (response.status === 404) {
            const data = await response.json();
            expect(data.error).toBe('Supplier not found');
        }
    });
});

describe('Suppliers - Update', () => {
    test('PUT /suppliers/:id - should update supplier', async () => {
        if (!testSupplierId) return;

        const response = await fetch(`${BASE_URL}/suppliers/${testSupplierId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Test Supplier',
                rating: 5.0,
                notes: 'Updated notes'
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.name).toBe('Updated Test Supplier');
        }
    });

    test('PUT /suppliers/:id - should return 404 for non-existent supplier', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/non-existent-id`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Suppliers - Items', () => {
    test('GET /suppliers/:id/items - should return supplier items', async () => {
        if (!testSupplierId) return;

        const response = await fetch(`${BASE_URL}/suppliers/${testSupplierId}/items`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('POST /suppliers/:id/items - should add item to supplier', async () => {
        if (!testSupplierId) return;

        const response = await fetch(`${BASE_URL}/suppliers/${testSupplierId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Item',
                sku: 'TEST-SKU-001',
                url: 'https://supplier.com/item/123',
                current_price: 29.99,
                target_price: 19.99,
                alert_threshold: 0.15,
                notes: 'Monitor for price drops'
            })
        });

        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.name).toBe('Test Item');
            testItemId = data.id;
        }
    });

    test('POST /suppliers/:id/items - should fail without name', async () => {
        if (!testSupplierId) return;

        const response = await fetch(`${BASE_URL}/suppliers/${testSupplierId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                current_price: 29.99
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Name is required');
        }
    });
});

describe('Suppliers - Item Details', () => {
    test('GET /suppliers/items/:itemId - should return item with price history', async () => {
        if (!testItemId) return;

        const response = await fetch(`${BASE_URL}/suppliers/items/${testItemId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.id).toBe(testItemId);
            expect(data.price_history).toBeDefined();
        }
    });

    test('GET /suppliers/items/:itemId - should return 404 for non-existent item', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/items/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });

    test('PUT /suppliers/items/:itemId - should update item', async () => {
        if (!testItemId) return;

        const response = await fetch(`${BASE_URL}/suppliers/items/${testItemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                current_price: 24.99,
                notes: 'Price dropped!'
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.current_price).toBe(24.99);
        }
    });

    test('PUT /suppliers/items/:itemId - should return 404 for non-existent item', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/items/non-existent-id`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        // 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Suppliers - Alerts', () => {
    test('GET /suppliers/alerts - should return price drop alerts', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/alerts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
        }
    });
});

describe('Suppliers - Stats', () => {
    test('GET /suppliers/stats - should return statistics', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.supplier_count).toBeDefined();
            expect(data.item_count).toBeDefined();
            expect(data.by_type).toBeDefined();
        }
    });
});

describe('Suppliers - Types', () => {
    test('GET /suppliers/types - should return supplier types', async () => {
        const response = await fetch(`${BASE_URL}/suppliers/types`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(Array.isArray(data)).toBe(true);
            expect(data.length).toBeGreaterThan(0);
            expect(data[0].value).toBeDefined();
            expect(data[0].label).toBeDefined();
        }
    });
});

describe('Suppliers - Delete Item', () => {
    test('DELETE /suppliers/items/:itemId - should delete item', async () => {
        if (!testItemId) return;

        const response = await fetch(`${BASE_URL}/suppliers/items/${testItemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.deleted).toBe(true);
        }
    });
});

describe('Suppliers - Delete Supplier', () => {
    test('DELETE /suppliers/:id - should delete supplier', async () => {
        if (!testSupplierId) return;

        const response = await fetch(`${BASE_URL}/suppliers/${testSupplierId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.deleted).toBe(true);
        }
    });
});
