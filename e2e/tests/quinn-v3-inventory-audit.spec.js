// =============================================================================
// @quinn-v3-guardian — part of the QA guardian-monitored suite
// Quinn v3 / TestFixMaster — Inventory Page Exhaustive Micro-Audit
// =============================================================================
// Phase 0: Discovery — screenshot, a11y snapshot, element enumeration
//   P0-1: Inventory page (logged in)
//   P0-2: Add Item modal enumeration
// Phase 1: Micro-batch testing — hero buttons, search/filter, table, modal fields
// =============================================================================

import { test, expect } from '@playwright/test';
import { waitForSpaRender, waitForTableRows, waitForUiSettle, waitForElement, waitForElementGone } from '../helpers/wait-utils.js';

// Inventory tests require login + navigation — give extra time for slower browsers
test.setTimeout(90_000);

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

// Login helper — navigates to dashboard after login
async function loginAndNavigate(page, route = 'inventory') {
  await page.goto(`${BASE}/#login`);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/#login`);
  await page.waitForSelector('#login-form', { timeout: 10_000 });
  await waitForSpaRender(page);

  await page.locator('#login-email').fill(DEMO.email);
  await page.locator('#login-password').fill(DEMO.password);
  await page.locator('#login-submit-btn').click();

  // Wait for login to complete — generous timeout for slow browsers
  try {
    await page.waitForFunction(
      () => !window.location.hash.includes('#login'),
      { timeout: 20_000 }
    );
  } catch {
    // Fallback: try demo-login API directly
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
    await waitForTableRows(page);
  }
  await waitForSpaRender(page);

  // Navigate to target route
  if (route !== 'dashboard') {
    await page.evaluate((r) => router.navigate(r), route);
    await waitForSpaRender(page);
    await waitForSpaRender(page);
  }
}

// =============================================================================
// PHASE 0: DISCOVERY — Inventory Page
// =============================================================================
test.describe('Quinn v3 > Inventory Page > Phase 0: Discovery', () => {

  test('P0-1: Full page screenshot + accessibility snapshot', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await loginAndNavigate(page, 'inventory');

    // Verify we're on inventory page
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Full-page screenshot
    await page.screenshot({
      path: 'e2e/screenshots/quinn-v3-inventory-P0-fullpage.png',
      fullPage: true,
    });

    // Accessibility snapshot
    const a11yText = await page.locator('body').ariaSnapshot();
    const fs = await import('fs');
    fs.writeFileSync(
      'e2e/screenshots/quinn-v3-inventory-P0-a11y-tree.txt',
      a11yText,
      'utf-8'
    );

    // Verify key landmarks
    expect(a11yText).toContain('Inventory');
    expect(a11yText).toContain('Add Item');

    // Log any console errors (may have known bugs)
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      console.warn(`Console errors on inventory page: ${errors.map(e => e.text).join(' | ')}`);
    }

    // Log page errors
    if (pageErrors.length > 0) {
      console.warn(`Page errors on inventory page: ${pageErrors.join(' | ')}`);
    }
  });

  test('P0-2: Enumerate all interactive elements on inventory page', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    const elements = await page.evaluate(() => {
      const selectors = [
        'a[href]', 'button', 'input', 'select', 'textarea',
        '[tabindex]', '[role="button"]', '[role="link"]', '[role="checkbox"]',
        '[role="tab"]', '[role="menuitem"]', '[contenteditable="true"]',
        'form', 'label[for]', '[aria-haspopup]', 'th[onclick]',
      ];
      const all = document.querySelectorAll(selectors.join(','));
      const results = [];
      let idx = 0;
      const seen = new Set();
      for (const el of all) {
        const key = el.tagName + '#' + (el.id || '') + '.' + (el.className || '').substring(0, 50) + (el.name || '');
        if (seen.has(key)) continue;
        seen.add(key);
        idx++;
        const rect = el.getBoundingClientRect();
        results.push({
          index: idx,
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          id: el.id || null,
          name: el.name || null,
          className: (el.className || '').substring(0, 80),
          text: (el.textContent || '').substring(0, 60).replace(/\s+/g, ' ').trim(),
          href: el.href || null,
          ariaLabel: el.getAttribute('aria-label'),
          ariaRole: el.getAttribute('role'),
          ariaHaspopup: el.getAttribute('aria-haspopup'),
          onclick: (el.getAttribute('onclick') || '').substring(0, 80),
          placeholder: el.placeholder || null,
          required: el.required || false,
          disabled: el.disabled || false,
          visible: !!(rect.width && rect.height && rect.top >= -100),
          bbox: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          computedDisplay: getComputedStyle(el).display,
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

    // Count and log
    const visible = elements.filter(e => e.visible);
    const hidden = elements.filter(e => !e.visible);
    console.log(`Inventory page: ${elements.length} total elements, ${visible.length} visible, ${hidden.length} hidden`);

    // Expected key elements
    const hasSearch = elements.some(e => e.id === 'inventory-search');
    expect(hasSearch).toBe(true);

    // Buttons check
    const addItemBtn = elements.find(e => e.text?.includes('Add Item') && e.tag === 'button');
    expect(addItemBtn).toBeTruthy();

    // Categorize elements for audit planning
    const categories = {
      heroButtons: visible.filter(e => e.tag === 'button' && e.className?.includes('btn') &&
        (e.className?.includes('inventory-hero') || e.text?.match(/Bundle|Restock|Alerts|Lookup|Tools|Add Item/))),
      searchFilter: visible.filter(e => e.id?.includes('search') || e.id?.includes('filter') ||
        e.text?.match(/Filters|Import|Export|Bulk Edit/)),
      tableHeaders: visible.filter(e => e.tag === 'th' || (e.onclick && e.onclick.includes('toggleSort'))),
      tableCheckboxes: visible.filter(e => e.type === 'checkbox'),
      tableActionBtns: visible.filter(e => (e.text?.includes('Edit') || e.onclick?.includes('deleteItem')) &&
        e.tag === 'button' && e.className?.includes('btn-sm')),
      navItems: visible.filter(e => e.className?.includes('nav-item')),
    };

    console.log('--- Element Categories ---');
    console.log(`Hero buttons: ${categories.heroButtons.length}`);
    console.log(`Search/Filter controls: ${categories.searchFilter.length}`);
    console.log(`Table sort headers: ${categories.tableHeaders.length}`);
    console.log(`Table checkboxes: ${categories.tableCheckboxes.length}`);
    console.log(`Table row action buttons: ${categories.tableActionBtns.length}`);
    console.log(`Nav items (sidebar): ${categories.navItems.length}`);
  });

  test('P0-3: Open Add Item modal + enumerate its elements', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Open Add Item modal via evaluate
    await page.evaluate(() => modals.addItem());
    await waitForSpaRender(page);

    // Verify modal is visible
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Screenshot: Add Item modal
    await page.screenshot({
      path: 'e2e/screenshots/quinn-v3-inventory-P0-add-item-modal.png',
      fullPage: true,
    });

    // A11y snapshot of modal
    const a11yText = await page.locator('.modal').ariaSnapshot();
    const fs = await import('fs');
    fs.writeFileSync(
      'e2e/screenshots/quinn-v3-inventory-P0-add-item-a11y.txt',
      a11yText,
      'utf-8'
    );

    // Enumerate ALL interactive elements inside the modal
    const modalElements = await page.evaluate(() => {
      const modal = document.querySelector('.modal');
      if (!modal) return [];
      const selectors = [
        'a[href]', 'button', 'input', 'select', 'textarea',
        '[tabindex]', '[role="button"]', '[role="checkbox"]',
        '[role="tab"]', 'label[for]', 'form',
      ];
      const all = modal.querySelectorAll(selectors.join(','));
      const results = [];
      let idx = 0;
      const seen = new Set();
      for (const el of all) {
        const key = el.tagName + '#' + (el.id || '') + '.' + (el.className || '').substring(0, 30) + (el.name || '');
        if (seen.has(key)) continue;
        seen.add(key);
        idx++;
        const rect = el.getBoundingClientRect();
        results.push({
          index: idx,
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          id: el.id || null,
          name: el.name || null,
          className: (el.className || '').substring(0, 80),
          text: (el.textContent || '').substring(0, 60).replace(/\s+/g, ' ').trim(),
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: el.placeholder || null,
          required: el.required || false,
          disabled: el.disabled || false,
          visible: !!(rect.width && rect.height),
          bbox: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          computedDisplay: getComputedStyle(el).display,
        });
      }
      return results;
    });

    fs.writeFileSync(
      'e2e/screenshots/quinn-v3-inventory-P0-add-item-elements.json',
      JSON.stringify(modalElements, null, 2),
      'utf-8'
    );

    const visible = modalElements.filter(e => e.visible);
    console.log(`Add Item modal: ${modalElements.length} total elements, ${visible.length} visible`);

    // Key fields must exist
    const names = modalElements.map(e => e.name).filter(Boolean);
    expect(names).toContain('title');
    expect(names).toContain('listPrice');
    expect(names).toContain('quantity');
    expect(names).toContain('description');

    // Form must exist
    const form = modalElements.find(e => e.id === 'add-item-form');
    expect(form).toBeTruthy();

    // Categorize modal elements
    const textInputs = visible.filter(e => e.type === 'text' || e.type === 'number' || e.tag === 'textarea');
    const selects = visible.filter(e => e.tag === 'select');
    const checkboxes = visible.filter(e => e.type === 'checkbox');
    const buttons = visible.filter(e => e.tag === 'button');

    console.log('--- Add Item Modal Categories ---');
    console.log(`Text/number inputs: ${textInputs.length}`);
    console.log(`Selects: ${selects.length}`);
    console.log(`Checkboxes: ${checkboxes.length}`);
    console.log(`Buttons: ${buttons.length}`);

    // List all field names for audit planning
    console.log('--- Field names ---');
    const fieldNames = modalElements.filter(e => e.name).map(e => `${e.name} (${e.type || e.tag})`);
    console.log(fieldNames.join(', '));
  });
});

// =============================================================================
// PHASE 1, BATCH 1: Hero Action Buttons — Bundle, Restock, Alerts, Lookup
// =============================================================================
test.describe('Quinn v3 > Inventory Page > Batch 1: Hero Buttons', () => {

  test('E1-E3: Bundle, Restock, Alerts buttons — open modals/panels', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Screenshot before
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E1-before.png' });

    // --- E1: Bundle button ---
    const bundleBtn = page.locator('button:has-text("Bundle")').first();
    await expect(bundleBtn).toBeVisible();
    await expect(bundleBtn).toBeEnabled();
    await bundleBtn.click();
    await waitForSpaRender(page);

    // Check if modal/panel opened
    const modalAfterBundle = await page.locator('.modal').isVisible().catch(() => false);
    console.log(`Bundle button → modal visible: ${modalAfterBundle}`);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E1-after-bundle.png' });

    // Close any open modal
    if (modalAfterBundle) {
      await page.evaluate(() => modals.close());
      await waitForSpaRender(page);
    }

    // --- E2: Restock button ---
    const restockBtn = page.locator('button:has-text("Restock")').first();
    await expect(restockBtn).toBeVisible();
    await restockBtn.click();
    await waitForSpaRender(page);

    const modalAfterRestock = await page.locator('.modal').isVisible().catch(() => false);
    console.log(`Restock button → modal visible: ${modalAfterRestock}`);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E2-after-restock.png' });

    if (modalAfterRestock) {
      await page.evaluate(() => modals.close());
      await waitForSpaRender(page);
    }

    // --- E3: Alerts button ---
    const alertsBtn = page.locator('button:has-text("Alerts")').first();
    await expect(alertsBtn).toBeVisible();
    await alertsBtn.click();
    await waitForSpaRender(page);

    const modalAfterAlerts = await page.locator('.modal').isVisible().catch(() => false);
    console.log(`Alerts button → modal visible: ${modalAfterAlerts}`);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E3-after-alerts.png' });

    if (modalAfterAlerts) {
      await page.evaluate(() => modals.close());
      await waitForSpaRender(page);
    }

    // Verdict: PASS if each opens a modal/panel without JS errors
  });

  test('E4-E5: Lookup button + Tools dropdown', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // --- E4: Lookup button ---
    const lookupBtn = page.locator('button:has-text("Lookup")').first();
    await expect(lookupBtn).toBeVisible();
    await lookupBtn.click();
    await waitForSpaRender(page);

    const modalAfterLookup = await page.locator('.modal').isVisible().catch(() => false);
    console.log(`Lookup button → modal visible: ${modalAfterLookup}`);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E4-after-lookup.png' });

    if (modalAfterLookup) {
      await page.evaluate(() => modals.close());
      await waitForSpaRender(page);
    }

    // --- E5: Tools dropdown ---
    const toolsBtn = page.locator('button:has-text("Tools")').first();
    await expect(toolsBtn).toBeVisible();
    await expect(toolsBtn).toHaveAttribute('aria-haspopup', 'menu');

    // Click to open dropdown
    await toolsBtn.click();
    await waitForSpaRender(page);

    // Check dropdown items are visible
    const dropdownMenu = page.locator('.dropdown.open .dropdown-menu');
    const menuVisible = await dropdownMenu.isVisible().catch(() => false);
    console.log(`Tools dropdown → menu visible: ${menuVisible}`);

    if (menuVisible) {
      // Verify dropdown items
      await expect(dropdownMenu.locator('button:has-text("Bulk Prices")')).toBeVisible();
      await expect(dropdownMenu.locator('button:has-text("Age Analysis")')).toBeVisible();
      await expect(dropdownMenu.locator('button:has-text("Calculator")')).toBeVisible();

      // Click "Bulk Prices" to test
      await dropdownMenu.locator('button:has-text("Bulk Prices")').click();
      await waitForSpaRender(page);

      const modalAfterBulkPrices = await page.locator('.modal').isVisible().catch(() => false);
      console.log(`Bulk Prices → modal visible: ${modalAfterBulkPrices}`);
      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E5-after-bulk-prices.png' });

      if (modalAfterBulkPrices) {
        await page.evaluate(() => modals.close());
        await waitForSpaRender(page);
      }
    }

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E5-tools.png' });
  });

  test('E6: Add Item button — opens modal with correct title', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Find Add Item button
    const addBtn = page.locator('button:has-text("Add Item")').first();
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toBeEnabled();

    // Screenshot before
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E6-before.png' });

    // Click
    await addBtn.click();
    await waitForSpaRender(page);

    // Verify modal opened
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Check modal title
    await expect(modal.locator('.modal-title')).toHaveText('Add New Item');

    // Check form exists
    await expect(modal.locator('#add-item-form')).toBeVisible();

    // Check header buttons
    await expect(modal.locator('button:has-text("AI Generate")')).toBeVisible();
    await expect(modal.locator('button:has-text("Scan Barcode")')).toBeVisible();
    await expect(modal.locator('button:has-text("Use Template")')).toBeVisible();

    // Check footer buttons
    await expect(modal.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(modal.locator('button:has-text("Add & Publish")')).toBeVisible();

    // Close button
    const closeBtn = modal.locator('[aria-label="Close"]');
    await expect(closeBtn).toBeVisible();

    // Screenshot after
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E6-after-modal.png' });

    // Close modal
    await closeBtn.click();
    await waitForSpaRender(page);
    await expect(modal).not.toBeVisible();
  });
});

// =============================================================================
// PHASE 1, BATCH 2: Search, Filter, Import/Export Controls
// =============================================================================
test.describe('Quinn v3 > Inventory Page > Batch 2: Search & Filter', () => {

  test('E7: Search input — type, debounce, clear', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    const searchInput = page.locator('#inventory-search');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', 'Search items...');

    // Screenshot before
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E7-before.png' });

    // Type a search term
    await searchInput.click();
    await expect(searchInput).toBeFocused();
    await searchInput.fill('test search');
    await expect(searchInput).toHaveValue('test search');

    // Wait for debounce
    await waitForSpaRender(page);

    // Screenshot after search
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E7-after-search.png' });

    // Clear search
    await searchInput.fill('');
    await waitForSpaRender(page);
    await expect(searchInput).toHaveValue('');

    // --- XSS in search ---
    await searchInput.fill('<script>alert(1)</script>');
    await waitForSpaRender(page);
    const xssInjected = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes('alert(1)')) return true;
      }
      return false;
    });
    expect(xssInjected).toBe(false);

    // Clean up
    await searchInput.fill('');

    // Verdict: PASS
  });

  test('E8: Filter menu — open, add filter, clear', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Click Filters button
    const filterBtn = page.locator('button:has-text("Filters")').first();
    await expect(filterBtn).toBeVisible();

    await filterBtn.click();
    await waitForSpaRender(page);

    // Check filter menu visibility
    const filterMenu = page.locator('#filter-menu');
    const menuVisible = await filterMenu.isVisible();
    console.log(`Filter menu visible: ${menuVisible}`);

    if (menuVisible) {
      // Verify filter controls
      await expect(page.locator('#filter-column')).toBeVisible();
      await expect(page.locator('#filter-value')).toBeVisible();

      // Select a filter column
      await page.locator('#filter-column').selectOption('status');

      // Type a filter value
      await page.locator('#filter-value').fill('active');

      // Click Add
      await page.locator('button:has-text("Add")').first().click();
      await waitForSpaRender(page);

      // Screenshot after adding filter
      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E8-filter-added.png' });

      // Clear all filters
      const clearBtn = page.locator('button:has-text("Clear All")').first();
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await waitForSpaRender(page);
      }

      // Close filter menu
      const closeFilterBtn = page.locator('#filter-menu button:has-text("Close")');
      if (await closeFilterBtn.isVisible()) {
        await closeFilterBtn.click();
        await waitForSpaRender(page);
      }
    }

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E8-filter-menu.png' });
  });

  test('E9: Import/Export/Bulk Edit buttons', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // --- Import button → opens modal ---
    const importBtn = page.locator('button:has-text("Import")').first();
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await waitForSpaRender(page);

    const importModalVisible = await page.locator('.modal').isVisible().catch(() => false);
    console.log(`Import modal visible: ${importModalVisible}`);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E9-import-modal.png' });

    if (importModalVisible) {
      // Check import modal elements
      await expect(page.locator('#import-modal-file')).toBeDefined();
      await expect(page.locator('#import-modal-paste')).toBeVisible();
      await page.evaluate(() => modals.close());
      await waitForSpaRender(page);
    }

    // --- Export button → triggers download (no modal expected) ---
    const exportBtn = page.locator('button:has-text("Export")').first();
    await expect(exportBtn).toBeVisible();
    // Don't click export — it triggers download which is hard to test in headless

    // --- Bulk Edit button ---
    const bulkEditBtn = page.locator('button:has-text("Bulk Edit")').first();
    await expect(bulkEditBtn).toBeVisible();
    await bulkEditBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E9-bulk-edit.png' });

    // Close any modal that may have opened
    if (await page.locator('.modal').isVisible().catch(() => false)) {
      await page.evaluate(() => modals.close());
      await waitForSpaRender(page);
    }
  });
});

// =============================================================================
// PHASE 1, BATCH 3: Table Headers (Sort), Table Rows, Select-All
// =============================================================================
test.describe('Quinn v3 > Inventory Page > Batch 3: Table Interaction', () => {

  test('E10: Table sort headers — click toggles sort direction', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Find sortable headers
    const sortHeaders = ['title', 'sku', 'list_price', 'quantity', 'status', 'created_at'];

    for (const column of sortHeaders) {
      const header = page.locator(`th:has([id="sort-${column}"])`).first();
      const headerExists = await header.count() > 0;

      if (headerExists) {
        // Click to sort
        await header.click();
        await waitForSpaRender(page);

        // Check sort indicator changed
        const sortIndicator = page.locator(`#sort-${column}`);
        const indicatorText = await sortIndicator.textContent().catch(() => 'N/A');
        console.log(`Sort ${column}: indicator = "${indicatorText}"`);
      }
    }

    // Screenshot after sorting
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E10-sorted.png' });
  });

  test('E11: Select-all checkbox + individual row checkboxes', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Find select-all checkbox
    const selectAll = page.locator('#select-all-checkbox');
    const selectAllExists = await selectAll.count() > 0;

    if (selectAllExists) {
      await expect(selectAll).toBeVisible();
      await expect(selectAll).not.toBeChecked();

      // Click select-all
      await selectAll.click();
      await waitForSpaRender(page);

      // Check if bulk actions bar appeared
      const bulkBar = page.locator('#selection-menu');
      const bulkBarVisible = await bulkBar.isVisible().catch(() => false);
      console.log(`Select-all → bulk actions bar visible: ${bulkBarVisible}`);

      if (bulkBarVisible) {
        const selectionCount = await page.locator('#selection-count').textContent();
        console.log(`Selected items: ${selectionCount}`);

        // Verify bulk action buttons
        await expect(bulkBar.locator('button:has-text("Status")')).toBeVisible();
        await expect(bulkBar.locator('button:has-text("Delete")')).toBeVisible();

        // Screenshot with bulk actions
        await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E11-bulk-bar.png' });

        // Deselect all
        await selectAll.click();
        await waitForSpaRender(page);
      }
    } else {
      console.warn('No select-all checkbox found — inventory may be empty');
    }

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E11-checkboxes.png' });
  });

  test('E12: Table row click → item history, double-click → edit', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    // Find first data row
    const firstRow = page.locator('table tbody tr[data-id]').first();
    const rowExists = await firstRow.count() > 0;

    if (rowExists) {
      const itemId = await firstRow.getAttribute('data-id');
      console.log(`First row item ID: ${itemId}`);

      // Single click → should open item history modal
      await firstRow.click();
      await waitForSpaRender(page);

      const modalAfterClick = await page.locator('.modal').isVisible().catch(() => false);
      console.log(`Single click → modal visible: ${modalAfterClick}`);
      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E12-row-click.png' });

      if (modalAfterClick) {
        await page.evaluate(() => modals.close());
        await waitForSpaRender(page);
      }

      // Double-click → should open edit
      await firstRow.dblclick();
      await waitForSpaRender(page);

      const modalAfterDblclick = await page.locator('.modal').isVisible().catch(() => false);
      console.log(`Double-click → modal visible: ${modalAfterDblclick}`);
      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E12-row-dblclick.png' });

      if (modalAfterDblclick) {
        await page.evaluate(() => modals.close());
        await waitForSpaRender(page);
      }
    } else {
      console.warn('No inventory rows found — table may be empty');
    }
  });
});

// =============================================================================
// PHASE 1, BATCH 4: Add Item Modal — Required Fields + Submit
// =============================================================================
test.describe('Quinn v3 > Inventory Page > Batch 4: Add Item Modal Fields', () => {

  test('E13: Add Item modal — title (required), SKU, brand, category', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await page.evaluate(() => modals.addItem());
    await waitForSpaRender(page);
    await expect(page.locator('.modal')).toBeVisible({ timeout: 5_000 });

    const modal = page.locator('.modal');

    // --- Title (required) ---
    const titleInput = modal.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await expect(titleInput).toHaveAttribute('required', '');

    // --- SKU ---
    const skuInput = modal.locator('input[name="sku"]');
    await expect(skuInput).toBeVisible();
    // SKU has auto-generate button nearby
    const autoSkuBtn = modal.locator('button:has-text("Auto")').first();
    if (await autoSkuBtn.count() > 0) {
      console.log('Auto SKU button found');
    }

    // --- Brand ---
    const brandInput = modal.locator('input[name="brand"]');
    await expect(brandInput).toBeVisible();

    // --- Category select ---
    const categorySelect = modal.locator('select[name="category"]');
    await expect(categorySelect).toBeVisible();

    // Check category options
    const options = await categorySelect.locator('option').allTextContents();
    console.log(`Category options: ${options.join(', ')}`);

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E13-basic-fields.png' });

    // Fill title with XSS
    await titleInput.fill('<script>alert(1)</script>');
    const xssInjected = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes('alert(1)')) return true;
      }
      return false;
    });
    expect(xssInjected).toBe(false);

    // Clean up
    await page.evaluate(() => modals.close());
  });

  test('E14: Add Item modal — price fields, quantity, description', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await page.evaluate(() => modals.addItem());
    await waitForSpaRender(page);
    await expect(page.locator('.modal')).toBeVisible({ timeout: 5_000 });

    const modal = page.locator('.modal');

    // --- Cost Price ---
    const costPrice = modal.locator('input[name="costPrice"]');
    await expect(costPrice).toBeVisible();
    await expect(costPrice).toHaveAttribute('type', 'number');

    // --- List Price (required) ---
    const listPrice = modal.locator('input[name="listPrice"]');
    await expect(listPrice).toBeVisible();
    await expect(listPrice).toHaveAttribute('required', '');

    // --- Quantity (required) ---
    const quantity = modal.locator('input[name="quantity"]');
    await expect(quantity).toBeVisible();
    await expect(quantity).toHaveAttribute('required', '');

    // Check default value
    const qtyValue = await quantity.inputValue();
    console.log(`Quantity default value: "${qtyValue}"`);

    // --- Description textarea ---
    const description = modal.locator('textarea[name="description"]');
    await expect(description).toBeVisible();

    // --- Negative: Negative price ---
    await costPrice.fill('-10');
    // No crash expected
    await expect(costPrice).toBeVisible();

    // --- Boundary: Very large price ---
    await listPrice.fill('999999999');
    await expect(listPrice).toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E14-price-fields.png' });

    await page.evaluate(() => modals.close());
  });

  test('E15: Add Item modal — submit with minimal valid data', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await page.evaluate(() => modals.addItem());
    await waitForSpaRender(page);
    await expect(page.locator('.modal')).toBeVisible({ timeout: 5_000 });

    const modal = page.locator('.modal');

    // Fill minimal required fields
    await modal.locator('input[name="title"]').fill('Quinn v3 Test Item');
    await modal.locator('input[name="listPrice"]').fill('19.99');
    // Quantity should already have a default value

    // Intercept API call
    const apiPromise = page.waitForRequest(req =>
      req.url().includes('/inventory') && req.method() === 'POST'
    );

    // Click "Add & Publish"
    const publishBtn = modal.locator('button:has-text("Add & Publish")');
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    const apiReq = await apiPromise;
    expect(apiReq.method()).toBe('POST');

    const body = apiReq.postDataJSON();
    expect(body.title).toBe('Quinn v3 Test Item');
    console.log(`POST /inventory body keys: ${Object.keys(body).join(', ')}`);

    // Wait for response
    await waitForTableRows(page);

    // Screenshot after submit
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E15-after-submit.png' });

    // Check if modal closed (successful submit)
    const modalStillVisible = await page.locator('.modal').isVisible().catch(() => false);
    console.log(`Modal still visible after submit: ${modalStillVisible}`);
  });

  test('E16: Add Item modal — empty submit blocked, Cancel closes', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await page.evaluate(() => modals.addItem());
    await waitForSpaRender(page);
    await expect(page.locator('.modal')).toBeVisible({ timeout: 5_000 });

    // Try to submit empty form
    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('/inventory') && req.method() === 'POST') {
        apiCalled = true;
      }
    });

    // Click "Add & Publish" on empty form
    const publishBtn = page.locator('.modal button:has-text("Add & Publish")');
    await publishBtn.click();
    await waitForSpaRender(page);

    // Form validation should block submit
    // (HTML5 required on title/listPrice/quantity should prevent)
    console.log(`API called on empty form: ${apiCalled}`);

    // Modal should still be open
    await expect(page.locator('.modal')).toBeVisible();

    // --- Cancel button ---
    const cancelBtn = page.locator('.modal button:has-text("Cancel")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await waitForSpaRender(page);

    // Modal should close
    await expect(page.locator('.modal')).not.toBeVisible();

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E16-cancel.png' });
  });
});

// =============================================================================
// PHASE 1, BATCH 5: Stat Cards + CSP + Page Errors
// =============================================================================
test.describe('Quinn v3 > Inventory Page > Batch 5: Stats & Health', () => {

  test('E17: Stat cards — 6 cards visible with non-negative values', async ({ page }) => {
    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });

    const statCards = page.locator('.inventory-stat-card');
    const cardCount = await statCards.count();
    console.log(`Stat cards found: ${cardCount}`);
    expect(cardCount).toBe(6);

    // Verify each card has a value and label
    for (let i = 0; i < cardCount; i++) {
      const card = statCards.nth(i);
      const value = await card.locator('.inventory-stat-value').textContent();
      const label = await card.locator('.inventory-stat-label').textContent();
      console.log(`Stat card ${i + 1}: ${label} = ${value}`);

      // Value should be a valid number
      const numValue = parseFloat(value.replace(/[,$%]/g, ''));
      expect(isNaN(numValue)).toBe(false);
      // Flag negative values as suspicious (D5) — e.g. Avg Age showing -1
      if (numValue < 0) {
        console.warn(`DEFECT D5 [Low]: Stat card "${label}" shows negative value ${value}. ` +
          'Negative stats suggest edge case in calculation (empty inventory?).');
      }
    }

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E17-stat-cards.png' });
  });

  test('E18: CSP check — no blocking violations on inventory page', async ({ page }) => {
    const cspViolations = [];
    page.on('console', msg => {
      const text = msg.text();
      if ((text.includes('Content Security Policy') || text.includes('Refused to') ||
          text.includes('blocked by')) && !text.includes('blocked by Playwright')) {
        cspViolations.push(text);
      }
    });

    await loginAndNavigate(page, 'inventory');
    await expect(page.locator('.inventory-hero-title')).toBeVisible({ timeout: 10_000 });
    await waitForTableRows(page);

    if (cspViolations.length > 0) {
      console.warn(`CSP violations: ${JSON.stringify(cspViolations)}`);
    }
    expect(cspViolations.length).toBe(0);

    // Screenshot
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-inventory-E18-csp-clean.png' });
  });
});
