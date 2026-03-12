// Offers State Machine Tests
// Covers: accept/decline/counter state transitions, double-respond prevention,
//         counter amount validation, IDOR isolation.
//
// Setup: since there is no POST /offers endpoint (offers come from marketplace
// sync), test offers are seeded directly into the database using query.run().
import { describe, expect, test, beforeAll } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { query } from '../backend/db/database.js';

let clientA;
let clientB;
let userAId;
let listingAId;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Seed a pending offer owned by userA for listingAId. Returns offer id. */
function seedOffer({ userId = userAId, listingId = listingAId, status = 'pending', amount = 15.00 } = {}) {
    const id = uuidv4();
    query.run(
        `INSERT INTO offers (id, user_id, listing_id, platform, buyer_username, offer_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, listingId, 'poshmark', 'buyer_test', amount, status]
    );
    return id;
}

/** Seed a minimal inventory item + listing for the given user. Returns listing id. */
function seedListing(userId) {
    const invId = uuidv4();
    query.run(
        `INSERT INTO inventory (id, user_id, sku, title, list_price, status, condition)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [invId, userId, `SKU-${Date.now()}`, 'State Machine Test Item', 30.00, 'active', 'good']
    );

    const listId = uuidv4();
    query.run(
        `INSERT INTO listings (id, inventory_id, user_id, platform, title, price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [listId, invId, userId, 'poshmark', 'State Machine Test Listing', 30.00, 'active']
    );

    return listId;
}

// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
    const userA = await createTestUserWithToken();
    const userB = await createTestUserWithToken();

    clientA = new TestApiClient(userA.token);
    clientB = new TestApiClient(userB.token);
    userAId = userA.user?.id;

    if (!userAId) {
        // Fallback: look up from DB by email
        const row = query.get('SELECT id FROM users WHERE email = ?', [userA.email]);
        userAId = row?.id;
    }

    listingAId = seedListing(userAId);
}, 15000);

// ============================================================
// List Offers
// ============================================================
describe('Offers - List', () => {
    test('GET /offers returns 200 with offers array and counts', async () => {
        const { status, data } = await clientA.get('/offers');
        expect(status).toBe(200);
        expect(Array.isArray(data.offers)).toBe(true);
        expect(typeof data.total).toBe('number');
        expect(typeof data.pending).toBe('number');
    });

    test('GET /offers?status=pending filters to pending only', async () => {
        const offerId = seedOffer({ status: 'pending' });
        const { status, data } = await clientA.get('/offers?status=pending');
        expect(status).toBe(200);
        const statuses = data.offers.map(o => o.status);
        for (const s of statuses) {
            expect(s).toBe('pending');
        }
    });

    test('GET /offers without auth returns 401', async () => {
        const { status } = await new TestApiClient().get('/offers');
        expect(status).toBe(401);
    });
});

// ============================================================
// Get Single Offer
// ============================================================
describe('Offers - Get by ID', () => {
    test('GET /offers/:id returns 200 for own offer', async () => {
        const id = seedOffer();
        const { status, data } = await clientA.get(`/offers/${id}`);
        expect(status).toBe(200);
        expect(data.offer.id).toBe(id);
    });

    test('GET /offers/:id returns 404 for nonexistent offer', async () => {
        const { status } = await clientA.get('/offers/00000000-0000-0000-0000-000000000000');
        expect(status).toBe(404);
    });

    test('GET /offers/:id (IDOR) — User B cannot read User A offer', async () => {
        const id = seedOffer();
        const { status } = await clientB.get(`/offers/${id}`);
        expect(status).toBe(404);
    });
});

// ============================================================
// Accept Offer
// ============================================================
describe('Offers - Accept State Transition', () => {
    test('POST /offers/:id/accept on pending offer returns 200', async () => {
        const id = seedOffer();
        const { status, data } = await clientA.post(`/offers/${id}/accept`);
        expect(status).toBe(200);
        expect(data.message).toContain('accepted');
    });

    test('accepted offer has status=accepted in DB', async () => {
        const id = seedOffer();
        await clientA.post(`/offers/${id}/accept`);
        const row = query.get('SELECT status FROM offers WHERE id = ?', [id]);
        expect(row?.status).toBe('accepted');
    });

    test('POST /offers/:id/accept on already-accepted offer returns 400', async () => {
        const id = seedOffer({ status: 'accepted' });
        const { status, data } = await clientA.post(`/offers/${id}/accept`);
        expect(status).toBe(400);
        expect(data.error).toContain('already been responded');
    });

    test('POST /offers/:id/accept on declined offer returns 400', async () => {
        const id = seedOffer({ status: 'declined' });
        const { status } = await clientA.post(`/offers/${id}/accept`);
        expect(status).toBe(400);
    });

    test('POST /offers/:id/accept (IDOR) — User B cannot accept User A offer', async () => {
        const id = seedOffer();
        const { status } = await clientB.post(`/offers/${id}/accept`);
        expect(status).toBe(404);
    });

    test('POST /offers/:id/accept on nonexistent returns 404', async () => {
        const { status } = await clientA.post('/offers/00000000-0000-0000-0000-000000000000/accept');
        expect(status).toBe(404);
    });
});

// ============================================================
// Decline Offer
// ============================================================
describe('Offers - Decline State Transition', () => {
    test('POST /offers/:id/decline on pending offer returns 200', async () => {
        const id = seedOffer();
        const { status, data } = await clientA.post(`/offers/${id}/decline`);
        expect(status).toBe(200);
        expect(data.message).toContain('declined');
    });

    test('declined offer has status=declined in DB', async () => {
        const id = seedOffer();
        await clientA.post(`/offers/${id}/decline`);
        const row = query.get('SELECT status FROM offers WHERE id = ?', [id]);
        expect(row?.status).toBe('declined');
    });

    test('POST /offers/:id/decline on already-declined offer returns 400', async () => {
        const id = seedOffer({ status: 'declined' });
        const { status, data } = await clientA.post(`/offers/${id}/decline`);
        expect(status).toBe(400);
        expect(data.error).toContain('already been responded');
    });

    test('POST /offers/:id/decline on accepted offer returns 400', async () => {
        const id = seedOffer({ status: 'accepted' });
        const { status } = await clientA.post(`/offers/${id}/decline`);
        expect(status).toBe(400);
    });

    test('POST /offers/:id/decline (IDOR) — User B cannot decline User A offer', async () => {
        const id = seedOffer();
        const { status } = await clientB.post(`/offers/${id}/decline`);
        expect(status).toBe(404);
    });
});

// ============================================================
// Counter Offer
// ============================================================
describe('Offers - Counter State Transition', () => {
    test('POST /offers/:id/counter on pending offer returns 200', async () => {
        const id = seedOffer();
        const { status, data } = await clientA.post(`/offers/${id}/counter`, { amount: 20.00 });
        expect(status).toBe(200);
        expect(data.message).toContain('Counter offer');
    });

    test('countered offer has status=countered and counter_amount in DB', async () => {
        const id = seedOffer();
        await clientA.post(`/offers/${id}/counter`, { amount: 22.50 });
        const row = query.get('SELECT status, counter_amount FROM offers WHERE id = ?', [id]);
        expect(row?.status).toBe('countered');
        expect(row?.counter_amount).toBe(22.50);
    });

    test('POST /offers/:id/counter on accepted offer returns 400', async () => {
        const id = seedOffer({ status: 'accepted' });
        const { status } = await clientA.post(`/offers/${id}/counter`, { amount: 18.00 });
        expect(status).toBe(400);
    });

    test('POST /offers/:id/counter with missing amount returns 400', async () => {
        const id = seedOffer();
        const { status, data } = await clientA.post(`/offers/${id}/counter`, {});
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /offers/:id/counter with negative amount returns 400', async () => {
        const id = seedOffer();
        const { status, data } = await clientA.post(`/offers/${id}/counter`, { amount: -5 });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });

    test('POST /offers/:id/counter with zero amount returns 400', async () => {
        const id = seedOffer();
        const { status } = await clientA.post(`/offers/${id}/counter`, { amount: 0 });
        expect(status).toBe(400);
    });

    test('POST /offers/:id/counter with amount > 999999.99 returns 400', async () => {
        const id = seedOffer();
        const { status } = await clientA.post(`/offers/${id}/counter`, { amount: 1_000_000 });
        expect(status).toBe(400);
    });

    test('POST /offers/:id/counter (IDOR) — User B cannot counter User A offer', async () => {
        const id = seedOffer();
        const { status } = await clientB.post(`/offers/${id}/counter`, { amount: 12.00 });
        expect(status).toBe(404);
    });
});

// ============================================================
// State machine: no double-response
// ============================================================
describe('Offers - Double-Response Prevention', () => {
    test('cannot accept then decline the same offer', async () => {
        const id = seedOffer();
        await clientA.post(`/offers/${id}/accept`);
        const { status } = await clientA.post(`/offers/${id}/decline`);
        expect(status).toBe(400);
    });

    test('cannot decline then accept the same offer', async () => {
        const id = seedOffer();
        await clientA.post(`/offers/${id}/decline`);
        const { status } = await clientA.post(`/offers/${id}/accept`);
        expect(status).toBe(400);
    });

    test('cannot counter then accept the same offer', async () => {
        const id = seedOffer();
        await clientA.post(`/offers/${id}/counter`, { amount: 20.00 });
        const { status } = await clientA.post(`/offers/${id}/accept`);
        expect(status).toBe(400);
    });
});
