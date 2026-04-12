import { test, expect } from '../fixtures/auth.js';
import { cleanupSmokeResources, createInventory, createListing, getListing } from '../helpers/smoke-helpers.js';

test('smoke listings: created listing remains in draft status', async ({ request, authToken }) => {
    const cleanup = { inventoryId: null, listingId: null };

    try {
        const inventory = await createInventory(request, authToken);
        expect(inventory.response.status()).toBe(201);
        expect(inventory.itemId).toBeTruthy();
        cleanup.inventoryId = inventory.itemId;

        const listing = await createListing(request, authToken, cleanup.inventoryId);
        expect(listing.response.status()).toBe(201);
        expect(listing.listingId).toBeTruthy();
        cleanup.listingId = listing.listingId;

        const listingRecord = await getListing(request, authToken, cleanup.listingId);
        expect(listingRecord.response.status()).toBe(200);
        expect(listingRecord.body?.listing?.status).toBe('draft');
    } finally {
        await cleanupSmokeResources(request, authToken, cleanup);
    }
});
