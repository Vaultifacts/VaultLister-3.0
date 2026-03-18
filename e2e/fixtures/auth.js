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
        // Set vl_access cookie so all navigations bypass the landing page and reach the SPA
        const url = new URL(BASE);
        await page.context().addCookies([{
            name: 'vl_access',
            value: authData.token,
            domain: url.hostname,
            path: '/',
        }]);

        // Navigate to SPA
        await page.goto(`${BASE}/#login`);
        await page.waitForLoadState('domcontentloaded');

        // Inject auth tokens into localStorage
        await injectAuth(page, authData);

        // Navigate to dashboard — SPA will pick up tokens from localStorage
        await page.goto(`${BASE}/#dashboard`);
        await page.waitForLoadState('domcontentloaded');

        // Directly set the store state if hydration missed tokens
        await page.evaluate((ad) => {
            if (typeof store !== 'undefined' && store.setState) {
                store.setState({
                    user: ad.user,
                    token: ad.token,
                    refreshToken: ad.refreshToken
                });
            }
        }, authData);

        // Wait for SPA content to render
        await page.waitForFunction(
            () => {
                const app = document.querySelector('#app');
                return app && app.innerHTML.length > 200;
            },
            { timeout: 15000 }
        ).catch(() => {});

        await use(page);
    }
});

export { expect, apiLogin, injectAuth };
export { DEMO_EMAIL, DEMO_PASSWORD, BASE };
