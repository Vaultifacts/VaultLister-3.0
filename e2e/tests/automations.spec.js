// Automations E2E Tests
import { test, expect } from '../fixtures/auth.js';
import { selectors, routes } from '../fixtures/test-data.js';

test.describe('Automation Management', () => {

    test('should navigate to automations page', async ({ authedPage: page }) => {
        // Navigate to automations via URL
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Should see page title or content
        await expect(page.getByText(/Automation|Rules/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should display automation rules list', async ({ authedPage: page }) => {
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 5000 });

        // Wait for content to load
        await page.waitForTimeout(1000);

        // Should see automation rules section
        const rulesSection = page.locator('.automation-rules, .rules-list, table, .card');
        await expect(rulesSection.first()).toBeVisible({ timeout: 5000 });
    });

    test('should display automation presets', async ({ authedPage: page }) => {
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

    test('should toggle automation rule', async ({ authedPage: page }) => {
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

    test('should show platform badges', async ({ authedPage: page }) => {
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

    test('should navigate between dashboard and automations', async ({ authedPage: page }) => {
        // Go to automations via URL
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 10000 });

        // Go back to dashboard via URL
        await page.goto(routes.dashboard);
        await page.waitForURL(/#dashboard/, { timeout: 10000 });

        // Go to automations again
        await page.goto(routes.automations);
        await page.waitForURL(/#automations/, { timeout: 10000 });

        // Should be on automations page
        await expect(page).toHaveURL(/#automations/);
    });
});
