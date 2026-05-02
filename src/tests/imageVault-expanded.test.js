// Image Vault — expanded test for POST /scan-usage endpoint
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;
let unauthClient;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
    unauthClient = new TestApiClient();
});

describe('Image Vault Expanded - Scan Usage', () => {
    test('POST /image-vault/scan-usage without auth returns 401', async () => {
        const { status } = await unauthClient.post('/image-vault/scan-usage');
        expect(status).toBe(401);
    });

    test('POST /image-vault/scan-usage returns scan results', async () => {
        const { status, data } = await client.post('/image-vault/scan-usage');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.message).toContain('scan');
            expect(typeof data.images_scanned).toBe('number');
            expect(typeof data.inventory_items_checked).toBe('number');
            expect(typeof data.updated).toBe('number');
        }
    });

    test('POST /image-vault/scan-usage for fresh user returns zero counts', async () => {
        const freshUser = await createTestUserWithToken();
        const freshClient = new TestApiClient(freshUser.token);
        const { status, data } = await freshClient.post('/image-vault/scan-usage');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data.images_scanned).toBe(0);
            expect(data.inventory_items_checked).toBe(0);
        }
    });
});
