import { test, expect } from '@playwright/test';
import { loginAndNavigate, waitForUiSettle } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

test.describe('Teams Page', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndNavigate(page, 'teams');
    });

    test('renders page title "Team Management"', async ({ page }) => {
        await expect(page.locator('h1.page-title')).toContainText('Team Management');
    });

    test('displays page subtitle', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('p.page-subtitle')).toContainText('Manage your teams, members, roles, and permissions');
    });

    test('"Create Team" button is visible', async ({ page }) => {
        await waitForUiSettle(page);
        await expect(page.locator('button:has-text("Create Team")')).toBeVisible();
    });

    test('page main container loads without crash', async ({ page }) => {
        await waitForUiSettle(page);
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        const heading = page.locator('h1.page-title');
        await expect(heading).toBeVisible();
        if (pageErrors.length > 0) {
            console.warn(`Page errors on teams: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors.length).toBe(0);
    });

    test('shows "Invite Member" button or an empty team state', async ({ page }) => {
        await waitForUiSettle(page);
        const inviteBtn = page.locator('button:has-text("Invite Member")');
        const inviteVisible = await inviteBtn.isVisible().catch(() => false);
        if (inviteVisible) {
            await expect(inviteBtn).toBeVisible();
        } else {
            const emptyState = page.locator('button, p, span').filter({ hasText: /no teams|create your first|get started/i }).first();
            await expect(emptyState).toBeVisible();
        }
    });
});
