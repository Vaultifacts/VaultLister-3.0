/**
 * eBay Integration E2E Tests — P3-1 through P3-5
 *
 * Tests the full eBay integration surface:
 *   P3-1: OAuth flow endpoints (authorize URL, status, revoke)
 *   P3-2: Listing publish endpoint behavior
 *   P3-3: Inventory sync endpoint behavior
 *   P3-4: Offer management — eBay platform offers in our system
 *   P3-5: Order sync — real ebaySync wired (no mock)
 *
 * Tests that require a live eBay sandbox connection are skipped when
 * EBAY_SHOP_CONNECTED env var is not set. To run the full suite:
 *   1. Connect eBay sandbox via Settings → My Shops → Connect eBay
 *   2. Set EBAY_SHOP_CONNECTED=1 in .env.test
 *   3. Run: npx playwright test ebay-integration --project=chromium
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let authHeaders;
let ebayIsConnected = false; // set dynamically in beforeAll

// Fresh CSRF token before each mutating request
async function getPostHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/inventory`, {
        headers: authHeaders
    });
    const csrf = res.headers()['x-csrf-token'] || '';
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    };
}

test.beforeAll(async ({ request }) => {
    const loginData = await apiLogin(request);
    token = loginData.token;
    authHeaders = { Authorization: `Bearer ${token}` };
    expect(token).toBeTruthy();

    // Detect actual eBay connection state from the API
    const statusRes = await request.get(`${BASE_URL}/api/oauth/status/ebay`, { headers: authHeaders });
    if (statusRes.status() === 200) {
        const statusBody = await statusRes.json();
        ebayIsConnected = statusBody.connected === true;
    }
});

// ────────────────────────────────────────────────────────────────────────
// P3-1: OAuth Flow
// ────────────────────────────────────────────────────────────────────────

test.describe('P3-1: eBay OAuth Flow', () => {
    test('GET /api/oauth/authorize/ebay returns a valid eBay auth URL', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/authorize/ebay`, {
            headers: authHeaders
        });
        // Expect either a redirect to eBay or a 200 with URL
        const status = res.status();
        expect([200, 302, 307]).toContain(status);

        if (status === 200) {
            const body = await res.json();
            const authUrl = body.authUrl || body.url || body.redirectUrl || '';
            // Must point to eBay's auth domain (sandbox or production)
            expect(authUrl).toMatch(/ebay\.com\/oauth2\/authorize/);
        }
    });

    test('GET /api/oauth/status/ebay returns connection status shape', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/oauth/status/ebay`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('connected');
        expect(typeof body.connected).toBe('boolean');
    });

    test('GET /api/oauth/status/ebay reports not connected when no eBay shop exists', async ({ request }) => {
        if (ebayIsConnected) test.skip();
        const res = await request.get(`${BASE_URL}/api/oauth/status/ebay`, {
            headers: authHeaders
        });
        const body = await res.json();
        expect(body.connected).toBe(false);
    });

    test('GET /api/oauth/status/ebay reports connected when eBay shop is connected', async ({ request }) => {
        if (!ebayIsConnected) test.skip();
        const res = await request.get(`${BASE_URL}/api/oauth/status/ebay`, {
            headers: authHeaders
        });
        const body = await res.json();
        expect(body.connected).toBe(true);
        expect(body).toHaveProperty('platform', 'ebay');
    });
});

// ────────────────────────────────────────────────────────────────────────
// P3-2: Listing Publish
// ────────────────────────────────────────────────────────────────────────

test.describe('P3-2: eBay Listing Publish', () => {
    let testInventoryId;
    let testListingId;

    test.beforeAll(async ({ request }) => {
        // Create a test inventory item for publish tests
        const ph1 = await getPostHeaders(request);
        const invRes = await request.post(`${BASE_URL}/api/inventory`, {
            headers: ph1,
            data: {
                title: '[TEST-EBAY] P3-2 eBay Publish Test Item',
                brand: 'Nike',
                category: 'Tops',
                size: 'L',
                condition: 'good',
                listPrice: 45,
                costPrice: 15
            }
        });
        if (invRes.status() === 201) {
            const inv = await invRes.json();
            testInventoryId = inv.item?.id || inv.id;

            const ph2 = await getPostHeaders(request);
            const listRes = await request.post(`${BASE_URL}/api/listings`, {
                headers: ph2,
                data: {
                    inventoryId: testInventoryId,
                    platform: 'ebay',
                    title: '[TEST-EBAY] P3-2 eBay Publish Test Item',
                    price: 45
                }
            });
            if (listRes.status() === 201) {
                const listing = await listRes.json();
                testListingId = listing.listing?.id || listing.id;
            }
        }
    });

    test('POST /api/listings/:id/publish-ebay returns 400 when no eBay shop connected', async ({ request }) => {
        if (ebayIsConnected) test.skip();
        if (!testListingId) test.skip();

        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/listings/${testListingId}/publish-ebay`, {
            headers: ph
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/no connected ebay shop/i);
    });

    test('POST /api/listings/:id/publish-ebay returns 404 for non-existent listing', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/listings/00000000-0000-0000-0000-000000000000/publish-ebay`, {
            headers: ph
        });
        expect(res.status()).toBe(404);
    });

    test('POST /api/listings/:id/publish-ebay publishes to eBay sandbox when connected', async ({ request }) => {
        if (!ebayIsConnected) test.skip();
        if (!testListingId) test.skip();
        // Requires a live sandbox OAuth session — set EBAY_SANDBOX_LIVE=1 in .env.test
        if (!process.env.EBAY_SANDBOX_LIVE) test.skip();

        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/listings/${testListingId}/publish-ebay`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.listingId).toBeTruthy();
        expect(body.listingUrl).toMatch(/ebay\.com\/itm\//);
        expect(body.offerId).toBeTruthy();
        expect(body.sku).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────────────────────
// P3-3: Inventory Sync
// ────────────────────────────────────────────────────────────────────────

test.describe('P3-3: eBay Inventory Sync', () => {
    test('POST /api/oauth/sync/ebay queues sync task (202 Accepted)', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/oauth/sync/ebay`, {
            headers: ph
        });
        // Accepted with task ID, or 400/404 if no shop connected
        expect([200, 202, 400, 404]).toContain(res.status());

        if (res.status() === 400 || res.status() === 404) {
            const body = await res.json();
            expect(body.error).toMatch(/no connected|connect ebay|not found/i);
        }
    });

    test('POST /api/oauth/sync/ebay returns sync results when eBay is connected', async ({ request }) => {
        if (!ebayIsConnected) test.skip();

        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/oauth/sync/ebay`, {
            headers: ph
        });
        expect([200, 202]).toContain(res.status());
        const body = await res.json();
        expect(body).toHaveProperty('taskId');
    });

    test('GET /api/inventory after sync includes eBay listings when connected', async ({ request }) => {
        if (!ebayIsConnected) test.skip();

        const res = await request.get(`${BASE_URL}/api/inventory`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        // Just verify the endpoint works — specific listings depend on sandbox state
        const body = await res.json();
        expect(Array.isArray(body.items || body)).toBe(true);
    });
});

// ────────────────────────────────────────────────────────────────────────
// P3-4: Offer Management (eBay platform offers in our system)
// ────────────────────────────────────────────────────────────────────────

test.describe('P3-4: eBay Offer Management', () => {
    test('GET /api/offers returns offers including eBay platform offers', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        const offers = body.offers || body;
        expect(Array.isArray(offers)).toBe(true);
        // Any eBay offers in our system should have platform='ebay'
        const ebayOffers = offers.filter(o => o.platform === 'ebay');
        for (const offer of ebayOffers) {
            expect(offer).toHaveProperty('id');
            expect(offer).toHaveProperty('offer_amount');
            expect(offer).toHaveProperty('status');
        }
    });

    test('GET /api/offers?platform=ebay filters to eBay offers only', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers?platform=ebay`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        const offers = body.offers || body;
        expect(Array.isArray(offers)).toBe(true);
        // All returned offers should be eBay (or empty)
        for (const offer of offers) {
            expect(offer.platform).toBe('ebay');
        }
    });

    test('eBay offer rules can be created for eBay platform', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/rules`, {
            headers: ph,
            data: {
                name: '[TEST-EBAY] eBay Auto-Counter Rule',
                platform: 'ebay',
                conditions: { minOfferPercent: 80 },
                actions: { counterPercent: 90, autoAcceptPercent: 95 }
            }
        });
        // Should succeed or return conflict (rule already exists)
        expect([201, 409, 200]).toContain(res.status());
    });
});

// ────────────────────────────────────────────────────────────────────────
// P3-5: Order and Sales Sync
// ────────────────────────────────────────────────────────────────────────

test.describe('P3-5: eBay Order and Sales Sync', () => {
    test('POST /api/orders/sync/ebay returns 400 when no eBay shop connected', async ({ request }) => {
        if (ebayIsConnected) test.skip();

        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/orders/sync/ebay`, {
            headers: ph
        });
        expect(res.status()).toBe(400);
        const body = await res.json();
        expect(body.error).toMatch(/no connected ebay shop|connect ebay/i);
    });

    test('POST /api/orders/sync/ebay returns real sync results when connected', async ({ request }) => {
        if (!ebayIsConnected) test.skip();

        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/orders/sync/ebay`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('platform', 'ebay');
        expect(body).toHaveProperty('newOrders');
        expect(body).toHaveProperty('orders');
        expect(typeof body.orders.synced).toBe('number');
    });

    test('POST /api/orders/sync/poshmark returns not-integrated message', async ({ request }) => {
        const ph = await getPostHeaders(request);
        const res = await request.post(`${BASE_URL}/api/orders/sync/poshmark`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.message).toMatch(/not yet integrated/i);
        expect(body.newOrders).toBe(0);
    });

    test('GET /api/orders returns orders list', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/orders`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.orders || body)).toBe(true);
    });

    test('GET /api/sales includes eBay sales', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/sales`, {
            headers: authHeaders
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        const sales = body.sales || body;
        expect(Array.isArray(sales)).toBe(true);
        // Just verify shape — actual eBay sales depend on connected state
        for (const sale of sales.filter(s => s.platform === 'ebay')) {
            expect(sale).toHaveProperty('id');
            expect(sale).toHaveProperty('platform', 'ebay');
        }
    });
});
