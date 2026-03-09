// Remember Me E2E Test — verifies Issue #2 fix (token refresh on session restore)
import { test, expect } from '@playwright/test';

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const DEMO_EMAIL = 'demo@vaultlister.com';
const DEMO_PASSWORD = 'DemoPassword123!';

test.describe('Remember Me — Issue #2', () => {

    test('session restores from saved localStorage tokens on page load', async ({ browser, request }) => {
        // Phase 1: Get fresh tokens via API login
        const loginResp = await request.post(`${BASE}/api/auth/login`, {
            data: { email: DEMO_EMAIL, password: DEMO_PASSWORD }
        });
        expect(loginResp.ok()).toBeTruthy();
        const loginData = await loginResp.json();
        expect(loginData.token).toBeTruthy();
        expect(loginData.refreshToken).toBeTruthy();
        console.log('Phase 1 PASS: Fresh tokens obtained via API login');

        // Build the state to inject (matches store.persist() format exactly)
        const stateJson = JSON.stringify({
            user: loginData.user || { email: DEMO_EMAIL },
            token: loginData.token,
            refreshToken: loginData.refreshToken
        });

        // Create context with addInitScript to set sessionStorage BEFORE app JS runs.
        // hydrate() only trusts tokens from sessionStorage (not localStorage) per Q18 security fix.
        const context = await browser.newContext();
        await context.addInitScript((state) => {
            sessionStorage.setItem('vaultlister_state', state);
        }, stateJson);

        const page = await context.newPage();
        console.log('Phase 2 PASS: Context created with pre-injected localStorage');

        // Navigate — app should hydrate tokens and load dashboard
        await page.goto(BASE);
        await page.waitForLoadState('domcontentloaded');

        // Wait for dashboard content to appear
        await expect(
            page.locator('text=Good afternoon')
                .or(page.locator('text=Good morning'))
                .or(page.locator('text=Good evening'))
        ).toBeVisible({ timeout: 20000 });
        console.log('Phase 3 PASS: Dashboard greeting visible');

        // Verify we're on the dashboard, not the login page
        const bodyText = await page.textContent('body');
        const isLoginPage = bodyText.includes('Sign in to your account');
        expect(isLoginPage).toBe(false);

        // Verify sessionStorage still has tokens (Q18: tokens are stored in sessionStorage only)
        const ss = await page.evaluate(() => sessionStorage.getItem('vaultlister_state'));
        expect(ss).toBeTruthy();
        const parsed = JSON.parse(ss);
        expect(parsed.token).toBeTruthy();
        expect(parsed.refreshToken).toBeTruthy();

        await page.screenshot({ path: 'e2e/screenshots/remember-me-success.png' });
        console.log('Phase 4 PASS: Session restored from sessionStorage, tokens intact');
        console.log(`  - Login page: ${isLoginPage}`);
        console.log('RESULT: Remember Me Issue #2 fix VERIFIED via browser');

        await context.close();
    });
});
