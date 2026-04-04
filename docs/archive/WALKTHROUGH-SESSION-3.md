# QA Walkthrough v3 — Session 3 Summary
Date: 2026-03-30
Section: 3 — Dashboard (#35–#66, 32 items)
Status: COMPLETE

## Results
- Pass: ~31
- Fail: 1
- Issue: 0
- Skipped: 0

## Key Findings

### BUG #64 — Widget Drag-Reorder Broken (Fail/High)
`getWidgets()` in `src/frontend/ui/widgets.js:1073` always maps from `defaultWidgets` order, ignoring saved order.
- `reorderWidgets(0, 2)` correctly saves reordered array to localStorage: `["goals","comparison","stats"]`
- But `getWidgets()` maps `this.defaultWidgets.map(def => ...)` — returns default order `["stats","goals","comparison"]`
- Dashboard page templates also hardcode widget render order (not driven by `getWidgets()` order)
- The `order` field is saved on each widget but never used for sorting
- Drag events fire correctly (all 22 widgets have `draggable=true`, `initDragDrop()` wired)
- Fix: `getWidgets()` should sort by saved `order` field; templates should render from `getWidgets()` order

### Minor Note #66 — Customize Dashboard null-check missing
`pages-core.js:390` button onclick: `document.querySelector('.dashboard-customize-section').insertAdjacentHTML(...)` — no null-check. If `.dashboard-customize-section` is absent (e.g. render timing issue), throws TypeError silently. Low severity.

## Items by Result

### All Pass (#35–#63, #65, #66)
- #35 Hero banner (stats tiles, greeting)
- #36 Getting Started checklist dismiss
- #37 What's New banner dismiss
- #38 Dashboard data staleness alert + Refresh Now
- #39 Unshipped orders alert (conditional on pending/confirmed orders)
- #40 Quick Actions bar
- #41 Platform Performance widget (conditional on sales data)
- #42 Stats Overview widget
- #43 Monthly Goal widget (onclick → setMonthlyGoal modal)
- #44 Period Comparison widget
- #45 Recent Activity feed
- #46 Quick Actions widget
- #47 Stale Listings alert (conditional: active + age ≥30d)
- #48 Recently Relisted widget
- #49 Recent Sales widget
- #50 Sales Forecast widget
- #51 Conversion Funnel widget
- #52 Profit Margin Gauge (green ≥30%, red <30%)
- #53 Cash Flow widget
- #54 Today's Tasks (filters by dueDate camelCase, not due_date)
- #55 Ship Today widget
- #56 Milestones widget
- #57 Low Stock Alerts widget
- #58 Price Trends widget
- #59 Upcoming Events widget
- #60 Recent Items widget (View All → router.navigate('inventory'))
- #61 Mini P&L Snapshot (4 rows: Revenue/COGS/Fees/Net Profit)
- #62 Pending Offers Urgency (countdown, urgent styling, empty state)
- #63 Poshmark Closet widget (Check Now → handlers.checkPoshmarkMonitoring, expected empty state)
- #65 Widget collapse/expand (button present all 22 widgets, .collapsed class, persists to localStorage)
- #66 Widget visibility/customize panel (23 rows, checkboxes, width dropdowns, close works)

### Fail
- #64 Widget drag-reorder — getWidgets() ignores saved order (see Bug #64 above)

## Technical Notes
- Tested on live Railway site: https://vaultlister-app-production.up.railway.app
- Used fake session injection for most tests (rate-limited on real login)
- Fake session: `store.setState({user:{...},token:'fake',refreshToken:'fake',isAuthenticated:true})` + `renderApp(window.pages.dashboard())`
- Simulated store state for conditional widgets: sales, orders, inventory, offers, listings
- Stale listings require: status='active' AND age≥30d from `last_relisted_at || listed_at || created_at`
- Task filter uses `dueDate` (camelCase) not `due_date`
- Platform Performance widget: only renders when `Y0.length > 0` (sales grouped by platform)
- Unshipped orders urgency: error (3+ days), warning (1-2 days), info (same day)

## Screenshots
data/walkthrough-screenshots/session-3/
- item-35-hero-banner.png
- item-36-37-dashboard-post-dismiss.png
- item-38-39-dashboard-state.png
- item-39-unshipped-alert.png
- item-40-41-actions-platform.png
- item-42-43-44-widgets.png
- item-45-46-47-comparison-activity-qa.png
- item-52-55-margin-cashflow-tasks-ship.png
- ss_43133be70 (dashboard customize panel visible, session 3 end)
