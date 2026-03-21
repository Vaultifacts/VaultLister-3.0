// Onboarding Banner E2E Tests
// Tests the getting-started checklist that appears for fresh users with 0 inventory.
// Verifies render, dismiss, and localStorage persistence.
import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';
import { apiLogin, injectAuth } from '../fixtures/auth.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the dashboard as a fresh user with onboarding not dismissed
 * and no inventory/listings/sales in the store (simulated via cleared state).
 */
async function goToDashboardFreshUser(page, request) {
    const loginData = await apiLogin(request);

    // Set vl_access cookie to bypass landing page
    const url = new URL(BASE);
    await page.context().addCookies([{
        name: 'vl_access',
        value: loginData.token,
        domain: url.hostname,
        path: '/',
    }]);

    // Navigate to SPA and set clean state — clear onboarding dismissed flag
    await page.goto(`${BASE}/#login`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => {
        try {
            localStorage.removeItem('vaultlister_onboarding_dismissed');
            localStorage.removeItem('vaultlister_onboarding');
        } catch {}
    });
    await injectAuth(page, loginData);

    // Navigate to dashboard
    await page.goto(`${BASE}/#dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Inject auth into store and force empty inventory/listings/sales so onboarding shows
    await page.evaluate((ad) => {
        if (typeof store !== 'undefined' && store.setState) {
            store.setState({
                user: ad.user,
                token: ad.token,
                refreshToken: ad.refreshToken,
                inventory: [],
                listings: [],
                sales: [],
                shops: []
            });
        }
    }, loginData);

    // Re-render dashboard with the clean state
    await page.evaluate(() => {
        if (typeof router !== 'undefined' && router.navigate) {
            router.navigate('dashboard');
        }
    });
    await waitForSpaRender(page);

    // Dismiss cookie banner / announcement overlays if present
    const dismissBtn = page.locator('button:has-text("Dismiss announcement")');
    if (await dismissBtn.isVisible().catch(() => false)) {
        await dismissBtn.click();
        await page.waitForTimeout(400);
    }
    const acceptBtn = page.locator('#cookie-banner button:has-text("Accept"), #cookie-banner button:has-text("Decline")').first();
    if (await acceptBtn.isVisible().catch(() => false)) {
        await acceptBtn.click();
        await page.waitForTimeout(200);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Onboarding Banner', () => {
    test('should display onboarding checklist when user has not dismissed it', async ({ page, request }) => {
        await goToDashboardFreshUser(page, request);

        const checklist = page.locator('#onboarding-checklist');
        await expect(checklist).toBeVisible({ timeout: 10_000 });
    });

    test('should render at least 3 onboarding steps', async ({ page, request }) => {
        await goToDashboardFreshUser(page, request);

        await page.waitForSelector('#onboarding-checklist', { timeout: 10_000 });
        const steps = page.locator('#onboarding-checklist .onboarding-step');
        const count = await steps.count();
        expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should show a dismiss button on the onboarding checklist', async ({ page, request }) => {
        await goToDashboardFreshUser(page, request);

        await page.waitForSelector('#onboarding-checklist', { timeout: 10_000 });
        const dismissBtn = page.locator('#onboarding-checklist .onboarding-dismiss');
        await expect(dismissBtn).toBeVisible();
    });

    test('should remove the checklist from the DOM when dismiss is clicked', async ({ page, request }) => {
        await goToDashboardFreshUser(page, request);

        await page.waitForSelector('#onboarding-checklist', { timeout: 10_000 });
        await page.locator('#onboarding-checklist .onboarding-dismiss').click();

        // Checklist animates out (300ms) then is removed
        await page.waitForFunction(
            () => !document.getElementById('onboarding-checklist'),
            { timeout: 5_000 }
        );
        await expect(page.locator('#onboarding-checklist')).toHaveCount(0);
    });

    test('should persist dismissed state in localStorage after clicking dismiss', async ({ page, request }) => {
        await goToDashboardFreshUser(page, request);

        await page.waitForSelector('#onboarding-checklist', { timeout: 10_000 });
        await page.locator('#onboarding-checklist .onboarding-dismiss').click();
        await page.waitForTimeout(400); // allow animation + localStorage write

        const dismissed = await page.evaluate(
            () => localStorage.getItem('vaultlister_onboarding_dismissed')
        );
        expect(dismissed).toBe('true');
    });

    test('should not show the checklist after page refresh when dismissed', async ({ page, request }) => {
        await goToDashboardFreshUser(page, request);

        await page.waitForSelector('#onboarding-checklist', { timeout: 10_000 });
        await page.locator('#onboarding-checklist .onboarding-dismiss').click();
        await page.waitForTimeout(400);

        // Reload the page — dismissed flag is in localStorage
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await waitForSpaRender(page);

        // Checklist must not reappear
        const visible = await page.locator('#onboarding-checklist').isVisible().catch(() => false);
        expect(visible).toBe(false);
    });

    test('should not show onboarding checklist when dismissed flag is already set', async ({ page, request }) => {
        const loginData = await apiLogin(request);

        const url = new URL(BASE);
        await page.context().addCookies([{
            name: 'vl_access',
            value: loginData.token,
            domain: url.hostname,
            path: '/',
        }]);

        await page.goto(`${BASE}/#login`);
        await page.waitForLoadState('domcontentloaded');

        // Pre-set the dismissed flag before navigating to dashboard
        await page.evaluate(() => {
            localStorage.setItem('vaultlister_onboarding_dismissed', 'true');
        });
        await injectAuth(page, loginData);

        await page.goto(`${BASE}/#dashboard`);
        await page.waitForLoadState('domcontentloaded');
        await waitForSpaRender(page);

        await expect(page.locator('#onboarding-checklist')).toHaveCount(0);
    });
});
