// Integrations Page E2E Tests
// Tests the integrations tab within the settings page.
// Covers UI rendering of connected services, marketplace platforms,
// additional integrations, and button interactions.
// API-level Drive routes are covered in integrations.spec.js.
import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForUiSettle, loginAndNavigate } from '../helpers/wait-utils.js';

const BASE = `http://localhost:${process.env.PORT || 3000}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function goToIntegrationsTab(page) {
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

    // Click the Integrations tab
    await page.locator('.settings-tab', { hasText: 'Integrations' }).click();
    await waitForUiSettle(page);
}

// ── Integrations tab rendering ────────────────────────────────────────────────

test.describe('Integrations tab — rendering', () => {
    test('should render integrations section when navigating to settings integrations tab', async ({ page }) => {
        await goToIntegrationsTab(page);

        // The integrations grid should be visible after clicking the tab
        await expect(page.locator('.integrations-grid').first()).toBeVisible({ timeout: 10_000 });
    });

    test('should show Connected Platforms section heading', async ({ page }) => {
        await goToIntegrationsTab(page);

        const heading = page.locator('.settings-section-title', { hasText: 'Connected Platforms' });
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });

    test('should show marketplace platform integration cards', async ({ page }) => {
        await goToIntegrationsTab(page);

        // At least one integration card should render (eBay, Mercari, Poshmark, etc.)
        const cards = page.locator('.integration-card');
        await expect(cards.first()).toBeVisible({ timeout: 10_000 });
        const count = await cards.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('should show Additional Integrations section heading', async ({ page }) => {
        await goToIntegrationsTab(page);

        const heading = page.locator('.settings-section-title', { hasText: 'Additional Integrations' });
        await expect(heading).toBeVisible({ timeout: 10_000 });
    });
});

// ── Google Calendar ────────────────────────────────────────────────────────────

test.describe('Integrations tab — Google Calendar', () => {
    test('should show Google Calendar integration card', async ({ page }) => {
        await goToIntegrationsTab(page);

        const calendarCard = page.locator('.integration-card').filter({ hasText: 'Google Calendar' });
        await expect(calendarCard).toBeVisible({ timeout: 10_000 });
    });

    test('should show Google Calendar connect button', async ({ page }) => {
        await goToIntegrationsTab(page);

        const connectBtn = page.locator('button[aria-label="Connect Google Calendar"]');
        await expect(connectBtn).toBeVisible({ timeout: 10_000 });
        await expect(connectBtn).toHaveText(/connect/i);
    });

    test('should handle clicking Connect Google Calendar without throwing a page-level error', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await goToIntegrationsTab(page);

        const connectBtn = page.locator('button[aria-label="Connect Google Calendar"]');
        await expect(connectBtn).toBeVisible({ timeout: 10_000 });

        // Click triggers an OAuth popup attempt — verify it does not crash the SPA
        await connectBtn.click().catch(() => {});
        await waitForUiSettle(page);

        // Page must still render the integrations grid after the click
        await expect(page.locator('.integrations-grid').first()).toBeVisible({ timeout: 5_000 });
        expect(pageErrors).toHaveLength(0);
    });
});

// ── Google Drive ──────────────────────────────────────────────────────────────

test.describe('Integrations tab — Google Drive', () => {
    test('should show Google Drive integration card', async ({ page }) => {
        await goToIntegrationsTab(page);

        const driveCard = page.locator('.integration-card').filter({ hasText: 'Google Drive' });
        await expect(driveCard).toBeVisible({ timeout: 10_000 });
    });

    test('should show Google Drive connect button', async ({ page }) => {
        await goToIntegrationsTab(page);

        const connectBtn = page.locator('button[aria-label="Connect Google Drive"]');
        await expect(connectBtn).toBeVisible({ timeout: 10_000 });
        await expect(connectBtn).toHaveText(/connect/i);
    });

    test('should handle clicking Connect Google Drive without throwing a page-level error', async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await goToIntegrationsTab(page);

        const connectBtn = page.locator('button[aria-label="Connect Google Drive"]');
        await expect(connectBtn).toBeVisible({ timeout: 10_000 });

        // Click triggers an OAuth popup attempt — verify the SPA remains stable
        await connectBtn.click().catch(() => {});
        await waitForUiSettle(page);

        await expect(page.locator('.integrations-grid').first()).toBeVisible({ timeout: 5_000 });
        expect(pageErrors).toHaveLength(0);
    });
});

// ── Webhooks ──────────────────────────────────────────────────────────────────

test.describe('Integrations tab — Webhooks', () => {
    test('should show Webhooks integration card with Manage button', async ({ page }) => {
        await goToIntegrationsTab(page);

        const webhooksCard = page.locator('.integration-card').filter({ hasText: 'Webhooks' });
        await expect(webhooksCard).toBeVisible({ timeout: 10_000 });

        const manageBtn = webhooksCard.locator('button', { hasText: /manage/i });
        await expect(manageBtn).toBeVisible();
    });

    test('should navigate to webhooks route when Manage button is clicked', async ({ page }) => {
        await goToIntegrationsTab(page);

        const webhooksCard = page.locator('.integration-card').filter({ hasText: 'Webhooks' });
        await expect(webhooksCard).toBeVisible({ timeout: 10_000 });

        const manageBtn = webhooksCard.locator('button', { hasText: /manage/i });
        await manageBtn.click();
        await waitForSpaRender(page);

        // After navigation the hash should reference the webhooks route
        const hash = await page.evaluate(() => window.location.hash);
        expect(hash).toMatch(/webhooks/i);
    });
});

// ── Affiliate Program ─────────────────────────────────────────────────────────

test.describe('Integrations tab — Affiliate Program', () => {
    test('should show Affiliate Program integration card', async ({ page }) => {
        await goToIntegrationsTab(page);

        const affiliateCard = page.locator('.integration-card').filter({ hasText: 'Affiliate Program' });
        await expect(affiliateCard).toBeVisible({ timeout: 10_000 });
    });

    test('should show Affiliate Program Open button', async ({ page }) => {
        await goToIntegrationsTab(page);

        const affiliateCard = page.locator('.integration-card').filter({ hasText: 'Affiliate Program' });
        await expect(affiliateCard).toBeVisible({ timeout: 10_000 });

        const openBtn = affiliateCard.locator('button', { hasText: /open/i });
        await expect(openBtn).toBeVisible();
    });
});

// ── API Access ────────────────────────────────────────────────────────────────

test.describe('Integrations tab — API Access', () => {
    test('should show API Access section with masked API key', async ({ page }) => {
        await goToIntegrationsTab(page);

        const apiSection = page.locator('.settings-section').filter({ hasText: 'API Access' });
        await expect(apiSection).toBeVisible({ timeout: 10_000 });

        const maskedKey = apiSection.locator('.api-key-display');
        await expect(maskedKey).toBeVisible();

        const keyText = await maskedKey.textContent();
        // Key must be masked — must not expose a real token value
        expect(keyText).toMatch(/•/);
    });

    test('should show Regenerate and Copy buttons in API Access section', async ({ page }) => {
        await goToIntegrationsTab(page);

        const apiSection = page.locator('.settings-section').filter({ hasText: 'API Access' });
        await expect(apiSection).toBeVisible({ timeout: 10_000 });

        await expect(apiSection.locator('button', { hasText: /regenerate/i })).toBeVisible();
        await expect(apiSection.locator('button', { hasText: /copy/i })).toBeVisible();
    });
});
