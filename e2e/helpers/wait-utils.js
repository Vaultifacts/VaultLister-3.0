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
export async function waitForTableRows(page, selector = '.table tbody tr', timeout = 15_000) {
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
  const BASE = baseUrl || `http://localhost:${process.env.PORT || 3001}`;
  const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

  await page.goto(`${BASE}/#login`);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/#login`);
  await page.waitForSelector('#login-form', { timeout: 10_000 });
  await waitForSpaRender(page);

  await page.locator('#login-email').fill(DEMO.email);
  await page.locator('#login-password').fill(DEMO.password);
  await page.locator('#login-submit-btn').click();

  try {
    await page.waitForFunction(
      () => !window.location.hash.includes('#login'),
      { timeout: 20_000 }
    );
  } catch {
    await page.evaluate(async () => {
      try {
        const res = await fetch('/auth/demo-login', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const data = await res.json();
        if (data.token) {
          store.setState({ user: data.user, token: data.token, refreshToken: data.refreshToken });
          router.navigate('dashboard');
        }
      } catch (e) { /* ignore */ }
    });
    await waitForSpaRender(page, 10_000);
  }
  await waitForSpaRender(page);

  if (route !== 'dashboard') {
    await page.evaluate((r) => router.navigate(r), route);
    await waitForSpaRender(page);
    // Wait for route-specific content
    if (['inventory', 'sales', 'orders'].includes(route)) {
      await waitForTableRows(page);
    } else {
      await waitForUiSettle(page);
    }
  }
}
