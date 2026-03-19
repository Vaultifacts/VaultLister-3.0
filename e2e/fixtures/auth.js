// Shared authentication fixture for E2E tests
// Logs in via API (fast, no UI interaction) and injects tokens into browser context
import { test as base, expect } from '@playwright/test';

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_PASSWORD = 'DemoPassword123!';

/**
 * Login via API and return tokens + user data.
 * Much faster than UI login (~50ms vs ~3s) and eliminates flakiness.
 */
async function apiLogin(request, email = DEMO_EMAIL, password = DEMO_PASSWORD) {
    const resp = await request.post(`${BASE}/api/auth/login`, {
        data: { email, password }
    });
    if (!resp.ok()) {
        throw new Error(`API login failed: ${resp.status()} ${await resp.text()}`);
    }
    return resp.json();
}

/**
 * Inject auth state into the page via localStorage.
 * Matches the store.persist() format used by the SPA.
 */
async function injectAuth(page, loginData) {
    const state = JSON.stringify({
        user: loginData.user || { email: DEMO_EMAIL },
        token: loginData.token,
        refreshToken: loginData.refreshToken
    });
    await page.evaluate((s) => {
        localStorage.setItem('vaultlister_state', s);
    }, state);
}

/**
 * Extended Playwright test fixture that provides an authenticated page.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth.js';
 *
 *   test('my test', async ({ authedPage, authToken }) => {
 *       await authedPage.goto('http://localhost:3001/#inventory');
 *       // page is already logged in
 *   });
 */
export const test = base.extend({
    // Provides raw auth data (token, refreshToken, user)
    authData: async ({ request }, use) => {
        const data = await apiLogin(request);
        await use(data);
    },

    // Provides just the JWT token for API calls
    authToken: async ({ authData }, use) => {
        await use(authData.token);
    },

    // Provides a page that's already authenticated via localStorage injection
    authedPage: async ({ page, authData }, use) => {
        // Clear cookies from previous tests
        await page.context().clearCookies();
        // Set vl_access cookie so all navigations bypass the landing page and reach the SPA
        const url = new URL(BASE);
        await page.context().addCookies([{
            name: 'vl_access',
            value: authData.token,
            domain: url.hostname,
            path: '/',
        }]);

        // Navigate to SPA, clear stale storage, then inject fresh auth tokens
        await page.goto(`${BASE}/#login`);
        await page.waitForLoadState('domcontentloaded');
        await page.evaluate(() => {
            try { localStorage.clear(); sessionStorage.clear(); } catch {}
        });
        await injectAuth(page, authData);

        // Navigate to dashboard — SPA hydrates from localStorage on DOMContentLoaded
        await page.goto(`${BASE}/#dashboard`);
        await page.waitForLoadState('domcontentloaded');

        // Directly set the store state in case hydration missed tokens (race condition guard)
        await page.evaluate((ad) => {
            if (typeof store !== 'undefined' && store.setState) {
                store.setState({
                    user: ad.user,
                    token: ad.token,
                    refreshToken: ad.refreshToken
                });
            }
        }, authData);

        // If SPA redirected to login (auth check race), force navigation to dashboard
        const hashAfterInject = await page.evaluate(() => window.location.hash);
        if (hashAfterInject.includes('login') || !hashAfterInject.includes('dashboard')) {
            await page.evaluate((ad) => {
                if (typeof store !== 'undefined' && store.setState) {
                    store.setState({ user: ad.user, token: ad.token, refreshToken: ad.refreshToken });
                }
                if (typeof router !== 'undefined' && router.navigate) {
                    router.navigate('dashboard');
                }
            }, authData);
        }

        // Wait for authenticated SPA content (sidebar indicates authenticated dashboard)
        await page.waitForFunction(
            () => !!document.querySelector('.sidebar'),
            { timeout: 15000 }
        ).catch(() => {});

        // Dismiss overlays that intercept pointer events on sidebar/nav elements
        const dismissBtn = page.locator('button:has-text("Dismiss announcement")');
        if (await dismissBtn.isVisible().catch(() => false)) {
            await dismissBtn.click().catch(() => {});
            await page.waitForTimeout(300);
        }
        const acceptBtn = page.locator('#cookie-banner button:has-text("Accept"), #cookie-banner button:has-text("Decline")').first();
        if (await acceptBtn.isVisible().catch(() => false)) {
            await acceptBtn.click().catch(() => {});
            await page.waitForTimeout(200);
        }

        await use(page);
    }
});

export { expect, apiLogin, injectAuth };
export { DEMO_EMAIL, DEMO_PASSWORD, BASE };
