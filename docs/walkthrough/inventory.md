# Inventory — Walkthrough Findings

## Open (Needs Fix)

None — all inventory findings have been resolved.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| #150 | Inventory Import | Import CSV — Parse Data crashes: "Failed to parse data: Cannot read properties of undefined (reading 'get')" — handler calls `.get()` on uninitialized state Map. Core onboarding feature completely broken | Session 6 | VERIFIED ✅ — aca307f — no undefined.get crash; loadImportData/validateImport run cleanly |
| #151 | SKU Rules | Create SKU Rule crashes: "Failed to create SKU rule: Cannot read properties of undefined (reading 'get')" — same root cause as #150 | Session 6 | VERIFIED ✅ — aca307f — loadSkuRules runs cleanly; no undefined.get crash |
| #141 | Inventory | Add Item success triggers "undefined" content in main area — router navigates post-submit but target page function returns undefined. Page crashes after every successful item add | Session 6 | VERIFIED ✅ — aca307f — changed pages.inventory() to window.pages.inventory() (Bun chunk shim fix) |
| #148 | Inventory | Inventory search bar fires error toast on any input — even with valid 200 API response | Session 6 | VERIFIED ✅ — aca307f — re-render wrapped in separate try-catch so render errors don't show "Search failed" toast |
| #182 | File Upload (DnD) | `sanitizeHTML()` / DOMPurify strips all drag-and-drop event handlers — `ondragover`, `ondragleave`, `ondrop`, `ondragenter`, `ondragstart`, `ondragend` missing from ADD_ATTR allowlist. Drop zones on Add Item modal, Inventory Import, and Image Bank all broken | Session 14 | VERIFIED ✅ — 07338ae |
| H-1 | App-wide | 100+ `Math.random()` fallbacks in app.js — fake health scores, prices, percentages throughout if data is missing | Session 1 | VERIFIED ✅ — b3c5358 |
| H-12 | Database | No SKU unique constraint in live DB — migration 004 exists but may not be applied | Session 1 | VERIFIED ✅ migration system reads pg/ dir dynamically — 004_add_sku_unique.sql applied on startup |
| L-5 | Inventory | "Low Stock" card highlights in yellow at value 0 | Session 1 | CONFIRMED N/A — lowStockItems > 0 guard already in place |
| L-6 | Inventory | "Stale (90+ days)" label wraps to two lines in stat card | Session 1 | VERIFIED ✅ — inventory stat card shows "Stale (90d+)" label, confirmed live |
| 193-new | Inventory / Import | Import tab buttons (`onclick="renderApp(pages.inventoryImport())"`) used bare `pages.` instead of `window.pages.` — crashed silently due to Bun ESM chunk shim overwriting the `pages` window global. Fixed by using `window.pages.inventoryImport()` on all 3 tab onclick handlers. | Post-session | VERIFIED ✅ — 0478535 — grep confirms window.pages.inventoryImport() in bundle |
| 194-new | Inventory / Quick Lookup | Quick Item Lookup hint element had no `id` — `document.getElementById('lookup-hint')` returned null, throwing on every keystroke. Fixed: added `id="lookup-hint"` to the hint `<div>` and added null guard before `.style.display` mutation. | Post-session | VERIFIED ✅ — 0478535 |
| 195-new | Inventory / Aging Widget | Inventory Aging chart crashed with a division-by-zero / map error when `agingBuckets` was empty (no items in inventory). Fixed: added `agingBuckets.length > 0` guard — shows "No aging data yet" empty state when array is empty. | Post-session | VERIFIED ✅ — 0478535 |
| #193 | Inventory | Search bar does not filter in real time as characters are typed, and does not filter even when Enter is pressed | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #194 | Inventory | Unable to add filters — filter controls have no effect | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #197 | Inventory | Analytics on Inventory page will not load and displays error toasts | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #191 | Inventory | No items show in Restock Suggestions even though 3 items have "Stock Low - Reorder" stock level set | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #195 | Inventory | Exported Excel sheet does not mirror the user's column order, detail format, or column selection | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #192 | Inventory | Quick Item Lookup should trigger after only 1 character is typed — current minimum threshold is too high | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #196 | Inventory | Column Settings button displays a pause-like icon — replace with text label "Customize Columns" to clarify the button's purpose | 2026-04-08 | VERIFIED ✅ 7ac7b46 |

## Extended QA Session Findings (2026-04-09)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Analytics Sub-Tab — Infinite Loading (Critical) — Clicking the Analytics tab shows "Loading analytics…" and never resolves. No error message, no timeout fallback. | VERIFIED ✅ — 60fb51c — 8-second timeout added in switchInventoryTab; shows "Unable to load analytics. Try refreshing." if analytics hasn't resolved |
| Duplicate Inventory Items — Two identical items exist with same name/SKU/price. | PRE-EXISTING ✅ — seeded demo data; not a code bug; deduplication is a data hygiene task |
| Tags Column Missing from Customize Columns — The Tags column is visible in the table but does not appear as an option in the "Customize Columns" settings modal. | VERIFIED ✅ — 60fb51c — Tags column added to Customize Columns modal; confirmed live via visual screenshot |
| Profit Margin Calculator — No Visual Gauge Marker | VERIFIED ✅ — 60fb51c — profit-gauge-marker triangle added to updateProfitCalc; moves with calculated ROI position |
| Bulk Price Update Scale — Same Missing Gauge Marker | VERIFIED ✅ — 60fb51c — bulk-margin-scale-wrap gradient + marker added to previewBulkPriceUpdate; shows avg margin preview |
| Alerts Modal — "In Stock: 0" Shown in Green | VERIFIED ✅ — 60fb51c — outOfStock summary card uses class "danger"; individual 0-stock items show red badge |
| Age Analysis — "Listed C$12.99" for Unlisted Item | VERIFIED ✅ — 60fb51c — showInventoryAgeAnalysis now reads item.status instead of hardcoding "Listed" |
| Low Stock Threshold vs. Default Quantity Mismatch — Low Stock Threshold defaults to 5 while Quantity field defaults to 1, flagging every new item as "Low Stock". | VERIFIED ✅ — 60fb51c — Add New Item modal Low Stock Threshold changed from value="5" to value="1" min="0" in modals.js |
| Stat Cards Not Filterable — clicking stat cards does nothing | VERIFIED ✅ — 60fb51c — All 5 filterable stat cards have cursor:pointer + onclick="handlers.filterByStatCard('...')"; table filters client-side on click |
| Filter Value Field — Free Text for Categorical Filters — Status column filter shows free text instead of dropdown | VERIFIED ✅ — 60fb51c — filter-column select has onchange handler; selecting Status replaces Value input with dropdown |
| Initial Page Load — White Gap at Top | VERIFIED ✅ — 60fb51c — window.scrollTo(0,0) added at render start |
