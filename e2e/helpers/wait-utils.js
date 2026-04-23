// =============================================================================
// Shared Playwright wait utilities — replaces blind waitForTimeout calls
// =============================================================================

/**
 * Wait for the SPA to render meaningful content
 */
export async function waitForSpaRender(page, timeout = 10_000) {
  await page.waitForFunction(
    () => document.querySelector('#app')?.innerHTML.length > 100,
    { timeout }
  );
}

/**
 * Wait for a table to have at least one row
 */
export async function waitForTableRows(page, selector = '.table tbody tr', timeout = 5_000) {
  await page.waitForFunction(
    (sel) => document.querySelectorAll(sel).length > 0,
    selector,
    { timeout }
  ).catch(() => {
    // Table might be empty — that's ok for some tests
  });
}

/**
 * Wait for a UI action to settle (button click, dropdown open, etc.)
 * Uses requestAnimationFrame + microtask to wait for DOM updates
 */
export async function waitForUiSettle(page, timeout = 5_000) {
  await page.waitForFunction(
    () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50, true))),
    { timeout }
  );
}

/**
 * Wait for an element to appear after an action
 */
export async function waitForElement(page, selector, timeout = 5_000) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

/**
 * Wait for an element to disappear (e.g., after closing a modal)
 */
export async function waitForElementGone(page, selector, timeout = 5_000) {
  await page.locator(selector).first().waitFor({ state: 'hidden', timeout }).catch(() => {});
}

/**
 * Login and navigate to a route, waiting for content to load
 */
export async function loginAndNavigate(page, route = 'dashboard', { baseUrl = null } = {}) {
  const resolvedPort = process.env.TEST_PORT || process.env.PORT || '3100';
  const BASE = baseUrl || process.env.TEST_BASE_URL || `http://localhost:${resolvedPort}`;
  const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

  // Set vl_access cookie to bypass landing page and reach the SPA
  const url = new URL(BASE);
  await page.context().addCookies([{
    name: 'vl_access',
    value: 'e2e-test-bypass',
    domain: url.hostname,
    path: '/',
  }]);

  // Login via API (fast, avoids flaky form interactions)
  const loginResp = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: DEMO.email, password: DEMO.password }
  });
  if (loginResp.ok()) {
    const loginData = await loginResp.json();
    // Navigate to SPA and inject auth tokens
    await page.goto(`${BASE}/#login`);
    await page.evaluate((data) => {
      // Tokens must go to sessionStorage — hydrate() ignores tokens from localStorage
      sessionStorage.setItem('vaultlister_state', JSON.stringify({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        useSessionStorage: true
      }));
    }, loginData);
    await page.goto(`${BASE}/#dashboard`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate((data) => {
      if (typeof store !== 'undefined' && store.setState) {
        store.setState({ user: data.user, token: data.token, refreshToken: data.refreshToken });
      }
    }, loginData);
    await waitForSpaRender(page);
  } else {
    // Fallback: form login
    await page.goto(`${BASE}/#login`);
    await page.waitForSelector('#login-form', { timeout: 10_000 });
    await waitForSpaRender(page);
    await page.locator('#login-email').fill(DEMO.email);
    await page.locator('#login-password').fill(DEMO.password);
    await page.locator('#login-submit-btn').click();
    try {
      await page.waitForFunction(() => !window.location.hash.includes('#login'), { timeout: 20_000 });
    } catch { /* ignore */ }
    await waitForSpaRender(page);
  }

  if (route !== 'dashboard') {
    await page.waitForFunction(() => typeof window.router !== 'undefined' && typeof window.router.navigate === 'function', { timeout: 10_000 });
    await page.evaluate((r) => window.router.navigate(r), route);
    await waitForSpaRender(page);
    // Wait for route-specific content
    if (['inventory', 'sales', 'orders'].includes(route)) {
      await waitForTableRows(page);
    } else {
      await waitForUiSettle(page);
    }
  }
}
