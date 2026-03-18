import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

const BASE = `http://localhost:${process.env.PORT || 3001}`;

test.describe('Suppliers Page', () => {
    test.beforeEach(async ({ authedPage: page }) => {
        // Suppliers is now the "Sourcing" tab within Analytics (sidebar consolidation).
        // Navigate to analytics first so the page is set up, then force-switch to sourcing tab.
        await page.goto(`${BASE}/#analytics`);
        await page.waitForLoadState('domcontentloaded');
        // Wait for analytics page to be rendered with its tabs
        await page.waitForSelector('.tabs.mb-6', { timeout: 15_000 });
        // Load the intelligence chunk (contains pages.suppliers) by injecting it as a script
        await page.evaluate(async () => {
            // Load the intelligence chunk if not already loaded
            if (typeof pages.suppliers !== 'function') {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = '/chunk-intelligence.js?v=19';
                    s.onload = resolve;
                    s.onerror = reject;
                    document.head.appendChild(s);
                });
            }
            // Now set analyticsTab to sourcing and re-render
            store.setState({ analyticsTab: 'sourcing' });
            renderApp(pages.analytics());
        });
        // Wait for the suppliers content to appear
        await page.waitForSelector('input#supplier-search-input', { timeout: 15_000 });
        await waitForUiSettle(page);
    });

    test('renders page title "Supplier Monitoring"', async ({ authedPage: page }) => {
        // The suppliers page is rendered inside the analytics sourcing tab;
        // there may be multiple h1.page-title — select the one with the supplier text
        await expect(page.locator('h1.page-title:has-text("Supplier Monitoring")')).toBeVisible();
    });

    test('displays page description', async ({ authedPage: page }) => {
        await waitForUiSettle(page);
        // The suppliers page description may coexist with the analytics description
        await expect(page.locator('p.page-description:has-text("Track suppliers, pricing, and stock levels")')).toBeVisible();
    });

    test('search input is visible and accepts input', async ({ authedPage: page }) => {
        await waitForUiSettle(page);
        const searchInput = page.locator('input#supplier-search-input');
        await expect(searchInput).toBeVisible();
        await searchInput.fill('test supplier');
        await expect(searchInput).toHaveValue('test supplier');
        await searchInput.fill('');
    });

    test('sort dropdown is visible', async ({ authedPage: page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('select#supplier-sort-select')).toBeVisible();
    });

    test('"Add Supplier" button is visible', async ({ authedPage: page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('button:has-text("Add Supplier")')).toBeVisible();
    });

    test('"Import CSV" and "Refresh All" buttons are present', async ({ authedPage: page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('button:has-text("Import CSV")')).toBeVisible();
        await expect(page.locator('button:has-text("Refresh All")')).toBeVisible();
    });

    test('shows supplier list or empty state container', async ({ authedPage: page }) => {
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
