// Inventory HTTP Validation Tests
// Verifies that server-side field validation is enforced at the HTTP layer —
// not just in unit-tested utility functions.
// Covers: title length, invalid condition, negative price, price too large,
//         missing required fields, boundary values, XSS in title.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

// ============================================================
// Title Validation
// ============================================================
describe('Inventory Validation - Title', () => {
    test('POST /inventory with no title returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            listPrice: 25.00
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory with empty string title returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: '',
            listPrice: 25.00
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory with title exactly 500 chars succeeds', async () => {
        const { status } = await client.post('/inventory', {
            title: 'A'.repeat(500),
            listPrice: 10.00
        });
        expect([200, 201]).toContain(status);
    });

    test('POST /inventory with title > 500 chars returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'A'.repeat(501),
            listPrice: 10.00
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory title is stored correctly (no silent truncation)', async () => {
        const title = 'Exact Title Test Item ' + Date.now();
        const { status, data } = await client.post('/inventory', {
            title,
            listPrice: 15.00
        });
        if (status === 201) {
            const id = data.item?.id || data.id;
            if (id) {
                const { data: fetched } = await client.get(`/inventory/${id}`);
                expect(fetched.item?.title).toBe(title);
            }
        }
    });
});

// ============================================================
// Price Validation
// ============================================================
describe('Inventory Validation - Price', () => {
    test('POST /inventory with missing listPrice returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'No Price Item'
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory with negative listPrice returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'Negative Price Item',
            listPrice: -5.00
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory with listPrice = 0 is rejected (not a valid selling price)', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Zero Price Item',
            listPrice: 0
        });
        // The route checks `if (!listPrice)` which is falsy for 0 — expect 400
        expect(status).toBe(400);
    });

    test('POST /inventory with listPrice > 1,000,000 returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'Too Expensive Item',
            listPrice: 1_000_001
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory with non-numeric listPrice returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'String Price Item',
            listPrice: 'not-a-number'
        });
        expect(status).toBe(400);
        expect(data.error || data.errors).toBeDefined();
    });

    test('POST /inventory with valid decimal listPrice succeeds', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Decimal Price Item',
            listPrice: 19.99
        });
        expect([200, 201]).toContain(status);
    });
});

// ============================================================
// Condition Validation
// ============================================================
describe('Inventory Validation - Condition', () => {
    test('POST /inventory with invalid condition returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'Bad Condition Item',
            listPrice: 10.00,
            condition: 'mint_condition' // not in enum
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /inventory with valid condition "like_new" succeeds', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Like New Item',
            listPrice: 30.00,
            condition: 'like_new'
        });
        expect([200, 201]).toContain(status);
    });

    test('POST /inventory with valid condition "new" succeeds', async () => {
        const { status } = await client.post('/inventory', {
            title: 'New Item',
            listPrice: 45.00,
            condition: 'new'
        });
        expect([200, 201]).toContain(status);
    });

    test('POST /inventory with valid condition "good" succeeds', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Good Condition Item',
            listPrice: 20.00,
            condition: 'good'
        });
        expect([200, 201]).toContain(status);
    });
});

// ============================================================
// Quantity Validation
// ============================================================
describe('Inventory Validation - Quantity', () => {
    test('POST /inventory with negative quantity returns 400', async () => {
        const { status, data } = await client.post('/inventory', {
            title: 'Negative Qty Item',
            listPrice: 10.00,
            quantity: -1
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /inventory with float quantity returns 400', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Float Qty Item',
            listPrice: 10.00,
            quantity: 1.5
        });
        expect(status).toBe(400);
    });

    test('POST /inventory with quantity = 0 succeeds (out-of-stock item)', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Zero Qty Item',
            listPrice: 10.00,
            quantity: 0
        });
        expect([200, 201]).toContain(status);
    });
});

// ============================================================
// XSS / Malicious Input in Title
// ============================================================
describe('Inventory Validation - Input Sanitization', () => {
    test('POST /inventory with XSS in title is accepted but script tag is stripped', async () => {
        const xssTitle = '<script>alert("xss")</script>Vintage Jacket';
        const { status, data } = await client.post('/inventory', {
            title: xssTitle,
            listPrice: 25.00
        });

        if (status === 201) {
            const id = data.item?.id || data.id;
            if (id) {
                const { data: fetched } = await client.get(`/inventory/${id}`);
                const storedTitle = fetched.item?.title || '';
                // Script tag must not be stored
                expect(storedTitle).not.toContain('<script>');
                expect(storedTitle).not.toContain('alert(');
            }
        } else {
            // Alternatively rejected at validation — also acceptable
            expect(status).toBe(400);
        }
    });

    test('POST /inventory with description > 2000 chars returns 400', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Long Description Item',
            listPrice: 10.00,
            description: 'D'.repeat(2001)
        });
        expect(status).toBe(400);
    });

    test('POST /inventory with brand > 200 chars returns 400', async () => {
        const { status } = await client.post('/inventory', {
            title: 'Long Brand Item',
            listPrice: 10.00,
            brand: 'B'.repeat(201)
        });
        expect(status).toBe(400);
    });
});

// ============================================================
// Auth Guard
// ============================================================
describe('Inventory Validation - Auth Guard', () => {
    test('POST /inventory without token returns 401', async () => {
        const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Unauthed Item', listPrice: 10 })
        });
        expect(response.status).toBe(401);
    });

    test('GET /inventory/:id with nonexistent ID returns 404', async () => {
        const { status } = await client.get('/inventory/00000000-0000-0000-0000-000000000000');
        expect([404, 403]).toContain(status);
    });
});
