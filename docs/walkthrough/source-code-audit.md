# Source Code Audit — Walkthrough Findings

Discovered by automated source code scan of `src/`, `worker/bots/` (excluding legacy `app.js` and `core-bundle.js`). Date: 2026-04-05.

## Open Items

None — all source code audit findings have been resolved.

## Resolved

### CRITICAL — Code Audit

| ID | File:Line | Issue | Code Reference | Status |
|----|-----------|-------|----------------|--------|
| CA-CR-1 | `src/backend/middleware/rateLimiter.js:27-28` | Rate limiting DISABLED for production — `isRateLimitBypassed()` always returns `true`. Zero brute-force, API abuse, or DoS protection. **Fix:** Change `return true` to `return false` or use env gate. | `function isRateLimitBypassed() { return true; }` | VERIFIED ✅ — abeccbb |
| CA-CR-2 | `src/backend/services/platformSync/imageUploadHelper.js:48,138` | `Math.random()` in production image filenames — temp files are predictable, attackers can guess and access other users' temp images. **Fix:** Use `crypto.getRandomValues()`. | `'c-${Date.now()}-${Math.random().toString(36)}'` | VERIFIED ✅ — 34aa7ce |
| CA-CR-3 | `src/backend/routes/ai.js:73,75` | Mercari/Grailed in active AI templates — these are post-launch platforms. Code executes if triggered. **Fix:** Remove or wrap with feature flag. | `mercari: 'Stylish Fashion Item', grailed: 'Designer Streetwear'` | VERIFIED ✅ — 8a1d58e |
| CA-CR-4 | `src/backend/db/seeds/demoData.js:383-471` | `Math.random()` in demo order/tracking numbers (7 instances) — non-deterministic demo data. | `order_number: 'PSH-' + Math.random().toString(36).substr(2,8)` | VERIFIED ✅ — grep confirms 0 Math.random() in demoData.js (confirmed in source 2026-04-07) |
| CA-CR-5 | `app.js:29521` | "Cross-list to all 6 platforms" — legacy file, stale copy (not served but misleading) | `Cross-list to all 6 platforms` | CONFIRMED N/A — root-level app.js does not exist in this repo |

### HIGH — Code Audit

| ID | File:Line | Issue | Code Reference | Status |
|----|-----------|-------|----------------|--------|
| CA-H-1 | `src/backend/routes/analytics.js:28` | `analyticsRouter()` — no top-level try/catch. Unhandled errors crash route handler. | `export async function analyticsRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-2 | `src/backend/routes/automations.js:25` | `automationsRouter()` — no try/catch | `export async function automationsRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-3 | `src/backend/routes/barcode.js:7` | `barcodeRouter()` — no error boundary | `export async function barcodeRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-4 | `src/backend/routes/checklists.js:6` | `checklistsRouter()` — no try/catch | `export async function checklistsRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-5 | `src/backend/routes/community.js:22` | `communityRouter()` — no error handler | `export async function communityRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-6 | `src/backend/routes/currency.js:3` | `currencyRouter()` — no error boundary | `export async function currencyRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-7 | `src/backend/routes/emailOAuth.js:32` | `emailOAuthRouter()` — no try/catch. **OAuth-critical** — auth flows can crash silently | `export async function emailOAuthRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-8 | `src/backend/routes/extension.js:14` | `extensionRouter()` — no error handler | `export async function extensionRouter(ctx) {` | VERIFIED ✅ — 588ad7f |
| CA-H-9 | `src/backend/routes/ai.js:173,178,183,298,457,820,823,1145,1148` | 9 bare `JSON.parse()` calls in AI route — malformed JSON crashes handler, returns 500 instead of 400 | `analysisData = JSON.parse(responseText);` | VERIFIED ✅ — ebba2af |
| CA-H-10 | `src/backend/routes/automations.js:62,68,255,261,355,361,456,462` | 8 bare `JSON.parse()` calls on rule objects — unprotected. **Fix:** Use `safeJsonParse(str, {})`. | `rule.conditions = JSON.parse(rule.conditions or '{}');` | VERIFIED ✅ — f6876da |

### MEDIUM — Code Audit

| ID | File:Line | Issue | Code Reference | Status |
|----|-----------|-------|----------------|--------|
| CA-M-1 | `src/backend/workers/taskWorker.js:1160,1162` | Mercari/Grailed case statements active — should be feature-gated for post-launch | `case 'mercari': return await executeMercariBot(...)` | VERIFIED ✅ — e097efa |
| CA-M-2 | `src/frontend/ui/widgets.js:6132,6138,6139,6140` | Supplier metrics use `Math.random()` fallback — fake health/accuracy/delivery/quality scores on prod if data is missing | `Math.floor(Math.random() * 30) + 70` | VERIFIED ✅ — e097efa |
| CA-M-3 | `src/frontend/handlers/handlers-tools-tasks.js:344` | Tag randomization uses `Math.random()` | `sort(() => 0.5 - Math.random())` | VERIFIED ✅ — grep confirms 0 Math.random() in handlers-tools-tasks.js (confirmed in source 2026-04-07) |
| CA-M-4 | `src/frontend/core/utils.js:11-20` | `SUPPORTED_PLATFORMS` lists all 9 platforms — Canada launch = 5 only. **Fix:** Create `LAUNCH_PLATFORMS` filter constant. | Lists poshmark, ebay, mercari, depop, grailed, etsy, shopify, facebook, whatnot | VERIFIED ✅ — e097efa |
| CA-M-5 | `src/frontend/handlers/handlers-tools-tasks.js:3803` | Comment says "6 platform presets" — stale | `// 6 platform-specific presets` | VERIFIED ✅ — 0c852be — comment updated to "5 platform-specific presets" |
| CA-M-6 | `src/frontend/handlers/handlers-deferred.js:21168` | Comment says "6 platform presets" — stale | `// 6 platform-specific presets` | VERIFIED ✅ — 0c852be — comment updated to "5 platform-specific presets" |
| CA-M-7 | `src/frontend/pages/pages-intelligence.js:1826,1914` | "Coming soon" toast messages in production pages | `toast.info('...coming soon.')` | VERIFIED ✅ — 82a8408 |
| CA-M-8 | `src/shared/ai/listing-generator.js:167,180,185,189` | `Math.random()` in template selection (4 instances) — non-deterministic listing generation | `templates.intro[Math.floor(Math.random() * length)]` | VERIFIED ✅ — grep confirms 0 Math.random() in listing-generator.js (confirmed in source 2026-04-07) |
| CA-M-9 | `src/frontend/ui/widgets.js:6132,6138,6139,6140` | Supplier metrics `Math.random()` fallback (duplicate reference) — `healthScore`, `orderAccuracy`, `onTimeDelivery`, `qualityRating` all generate fake "good" values (90-95% range) if DB fields missing | `const healthScore = supplier.health_score \|\| Math.floor(Math.random() * 30) + 70` | CONFIRMED N/A — widgets.js supplier metric fallbacks already use ?? null (no Math.random), fixed in prior session |

### LOW — Code Audit

| ID | File:Line | Issue | Status |
|----|-----------|-------|--------|
| CA-L-1 | `src/backend/db/database.js:328` | TODO comment: "Phase 3: implement tsvector full-text search" — incomplete feature | VERIFIED ✅ — grep confirms no matching TODO in database.js (confirmed in source 2026-04-07) |
| CA-L-2 | `src/backend/middleware/rateLimiter.js:27` | TODO comment: "Re-enable for production release" — advisory only (root issue is CA-CR-1) | VERIFIED ✅ — abeccbb |

## Undocumented Fixes (Part 3 — Found in git history)

Fixes applied to the codebase that were never formally logged as findings. Discovered by cross-referencing the full git commit history against this document.

### CRITICAL / HIGH — Undocumented

| ID | Component | Description | Commit | Status |
|----|-----------|-------------|--------|--------|
| U-1 | App-wide / Deferred Chunk | `chunk-deferred.js` only loaded on ar-preview navigation — 172 handler functions unavailable on initial page load, causing `handlers.xxx is not a function` errors throughout the app whenever any modal or inline onclick ran before the deferred chunk loaded. Fixed by preloading `chunk-deferred.js` after first render on every startup. | `e9f163e` | VERIFIED ✅ — e9f163e — loadChunk('deferred') confirmed in core-bundle.js after first render |
| U-2 | Dashboard / Handlers | `exportDashboard` method missing closing `}` — syntax error caused `syncPlatformPrices`, `togglePlatformPricing`, `markPriceCustomized`, `updateSizeOptions`, `validateCustomSize` to be parsed as local labels inside `exportDashboard`, making them unreachable from `window.handlers`. | `1ddd980` | VERIFIED ✅ — 1ddd980 — grep confirms togglePlatformPricing at object level |
| U-3 | Modals / Handlers Core | `togglePlatformPricing`, `syncPlatformPrices`, `markPriceCustomized`, `updateSizeOptions`, `validateCustomSize` only existed in deferred chunks but are called from inline `oninput`/`onchange` handlers in `modals.js` (core bundle). Add Item modal crashed with `handlers.syncPlatformPrices is not a function` when deferred chunk hadn't loaded yet. Fixed by moving these 5 handlers to `handlers-core.js`. | `7466692` | VERIFIED ✅ — 7466692 — functions confirmed in core-bundle.js (18 references) |
| U-4 | Settings / Utils | `sanitizeHTML()` not exposed on `window` — deferred `chunk-settings.js` threw `ReferenceError: sanitizeHTML is not defined` on settings save. Fixed by adding `window.sanitizeHTML = sanitizeHTML` export at end of `utils.js`. | `c6cdaac` | VERIFIED ✅ — c6cdaac — window.sanitizeHTML confirmed in core-bundle.js |
| U-5 | Add Item / Widgets | `autoSave` not exposed on `window` — deferred chunks threw `ReferenceError: autoSave is not defined` on Add Item form submit. `autoSave` was `const`-scoped in `widgets.js`, invisible to deferred chunks. Fixed by adding `window.autoSave = autoSave` export. | `2d8d871` | VERIFIED ✅ — 2d8d871 — window.autoSave confirmed in core-bundle.js |

### HIGH / MEDIUM — Undocumented (Dashboard walkthrough batch)

| ID | Component | Description | Commit | Status |
|----|-----------|-------------|--------|--------|
| U-6 | Dashboard | 9 visual issues discovered in manual walkthrough: (1) `refreshDashboard`/`setDashboardPeriod` navigated/toasted even when user had left the dashboard mid-refresh — added page guard; (2) widget container switched from flex to 6-col CSS grid; (3) collapsed widgets span 2 cols with compact header; (4) missing bar-chart-2 icon button on each stat card header; (5) export dropdown `.show` CSS failed to override base opacity/visibility; (6) `.dashboard-widget .card-body` missing `min-width:0; overflow-x:auto`; (7) dashboard-customize-section `flex-end` → `flex-start`; (8) Quick Notes icon `edit-3` (nonexistent in feather) → `file-text`; (9) Dashboard moved to unnamed top section in sidebar navItems. | `41f8e91` | VERIFIED ✅ — 41f8e91 — bundle rebuilt (v60815404); syntax clean |

### MEDIUM — Undocumented

| ID | Component | Description | Commit | Status |
|----|-----------|-------------|--------|--------|
| U-7 | Analytics / Orders | Horizontal overflow at ≤768px on `.analytics-hero` and `.orders-hero` — content spilled outside viewport on mobile. Fixed by adding `overflow-x: hidden` and `max-width: 100%` rules in `main.css` at ≤768px breakpoint. | `6cb6a02` | VERIFIED ✅ — 6cb6a02 — main.css overflow-x fixes confirmed |
| U-8 | Dashboard | `.dashboard-hero` and `.dashboard-hero-content` lacked `max-width` and `overflow: hidden` — hero section overflowed on narrow mobile viewports (≤768px). Fixed in `main.css`. | `6cb6a02` | VERIFIED ✅ — 6cb6a02 — main.css dashboard-hero overflow:hidden confirmed |
| U-9 | Settings / Account | 5 `<select>` elements in the Data Retention section of `pages-settings-account.js` were missing `name=` attributes — form values could not be read by form serialization or submitted correctly. | `6cb6a02` | VERIFIED ✅ — 6cb6a02 — name= attrs added to all 5 data retention selects |
| U-10 | App-wide / Platforms | 7 files each had local hardcoded platform arrays (`['poshmark','ebay',...]`) instead of using the shared `SUPPORTED_PLATFORMS` constant from `utils.js` — platform lists could silently diverge. Fixed in `handlers-settings-account.js`, `handlers-core.js`, `handlers-sales-orders.js` (×2), `pages-settings-account.js`, `pages-intelligence.js`, `pages-deferred.js` (×2). | `6cb6a02` | VERIFIED ✅ — 6cb6a02 — SUPPORTED_PLATFORMS now used across all 7 files |
| U-11 | Analytics / Dashboard / Modals | 5 systemic QA issues: (A) analytics page chunk not in chunk map — analytics page handlers unavailable; 3 cross-chunk handlers moved to core; (B) `refreshDashboard` and `exportDashboard` moved to core bundle so they are available before deferred load; (C) `setMonthlyGoal` and `showColumnPicker` refactored to use `modals.show()` instead of direct DOM manipulation. | `77305b7` | VERIFIED ✅ — 77305b7 — build succeeded (v03c031c6); no double-definitions in chunks |
| U-12 | Responsive / Sidebar | Mobile sidebar layout broken — `menu-button` had `display:none` locked at desktop, `.mobile-open` state not applied, `mobile-header` missing from DOM. Fixed by removing desktop lock, fixing `.mobile-open` CSS, adding `mobile-header` element. | `77305b7` | VERIFIED ✅ — 77305b7 — mobile sidebar shows correctly after fix |
| U-13 | Accessibility / Modals | Two buttons missing `aria-haspopup` attribute (ARIA compliance); modal container missing `inert` attribute on background content during modal open (focus trap incomplete). Fixed in `77305b7`. | `77305b7` | VERIFIED ✅ — 77305b7 — aria-haspopup added; inert set during modal open |
