import { test, expect } from '../fixtures/auth.js';
import { routes } from '../fixtures/test-data.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';
import { cleanupSmokeResources, createInventory, createListing } from '../helpers/smoke-helpers.js';

test('smoke listings: create listing and load listings page without page-level errors', async ({ authedPage: page, request, authToken }) => {
    const cleanup = { inventoryId: null, listingId: null };
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    try {
        const inventory = await createInventory(request, authToken);
        expect(inventory.response.status()).toBe(201);
        expect(inventory.itemId).toBeTruthy();
        cleanup.inventoryId = inventory.itemId;

        const listing = await createListing(request, authToken, cleanup.inventoryId);
        expect(listing.response.status()).toBe(201);
        expect(listing.listingId).toBeTruthy();
        cleanup.listingId = listing.listingId;

        await page.goto(routes.listings);
        await page.waitForURL(/#listings/, { timeout: 15000 });
        await waitForSpaRender(page);
        await waitForUiSettle(page);

        await expect(page).toHaveURL(/#listings/);
        await expect(page.locator('body')).toBeVisible();
        expect(pageErrors).toHaveLength(0);
    } finally {
        await cleanupSmokeResources(request, authToken, cleanup);
    }
});
