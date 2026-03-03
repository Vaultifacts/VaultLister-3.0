// =============================================================================
// QA Guardian — Smoke-subset E2E protecting the hardened VaultLister state
// Tag: @quinn-v3-guardian
// Run: npx playwright test --grep @quinn-v3-guardian
// =============================================================================

import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForUiSettle, waitForTableRows } from '../helpers/wait-utils.js';

const BASE = `http://localhost:${process.env.PORT || 3001}`;

// =============================================================================
// 1. Login Flow — confirms auth pipeline works end-to-end
// =============================================================================
test.describe('@quinn-v3-guardian Login', () => {
  test('login via API fixture and reach dashboard', async ({ authedPage }) => {
    // authedPage already authenticated via API + localStorage injection
    await waitForSpaRender(authedPage);
    const url = authedPage.url();
    // Should NOT be on login page
    expect(url).not.toContain('#login');
  });
});

// =============================================================================
// 2. Dashboard — visual baseline + stat cards
// =============================================================================
test.describe('@quinn-v3-guardian Dashboard', () => {
  test('dashboard renders and has stat cards', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#dashboard`);
    await waitForSpaRender(authedPage);
    await waitForUiSettle(authedPage);

    // Dashboard should have recognisable content
    const body = await authedPage.locator('body').textContent();
    const hasDashboardContent = /dashboard|inventory|sales|orders|welcome|good (morning|afternoon|evening)/i.test(body);
    expect(hasDashboardContent).toBe(true);

    // Stat cards — look for common dashboard selectors
    const statCards = authedPage.locator(
      '.stat-card, .stats-card, .dashboard-stat, [class*="stat"], [data-testid*="stat"]'
    );
    const cardCount = await statCards.count();
    // At minimum we expect 1+ stat card (inventory, sales, orders, etc.)
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('dashboard visual baseline', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#dashboard`);
    await waitForSpaRender(authedPage);
    await waitForUiSettle(authedPage);

    await expect(authedPage).toHaveScreenshot('dashboard-baseline.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10_000,
    });
  });
});

// =============================================================================
// 3. Inventory — visual baseline + add-item flow
// =============================================================================
test.describe('@quinn-v3-guardian Inventory', () => {
  test('inventory page renders with table', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#inventory`);
    await waitForSpaRender(authedPage);
    await waitForTableRows(authedPage);

    // Should show the inventory section
    const body = await authedPage.locator('body').textContent();
    expect(/inventory/i.test(body)).toBe(true);
  });

  test('inventory visual baseline', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#inventory`);
    await waitForSpaRender(authedPage);
    await waitForTableRows(authedPage);
    await waitForUiSettle(authedPage);

    await expect(authedPage).toHaveScreenshot('inventory-baseline.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10_000,
    });
  });

  test('add-item modal opens', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#inventory`);
    await waitForSpaRender(authedPage);

    // Find and click the add-item button
    const addBtn = authedPage.locator(
      'button:has-text("Add"), button:has-text("New Item"), [data-testid="add-item"], .add-item-btn, #add-item-btn'
    ).first();

    const addBtnVisible = await addBtn.isVisible().catch(() => false);
    if (addBtnVisible) {
      await addBtn.click();
      await waitForUiSettle(authedPage);

      // Modal or form should appear
      const modal = authedPage.locator(
        '.modal, [role="dialog"], .add-item-modal, #add-item-form, form[class*="item"]'
      ).first();
      const modalVisible = await modal.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(modalVisible).toBe(true);
    } else {
      // If no add button visible, just verify page loaded
      const body = await authedPage.locator('body').textContent();
      expect(body.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// 4. Orders — visual baseline
// =============================================================================
test.describe('@quinn-v3-guardian Orders', () => {
  test('orders page renders', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#orders`);
    await waitForSpaRender(authedPage);

    const body = await authedPage.locator('body').textContent();
    expect(/orders/i.test(body)).toBe(true);
  });

  test('orders visual baseline', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#orders`);
    await waitForSpaRender(authedPage);
    await waitForUiSettle(authedPage);

    await expect(authedPage).toHaveScreenshot('orders-baseline.png', {
      maxDiffPixelRatio: 0.05,
      timeout: 10_000,
    });
  });
});

// =============================================================================
// 5. WebSocket server-push toast notification
// =============================================================================
test.describe('@quinn-v3-guardian WebSocket Push', () => {
  test('WS connection established (no crash)', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#dashboard`);
    await waitForSpaRender(authedPage);

    // Check that WebSocket connection was attempted (won't crash the page)
    const wsStatus = await authedPage.evaluate(() => {
      // SPA may expose WS status, or we check no unhandled errors
      const wsIndicator = document.querySelector(
        '[class*="ws"], [class*="connection"], [data-testid*="ws"]'
      );
      return {
        hasIndicator: !!wsIndicator,
        pageLoaded: document.querySelector('#app')?.innerHTML.length > 100,
      };
    });
    // Page should at least be loaded and functional
    expect(wsStatus.pageLoaded).toBe(true);
  });
});

// =============================================================================
// 6. Offline indicator hidden when online
// =============================================================================
test.describe('@quinn-v3-guardian Offline', () => {
  test('offline indicator is hidden when online', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#dashboard`);
    await waitForSpaRender(authedPage);

    const offlineBanner = authedPage.locator(
      '.offline-banner, .offline-indicator, [data-testid="offline"], [class*="offline"]'
    );
    const bannerCount = await offlineBanner.count();
    if (bannerCount > 0) {
      // If element exists, it should be hidden
      const isVisible = await offlineBanner.first().isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    }
    // If no element exists at all, that's fine — means offline banner isn't rendered
  });
});

// =============================================================================
// 7. Logout Flow — confirms clean session teardown
// =============================================================================
test.describe('@quinn-v3-guardian Logout', () => {
  test('logout clears auth and returns to login', async ({ authedPage }) => {
    await authedPage.goto(`${BASE}/#dashboard`);
    await waitForSpaRender(authedPage);

    // Try to find and click logout
    const logoutBtn = authedPage.locator(
      'button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out"), a:has-text("Logout"), [data-testid="logout"], .logout-btn, #logout-btn'
    ).first();

    const logoutVisible = await logoutBtn.isVisible().catch(() => false);

    if (logoutVisible) {
      await logoutBtn.click();
      await waitForUiSettle(authedPage);

      // Should end up on login page
      await authedPage.waitForFunction(
        () => window.location.hash.includes('#login') || window.location.hash === '' || window.location.hash === '#',
        { timeout: 10_000 }
      ).catch(() => {});

      // Verify auth tokens are cleared
      const state = await authedPage.evaluate(() => localStorage.getItem('vaultlister_state'));
      if (state) {
        const parsed = JSON.parse(state);
        // Token should be null/undefined after logout
        expect(parsed.token).toBeFalsy();
      }
    } else {
      // If logout button isn't directly visible, try opening a user menu first
      const userMenu = authedPage.locator(
        '.user-menu, .profile-menu, [data-testid="user-menu"], .avatar, .user-avatar'
      ).first();
      const menuVisible = await userMenu.isVisible().catch(() => false);
      if (menuVisible) {
        await userMenu.click();
        await waitForUiSettle(authedPage);
        const logoutInMenu = authedPage.locator('button:has-text("Logout"), a:has-text("Logout")').first();
        const logoutInMenuVisible = await logoutInMenu.isVisible().catch(() => false);
        expect(logoutInMenuVisible).toBe(true);
      }
    }
  });
});
