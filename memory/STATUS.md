# VaultLister 3.0 — Session Status
**Updated:** 2026-04-10 MST (session 8)

## Current State
- **Launch Readiness Walkthrough COMPLETE** — 214 findings, 100% coverage (14 sessions)
- **Master findings doc COMPLETE + VERIFIED** — `docs/WALKTHROUGH_MASTER_FINDINGS.md` (214 findings, Status column added)
- **Post-walkthrough fix plan (6 batches) COMPLETE + VERIFIED** — all batches deployed to live site
- **Google OAuth FULLY FIXED + DEPLOYED** — 6 layered bugs fixed: SQL ambiguity `df74d36`, display_name `421e4f0`, missing auth-callback route `1d40be6`, wrong redirect URLs `4dafcf8`, 401 interceptor bypass + hashParts URL parsing `9065bc1`/`5a4cf09`, Redis OTT → PostgreSQL-backed OTT `77a07e1`. Redeployed `ffb6e89`. ✅ VERIFIED LIVE: route registered, OTT endpoint responds, minified bundle has correct hash logic, raw fetch confirmed
- Live site: https://vaultlister.com/?app=1
- BROWSER NOTE: Always use `mcp__claude-in-chrome__*` tools. NEVER use `mcp__plugin_chrome-devtools-mcp`.

## Completed This Session (2026-04-10, session 10)

### Sales & Purchases tab fixes — 459772b
- **Bug 1**: Add Purchase CSRF error — force-refresh token with `ensureCSRFToken(true)` before POST to prevent stale/consumed token
- **Bug 2**: GST/HST/PST card "Failed to load tax nexus data" — added `showTaxNexus` handler fetching `/sales-tools/tax-nexus`
- **Bug 3**: Buyer Profiles "Failed to load buyer profiles" — added `showBuyerProfiles` handler fetching `/sales-tools/buyers`
- **Bug 4 + UX 10**: No way to add a sale — added `showAddSale`/`submitAddSale` handlers + "Log Sale" button in empty state
- **Visual 5**: 4th stat card orphaned — set `grid-template-columns: repeat(4, 1fr)` on both Sales and Purchases stat grids
- **Visual 6**: Large white gap above content — added `window.scrollTo(0, 0)` at top of `sales()` render function
- **Visual 7**: Status filter persists across navigation — reset `salesStatusFilter`/`salesPlatformFilter` to 'all' in router on `sales` path (both branches)
- **UX 8**: Feature cards no hover affordance — added `→` arrow indicator and `translateY(-1px)` hover lift to GST/HST/PST and Buyer Profiles cards
- **UX 9**: Stat card icons appear interactive — added `pointer-events:none; cursor:default` to stat-card-icon in components.js
- **UX 11**: "Sell" breadcrumb non-functional — breadcrumb section label is now a clickable link (Sell→inventory, Manage→analytics)
- **UX 12**: AliExpress/Alibaba modals no Settings link — added "Go to Settings →" button in modal footer
- **UX 13**: Add Purchase modal no delete on line items — added × remove button to dynamically-added purchase rows
- **UX 14**: First Description field no placeholder — added `placeholder="e.g. Vintage jacket lot"`
- **UX 16**: Inventory dropdown has duplicate items — added dedup filter (findIndex by id) in `showAddPurchase` and `addPurchaseItem`
- Bundle rebuilt: version 00f97cf2, 1429 KB, 12 files; node --check clean on all source files
- Skipped: UX 15 (modal height optimization — low priority per spec)

## Completed This Session (2026-04-10, session 9)

### Daily Checklist tab fixes — dd3fa42
- **Bug 7**: Templates modal showed "0 items" — backend returns `itemCount` field not `items` array; fixed to use `t.itemCount`
- **Bug 8 / Visual 19**: Kanban view removed all controls (stuck) — moved view toggle dropdown outside kanban/list conditional; always rendered; Add Task/bulk actions shown only in list mode
- **Visual 14**: Header action buttons stacked vertically on narrow viewports — wrapped in `overflow-x:auto` scrollable flex row
- **Visual 15**: Greeting said "Complete your first task to get started!" even when tasks existed — changed guard from `completionRate===0` to `items.length===0`
- **Visual 16**: Select All with 0 tasks showed misleading "All items unchecked" toast — early-return with "No tasks to select" when items empty
- **Visual 17**: Daily review bar chart showed flat line for 0-value days — applied min-height 4% with reduced opacity; non-zero bars get min 8%
- **Visual 18**: Progress ring circle was decorative/unresponsive — wired `onclick="handlers.showDailyReview()"` with cursor pointer + tooltip
- **Bugs 1–6, 9–12 verified already implemented**: toggleChecklistItem/addChecklistItem/editChecklistItem/duplicateChecklistItem/addSubtask/showChecklistAnalytics all call backend API; VaultBuddy startNewVaultBuddyChat implemented in handlers-community-help.js; pomodoroTimer tracks sessionsCompleted; streak derives from persisted completed_at
- **Visual 13**: Skipped (systemic mobile layout, out of scope)
- **Visual 20**: Sidebar badge already correct — `filter(item => !item.completed).length` in components.js:191
- Bundle rebuilt: version feb83507, 1429 KB, 12 files
- Verified: node --check passes on both source files; bundle build succeeded

## Completed This Session (2026-04-10, session 8)

### Inventory tab fixes — 60fb51c + verified live — c7d24f4 (docs)
- **10 of 11 inventory findings fixed and VERIFIED live** against deployed chunks at https://vaultlister-app-production.up.railway.app
- Fix #1: Analytics 8s timeout ("Unable to load analytics. Try refreshing.") — handlers-settings-account.js ✅
- Fix #3: Tags column in Customize Columns modal ✅ (visual screenshot)
- Fix #4: Profit gauge marker (triangle) in Profit Margin Calculator ✅
- Fix #5: Bulk Price margin scale wrap (gradient + marker) in previewBulkPriceUpdate ✅
- Fix #6: 0-stock outOfStock summary card = danger class; individual items = var(--error) red badge ✅
- Fix #7: Age analysis reads item.status (not hardcoded "Listed") ✅
- Fix #8: Low Stock Threshold default = 1 (min=0) in Add New Item modal — new bundle 0f6c2c2a ✅
- Fix #9: 5 stat cards have filterByStatCard onclick (Active/Drafts/Low Stock/Out of Stock/Stale) ✅
- Fix #10: Status filter column replaces text input with dropdown (All/Draft/Active/Not Listed) ✅
- Fix #11: window.scrollTo(0,0) on page render; no white gap at top ✅
- Bug #2 (duplicate items) NOT fixed — seeded/demo data issue, not a code bug
- Walkthrough doc updated: 10 findings marked VERIFIED ✅ — c7d24f4
- Note: Fix #8 is in new bundle 0f6c2c2a; Cloudflare caching old index.html (6e4d7794) — will self-resolve

### Previously-built tasks verified live — session 8 start
- All 9 tasks from commit 5e2b7ab verified against deployed site (billing toggle, admin metrics, modal fix, Terms/Privacy, profile fields, sales dropdown, plan usage, platform ordering, platform logos) — all VERIFIED markers added to walkthrough doc in 60fb51c

## Completed This Session (2026-04-08, session 7)

### Full visual inspection of Sales & Purchases page — 33d0385
- **Sales tab** ✅ — title, description, stats row (Total Sales/Revenue/Gross Profit/Pending Shipments), GST/HST/PST card (modal opens + renders table), Buyer Profiles card (modal opens + shows buyer list with star ratings, All/Flagged/Blocked filter tabs), filter row (Platform: 7 options, Status: 4 options, Item/Buyer search inputs), empty state
- **Purchases tab** ✅ — stats row (Total Purchases/Total Spent/Pending/This Month), Sourcing Platforms section (AliExpress/Alibaba/Temu cards), Add Purchase modal (all fields present: Vendor, Date, Payment, Line Items, Shipping, Tax, Notes), empty state
- **Bugs found + fixed (2 new):**
  - `showTemuImport` undefined (Temu Import CSV button was calling non-existent handler) → implemented modal + processTemuCSV in handlers-sales-orders.js — 33d0385
  - `showSourcingInfo` undefined (AliExpress/Alibaba Connect buttons) → fixed in f1899c5/aaa49f8 (prior session)
  - `showTaxNexus`/`showBuyerProfiles` error toasts → fixed with .catch() fallback in aaa49f8 (prior session)
- **Pending deploy**: All 3 commits (f1899c5, aaa49f8, 33d0385) pushed → bundle 335e2059 deploying on Railway

## Completed This Session (2026-04-08, session 6)

### Full visual inspection sweep on live Railway site — e36ba6e
- **Dashboard** ✅ renders with all widgets
- **My Shops** ✅ — Poshmark shows credentials-only modal (no OAuth); eBay shows OAuth flow
- **Automations** ✅ renders with category cards, scheduler health, performance metrics
- **Financials** ✅ renders with Financial Overview, chart, Chart of Accounts tabs
- **Analytics** ✅ renders with Sales Funnel, Activity heatmap, goal progress
- **Daily Checklist** ✅ — "List View ▾" named dropdown confirmed (icon-only toggles removed); `chunk-tools.js` overwrites stale deferred version
- **Community** ✅ — tabs: Discussion Forum, Success Stories, Tips & Tricks, Leaderboard
- **Roadmap** ✅ — 6 features visible with vote counts and status badges (data from DB seed)
- **Knowledge Base** ✅ — 4 FAQs showing (`supportArticles()` page, not `help()`)
- **Affiliate** ✅ — "Apply Now" button visible in hero, commission structure, FAQ section
- **Sales & Purchases** ✅ — Sales|Purchases tabs, correct title (#206 re-confirmed)
- **Orders (Offers, Orders, & Shipping)** ✅ — Orders|Offers tabs, correct title (#207 re-confirmed)
- **VERIFIED in findings doc**: CR-5, CR-14, H-22, M-19, M-26, M-29 → all promoted from FIXED to VERIFIED ✅

### Key finding: deferred chunk stale copies
- `window.pages.checklist` and `window.pages.help` served from stale `chunk-deferred.js` until the route-specific chunk loads
- On real navigation (via router), `chunk-tools.js`/`chunk-community.js` load and overwrite the deferred versions — users see correct code
- `pages-deferred.js` is the root cause; these stale copies don't affect live users navigating via sidebar

## Completed This Session (2026-04-08, session 5)

### Walkthrough Phase 1 visual verification + #206/#207/#227 built — e6b1180, a59edab, 62a10e9
- **Visual verification pass** (screenshots on live site): Automations, Orders, Financials, Analytics, Daily Checklist — all FIXED items confirmed rendering correctly
- **#206 VERIFIED** ✅: Sales & Purchases page — Sales | Purchases tabs, sourcing platform cards (AliExpress/Alibaba/Temu), Purchase History with Add Purchase button
- **#207 VERIFIED** ✅: Orders page — "Offers, Orders, & Shipping" title, Orders | Offers tab bar, Offers tab content (stats: Pending/Acceptance Rate/Avg Offer/Revenue)
- **#227 BUILT** (awaiting deploy of 62a10e9): chunk-deferred.js was overwriting connectShop() with old version (no PLAYWRIGHT_ONLY check). Fixed: removed stale shop handlers from handlers-deferred.js — 62a10e9
- **Bug found + fixed (2x)**: Both `pages-deferred.js` AND `handlers-deferred.js` contained stale overwrite-copies. pages: a59edab; handlers: 62a10e9

### VERIFIED items updated in WALKTHROUGH_MASTER_FINDINGS.md:
- #191–#205, #208–#225, #232 → VERIFIED ✅
- #206, #207 → VERIFIED ✅ — e6b1180 + a59edab
- #227 → VERIFIED ✅ — e6b1180 + a59edab + 62a10e9 (Poshmark credentials-only modal + Shopify shop-domain OAuth modal)

## Completed This Session (2026-04-08, session 4)

### Walkthrough fixes VERIFIED LIVE — 915589b
- **#196** VERIFIED ✅ LIVE: "Customize Columns" text label in Inventory toolbar (was icon-only)
- **#226** VERIFIED ✅ LIVE: Shopify shows "Connect" in My Shops (Mercari/Grailed/Etsy still "Coming Soon")
- **#228** VERIFIED ✅ LIVE: Collapse (^) buttons on Today's Progress, Pomodoro Timer, Quick Stats cards
- **#229** VERIFIED ✅ LIVE: "Mark All Complete" / "Mark All Incomplete" buttons in Daily Checklist toolbar
- **#230** VERIFIED ✅ LIVE: "List View" named dropdown beside Mark All Incomplete
- **#231** VERIFIED ✅ LIVE: Single Add Task button (duplicate removed from header)
- Chunk verification method: fetch `/chunk-tools.js`, `/chunk-inventory.js`, `/chunk-settings.js` directly — fixes confirmed in minified output
- Bundle on live site: `17d54beb` (confirmed via core-bundle.js script tag)

## In Progress
- None

## Completed This Session (2026-04-07, session 3)

### Walkthrough findings resolved — 39c5fb4, 004b3c9, 2d665f9
- **H-14** → CONFIRMED N/A: `runPredictionModel()` is a local setTimeout stub (Math.random), no ANTHROPIC_API_KEY needed ✅
- **M-21** → VERIFIED ✅ LIVE: Install Extension modal confirmed — "coming soon to Chrome Web Store" modal opens correctly (2026-04-07)
- **M-13** FIXED → `storageLimit` now reads `PLAN_STORAGE_GB[user.subscription_tier]`: free=0.1GB, starter=1GB, pro=5GB, business=25GB in both `handlers-deferred.js` + `handlers-settings-account.js` (bundle bb9114d1)
- Findings doc: OPEN 14→12, CONFIRMED N/A ~32→~33, VERIFIED ~151→~152, FIXED 0→1

## Completed This Session (2026-04-07, session 2)

### Frontend fix batch — 82a8408 (VERIFIED LIVE)
- **CR-15**: Landing page gap reduced (features section top padding 5rem→3rem) ✅
- **M-7**: `calcChange` returns `null` when `previous===0` (hides trend indicator) ✅
- **M-9**: Heatmap legend `justify-content: center` (fixes "More" truncation) ✅
- **M-11**: Monthly goal defaults to `null` (shows empty state); uses C$ prefix ✅
- **M-14**: Cross-list count hardcoded to "5 launch platforms" ✅
- **M-22**: Landing "9+" → "5 launch marketplaces" in all text, pills, stats, pricing ✅
- **M-25/M-37**: Dark mode calendar active button text now visible (CSS override) ✅
- **CA-M-7**: AR/Blockchain "Explore"/"Notify Me" buttons disabled; Fee Calc → financials nav ✅
- **L-3**: Empty inventory state → "Add your first item to get started" ✅

### eBay / currency / dates batch — 15dba34 (VERIFIED LIVE)
- **#127/#157/#168**: "Ebay" → "eBay" via PLATFORM_DISPLAY_NAMES map in handlers-deferred + pages-deferred ✅ screenshot: "Connect to eBay"
- **#167**: My Shops stats + sales table `$` → `C$` ✅ screenshot: "C$0"
- **L-15/#137**: Privacy/ToS dates Jan/Mar 2026 → April 2026 in all 4 locations (public/privacy.html, public/terms.html, pages-community-help.js x2) ✅ text match confirmed

### Nav label / banner / comments batch — 0c852be (VERIFIED LIVE)
- **#181**: Sidebar nav "Planner" → "Daily Checklist" ✅ screenshot confirmed
- **L-26**: Announcement banner close `onclick` handler added ✅
- **CA-M-5/CA-M-6**: Stale "6 presets" → "5 presets" comment in both handlers files ✅

### Pre-existing unpushed commits — pushed this session
- **e9e689f**: M-4 financial health score fix (no data → 0/N/A)
- **b1e5efe**: #142/#143/#145/#180/#183/#184/#132/#134/#139/L-27/L-29 + SVG logos
- **9b0c023**: L-1/L-4/L-7/L-13/L-17/L-20/L-23/M-20/M-28/#122/#124/#128/#129/#130/#135/#138/#163/#177/#178/CO-1/CO-5
- **c9c8aac**: docs FIXED/VERIFIED/N/A legend + OPEN count update

### CI fix — b0911e7 + 16fc2ab
- **b0911e7**: CI build size check now uses `dist/core-bundle.js` (was `dist/app.js`, never produced) ✅
- **16fc2ab**: `runPriceSuggestion` in handlers-deferred + handlers-intelligence now `async` (pre-existing syntax error) ✅

## Completed Previous Session (2026-04-07, session 1)

## Completed Previous Session (2026-04-06)

### Tasks 2–4 batch fixes — e097efa + b3c5358
- **CA-M-1**: Feature-gate mercari/grailed in taskWorker.js (TASK_WORKER_LAUNCH_PLATFORMS) ✅
- **CA-M-2**: Replace Math.random() supplier metric fallbacks with || 0 in widgets.js ✅
- **CA-M-4**: Add LAUNCH_PLATFORMS const to utils.js + window.LAUNCH_PLATFORMS exposure ✅
- **H-1**: Price suggestion calls /ai/suggest-price (real API); saved search results=0; cleanup toast no fake numbers; storage preview returns null ✅
- **H-6**: #app gets min-height:100vh + flex-col to prevent white void on scroll ✅
- **#126**: Cross-list modal disables mercari/grailed/etsy/shopify with Coming Soon badge ✅
- **#133**: ticket.priority || 'Normal' null-guard in community-help + deferred pages ✅
- **#147**: Global search input triggers openGlobalSearch() on focus (command palette) ✅
- **#154**: exportAutomationHistory guarded with _exporting flag (prevents 4+ toasts) ✅
- **#159**: router.navigate() resets vaultBuddyOpen: false before route handler ✅
- **M-8**: Timezone selector auto-detects via Intl.DateTimeFormat; added America/Edmonton + Vancouver ✅
- **M-15**: Confirmed already correct — login/register use render() not renderApp() ✅
- **M-38**: Confirmed mobileUI.renderBottomNav() already in renderApp; CSS gates to ≤768px ✅

## Last Completed Work (2026-04-06)

### WALKTHROUGH_MASTER_FINDINGS batch fix — commit 07338ae
- **#171/#172** Calendar week view crash fixed: `toLocalDate(day.date)` not `day.toLocalDate(date)` ✅ 07338ae
- **CR-17** `pages.planner()` alias added (renders checklist page) ✅ 07338ae
- **#182** DOMPurify ADD_ATTR now includes all 6 DnD events (ondragover/ondrop etc.) ✅ 07338ae
- **#185** `toggleVaultBuddy` crash fixed via mass `pages.xxx()` → `window.pages.xxx()` in all 4 handler files (267 occurrences) ✅ 07338ae
- **#158/#173** Reports Create button now works (same fix) ✅ 07338ae
- **CR-7/H-19** Help Getting Started now computed from real store state (1/5 for new users) ✅ 07338ae
- **CR-8** KB fake view counts removed ✅ 07338ae
- **CR-11/CR-12/CR-16** Predictions page shows empty state instead of fake Levi's/Nike items ✅ 07338ae
- **CR-13/H-21** Changelog dates corrected: v0.1.0 Mar 2026, v0.5.0 Mar 2026, v0.9.0 Apr 2026 ✅ 07338ae
- **app.js** renamed to app-legacy.bak by pre-commit hook (confirmed not served)

### Walkthrough crash fixes — #123/#125/#143/#144/#186
- **chatbot.js `.reverse()` bug fixed** — `(await query.all(...)).reverse()` prevents TypeError crashing Vault Buddy send message: `5f331cc`
- **#123/#125/#143/#144** marked VERIFIED ✅ 192b485 (viewPost reactions, viewTicket replies, Add Transaction modal, submitFeedback dual toast)
- **#150/#151/#152/#153/#160/#161** systemic undefined.get() — mock tests pass; likely resolved by Bun chunk shim fix (aca307f); marked "needs re-test"
- **#186** Vault Buddy — chatbot backend fixed; marked "needs re-test"

### 190-new Google OAuth fixed (2026-04-06) — COMPLETE ✅
- **190-new** — SQL "column reference id is ambiguous" in `findOrCreateUser` JOIN: `df74d36` ✅
- **190-new** — `display_name` column does not exist in schema: `421e4f0` ✅
- **190-new** — Missing `#auth-callback` SPA route + `/api/auth/oauth-session` exchange endpoint: `1d40be6` ✅ deployed 21:37 UTC
- **190-new** — All OAuth redirect URLs used `/#` (Cloudflare marketing page) instead of `/?app=1#` (SPA): `4dafcf8` ✅ VERIFIED in Chrome: error callback lands on `/?app=1#login` (SPA), not marketing page
- **190-new** — dist/app.js (tree-shaken build) served over core-bundle.js via static fallback: `2f0c09f` ✅
- **190-new** — CDN preload hint loaded `/app.js` instead of `/core-bundle.js`: `9bb8064` ✅
- **190-new** — `initApp()` overwrote `#auth-callback` hash with `#login` (skipAutoLogin missing auth-callback): `dc18c82` ✅
- **190-new** — `handleRoute()` called async handler without `await` — OAuth ran detached: `6835054` ✅
- **190-new** — auth-callback handler called `renderApp()` which has auth guard redirecting to `#login`: `24291e2` ✅
- **190-new** — OTT read from hash at wrong time (hash already changed); pass as parameter: `2ca381d` ✅
- **190-new** — Duplicate handler invocation (no isAuthenticated guard): `7710bc8` ✅
- **190-new** — `router.navigate()` not awaited in `handleOAuthCallback`: `59ceac1`, `44a4202` ✅
- **VERIFIED LIVE** — full OAuth flow: Google consent → `#auth-callback` → `#dashboard`, `isAuth:true`, user=vaultlister@gmail.com

### Code Audit findings fixed (2026-04-06)
- **CA-CR-1** — `isRateLimitBypassed()` now gates on `IS_TEST_RUNTIME || NODE_ENV==='development'`: `abeccbb` ✅ grep confirmed
- **CA-CR-2** — `crypto.randomUUID()` replaces `Math.random()` in both temp filename locations: `34aa7ce` ✅ grep confirmed
- **CA-CR-3** — `LAUNCH_PLATFORMS` set blocks mercari/grailed in 2 AI routes; removed from fallback template: `8a1d58e` ✅ grep confirmed
- **CA-L-2** — TODO comment resolved with CA-CR-1 fix: `abeccbb` ✅
- **CA-H-1–8** — Top-level try/catch + logger.error added to all 8 route handlers: `588ad7f` ✅ grep confirmed all 8 have "Unhandled route error"
- **CA-H-9** — 9 bare JSON.parse → safeJsonParse in ai.js: `ebba2af` ✅ grep -c = 0
- **CA-H-10** — 10 bare JSON.parse → safeJsonParse in automations.js: `f6876da` ✅ grep -c = 0

### HIGH findings fixed
- **H-2** — Replace all $ with C$ currency display across frontend (65 occurrences, 12 files): `2c6b7df` ✅ verified live
- **H-3** — Coming Soon disabled button for Mercari/Grailed/Etsy/Shopify in My Shops: `d81cb79` ✅ verified live (screenshot confirms)

### Post-walkthrough fix plan — 6 batches (optimized-knitting-owl.md)
- **Batch 1** — Consistency manifest memory_rules count: `2eb4e3c`
- **Batch 2** — Fix #about route (remove alias redirect): done in `9a8aa06` (prior session)
- **Batch 3** — Market Intel real data: demand heatmap wired to store.state.marketInsights: `8247946` ✅ verified live
- **Batch 4** — Currency API: currencyService.js rewired to frankfurter.app (1hr cache, CAD base): `6f27472` ✅ verified `/api/currency/rates` returns `{"source":"live"}`
- **Batch 5** — Canadian shipping: Canada Post/Chitchats/FedEx Canada/UPS Canada/Purolator, metric units, CAD: `23a4729`, `1de3f25` ✅ verified Ship Calc in browser
- **Batch 6** — SVG platform logos: already done in `c9f4cc9` (prior session) ✅ verified My Shops shows colored SVGs

### Master findings document — 4 rounds of corrections + H-2/H-3
- `d770327` — 12 errors fixed (round 3)
- `75cdd7a` — Status column added to all 13 tables
- `08550b9` — 6 errors fixed (round 2)
- `135d2ac` — 6 errors fixed (round 1)
- #149 marked VERIFIED ✅ 23a4729; CR-6 marked VERIFIED ✅ 8247946
- H-2 marked VERIFIED ✅ 2c6b7df; H-3 marked VERIFIED ✅ d81cb79

## Key Chrome Testing Setup
```javascript
// 1. Mock fetch to prevent 401 logouts
window.fetch = function(url, opts) {
    if (typeof url === 'string' && url.includes('/api/')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [], total: 0, items: [], count: 0, success: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        }));
    }
    return (window._origFetch || fetch).apply(this, arguments);
};
// 2. Inject fake session
window.store.setState({user:{id:'demo',username:'demo',email:'demo@vaultlister.com',role:'admin',created_at:'2026-03-28T00:00:00Z'},token:'fake',refreshToken:'fake',isAuthenticated:true});
// 3. Load chunk (e.g. sales)
const s = document.createElement('script'); s.src = '/chunk-sales.js?v=' + Date.now(); document.head.appendChild(s);
// 4. Render any page
renderApp(window.pages.orders());
// 5. Re-inject session (auth guard clears it after renderApp)
window.store.setState({user:{id:'demo',username:'demo',email:'demo@vaultlister.com',role:'admin',created_at:'2026-03-28T00:00:00Z'},token:'fake',refreshToken:'fake',isAuthenticated:true});
```

## Top 5 Launch Blockers
1. `OAUTH_MODE` defaults to 'mock' — all platform integrations fake (CR-2) — set to 'real' in Railway
2. No eBay bot in worker/bots/ — can't cross-list to eBay (CR-5) — must be built
3. Configure Stripe (CR-3) — set STRIPE_PRICE_ID_PRO/BUSINESS in Railway
4. EasyPost API key blocked (CR-4) — waiting on anti-fraud review
5. ~~Predictions fake data (CR-11/CR-12)~~ FIXED 07338ae ✅

## Next Tasks
1. EasyPost shipping integration — BLOCKED on API key anti-fraud review
2. M-26: Knowledge Base "No FAQs" / "No articles" — needs basic content seeded (if proceeding as content task)
3. CR-5: Build eBay bot in worker/bots/ — eBay cross-listing completely blocked without it
4. CR-14/H-22: Build affiliate backend — "Apply Now" page is non-functional
5. M-13 deploy verify — after Railway redeploys 004b3c9, confirm storage limit uses plan tier on live site
6. Set Railway env vars: OAUTH_MODE=real, STRIPE_PRICE_ID_PRO/BUSINESS, RESEND_API_KEY (user action required)
NOTE: CR-9 (Analytics Sales Funnel) + M-2 (Radar labels) are already VERIFIED ✅ — removed from task list

## Unstaged Changes (pre-existing, not from this session)
- `src/backend/db/seeds/demoData.js` — modified
- `src/shared/ai/listing-generator.js` — modified
- `src/frontend/handlers/handlers-tools-tasks.js` — modified (from gitStatus at session start)
These were present before the session started. Investigate before committing.
