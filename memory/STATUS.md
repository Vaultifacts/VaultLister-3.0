# VaultLister 3.0 — Session Status
**Updated:** 2026-05-01 MST

## Current State
- **Live site:** https://vaultlister.com/?app=1
- **7 live platforms** — Grailed promoted from Coming Soon. Shopify OAuth fully configured (CLIENT_ID/SECRET/REDIRECT_URI in Railway).
- **Launch Readiness Walkthrough COMPLETE** — all 185 findings fixed + VERIFIED across 15 sessions. Remaining open items are external blockers only (CR-10, CR-4).
- **Google OAuth FULLY FIXED + DEPLOYED** — 6 layered bugs fixed, VERIFIED LIVE: route registered, OTT endpoint responds, correct hash logic, raw fetch confirmed.
- **Post-walkthrough fix plan (6 batches) COMPLETE + VERIFIED** — all batches deployed to live site.
- **19 open GitHub issues** — dependabot CI failures ×5, automation workflow failures ×4, infra/observability alerts ×4, other ×6. Needs triage.
- **Active task backlog:** `docs/OPEN_ITEMS.md` (generated). `docs/superpowers/plans/2026-05-01-fake-data-audit.md` COMPLETE — all 73 tracked findings resolved (committed). `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md` is historical — do not use as active plan.
- **BROWSER NOTE:** Always use `mcp__claude-in-chrome__*` tools. NEVER use `mcp__plugin_chrome-devtools-mcp`.

## Last Completed Work (2026-05-01 session 3)

### Automations/Webhooks/Supplier UI cleanup batch (commits 18d0ab11 + prior session)
- **[Image #8] Calendar + Performance buttons removed** from Automations page header (keep History only)
- **[Image #7] Scheduler Health dead code removed** — scheduler status API loader + `renderSchedulerWidget` function deleted (element id was never rendered in the automations HTML; pure dead code)
- **[Reports] Supplier Monitoring tab removed** from Reports page tab bar + supplier content branch deleted
- **[Suppliers] Suppliers page hidden on production** — IS_PROD guard added to `suppliers()`: redirects to `#analytics` on non-localhost; matches DEV_ONLY_TABS treatment
- **[Global] Image Vault rename COMPLETE** — parallel session committed 4dcfdd7d→fa49ec24; all Image Bank → Image Vault across backend, frontend, tests, docs, public HTML, comments, nav items, routes, bundle
- **[Image #12] Lookup + Tools buttons removed** from Inventory page header (commit 63f0150d from prior session)
- **Fake-data audit 100% COMPLETE** — 73/73 findings resolved (from prior session)

## Last Completed Work (2026-05-01 session 2)

### UI cleanup batch — landing/settings/checklist/listings/inventory (uncommitted local work)
- **Landing / pricing counts**: landing Coming Soon section now shows exactly 4 cards (Kijiji, Etsy, Mercari, Vinted) and public/app pricing copy uses 7 platforms.
- **Settings integrations marketplace grid**: Integrations now uses the landing/platform page order and compact vinyl-style marketplace cards; browser smoke verified live/coming-soon order and visible region suffixes.
- **Webhooks**: removed the Settings integrations Webhooks card, aliased `#webhooks` back to Settings/Integrations, and rebuilt bundles so the standalone Webhook Management page is hidden.
- **Checklist tabs**: `switchChecklistTab` now refreshes the active page content directly; browser smoke verified Completed tab click updates state and active tab styling.
- **Checklist incomplete action**: registered the shared `square` icon and the "Mark All as Incomplete" button now renders an empty square SVG instead of the unicode placeholder.
- **Connections email cards**: Gmail and Outlook unconfigured states now use Coming Soon copy/styling instead of "OAuth not configured" / "Unavailable".
- **Listings platform prices**: expanded Platform Prices list dedupes by platform while preserving the currently expanded listing for duplicate platforms.
- **Inventory stock badges**: Out of Stock row badges now carry `inventory-stock-out` styling for the faint red highlight.
- **Facebook connect dialog**: rebuilt `dist/chunk-settings.js`; browser smoke verified Facebook shows only manual connect, with no OAuth button/copy/divider.
- **Verification**: `bun run build`, `bun run lint`, `bun run open-items:check`, and targeted Playwright smoke checks pass on `http://localhost:3000`.

### Tracking system audit — 26 flaws fixed (commits f8eadc8e→86cd3081)
- **Flaw 27**: `normalizeForCheck` now strips GitHub Open Issues section — `open-items:check` is deterministic in CI (no longer fails on live issue timestamp changes)
- **Flaw 28**: `open-items-check.yml` watch paths widened to include 5 source files that feed the generator
- **Flaw 33**: Added `labeled` event to `add-to-project.yml` — issues labeled post-creation now added to project boards
- **Flaw 38**: Documented `- [~]` won't-fix convention in `parseUncheckedFile` comment
- **Flaw 39**: Created `docs/reference/env.md` — 83-var reference grouped by required/optional. Resolves R-018 from deep-dive-backlog.
- **Flaw 41**: Confirmed non-issue — `rg` is pre-installed on ubuntu-latest
- **Still manual**: Flaw 34 (renew `ADD_TO_PROJECT_TOKEN` secret), Flaw 40 (pin unpinned action SHAs in 5 workflows — needs `pin-github-actions` tool, not safe to fabricate SHAs)

## Last Completed Work (2026-05-01)

### Display bug sweep — My Shops, Automations, Image Bank (2026-05-01, commits d75873da→273a1003)
- **Grailed "Coming Soon" fix**: was showing Coming Soon badge despite being a launched platform. Root cause: stale `dist/chunk-deferred.js` in Docker container (built 2 weeks prior, missing LAUNCH_PLATFORMS logic). Fixed by touching `init.js` to change hash, rebuilding all chunks (`bun run build`), and `docker cp` into container. **VERIFIED LIVE 2026-05-01** — production DOM confirms `"Grailed (CA) Not connected Connect"` at `vaultlister.com/?app=1#shops`.
- **`getShopHealthScore` null crash**: accessing `.health_score` on `undefined` when `shops.find()` returns undefined for unconnected platforms. Fixed with `shop ? ... : null` guard.
- **Automations page**: clean — 8 automations render correctly (Grailed/Poshmark/Depop/Facebook/Mercari), no undefined/NaN/placeholder text, all section headings present.
- **Image Bank page**: clean — proper empty state, search input, stats (0 Total/Folders/Tagged), no broken images.
- **Settings handlers**: `saveShopBranding` and `saveMultiShopSyncSettings` wired to real PUT /api/shops/:platform API calls (were state-only). Committed in `273a1003`.

### Hide dev-only Analytics tabs on production (2026-05-01, commit d5426e06→d75873da)
- **Predictions**, **Market Intel**, and **Supplier Analytics** analytics tabs are now hidden on the live site but remain visible on localhost for development.
- Implementation: `src/frontend/pages/pages-core.js` — `IS_PROD` flag (`hostname !== 'localhost'`) merges `DEV_ONLY_TABS = ['predictions', 'market-intel', 'sourcing']` into `hiddenTabs` and `removedAnalyticsTabs` when running in production.
- Bundle rebuilt → committed → Railway forced-deploy (CI watch-path skipping required manual "Deploy commit" each time).
- **VERIFIED LIVE**: `vaultlister.com` shows 6 tabs (Graphs, Heatmaps, Ratio Analysis, Product Analysis, Financials Analytics, Inventory); localhost shows all 9.
- To re-enable a tab on production, remove it from `DEV_ONLY_TABS` in `pages-core.js` and rebuild the bundle.

### Fake-data removal — batches 1–3 + live verification (commits 744a80fd→8016d058)
- F26/F27/F28: budget progress widget and demand heatmap render from real data only
- F33/F34: notification settings read from store state — no more hardcoded checked=true
- F35/F36/F37/F40/F42/F44: syncAllShops, saveRoadmapSubscription, shop health derived from real state
- F49: automation run history shows real API data or empty — removed 6-item mock fallback
- F50: competitor activity refresh calls real /api/market-intel/competitors
- P0-pub-1/P0-pub-4/P1-pub-3/P3-pub-2/P3-pub-5: all VERIFIED LIVE ✅
- P3-pub-11/P3-pub-12/P1-pub-1: search bars + sidebar logo added and deployed

### Task tracking system improvements (2026-05-01)
- 109 fake-data findings promoted from STATUS.md to `docs/superpowers/plans/2026-05-01-fake-data-audit.md`
- `bun run open-items` regenerated — 74 findings now tracked in `docs/OPEN_ITEMS.md`
- `open-items:check` passes — OPEN_ITEMS.md is current
- `.github/stale.yml` — added `automated`, `ci-failure`, `launch-checklist` to exemptLabels
- `.github/workflows/open-items-check.yml` — new CI workflow enforces OPEN_ITEMS.md is never stale

## Top Launch Blockers
1. **CR-4 EasyPost** — OPEN / NOT VERIFIED — 2026-04-22 live returned `503 {"error":"EasyPost not configured"}`
2. **CR-10 OAuth** — eBay + Shopify init verified live 2026-04-22; Depop `/api/oauth/authorize/depop` returns 503; Poshmark/Mercari/Grailed/Whatnot manual Playwright credential flows unverified

## Next Tasks

**IMMEDIATE — 109 Fake-Data Findings**
See `docs/superpowers/plans/2026-05-01-fake-data-audit.md` — 74 open items tracked in `docs/OPEN_ITEMS.md`.
Priority order: CRITICAL (F77/F108/F61) → HIGH state-only (F103/F104/F109/F58/F74...) → HIGH fake ops (F101/F102/F62...) → MEDIUM → LOW.

**UI / LANDING PAGE FIXES**
- [Image #1] DONE LOCAL 2026-05-01 — Landing page Coming Soon section shows "4 More on the Way" with Kijiji, Etsy, Mercari, Vinted only.
- [Image #2] DONE LOCAL 2026-05-01 — Settings Integrations marketplace grid now matches landing/platform order and uses compact vinyl-style cards; browser smoke verified country abbreviations are visible.
- [Image #3] DONE CURRENT 2026-05-01 — Landing footer social icons are non-white in current browser verification (`rgb(17, 17, 17)` inherited by SVG fill/stroke on white background); no code edit needed.
- [Image #4] PARTIAL DONE LOCAL 2026-05-01 — Webhooks button removed and `#webhooks` hidden/aliased. Listing Defaults and Photo Settings still need current browser verification before closing the full item.
- [Image #5] DONE LOCAL 2026-05-01 — My Listings expanded Platform Prices dedupe by platform and preserve the expanded/current listing.
- [Image #6] DONE CURRENT 2026-05-01 — Sales & Purchases route browser smoke verified no "Buyer Profiles" / "Manage buyer relationships" section remains.
- [Image #7] DONE CURRENT 2026-05-01 — Automations route browser smoke verified no Scheduler Health, Schedule Settings, or Notification Preferences sections remain.
- [Image #8] DONE CURRENT 2026-05-01 — Automations route browser smoke verified no Calendar or Performance sections/buttons remain.
- [Image #9] DONE LOCAL 2026-05-01 — Daily Checklist tab switching rerenders page content; browser smoke verified Completed tab click.
- [Image #10] DONE LOCAL 2026-05-01 — Daily Checklist "Mark All as Incomplete" renders an empty square SVG icon; browser smoke verified no unicode checkbox placeholder remains.
- [Global] DONE LOCAL 2026-05-01 session 3 — Image Bank → Image Vault rename complete across all files (commits 4dcfdd7d→fa49ec24)
- [Image #11] DONE LOCAL 2026-05-01 — Facebook Marketplace connect dialog now shows manual connect only in rebuilt settings chunk.
- [Image #12] DONE CURRENT 2026-05-01 — Inventory route browser smoke verified hero actions are Bundle, Restock, Alerts, Add Item; no Lookup/Tools hero buttons remain.
- [Image #13] DONE LOCAL 2026-05-01 — Inventory Out of Stock labels now use faint red `inventory-stock-out` badge styling.

**WALKTHROUGH FINDINGS (2026-05-01 browser audit — new)**
- [Inventory] DONE CURRENT 2026-05-01 — Current Inventory catalog route has no legacy `.inv-tab-btn` sub-tabs; Analytics page Inventory tab click sets `analyticsTab='inventory-analytics'` and renders Stock Status Breakdown.
- [Inventory] VERIFIED ROOT CAUSE 2026-05-01 — live/demo inventory has 134 draft security payload rows (`CSRF Reuse Test 1`, `<img src=x>`, `admin'--`) across 461 scanned records. Root cause: `src/tests/security.test.js` inventory mutation tests wrote through the local app while `.env` pointed at Railway (`gondola.proxy.rlwy.net`). Local test patch now skips inventory mutations on remote DB/remote target and tracks/deletes created rows on safe local/CI DBs. Existing live cleanup remains pending explicit approval because it deletes production records.
- [Webhooks] DONE LOCAL 2026-05-01 — `#webhooks` aliases back to Settings/Integrations; standalone Webhook Management UI is hidden in browser smoke.
- [Connections] DONE LOCAL 2026-05-01 — Gmail/Outlook unconfigured email cards now show "Coming soon" status and "Coming Soon" disabled action; browser smoke verified no "OAuth not configured" / "Unavailable" text remains.
- [Analytics] DONE CURRENT 2026-05-01 — Analytics route browser smoke verified the "No prior data" pill is not present.
- [Automations] DONE CURRENT 2026-05-01 — Automations route browser smoke verified "A/B Experiments" is not present.
- [Daily Checklist] DONE LOCAL 2026-05-01 — Tab switching rerender issue fixed; tabs work when clicked within the same page render.
- [Reports] DONE CURRENT 2026-05-01 — Reports route browser smoke verified Supplier Monitoring is not present.
- [Suppliers] DONE LOCAL 2026-05-01 session 3 — suppliers() page IS_PROD guard added; redirects to #analytics on production
- [Plans & Billing] DONE LOCAL 2026-05-01 — Plan cards and public pricing copy now say 7 platforms.
- [Account] DONE CURRENT 2026-05-01 — `#account` browser smoke verified Current Password uses `autocomplete="current-password"` and both new-password fields use `autocomplete="new-password"`.
- [Image #11 — DIST REBUILD DONE LOCAL 2026-05-01] `dist/chunk-settings.js` rebuilt; Facebook manual-connect-only dialog verified locally. Still needs deploy/live verification before closing as production-fixed.

**PRE-EXISTING**
0. Use `docs/OPEN_ITEMS.md` as the active task backlog — REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md is historical evidence only.
0. [OPTIONAL] Richer sale path test — sale with non-zero payment_fee + packaging_cost + inventory-linked item; verify all 5 ledger rows fire.
0. [WATCH] Financial regression: (a) no accounting-statement labels reintroduced, (b) new ledger paths don't skip non-zero amounts, (c) no tax schema/copy creep, (d) no duplicate rows on retry/edit.
1. CR-4: EasyPost shipping integration — OPEN / NOT VERIFIED
2. CR-10: Connect flows for remaining platforms — Depop 503, Poshmark/Mercari/Grailed/Whatnot unverified

**TRACKING SYSTEM (remaining flaws to address)**
- Renew `ADD_TO_PROJECT_TOKEN` GitHub secret — project boards not updating (all 3 recent workflow runs failed)
- Add `Fixes #N` commit convention to `.husky/commit-msg` — zero issues linked in 200+ commits
- Slim `docs/open-items/items.json` — promote remaining STATUS.md-class tasks into items.json or walkthrough docs
- Add agent-readable structure to `.github/ISSUE_TEMPLATE/` files

> Run `git status` for current working tree. Run `bun run open-items:check` to verify OPEN_ITEMS.md is current.

## Key Chrome Testing Snippet
```javascript
// Mock fetch to prevent 401 logouts
window.fetch = function(url, opts) {
    if (typeof url === 'string' && url.includes('/api/')) {
        return Promise.resolve(new Response(JSON.stringify({ data: [], total: 0, items: [], count: 0, success: true }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        }));
    }
    return (window._origFetch || fetch).apply(this, arguments);
};
// Inject fake session
window.store.setState({user:{id:'demo',username:'demo',email:'demo@vaultlister.com',role:'admin',created_at:'2026-03-28T00:00:00Z'},token:'fake',refreshToken:'fake',isAuthenticated:true});
// Load a chunk and render
const s = document.createElement('script'); s.src = '/chunk-sales.js?v=' + Date.now(); document.head.appendChild(s);
renderApp(window.pages.orders());
// Re-inject session (auth guard clears it after renderApp)
window.store.setState({user:{id:'demo',username:'demo',email:'demo@vaultlister.com',role:'admin',created_at:'2026-03-28T00:00:00Z'},token:'fake',refreshToken:'fake',isAuthenticated:true});
```
