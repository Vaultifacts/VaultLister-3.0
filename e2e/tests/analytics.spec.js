import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Analytics Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'analytics');
    });

    test('renders page title "Analytics"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('Analytics');
    });

    test('displays analytics hero section', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('div.analytics-hero')).toBeVisible();
    });

    test('period selector is visible and has options', async ({ page }) => {
        await waitForUiSettle(page);
        const periodSelect = page.locator('select#analytics-period');
        await expect(periodSelect).toBeVisible();
        const options = await periodSelect.locator('option').allTextContents();
        expect(options.some(o => o.includes('Last 30 Days'))).toBe(true);
    });

    test('loads without page-level JS errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        await waitForUiSettle(page);
        if (pageErrors.length > 0) {
            console.warn(`Page errors on analytics: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows analytics tabs or stat cards', async ({ page }) => {
        await waitForUiSettle(page);
        const tabs = page.locator('[role="tab"], .tab-btn, .analytics-tab');
        const tabCount = await tabs.count();
        if (tabCount > 0) {
            await expect(tabs.first()).toBeVisible();
        } else {
            const stats = page.locator('.stat-card, .metric-card, .analytics-hero-snapshot');
            await expect(stats.first()).toBeVisible();
        }
    });
});
