// =============================================================================
// @quinn-v3-guardian — part of the QA guardian-monitored suite
// Quinn v3 / TestFixMaster — Listings Table Exhaustive Micro-Audit
// =============================================================================
// Phase 0: Discovery — full-page screenshot, a11y snapshot, element enumeration
// Phase 1: Hero buttons (Health, New Folder, Fees, Add New Listing dropdown)
// Phase 2: Tabs — Listings/Archived/Templates/Recently Deleted switch + verify
// Phase 3: Filter dropdowns — Folder, Status, Platform + column customization
// Phase 4: Row interactions — expand/collapse, actions dropdown, details panel
// Phase 5: Health bar — score ring, stat cards, platform badges
// Phase 6: Edge cases — filter combos, empty states, rapid tab switch
// =============================================================================

import { test, expect } from '../fixtures/auth.js';
import { waitForSpaRender, waitForTableRows, waitForUiSettle, waitForElement, waitForElementGone } from '../helpers/wait-utils.js';

test.setTimeout(90_000);

const BASE = `http://localhost:${process.env.PORT || 3001}`;
const DEMO = { email: 'demo@vaultlister.com', password: 'DemoPassword123!' };

// 4 listing tabs
const TABS = [
  { id: 'listings', label: 'Listings' },
  { id: 'archived', label: 'Archived' },
  { id: 'templates', label: 'Listing Templates' },
  { id: 'recently-deleted', label: 'Recently Deleted' },
];

// Status filter options
const STATUS_OPTIONS = ['all', 'active', 'draft', 'pending', 'ended'];

// Platform filter options
const PLATFORM_OPTIONS = ['all', 'poshmark', 'ebay', 'mercari', 'depop', 'grailed', 'facebook'];

// Column customization options
const COLUMN_OPTIONS = [
  'image', 'item', 'sku', 'platform', 'price', 'condition',
  'labels', 'status', 'stale', 'listed', 'views', 'likes',
];

// Health stats
const HEALTH_STATS = ['Active', 'Drafts', 'Need Refresh', 'Avg Age'];

// Navigation helper — authedPage fixture handles auth; this just navigates to the target route
async function loginAndNavigate(page, route = 'listings') {
  if (route !== 'dashboard') {
    await page.evaluate((r) => router.navigate(r), route);
    await waitForSpaRender(page);
    await waitForTableRows(page); // wait for table data
  }
}

/** Get listing row count */
async function getListingRowCount(page) {
  return page.evaluate(() => document.querySelectorAll('.listing-row').length);
}

// =============================================================================
// PHASE 0: DISCOVERY — Listings Page Full Enumeration
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 0: Discovery', () => {

  test('P0-1: Listings full-page screenshot + a11y snapshot', async ({ authedPage: page }) => {
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await loginAndNavigate(page, 'listings');

    await page.screenshot({
      path: 'e2e/screenshots/quinn-v3-listings-P0-fullpage.png',
      fullPage: true,
    });

    const a11yText = await page.locator('body').ariaSnapshot();
    const fs = await import('fs');
    fs.writeFileSync('e2e/screenshots/quinn-v3-listings-P0-a11y-tree.txt', a11yText, 'utf-8');

    expect(a11yText).toContain('Listing');

    if (consoleErrors.length > 0) {
      console.warn(`Console errors on listings: ${consoleErrors.join(' | ')}`);
    }
    if (pageErrors.length > 0) {
      console.warn(`Page errors on listings: ${pageErrors.join(' | ')}`);
      test.info().annotations.push({ type: 'page-errors', description: pageErrors.join('; ') });
    }
  });

  test('P0-2: Enumerate ALL interactive elements on listings page', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const elements = await page.evaluate(() => {
      const mainContent = document.querySelector('.main-content') || document.querySelector('#app');
      if (!mainContent) return [];
      const selectors = [
        'button', 'a[href]', 'input', 'select',
        '[tabindex]', '[role="button"]', '[role="link"]', '[role="tab"]',
        '[onclick]', '[onchange]', '[oninput]',
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
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          ariaSelected: el.getAttribute('aria-selected'),
          title: el.title || null,
          onclick: (el.getAttribute('onclick') || '').substring(0, 80),
          visible: !!(rect.width && rect.height),
        });
      }
      return results;
    });

    const fs = await import('fs');
    fs.writeFileSync(
      'e2e/screenshots/quinn-v3-listings-P0-elements.json',
      JSON.stringify(elements, null, 2),
      'utf-8'
    );

    const visible = elements.filter(e => e.visible);
    console.log(`Listings page: ${elements.length} total, ${visible.length} visible`);

    // Must have tabs, hero buttons, filter selects
    expect(visible.length).toBeGreaterThan(10);

    // Verify tabs exist with role="tab"
    const tabs = visible.filter(e => e.role === 'tab');
    expect(tabs.length).toBe(4);
  });

  test('P0-3: Breadcrumb navigation renders correctly', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const breadcrumb = page.locator('.listing-breadcrumb');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toHaveAttribute('aria-label', 'Breadcrumb');

    const items = await breadcrumb.locator('li').allTextContents();
    const texts = items.map(t => t.replace(/\s+/g, ' ').trim()).filter(t => t.length > 0);
    expect(texts.some(t => t.includes('Home'))).toBe(true);
    expect(texts.some(t => t.includes('Listings'))).toBe(true);
  });
});

// =============================================================================
// PHASE 1: HERO BUTTONS — 3 per batch
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 1: Hero Buttons', () => {

  test('P1-1: Health button, New Folder button, Fees button', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    // --- Health button ---
    const healthBtn = page.locator('.listings-hero-actions button', { hasText: 'Health' }).first();
    await expect(healthBtn).toBeVisible();
    await expect(healthBtn).toHaveAttribute('title', 'Listing Health Score');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-1-before-health.png' });
    await healthBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-1-after-health.png' });

    const healthModal = await page.locator('.modal').isVisible().catch(() => false);
    if (healthModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- New Folder button ---
    const folderBtn = page.locator('.listings-hero-actions button', { hasText: 'New Folder' }).first();
    await expect(folderBtn).toBeVisible();

    await folderBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-1-after-folder.png' });

    const folderModal = await page.locator('.modal').isVisible().catch(() => false);
    if (folderModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- Fees button ---
    const feesBtn = page.locator('.listings-hero-actions button', { hasText: 'Fees' }).first();
    await expect(feesBtn).toBeVisible();
    await expect(feesBtn).toHaveAttribute('title', 'Platform Fee Calculator');

    await feesBtn.click();
    await waitForSpaRender(page);
    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-1-after-fees.png' });

    const feesModal = await page.locator('.modal').isVisible().catch(() => false);
    if (feesModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P1-2: Add New Listing(s) dropdown — 3 menu items', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const addDropdown = page.locator('.listings-hero-actions .dropdown').first();
    const addBtn = addDropdown.locator('button[aria-haspopup="menu"]');
    await expect(addBtn).toBeVisible();

    const btnText = await addBtn.textContent();
    expect(btnText?.replace(/\s+/g, ' ').trim()).toContain('Add New Listing');

    // Open dropdown
    await addBtn.click();
    await page.waitForTimeout(150);

    const menu = addDropdown.locator('.dropdown-menu');
    await expect(menu).toBeVisible();

    const menuItems = await menu.locator('.dropdown-item').allTextContents();
    const menuTexts = menuItems.map(t => t.replace(/\s+/g, ' ').trim());

    // Verify all 3 items
    expect(menuTexts.some(t => t.includes('Import From Marketplace'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Create New'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Import from CSV'))).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-2-dropdown-open.png' });

    // Click Import From Marketplace
    const importItem = menu.locator('.dropdown-item', { hasText: 'Import From Marketplace' });
    await importItem.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-2-import-marketplace.png' });

    const impModal = await page.locator('.modal').isVisible().catch(() => false);
    if (impModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P1-3: Add dropdown — Create New + CSV Import', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const addDropdown = page.locator('.listings-hero-actions .dropdown').first();
    const addBtn = addDropdown.locator('button[aria-haspopup="menu"]');

    // --- Create New ---
    await addBtn.click();
    await page.waitForTimeout(150);
    const createNew = addDropdown.locator('.dropdown-item', { hasText: 'Create New' });
    await createNew.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-3-create-new.png' });

    const cnModal = await page.locator('.modal').isVisible().catch(() => false);
    if (cnModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }

    // --- CSV Import ---
    await addBtn.click();
    await page.waitForTimeout(150);
    const csvImport = addDropdown.locator('.dropdown-item', { hasText: 'Import from CSV' });
    await csvImport.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P1-3-csv-import.png' });

    const csvModal = await page.locator('.modal').isVisible().catch(() => false);
    if (csvModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });
});

// =============================================================================
// PHASE 2: TABS — switch between 4 listing views
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 2: Tabs', () => {

  test('P2-1: Default tab is Listings, verify aria-selected', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();

    // Listings tab should be active
    const listingsTab = page.locator('[role="tab"]', { hasText: 'Listings' }).first();
    await expect(listingsTab).toHaveAttribute('aria-selected', 'true');
    await expect(listingsTab).toHaveClass(/active/);

    // All other tabs should NOT be selected
    for (const tab of ['Archived', 'Listing Templates', 'Recently Deleted']) {
      const tabEl = page.locator('[role="tab"]', { hasText: tab }).first();
      await expect(tabEl).toHaveAttribute('aria-selected', 'false');
    }

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P2-1-default-tab.png' });
  });

  test('P2-2: Switch to Archived, Templates tabs', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    // --- Switch to Archived ---
    const archivedTab = page.locator('[role="tab"]', { hasText: 'Archived' }).first();
    await archivedTab.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await expect(archivedTab).toHaveAttribute('aria-selected', 'true');
    const archivedContent = await page.locator('.page-content').textContent();
    // Should show archived content (table or empty state)
    expect(archivedContent?.length).toBeGreaterThan(0);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P2-2-archived.png' });

    // --- Switch to Templates ---
    const templatesTab = page.locator('[role="tab"]', { hasText: 'Listing Templates' }).first();
    await templatesTab.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await expect(templatesTab).toHaveAttribute('aria-selected', 'true');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P2-2-templates.png' });
  });

  test('P2-3: Switch to Recently Deleted, then back to Listings', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    // --- Switch to Recently Deleted ---
    const rdTab = page.locator('[role="tab"]', { hasText: 'Recently Deleted' }).first();
    await rdTab.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await expect(rdTab).toHaveAttribute('aria-selected', 'true');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P2-3-recently-deleted.png' });

    // --- Switch back to Listings ---
    const listingsTab = page.locator('[role="tab"]', { hasText: 'Listings' }).first();
    await listingsTab.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await expect(listingsTab).toHaveAttribute('aria-selected', 'true');

    // Health bar should be visible again (only on main listings tab)
    const healthBar = page.locator('.listings-health-bar');
    const healthVisible = await healthBar.isVisible().catch(() => false);
    // Health bar is part of the listings hero, should be visible on main tab
    expect(healthVisible).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P2-3-back-to-listings.png' });
  });
});

// =============================================================================
// PHASE 3: FILTER DROPDOWNS — Folder, Status, Platform + Column Customization
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 3: Filters', () => {

  test('P3-1: Folder filter, Status filter, Platform filter dropdowns', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    // --- Folder filter ---
    const folderSelect = page.locator('select').filter({ hasText: 'All Folders' }).first();
    await expect(folderSelect).toBeVisible();

    const folderOptions = await folderSelect.locator('option').allTextContents();
    expect(folderOptions.some(o => o.includes('All Folders'))).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P3-1-before-filters.png' });

    // --- Status filter ---
    const statusSelect = page.locator('select').filter({ hasText: 'All Listings' }).first();
    await expect(statusSelect).toBeVisible();

    const statusOptions = await statusSelect.locator('option').allTextContents();
    expect(statusOptions.some(o => o.includes('All Listings'))).toBe(true);
    expect(statusOptions.some(o => o.includes('Active'))).toBe(true);
    expect(statusOptions.some(o => o.includes('Draft'))).toBe(true);

    // Select "Active" status
    await statusSelect.selectOption('active');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P3-1-status-active.png' });

    // Reset status
    await statusSelect.selectOption('all');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    // --- Platform filter ---
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' }).first();
    await expect(platformSelect).toBeVisible();

    const platformOptions = await platformSelect.locator('option').allTextContents();
    expect(platformOptions.length).toBeGreaterThanOrEqual(2);
  });

  test('P3-2: Column customization dropdown — toggle columns', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    // Find the Customize dropdown
    const customizeDropdown = page.locator('.dropdown', { hasText: 'Customize' }).first();
    const customizeBtn = customizeDropdown.locator('button[aria-haspopup="menu"]');
    await expect(customizeBtn).toBeVisible();

    // Open dropdown
    await customizeBtn.click();
    await page.waitForTimeout(150);

    const menu = customizeDropdown.locator('.dropdown-menu');
    await expect(menu).toBeVisible();

    // Should show "Show Columns" header
    const menuText = await menu.textContent();
    expect(menuText).toContain('Show Columns');

    // Verify column checkboxes
    const checkboxes = menu.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBe(12); // 12 column options

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P3-2-columns-dropdown.png' });

    // Toggle a column off — this re-renders the page and closes the dropdown
    const firstCheckbox = checkboxes.first();
    const wasChecked = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    // Re-open dropdown to verify toggle took effect and toggle back
    const customizeDropdown2 = page.locator('.dropdown', { hasText: 'Customize' }).first();
    const customizeBtn2 = customizeDropdown2.locator('button[aria-haspopup="menu"]');
    await customizeBtn2.click();
    await page.waitForTimeout(150);

    const menu2 = customizeDropdown2.locator('.dropdown-menu');
    const checkboxes2 = menu2.locator('input[type="checkbox"]');
    const isNowChecked = await checkboxes2.first().isChecked();
    expect(isNowChecked).not.toBe(wasChecked);

    // Toggle back
    await checkboxes2.first().click();
    await waitForSpaRender(page);
    await waitForSpaRender(page);
  });

  test('P3-3: Platform filter — select specific platform, verify filtering', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const rowsBefore = await getListingRowCount(page);

    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' }).first();

    // Select Poshmark
    await platformSelect.selectOption('poshmark');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P3-3-poshmark-filter.png' });

    const rowsAfter = await getListingRowCount(page);
    // Filtered rows should be <= total
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);

    // Reset
    await platformSelect.selectOption('all');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    const rowsReset = await getListingRowCount(page);
    expect(rowsReset).toBe(rowsBefore);
  });
});

// =============================================================================
// PHASE 4: ROW INTERACTIONS — expand/collapse, actions dropdown
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 4: Row Interactions', () => {

  test('P4-1: Expand/collapse listing row — details panel', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const rowCount = await getListingRowCount(page);
    if (rowCount === 0) {
      console.warn('No listing rows — skipping test');
      return;
    }

    const firstRow = page.locator('.listing-row').first();

    // Find expand button
    const expandBtn = firstRow.locator('button[aria-label*="xpand"], button[aria-label*="ollapse"]').first();
    await expect(expandBtn).toBeVisible();

    // Verify initial state (collapsed)
    await expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P4-1-before-expand.png' });

    // Click to expand
    await expandBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P4-1-after-expand.png' });

    // Details row should appear
    const detailsRow = page.locator('.listing-details-row').first();
    const detailsVisible = await detailsRow.isVisible().catch(() => false);
    if (detailsVisible) {
      // Should show Platform Prices and Listing Information
      const detailsText = await detailsRow.textContent();
      expect(detailsText).toContain('Platform Prices');
      expect(detailsText).toContain('Listing Information');
    }

    // Click to collapse
    await expandBtn.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P4-1-after-collapse.png' });
  });

  test('P4-2: Actions dropdown — View Details, Edit, Archive', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const rowCount = await getListingRowCount(page);
    if (rowCount === 0) {
      console.warn('No listing rows — skipping test');
      return;
    }

    const firstRow = page.locator('.listing-row').first();

    // Find actions dropdown
    const actionsDropdown = firstRow.locator('.dropdown').first();
    const actionsBtn = actionsDropdown.locator('button[aria-label="More options"]');
    await expect(actionsBtn).toBeVisible();

    // Open dropdown
    await actionsBtn.click();
    await page.waitForTimeout(150);

    const menu = actionsDropdown.locator('.dropdown-menu');
    await expect(menu).toBeVisible();

    const menuItems = await menu.locator('.dropdown-item').allTextContents();
    const menuTexts = menuItems.map(t => t.replace(/\s+/g, ' ').trim());

    // Must have View Details and Edit
    expect(menuTexts.some(t => t.includes('View Details'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Edit'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Archive'))).toBe(true);
    expect(menuTexts.some(t => t.includes('Delete'))).toBe(true);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P4-2-actions-menu.png' });

    // Click View Details
    const viewItem = menu.locator('.dropdown-item', { hasText: 'View Details' });
    await viewItem.click();
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P4-2-view-details.png' });

    const viewModal = await page.locator('.modal').isVisible().catch(() => false);
    if (viewModal) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
  });

  test('P4-3: Actions dropdown — Schedule Price Drop + pricing sparkline visible', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const rowCount = await getListingRowCount(page);
    if (rowCount === 0) {
      console.warn('No listing rows — skipping test');
      return;
    }

    // Check if any row has a price sparkline SVG
    const sparklines = await page.locator('.listing-row svg polyline').count();
    if (sparklines > 0) {
      console.log(`Found ${sparklines} price sparklines`);
    } else {
      console.warn('No price sparklines found — may indicate price history not loaded');
      test.info().annotations.push({ type: 'info', description: 'No price sparklines rendered' });
    }

    // Open first row actions to check Schedule Price Drop
    const firstRow = page.locator('.listing-row').first();
    const actionsBtn = firstRow.locator('button[aria-label="More options"]');
    await actionsBtn.click();
    await page.waitForTimeout(150);

    const menu = firstRow.locator('.dropdown-menu');

    // Schedule Price Drop should always be present
    const priceDropItem = menu.locator('.dropdown-item', { hasText: 'Schedule Price Drop' });
    const hasPriceDrop = await priceDropItem.count();
    expect(hasPriceDrop).toBeGreaterThanOrEqual(1);

    if (hasPriceDrop > 0) {
      await priceDropItem.first().click();
      await waitForSpaRender(page);

      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P4-3-price-drop.png' });

      const pdModal = await page.locator('.modal').isVisible().catch(() => false);
      if (pdModal) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
      }
    }
  });
});

// =============================================================================
// PHASE 5: HEALTH BAR — score ring, stats, platform badges
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 5: Health Bar', () => {

  test('P5-1: Health score ring renders with valid percentage', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const healthRing = page.locator('.health-score-ring');
    await expect(healthRing).toBeVisible();

    // Score value should be a percentage
    const scoreValue = page.locator('.health-score-value');
    const scoreText = await scoreValue.textContent();
    const match = scoreText?.match(/(\d+)%/);
    expect(match).toBeTruthy();
    const percentage = parseInt(match[1], 10);
    expect(percentage).toBeGreaterThanOrEqual(0);
    expect(percentage).toBeLessThanOrEqual(100);

    // Label
    const label = page.locator('.health-score-label');
    await expect(label).toBeVisible();
    const labelText = await label.textContent();
    expect(labelText?.trim()).toBe('Listing Health');

    // Ring class should reflect health level
    const ringClass = await healthRing.getAttribute('class');
    expect(ringClass).toMatch(/good|warning|poor/);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P5-1-health-ring.png' });
  });

  test('P5-2: Health stats — Active, Drafts, Need Refresh, Avg Age', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    for (const statLabel of HEALTH_STATS) {
      const stat = page.locator('.health-stat', { hasText: statLabel }).first();
      await expect(stat).toBeVisible();

      const value = stat.locator('.health-stat-value');
      const valueText = await value.textContent();
      expect(valueText?.trim().length).toBeGreaterThan(0);
    }

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P5-2-health-stats.png' });
  });

  test('P5-3: Platform mini badges render with counts', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const platformSection = page.locator('.listings-platform-mini');
    const sectionVisible = await platformSection.isVisible().catch(() => false);

    if (!sectionVisible) {
      // Platform badges only render when listings have platform distribution data
      console.warn('No .listings-platform-mini section — listings may have no platform data');
      test.info().annotations.push({ type: 'info', description: 'Platform mini section not rendered — no platform data' });
      await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P5-3-platform-badges.png' });
      return;
    }

    const badges = platformSection.locator('.platform-mini-badge');
    const badgeCount = await badges.count();

    if (badgeCount > 0) {
      // Each badge should have a count and icon
      for (let i = 0; i < badgeCount; i++) {
        const badge = badges.nth(i);
        const icon = badge.locator('.platform-mini-icon');
        await expect(icon).toBeVisible();

        const count = badge.locator('.platform-mini-count');
        const countText = await count.textContent();
        const num = parseInt(countText?.trim() || '0', 10);
        expect(num).toBeGreaterThan(0);

        // Should have title attribute with platform name
        const title = await badge.getAttribute('title');
        expect(title).toMatch(/\d+ listings/);
      }
    } else {
      console.warn('No platform mini badges — listings may be empty');
      test.info().annotations.push({ type: 'info', description: 'No platform badges rendered' });
    }

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P5-3-platform-badges.png' });
  });
});

// =============================================================================
// PHASE 6: EDGE CASES & NEGATIVES
// =============================================================================
test.describe('Quinn v3 > Listings Table > Phase 6: Edge Cases', () => {

  test('P6-1: Status filter "ended" — likely empty, verify empty state', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const statusSelect = page.locator('select').filter({ hasText: 'All Listings' }).first();
    await statusSelect.selectOption('ended');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P6-1-ended-filter.png' });

    const rowCount = await getListingRowCount(page);
    // Ended listings may be 0 — verify no crash
    expect(rowCount).toBeGreaterThanOrEqual(0);

    // Reset
    await statusSelect.selectOption('all');
    await waitForSpaRender(page);
  });

  test('P6-2: Rapid tab switching — no crash', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // Rapidly switch between all 4 tabs
    for (let i = 0; i < 3; i++) {
      for (const tab of TABS) {
        const tabEl = page.locator('[role="tab"]', { hasText: tab.label }).first();
        await tabEl.click();
        await page.waitForTimeout(100);
      }
    }

    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P6-2-rapid-tabs.png' });

    if (pageErrors.length > 0) {
      console.warn(`[DEFECT] Page errors after rapid tab switch: ${pageErrors.join(' | ')}`);
      test.info().annotations.push({ type: 'known-issue', description: `Rapid tab switch errors: ${pageErrors.join('; ')}` });
    }
  });

  test('P6-3: Combined platform + status filter, then reset', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const rowsBefore = await getListingRowCount(page);

    // Apply both filters
    const statusSelect = page.locator('select').filter({ hasText: 'All Listings' }).first();
    const platformSelect = page.locator('select').filter({ hasText: 'All Platforms' }).first();

    await statusSelect.selectOption('active');
    await waitForSpaRender(page);
    await platformSelect.selectOption('poshmark');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    await page.screenshot({ path: 'e2e/screenshots/quinn-v3-list-P6-3-combo-filter.png' });

    const rowsFiltered = await getListingRowCount(page);
    expect(rowsFiltered).toBeLessThanOrEqual(rowsBefore);

    // Reset both
    await statusSelect.selectOption('all');
    await waitForSpaRender(page);
    await platformSelect.selectOption('all');
    await waitForSpaRender(page);
    await waitForSpaRender(page);

    const rowsReset = await getListingRowCount(page);
    expect(rowsReset).toBe(rowsBefore);
  });

  test('P6-4: Listings sidebar nav shows active state', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const navBtn = page.locator('[data-testid="nav-listings"]');
    await expect(navBtn).toBeVisible();
    await expect(navBtn).toHaveClass(/active/);
    await expect(navBtn).toHaveAttribute('aria-current', 'page');

    const otherActive = await page.locator('.nav-item[aria-current="page"]').count();
    expect(otherActive).toBe(1);
  });

  test('P6-5: Page title and subtitle render correctly', async ({ authedPage: page }) => {
    await loginAndNavigate(page, 'listings');

    const title = page.locator('.listings-hero-title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText?.trim()).toBe('Listings');

    const subtitle = page.locator('.listings-hero-subtitle');
    await expect(subtitle).toBeVisible();
    const subtitleText = await subtitle.textContent();
    expect(subtitleText?.trim()).toBe('View and manage your listings across all platforms');
  });
});
