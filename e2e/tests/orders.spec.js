import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Orders Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'orders');
    });

    test('renders page title "Orders"', async ({ page }) => {
        await expect(page.locator('h1.orders-hero-title')).toContainText('Orders');
    });

    test('displays orders pipeline', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('div.orders-pipeline')).toBeVisible();
    });

    test('quick stats section is visible', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('div.orders-quick-stats')).toBeVisible();
    });

    test('loads without page-level JS errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        await waitForUiSettle(page);
        if (pageErrors.length > 0) {
            console.warn(`Page errors on orders: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows order rows or empty state', async ({ page }) => {
        await waitForUiSettle(page);
        const rows = page.locator('.table tbody tr');
        const rowCount = await rows.count();
        if (rowCount > 0) {
            await expect(rows.first()).toBeVisible();
        } else {
            const emptyState = page.locator('p, span, td').filter({ hasText: /no orders|add order|get started/i }).first();
            await expect(emptyState).toBeVisible();
        }
    });
});
