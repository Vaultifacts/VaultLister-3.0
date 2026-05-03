import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

test('smoke integrations: integrations tab renders and connect controls do not crash the SPA', async ({ authedPage: page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${BASE_URL}/#settings`);
    await page.waitForURL(/#settings/, { timeout: 15000 });
    await page.waitForSelector('.settings-tabs', { timeout: 10000 });
    await waitForSpaRender(page);

    await page.locator('.settings-tab', { hasText: 'Integrations' }).click();
    await waitForUiSettle(page);

    const grid = page.locator('.settings-marketplace-grid').first();
    await expect(grid).toBeVisible({ timeout: 10000 });

    const actionButton = page.locator('.settings-marketplace-card button').first();
    await expect(actionButton).toBeVisible({ timeout: 10000 });
    await actionButton.click().catch(() => {});
    await waitForUiSettle(page);

    await expect(grid).toBeVisible({ timeout: 5000 });
    expect(pageErrors).toHaveLength(0);
});
