// Settings Page E2E Tests
// Tests the settings page UI: page render, tab navigation, profile form,
// notification toggles, appearance/theme section, tools tab API usage info,
// and connected accounts in the integrations tab.
// API-level settings endpoints are covered in settings-api.spec.js.
import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForUiSettle, loginAndNavigate } from '../helpers/wait-utils.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function goToSettings(page) {
    await loginAndNavigate(page, 'settings', { baseUrl: BASE });
    await page.waitForSelector('.settings-tabs', { timeout: 10_000 });
    await waitForSpaRender(page);

    // Dismiss overlays that intercept pointer events
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

async function switchToTab(page, tabName) {
    await page.locator('.settings-tab', { hasText: tabName }).click();
    await waitForUiSettle(page);
}

// ── Page-level rendering ──────────────────────────────────────────────────────

test.describe('Settings page — page-level rendering', () => {
    test('should render settings page with Settings page title', async ({ page }) => {
        await goToSettings(page);

        await expect(page.locator('h1.page-title', { hasText: 'Settings' })).toBeVisible({ timeout: 10_000 });
    });

    test('should render settings tabs navigation', async ({ page }) => {
        await goToSettings(page);

        const tabs = page.locator('.settings-tabs');
        await expect(tabs).toBeVisible({ timeout: 10_000 });
    });

    test('should render profile tab as the default active tab', async ({ page }) => {
        await goToSettings(page);

        const profileTab = page.locator('.settings-tab.active', { hasText: 'Profile' });
        await expect(profileTab).toBeVisible({ timeout: 10_000 });
    });

    test('should show profile content by default without clicking any tab', async ({ page }) => {
        await goToSettings(page);

        // Profile header is the landmark element rendered for the profile tab
        const profileHeader = page.locator('.settings-profile-header');
        await expect(profileHeader).toBeVisible({ timeout: 10_000 });
    });

    test('should load without page-level JS errors', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await goToSettings(page);
        await waitForUiSettle(page);

        if (pageErrors.length > 0) {
            console.warn(`Settings page JS errors: ${pageErrors.join(' | ')}`);
        }
        expect(pageErrors).toHaveLength(0);
    });
});

// ── Tab navigation ────────────────────────────────────────────────────────────

test.describe('Settings page — tab navigation', () => {
    test('should show all expected tabs in the tab bar', async ({ page }) => {
        await goToSettings(page);

        const tabLabels = ['Profile', 'Appearance', 'Notifications', 'Integrations', 'Tools'];
        for (const label of tabLabels) {
            await expect(page.locator('.settings-tab', { hasText: label })).toBeVisible({ timeout: 10_000 });
        }
    });

    test('should switch to notifications tab when Notifications tab is clicked', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Notifications');

        const activeTab = page.locator('.settings-tab.active', { hasText: 'Notifications' });
        await expect(activeTab).toBeVisible({ timeout: 10_000 });
    });

    test('should switch to integrations tab when Integrations tab is clicked', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Integrations');

        const activeTab = page.locator('.settings-tab.active', { hasText: 'Integrations' });
        await expect(activeTab).toBeVisible({ timeout: 10_000 });
    });

    test('should switch to tools tab when Tools tab is clicked', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Tools');

        const activeTab = page.locator('.settings-tab.active', { hasText: 'Tools' });
        await expect(activeTab).toBeVisible({ timeout: 10_000 });
    });

    test('should switch to appearance tab when Appearance tab is clicked', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Appearance');

        const activeTab = page.locator('.settings-tab.active', { hasText: 'Appearance' });
        await expect(activeTab).toBeVisible({ timeout: 10_000 });
    });
});

// ── Profile tab ───────────────────────────────────────────────────────────────

test.describe('Settings page — profile tab', () => {
    test('should show profile header with user avatar circle', async ({ page }) => {
        await goToSettings(page);

        await expect(page.locator('.settings-avatar-circle')).toBeVisible({ timeout: 10_000 });
    });

    test('should show Full Name input field in profile section', async ({ page }) => {
        await goToSettings(page);

        const fullNameInput = page.locator('#settings-full-name');
        await expect(fullNameInput).toBeVisible({ timeout: 10_000 });
        await expect(fullNameInput).toHaveAttribute('type', 'text');
    });

    test('should show email field that is read-only in profile section', async ({ page }) => {
        await goToSettings(page);

        const emailInput = page.locator('input[type="email"]').first();
        await expect(emailInput).toBeVisible({ timeout: 10_000 });
        // Email is disabled — cannot be changed without contacting support
        await expect(emailInput).toBeDisabled();
    });

    test('should show Display Name input field in profile section', async ({ page }) => {
        await goToSettings(page);

        const displayNameInput = page.locator('#settings-display-name');
        await expect(displayNameInput).toBeVisible({ timeout: 10_000 });
        await expect(displayNameInput).toHaveAttribute('type', 'text');
    });

    test('should show Personal Information section heading', async ({ page }) => {
        await goToSettings(page);

        const heading = page.locator('.settings-section-title', { hasText: 'Personal Information' });
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });
});

// ── Notifications tab ─────────────────────────────────────────────────────────

test.describe('Settings page — notifications tab', () => {
    test('should show notification preference toggles when on notifications tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Notifications');

        // Email notifications toggle
        const emailToggle = page.locator('#settings-email-notifications');
        await expect(emailToggle).toBeVisible({ timeout: 10_000 });
        await expect(emailToggle).toHaveAttribute('type', 'checkbox');
    });

    test('should show push notifications toggle on notifications tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Notifications');

        const pushToggle = page.locator('#settings-push-notifications');
        await expect(pushToggle).toBeVisible({ timeout: 10_000 });
        await expect(pushToggle).toHaveAttribute('type', 'checkbox');
    });

    test('should show SMS notifications toggle on notifications tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Notifications');

        const smsToggle = page.locator('#settings-sms-notifications');
        await expect(smsToggle).toBeVisible({ timeout: 10_000 });
        await expect(smsToggle).toHaveAttribute('type', 'checkbox');
    });

    test('should render notification category sections on notifications tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Notifications');

        const categories = page.locator('.notification-category');
        const count = await categories.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

// ── Appearance tab ────────────────────────────────────────────────────────────

test.describe('Settings page — appearance tab', () => {
    test('should show Theme section heading on appearance tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Appearance');

        const themeHeading = page.locator('#theme-section-heading');
        await expect(themeHeading).toBeVisible({ timeout: 10_000 });
        await expect(themeHeading).toContainText('Theme');
    });

    test('should show theme radio options on appearance tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Appearance');

        const themeOptions = page.locator('.theme-option');
        const count = await themeOptions.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should show light and dark theme options', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Appearance');

        const lightOption = page.locator('input[name="theme-mode"][value="light"]');
        const darkOption = page.locator('input[name="theme-mode"][value="dark"]');
        await expect(lightOption).toBeAttached({ timeout: 10_000 });
        await expect(darkOption).toBeAttached({ timeout: 10_000 });
    });

    test('should show theme options container with radiogroup role', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Appearance');

        const themeGroup = page.locator('.theme-options[role="radiogroup"]');
        await expect(themeGroup).toBeVisible({ timeout: 10_000 });
    });
});

// ── Tools tab ─────────────────────────────────────────────────────────────────

test.describe('Settings page — tools tab', () => {
    test('should show API Usage section heading on tools tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Tools');

        const apiUsageHeading = page.locator('.settings-section-title', { hasText: 'API Usage' });
        await expect(apiUsageHeading).toBeVisible({ timeout: 10_000 });
    });

    test('should show API usage info card with Limit, Remaining, and Resets in labels', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Tools');

        // The API usage card uses a <dl> with dt/dd pairs
        const usageCard = page.locator('.settings-section').filter({ hasText: 'API Usage' }).locator('.card').first();
        await expect(usageCard).toBeVisible({ timeout: 10_000 });

        const cardText = await usageCard.textContent();
        expect(cardText).toMatch(/limit/i);
        expect(cardText).toMatch(/remaining/i);
        expect(cardText).toMatch(/resets in/i);
    });

    test('should show Tools & Configuration section on tools tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Tools');

        const toolsHeading = page.locator('.settings-section-title', { hasText: 'Tools' });
        await expect(toolsHeading).toBeVisible({ timeout: 10_000 });
    });

    test('should show tools grid with tool cards on tools tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Tools');

        const toolCards = page.locator('.tool-card');
        const count = await toolCards.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

// ── Integrations tab (connected accounts) ────────────────────────────────────

test.describe('Settings page — connected accounts section', () => {
    test('should show Connected Platforms section in integrations tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Integrations');

        const heading = page.locator('.settings-section-title', { hasText: 'Connected Platforms' });
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test('should show marketplace platform cards in integrations tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Integrations');

        const cards = page.locator('.integration-card');
        await expect(cards.first()).toBeVisible({ timeout: 10_000 });
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test('should show Check Status button in integrations tab', async ({ page }) => {
        await goToSettings(page);
        await switchToTab(page, 'Integrations');

        const checkStatusBtn = page.locator('button', { hasText: /check status/i });
        await expect(checkStatusBtn).toBeVisible({ timeout: 10_000 });
    });
});
