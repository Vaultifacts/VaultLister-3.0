import { test, expect } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const CURRENT_APP_ICON = '/assets/logo/icon/icon-64.png';

test.describe('Refresh Logo Regression', () => {
    test('boot splash uses the current app icon after an authenticated reload', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#dashboard`);
        await page.reload({ waitUntil: 'domcontentloaded' });

        const splashImage = page.locator(`#loading-screen .loading-logo img[src="${CURRENT_APP_ICON}"]`).first();
        await expect(splashImage).toHaveAttribute('alt', 'VaultLister logo');
        await expect(page.locator('#loading-screen .loading-logo img')).toHaveCount(1);
    });

    test('index shell markup and recovery fallback both point at the shipped app icon', async ({ authedPage: page }) => {
        const response = await page.request.get(`${BASE_URL}/`);
        expect(response.status()).toBe(200);

        const html = await response.text();
        const iconMatches = html.match(/\/assets\/logo\/icon\/icon-64\.png/g) || [];

        expect(iconMatches).toHaveLength(2);
        expect(html).toContain('alt="VaultLister logo"');
        expect(html).not.toContain('<div class="loading-logo">V</div>');
    });
});
