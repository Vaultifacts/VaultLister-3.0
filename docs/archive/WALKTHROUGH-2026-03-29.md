# Live Site Walkthrough — 2026-03-29
# https://vaultlister.com

## Local fix bundle: 47c1b33c (not yet deployed)
## Live site bundle: eb026b80 (pre-fix)

---

## PAGE STATUS

| Page | Route | Live Status | Notes |
|------|-------|-------------|-------|
| Dashboard | #dashboard | RENDERS | [object Object] in Recent Activity (BUG-2) |
| Inventory | #inventory | RENDERS | Empty state, Add Item/Import/Export present |
| Listings | #listings | RENDERS | My Listings, empty state |
| Orders & Sales | #orders-sales | RENDERS | Stats all 0 |
| Offers | #offers | RENDERS | Empty state |
| Automations | #automations | RENDERS | 41KB, full feature set |
| Analytics | #analytics | RENDERS | 50KB, profit margin alert shown |
| Financials | #financials | CRASH | profitMarginGauge is not defined |
| My Shops | #shops | RENDERS | Only 6/9 platforms (missing Mercari, Etsy, Grailed) |
| Planner | #planner | RENDERS | Daily checklist, Pomodoro timer |
| Image Bank | #image-bank | RENDERS | Upload, folder browser, storage gauge |
| Settings | #settings | RENDERS | Profile, security, tabs |
| Calendar | #calendar | CRASH | calendarViewToggle is not defined |
| Predictions | #predictions | CRASH | recommendationCards is not defined |
| Suppliers | #suppliers | CRASH | supplierHealthDashboard is not defined |
| Market Intel | #market-intel | CRASH | competitorActivityFeed is not defined |
| Whatnot Live | #whatnot-live | RENDERS | Full page: event stats, tabs |
| Heatmaps | #heatmaps | RENDERS | Engagement Heatmaps (81KB) |
| Report Builder | #report-builder | RENDERS | 5.8KB |
| Transactions | #transactions | RENDERS | 28KB |
| Inventory Import | #inventory-import | RENDERS | 4.9KB |
| Smart Relisting | #smart-relisting | RENDERS | Rules/Listings/Queue/Performance tabs |
| AR Preview | #ar-preview | STUB | Lazy chunk, renders previous page |

Total: 23 tested, 5 crash, 1 stub, 17 render

---

## BUGS FIXED LOCALLY (need deploy to go live)

### BUG-1: 5 pages crash — widget not exposed on window
Root cause: widgets defined in widgets.js as local const, never exposed as window.xxx,
so lazy-loaded chunks cannot access them.

Fixes added directly in src/frontend/ui/widgets.js:
- line 5575: window.profitMarginGauge = profitMarginGauge (fixes Financials)
- line 4906: window.calendarViewToggle = calendarViewToggle (fixes Calendar)
- line 5944: window.recommendationCards = recommendationCards (fixes Predictions)
- line 6078: window.supplierHealthDashboard = supplierHealthDashboard (fixes Suppliers)
- line 6266: window.competitorActivityFeed = competitorActivityFeed (fixes Market Intel)

### BUG-2: Dashboard Recent Activity shows [object Object] / undefined
Root cause: components.js has 3 conflicting emptyState() definitions (lines 747, 1205, 1715).
Last one wins: emptyState(title, description, actionLabel, actionHandler).
activityFeed() calls this.emptyState({icon, title, description,...}) — object as title arg.
Fix: src/frontend/ui/components.js:915 — changed to positional string args.

### BUG-3: Customize Dashboard button shows nosemgrep comment as label text
Root cause: nosemgrep comment was inside the template literal.
Fix: src/frontend/pages/pages-core.js:391 — removed comment from inside string.
Status: Fixed in prior session.

---

## BUGS ON LIVE SITE (separate fix in origin/master, not merged)

### BUG-4 [CRITICAL]: CSP blocks ALL inline onclick handlers
ALL sidebar nav buttons, Quick Actions, and interactive elements use onclick="..."
attributes. Live site CSP nonce causes unsafe-inline to be ignored for event
handlers (CSP3 spec). Navigation via clicks is completely broken.
Fix: script-src-attr: 'unsafe-inline' added to buildCSPWithNonce() in securityHeaders.js.
Already in origin/master. Blocked because fix/339-rebase is not merged yet.

### BUG-5: Session expiry during navigation
"Failed to load orders: Session expired" toast appears on protected route navigation.
JWT refresh not triggering on route changes, or refresh token expiring.

---

## MISSING FEATURES / INCOMPLETE

1. My Shops: Only 6/9 platforms shown. Missing: Mercari, Etsy, Grailed.
2. AR Preview: Lazy chunk doesn't render — shows previous page.
3. crosslist route redirects to listings — no standalone cross-listing page.
4. Console warnings: /app.js and /styles/main.css preloaded but not used.
5. WebSocket shows "Reconnecting" on live site.

---

## FILES MODIFIED THIS SESSION

- src/frontend/ui/widgets.js — 5 window.xxx exports added
- src/frontend/ui/components.js — activityFeed emptyState fix
- src/frontend/pages/pages-core.js — nosemgrep comment removed (prior session)
- src/frontend/core-bundle.js — rebuilt 47c1b33c
- src/frontend/index.html — version 47c1b33c
- public/sw.js — version 47c1b33c
- src/frontend/init.js — profitMarginGauge export attempted (reverted by hook,
  moved fix to widgets.js instead)

---

## NEXT ACTIONS (priority order)

1. DEPLOY: Merge fix/339-rebase to master to fix BUG-4 (CSP onclick) on live site
2. COMMIT: Commit local widget fixes (BUG-1, BUG-2, BUG-3) then push
3. INVESTIGATE: Session expiry on navigation (BUG-5)
4. ADD: Mercari, Etsy, Grailed to My Shops page
5. IMPLEMENT or STUB: AR Preview page
