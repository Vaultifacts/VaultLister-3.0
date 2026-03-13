// Data Systems — net_profit formula + purchase precision (HTTP integration)
// Covers: net_profit = salePrice − platformFee − itemCost − sellerShipping − taxAmount,
//         sellerShippingCost override, purchase total floating-point precision,
//         sales date/platform filtering, validation guards.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

// ─── net_profit formula correctness ──────────────────────────────────────────

describe('net_profit — formula correctness (no COGS)', () => {
    test('no fees: net_profit equals sale_price exactly', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'poshmark',
            salePrice: 40.00
        });
        expect(status).toBe(201);
        const sale = data.sale;
        expect(sale).toBeDefined();
        // netProfit = 40 - 0 - 0 - 0 - 0 = 40
        expect(sale.net_profit).toBeCloseTo(40.00, 4);
    });

    test('platform fee only: net_profit = salePrice − platformFee', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'ebay',
            salePrice: 50.00,
            platformFee: 6.25
        });
        expect(status).toBe(201);
        // 50 - 6.25 = 43.75
        expect(data.sale.net_profit).toBeCloseTo(43.75, 4);
    });

    test('shipping only: net_profit = salePrice − shippingCost', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'mercari',
            salePrice: 30.00,
            shippingCost: 4.50
        });
        expect(status).toBe(201);
        // 30 - 4.50 = 25.50
        expect(data.sale.net_profit).toBeCloseTo(25.50, 4);
    });

    test('all fees: net_profit = salePrice − platformFee − shipping − tax', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'poshmark',
            salePrice: 100.00,
            platformFee: 20.00,
            shippingCost: 7.50,
            taxAmount: 3.25
        });
        expect(status).toBe(201);
        // 100 - 20 - 7.50 - 3.25 = 69.25
        expect(data.sale.net_profit).toBeCloseTo(69.25, 4);
    });

    test('explicit sellerShippingCost overrides shippingCost in formula', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'ebay',
            salePrice: 60.00,
            shippingCost: 10.00,       // customer paid this
            sellerShippingCost: 5.00,  // seller actually paid this (lower)
            platformFee: 3.00
        });
        expect(status).toBe(201);
        // When sellerShippingCost is provided, it is used instead of shippingCost
        // net = 60 - 3 - 5 = 52
        expect(data.sale.net_profit).toBeCloseTo(52.00, 4);
    });

    test('net_profit is persisted and survives a GET /sales/:id round-trip', async () => {
        const { status: createStatus, data: createData } = await client.post('/sales', {
            platform: 'poshmark',
            salePrice: 80.00,
            platformFee: 16.00,
            shippingCost: 5.00,
            taxAmount: 2.00
        });
        if (createStatus !== 201) return;
        const saleId = createData.sale?.id;
        if (!saleId) return;

        const { status: getStatus, data: getData } = await client.get(`/sales/${saleId}`);
        expect(getStatus).toBe(200);
        const sale = getData.sale;
        // 80 - 16 - 5 - 2 = 57
        expect(sale.net_profit).toBeCloseTo(57.00, 4);
    });

    test('sale_price is stored correctly on the sale record', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'depop',
            salePrice: 25.99,
            platformFee: 2.00
        });
        expect(status).toBe(201);
        expect(data.sale.sale_price).toBeCloseTo(25.99, 4);
    });

    test('platform_fee is stored correctly on the sale record', async () => {
        const { status, data } = await client.post('/sales', {
            platform: 'grailed',
            salePrice: 75.00,
            platformFee: 6.75
        });
        expect(status).toBe(201);
        expect(data.sale.platform_fee).toBeCloseTo(6.75, 4);
    });
});

// ─── net_profit validation guards ────────────────────────────────────────────

describe('net_profit — POST /sales validation', () => {
    test('missing salePrice returns 400', async () => {
        const { status } = await client.post('/sales', { platform: 'poshmark' });
        expect(status).toBe(400);
    });

    test('missing platform returns 400', async () => {
        const { status } = await client.post('/sales', { salePrice: 50.00 });
        expect(status).toBe(400);
    });

    test('invalid platform returns 400', async () => {
        const { status } = await client.post('/sales', {
            platform: 'fakeshop',
            salePrice: 50.00
        });
        expect(status).toBe(400);
    });
});

// ─── Purchase total — floating-point precision ────────────────────────────────
// The purchase route accumulates: itemsTotal += quantity * unitCost per item,
// then totalAmount = itemsTotal + shippingCost + taxAmount.
// These tests verify that precision-sensitive totals are stored correctly.

describe('Purchase total — floating-point precision', () => {
    test('3 items at $0.10 each produces total close to $0.30 (floating-point)', async () => {
        const { status, data } = await client.post('/financials/purchases', {
            vendorName: 'Precision-Test-Vendor',
            purchaseDate: '2026-01-01',
            items: [
                { description: 'Item-A', quantity: 1, unitCost: 0.10 },
                { description: 'Item-B', quantity: 1, unitCost: 0.10 },
                { description: 'Item-C', quantity: 1, unitCost: 0.10 }
            ]
        });
        expect([201]).toContain(status);
        if (status === 201) {
            // 0.1 + 0.1 + 0.1 in IEEE 754 = 0.30000000000000004
            // The route stores raw float; we verify it is within 1 cent of $0.30
            expect(data.purchase.total_amount).toBeCloseTo(0.30, 2);
        }
    });

    test('items with mixed fractional cents produce correct total', async () => {
        const { status, data } = await client.post('/financials/purchases', {
            vendorName: 'Frac-Precision-Vendor',
            purchaseDate: '2026-01-02',
            items: [
                { description: 'Shirt', quantity: 3, unitCost: 5.33 },
                { description: 'Pants', quantity: 2, unitCost: 8.17 }
            ],
            shippingCost: 0,
            taxAmount: 0
        });
        expect([201]).toContain(status);
        if (status === 201) {
            // (3 * 5.33) + (2 * 8.17) = 15.99 + 16.34 = 32.33
            expect(data.purchase.total_amount).toBeCloseTo(32.33, 2);
        }
    });

    test('purchase total includes shipping and tax in sum', async () => {
        const { status, data } = await client.post('/financials/purchases', {
            vendorName: 'Total-Precision-Vendor',
            purchaseDate: '2026-01-03',
            items: [{ description: 'Jacket', quantity: 1, unitCost: 20.00 }],
            shippingCost: 4.99,
            taxAmount: 1.60
        });
        expect([201]).toContain(status);
        if (status === 201) {
            // 20 + 4.99 + 1.60 = 26.59
            expect(data.purchase.total_amount).toBeCloseTo(26.59, 2);
        }
    });

    test('purchase with empty items array returns 400', async () => {
        const { status } = await client.post('/financials/purchases', {
            vendorName: 'Empty-Items-Vendor',
            purchaseDate: '2026-01-01',
            items: []
        });
        expect(status).toBe(400);
    });

    test('purchase with negative shippingCost returns 400', async () => {
        const { status } = await client.post('/financials/purchases', {
            vendorName: 'Neg-Ship-Vendor',
            purchaseDate: '2026-01-01',
            items: [{ description: 'Item', quantity: 1, unitCost: 10 }],
            shippingCost: -5.00
        });
        expect(status).toBe(400);
    });

    test('purchase with negative unit cost returns 400', async () => {
        const { status } = await client.post('/financials/purchases', {
            vendorName: 'Neg-Cost-Vendor',
            purchaseDate: '2026-01-01',
            items: [{ description: 'Item', quantity: 1, unitCost: -10 }]
        });
        expect(status).toBe(400);
    });
});

// ─── Sales list filtering ─────────────────────────────────────────────────────

describe('Sales list — filtering correctness', () => {
    test('GET /sales with platform filter returns only that platform', async () => {
        // Create two sales on different platforms
        await client.post('/sales', { platform: 'poshmark', salePrice: 10.00 });
        await client.post('/sales', { platform: 'ebay', salePrice: 10.00 });

        const { status, data } = await client.get('/sales?platform=poshmark');
        expect(status).toBe(200);
        const sales = data.sales || [];
        const wrongPlatform = sales.filter(s => s.platform !== 'poshmark');
        expect(wrongPlatform.length).toBe(0);
    });

    test('GET /sales with startDate filter excludes older sales', async () => {
        // Create one sale, then filter by a date range that excludes everything
        const futureDate = '2099-12-31';
        const { status, data } = await client.get(`/sales?startDate=${futureDate}`);
        expect(status).toBe(200);
        const sales = data.sales || [];
        expect(sales.length).toBe(0);
    });

    test('GET /sales returns total count alongside sales array', async () => {
        const { status, data } = await client.get('/sales');
        expect(status).toBe(200);
        expect(typeof data.total).toBe('number');
        expect(Array.isArray(data.sales)).toBe(true);
    });

    test('GET /sales with limit=1 returns at most 1 sale', async () => {
        const { status, data } = await client.get('/sales?limit=1');
        expect(status).toBe(200);
        expect((data.sales || []).length).toBeLessThanOrEqual(1);
    });

    test('GET /sales with offset=9999 returns empty array', async () => {
        const { status, data } = await client.get('/sales?offset=9999');
        expect(status).toBe(200);
        expect((data.sales || []).length).toBe(0);
    });
});
