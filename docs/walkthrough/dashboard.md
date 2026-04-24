# Dashboard — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-dash-1 | Dashboard | Please remove everything on the dashboard page below the "View Changelog" popup notification. (image-95) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| H-6 | Dashboard | Massive empty space on scroll — scrolling past dashboard widgets shows huge white void with sidebar detached | Session 1 | VERIFIED ✅ — e097efa |
| M-1 | Dashboard | "100% Listing Health" shown at 0 listings — should show N/A | Session 1 | VERIFIED ✅ — efe7ab1 — healthScore null → shows N/A |
| M-3 | Dashboard / Analytics | "0% Avg Offer" when 0 offers exist — should show N/A | Session 1 | VERIFIED ✅ — efe7ab1 — avgOfferPercent null → shows N/A |
| M-7 | Analytics / Dashboard | Green "0.0%" up arrows on empty data — KPI cards show green arrow with no prior data to compare | Session 1 | VERIFIED ✅ — 82a8408 — calcChange returns null (not 0/100) when no prior data; statCard hides indicator on null |
| M-11 | Dashboard | "$2,000 goal" hardcoded Monthly Goal — should be user-set or hidden until set | Session 1 | VERIFIED ✅ — 82a8408 — null default, empty state prompt, C$ currency prefix |
| L-3 | Dashboard | "Not yet refreshed" text shown to first-time users | Session 1 | VERIFIED ✅ — 82a8408 — shows "Add your first item to get started" |
| L-4 | Dashboard | "Good afternoon, demo!" uses username instead of display_name or full_name | Session 1 | VERIFIED ✅ — pages-core.js — greeting correctly uses full_name/display_name/username cascade |
| L-19 | Dashboard | Massive empty space below widgets on scroll — layout/height issue | Session 2 | VERIFIED ✅ — mc_scrollTop=0 + mw_scrollTop=0 at max scroll confirms no inner scroll container |
| CO-1 | Analytics / Dashboard | Green up arrows on 0% changes — should be neutral/gray when no comparison data | Session 1 | VERIFIED ✅ — screenshot confirms → 0% neutral gray on equal values (2026-04-07) |
| 191-new | Dashboard / Stale Banner | Dashboard "data may be stale" banner appeared on every fresh page load because `!lastRefresh` is always true when `dashboardLastRefresh` has never been set. Fixed: changed condition from `!lastRefresh \|\|` to `lastRefresh &&` so banner only shows when a previous refresh timestamp exists and is >5 min old. | Post-session | VERIFIED ✅ — 7c884b4 — banner absent on fresh session confirmed live |
| 192-new | Dashboard / Export Dropdown | Export dropdown menu opened to the right of the button (`left: 0`) and overflowed the viewport on narrower screens. Fixed: changed CSS to `right: 0; left: auto` so it opens leftward, anchored to the button's right edge. | Post-session | VERIFIED ✅ — 7c884b4 — both options fully visible on live site |
| #152 | Dashboard | Log Sale crashes: "Failed to log sale: Cannot read properties of undefined (reading 'get')" — same `db.get()` crash as #150 | Session 7 | VERIFIED ✅ — aca307f — Log Sale navigates to orders-sales, no crash |

## Extended QA Session Findings (Dashboard Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| Massive White Gap on Dashboard — Triggered by Scrolling — enormous blank area appears between action bar and first dashboard widget after scrolling | VERIFIED ✅ — c7b3294 — toggleVaultBuddy now toggles CSS class only; removed renderApp() call that caused layout shifts |
| "Log Sale" Button Opens "Add New Item" Form instead of sale-logging modal | VERIFIED ✅ — c7b3294 — Log Sale now calls loadChunk('sales').then(() => handlers.showAddSale()) |
| Daily Summary Modal — "Add Item", "Full Analytics", and "Checklist" Buttons All Non-functional | VERIFIED ✅ — c7b3294 — Add Item opens inventory addItem modal, Full Analytics navigates to analytics, Checklist navigates to tools-tasks |
| Daily Summary Modal — "View" Button in Action Items Non-functional | VERIFIED ✅ — c7b3294 — View button dispatches router.navigate('tools-tasks') |
| Profit Target Tracker — Target Label Doesn't Update When Input Changes | VERIFIED ✅ — c7b3294 — updateProfitTarget() mutates .goal span in-DOM immediately without re-render |
| "Restock" Button in Low Stock Alerts Widget Opens Wrong Form — opens "Add New Item" instead of edit dialog | VERIFIED ✅ — c7b3294 — Restock calls loadChunk('inventory').then(() => handlers.editItem(id)) to open the edit form for the existing item |
| Global Search Input Doesn't Accept Typed Text | VERIFIED ✅ — c7b3294 — loads deferred chunk, calls _openGlobalSearchImpl which renders proper focused input |
| Vault Buddy Chat Panel — "Close" (X) Button Unresponsive When Opened Over a Modal | VERIFIED ✅ — c7b3294 — VaultBuddy panel z-index raised 999→1001, above modal overlay at z-index 1000 |
| Hero Section Stats Cards Not Clickable | VERIFIED ✅ — c7b3294 — 4 hero stat cards now have cursor:pointer + onclick navigation to sales/listings/orders |
| Hero Section — "Pending Orders" Orphaned in Normal View (3+1 layout) | VERIFIED ✅ — 45cde41 — today-stat flex:1 1 180px + min-width:180px; 4 cards wrap 2×2 in sidebar mode |
| Daily Business Summary — "Pending Offers" Orphaned (3+1 layout) | VERIFIED ✅ — 45cde41 — daily-summary-stats grid repeat(2,1fr); all 4 stats in 2×2 layout |
| Profit Target Tracker — "Monthly Target" Orphaned | VERIFIED ✅ — 45cde41 — target-cards grid repeat(3,1fr); all 3 targets in single row |
| Keyboard Shortcuts Dialog Shows "Cmd" Instead of "Ctrl" on Windows | VERIFIED ✅ — 45cde41 — shortcutsManager.render() substitutes Cmd→Ctrl via navigator.platform check |
| Set Monthly Goal Modal Uses "$" Instead of "C$" | VERIFIED ✅ — 45cde41 — Monthly Goal modal label updated to C$ |
| Stats Overview — "↓ 100% vs last week" for Total Inventory Appears Wrong | VERIFIED ✅ — 45cde41 — calcChange returns null when values identical; suppresses misleading -100% indicator |
| "Getting Started" Widget — No Way to Restore Once Dismissed | VERIFIED ✅ — 45cde41 — Customize Dashboard panel now includes Getting Started toggle to restore widget |
| "Stale Data" Banner Persists After Refresh | VERIFIED ✅ — 45cde41 — refreshDashboard removes stale-data-banner DOM node after successful refresh |
| "Copy Screenshot" Export Option Has No Feedback | VERIFIED ✅ — 45cde41 — exportDashboard shows OS-aware shortcut hint toast after screenshot copy |
| Action Bar Alignment — Hint Text Position Inconsistent | VERIFIED ✅ — 45cde41 — hint text wrapped in right-aligned flex div; sits flush to action bar right edge |
| Vault Buddy Chat — "My Chats" History Shows Duplicate/Identical Entries | VERIFIED ✅ — 45cde41 — My Chats filters out conversations with no last_message or message_count |
| Comparison Widget — No Visual Chart | VERIFIED ✅ — 45cde41 — comparison bar fills get min-width:8px; zero values show "—" instead of 0 |
| Getting Started Checklist Navigation Is Inconsistent — item 4 ("Make your first sale") navigating to Financials is odd | VERIFIED ✅ — 45cde41 — onboarding step 4 action changed to showAddSale modal instead of navigate(transactions) |
| Date Range Persists After Navigation — no indicator that non-default range is active | VERIFIED ✅ — 45cde41 — non-default date range now shows badge indicator next to period selector |
