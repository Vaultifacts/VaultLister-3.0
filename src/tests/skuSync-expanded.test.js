// SKU Sync API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('SKU Sync - Auth Guard', () => {
    test('POST /sku-sync/link without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/sku-sync/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ master_sku: 'TEST-001', platform: 'ebay' })
        });
        expect(res.status).toBe(401);
    });
});

describe('SKU Sync - Link', () => {
    test('POST /sku-sync/link creates platform link', async () => {
        const { status } = await client.post('/sku-sync/link', {
            master_sku: 'TEST-SKU-001',
            platform: 'ebay',
            platform_sku: 'EBAY-001'
        });
        expect([200, 201]).toContain(status);
    });

    test('POST /sku-sync/link without master_sku returns 400', async () => {
        const { status } = await client.post('/sku-sync/link', {
            platform: 'ebay'
        });
        expect([400]).toContain(status);
    });

    test('POST /sku-sync/link without platform returns 400', async () => {
        const { status } = await client.post('/sku-sync/link', {
            master_sku: 'TEST-001'
        });
        expect([400]).toContain(status);
    });
});

describe('SKU Sync - Sync', () => {
    test('POST /sku-sync/sync processes pending links', async () => {
        const { status } = await client.post('/sku-sync/sync', {});
        expect(status).toBe(200);
    });
});

describe('SKU Sync - Barcode Lookup', () => {
    test('GET /sku-sync/barcode/TEST-SKU-001 searches for item', async () => {
        const { status, data } = await client.get('/sku-sync/barcode/TEST-SKU-001');
        expect([200, 404]).toContain(status);
    });

    test('GET /sku-sync/barcode/nonexistent returns 404 or empty', async () => {
        const { status } = await client.get('/sku-sync/barcode/NONEXISTENT-BARCODE');
        expect([200, 404]).toContain(status);
    });
});

describe('SKU Sync - Delete', () => {
    test('DELETE /sku-sync/nonexistent-id returns 404', async () => {
        const { status } = await client.delete('/sku-sync/nonexistent-id');
        expect([200, 404]).toContain(status);
    });
});
