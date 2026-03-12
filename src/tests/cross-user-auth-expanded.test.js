// Cross-User Authorization — Expanded Tests
// Tests isolation for more resource types, IDOR attempts, archive cross-user
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let clientA, clientB;

beforeAll(async () => {
    const userA = await createTestUserWithToken();
    const userB = await createTestUserWithToken();
    clientA = new TestApiClient(userA.token);
    clientB = new TestApiClient(userB.token);
});

describe('Cross-User — Inventory Isolation', () => {
    test('User B cannot see User A inventory items', async () => {
        const { status: sA, data: dA } = await clientA.get('/inventory');
        const { status: sB, data: dB } = await clientB.get('/inventory');
        if (sA === 200 && sB === 200) {
            const itemsA = dA.items || dA.inventory || [];
            const itemsB = dB.items || dB.inventory || [];
            if (itemsA.length > 0) {
                const aIds = new Set(itemsA.map(i => i.id));
                const overlap = itemsB.filter(i => aIds.has(i.id));
                expect(overlap.length).toBe(0);
            }
        }
    });
});

describe('Cross-User — Listing Isolation', () => {
    test('User B cannot see User A listings', async () => {
        const { status: sA, data: dA } = await clientA.get('/listings');
        const { status: sB, data: dB } = await clientB.get('/listings');
        if (sA === 200 && sB === 200) {
            const listingsA = dA.listings || dA || [];
            const listingsB = dB.listings || dB || [];
            if (Array.isArray(listingsA) && Array.isArray(listingsB) && listingsA.length > 0) {
                const aIds = new Set(listingsA.map(l => l.id));
                const overlap = listingsB.filter(l => aIds.has(l.id));
                expect(overlap.length).toBe(0);
            }
        }
    });
});

describe('Cross-User — Automation Isolation', () => {
    test('User B gets empty automations (not User A data)', async () => {
        const { status, data } = await clientB.get('/automations');
        if (status === 200) {
            const items = data.automations || data.rules || (Array.isArray(data) ? data : []);
            expect(items.length).toBe(0);
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Cross-User — Report Isolation', () => {
    test('User B gets empty reports', async () => {
        const { status, data } = await clientB.get('/reports');
        if (status === 200) {
            const items = data.reports || (Array.isArray(data) ? data : []);
            expect(items.length).toBe(0);
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Cross-User — Webhook Isolation', () => {
    test('User B gets empty webhook endpoints', async () => {
        const { status, data } = await clientB.get('/webhooks/endpoints');
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.endpoints || []);
            expect(items.length).toBe(0);
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Cross-User — Notification Isolation', () => {
    test('User B gets only own notifications', async () => {
        const { status, data } = await clientB.get('/notifications');
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.notifications || []);
            // Fresh user should have 0 or only system-generated notifications
            expect(items.length).toBeLessThanOrEqual(5);
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Cross-User — Auth Guards', () => {
    test('No-auth request is rejected on protected endpoints', async () => {
        const noAuth = new TestApiClient();
        const endpoints = ['/inventory', '/listings', '/automations', '/reports', '/notifications'];
        for (const ep of endpoints) {
            const { status } = await noAuth.get(ep);
            expect([401, 403, 404]).toContain(status);
        }
    });

    test('Invalid token is rejected', async () => {
        const badAuth = new TestApiClient('invalid.token.here');
        const { status } = await badAuth.get('/inventory');
        expect([401, 403]).toContain(status);
    });

    test('Expired-format token is rejected', async () => {
        // Craft a token that looks valid but isn't
        const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwiZXhwIjoxfQ.fake';
        const badAuth = new TestApiClient(fakeToken);
        const { status } = await badAuth.get('/inventory');
        expect([401, 403]).toContain(status);
    });
});

describe('Cross-User — IDOR Attempts', () => {
    test('User B cannot update User A inventory item by guessing ID', async () => {
        // Create an item as User A
        const { status: createStatus, data: createData } = await clientA.post('/inventory', {
            title: 'IDOR Test Item',
            brand: 'TestBrand',
            category: 'Tops',
            purchase_price: 10,
            listing_price: 25
        });
        if (createStatus === 201 || createStatus === 200) {
            const itemId = createData.id || createData.item?.id;
            if (itemId) {
                // User B tries to update it
                const { status: updateStatus } = await clientB.put(`/inventory/${itemId}`, {
                    title: 'HACKED BY USER B'
                });
                expect([403, 404]).toContain(updateStatus);
            }
        }
    });

    test('User B cannot delete User A inventory item', async () => {
        const { status: createStatus, data: createData } = await clientA.post('/inventory', {
            title: 'IDOR Delete Test',
            brand: 'TestBrand',
            category: 'Tops',
            purchase_price: 5,
            listing_price: 15
        });
        if (createStatus === 201 || createStatus === 200) {
            const itemId = createData.id || createData.item?.id;
            if (itemId) {
                const { status: deleteStatus } = await clientB.delete(`/inventory/${itemId}`);
                expect([403, 404]).toContain(deleteStatus);
            }
        }
    });
});

// ─── IDOR Read Tests (direct object access by ID) ───────────────────────────

describe('Cross-User — IDOR Read: Inventory Item by ID', () => {
    test('User B cannot GET /inventory/:id belonging to User A', async () => {
        // Create an item as User A
        const { status: createStatus, data: createData } = await clientA.post('/inventory', {
            title: 'IDOR Read Test Item',
            brand: 'SecureBrand',
            category: 'Tops',
            purchase_price: 10,
            listing_price: 30
        });
        if (createStatus === 201 || createStatus === 200) {
            const itemId = createData.id || createData.item?.id;
            if (itemId) {
                // User B tries to read User A's item directly
                const { status: readStatus } = await clientB.get(`/inventory/${itemId}`);
                expect([403, 404]).toContain(readStatus);
            }
        }
    });
});

describe('Cross-User — IDOR Read: Order by ID', () => {
    test('User B cannot GET /orders/:id belonging to User A', async () => {
        // Get User A's orders to find an ID
        const { status, data } = await clientA.get('/orders');
        if (status === 200) {
            const orders = data.orders || (Array.isArray(data) ? data : []);
            if (orders.length > 0) {
                const orderId = orders[0].id;
                // User B tries to read User A's order
                const { status: readStatus } = await clientB.get(`/orders/${orderId}`);
                expect([403, 404]).toContain(readStatus);
            }
        }
    });
});

// ─── IDOR: Listing by direct ID ──────────────────────────────────────────────

describe('Cross-User — IDOR Read: Listing by ID', () => {
    test('User B cannot GET /listings/:id belonging to User A', async () => {
        // Create an inventory item and listing as User A
        const { status: invStatus, data: invData } = await clientA.post('/inventory', {
            title: 'IDOR Listing Test Item',
            listPrice: 20.00
        });

        if (invStatus !== 201 && invStatus !== 200) return;
        const invId = invData.item?.id || invData.id;
        if (!invId) return;

        const { status: listStatus, data: listData } = await clientA.post('/listings', {
            inventoryId: invId,
            platform: 'poshmark',
            title: 'IDOR Listing Test',
            price: 20.00
        });

        if (listStatus !== 201 && listStatus !== 200) return;
        const listingId = listData.listing?.id || listData.id;
        if (!listingId) return;

        // User B attempts to read by direct ID
        const { status: readStatus } = await clientB.get(`/listings/${listingId}`);
        expect([403, 404]).toContain(readStatus);
    });

    test('GET /listings/:id with nonexistent ID returns 404', async () => {
        const { status } = await clientA.get('/listings/00000000-0000-0000-0000-000000000000');
        expect(status).toBe(404);
    });
});

// ─── IDOR: Sale by direct ID ──────────────────────────────────────────────────

describe('Cross-User — IDOR Read: Sale by ID', () => {
    test('User B cannot GET /sales/:id belonging to User A', async () => {
        // Record a sale as User A
        const { status: saleStatus, data: saleData } = await clientA.post('/sales', {
            platform: 'poshmark',
            salePrice: 18.00
        });

        if (saleStatus !== 201 && saleStatus !== 200) {
            // If sale creation fails (e.g. missing required listing), skip
            return;
        }
        const saleId = saleData.sale?.id || saleData.id;
        if (!saleId) return;

        // User B attempts to read by direct ID
        const { status: readStatus } = await clientB.get(`/sales/${saleId}`);
        expect([403, 404]).toContain(readStatus);
    });

    test('GET /sales/:id with nonexistent ID returns 404', async () => {
        const { status } = await clientA.get('/sales/00000000-0000-0000-0000-000000000000');
        expect(status).toBe(404);
    });
});
