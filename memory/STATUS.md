# VaultLister 3.0 — Session Status
**Updated:** 2026-05-01 MST

## Current State
- **Live site:** https://vaultlister.com/?app=1
- **7 live platforms** — Grailed promoted from Coming Soon. Shopify OAuth fully configured (CLIENT_ID/SECRET/REDIRECT_URI in Railway).
- **Launch Readiness Walkthrough COMPLETE** — all 185 findings fixed + VERIFIED across 15 sessions. Remaining open items are external blockers only (CR-10, CR-4).
- **Google OAuth FULLY FIXED + DEPLOYED** — 6 layered bugs fixed, VERIFIED LIVE: route registered, OTT endpoint responds, correct hash logic, raw fetch confirmed.
- **Post-walkthrough fix plan (6 batches) COMPLETE + VERIFIED** — all batches deployed to live site.
- **19 open GitHub issues** — dependabot CI failures ×5, automation workflow failures ×4, infra/observability alerts ×4, other ×6. Needs triage.
- **Active task backlog:** `docs/OPEN_ITEMS.md` (generated) + `docs/superpowers/plans/2026-05-01-fake-data-audit.md` (109 findings). `docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md` is historical — do not use as active plan.
- **BROWSER NOTE:** Always use `mcp__claude-in-chrome__*` tools. NEVER use `mcp__plugin_chrome-devtools-mcp`.

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
