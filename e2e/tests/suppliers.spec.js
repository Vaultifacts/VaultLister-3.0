import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Suppliers Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'suppliers');
    });

    test('renders page title "Supplier Monitoring"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('Supplier Monitoring');
    });

    test('displays page description', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('p.page-description')).toContainText('Track suppliers, pricing, and stock levels');
    });

    test('search input is visible and accepts input', async ({ page }) => {
        await waitForUiSettle(page);
        const searchInput = page.locator('input#supplier-search-input');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('test supplier');
        await expect(searchInput).toHaveValue('test supplier');
        await searchInput.fill('');
    });

    test('sort dropdown is visible', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('select#supplier-sort-select')).toBeVisible();
    });

    test('"Add Supplier" button is visible', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('button:has-text("Add Supplier")')).toBeVisible();
    });

    test('"Import CSV" and "Refresh All" buttons are present', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('button:has-text("Import CSV")')).toBeVisible();
        await expect(page.locator('button:has-text("Refresh All")')).toBeVisible();
    });

    test('shows supplier list or empty state container', async ({ page }) => {
        await waitForUiSettle(page);
        const supplierRows = page.locator('[class*="supplier-row"], [class*="supplier-card"], tbody tr');
        const rowCount = await supplierRows.count();
        if (rowCount > 0) {
            await expect(supplierRows.first()).toBeVisible();
        } else {
            const emptyState = page.locator('[class*="empty"], p, span').filter({ hasText: /no suppliers|add your first|get started/i }).first();
            await expect(emptyState).toBeVisible();
        }
    });
});
