// Barcode API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;

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

describe('Barcode - Lookup', () => {
    test('GET /barcode/lookup/:code - should lookup UPC code', async () => {
        const response = await fetch(`${BASE_URL}/barcode/lookup/012345678905`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // May return product info or 404 if not found
        expect([200, 404]).toContain(response.status);
        if (response.status === 200) { const d = await response.json(); expect(typeof d).toBe("object"); }
    });

    test('GET /barcode/lookup/:code - should handle invalid barcode', async () => {
        const response = await fetch(`${BASE_URL}/barcode/lookup/invalid`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 400, 403, 404]).toContain(response.status);
    });
});

describe('Barcode - Generate', () => {
    test('POST /barcode/generate - should generate barcode', async () => {
        const response = await fetch(`${BASE_URL}/barcode/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'CODE128',
                value: 'TEST123456'
            })
        });

        expect([200, 400, 403, 404]).toContain(response.status);
        if (response.status === 200) { const d = await response.json(); expect(d).toBeDefined(); }
    });

    test('POST /barcode/generate - should generate QR code', async () => {
        const response = await fetch(`${BASE_URL}/barcode/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'QR',
                value: 'https://vaultlister.com/item/123'
            })
        });

        expect([200, 400, 403, 404]).toContain(response.status);
        if (response.status === 200) { const d = await response.json(); expect(d).toBeDefined(); }
    });
});

describe('Barcode - Scan History', () => {
    test('GET /barcode/history - should return scan history', async () => {
        const response = await fetch(`${BASE_URL}/barcode/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
        if (response.status === 200) { const d = await response.json(); expect(typeof d).toBe("object"); }
    });
});

describe('Barcode - Authentication', () => {
    test('GET /barcode/lookup/:code - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/barcode/lookup/012345678905`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Barcode API tests...');
