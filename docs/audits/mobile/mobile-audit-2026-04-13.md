# Mobile Audit — 2026-04-13
Viewport target: 390×844 (iPhone 14 Pro)
Live site: https://vaultlister-app-production.up.railway.app
Tested pages: Inventory, Listings (Cross-Lister), Automations, Sales, Offers, Image Bank, Settings

## Methodology Note
**BrowserStack quota exhausted.** Windows DPR tooling limitation prevented `resize_window` from setting a 390px CSS viewport (locked at 1713px). **All findings are based on CSS source analysis (`main.css`) and DOM inspection at desktop viewport.** No 390px screenshots were obtainable. Pages were loaded via `renderApp()` with fake session injection. Classifications reflect this limitation.

---

## Summary
- VERIFIED: 1 issue
- HIGH-PROBABILITY: 0 issues
- HYPOTHESIS: 0 issues

All 7 pages audited. The existing CSS in `src/frontend/styles/main.css` contains comprehensive responsive rules for mobile breakpoints (≤1024px, ≤768px, ≤480px). Grid layouts, sidebar, header, filter rows, and settings panels all have correct responsive overrides.

---

## Global Infrastructure (applies to all 7 pages)

### Sidebar + Header
- `.header { display: none }` at `@media (max-width: 1024px)` ✅
- `.mobile-header { display: flex }` at `@media (max-width: 1024px)` ✅
- `.sidebar { transform: translateX(-100%) }` at `@media (max-width: 768px)` ✅
- `.mobile-menu-btn { min-width: 44px; min-height: 44px }` ✅

### Grid Layouts
- `.grid-cols-2, .grid-cols-3, .grid-cols-4 { grid-template-columns: 1fr }` at `@media (max-width: 768px)` ✅ — covers Automations, Image Bank, and all Tailwind utility grids
- `.stats-grid { grid-template-columns: 1fr !important }` at `@media (max-width: 768px)` ✅ — covers Sales metrics row

### iOS Zoom
- `.form-input, .form-select { font-size: 16px }` at `@media (max-width: 768px)` ✅
- Global search input (`#global-search`) has 14px font but is inside `.header` which is hidden at ≤1024px — moot ✅

### Filter Rows
- `.filter-bar { flex-direction: column }` at `@media (max-width: 480px)` ✅
- Sales filter row uses `flex flex-wrap` class — wraps naturally without explicit media query ✅

---

## Findings

### All Pages
#### `.btn-sm` touch target: 40px minimum height on touch devices — VERIFIED

**Evidence:** `src/frontend/styles/main.css` line 61181–61184:
```css
@media (hover: none) and (pointer: coarse) {
    .btn-sm {
        min-height: 40px;  /* ← below WCAG 2.5.5 44px minimum */
        padding: 0.5rem 1rem;
    }
}
```
WCAG 2.5.5 requires 44×44px minimum touch targets. `.btn-xs` and `.header-icon-btn`/`.btn-icon` are correctly set to 44px in the same media query, but `.btn-sm` is 40px.

**Impact:** Any `.btn-sm` button on mobile is 4px too short for reliable tap without mis-hits. Affects buttons across all 7 pages.

**Fix:** `src/frontend/styles/main.css` line 61182 — change `min-height: 40px` to `min-height: 44px`.

---

## Page-by-page: No Additional Issues Found

### Inventory
- `.inventory-hero-stats { grid-template-columns: 1fr }` at ≤768px ✅
- `.inventory-hero-actions { flex-wrap: wrap }` at ≤768px ✅
- `.table-container { overflow-x: auto }` (verified via DOM) ✅
- No additional mobile issues found.

### Listings (Cross-Lister)
- `.table-container { overflow-x: auto; -webkit-overflow-scrolling: touch }` ✅
- Filter row (Folder/Status/Platform/Columns) uses `.flex.flex-wrap` ✅
- Listings health bar stacks at ≤768px ✅
- No additional mobile issues found.

### Automations
- 4-col and 3-col stat grids: Tailwind `.grid-cols-4` / `.grid-cols-3` → `1fr` at ≤768px ✅
- Category cards (Sharing/Engagement/Offers/Listing): same `.grid-cols-4` coverage ✅
- No additional mobile issues found.

### Sales
- `.stats-grid` (Total Sales / Revenue / Gross Profit / Pending Shipments): `1fr !important` at ≤768px ✅
- 2-col secondary row (GST/Buyer Profiles): `grid-cols-2` → `1fr` at ≤768px ✅
- Filter row (`flex flex-wrap`): wraps naturally ✅
- No additional mobile issues found.

### Offers
- `.offers-insights-grid` → `repeat(2, 1fr)` at ≤1024px → `1fr` at ≤768px ✅
- Tab nav (Offers/Orders/Shipping): `.tab-nav { overflow-x: auto; flex-wrap: nowrap }` at ≤768px ✅
- No additional mobile issues found.

### Image Bank
- `grid.grid-cols-4.gap-4` stat row → `1fr` at ≤768px ✅
- `.storage-stats-grid` uses `repeat(auto-fit, minmax(250px, 1fr))` — naturally collapses to 1 column at 390px (2×250=500 > ~358px available) ✅
- `.image-grid { grid-template-columns: repeat(2, 1fr) }` at ≤480px ✅
- No additional mobile issues found.

### Settings
- `.settings-container { grid-template-columns: 1fr }` at `@media (max-width: 1024px)` ✅
- Settings tabs become `flex-wrap: wrap` at ≤1024px ✅
- No additional mobile issues found.

---

## Recommended Fix

**File:** `src/frontend/styles/main.css` — line 61182

```css
/* Before */
.btn-sm {
    min-height: 40px;
    padding: 0.5rem 1rem;
}

/* After */
.btn-sm {
    min-height: 44px;
    padding: 0.5rem 1rem;
}
```

This is a single-line change in the `@media (hover: none) and (pointer: coarse)` block.

---

## Prior Audits
- `mobile-audit-2026-04-12.md` — Dashboard and Analytics (BrowserStack, verified at 390px)
- `mobile-audit-2026-04-12b.md` — same date, second run
