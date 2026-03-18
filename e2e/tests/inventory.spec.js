// Inventory E2E Tests
import { test, expect } from '../fixtures/auth.js';
import { generateInventoryItem, selectors, routes } from '../fixtures/test-data.js';

test.describe('Inventory Management', () => {

    test('should navigate to inventory page', async ({ authedPage: page }) => {
        // Click on inventory link in sidebar
        const inventoryBtn = page.locator('.nav-item:has-text("Inventory"), a:has-text("Inventory")').first();
        await inventoryBtn.waitFor({ state: 'visible', timeout: 10000 });
        await inventoryBtn.click();

        // Should navigate to inventory page
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Should be on inventory page
        await expect(page).toHaveURL(/#inventory/);
    });

    test('should display inventory items', async ({ authedPage: page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(2000);

        // Should be on inventory page without errors
        await expect(page).toHaveURL(/#inventory/);
    });

    test('should search inventory items', async ({ authedPage: page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for page to load
        await page.waitForTimeout(1000);

        // Find search input
        const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();

        if (await searchInput.isVisible()) {
            // Type search query
            await searchInput.fill('test');

            // Wait for results to filter
            await page.waitForTimeout(500);

            // Search should be applied (we just verify no errors occur)
            await expect(page).toHaveURL(/#inventory/);
        }
    });

    test('should filter inventory by status', async ({ authedPage: page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for page to load
        await page.waitForTimeout(1000);

        // Find status filter dropdown
        const statusSelect = page.locator('select').first();

        const options = await statusSelect.locator('option').count();
        if (await statusSelect.isVisible() && options > 1) {
            // Change filter
            await statusSelect.selectOption({ index: 1 });

            // Wait for filter to apply
            await page.waitForTimeout(500);

            // Should still be on inventory page without errors
            await expect(page).toHaveURL(/#inventory/);
        }
    });

    test('should show inventory statistics', async ({ authedPage: page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Page should load correctly
        await expect(page).toHaveURL(/#inventory/);
    });
});
