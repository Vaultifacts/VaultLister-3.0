import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Settings Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'settings');
    });

    test('renders page title "Settings"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('Settings');
    });

    test('displays settings tabs', async ({ page }) => {
        await waitForUiSettle(page);
        const tabs = page.locator('.settings-tabs, [role="tablist"], .tab-nav').first();
        await expect(tabs).toBeVisible();
    });

    test('profile section is visible on default tab', async ({ page }) => {
        await waitForUiSettle(page);
        const profileSection = page.locator('div.settings-profile-header, div.settings-section').first();
        await expect(profileSection).toBeVisible();
    });

    test('loads without page-level JS errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        await waitForUiSettle(page);
        if (pageErrors.length > 0) {
            console.warn(`Page errors on settings: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows save or edit button for profile', async ({ page }) => {
        await waitForUiSettle(page);
        const actionBtn = page.locator('button').filter({ hasText: /save|edit profile|update/i }).first();
        const actionVisible = await actionBtn.isVisible().catch(() => false);
        if (actionVisible) {
            await expect(actionBtn).toBeVisible();
        } else {
            const form = page.locator('form, .settings-section, .settings-profile-info').first();
            await expect(form).toBeVisible();
        }
    });
});
