import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle } from '../helpers/wait-utils.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const SETTINGS_DROPDOWN_CASES = [
    { menuLabel: 'Integrations', route: 'integrations', activeTab: 'Integrations' },
    { menuLabel: 'Account', route: 'account', activeTab: 'Account' },
    { menuLabel: 'Subscription', route: 'plans-billing', activeTab: 'Subscription' },
    { menuLabel: 'Affiliate Program', route: 'affiliate', activeTab: 'Affiliate Program' },
    { menuLabel: 'Notifications', route: 'notifications', activeTab: 'Notifications' },
    { menuLabel: 'Data', route: 'data', activeTab: 'Data' },
];

async function waitForSettingsTab(page, route) {
    await page.waitForFunction(({ expectedHash, expectedTab }) => {
        return window.location.hash === expectedHash && window.store?.state?.settingsTab === expectedTab;
    }, { expectedHash: `#settings/${route}`, expectedTab: route }, { timeout: 15000 });
}

for (const tabCase of SETTINGS_DROPDOWN_CASES) {
    test(`settings sidebar dropdown opens ${tabCase.menuLabel} immediately`, async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#dashboard`);
        await waitForSpaRender(page);
        await waitForUiSettle(page);
        const settingsDropdown = page.locator('.sidebar-dropdown').filter({ has: page.locator('[data-testid="nav-settings"]') });
        await page.locator('[data-testid="nav-settings"]').click();
        await expect(settingsDropdown.locator('.sidebar-dropdown-menu')).toBeVisible({ timeout: 10000 });
        await settingsDropdown.locator('.sidebar-dropdown-item-btn', { hasText: tabCase.menuLabel }).click();
        await waitForSettingsTab(page, tabCase.route);
        await page.waitForSelector('.settings-tabs', { timeout: 10000 });
        await waitForSpaRender(page);
        await waitForUiSettle(page);
        await expect(page.locator('.settings-tab.active', { hasText: tabCase.activeTab })).toBeVisible({ timeout: 10000 });
    });
}

test('settings search uses canonical tab ids for account and billing results', async ({ authedPage: page }) => {
    await page.goto(`${BASE_URL}/#settings`);
    await page.waitForURL(/#settings$/, { timeout: 15000 });
    await page.waitForSelector('.settings-tabs', { timeout: 10000 });
    await waitForSpaRender(page);

    const searchInput = page.locator('#settings-search-input');
    const results = page.locator('#settings-search-results');

    await searchInput.fill('profile');
    await expect(results).toBeVisible({ timeout: 5000 });
    await page.locator('.settings-search-result', { hasText: 'Personal Information' }).click();
    await waitForSettingsTab(page, 'account');
    await waitForSpaRender(page);
    await waitForUiSettle(page);
    await expect(page.locator('.settings-tab.active', { hasText: 'Account' })).toBeVisible({ timeout: 10000 });

    await searchInput.fill('billing');
    await expect(results).toBeVisible({ timeout: 5000 });
    await page.locator('.settings-search-result', { hasText: 'Billing & Plans' }).click();
    await waitForSettingsTab(page, 'plans-billing');
    await waitForSpaRender(page);
    await waitForUiSettle(page);
    await expect(page.locator('.settings-tab.active', { hasText: 'Subscription' })).toBeVisible({ timeout: 10000 });
});
