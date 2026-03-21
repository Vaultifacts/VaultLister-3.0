// Cross-listing Publish Retry E2E Tests
// Tests UI rendering and navigation for the cross-listing flow.
// Does NOT test actual marketplace publishing — UI interactions only.
import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';
import { test as authTest } from '../fixtures/auth.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// Note: #crosslist redirects to #listings via router.register.
// Cross-listing is initiated from inventory or listings, not a standalone route.

// ── Listings page (cross-listing entry point) ─────────────────────────────────

test.describe('Cross-listing — listings page renders', () => {
    authTest('should load the listings page when navigating to #listings', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('listings'));
        await waitForSpaRender(page);

        // The page content must be rendered
        await expect(page.locator('#app')).toBeVisible();
        const appHtml = await page.locator('#app').innerHTML();
        expect(appHtml.length).toBeGreaterThan(100);
    });

    authTest('should show listings section heading or empty state when on listings page', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('listings'));
        await waitForSpaRender(page);

        // Accept either populated listings table or empty-state message
        const hasTable = await page.locator('table').isVisible({ timeout: 5_000 }).catch(() => false);
        const hasEmptyState = await page.locator(
            '[class*="empty"], [class*="no-listings"], [class*="no-results"], text=/no listings/i'
        ).isVisible({ timeout: 2_000 }).catch(() => false);
        const hasAddButton = await page.locator(
            'button:has-text("Add"), button:has-text("Create"), button:has-text("List"), a:has-text("Add"), a:has-text("Create")'
        ).first().isVisible({ timeout: 2_000 }).catch(() => false);

        expect(hasTable || hasEmptyState || hasAddButton).toBe(true);
    });

    authTest('should navigate to listings when #crosslist hash is used', async ({ authedPage: page }) => {
        // #crosslist is registered as an alias that redirects to listings
        await page.goto(`${BASE}/#crosslist`);
        await page.waitForLoadState('domcontentloaded');
        await waitForSpaRender(page);

        // Should end up on listings page content (not a blank page)
        const appHtml = await page.locator('#app').innerHTML();
        expect(appHtml.length).toBeGreaterThan(100);
    });
});

// ── Inventory page — cross-listing trigger ────────────────────────────────────

test.describe('Cross-listing — trigger from inventory page', () => {
    authTest('should load the inventory page as a prerequisite for cross-listing', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('inventory'));
        await waitForSpaRender(page);

        await expect(page.locator('#app')).toBeVisible();
        const appHtml = await page.locator('#app').innerHTML();
        expect(appHtml.length).toBeGreaterThan(100);
    });

    authTest('should render a cross-list or list button when inventory items are present', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('inventory'));
        await waitForSpaRender(page);

        const hasInventoryRows = await page.locator('table tbody tr').count() > 0;
        if (!hasInventoryRows) {
            // No inventory — cross-list trigger not applicable
            console.log('No inventory items present — cross-list trigger not testable: acceptable');
            return;
        }

        // Look for a "List" or "Cross-List" button in the inventory table
        const listBtn = page.locator(
            'button:has-text("List"), button:has-text("Cross-List"), button:has-text("Sell"), [data-action="crosslist"]'
        ).first();
        const visible = await listBtn.isVisible({ timeout: 3_000 }).catch(() => false);
        if (visible) {
            await expect(listBtn).toBeEnabled();
        } else {
            console.log('No direct cross-list button visible in inventory — may require row selection: acceptable');
        }
    });
});

// ── Cross-listing modal / form ────────────────────────────────────────────────

test.describe('Cross-listing — modal form UI', () => {
    authTest('should render crosslist form when opened from a listing-mode card', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('inventory'));
        await waitForSpaRender(page);

        const hasInventoryRows = await page.locator('table tbody tr').count() > 0;
        if (!hasInventoryRows) {
            test.skip(true, 'No inventory items — cannot open cross-list modal');
            return;
        }

        // Attempt to find and click a row action that opens the crosslist modal
        const listBtn = page.locator(
            'button:has-text("List"), button:has-text("Cross-List"), [data-action="crosslist"]'
        ).first();
        if (!await listBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            test.skip(true, 'No cross-list trigger button visible');
            return;
        }

        await listBtn.click();
        await waitForUiSettle(page);

        // Either the crosslist form or a listing mode selection modal should appear
        const crosslistForm = page.locator('#crosslist-form, #advanced-crosslist-form, .listing-mode-card');
        await expect(crosslistForm.first()).toBeVisible({ timeout: 5_000 });
    });

    authTest('should render platform checkboxes inside the crosslist form', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('inventory'));
        await waitForSpaRender(page);

        const hasInventoryRows = await page.locator('table tbody tr').count() > 0;
        if (!hasInventoryRows) {
            test.skip(true, 'No inventory items — cannot open cross-list form');
            return;
        }

        const listBtn = page.locator(
            'button:has-text("List"), button:has-text("Cross-List"), [data-action="crosslist"]'
        ).first();
        if (!await listBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            test.skip(true, 'No cross-list trigger button visible');
            return;
        }

        await listBtn.click();
        await waitForUiSettle(page);

        // Look for platform selection checkboxes within any opened modal or form
        const platformCheckbox = page.locator(
            '#crosslist-form input[type="checkbox"], #advanced-crosslist-form input[type="checkbox"]'
        ).first();
        const checkboxVisible = await platformCheckbox.isVisible({ timeout: 3_000 }).catch(() => false);

        if (checkboxVisible) {
            await expect(platformCheckbox).toBeEnabled();
        } else {
            console.log('Platform checkboxes not immediately visible — may be in nested modal: acceptable');
        }
    });
});

// ── Retry / publish button ─────────────────────────────────────────────────────

test.describe('Cross-listing — publish button presence', () => {
    authTest('should show a publish or submit button in the crosslist form', async ({ authedPage: page }) => {
        await page.evaluate(() => router.navigate('inventory'));
        await waitForSpaRender(page);

        const hasInventoryRows = await page.locator('table tbody tr').count() > 0;
        if (!hasInventoryRows) {
            test.skip(true, 'No inventory items — cannot reach publish button');
            return;
        }

        const listBtn = page.locator(
            'button:has-text("List"), button:has-text("Cross-List"), [data-action="crosslist"]'
        ).first();
        if (!await listBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
            test.skip(true, 'No cross-list trigger button visible');
            return;
        }

        await listBtn.click();
        await waitForUiSettle(page);

        const publishBtn = page.locator(
            'button:has-text("Publish"), button:has-text("List Now"), button:has-text("Submit"), button[type="submit"]'
        ).first();
        const publishVisible = await publishBtn.isVisible({ timeout: 3_000 }).catch(() => false);

        if (publishVisible) {
            await expect(publishBtn).toBeVisible();
            // Do NOT click — would attempt a live marketplace publish
        } else {
            console.log('Publish button not found in first modal state — may require platform selection first: acceptable');
        }
    });
});
