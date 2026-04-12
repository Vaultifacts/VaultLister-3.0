# UI Restructure — Manual Review Items
**Date:** 2026-04-12 | **Source:** WALKTHROUGH_MASTER_FINDINGS.md → Manual Review section

## Overview
22 UI/UX changes identified during manual inspection of the live app. Grouped into 7 sequential implementation phases, each targeting a specific source file or area. All changes are removal, reorder, migration, or merge operations — no new backend routes required.

---

## Phase 1 — Sidebar + Header (`components.js`)

**Sidebar nav restructure:**
- Remove `{ id: 'community', ... }` and `{ id: 'roadmap', ... }` from the "Manage" `navItems` section
- Add them to the bottom divider section alongside Settings, Help, Changelog (after Changelog, before Admin)
- Remove `{ id: 'receipt-parser', label: 'Receipts', ... }` from "Manage" section entirely
- Change `help-support` label from `'Help'` to `'Get Help'`

**"Learn more" button:**
- In the sidebar footer (bottom section), after the "Get Help" nav item renders, add a small "Learn more" button that navigates to `help-support` (or opens a help modal if one exists). Style consistently with sidebar footer links.

**Focus Mode removal:**
- Remove the Focus Mode `<button>` from `header()` in `components.js` (line ~329)
- Leave `focusMode` object in `init.js` intact (no-op if button is gone); no CSS changes needed

---

## Phase 2 — Settings Page + SUPPORTED_PLATFORMS (`pages-settings-account.js`, `utils.js`)

### Settings tab: "Account" (replaces "Profile")
- Change tab button label from "Profile" to "Account" and `settingsTab` value from `'profile'` to `'account'`
- Remove the separate "Account" link button that navigates away via `router.navigate('account')`
- Tab content: render the Account page sections inline (Profile card, Connected Accounts, Sessions & Security, Account Activity, Account Usage, Danger Zone)
- Merge any Profile-tab-only fields not already present in Account page: avatar upload, password change form

### Settings tab: "Plans & Billing" (replaces "Billing")
- Change tab button label from "Billing" to "Plans & Billing" and `settingsTab` value from `'billing'` to `'plans-billing'`
- Tab content: render the full Plans & Billing pricing UI inline (billing period toggle, plan cards, billing history, comparison table) — same content as `plansBilling()` page

### Appearance tab: remove Accent Color
- Delete the entire `<div class="settings-section">` block containing "Accent Color" and `accent-colors` (lines ~907–919)

### Appearance tab: remove Display (Density + Font Size)
- Delete the "Display" `<div class="settings-section">` block containing the Density and Font Size selects (lines ~921–941)

### My Shops — SUPPORTED_PLATFORMS reorder (`utils.js`)
- Move `{ id: 'shopify', ... }` to appear before `{ id: 'mercari', ... }` in the `SUPPORTED_PLATFORMS` array
- New order: poshmark, ebay, depop, facebook, whatnot, **shopify**, mercari, grailed, etsy

---

## Phase 3 — Analytics Page (`pages-core.js`)

Current tabs: live, graphs, performance, heatmaps, predictions, reports, ratio-analysis, profitability-analysis, product-analysis, market-intel, sourcing

**Add 4 new tabs** (append to tab bar, add switch cases in the render block):

### "Financials Analytics" tab
Content migrated from `financials()` in `pages-sales-orders.js`:
- Profit Margin gauge card
- Cash Flow Breakdown bar chart
- Financial Ratios cards (Gross Margin, Current Ratio, Debt-to-Equity)
- Budget Progress card

### "Sales" tab
Content: the `salesTabContent` variable already computed in `analytics()` — just add the tab button and wire the switch case.

### "Inventory" tab
Content: inventory turnover rate, stock status breakdown (In Stock / Low Stock / Out of Stock counts), Inventory Aging summary (pull from `store.state.inventoryAnalytics` or compute inline from `store.state.inventory`).

### "Purchases" tab
Content: COGS total, sourcing spend by platform, purchase count — computed inline from `store.state.purchases || []`.

---

## Phase 4 — Sales / Orders / Financials (`pages-sales-orders.js`)

### `orders()` — tab reorder + Shipping tab
- Change tab bar order to: Offers (1st), Orders (2nd), Shipping (3rd)
- `ordersMainTab` default changes to `'offers'`
- Tab switch: `offers` → `offersContent()`, `orders` → existing orders table HTML, `shipping` → embed `shippingLabelsPage()` content inline (the Labels/Addresses/Batches sub-tabs and their content)

### `sales()` (Purchases tab) — remove Sourcing Platforms
- Delete the Sourcing Platforms `<div class="card">` block (title "Sourcing Platforms", AliExpress + Alibaba connect buttons) from the Purchases tab render — lines ~674–700
- Keep the existing "Connect Sourcing" dropdown button that already exists above Purchase History

### `reports()` — remove empty-state button
- In the `reports()` empty state (`No custom reports yet`), remove the `<button class="btn btn-primary" onclick="handlers.createReport()">Create Report</button>` at line ~3496 (currently labeled "Create Report" in code; image-5 shows an earlier label of "New Report")
- Keep the working "New Report" button in the page header (line ~3457) — that one is the functional one

### `financials()` — restructure
**Current layout (verified):** Four always-visible cards (Profit Margin gauge, Cash Flow Breakdown, Financial Ratios, Budget Progress) sit ABOVE the tab bar. The tab bar has: Chart of Accounts | Financial Statements | P&L. Below the tab content: Tax Estimate Calculator (line ~1861), then Expense Categories (line ~2054), then Bank Reconciliation (line ~2088) — all currently rendered outside any tab.

**Changes:**
- **Remove** the four always-visible cards (Profit Margin gauge, Cash Flow Breakdown, Financial Ratios, Budget Progress) — lines ~1803–1851 — they move to Analytics Phase 3
- **Add "Tax Preparation" tab** to the existing tab bar: move Tax Estimate Calculator content into it (Filing Status, Gross Income, Deductions, Self-Employment Income, Calculate Estimate button)
- **Add "Bank Reconciliation" tab** to the existing tab bar: move Bank Reconciliation content into it (Bank Balance, Book Balance, Difference cards, Unmatched Transactions, Start Reconciliation button)
- **Remove Expense Categories** card entirely (line ~2054) — not migrated anywhere
- Resulting tab bar: Chart of Accounts | Financial Statements | P&L | Tax Preparation | Bank Reconciliation

---

## Phase 5 — Inventory + Listings (`pages-inventory-catalog.js`)

### Inventory page — remove tab bar
- Remove the `<div>` containing `inv-tab-btn` buttons for Catalog and Analytics
- Remove the `<div class="inv-tab-pane" data-tab="analytics">` wrapper
- The catalog content (`inv-tab-pane active` data-tab="catalog") renders directly, without any tab wrapper

### Listings page — Import dropdown button
- Add an Import dropdown button to the Listings page header actions (alongside existing buttons)
- Dropdown items: "Import from CSV" → `modals.showInventoryImport()`, "Import from Platform" → `modals.showInventoryImport()` (same modal handles both)
- Reuse the existing `modals.showInventoryImport()` — no new modal needed

### Sidebar: remove Import link
- Remove `{ id: 'inventory-import', label: 'Import', ... }` from the "Manage" sidebar section in `components.js` (Phase 1 above handles this)

---

## Phase 6 — Help Page (`pages-community-help.js`)

- Locate the stats row containing Articles Read (0), Open Tickets (0), Avg Response (< 24h)
- Delete that entire stats `<div>` block (lines ~2655–2690 approx.)
- Page title in sidebar is handled by Phase 1 (renamed to "Get Help")

---

## Phase 7 — Plans Badge + CSS (`pages-settings-account.js`, `main.css`)

### "Most Popular" badge — light mode fix
- The badge on the Pro plan card renders white text on a white/very-light background in light mode
- Fix: give `.most-popular-badge` (or equivalent inline style) an explicit dark background (`var(--primary)` or `#1d4ed8`) + `color: white` + sufficient contrast
- If styled inline in the template: add `background: var(--primary); color: white;` explicitly so it's not dependent on a CSS variable that resolves differently per theme

---

## Source Files Modified
| File | Phase |
|------|-------|
| `src/frontend/ui/components.js` | 1 |
| `src/frontend/pages/pages-settings-account.js` | 2, 7 |
| `src/frontend/core/utils.js` | 2 |
| `src/frontend/pages/pages-core.js` | 3 |
| `src/frontend/pages/pages-sales-orders.js` | 4 |
| `src/frontend/pages/pages-inventory-catalog.js` | 5 |
| `src/frontend/pages/pages-community-help.js` | 6 |
| `src/frontend/styles/main.css` | 7 (if badge uses class) |

## Out of Scope
- No new backend API routes
- No database migrations
- No changes to `core-bundle.js` directly (regenerated via `bun run dev:bundle` after source edits)
- No changes to `init.js` (Focus Mode object stays, just button removed)

## Build Step
After all phases: run `bun run dev:bundle` to regenerate `core-bundle.js` from updated source modules.
