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
        // Navigate to the app first (needed for localStorage access on the right origin)
        await page.goto(BASE);
        await page.waitForLoadState('domcontentloaded');

        // Inject auth tokens
        await injectAuth(page, authData);

        // Reload so the SPA picks up localStorage auth
        await page.reload();
        await page.waitForLoadState('domcontentloaded');

        // Directly set the store state and re-render if hydration missed tokens
        await page.evaluate((authData) => {
            if (typeof store !== 'undefined' && store.setState) {
                store.setState({
                    user: authData.user,
                    token: authData.token,
                    refreshToken: authData.refreshToken
                });
            }
            if (typeof router !== 'undefined' && router.navigate) {
                router.navigate('dashboard');
            }
        }, authData);

        // Wait for dashboard content to appear
        await page.waitForFunction(
            () => {
                const app = document.querySelector('#app');
                return app && app.innerHTML.length > 200;
            },
            { timeout: 15000 }
        ).catch(() => {
            // SPA may still be loading
        });

        await use(page);
    }
});

export { expect, apiLogin, injectAuth };
export { DEMO_EMAIL, DEMO_PASSWORD, BASE };
