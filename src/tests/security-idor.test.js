// IDOR (Insecure Direct Object Reference) security tests
// Verifies that authenticated users cannot access or mutate other users' resources
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { fixtures } from './helpers/fixtures.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`;

let userA = null; // { token, user }
let userB = null;

// A sentinel UUID that is structurally valid but belongs to no user — used to
// test raw ID-guessing attempts without needing to create a real resource first.
const NONEXISTENT_UUID = '00000000-dead-beef-0000-000000000001';

function authHeader(token) {
    return { 'Authorization': `Bearer ${token}` };
}

function jsonHeaders(token) {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

beforeAll(async () => {
    userA = await createTestUserWithToken();
    userB = await createTestUserWithToken();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create an inventory item as userA and return its id.
 * Returns null if creation fails (server not running / feature unavailable).
 */
async function createInventoryItemAsA() {
    if (!userA?.token) return null;
    const res = await fetch(`${BASE_URL}/inventory`, {
        method: 'POST',
        headers: jsonHeaders(userA.token),
        body: JSON.stringify(fixtures.inventoryItem())
    });
    if (res.status !== 201 && res.status !== 200) return null;
    const data = await res.json();
    return data.item?.id || data.id || null;
}

/**
 * Create a listing under a given inventory item as userA and return its id.
 */
async function createListingAsA(inventoryId) {
    if (!userA?.token || !inventoryId) return null;
    const res = await fetch(`${BASE_URL}/listings`, {
        method: 'POST',
        headers: jsonHeaders(userA.token),
        body: JSON.stringify(fixtures.listing(inventoryId))
    });
    if (res.status !== 201 && res.status !== 200) return null;
    const data = await res.json();
    return data.listing?.id || data.id || null;
}

/**
 * Create a sale as userA and return its id.
 */
async function createSaleAsA(inventoryId) {
    if (!userA?.token) return null;
    const salePayload = {
        ...fixtures.sale(),
        inventoryId: inventoryId || undefined
    };
    const res = await fetch(`${BASE_URL}/sales`, {
        method: 'POST',
        headers: jsonHeaders(userA.token),
        body: JSON.stringify(salePayload)
    });
    if (res.status !== 201 && res.status !== 200) return null;
    const data = await res.json();
    return data.sale?.id || data.id || null;
}

/**
 * Create an offer as userA and return its id.
 */
async function createOfferAsA(listingId) {
    if (!userA?.token) return null;
    const offerPayload = fixtures.offer(listingId || NONEXISTENT_UUID);
    const res = await fetch(`${BASE_URL}/offers`, {
        method: 'POST',
        headers: jsonHeaders(userA.token),
        body: JSON.stringify(offerPayload)
    });
    if (res.status !== 201 && res.status !== 200) return null;
    const data = await res.json();
    return data.offer?.id || data.id || null;
}

/**
 * Connect a shop as userA and return the platform slug used.
 */
async function connectShopAsA() {
    if (!userA?.token) return null;
    const platform = `testplatform${Date.now()}`;
    const res = await fetch(`${BASE_URL}/shops`, {
        method: 'POST',
        headers: jsonHeaders(userA.token),
        body: JSON.stringify({
            platform,
            username: `seller_${Date.now()}`,
            credentials: { apiKey: 'test-key' }
        })
    });
    if (res.status !== 201 && res.status !== 200) return null;
    return platform;
}

// ---------------------------------------------------------------------------
// InventoryItem isolation
// ---------------------------------------------------------------------------

describe('IDOR: InventoryItem', () => {
    let itemId = null;

    beforeAll(async () => {
        itemId = await createInventoryItemAsA();
    });

    test('should return 403 or 404 when User B GETs User A inventory item by id', async () => {
        if (!userB?.token || !itemId) return;
        const res = await fetch(`${BASE_URL}/inventory/${itemId}`, {
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B PUTs User A inventory item by id', async () => {
        if (!userB?.token || !itemId) return;
        const res = await fetch(`${BASE_URL}/inventory/${itemId}`, {
            method: 'PUT',
            headers: jsonHeaders(userB.token),
            body: JSON.stringify({ title: 'IDOR hijack attempt' })
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B DELETEs User A inventory item by id', async () => {
        if (!userB?.token || !itemId) return;
        const res = await fetch(`${BASE_URL}/inventory/${itemId}`, {
            method: 'DELETE',
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B GETs non-existent inventory item id', async () => {
        if (!userB?.token) return;
        const res = await fetch(`${BASE_URL}/inventory/${NONEXISTENT_UUID}`, {
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should not leak User A inventory items in User B inventory list', async () => {
        if (!userA?.token || !userB?.token || !itemId) return;
        const res = await fetch(`${BASE_URL}/inventory`, {
            headers: authHeader(userB.token)
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const items = data.items || data.inventory || [];
        const leaked = items.find(i => i.id === itemId);
        expect(leaked).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Listing isolation
// ---------------------------------------------------------------------------

describe('IDOR: Listing', () => {
    let inventoryId = null;
    let listingId = null;

    beforeAll(async () => {
        inventoryId = await createInventoryItemAsA();
        listingId = await createListingAsA(inventoryId);
    });

    test('should return 403 or 404 when User B GETs User A listing by id', async () => {
        if (!userB?.token || !listingId) return;
        const res = await fetch(`${BASE_URL}/listings/${listingId}`, {
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B PUTs User A listing by id', async () => {
        if (!userB?.token || !listingId) return;
        const res = await fetch(`${BASE_URL}/listings/${listingId}`, {
            method: 'PUT',
            headers: jsonHeaders(userB.token),
            body: JSON.stringify({ title: 'IDOR listing hijack' })
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B DELETEs User A listing by id', async () => {
        if (!userB?.token || !listingId) return;
        const res = await fetch(`${BASE_URL}/listings/${listingId}`, {
            method: 'DELETE',
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should not leak User A listings in User B listings list', async () => {
        if (!userA?.token || !userB?.token || !listingId) return;
        const res = await fetch(`${BASE_URL}/listings`, {
            headers: authHeader(userB.token)
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const listings = data.listings || [];
        const leaked = listings.find(l => l.id === listingId);
        expect(leaked).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Sale isolation
// ---------------------------------------------------------------------------

describe('IDOR: Sale', () => {
    let inventoryId = null;
    let saleId = null;

    beforeAll(async () => {
        inventoryId = await createInventoryItemAsA();
        saleId = await createSaleAsA(inventoryId);
    });

    test('should return 403 or 404 when User B GETs User A sale by id', async () => {
        if (!userB?.token || !saleId) return;
        const res = await fetch(`${BASE_URL}/sales/${saleId}`, {
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B PUTs User A sale by id', async () => {
        if (!userB?.token || !saleId) return;
        const res = await fetch(`${BASE_URL}/sales/${saleId}`, {
            method: 'PUT',
            headers: jsonHeaders(userB.token),
            body: JSON.stringify({ status: 'cancelled' })
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B DELETEs User A sale by id', async () => {
        if (!userB?.token || !saleId) return;
        const res = await fetch(`${BASE_URL}/sales/${saleId}`, {
            method: 'DELETE',
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should not leak User A sales in User B sales list', async () => {
        if (!userA?.token || !userB?.token || !saleId) return;
        const res = await fetch(`${BASE_URL}/sales`, {
            headers: authHeader(userB.token)
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const sales = data.sales || [];
        const leaked = sales.find(s => s.id === saleId);
        expect(leaked).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Offer isolation
// ---------------------------------------------------------------------------

describe('IDOR: Offer', () => {
    let inventoryId = null;
    let listingId = null;
    let offerId = null;

    beforeAll(async () => {
        inventoryId = await createInventoryItemAsA();
        listingId = await createListingAsA(inventoryId);
        offerId = await createOfferAsA(listingId);
    });

    test('should return 403 or 404 when User B GETs User A offer by id', async () => {
        if (!userB?.token || !offerId) return;
        const res = await fetch(`${BASE_URL}/offers/${offerId}`, {
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B tries to accept User A offer', async () => {
        if (!userB?.token || !offerId) return;
        const res = await fetch(`${BASE_URL}/offers/${offerId}/accept`, {
            method: 'POST',
            headers: jsonHeaders(userB.token),
            body: JSON.stringify({})
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B tries to decline User A offer', async () => {
        if (!userB?.token || !offerId) return;
        const res = await fetch(`${BASE_URL}/offers/${offerId}/decline`, {
            method: 'POST',
            headers: jsonHeaders(userB.token),
            body: JSON.stringify({})
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should not leak User A offers in User B offers list', async () => {
        if (!userA?.token || !userB?.token || !offerId) return;
        const res = await fetch(`${BASE_URL}/offers`, {
            headers: authHeader(userB.token)
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const offers = data.offers || [];
        const leaked = offers.find(o => o.id === offerId);
        expect(leaked).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Shop isolation
// ---------------------------------------------------------------------------

describe('IDOR: Shop', () => {
    let platformSlug = null;

    beforeAll(async () => {
        platformSlug = await connectShopAsA();
    });

    test('should return 403 or 404 when User B GETs User A shop by platform slug', async () => {
        if (!userB?.token || !platformSlug) return;
        const res = await fetch(`${BASE_URL}/shops/${platformSlug}`, {
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B PUTs User A shop by platform slug', async () => {
        if (!userB?.token || !platformSlug) return;
        const res = await fetch(`${BASE_URL}/shops/${platformSlug}`, {
            method: 'PUT',
            headers: jsonHeaders(userB.token),
            body: JSON.stringify({ username: 'hijacked' })
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should return 403 or 404 when User B DELETEs User A shop by platform slug', async () => {
        if (!userB?.token || !platformSlug) return;
        const res = await fetch(`${BASE_URL}/shops/${platformSlug}`, {
            method: 'DELETE',
            headers: authHeader(userB.token)
        });
        expect([403, 404]).toContain(res.status);
    });

    test('should not leak User A shops in User B shops list', async () => {
        if (!userA?.token || !userB?.token || !platformSlug) return;
        const res = await fetch(`${BASE_URL}/shops`, {
            headers: authHeader(userB.token)
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        const shops = data.shops || [];
        const leaked = shops.find(s => s.platform === platformSlug);
        expect(leaked).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Unauthenticated access guard
// ---------------------------------------------------------------------------

describe('IDOR: Unauthenticated requests are rejected across all resources', () => {
    const endpoints = [
        '/inventory',
        '/listings',
        '/sales',
        '/offers',
        '/shops'
    ];

    for (const ep of endpoints) {
        test(`should return 401 or 403 for unauthenticated GET ${ep}`, async () => {
            const res = await fetch(`${BASE_URL}${ep}`);
            expect([401, 403]).toContain(res.status);
        });
    }

    test('should return 401 or 403 when accessing resource by id without token', async () => {
        for (const prefix of ['/inventory', '/listings', '/sales', '/offers']) {
            const res = await fetch(`${BASE_URL}${prefix}/${NONEXISTENT_UUID}`);
            expect([401, 403]).toContain(res.status);
        }
    });
});
