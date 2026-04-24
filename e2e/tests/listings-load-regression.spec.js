import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

test('listings page loads without bootstrap error toasts', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/#dashboard`);
    await page.waitForFunction(() => typeof toast !== 'undefined' && typeof toast.error === 'function', { timeout: 15000 });
    await page.evaluate(() => {
        window.__toastErrors = [];
        if (window.__toastErrorCaptureInstalled) return;
        const originalToastError = toast.error.bind(toast);
        toast.error = function(message, ...rest) {
            window.__toastErrors.push(String(message));
            return originalToastError(message, ...rest);
        };
        window.__toastErrorCaptureInstalled = true;
    });

    await page.goto(`${BASE_URL}/#listings`);
    await page.waitForURL(/#listings$/, { timeout: 15000 });
    await expect(page.getByRole('heading', { level: 1, name: /My Listings|Listings|Cross-Lister/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Page Error' })).toHaveCount(0);
    await waitForSpaRender(page);
    await waitForUiSettle(page);
    await page.waitForTimeout(1500);

    const toastErrors = await page.evaluate(() => window.__toastErrors || []);
    const listingsErrors = toastErrors.filter((message) =>
        /Failed to load listings|Failed to load listing folders/i.test(message)
    );

    expect(listingsErrors).toEqual([]);
});
