import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Shops Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'shops');
    });

    test('renders page title "My Shops"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('My Shops');
    });

    test('displays the shops hero section', async ({ page }) => {
        await waitForUiSettle(page);
        const hero = page.locator('div.shops-hero');
        await expect(hero).toBeVisible();
    });

    test('shops hero stats are visible', async ({ page }) => {
        await waitForUiSettle(page);
        const stats = page.locator('div.shops-hero-stats');
        await expect(stats).toBeVisible();
    });

    test('loads without page-level JS errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        await waitForUiSettle(page);
        if (pageErrors.length > 0) {
            console.warn(`Page errors on shops: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows shop cards or an empty/connect state', async ({ page }) => {
        await waitForUiSettle(page);
        const shopCards = page.locator('div.card.shop-card');
        const cardCount = await shopCards.count();
        if (cardCount > 0) {
            await expect(shopCards.first()).toBeVisible();
        } else {
            const emptyState = page.locator('button, a, p').filter({ hasText: /connect|add shop|get started|no shops/i }).first();
            await expect(emptyState).toBeVisible();
        }
    });
});
