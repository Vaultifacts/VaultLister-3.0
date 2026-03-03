import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Financials Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'financials');
    });

    test('renders page title "Financials"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('Financials');
    });

    test('displays financials hero section', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('div.financials-hero')).toBeVisible();
    });

    test('financial overview summary is visible', async ({ page }) => {
        await waitForUiSettle(page);
        const summary = page.locator('div.financials-summary');
        await expect(summary).toBeVisible();
    });

    test('loads without page-level JS errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        await waitForUiSettle(page);
        if (pageErrors.length > 0) {
            console.warn(`Page errors on financials: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows financial data or empty state', async ({ page }) => {
        await waitForUiSettle(page);
        const grid = page.locator('div.financials-summary-grid');
        const gridVisible = await grid.isVisible().catch(() => false);
        if (gridVisible) {
            await expect(grid).toBeVisible();
        } else {
            const fallback = page.locator('.card, .stat-card, .financials-hero-main').first();
            await expect(fallback).toBeVisible();
        }
    });
});
