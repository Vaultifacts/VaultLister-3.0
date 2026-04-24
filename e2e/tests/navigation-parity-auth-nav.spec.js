import { test, expect } from '../fixtures/auth.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

async function openSidebarDropdown(page, title) {
    const button = page.locator(`button[title="${title}"]`).first();
    await expect(button).toBeVisible({ timeout: 10000 });
    await button.click();
    return button;
}

test.describe('Navigation Parity And Auth Nav', () => {
    test('sidebar changelog link opens the public changelog page', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#dashboard`);
        await openSidebarDropdown(page, 'Status & Updates');

        const changelogLink = page.locator('.sidebar-dropdown-menu a[href="/changelog.html"]').first();
        await expect(changelogLink).toBeVisible();
        await changelogLink.evaluate((node) => node.removeAttribute('target'));
        await changelogLink.click();

        await expect(page).toHaveURL(/\/changelog\.html$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();
        await expect(page.locator('#changelog-search')).toBeVisible();
    });

    test('sidebar roadmap link opens the public roadmap page', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#dashboard`);
        await openSidebarDropdown(page, 'Status & Updates');

        const roadmapLink = page.locator('.sidebar-dropdown-menu a[href="/roadmap-public.html"]').first();
        await expect(roadmapLink).toBeVisible();
        await roadmapLink.evaluate((node) => node.removeAttribute('target'));
        await roadmapLink.click();

        await expect(page).toHaveURL(/\/roadmap-public\.html$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Product Roadmap' })).toBeVisible();
        await expect(page.locator('.roadmap-kanban')).toBeVisible();
    });

    test('signed-in public pages show the account menu instead of auth CTA buttons', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/landing.html`);

        const trigger = page.locator('.nav-actions .public-profile-trigger').first();
        await expect(trigger).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.nav-actions a[href="/?app=1#login"]')).toHaveCount(0);
        await expect(page.locator('.nav-actions a[href="/?app=1#register"]')).toHaveCount(0);

        await trigger.click();
        await page.waitForTimeout(150);

        const menuState = await page.evaluate(() => ({
            expanded: document.querySelector('.nav-actions .public-profile-trigger')?.getAttribute('aria-expanded') || null,
            openMenus: document.querySelectorAll('.nav-actions .public-auth-menu.open').length,
            menuItems: Array.from(document.querySelectorAll('.nav-actions .public-auth-menu .public-auth-item, .nav-actions .public-auth-menu .public-auth-item-btn'))
                .map((node) => node.textContent?.trim())
                .filter(Boolean)
        }));

        expect(menuState.expanded).toBe('true');
        expect(menuState.openMenus).toBe(1);
        expect(menuState.menuItems).toContain('Return to Dashboard');
        expect(menuState.menuItems).toContain('Logout');
    });

    test('sidebar account menu opens and returns the user to the dashboard', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#listings`);
        await expect(page.getByRole('heading', { level: 1, name: /My Listings|Listings/ })).toBeVisible({ timeout: 10000 });

        const trigger = page.getByRole('button', { name: 'Open account menu' }).first();
        await trigger.click();

        const returnToDashboard = page.getByRole('button', { name: 'Return to Dashboard' }).first();
        await expect(returnToDashboard).toBeVisible();
        await expect(page.getByRole('button', { name: 'Logout' }).first()).toBeVisible();

        await returnToDashboard.click();
        await page.waitForURL(/#dashboard$/, { timeout: 10000 });
        await expect(page.getByRole('heading', { level: 1, name: /Good (morning|afternoon|evening), Demo!/ })).toBeVisible();
    });

    test('router changelog and roadmap routes stay aligned with the public pages', async ({ authedPage: page }) => {
        await page.goto(`${BASE_URL}/#dashboard`);

        await page.evaluate(() => router.navigate('changelog'));
        await expect(page).toHaveURL(/\/changelog\.html$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Changelog' })).toBeVisible();

        await page.goto(`${BASE_URL}/#dashboard`);
        await page.evaluate(() => router.navigate('roadmap'));
        await expect(page).toHaveURL(/\/roadmap-public\.html$/);
        await expect(page.getByRole('heading', { level: 1, name: 'Product Roadmap' })).toBeVisible();
    });
});
