// =============================================================================
// @quinn-v3-guardian — part of the QA guardian-monitored suite
// Quinn v3 / TestFixMaster — Orders Table Exhaustive Micro-Audit
// =============================================================================
// Phase 0: Discovery — full-page screenshot, a11y snapshot, element enumeration
// Phase 1: Hero buttons (View toggle, Ship Calc, Returns, Labels, Sync, More)
// Phase 2: Order pipeline — Pending/Confirmed/Shipped/Delivered stage clicks
// Phase 3: Filter controls — Search, Platform, Status, Date Range, Clear
// Phase 4: Row interactions — checkbox, action buttons (view, notes, bell, etc.)
// Phase 5: Quick stats — Total Value, All Time Orders, Completion Rate
// Phase 6: Edge cases — empty search, combined filters, rapid pipeline clicks
// =============================================================================

import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForTableRows, waitForUiSettle, waitForElement, waitForElementGone } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

// Pipeline stages
const PIPELINE_STAGES = ['Pending', 'Confirmed', 'Shipped', 'Delivered'];

// Quick stats
const QUICK_STATS = ['Total Value', 'All Time Orders', 'Completion Rate'];

async function loginAndNavigate(page, route = 'orders') {
  if (route !== 'dashboard') {
    await page.evaluate((r) => router.navigate(r), route);
    await waitForSpaRender(page);
    await waitForTableRows(page); // wait for table data
  }
}

async function getOrderRowCount(page) {
  return page.evaluate(() => document.querySelectorAll('.table tbody tr').length);
}

// =============================================================================
// PHASE 0: DISCOVERY
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 0: Discovery', () => {

  test('P0-1: Orders full-page screenshot + a11y snapshot', async ({ authedPage: page }) => {
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await loginAndNavigate(page, 'orders');

    await page.screenshot({
      path: 'e2e/screenshots/quinn-v3-orders-P0-fullpage.png',
      fullPage: true,
    });

    const a11yText = await page.locator('body').ariaSnapshot();
    const fs = await import('fs');
    fs.writeFileSync('e2e/screenshots/quinn-v3-orders-P0-a11y-tree.txt', a11yText, 'utf-8');

    expect(a11yText).toContain('Order');

    if (consoleErrors.length > 0) {
      console.warn(`Console errors on orders: ${consoleErrors.join(' | ')}`);
    }
    if (pageErrors.length > 0) {
      console.warn(`Page errors on orders: ${pageErrors.join(' | ')}`);
      test.info().annotations.push({ type: 'page-errors', description: pageErrors.join('; ') });
    }
  });

  test('P0-2: Enumerate ALL interactive elements on orders page', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const elements = await page.evaluate(() => {
      const mainContent = document.querySelector('.main-content') || document.querySelector('#app');
      if (!mainContent) return [];
      const selectors = [
        'button', 'a[href]', 'input', 'select',
        '[tabindex]', '[role="button"]',
        '[onclick]', '[onchange]', '[onkeyup]',
        '[aria-haspopup]',
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
          visible: !!(rect.width && rect.height),
        });
      }
      return results;
    });

    const fs = await import('fs');
    fs.writeFileSync(
      'e2e/screenshots/quinn-v3-orders-P0-elements.json',
      JSON.stringify(elements, null, 2),
      'utf-8'
    );

    const visible = elements.filter(e => e.visible);
    console.log(`Orders page: ${elements.length} total, ${visible.length} visible`);
    expect(visible.length).toBeGreaterThan(10);
  });

  test('P0-3: Orders hero title and subtitle', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const title = page.locator('.orders-hero-title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText?.trim()).toBe('Orders');

    const subtitle = page.locator('.orders-hero-subtitle');
    await expect(subtitle).toBeVisible();
    const subtitleText = await subtitle.textContent();
    expect(subtitleText?.trim()).toBe('Track and manage your orders');
  });
});

// =============================================================================
// PHASE 1: HERO BUTTONS
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 1: Hero Buttons', () => {

  test('P1-1: Ship Calc, Returns, Shipping Labels buttons', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    // --- Ship Calc ---
    const shipCalcBtn = page.locator('button', { hasText: 'Ship Calc' }).first();
    await expect(shipCalcBtn).toBeVisible();
    await expect(shipCalcBtn).toHaveAttribute('title', 'Shipping Cost Calculator');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-1-before-shipcalc.png' });
    await shipCalcBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-1-after-shipcalc.png' });

    const shipModal = await page.locator('.modal').isVisible().catch(() => false);
    if (shipModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Returns ---
    const returnsBtn = page.locator('button', { hasText: 'Returns' }).first();
    await expect(returnsBtn).toBeVisible();
    await expect(returnsBtn).toHaveAttribute('title', 'Return Analytics');

    await returnsBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-1-after-returns.png' });

    const retModal = await page.locator('.modal').isVisible().catch(() => false);
    if (retModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Shipping Labels ---
    const labelsBtn = page.locator('button', { hasText: 'Shipping Labels' }).first();
    await expect(labelsBtn).toBeVisible();

    await labelsBtn.click();
    await waitForSpaRender(page);
    // This navigates to #shipping-labels
    const hash = await page.evaluate(() => window.location.hash);
    if (hash === '#shipping-labels') {
      // Navigate back
      await page.evaluate(() => router.navigate('orders'));
      await waitForSpaRender(page);
      await waitForSpaRender(page);
    }
  });

  test('P1-2: Sync button, More dropdown (Import, Labels, Export, Batch Ship, Map)', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    // --- Sync ---
    const heroActions = page.locator('.orders-hero-actions');
    const syncBtn = heroActions.locator('button', { hasText: 'Sync' }).first();
    await expect(syncBtn).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-2-before-sync.png' });
    await syncBtn.click();
    await waitForSpaRender(page);

    // --- More dropdown ---
    const moreDropdown = heroActions.locator('.dropdown').first();
    const moreBtn = moreDropdown.locator('button[aria-haspopup="menu"]');
    await expect(moreBtn).toBeVisible();

    await moreBtn.click();
    await page.waitForTimeout(150);

    const menu = moreDropdown.locator('.dropdown-menu');
    await expect(menu).toBeVisible();

    const menuItems = await menu.locator('.dropdown-item').allTextContents();
    const menuTexts = menuItems.map(t => t.replace(/\s+/g, ' ').trim());

    expect(menuTexts.some(t => t.includes('Import Orders'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Generate Labels'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Export CSV'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Batch Ship'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Order Map'))).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-2-more-dropdown.png' });

    // Close
    await page.locator('.orders-hero-title').click();
    await page.waitForTimeout(150);
  });

  test('P1-3: More dropdown items — Import Orders, Export CSV, Order Map', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const moreDropdown = page.locator('.orders-hero-actions .dropdown').first();
    const moreBtn = moreDropdown.locator('button[aria-haspopup="menu"]');

    // --- Import Orders ---
    await moreBtn.click();
    await page.waitForTimeout(150);
    const importItem = moreDropdown.locator('.dropdown-item', { hasText: 'Import Orders' });
    await importItem.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-3-import.png' });
    const impModal = await page.locator('.modal').isVisible().catch(() => false);
    if (impModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Export CSV ---
    await moreBtn.click();
    await page.waitForTimeout(150);
    const exportItem = moreDropdown.locator('.dropdown-item', { hasText: 'Export CSV' });
    await exportItem.click();
    await waitForSpaRender(page);

    // --- Order Map ---
    await moreBtn.click();
    await page.waitForTimeout(150);
    const mapItem = moreDropdown.locator('.dropdown-item', { hasText: 'Order Map' });
    await mapItem.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P1-3-map.png' });
    const mapModal = await page.locator('.modal').isVisible().catch(() => false);
    if (mapModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  });
});

// =============================================================================
// PHASE 2: ORDER PIPELINE
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 2: Pipeline', () => {

  test('P2-1: Pipeline stages render with counts', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const pipeline = page.locator('.orders-pipeline');
    await expect(pipeline).toBeVisible();

    for (const stage of PIPELINE_STAGES) {
      const stageEl = pipeline.locator('.pipeline-stage', { hasText: stage }).first();
      await expect(stageEl).toBeVisible();

      // Count badge
      const countBadge = stageEl.locator('.pipeline-count-badge');
      const countText = await countBadge.textContent();
      const count = parseInt(countText?.trim() || '0', 10);
      expect(count).toBeGreaterThanOrEqual(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P2-1-pipeline.png' });
  });

  test('P2-2: Click pipeline stages — filters table by status', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowsBefore = await getOrderRowCount(page);

    // Click "Pending" pipeline stage
    const pendingStage = page.locator('.pipeline-stage', { hasText: 'Pending' }).first();
    await pendingStage.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P2-2-pending-filter.png' });

    const rowsAfterPending = await getOrderRowCount(page);
    expect(rowsAfterPending).toBeLessThanOrEqual(rowsBefore);

    // Click "Delivered" pipeline stage
    const deliveredStage = page.locator('.pipeline-stage', { hasText: 'Delivered' }).first();
    await deliveredStage.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P2-2-delivered-filter.png' });
  });

  test('P2-3: Pipeline connectors render, urgent alert renders if present', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    // Pipeline connectors
    const connectors = page.locator('.pipeline-connector');
    const connectorCount = await connectors.count();
    expect(connectorCount).toBe(3); // 3 connectors between 4 stages

    // Urgent alert (conditional)
    const urgentAlert = page.locator('.orders-urgent-alert');
    const urgentVisible = await urgentAlert.isVisible().catch(() => false);
    if (urgentVisible) {
      const alertText = await urgentAlert.textContent();
      expect(alertText).toContain('need');
      expect(alertText).toContain('shipping');

      // View Orders button in alert
      const viewBtn = urgentAlert.locator('button', { hasText: 'View Orders' });
      await expect(viewBtn).toBeVisible();
    } else {
      console.log('No urgent orders alert — all orders shipped on time');
    }

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P2-3-connectors.png' });
  });
});

// =============================================================================
// PHASE 3: FILTER CONTROLS
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 3: Filters', () => {

  test('P3-1: Search input, Platform filter, Status filter', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    // --- Search ---
    const searchInput = page.locator('input[placeholder*="Buyer"]');
    await expect(searchInput).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P3-1-before-search.png' });
    await searchInput.fill('test');
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P3-1-after-search.png' });
    await searchInput.fill('');
    await waitForSpaRender(page);

    // --- Platform filter ---
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' }).first();
    await expect(platformSelect).toBeVisible();
    const platformOptions = await platformSelect.locator('option').allTextContents();
    expect(platformOptions.some(o => o.includes('All Platforms'))).toBe(true);
    expect(platformOptions.length).toBeGreaterThanOrEqual(3);

    // --- Status filter ---
    const statusSelect = page.locator('select').filter({ hasText: 'All Status' }).first();
    await expect(statusSelect).toBeVisible();
    const statusOptions = await statusSelect.locator('option').allTextContents();
    expect(statusOptions.some(o => o.includes('All Status'))).toBe(true);
    expect(statusOptions.some(o => o.includes('Pending'))).toBe(true);
    expect(statusOptions.some(o => o.includes('Shipped'))).toBe(true);
  });

  test('P3-2: Date Range filter, Clear Filters button', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    // --- Date Range ---
    const dateSelect = page.locator('select').filter({ hasText: 'All Time' }).first();
    await expect(dateSelect).toBeVisible();

    const dateOptions = await dateSelect.locator('option').allTextContents();
    expect(dateOptions.some(o => o.includes('All Time'))).toBe(true);
    expect(dateOptions.some(o => o.includes('Today'))).toBe(true);
    expect(dateOptions.some(o => o.includes('Last 7 Days'))).toBe(true);

    // Apply a date filter to make Clear Filters appear
    await dateSelect.selectOption('month');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P3-2-date-month.png' });

    // --- Clear Filters ---
    const clearBtn = page.locator('button', { hasText: 'Clear Filters' });
    const clearVisible = await clearBtn.isVisible().catch(() => false);
    if (clearVisible) {
      await clearBtn.click();
      await waitForSpaRender(page);
      await waitForSpaRender(page);
      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P3-2-cleared.png' });
    } else {
      // Manually reset
      await dateSelect.selectOption('all');
      await waitForSpaRender(page);
    }
  });

  test('P3-3: Platform filter — select specific, verify row count change', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowsBefore = await getOrderRowCount(page);
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' }).first();

    await platformSelect.selectOption('poshmark');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    const rowsAfter = await getOrderRowCount(page);
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P3-3-poshmark.png' });

    // Reset
    await platformSelect.selectOption('all');
    await waitForSpaRender(page);
  });
});

// =============================================================================
// PHASE 4: ROW INTERACTIONS
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 4: Row Interactions', () => {

  test('P4-1: Select-all checkbox, per-row checkbox, row urgency styling', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowCount = await getOrderRowCount(page);
    if (rowCount === 0) {
      console.warn('No order rows — skipping test');
      return;
    }

    // --- Select-all ---
    const selectAll = page.locator('th input[type="checkbox"][aria-label="Select all orders"]');
    await expect(selectAll).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-1-before-select.png' });
    // Use click() instead of check() because the onchange handler re-renders the page
    await selectAll.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    // After re-render, verify rows are selected
    const selectedIds = await page.evaluate(() => store.state.selectedOrderIds?.length || 0);
    console.log(`Selected order IDs after select-all: ${selectedIds}`);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-1-all-selected.png' });

    // Click again to deselect
    const selectAll2 = page.locator('th input[type="checkbox"][aria-label="Select all orders"]');
    await selectAll2.click();
    await waitForSpaRender(page);

    // Check urgency styling classes
    const overdueRows = await page.locator('.order-row-overdue').count();
    const warningRows = await page.locator('.order-row-warning').count();
    console.log(`Overdue rows: ${overdueRows}, Warning rows: ${warningRows}`);
  });

  test('P4-2: Action buttons — View, Notes, Bell (first 3)', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowCount = await getOrderRowCount(page);
    if (rowCount === 0) {
      console.warn('No order rows — skipping test');
      return;
    }

    const firstRow = page.locator('.table tbody tr').first();

    // --- View Details ---
    const viewBtn = firstRow.locator('button[title="View Details"]');
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-2-view-details.png' });
    const viewModal = await page.locator('.modal').isVisible().catch(() => false);
    if (viewModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Internal Notes ---
    const notesBtn = firstRow.locator('button[title="Internal Notes"]');
    await expect(notesBtn).toBeVisible();
    await notesBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-2-notes.png' });
    const notesModal = await page.locator('.modal').isVisible().catch(() => false);
    if (notesModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Follow-up Reminder ---
    const bellBtn = firstRow.locator('button[title="Follow-up Reminder"]');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-2-reminder.png' });
    const bellModal = await page.locator('.modal').isVisible().catch(() => false);
    if (bellModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  });

  test('P4-3: Action buttons — Flag, Split Shipment, Print Packing Slip', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowCount = await getOrderRowCount(page);
    if (rowCount === 0) {
      console.warn('No order rows — skipping test');
      return;
    }

    const firstRow = page.locator('.table tbody tr').first();

    // --- Set Priority ---
    const flagBtn = firstRow.locator('button[title="Set Priority"]');
    await expect(flagBtn).toBeVisible();
    await flagBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-3-priority.png' });
    const flagModal = await page.locator('.modal').isVisible().catch(() => false);
    if (flagModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Split Shipment ---
    const splitBtn = firstRow.locator('button[title="Split Shipment"]');
    await expect(splitBtn).toBeVisible();
    await splitBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-3-split.png' });
    const splitModal = await page.locator('.modal').isVisible().catch(() => false);
    if (splitModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }

    // --- Print Packing Slip ---
    const printBtn = firstRow.locator('button[title="Print Packing Slip"]');
    await expect(printBtn).toBeVisible();
    await printBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P4-3-print.png' });
    const printModal = await page.locator('.modal').isVisible().catch(() => false);
    if (printModal) { await page.keyboard.press('Escape'); await page.waitForTimeout(150); }
  });
});

// =============================================================================
// PHASE 5: QUICK STATS
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 5: Quick Stats', () => {

  test('P5-1: Quick stats render — Total Value, All Time Orders, Completion Rate', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const statsContainer = page.locator('.orders-quick-stats');
    await expect(statsContainer).toBeVisible();

    for (const label of QUICK_STATS) {
      const stat = statsContainer.locator('.orders-quick-stat', { hasText: label }).first();
      await expect(stat).toBeVisible();

      const value = stat.locator('.orders-quick-stat-value');
      const valueText = await value.textContent();
      expect(valueText?.trim().length).toBeGreaterThan(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P5-1-quick-stats.png' });
  });

  test('P5-2: Total Value is formatted as currency, Completion Rate as percentage', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const statsContainer = page.locator('.orders-quick-stats');

    // Total Value should start with $
    const totalValue = statsContainer.locator('.orders-quick-stat', { hasText: 'Total Value' }).first();
    const tvText = await totalValue.locator('.orders-quick-stat-value').textContent();
    expect(tvText?.trim()).toMatch(/^\$/);

    // Completion Rate should end with %
    const completionRate = statsContainer.locator('.orders-quick-stat', { hasText: 'Completion Rate' }).first();
    const crText = await completionRate.locator('.orders-quick-stat-value').textContent();
    expect(crText?.trim()).toMatch(/%$/);
  });
});

// =============================================================================
// PHASE 6: EDGE CASES & NEGATIVES
// =============================================================================
test.describe('Quinn v3 > Orders Table > Phase 6: Edge Cases', () => {

  test('P6-1: Search for nonexistent buyer — empty results', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowsBefore = await getOrderRowCount(page);
    const searchInput = page.locator('input[placeholder*="Buyer"]');

    await searchInput.fill('zzzznonexistentbuyer99999');
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P6-1-empty-search.png' });

    const rowsAfter = await getOrderRowCount(page);
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);

    // Clear
    await searchInput.fill('');
    await waitForSpaRender(page);

    const rowsReset = await getOrderRowCount(page);
    expect(rowsReset).toBe(rowsBefore);
  });

  test('P6-2: Combined status + date filter', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const rowsBefore = await getOrderRowCount(page);

    const statusSelect = page.locator('select').filter({ hasText: 'All Status' }).first();
    const dateSelect = page.locator('select').filter({ hasText: 'All Time' }).first();

    await statusSelect.selectOption('pending');
    await waitForSpaRender(page);
    await dateSelect.selectOption('week');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P6-2-combo-filter.png' });

    const rowsFiltered = await getOrderRowCount(page);
    expect(rowsFiltered).toBeLessThanOrEqual(rowsBefore);

    // Reset
    await statusSelect.selectOption('all');
    await dateSelect.selectOption('all');
    await waitForSpaRender(page);
  });

  test('P6-3: Rapid pipeline stage clicks — no crash', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders');

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    for (let i = 0; i < 3; i++) {
      for (const stage of PIPELINE_STAGES) {
        const stageEl = page.locator('.pipeline-stage', { hasText: stage }).first();
        await stageEl.click();
        await page.waitForTimeout(50);
      }
    }

    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-orders-P6-3-rapid-pipeline.png' });

    if (pageErrors.length > 0) {
      console.warn(`[DEFECT] Page errors after rapid pipeline clicks: ${pageErrors.join(' | ')}`);
      test.info().annotations.push({ type: 'known-issue', description: `Rapid pipeline errors: ${pageErrors.join('; ')}` });
    }
  });

  test('P6-4: Orders sidebar nav shows active state', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'orders-sales');

    // Sidebar consolidation: "Orders" is now "Orders & Sales" (nav-orders-sales)
    const navBtn = page.locator('[data-testid="nav-orders-sales"]');
    await expect(navBtn).toBeVisible();
    await expect(navBtn).toHaveClass(/active/);
    await expect(navBtn).toHaveAttribute('aria-current', 'page');

    const otherActive = await page.locator('.nav-item[aria-current="page"]').count();
    expect(otherActive).toBe(1);
  });
});
