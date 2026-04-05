# QA Report — Chrome Walkthrough (claude-in-chrome)
**Date:** 2026-04-04
**URL:** https://vaultlister.com/?app=1
**Auth:** Logged in as demo@vaultlister.com (demo user, Free Plan)
**Tool:** claude-in-chrome (real Chrome session)
**Tab:** 1791331513

## Summary
- **Pages Tested:** 16 (Dashboard, Inventory, Listings, Orders & Sales, Offers, Automations, Financials, Analytics, My Shops, Planner, Image Bank, Calendar, Reports, Community, Help, Settings [Profile + Appearance], Account, Plans & Billing)
- **Modals Tested:** 2 (Daily Business Summary, Add New Item)
- **Features Verified:** Dark mode toggle, sidebar navigation, empty states, greeting fix, AI usage counter, N/A guards
- **Issues Found:** 8 (3 HIGH, 3 MEDIUM, 2 LOW)

## Verified Fixes (from previous walkthrough)
| Fix | Status | Evidence |
|-----|--------|----------|
| Greeting shows username | PASS | "Good evening, demo!" on Dashboard |
| Dark mode toggle | PASS | Switches to dark theme correctly, all elements styled |
| Listing Health N/A | PASS | Shows "N/A" donut on Listings page with 0 active |
| T7.6 ticketsOpen: 0 | PASS | Help page shows "0 Open Tickets" |
| T8.6 AI usage counter | PASS | Plans & Billing shows "0 / 50 used this month" |
| Sales Funnel N/A | PASS | Analytics shows "N/A conversion" between funnel steps |
| Sidebar upgrade CTA | PASS | "Upgrade to Pro" visible in sidebar (dark mode) |
| Empty states (no fake data) | PASS | Orders, Offers, Image Bank, Calendar, Reports, Community all show correct empty states |

## Issues Found

### HIGH

**H-1: Analytics fake percentage badges**
- **Page:** Analytics (#analytics)
- **Detail:** Revenue card shows "+12.5%", Sales Count "+8.3%", Profit Margin "2.1%", Sell-Through "+5.7%" — all with $0/0 actual values. These are fabricated growth percentages.
- **Expected:** Should show "0%" or "N/A" when all values are zero.
- **File:** src/frontend/pages/pages-core.js (analytics cards section)

**H-2: My Shops platform count mismatch — "0 of 6" but 9 cards**
- **Page:** My Shops (#shops)
- **Detail:** Header says "0 of 6" but 9 platform cards are displayed (Poshmark, eBay, Mercari, Depop, Grailed, Etsy, Shopify, Facebook, Whatnot).
- **Expected:** Should say "0 of 9" to match the actual number of platform cards.
- **File:** src/frontend/pages/pages-core.js or pages-inventory-catalog.js (shops page)

**H-3: Subscription tier inconsistency**
- **Page:** Settings Profile vs Account vs Sidebar
- **Detail:** Settings Profile badge says "Pro Member", Account page says "Free" Current plan, Sidebar says "Free Plan", Plans & Billing says "Free".
- **Expected:** All locations should show the same plan tier (Free for this user).
- **File:** src/frontend/pages/pages-settings-account.js (profile badge)

### MEDIUM

**M-1: "Ebay" should be "eBay" (case)**
- **Page:** My Shops (#shops)
- **Detail:** Platform card text says "Ebay" (capital E, lowercase bay) instead of "eBay".
- **T5.3 gap:** Was marked DONE but this display location was missed.
- **File:** src/frontend/pages/pages-core.js or components.js (shops cards)

**M-2: Member Since shows "N/A"**
- **Page:** Account (#account)
- **Detail:** Member Since field shows "N/A" instead of the user's created_at date.
- **T3.3:** Was marked DONE — may be a data issue (user.created_at null in DB) or rendering issue.

**M-3: Settings layout — content squeezed to narrow left column**
- **Page:** Settings (#settings) — Profile and Appearance tabs
- **Detail:** Settings content panel is very narrow (~350px) with the entire right side of the page empty. Theme "Dark" label truncated to "Da...". Profile fields truncated.
- **Expected:** Content should use full available width.
- **File:** src/frontend/styles/main.css (settings page layout)

### LOW

**L-1: Financials Budget Progress — hardcoded demo values**
- **Page:** Financials (#financials)
- **Detail:** Budget Progress shows $150/$200, $420/$500, $280/$300, $380/$400 — these appear to be hardcoded demo budget amounts for a zero-activity account.
- **Impact:** Low — budget feature may intentionally show preset goals.

**L-2: Plans & Billing breadcrumb missing ampersand**
- **Page:** Plans & Billing (#plans-billing)
- **Detail:** Breadcrumb shows "Plans Billing" instead of "Plans & Billing".
- **Also:** Pro plan says "Cross-list to all 6 platforms" but 9 platforms exist.

## Pages Status

| Page | Visual | Data | Interactions | Notes |
|------|--------|------|-------------|-------|
| Login | PASS | PASS | PASS | Form submit, Google/Apple OAuth buttons present |
| Dashboard | PASS | PASS | PASS | Daily Summary modal works, greeting correct |
| Inventory | PASS | PASS | PASS | Add Item modal comprehensive, 3 test items |
| Listings | PASS | PASS | PASS | N/A health score, empty state, all tabs present |
| Orders & Sales | PASS | PASS | — | Pipeline, empty state, all buttons present |
| Offers | PASS | PASS | — | Stats, empty state, filters |
| Automations | PASS | PASS | — | Scheduler healthy, N/A for no runs |
| Financials | PASS | ISSUE | — | Budget Progress hardcoded values |
| Analytics | ISSUE | ISSUE | — | Fake percentage badges |
| My Shops | PASS | ISSUE | — | Count mismatch, "Ebay" case |
| Planner | PASS | PASS | — | Timer, quick stats, empty state |
| Image Bank | PASS | PASS | — | Drop zone, storage stats, folders |
| Calendar | PASS | PASS | — | April 2026, today highlighted |
| Reports | PASS | PASS | — | Empty state |
| Community | PASS | PASS | — | Forum tabs, empty state |
| Help | PASS | PASS | — | 0 tickets, getting started, articles |
| Settings | ISSUE | ISSUE | PASS | Layout narrow, tier badge wrong |
| Account | PASS | ISSUE | — | Member Since N/A |
| Plans & Billing | PASS | PASS | — | AI counter works, breadcrumb minor |

## Responsive Testing
- Desktop (1440x900): Tested and verified
- Dark mode: Tested and verified — full theme switch working

## Previous Walkthrough Issues — Re-verification
From data/qa-report-2026-04-04-exhaustive.md (19 issues, 9 fixed in 4a24665):
- Dark mode: FIXED (verified)
- Mobile sidebar: Not re-tested (desktop only this session)
- N/A guards: FIXED (verified on multiple pages)
- Search: Not re-tested
- Remaining 10 issues were decision/external items — still pending
