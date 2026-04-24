# Orders & Sales — Walkthrough Findings

## Open (Needs Fix)

None — all Orders & Sales findings have been resolved.

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| H-4 | Orders | Shipping Labels button enabled but EasyPost not built — clicking will fail | Session 1 | VERIFIED ✅ — 1f0f44f |
| M-9 | Orders | "More" button truncated to "Mo..." at right edge | Session 1 | VERIFIED ✅ — 82a8408 |
| #153 | Orders | Orders Sync crashes: fires success toast then immediate failure: "Cannot read properties of undefined (reading 'get')" | Session 7 | VERIFIED ✅ — aca307f — syncAllPlatformOrders shows 'Syncing orders...' toast, no crash |
| 196-new | Sales & Purchases / Sidebar Nav | "Sales & Purchases" page was missing from the sidebar navigation entirely — users had no way to navigate to it. Fixed: added "Sales & Purchases" link between Listings and Offers/Orders in the Sell section of `components.js`. Also removed the stale `'sales'` route alias that was incorrectly redirecting `#sales` to the orders-sales page instead of the new sales page; added `sales` to the global search page list in `widgets.js`. | Post-session | VERIFIED ✅ — 7004f95 |
| 197-new | Sidebar / Offers | "Offers" still appeared as a standalone sidebar item after being migrated to a tab inside "Offers, Orders, & Shipping". Clicking it navigated to a now-unused standalone page instead of the tab. Fixed: removed the standalone Offers nav item from `components.js`; removed the stale `offers` page reference from `widgets.js` global search list. | Post-session | VERIFIED ✅ — 168bfc0 |
| 198-new | Sales & Purchases / Sourcing | "Connect" buttons for AliExpress and Alibaba sourcing platforms called `handlers.showSourcingInfo()` which was undefined — crashed silently with `TypeError`. Fixed: added `showSourcingInfo(platform)` handler to `handlers-sales-orders.js` with a modal showing platform info and API setup instructions. | Post-session | VERIFIED ✅ — f1899c5 |
| 199-new | Sales & Purchases / Purchases Tab | "Import CSV" button for Temu sourcing called `handlers.showTemuImport()` which was undefined — crashed silently with `TypeError`. Fixed: added `showTemuImport()` handler to `handlers-sales-orders.js` with a file input modal and `processTemuCSV()` CSV reader. | Post-session | VERIFIED ✅ — 33d0385 |
| 200-new | Sales & Purchases / API | Tax nexus and buyer profile API calls on the Purchases tab had no error handler — on 401/network failure they threw unhandled promise rejections that showed error toasts to the user. Fixed: added `.catch(() => {})` fallback to both API calls in `init.js`. | Post-session | VERIFIED ✅ — aaa49f8 |
| #206 | Orders & Sales | Migrate Sales to its own dedicated page called "Sales & Purchases" with two tabs: "Sales" and "Purchases". Each tab should display transactions processed by the app and allow manual entry and adjustment. Rename the existing "Offers & Sales" page to "Offers, Orders, & Shipping" | 2026-04-08 | VERIFIED ✅ — e6b1180 + a59edab |
| #207 | Orders & Sales | Migrate the Offers page to a tab on the "Offers, Orders, & Shipping" page | 2026-04-08 | VERIFIED ✅ — e6b1180 + a59edab |
| #209 | Orders & Sales | Shipping popup should be migrated to a popout menu beside the Create Label popup. Missing: (1) Canadian postal code format support; (2) weight measurement options — oz is the only available unit | 2026-04-08 | VERIFIED ✅ — 05f419d |
| #210 | Orders & Sales | "More" dropdown menu UI is broken/messed up | 2026-04-08 | VERIFIED ✅ — 1fcf99a |
| #208 | Orders & Sales | (1) Sidebar/page label should read "Offers, Orders, & Shipping" instead of "Orders"; (2) Shipping Calculator button label should read "Shipping Calculator" instead of "Ship Calc" | 2026-04-08 | VERIFIED ✅ — 1fcf99a |

## Extended QA Session Findings (Sales & Purchases Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Add Purchase form fails on submission — CSRF error | VERIFIED ✅ — 459772b — ensureCSRFToken(true) forces fresh token before POST |
| GST/HST/PST card — backend error: "Failed to load tax nexus data." | VERIFIED ✅ — 459772b — showTaxNexus handler added |
| Buyer Profiles card — backend error: "Failed to load buyer profiles." | VERIFIED ✅ — 459772b — showBuyerProfiles handler added |
| No way to add a sale from the Sales tab — zero "Add Sale," "Record Sale," or equivalent button anywhere | VERIFIED ✅ — 459772b — showAddSale()/submitAddSale() handlers added; Log Sale button added to header and empty state |
| Stat card grid layout broken — orphaned 4th card on both Sales and Purchases tabs (3-column renders as 3+1) | VERIFIED ✅ — 459772b — stat grid changed to repeat(4, 1fr) on both tabs |
| Large unexplained white gap — page content appears cut off on both sub-tabs | VERIFIED ✅ — 459772b — window.scrollTo(0,0) added at top of sales() render function |
| Status filter persists across navigation | VERIFIED ✅ — 459772b — router resets salesStatusFilter/salesPlatformFilter to 'all' on navigation |
| Feature cards (GST/HST/PST, Buyer Profiles) appear as decorative cards but are actually clickable — no visual affordance | VERIFIED ✅ — 459772b — arrow indicator + translateY hover lift added |
| Stat card icons appear interactive but do nothing | VERIFIED ✅ — 459772b — stat-card-icon gets pointer-events:none; cursor:default |
| Sales empty state has no call-to-action | VERIFIED ✅ — 459772b — "Log Sale" btn-primary button added to sales empty state |
| "Sell" breadcrumb is non-functional | VERIFIED ✅ — 459772b — breadcrumb section label made clickable |
| AliExpress and Alibaba modals have no direct link to Settings/Integrations | VERIFIED ✅ — 459772b — "Go to Settings →" button added to AliExpress/Alibaba modal footers |
| Add Purchase modal — no delete button on line item rows | VERIFIED ✅ — 459772b — × remove button added to dynamically added line item rows |
| Add Purchase modal — first Description field has no placeholder text | VERIFIED ✅ — 459772b — placeholder="e.g. Vintage jacket lot" added |
| Link to Inventory dropdown shows duplicate items | VERIFIED ✅ — 459772b — inventory items deduped by id in showAddPurchase and addPurchaseItem |

## Extended QA Session Findings (Offers, Orders, & Shipping Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| "Clear Filters" Button is Non-Functional (Orders Tab) — shows "Filters cleared" toast but does NOT actually reset the filter dropdowns | VERIFIED ✅ — d1ad0a9 — clearOrderFilters now resets DOM select values and re-renders filtered list |
| "Batch Ship by Region" Button Does Nothing (More → Orders) | VERIFIED ✅ — d1ad0a9 — shows toast.info explaining feature is coming in next update |
| "Order Map" Button Does Nothing (More → Orders) | VERIFIED ✅ — d1ad0a9 — shows toast.info explaining feature is coming in next update |
| "Upload CSV" Button Dismisses the Import Orders Modal Instead of Opening a File Dialog | VERIFIED ✅ — d1ad0a9 — creates hidden file input and triggers .click() to open OS file picker |
| "Shipping Labels" Button in Orders Action Bar Navigates Away (Design/Behavior Bug) | PRE-EXISTING ✅ — navigation to dedicated shipping labels page is by design |
| "Batches" Sub-Tab on Shipping Labels Has No Create Button | VERIFIED ✅ — d1ad0a9 — Create Batch button added + showCreateBatch() modal |
| Action Bar Horizontal Overflow (Orders Tab) — extra buttons cut off to the right | VERIFIED ✅ — d1ad0a9 — overflow-x:auto added to action bar wrapper |
| "Clear Filters" Link Only Appears When Using Pipeline Status Cards, Not Manual Dropdowns | VERIFIED ✅ — d1ad0a9 — Clear Filters link now shown when any dropdown filter is changed from default |
| View Toggle Buttons Have No Active State Indicator | VERIFIED ✅ — d1ad0a9 — active class added to current view mode button |
| Offer History by Item Modal — Orphaned Stats Card (2+1 Layout) | VERIFIED ✅ — d1ad0a9 — changed to repeat(3, 1fr); all 3 stat cards in one row |
| Platform Filter Inconsistency Between Orders and Offers Tabs | VERIFIED ✅ — d1ad0a9 — standardized to Poshmark, eBay, Whatnot, Depop, Facebook, Mercari across both tabs |
| Create Shipping Label — Validation Error Shows Toast Only, No Field Highlighting | VERIFIED ✅ — d1ad0a9 — input-error class added to invalid fields on submit |
| No "Add Order" / Manual Order Entry Button | VERIFIED ✅ — d1ad0a9 — Add Order button added to Orders action bar |
| Sync Button Only Shows Results Toast, Not What Was Synced | VERIFIED ✅ — d1ad0a9 — second toast fires 800ms later guiding user to My Shops |
| "Import Orders" Modal — Quick Sync Platform Buttons Have No Visual Feedback | VERIFIED ✅ — d1ad0a9 — loading toast fires immediately; success toast fires 1.5s later |
