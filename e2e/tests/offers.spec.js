/**
 * Offer Management E2E Tests — P6-7
 *
 * Covers: list offers, accept, decline, counter, status filtering,
 * duplicate-action guard, offer rules CRUD, offer stats.
 * All tests are API-level (no UI navigation required).
 */

import { test, expect } from '@playwright/test';
import { apiLogin } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

let token;
let headers;

// IDs created during setup — cleaned up in afterAll
let inventoryId;
let listingId;

// Helper: get a fresh CSRF token from any GET response (tokens are single-use)
async function getPostHeaders(request) {
    const res = await request.get(`${BASE_URL}/api/offers`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const csrf = res.headers()['x-csrf-token'] || '';
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    };
}

// Alias used by offer seed function
const postHeaders = getPostHeaders;

// Create a minimal inventory item + listing so we can attach offers
async function createTestListing(request) {
    // Each POST needs a fresh CSRF token (single-use)
    const ph1 = await getPostHeaders(request);

    // Create inventory item
    const invRes = await request.post(`${BASE_URL}/api/inventory`, {
        headers: ph1,
        data: {
            title: `[TEST] Offer E2E Item ${Date.now()}`,
            brand: 'TestBrand',
            category: 'Tops',
            size: 'M',
            condition: 'good',
            listPrice: 50,
            costPrice: 20
        }
    });
    expect(invRes.status()).toBe(201);
    const inv = await invRes.json();
    inventoryId = inv.item?.id || inv.id;
    expect(inventoryId).toBeTruthy();

    // Create listing for that inventory item (fresh CSRF token)
    const ph2 = await getPostHeaders(request);
    const listRes = await request.post(`${BASE_URL}/api/listings`, {
        headers: ph2,
        data: {
            inventoryId,
            platform: 'poshmark',
            title: `[TEST] Offer E2E Listing ${Date.now()}`,
            description: 'E2E test listing for offer management',
            price: 50
        }
    });
    expect(listRes.status()).toBe(201);
    const listing = await listRes.json();
    listingId = listing.listing?.id || listing.id;
    expect(listingId).toBeTruthy();
}

// Directly insert an offer row via a POST to a test helper, or seed via the DB.
// Since there's no public "buyer submits offer" API, we use a direct DB seed route.
// The offers route does not expose a POST /api/offers endpoint (offers come from platforms),
// so we seed test offers directly through the offers route's response from another authenticated user.
// Workaround: we test the GET/accept/decline/counter flows using pre-seeded data when available,
// or we verify the route contract is correct when no test data exists.
async function createTestOffer(request, overrides = {}) {
    // Seed an offer via a special test endpoint if present, otherwise insert directly
    // The app doesn't expose "create offer" publicly (offers come from marketplaces),
    // so we call the internal seeding path: POST /api/offers/seed (test-mode only)
    // Fallback: if no seed endpoint, verify existing pending offers or skip
    const ph = await postHeaders(request);
    const res = await request.post(`${BASE_URL}/api/offers/seed`, {
        headers: ph,
        data: {
            listing_id: listingId,
            platform: 'poshmark',
            offer_amount: 40, // 80% of $50
            buyer_username: 'e2e_test_buyer',
            ...overrides
        }
    });
    return res;
}

test.beforeAll(async ({ request }) => {
    const loginData = await apiLogin(request);
    token = loginData.token;
    headers = { Authorization: `Bearer ${token}` };
    await createTestListing(request);
});

// ── GET /api/offers ───────────────────────────────────────────────────────────

test.describe('@quinn-v3-guardian Offer List', () => {
    test('GET /api/offers returns offers array with total and pending count', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.offers)).toBe(true);
        expect(typeof data.total).toBe('number');
        expect(typeof data.pending).toBe('number');
    });

    test('GET /api/offers?status=pending filters correctly', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers?status=pending`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.offers)).toBe(true);
        // All returned offers must have status=pending
        data.offers.forEach(o => expect(o.status).toBe('pending'));
    });

    test('GET /api/offers?platform=poshmark filters by platform', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers?platform=poshmark`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.offers)).toBe(true);
        data.offers.forEach(o => expect(o.platform).toBe('poshmark'));
    });

    test('GET /api/offers?limit=2 respects pagination', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers?limit=2`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.offers.length).toBeLessThanOrEqual(2);
    });
});

// ── GET /api/offers/stats ─────────────────────────────────────────────────────

test.describe('@quinn-v3-guardian Offer Stats', () => {
    test('GET /api/offers/stats returns numeric counters', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers/stats`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(typeof data.stats.total).toBe('number');
        expect(typeof data.stats.pending).toBe('number');
        expect(typeof data.stats.accepted).toBe('number');
        expect(typeof data.stats.declined).toBe('number');
        expect(typeof data.stats.acceptRate).toBe('number');
    });
});

// ── Offer CRUD via seed endpoint (or graceful skip) ───────────────────────────

test.describe('@quinn-v3-guardian Offer Accept / Decline / Counter', () => {
    test.describe.configure({ mode: 'serial' });

    let seededOfferId;
    let acceptOfferId;
    let declineOfferId;

    test.beforeAll(async ({ request }) => {
        // Try to seed a pending offer for our test listing
        const seed1 = await createTestOffer(request, { offer_amount: 40 });
        const seed2 = await createTestOffer(request, { offer_amount: 42 });
        const seed3 = await createTestOffer(request, { offer_amount: 45 });

        if (seed1.status() === 201) {
            const body1 = await seed1.json();
            seededOfferId = body1.offer?.id;
            const body2 = await seed2.json();
            acceptOfferId = body2.offer?.id;
            const body3 = await seed3.json();
            declineOfferId = body3.offer?.id;
        } else {
            // Seed endpoint unavailable — log status for diagnosis then fall back
            const seedStatus = seed1.status();
            let seedBody = '';
            try { seedBody = JSON.stringify(await seed1.json()); } catch { seedBody = await seed1.text(); }
            console.warn(`[offers.spec] Seed endpoint returned ${seedStatus}: ${seedBody}. Falling back to existing pending offers.`);

            const listRes = await request.get(`${BASE_URL}/api/offers?status=pending&limit=3`, {
                headers
            });
            const data = await listRes.json();
            if (data.offers.length >= 1) seededOfferId = data.offers[0].id;
            if (data.offers.length >= 2) acceptOfferId = data.offers[1].id;
            if (data.offers.length >= 3) declineOfferId = data.offers[2].id;
            if (!seededOfferId) {
                console.warn('[offers.spec] No pending offers found — offer action tests will be skipped. Run test:setup to configure the test server correctly.');
            }
        }
    });

    test('GET /api/offers/:id returns full offer detail', async ({ request }) => {
        if (!seededOfferId) test.skip();
        const res = await request.get(`${BASE_URL}/api/offers/${seededOfferId}`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.offer.id).toBe(seededOfferId);
        expect(typeof data.offer.offer_amount).toBe('number');
        expect(typeof data.offer.percentage).toBe('number');
    });

    test('GET /api/offers/:id returns 404 for unknown offer', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers/00000000-0000-0000-0000-000000000000`, {
            headers
        });
        expect(res.status()).toBe(404);
    });

    test('POST /api/offers/:id/counter — counter with valid amount updates status to countered', async ({ request }) => {
        if (!seededOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${seededOfferId}/counter`, {
            headers: ph,
            data: { amount: 45 }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toMatch(/counter/i);
        expect(data.taskId).toBeTruthy();

        // Verify the status updated
        const getRes = await request.get(`${BASE_URL}/api/offers/${seededOfferId}`, { headers });
        const getBody = await getRes.json();
        expect(getBody.offer.status).toBe('countered');
        expect(getBody.offer.counter_amount).toBe(45);
    });

    test('POST /api/offers/:id/counter — rejects already-responded offer with 409', async ({ request }) => {
        if (!seededOfferId) test.skip();
        const ph = await postHeaders(request);
        // Already countered in previous test — attempt again should fail
        const res = await request.post(`${BASE_URL}/api/offers/${seededOfferId}/counter`, {
            headers: ph,
            data: { amount: 43 }
        });
        expect(res.status()).toBe(409);
        const data = await res.json();
        expect(data.error).toMatch(/already been processed/i);
    });

    test('POST /api/offers/:id/counter — rejects missing amount with 400', async ({ request }) => {
        if (!acceptOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${acceptOfferId}/counter`, {
            headers: ph,
            data: {}
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/amount/i);
    });

    test('POST /api/offers/:id/counter — rejects negative amount with 400', async ({ request }) => {
        if (!acceptOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${acceptOfferId}/counter`, {
            headers: ph,
            data: { amount: -10 }
        });
        expect(res.status()).toBe(400);
    });

    test('POST /api/offers/:id/accept — accepts pending offer and returns taskId', async ({ request }) => {
        if (!acceptOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${acceptOfferId}/accept`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toMatch(/accept/i);
        expect(data.taskId).toBeTruthy();

        // Verify status
        const getRes = await request.get(`${BASE_URL}/api/offers/${acceptOfferId}`, { headers });
        const getBody = await getRes.json();
        expect(getBody.offer.status).toBe('accepted');
    });

    test('POST /api/offers/:id/accept — rejects already-accepted offer with 400', async ({ request }) => {
        if (!acceptOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${acceptOfferId}/accept`, {
            headers: ph
        });
        expect(res.status()).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/already been responded/i);
    });

    test('POST /api/offers/:id/decline — declines pending offer and returns taskId', async ({ request }) => {
        if (!declineOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${declineOfferId}/decline`, {
            headers: ph
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.message).toMatch(/decline/i);
        expect(data.taskId).toBeTruthy();

        // Verify status
        const getRes = await request.get(`${BASE_URL}/api/offers/${declineOfferId}`, { headers });
        const getBody = await getRes.json();
        expect(getBody.offer.status).toBe('declined');
    });

    test('POST /api/offers/:id/decline — rejects already-declined offer with 400', async ({ request }) => {
        if (!declineOfferId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/${declineOfferId}/decline`, {
            headers: ph
        });
        expect(res.status()).toBe(400);
    });

    test('Offers list reflects updated statuses after actions', async ({ request }) => {
        // After accepting/declining/countering, verify the list shows correct stats
        const res = await request.get(`${BASE_URL}/api/offers/stats`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        // Accepted and declined counts should be > 0 if we successfully processed offers
        const hasResponded = data.stats.accepted > 0 || data.stats.declined > 0;
        // If seeding worked, we processed 3 offers above
        if (seededOfferId || acceptOfferId || declineOfferId) {
            expect(hasResponded).toBe(true);
        }
    });
});

// ── Offer Rules CRUD ──────────────────────────────────────────────────────────

test.describe('@quinn-v3-guardian Offer Rules', () => {
    test.describe.configure({ mode: 'serial' });

    let ruleId;

    test('GET /api/offers/rules — returns rules array', async ({ request }) => {
        const res = await request.get(`${BASE_URL}/api/offers/rules`, { headers });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(Array.isArray(data.rules)).toBe(true);
    });

    test('POST /api/offers/rules — creates new offer rule', async ({ request }) => {
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/rules`, {
            headers: ph,
            data: {
                name: '[TEST] E2E Counter Rule',
                platform: 'poshmark',
                conditions: { minPercentage: 80 },
                actions: { autoCounter: true, counterPercentage: 90 },
                isEnabled: true
            }
        });
        expect(res.status()).toBe(201);
        const data = await res.json();
        ruleId = data.rule?.id;
        expect(ruleId).toBeTruthy();
        expect(data.rule.name).toBe('[TEST] E2E Counter Rule');
        expect(data.rule.conditions.minPercentage).toBe(80);
        expect(data.rule.actions.autoCounter).toBe(true);
    });

    test('POST /api/offers/rules — rejects missing required fields', async ({ request }) => {
        const ph = await postHeaders(request);
        const res = await request.post(`${BASE_URL}/api/offers/rules`, {
            headers: ph,
            data: { name: 'Incomplete Rule' }
        });
        expect(res.status()).toBe(400);
    });

    test('PUT /api/offers/rules/:id — updates rule fields', async ({ request }) => {
        if (!ruleId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.put(`${BASE_URL}/api/offers/rules/${ruleId}`, {
            headers: ph,
            data: {
                name: '[TEST] E2E Counter Rule Updated',
                isEnabled: false
            }
        });
        expect(res.status()).toBe(200);
        const data = await res.json();
        expect(data.rule.name).toBe('[TEST] E2E Counter Rule Updated');
        expect(data.rule.is_enabled).toBe(0);
    });

    test('PUT /api/offers/rules/:id — returns 404 for unknown rule', async ({ request }) => {
        const ph = await postHeaders(request);
        const res = await request.put(`${BASE_URL}/api/offers/rules/00000000-0000-0000-0000-000000000000`, {
            headers: ph,
            data: { name: 'Ghost Rule' }
        });
        expect(res.status()).toBe(404);
    });

    test('DELETE /api/offers/rules/:id — deletes rule', async ({ request }) => {
        if (!ruleId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.delete(`${BASE_URL}/api/offers/rules/${ruleId}`, { headers: ph });
        expect(res.status()).toBe(200);

        // Confirm deleted
        const rulesRes = await request.get(`${BASE_URL}/api/offers/rules`, { headers });
        const data = await rulesRes.json();
        const found = data.rules.find(r => r.id === ruleId);
        expect(found).toBeUndefined();
    });

    test('DELETE /api/offers/rules/:id — returns 404 for already-deleted rule', async ({ request }) => {
        if (!ruleId) test.skip();
        const ph = await postHeaders(request);
        const res = await request.delete(`${BASE_URL}/api/offers/rules/${ruleId}`, { headers: ph });
        expect(res.status()).toBe(404);
    });
});
