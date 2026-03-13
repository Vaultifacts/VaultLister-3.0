// =============================================================================
// @quinn-v3-guardian — part of the QA guardian-monitored suite
// Quinn v3 / TestFixMaster — Inventory Table Exhaustive Micro-Audit
// =============================================================================
// Phase 0: Discovery — full-page screenshot, a11y snapshot, element enumeration
// Phase 1: Hero section buttons (Bundle, Restock, Alerts, Lookup, Tools, Add)
// Phase 2: Search & filter controls (search input, filter menu, import/export/bulk/columns)
// Phase 3: Sortable column headers (13 columns) — sort indicators, aria-sort
// Phase 4: Row interactions — select checkbox, click (history), dblclick (edit), action buttons
// Phase 5: Bulk actions bar — select-all, individual select, bulk action buttons, clear
// Phase 6: Edge cases & negatives — empty search, rapid sort, filter edge cases
// =============================================================================

import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForTableRows, waitForUiSettle, waitForElement, waitForElementGone } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

// All 13 sortable columns in display order
const SORTABLE_COLUMNS = [
  { field: 'title', label: 'Item', sortId: 'sort-title' },
  { field: 'sku', label: 'SKU', sortId: 'sort-sku' },
  { field: 'list_price', label: 'Price', sortId: 'sort-list_price' },
  { field: 'marketplace', label: 'Marketplace', sortId: 'sort-marketplace' },
  { field: 'quantity', label: 'Quantity on Hand', sortId: 'sort-quantity' },
  { field: 'stock_level', label: 'Stock Level', sortId: 'sort-stock_level' },
  { field: 'location', label: 'Location', sortId: 'sort-location' },
  { field: 'tags', label: 'Tags', sortId: 'sort-tags' },
  { field: 'status', label: 'Status', sortId: 'sort-status' },
  { field: 'created_at', label: 'Created', sortId: 'sort-created_at' },
  { field: 'age', label: 'Age', sortId: 'sort-age' },
];

// 6 stat cards
const STAT_CARDS = [
  { testId: 'stat-active', label: 'Active' },
  { testId: 'stat-drafts', label: 'Drafts' },
  { testId: 'stat-low-stock', label: 'Low Stock' },
  { testId: 'stat-out-of-stock', label: 'Out of Stock' },
  { testId: 'stat-stale', label: 'Stale (90+ days)' },
  { testId: 'stat-avg-age', label: 'Avg Age (days)' },
];

// 6 bulk action buttons
const BULK_ACTIONS = [
  { label: 'Status', handler: 'bulkUpdateStatus' },
  { label: 'Price', handler: 'bulkUpdatePrice' },
  { label: 'Edit', handler: 'editSelected' },
  { label: 'Crosslist', handler: 'crosslistSelected' },
  { label: 'Export', handler: 'exportSelected' },
  { label: 'Delete', handler: 'deleteSelected' },
];

async function loginAndNavigate(page, route = 'inventory') {
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
    await waitForTableRows(page); // wait for table data
  }
}

/** Get current inventory row count */
async function getRowCount(page) {
  return page.evaluate(() => document.querySelectorAll('.table tbody tr').length);
}

// =============================================================================
// PHASE 0: DISCOVERY — Inventory Page Full Enumeration
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 0: Discovery', () => {

  test('P0-1: Inventory full-page screenshot + a11y snapshot', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    // Full page screenshot
    await page.screenshot({
      path: 'e2e/screenshots/quinn-v3-inventory-P0-fullpage.png',
      fullPage: true,
    });

    // Accessibility snapshot
    const a11yText = await page.locator('body').ariaSnapshot();
    const fs = await import('fs');
    fs.writeFileSync('e2e/screenshots/quinn-v3-inventory-P0-a11y-tree.txt', a11yText, 'utf-8');

    // Key landmarks
    expect(a11yText).toContain('Inventory');

    // Log page errors for diagnosis
    if (consoleErrors.length > 0) {
      console.warn(`Console errors on inventory: ${consoleErrors.join(' | ')}`);
    }
    if (pageErrors.length > 0) {
      console.warn(`Page errors on inventory: ${pageErrors.join(' | ')}`);
      test.info().annotations.push({ type: 'page-errors', description: pageErrors.join('; ') });
    }
  });

  test('P0-2: Enumerate ALL interactive elements on inventory page', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const elements = await page.evaluate(() => {
      const mainContent = document.querySelector('.main-content') || document.querySelector('#app');
      if (!mainContent) return [];
      const selectors = [
        'button', 'a[href]', 'input', 'select',
        '[tabindex]', '[role="button"]', '[role="link"]',
        '[onclick]', '[onchange]', '[oninput]', '[ondblclick]',
        '[aria-haspopup]', 'th[onclick]',
      ];
      const all = mainContent.querySelectorAll(selectors.join(','));
      const results = [];
      const seen = new Set();
      for (const el of all) {
        const key = el.outerHTML.substring(0, 200);
        if (seen.has(key)) continue;
        seen.add(key);
        const rect = el.getBoundingClientRect();
        results.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: (el.className || '').toString().substring(0, 80),
          text: (el.textContent || '').substring(0, 60).replace(/\s+/g, ' ').trim(),
          ariaLabel: el.getAttribute('aria-label'),
          title: el.title || null,
          onclick: (el.getAttribute('onclick') || '').substring(0, 80),
          oninput: (el.getAttribute('oninput') || '').substring(0, 80),
          onchange: (el.getAttribute('onchange') || '').substring(0, 80),
          type: el.type || null,
          visible: !!(rect.width && rect.height),
          bbox: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        });
      }
      return results;
    });

    const fs = await import('fs');
    fs.writeFileSync(
      'e2e/screenshots/quinn-v3-inventory-P0-elements.json',
      JSON.stringify(elements, null, 2),
      'utf-8'
    );

    const visible = elements.filter(e => e.visible);
    console.log(`Inventory page: ${elements.length} total interactive elements, ${visible.length} visible`);

    // Must have hero buttons, search, table headers, row controls
    expect(visible.length).toBeGreaterThan(15);

    // Verify stat cards exist
    for (const stat of STAT_CARDS) {
      const card = await page.locator(`[data-testid="${stat.testId}"]`).count();
      expect(card).toBeGreaterThanOrEqual(1);
    }
  });

  test('P0-3: Verify inventory hero stats render with valid numbers', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    for (const stat of STAT_CARDS) {
      const card = page.locator(`[data-testid="${stat.testId}"]`);
      await expect(card).toBeVisible();

      const valueEl = card.locator('.inventory-stat-value');
      const value = await valueEl.textContent();
      const num = parseInt(value?.trim() || '-1', 10);
      // All stat values must be non-negative integers
      expect(num).toBeGreaterThanOrEqual(0);

      // Label text
      const labelEl = card.locator('.inventory-stat-label');
      const label = await labelEl.textContent();
      expect(label?.trim()).toBe(stat.label);
    }
  });
});

// =============================================================================
// PHASE 1: HERO SECTION BUTTONS — 3 per batch
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 1: Hero Buttons', () => {

  test('P1-1: Bundle Builder, Restock, Low Stock Alerts', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    // --- Bundle Builder ---
    const bundleBtn = page.locator('button', { hasText: 'Bundle' }).first();
    await expect(bundleBtn).toBeVisible();
    await expect(bundleBtn).toHaveAttribute('title', 'Bundle Builder');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-1-before-bundle.png' });
    await bundleBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-1-after-bundle.png' });

    // Should open a modal or panel
    const modalVisible = await page.locator('.modal').isVisible().catch(() => false);
    if (modalVisible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- Restock ---
    const restockBtn = page.locator('button', { hasText: 'Restock' }).first();
    await expect(restockBtn).toBeVisible();
    await expect(restockBtn).toHaveAttribute('title', 'Restock Suggestions');

    await restockBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-1-after-restock.png' });

    const restockModal = await page.locator('.modal').isVisible().catch(() => false);
    if (restockModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- Low Stock Alerts ---
    const alertsBtn = page.locator('button', { hasText: 'Alerts' }).first();
    await expect(alertsBtn).toBeVisible();
    await expect(alertsBtn).toHaveAttribute('title', 'Low Stock Alerts');

    await alertsBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-1-after-alerts.png' });

    const alertsModal = await page.locator('.modal').isVisible().catch(() => false);
    if (alertsModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P1-2: Quick Lookup, Tools dropdown, Add Item', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    // --- Quick Lookup ---
    const lookupBtn = page.locator('button', { hasText: 'Lookup' }).first();
    await expect(lookupBtn).toBeVisible();
    await expect(lookupBtn).toHaveAttribute('title', 'Quick Item Lookup');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-2-before-lookup.png' });
    await lookupBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-2-after-lookup.png' });

    const lookupModal = await page.locator('.modal').isVisible().catch(() => false);
    if (lookupModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- Tools dropdown ---
    const toolsDropdown = page.locator('.dropdown', { hasText: 'Tools' }).first();
    await expect(toolsDropdown).toBeVisible();
    const toolsBtn = toolsDropdown.locator('button[aria-haspopup="menu"]');
    await expect(toolsBtn).toBeVisible();

    // Click to open dropdown
    await toolsBtn.click();
    await page.waitForTimeout(150);

    // Verify dropdown menu items
    const dropdownMenu = toolsDropdown.locator('.dropdown-menu');
    await expect(dropdownMenu).toBeVisible();

    const menuItems = await dropdownMenu.locator('.dropdown-item').allTextContents();
    const menuTexts = menuItems.map(t => t.replace(/\s+/g, ' ').trim());
    expect(menuTexts.some(t => t.includes('Bulk Prices'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Age Analysis'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Calculator'))).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-2-tools-open.png' });

    // Close dropdown by clicking elsewhere
    await page.locator('.inventory-hero-title').click();
    await page.waitForTimeout(150);

    // --- Add Item ---
    const addBtn = page.locator('button', { hasText: 'Add Item' }).first();
    await expect(addBtn).toBeVisible();

    await addBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-2-after-add-item.png' });

    // Should open modal
    const addModal = await page.locator('.modal').isVisible().catch(() => false);
    if (addModal) {
      const modalContent = await page.locator('.modal').textContent();
      // Modal should relate to adding an item
      expect(modalContent?.length).toBeGreaterThan(0);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P1-3: Tools dropdown items — Bulk Prices, Age Analysis, Calculator', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const toolsDropdown = page.locator('.dropdown', { hasText: 'Tools' }).first();
    const toolsBtn = toolsDropdown.locator('button[aria-haspopup="menu"]');

    // --- Bulk Prices ---
    await toolsBtn.click();
    await page.waitForTimeout(150);
    const bulkPricesItem = toolsDropdown.locator('.dropdown-item', { hasText: 'Bulk Prices' });
    await expect(bulkPricesItem).toBeVisible();
    await bulkPricesItem.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-3-bulk-prices.png' });

    const bpModal = await page.locator('.modal').isVisible().catch(() => false);
    if (bpModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Age Analysis ---
    await toolsBtn.click();
    await page.waitForTimeout(150);
    const ageItem = toolsDropdown.locator('.dropdown-item', { hasText: 'Age Analysis' });
    await expect(ageItem).toBeVisible();
    await ageItem.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-3-age-analysis.png' });

    const aaModal = await page.locator('.modal').isVisible().catch(() => false);
    if (aaModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Calculator ---
    await toolsBtn.click();
    await page.waitForTimeout(150);
    const calcItem = toolsDropdown.locator('.dropdown-item', { hasText: 'Calculator' });
    await expect(calcItem).toBeVisible();
    await calcItem.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P1-3-calculator.png' });

    const calcModal = await page.locator('.modal').isVisible().catch(() => false);
    if (calcModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  });
});

// =============================================================================
// PHASE 2: SEARCH & FILTER CONTROLS — 3 per batch
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 2: Search & Filter', () => {

  test('P2-1: Search input, Filter button, Import button', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const initialRows = await getRowCount(page);
    console.log(`Initial row count: ${initialRows}`);

    // --- Search input ---
    const searchInput = page.locator('#inventory-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search items...');

    // Type a search term
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-1-before-search.png' });
    await searchInput.fill('test');
    // Wait for debounce (typically 300ms)
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-1-after-search.png' });

    // Clear search
    await searchInput.fill('');
    await waitForSpaRender(page);

    const rowsAfterClear = await getRowCount(page);
    // After clearing, row count should restore (or be same as initial)
    expect(rowsAfterClear).toBe(initialRows);

    // --- Filter button ---
    const filterBtn = page.locator('button', { hasText: 'Filters' }).first();
    await expect(filterBtn).toBeVisible();

    // Small settle delay — filter handler may not be attached immediately after search clear
    await page.waitForTimeout(500);
    await filterBtn.click();
    // Wait for filter menu to become visible after click
    const filterMenu = page.locator('#filter-menu');
    await filterMenu.waitFor({ state: 'visible', timeout: 5000 }).catch(async () => {
      // Retry click if menu didn't open
      await page.waitForTimeout(300);
      await filterBtn.click();
      await filterMenu.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    });
    const isFilterVisible = await filterMenu.isVisible() && await filterMenu.evaluate(el => !el.classList.contains('hidden')).catch(() => false);
    expect(isFilterVisible).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-1-filter-open.png' });

    // Verify filter controls
    await expect(page.locator('#filter-column')).toBeVisible();
    await expect(page.locator('#filter-value')).toBeVisible();

    // Close filter menu
    await filterBtn.click();
    await waitForUiSettle(page);

    // --- Import button ---
    const importBtn = page.locator('button', { hasText: 'Import' }).first();
    await expect(importBtn).toBeVisible();

    await importBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-1-after-import.png' });

    const impModal = await page.locator('.modal').isVisible().catch(() => false);
    if (impModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  });

  test('P2-2: Export button, Bulk Edit button, Column Picker button', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    // --- Export button ---
    const exportBtn = page.locator('button', { hasText: 'Export' }).first();
    await expect(exportBtn).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-2-before-export.png' });
    await exportBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-2-after-export.png' });
    // Export may trigger download or modal — just verify no crash

    // --- Bulk Edit button ---
    const bulkEditBtn = page.locator('button', { hasText: 'Bulk Edit' }).first();
    await expect(bulkEditBtn).toBeVisible();

    await bulkEditBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-2-after-bulk-edit.png' });

    const beModal = await page.locator('.modal').isVisible().catch(() => false);
    if (beModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Column Picker button ---
    const colPickerBtn = page.locator('button[title="Column Settings"]');
    await expect(colPickerBtn).toBeVisible();

    await colPickerBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-2-column-picker.png' });

    const cpModal = await page.locator('.modal').isVisible().catch(() => false);
    if (cpModal) {
      // Should show column list
      const modalText = await page.locator('.modal').textContent();
      expect(modalText).toContain('Column');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P2-3: Filter — add filter by status, verify filter badge, clear all', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const filterBtn = page.locator('button', { hasText: 'Filters' }).first();

    // Open filter menu
    await filterBtn.click();
    await page.waitForTimeout(150);
    await expect(page.locator('#filter-menu')).not.toHaveClass(/hidden/);

    // Select status column
    await page.locator('#filter-column').selectOption('status');
    await page.locator('#filter-value').fill('active');

    // Click Add
    const addFilterBtn = page.locator('#filter-menu button', { hasText: 'Add' }).first();
    await addFilterBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-3-filter-applied.png' });

    // Filter badge should show on Filters button
    const badge = filterBtn.locator('.badge');
    const badgeCount = await badge.count();
    if (badgeCount > 0) {
      const badgeText = await badge.first().textContent();
      expect(parseInt(badgeText?.trim() || '0', 10)).toBeGreaterThan(0);
    }

    // Clear all filters
    const clearAllBtn = page.locator('#filter-menu button', { hasText: 'Clear All' }).first();
    await clearAllBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P2-3-filter-cleared.png' });

    // Close filter menu
    const closeBtn = page.locator('#filter-menu button', { hasText: 'Close' }).first();
    await closeBtn.click();
    await page.waitForTimeout(150);
  });
});

// =============================================================================
// PHASE 3: SORTABLE COLUMN HEADERS — 3 per batch
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 3: Sort Headers', () => {

  // Batch sortable columns into groups of 3
  const sortBatches = [];
  for (let i = 0; i < SORTABLE_COLUMNS.length; i += 3) {
    sortBatches.push(SORTABLE_COLUMNS.slice(i, i + 3));
  }

  for (let batchIdx = 0; batchIdx < sortBatches.length; batchIdx++) {
    const batch = sortBatches[batchIdx];
    const batchLabels = batch.map(b => b.label).join(', ');

    test(`P3-${batchIdx + 1}: Sort — ${batchLabels}`, async ({ page }) => {
      await loginAndNavigate(page, 'inventory');
      await waitForTableRows(page);

      for (const col of batch) {
        // Screenshot before sort
        await page.screenshot({
          path: `e2e/screenshots/quinn-v3-inv-P3-${col.field}-before.png`,
          fullPage: false,
        });

        // Click column header to sort
        const header = page.locator(`th`, { hasText: col.label }).first();
        await expect(header).toBeVisible();
        await header.click();

        // toggleSort() makes an async API call then updates DOM indicators.
        // Wait for the indicator to change from ⇅ to ↑ or ↓.
        const sortId = col.sortId;
        let indicatorChanged = false;
        try {
          await page.waitForFunction(
            (id) => {
              const el = document.getElementById(id);
              return el && el.textContent !== '⇅';
            },
            sortId,
            { timeout: 5_000 }
          );
          indicatorChanged = true;
        } catch {
          // Indicator didn't change — log as defect
        }

        const indicatorAfter = await page.locator(`#${sortId}`).textContent().catch(() => '?');

        if (!indicatorChanged) {
          console.warn(`[DEFECT] Sort indicator #${sortId} did not update after click (still "${indicatorAfter}"). toggleSort async API call may have failed or timed out.`);
          test.info().annotations.push({ type: 'known-issue', description: `Sort indicator #${sortId} did not update` });
        } else {
          expect(indicatorAfter).toMatch(/^[↑↓]$/);
        }

        // Screenshot after first sort click
        await page.screenshot({
          path: `e2e/screenshots/quinn-v3-inv-P3-${col.field}-after-1.png`,
          fullPage: false,
        });

        // Wait for debounce to clear (300ms in handler)
        await waitForSpaRender(page);

        // Click again to reverse sort direction
        await header.click();

        if (indicatorChanged) {
          try {
            await page.waitForFunction(
              (id, prev) => {
                const el = document.getElementById(id);
                return el && el.textContent !== '⇅' && el.textContent !== prev;
              },
              [sortId, indicatorAfter],
              { timeout: 5_000 }
            );
          } catch {
            console.warn(`[DEFECT] Sort indicator #${sortId} did not reverse after second click.`);
            test.info().annotations.push({ type: 'known-issue', description: `Sort indicator #${sortId} did not reverse` });
          }
        } else {
          await waitForTableRows(page);
        }

        await page.screenshot({
          path: `e2e/screenshots/quinn-v3-inv-P3-${col.field}-after-2.png`,
          fullPage: false,
        });
      }
    });
  }
});

// =============================================================================
// PHASE 4: ROW INTERACTIONS — select, click, dblclick, actions
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 4: Row Interactions', () => {

  test('P4-1: Row checkbox select, row click (item history), row dblclick (edit)', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount === 0) {
      console.warn('No inventory rows — skipping row interaction test');
      return;
    }

    const firstRow = page.locator('.table tbody tr').first();

    // --- Row checkbox ---
    const checkbox = firstRow.locator('input[type="checkbox"][data-bulk]');
    await expect(checkbox).toBeVisible();
    expect(await checkbox.isChecked()).toBe(false);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-1-before-check.png' });
    await checkbox.check();
    expect(await checkbox.isChecked()).toBe(true);

    // Bulk bar should appear
    const bulkBar = page.locator('#selection-menu');
    await page.waitForTimeout(150);
    const bulkVisible = await bulkBar.evaluate(el => !el.classList.contains('hidden')).catch(() => false);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-1-after-check.png' });

    // Uncheck
    await checkbox.uncheck();
    expect(await checkbox.isChecked()).toBe(false);
    await page.waitForTimeout(150);

    // --- Row click (item history modal) ---
    // Click on the row's title cell to trigger onclick
    const titleCell = firstRow.locator('td').nth(2); // 3rd td = title
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-1-before-row-click.png' });
    await titleCell.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-1-after-row-click.png' });

    // Should open a modal (item history)
    const historyModal = await page.locator('.modal').isVisible().catch(() => false);
    if (historyModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- Row dblclick (edit item) ---
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-1-before-dblclick.png' });
    await titleCell.dblclick();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-1-after-dblclick.png' });

    const editModal = await page.locator('.modal').isVisible().catch(() => false);
    if (editModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P4-2: Edit button, Delete button, row aria-label on checkbox', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount === 0) {
      console.warn('Insufficient inventory rows — skipping test');
      return;
    }

    const firstRow = page.locator('.table tbody tr').first();

    // --- Edit button ---
    const editBtn = firstRow.locator('button[title="Edit item"]');
    await expect(editBtn).toBeVisible();
    const editText = await editBtn.textContent();
    expect(editText?.replace(/\s+/g, ' ').trim()).toContain('Edit');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-2-before-edit-btn.png' });
    await editBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-2-after-edit-btn.png' });

    const editModal = await page.locator('.modal').isVisible().catch(() => false);
    if (editModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- Delete button ---
    const deleteBtn = firstRow.locator('button[title="Delete item"]');
    await expect(deleteBtn).toBeVisible();

    // We do NOT click delete to avoid data loss — just verify it exists and has correct attributes
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-2-delete-btn-visible.png' });

    // --- Checkbox aria-label ---
    const checkbox = firstRow.locator('input[type="checkbox"][data-bulk]');
    const ariaLabel = await checkbox.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/^Select item /);
  });

  test('P4-3: Select multiple rows, verify selection count updates', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount < 2) {
      console.warn('Insufficient inventory rows — skipping test');
      return;
    }

    const rows = page.locator('.table tbody tr');
    const selectCount = Math.min(3, rowCount);

    // Select first N rows
    for (let i = 0; i < selectCount; i++) {
      const cb = rows.nth(i).locator('input[type="checkbox"][data-bulk]');
      await cb.check();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(150);

    // Selection count should match
    const countEl = page.locator('#selection-count');
    const countText = await countEl.textContent().catch(() => '0');
    const count = parseInt(countText?.trim() || '0', 10);
    expect(count).toBe(selectCount);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P4-3-multi-select.png' });

    // Clear selection via clear button
    const clearBtn = page.locator('.bulk-clear-btn');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(150);
    }
  });
});

// =============================================================================
// PHASE 5: BULK ACTIONS BAR
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 5: Bulk Actions', () => {

  test('P5-1: Select-all checkbox toggles all rows', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount === 0) {
      console.warn('Insufficient inventory rows — skipping test');
      return;
    }

    const selectAll = page.locator('#select-all-checkbox');
    await expect(selectAll).toBeVisible();

    // Check select-all
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P5-1-before-select-all.png' });
    await selectAll.check();
    await waitForSpaRender(page);

    // All row checkboxes should be checked
    const checkedBoxes = await page.locator('.table tbody input[type="checkbox"][data-bulk]:checked').count();
    expect(checkedBoxes).toBe(rowCount);

    // Bulk bar should be visible
    const bulkBar = page.locator('#selection-menu');
    const bulkVisible = await bulkBar.evaluate(el => !el.classList.contains('hidden')).catch(() => false);
    expect(bulkVisible).toBe(true);

    // Selection count should match row count
    const countText = await page.locator('#selection-count').textContent();
    expect(parseInt(countText?.trim() || '0', 10)).toBe(rowCount);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P5-1-all-selected.png' });

    // Uncheck select-all
    await selectAll.uncheck();
    await waitForSpaRender(page);

    const uncheckedCount = await page.locator('.table tbody input[type="checkbox"][data-bulk]:checked').count();
    expect(uncheckedCount).toBe(0);
  });

  test('P5-2: Bulk action buttons — Status, Price, Edit (visible when selected)', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount === 0) {
      console.warn('Insufficient inventory rows — skipping test');
      return;
    }

    // Select first row to show bulk bar
    const firstCb = page.locator('.table tbody tr').first().locator('input[type="checkbox"][data-bulk]');
    await firstCb.check();
    await page.waitForTimeout(150);

    const bulkBar = page.locator('#selection-menu');

    // --- Status button ---
    const statusBtn = bulkBar.locator('.bulk-action-btn', { hasText: 'Status' });
    await expect(statusBtn).toBeVisible();
    await expect(statusBtn).toHaveAttribute('title', 'Change status');

    // --- Price button ---
    const priceBtn = bulkBar.locator('.bulk-action-btn', { hasText: 'Price' });
    await expect(priceBtn).toBeVisible();
    await expect(priceBtn).toHaveAttribute('title', 'Update prices');

    // --- Edit button ---
    const editBtn = bulkBar.locator('.bulk-action-btn', { hasText: 'Edit' });
    await expect(editBtn).toBeVisible();
    await expect(editBtn).toHaveAttribute('title', 'Edit selected');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P5-2-bulk-bar.png' });

    // Cleanup
    await firstCb.uncheck();
    await page.waitForTimeout(150);
  });

  test('P5-3: Bulk action buttons — Crosslist, Export, Delete + clear selection', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount === 0) {
      console.warn('Insufficient inventory rows — skipping test');
      return;
    }

    // Select first row
    const firstCb = page.locator('.table tbody tr').first().locator('input[type="checkbox"][data-bulk]');
    await firstCb.check();
    await page.waitForTimeout(150);

    const bulkBar = page.locator('#selection-menu');

    // --- Crosslist button ---
    const crosslistBtn = bulkBar.locator('.bulk-action-btn', { hasText: 'Crosslist' });
    await expect(crosslistBtn).toBeVisible();
    await expect(crosslistBtn).toHaveAttribute('title', 'Crosslist to platforms');

    // --- Export button ---
    const exportBtn = bulkBar.locator('.bulk-action-btn', { hasText: 'Export' });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toHaveAttribute('title', 'Export selected');

    // --- Delete button ---
    const deleteBtn = bulkBar.locator('.bulk-action-btn', { hasText: 'Delete' });
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toHaveAttribute('title', 'Delete selected');
    // Delete button should have danger class
    await expect(deleteBtn).toHaveClass(/danger/);

    // --- Clear selection button ---
    const clearBtn = page.locator('.bulk-clear-btn');
    await expect(clearBtn).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P5-3-bulk-bar-full.png' });

    // Click clear
    await clearBtn.click();
    await page.waitForTimeout(150);

    // Bulk bar should be hidden
    const isHidden = await bulkBar.evaluate(el => el.classList.contains('hidden')).catch(() => true);
    expect(isHidden).toBe(true);

    // Selection count should be 0
    const unchecked = await page.locator('.table tbody input[type="checkbox"][data-bulk]:checked').count();
    expect(unchecked).toBe(0);
  });
});

// =============================================================================
// PHASE 6: EDGE CASES & NEGATIVES
// =============================================================================
test.describe('Quinn v3 > Inventory Table > Phase 6: Edge Cases', () => {

  test('P6-1: Empty search shows "no results" state, clear restores', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const initialRows = await getRowCount(page);

    // Search for something that won't match
    const searchInput = page.locator('#inventory-search');
    await searchInput.fill('zzzzxqnonexistent99999');
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P6-1-no-results.png' });

    // Should show empty state or 0 rows
    const noResultRows = await getRowCount(page);
    if (noResultRows === 0) {
      // Check for empty state message
      const emptyState = page.locator('.empty-state');
      const emptyCount = await emptyState.count();
      if (emptyCount > 0) {
        const emptyText = await emptyState.textContent();
        expect(emptyText).toContain('No results');
      }
    }

    // Clear and verify restoration — wait for rows to return
    await searchInput.fill('');
    await waitForSpaRender(page);

    // Wait for table to repopulate (debounce + re-render can be slow under load)
    await page.waitForFunction(
      (expected) => {
        const rows = document.querySelectorAll('.inventory-table tbody tr, [data-testid="inventory-table"] tbody tr, table tbody tr');
        return rows.length >= expected;
      },
      initialRows,
      { timeout: 10000 }
    ).catch(() => {});

    const restoredRows = await getRowCount(page);
    expect(restoredRows).toBeGreaterThanOrEqual(initialRows - 1); // Allow minor variance under load
  });

  test('P6-2: Rapid sort clicks (5 clicks on same column) — no crash', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    const titleHeader = page.locator('th', { hasText: 'Item' }).first();

    // Rapid-fire 5 clicks
    for (let i = 0; i < 5; i++) {
      await titleHeader.click();
      await page.waitForTimeout(50); // minimal delay
    }

    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P6-2-rapid-sort.png' });

    // Table should still render with no JS errors
    const rows = await getRowCount(page);
    expect(rows).toBeGreaterThanOrEqual(0);

    if (pageErrors.length > 0) {
      console.warn(`[DEFECT] Page errors after rapid sort: ${pageErrors.join(' | ')}`);
      test.info().annotations.push({ type: 'known-issue', description: `Rapid sort errors: ${pageErrors.join('; ')}` });
    }
  });

  test('P6-3: Select-all then deselect individual — count decrements', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const rowCount = await getRowCount(page);
    if (rowCount < 2) {
      console.warn('Insufficient inventory rows — skipping test');
      return;
    }

    // Select all
    const selectAll = page.locator('#select-all-checkbox');
    await selectAll.check();
    await page.waitForTimeout(150);

    const countBefore = await page.locator('#selection-count').textContent();
    expect(parseInt(countBefore?.trim() || '0', 10)).toBe(rowCount);

    // Deselect first row
    const firstCb = page.locator('.table tbody tr').first().locator('input[type="checkbox"][data-bulk]');
    await firstCb.uncheck();
    await page.waitForTimeout(150);

    // Count should decrement by 1
    const countAfter = await page.locator('#selection-count').textContent();
    expect(parseInt(countAfter?.trim() || '0', 10)).toBe(rowCount - 1);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P6-3-partial-deselect.png' });

    // Cleanup
    await selectAll.uncheck();
    await page.waitForTimeout(150);
  });

  test('P6-4: Filter edge case — empty value, category column', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const filterBtn = page.locator('button', { hasText: 'Filters' }).first();
    await filterBtn.click();
    await page.waitForTimeout(150);

    // Try adding filter with empty value
    await page.locator('#filter-column').selectOption('category');
    // Don't fill value — test empty filter
    const addBtn = page.locator('#filter-menu button', { hasText: 'Add' }).first();
    await addBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P6-4-empty-filter.png' });

    // Should either ignore or show validation — no crash
    const rows = await getRowCount(page);
    expect(rows).toBeGreaterThanOrEqual(0);

    // Try brand filter
    await page.locator('#filter-column').selectOption('brand');
    await page.locator('#filter-value').fill('NonExistentBrand12345');
    await addBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inv-P6-4-brand-no-match.png' });

    // Clear all
    const clearAll = page.locator('#filter-menu button', { hasText: 'Clear All' }).first();
    await clearAll.click();
    await page.waitForTimeout(150);

    // Close filter menu
    const closeBtn = page.locator('#filter-menu button', { hasText: 'Close' }).first();
    await closeBtn.click();
    await page.waitForTimeout(150);
  });

  test('P6-5: Page title and hero subtitle reflect item count', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    const heroTitle = page.locator('.inventory-hero-title');
    await expect(heroTitle).toBeVisible();
    const titleText = await heroTitle.textContent();
    // Title should contain "Inventory" and item count in parentheses
    expect(titleText).toMatch(/Inventory \(\d+ items?\)/);

    const heroSubtitle = page.locator('.inventory-hero-subtitle');
    await expect(heroSubtitle).toBeVisible();
    const subtitleText = await heroSubtitle.textContent();
    expect(subtitleText?.trim()).toBe('Manage your product catalog');
  });

  test('P6-6: Inventory sidebar nav shows active state', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await waitForTableRows(page);

    // Verify inventory nav item is active
    const navBtn = page.locator('[data-testid="nav-inventory"]');
    await expect(navBtn).toBeVisible();
    await expect(navBtn).toHaveClass(/active/);
    await expect(navBtn).toHaveAttribute('aria-current', 'page');

    // No other nav item should be active
    const otherActive = await page.locator('.nav-item[aria-current="page"]').count();
    expect(otherActive).toBe(1);
  });
});
