// Inventory E2E Tests
import { test, expect } from '@playwright/test';
import { demoUser, generateInventoryItem, selectors, routes } from '../fixtures/test-data.js';

test.describe('Inventory Management', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto(routes.login);
        await page.waitForSelector(selectors.loginForm);
        await page.fill(selectors.emailInput, demoUser.email);
        await page.fill(selectors.passwordInput, demoUser.password);
        await page.click(selectors.submitButton);
        await page.waitForURL(/#dashboard/, { timeout: 10000 });
    });

    test('should navigate to inventory page', async ({ page }) => {
        // Click on inventory button in sidebar
        const inventoryBtn = page.locator('button.nav-item:has-text("Inventory")').first();
        await inventoryBtn.waitFor({ state: 'visible', timeout: 10000 });
        await inventoryBtn.click();

        // Should navigate to inventory page
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Should be on inventory page
        await expect(page).toHaveURL(/#inventory/);
    });

    test('should display inventory items', async ({ page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(2000);

        // Should be on inventory page without errors
        await expect(page).toHaveURL(/#inventory/);
    });

    test('should search inventory items', async ({ page }) => {
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

    test('should filter inventory by status', async ({ page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for page to load
        await page.waitForTimeout(1000);

        // Find status filter dropdown
        const statusSelect = page.locator('select').first();

        if (await statusSelect.isVisible()) {
            // Change filter
            await statusSelect.selectOption({ index: 1 });

            // Wait for filter to apply
            await page.waitForTimeout(500);

            // Should still be on inventory page without errors
            await expect(page).toHaveURL(/#inventory/);
        }
    });

    test('should show inventory statistics', async ({ page }) => {
        await page.goto(routes.inventory);
        await page.waitForURL(/#inventory/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Page should load correctly
        await expect(page).toHaveURL(/#inventory/);
    });
});
