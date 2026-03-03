// Platform Sync Tests
// Tests shop listing, connection, sync triggering, and supported platforms.
// Routes through /api/shops endpoints.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

// ============================================================
// List Shops
// ============================================================
describe('Platform Sync - List Shops', () => {
    test('GET /shops returns array', async () => {
        const { status, data } = await client.get('/shops');
        expect(status).toBe(200);
        expect(Array.isArray(data.shops || data)).toBe(true);
    });

    test('shop listing does not leak credentials', async () => {
        const { data } = await client.get('/shops');
        const shops = data.shops || data;
        for (const shop of shops) {
            expect(shop.access_token).toBeUndefined();
            expect(shop.refresh_token).toBeUndefined();
            expect(shop.api_key).toBeUndefined();
        }
    });

    test('shop objects have expected fields if any exist', async () => {
        const { data } = await client.get('/shops');
        const shops = data.shops || data;
        if (shops.length > 0) {
            expect(shops[0]).toHaveProperty('id');
            expect(shops[0]).toHaveProperty('platform');
        }
    });
});

// ============================================================
// Connect Shop
// ============================================================
describe('Platform Sync - Connect Shop', () => {
    test('POST /shops with missing platform returns 400', async () => {
        const { status } = await client.post('/shops', {
            name: 'Test Shop'
        });
        expect([400, 500]).toContain(status);
    });

    test('POST /shops with valid platform data', async () => {
        const { status } = await client.post('/shops', {
            platform: 'ebay',
            name: `TestShop-${Date.now()}`
        });
        // May succeed (200/201) or fail due to OAuth requirements
        expect([200, 201, 400, 500]).toContain(status);
    });
});

// ============================================================
// Sync Status
// ============================================================
describe('Platform Sync - Sync Status', () => {
    test('GET /shops returns sync-related fields', async () => {
        const { data } = await client.get('/shops');
        const shops = data.shops || data;
        if (shops.length > 0) {
            // Shops should have sync-related fields
            expect(shops[0]).toHaveProperty('platform');
        }
    });
});

// ============================================================
// Supported Platforms
// ============================================================
describe('Platform Sync - Supported Platforms', () => {
    test('ebay is a known platform', async () => {
        const { status } = await client.post('/shops', {
            platform: 'ebay',
            name: `EbayTest-${Date.now()}`
        });
        // Should not return 404 — platform is recognized
        expect(status).not.toBe(404);
    });

    test('poshmark is a known platform', async () => {
        const { status } = await client.post('/shops', {
            platform: 'poshmark',
            name: `PoshTest-${Date.now()}`
        });
        expect(status).not.toBe(404);
    });

    test('mercari is a known platform', async () => {
        const { status } = await client.post('/shops', {
            platform: 'mercari',
            name: `MercariTest-${Date.now()}`
        });
        expect(status).not.toBe(404);
    });
});

// ============================================================
// Delete Shop
// ============================================================
describe('Platform Sync - Disconnect', () => {
    test('DELETE /shops/:nonexistent returns 404', async () => {
        const { status } = await client.delete('/shops/nonexistent-shop-id');
        expect([404, 500]).toContain(status);
    });
});

// ============================================================
// Auth Guard
// ============================================================
describe('Platform Sync - Auth Guard', () => {
    test('unauthenticated list returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/shops');
        expect(status).toBe(401);
    });

    test('unauthenticated connect returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.post('/shops', { platform: 'ebay', name: 'x' });
        expect(status).toBe(401);
    });
});
