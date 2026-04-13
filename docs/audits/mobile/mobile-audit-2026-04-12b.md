# Mobile Audit — 2026-04-12 (Session 2)
Viewport: ~726px CSS (resize_window to 390px OS pixels; DPR=0.75 on this Windows system)
Live site: http://localhost:8098
Tool: mcp__claude-in-chrome__resize_window + javascript_tool console checks
Pages fully tested: Dashboard, Analytics
Pages not tested: Inventory, Cross-Lister, Automations, Sales, Offers, Image Bank, Settings
(Lazy-loaded pages not in window.pages — navigation breaks viewport on this system)

## Tooling Limitation (Windows/High-DPI)
`resize_window` sets the OS window to 390px but with devicePixelRatio=0.75, the CSS viewport reports ~726px. Media queries for `max-width: 768px` DO fire correctly (726 < 768). However, click interactions reset the viewport back to full desktop width (1845px). Only pages accessible via `renderApp(window.pages.xxx())` — i.e. dashboard and analytics — could be tested reliably.
**Action required:** Update the mobile-audit skill to acknowledge this Windows/DPI limitation. CDP emulation (`mcp__plugin_chrome-devtools-mcp__emulate`) is more reliable for true viewport control but opens a separate window (requires fake session).

---

## Summary
- VERIFIED: 4 issues
- HIGH-PROBABILITY: 0
- HYPOTHESIS: 0
- Scope: Dashboard + Analytics only (7 pages untested)

---

## Findings

### All Pages (CSS-level — confirmed in Dashboard + Analytics)

#### CSS cascade overrides widget grid fix — VERIFIED
**Evidence:**
- Dashboard: `getComputedStyle('.dashboard-widgets-container').gridTemplateColumns` = `148px × 6 columns` at 726px viewport, despite `window.matchMedia('(max-width: 768px)').matches = true`
- CSS audit: fix at line 4099 (`repeat(2, 1fr)`) inside `@media (max-width: 768px)` is overridden by base rule at line 12936 (`repeat(6, 1fr)`) — same specificity, last declaration wins

**Impact:** Dashboard widget grid stays at 6 cramped columns on mobile (not 2). `f80adad` fix is NOT working.

**Root cause:** `src/frontend/styles/main.css` — `@media (max-width: 768px)` block opens at line 4057. The grid fix is at line 4099. The base `.dashboard-widgets-container { grid-template-columns: repeat(6, 1fr) }` rule is at line 12936 — after the fix. CSS resolves same-specificity conflicts by source order — later wins, so the base rule at 12936 overwrites the mobile override at 4099.

**Fix:** Move the `.dashboard-widgets-container` grid override to after line 12936 in the `@media (max-width: 768px)` block.

---

#### iOS auto-zoom risk: unclassed form inputs on Analytics — VERIFIED
**Evidence:**
- Analytics: 4 `input`/`select`/`textarea` elements returning `font-size: 14px` at ≤768px viewport
- CSS investigation: our mobile fix at line 4095 (`.form-input, .form-select, .form-textarea { font-size: 1rem }`) correctly appears AFTER the base `.form-input` rule at line 2631 — the cascade is fine for classed elements
- Root cause is selector mismatch: the analytics date/filter controls use bare `input` or `select` elements without the `.form-input` class; the fix doesn't cover them

**Impact:** Any analytics filter or date-range input without `.form-input` class will trigger iOS Safari viewport zoom on focus.

**Fix:** Extend the `@media (max-width: 768px)` fix to also cover bare elements: add `input, select, textarea { font-size: 1rem }` (or verify analytics inputs use `.form-input` and add the class where missing).

---

### Analytics

#### Analytics tab bar overflows and clips on mobile — VERIFIED
**Evidence:** Console: `tabBar.scrollWidth = 1414px` in a `932px clientWidth` container. Screenshot confirms "Stat" label (last tab) is cut off. Tabs: Live, Graphs, Performance, Heatmaps, Predictions, Reports, Ratio Analysis, Profitability Analysis, Product Analysis, Market Intel, Statistics — 11 tabs, no wrapping.
**Impact:** Last 3–4 tabs are inaccessible without horizontal scrolling on any screen under ~1400px. On a real 390px device, only 3–4 tabs would be visible.
**Fix hint:** `.analytics-tabs` or equivalent — add `flex-wrap: wrap` or `overflow-x: auto; -webkit-overflow-scrolling: touch` with a visible scrollbar indicator, or reduce to an icon-only compact view on mobile.

---

### Dashboard + Analytics

#### Touch targets below WCAG 2.5.5 minimum (44×44px) — VERIFIED
**Evidence:** Console check returned 54 sub-44px interactive elements on Analytics. Sample:
- Icon buttons: 18×18px, 22×22px
- Toolbar buttons (Refresh, Daily Summary, Profit Goals, etc.): ~49–73px wide × **16px tall**
- User avatar: 18×18px
- Notification/close/collapse buttons: 13–22px
**Impact:** Primary action buttons are 16px tall — 2.75× below WCAG minimum. Critical accessibility failure on touch devices.
**Fix hint:** Toolbar buttons (`.dashboard-toolbar button`, `.page-header button`) need `min-height: 44px`. May require layout adjustment for the toolbar row.

---

### Dashboard

#### Widget grid: 6 columns not overridden at mobile width — VERIFIED (see CSS cascade finding above)
**Evidence:** `gridTemplateColumns = "148px 148px 148px 148px 148px 148px"` at 726px viewport
**Impact:** Stats widgets are cramped; widgets below (Monthly Goal, Weekly Comparison, Activity Feed) render as 3 tiny side-by-side cards.
**Fix:** Relocate grid media query override to after line 12934 in main.css (see CSS cascade finding).

---

## Previously Fixed (baseline 2026-04-12 Session 1)
| Fix | Commit | Actual Status |
|-----|--------|---------------|
| Desktop header hidden on mobile | 659ac3a | ✅ Working — `.header` correctly hidden |
| Page-header buttons flex-wrap | ef5daa9 | ✅ Working — buttons wrap horizontally |
| Widget grid 2-column | f80adad | ❌ BROKEN — CSS cascade overrides it (see above) |
| iOS form input font-size (.form-input) | 4deaa78 | ✅ Working — fix at line 4095 correctly overrides base at 2631 |
| iOS form input font-size (unclassed inputs) | — | ❌ NOT COVERED — analytics bare inputs not targeted by fix |
| Touch targets ×5 elements | 4deaa78 | ⚠️ PARTIAL — those 5 specific elements fixed, but 50+ others remain |

---

## Fix Log — 2026-04-13

All 4 VERIFIED issues patched in `src/frontend/styles/main.css` (commit `4a33ed8`):

| Issue | Status | Notes |
|-------|--------|-------|
| CSS cascade overrides widget grid | Fixed | New `@media (max-width: 768px)` block added AFTER base rule at line 12957 |
| iOS auto-zoom on unclassed inputs | Fixed | Extended selector to include `input, select, textarea, .form-control` |
| Analytics tab bar overflow | Fixed | Added `overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap` to `.tabs` in mobile query |
| Touch targets < 44px | Fixed | Added `min-height: 44px` to `.page-header button, .btn-sm, .toolbar button, [class*="toolbar"] button` |

**Deployment blocked:** Railway skipped deploy of `4a33ed8` because the CI `Docker Build` step is failing: image size 928MB > 600MB limit. This is a pre-existing issue (started at commit `861f277`). Visual verification pending deployment fix.

---

## Recommended Fix Priority

1. **HIGH — CSS cascade fix (grid):** Move `.dashboard-widgets-container` grid override to after line 12936 in `main.css` — the base rule at 12936 overwrites the mobile fix at 4099.
2. **HIGH — iOS font-size (unclassed inputs):** Extend the `@media (max-width: 768px)` fix to cover bare `input, select, textarea` elements — 4 analytics inputs without `.form-input` class still zoom on iOS.
3. **HIGH — Analytics tab bar:** Add `overflow-x: auto; -webkit-overflow-scrolling: touch` to the analytics tab container, or implement wrapping.
4. **MEDIUM — Toolbar touch targets:** All dashboard/page-header toolbar buttons need `min-height: 44px`. Currently 16px tall.

Run `/mobile-fix` to patch VERIFIED issues.
