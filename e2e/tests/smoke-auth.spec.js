import { test, expect } from '@playwright/test';
import { demoUser, selectors, routes } from '../fixtures/test-data.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;

test('smoke auth: demo user can log in and reach the dashboard', async ({ page }) => {
    const url = new URL(BASE_URL);
    await page.context().addCookies([{
        name: 'vl_access',
        value: 'e2e-test-bypass',
        domain: url.hostname,
        path: '/',
    }]);

    await page.goto(routes.login);
    await expect(page.locator(selectors.loginForm)).toBeVisible({ timeout: 10000 });
    await page.fill(selectors.emailInput, demoUser.email);
    await page.fill(selectors.passwordInput, demoUser.password);

    const [response] = await Promise.all([
        page.waitForResponse((resp) => resp.url().includes('/api/auth/login') && resp.status() === 200),
        page.click(selectors.submitButton),
    ]);

    expect(response.ok()).toBe(true);
    await page.waitForURL(/#dashboard/, { timeout: 15000 });
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10000 });
});
