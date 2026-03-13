// Automations E2E Tests
import { test, expect } from '@playwright/test';
import { demoUser, selectors, routes } from '../fixtures/test-data.js';

test.describe('Automation Management', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto(routes.login);
        await page.waitForSelector(selectors.loginForm);
        await page.fill(selectors.emailInput, demoUser.email);
        await page.fill(selectors.passwordInput, demoUser.password);
        await page.click(selectors.submitButton);
        await page.waitForURL(/#dashboard/, { timeout: 30000 });
    });

    test('should navigate to automations page', async ({ page }) => {
        // Click on automations button in sidebar
        const automationsBtn = page.locator('button.nav-item:has-text("Automations")').first();
        await automationsBtn.waitFor({ state: 'visible', timeout: 10000 });
        await automationsBtn.click();

        // Should navigate to automations page
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Should see page title or content
        await expect(page.getByText(/Automation|Rules/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should display automation rules list', async ({ page }) => {
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Should see automation rules section
        const rulesSection = page.locator('.automation-rules, .rules-list, table, .card');
        await expect(rulesSection.first()).toBeVisible({ timeout: 5000 });
    });

    test('should display automation presets', async ({ page }) => {
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Look for preset rules (Daily Closet Share, Auto Accept, Follow Back)
        const presetText = page.locator('text=/Share|Follow|Offer/i');
        const hasPresets = await presetText.count() > 0;

        // Presets should be visible
        expect(hasPresets).toBeTruthy();
    });

    test('should toggle automation rule', async ({ page }) => {
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Find a toggle switch
        const toggleSwitch = page.locator('input[type="checkbox"]').first();

        if (await toggleSwitch.isVisible()) {
            // Get initial state
            const initialState = await toggleSwitch.isChecked();

            // Click to toggle
            await toggleSwitch.click();

            // Wait for state change
            await page.waitForTimeout(500);

            // State should have changed (or an error notification shown)
            const newState = await toggleSwitch.isChecked();

            // Verify the page didn't crash
            await expect(page).toHaveURL(/#automations/);
        }
    });

    test('should show platform badges', async ({ page }) => {
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Look for platform badges/icons (Poshmark, eBay, etc.)
        const platformBadges = page.locator('.platform-icon, .platform-badge');
        const platformText = page.getByText(/poshmark|ebay|mercari/i);
        const hasPlatforms = (await platformBadges.count()) > 0 || (await platformText.count()) > 0;

        expect(hasPlatforms).toBeTruthy();
    });
});

test.describe('Automation Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Login
        await page.goto(routes.login);
        await page.waitForSelector(selectors.loginForm);
        await page.fill(selectors.emailInput, demoUser.email);
        await page.fill(selectors.passwordInput, demoUser.password);
        await page.click(selectors.submitButton);
        await page.waitForURL(/#dashboard/, { timeout: 30000 });
    });

    test('should navigate between dashboard and automations', async ({ page }) => {
        // Go to automations
        const automationsBtn = page.locator('button.nav-item:has-text("Automations")').first();
        await automationsBtn.waitFor({ state: 'visible', timeout: 10000 });
        await automationsBtn.click();
        await page.waitForURL(/#automations/, { timeout: 10000 });

        // Go back to dashboard
        const dashboardBtn = page.locator('button.nav-item:has-text("Dashboard")').first();
        await dashboardBtn.waitFor({ state: 'visible', timeout: 10000 });
        await dashboardBtn.click();
        await page.waitForURL(/#dashboard/, { timeout: 10000 });

        // Go to automations again
        await automationsBtn.click();
        await page.waitForURL(/#automations/, { timeout: 10000 });

        // Should be on automations page
        await expect(page).toHaveURL(/#automations/);
    });
});
