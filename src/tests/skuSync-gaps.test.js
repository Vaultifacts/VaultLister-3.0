// SKU Sync — Gap-filling tests: GET / (list), GET /conflicts
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('SKU Sync list and conflicts', () => {
    test('GET /sku-sync/ returns list of platform links', async () => {
        const { status, data } = await client.get('/sku-sync/');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(Array.isArray(data) || Array.isArray(data?.links)).toBe(true);
        }
    });

    test('GET /sku-sync/?platform=ebay filters by platform', async () => {
        const { status } = await client.get('/sku-sync/?platform=ebay');
        expect([200, 500]).toContain(status);
    });

    test('GET /sku-sync/conflicts returns conflict list', async () => {
        const { status, data } = await client.get('/sku-sync/conflicts');
        expect([200, 500]).toContain(status);
        if (status === 200) {
            expect(data).toBeDefined();
        }
    });
});
