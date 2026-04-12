import { test, expect } from '../fixtures/auth.js';
import { cleanupSmokeResources, createInventory, createListing, getListing, publishListingToEbay } from '../helpers/smoke-helpers.js';

const NO_EBAY_SHOP_MESSAGE = 'No connected eBay shop found. Connect eBay in My Shops first.';

test('smoke listings: publish-ebay fails safely with no connected shop and leaves listing in draft', async ({ request, authToken }) => {
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

        const publishResult = await publishListingToEbay(request, authToken, cleanup.listingId);
        expect(publishResult.response.status()).toBe(400);
        expect(publishResult.body?.error?.message || publishResult.body?.error).toBe(NO_EBAY_SHOP_MESSAGE);

        const listingRecord = await getListing(request, authToken, cleanup.listingId);
        expect(listingRecord.response.status()).toBe(200);
        expect(listingRecord.body?.listing?.status).toBe('draft');
    } finally {
        await cleanupSmokeResources(request, authToken, cleanup);
    }
});
