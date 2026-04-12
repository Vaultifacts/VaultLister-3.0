import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

test('smoke settings: settings page loads without page-level errors', async ({ authedPage: page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`${BASE_URL}/#settings`);
    await page.waitForURL(/#settings/, { timeout: 15000 });
    await page.waitForSelector('.settings-tabs', { timeout: 10000 });
    await waitForSpaRender(page);
    await waitForUiSettle(page);

    await expect(page.locator('h1.page-title', { hasText: 'Settings' })).toBeVisible({ timeout: 10000 });
    expect(pageErrors).toHaveLength(0);
});
