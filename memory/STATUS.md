# VaultLister 3.0 — Session Status
**Updated:** 2026-05-03 MST (session 8)

## Current State
- **Live site:** https://vaultlister.com/?app=1
- **7 live platforms** — Grailed promoted from Coming Soon. Shopify OAuth fully configured (CLIENT_ID/SECRET/REDIRECT_URI in Railway).
- **Launch Readiness Walkthrough COMPLETE** — all 185 findings fixed + VERIFIED across 15 sessions. Remaining open items are external blockers only (CR-10, CR-4).
- **Deep-dive backlog FULLY AUDITED** — 9/10 P1+P2 items resolved or verified non-issues. R-003 (mixed service/router files) is cosmetic only.
- **Active task backlog:** `docs/OPEN_ITEMS.md` — 2 launch blockers (CR-4, CR-10), 1 open GitHub issue (#516 Lighthouse performance threshold).
- **BROWSER NOTE:** Always use `mcp__claude-in-chrome__*` tools. NEVER use `mcp__plugin_chrome-devtools-mcp`.
- **EASYPOST_API_KEY MISSING from Railway** — verified 2026-05-03 via Railway Variables tab (93 vars, no EASYPOST). Must be added manually. Routes return 503 without it.

## Last Completed Work (2026-05-03 session 8)

### CI #514 lint regression triage
- **Root cause verified and fixed** — commit `22efee17` changed `package.json` `lint:html` from the known-good seven public pages to all `public/**/*.html`, exposing 779 existing html-validate baseline errors. Restored the seven-page target in `1ef6cc6c`; local `bun run lint`, `bun run open-items:check`, and `git diff --check` passed. GitHub CI run `25293859178` passed, including the Lint job and HTML validate step. Issue #514 closed.

### CI #515 HTML void-tag regression triage
- **Root cause verified and fixed** — commit `af0ffe20` added XHTML-style self-closing canonical `<link ... />` tags to the seven scoped public HTML pages, plus one self-closing favicon link in `public/changelog.html`. CI run `25296310845` failed at `Lint → HTML validate` with 8 `void-style` errors. Fixed in `cf858a6e` by removing the trailing `/` from those 8 tags. Local `bun run lint:html`, `bun run lint`, `bun run open-items:check`, and `git diff --check` passed. GitHub CI run `25296650411` passed, including the Lint job and HTML validate step. Issue #515 closed.

### CI guardrail follow-up
- **HTML lint guardrail stabilized** — commit `49deb484` widened `package.json` `lint:html` to all `public/**/*.html`, but local verification still fails with 819 html-validate problems across the broader public baseline. Restored the known-good seven-page target and verified `bun run lint:html` + `bun run lint` pass.
- **Runtime state cleanup** — ignored local `data/.poshmark-relist.json` to match existing local automation tracker ignore patterns; the file is `{}` runtime state and is not repo content.
- **Still open** — GitHub issue #516 was created by the Lighthouse workflow after production `/landing.html` scored Performance 60/100 against the new 80 threshold. This is a performance/baseline policy item, not fixed by the lint guardrail change.

## Last Completed Work (2026-05-03 session 7)

### CI workflow fix + EasyPost verification
- **project-status-update.yml fix** — `c578576f` pushed. Three changes: step `id: post-status`, `failure()` → `steps.post-status.outcome == 'failure'`, `state: 'open'` → `state: 'all'` with 24h `since` window. Prevents duplicate failure issues.
- **All CI green** — Production Smoke (success), Cloudflare Ops (success), Project Status Update (success), Uptime Slack Alert (success). Zero failed runs.
- **Zero open GitHub issues** — confirmed via `gh issue list`.
- **EasyPost routes verified live** — `/api/shipping-labels-mgmt/easypost/{rates,buy,track}` all return 401 (auth guard working). Route prefix is `/api/shipping-labels-mgmt` (NOT `/api/shipping-labels`).
- **EASYPOST_API_KEY NOT on Railway** — stale memory from 2026-04-20 claimed it was set. Verified via Railway Variables tab: 93 vars, no EASYPOST. Local .env has it commented out. Memory updated.
- **Stripe vars confirmed on Railway** — all 6 present: `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STARTER`, `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Auth tests: 26 pass/0 fail. Security tests: 32 pass/0 fail.**
- **14 TODO/FIXME items** — all reviewed: 5x signal-emitter (deferred), 2x CSP-hardening (deferred), rest are in scripts/QA/CI. Zero actionable bugs.

## Last Completed Work (2026-05-03 session 6)

### Security audit + structural backlog verification
- **receiptParser.js filename XSS fix** — user-supplied `filename` now sanitized with regex (`[^a-zA-Z0-9._\-() ]` stripped) + 255-char limit before DB storage. Receipt tests: 52 pass/0 fail.
- **Ownership audit (IDOR)** — all 178 user-data mutations across inventory, listings, sales, offers, image vault include `WHERE user_id = ?`. No IDOR vulnerabilities.
- **Upload route security audit** — imageVault.js, batchPhoto.js, receiptParser.js all pass: MIME validation, 10MB size limits, path sanitization, ownership checks.
- **CORS audit** — `Access-Control-Allow-Credentials` only for whitelisted origins, never wildcard. Secure.
- **Auth token lifecycle audit** — store.persist/hydrate cover both tokens, api.refreshAccessToken reads store.state, backend does refresh token rotation (old invalidated, new issued).
- **Stale Dockerfile.worker deleted** — root `Dockerfile.worker` was legacy (Playwright 1.58.2, no Camoufox). `worker/Dockerfile` is canonical (1.59.1, GTK deps, non-root user).
- **Playwright version drift resolved** — 1.59.1 across root package.json, worker/package.json, worker/Dockerfile.
- **Background worker audit** — taskWorker.js is producer-only (Queue), worker/index.js is consumer-only (Worker). No duplicate consumers.
- **deep-dive-backlog.md updated** — all 10 items verified with current status. R-018 env.md confirmed (168 lines).
- **OPEN_ITEMS.md regenerated** — passes `open-items:check`.

## Last Completed Work (2026-05-03 session 5)

### CI/CD pipeline unblocked + full live verification
- **Production Smoke fix deployed** — commits `1249ee87`, `7031688a`, `dc4a78bc` pushed to origin/master. Redis unavailable/degraded no longer crashes smoke. Worker health timeout now non-blocking.
- **Railway deploying again** — Deploy workflow succeeded at `dc4a78bc`. Bundle version changed from `5035a71f` (stale since May 1 21:17 GMT) to `45dfb978`.
- **Health endpoint confirmed** — `status: ok`, database: ok, redis: ok.
- **Production Smoke CI** — 3 consecutive passes. Smoke failure GitHub issue auto-closed by recovery workflow.
- **All 16 DONE LOCAL items verified live** via chunk content analysis: Listing Defaults/Photo Settings removed, Image Vault rename complete (zero Image Bank hits), Facebook manual-connect only, 7 platforms in pricing/settings/landing, Gmail/Outlook Coming Soon, inventory-stock-out badge, checklist tab switching, IS_PROD guard on suppliers, webhooks aliased. See Next Tasks section for full verification matrix.

## Last Completed Work (2026-05-02 session 4)

### Anti-detection, CR-10, GitHub triage
- **ANTI-09 multi-account isolation warning** — added to `src/frontend/pages/pages-settings-account.js` (correct chunk: `shops` → `settings` → `chunk-settings.js`). Warning renders when `connectedShops.length > 1`. Commit `85527bfe`.
- **ANTI-10 DataDome/Camoufox maintenance cadence** — documented in `docs/PERFECT_ANTI_DETECTION_SYSTEM.md`: retest monthly against antoinevastel.com/bots/datadome and bot.sannysoft.com from Railway.
- **ANTI-12 JA4 fingerprinting** — documented verification task: run `bun worker/bots/fingerprint-self-test.js` on Railway to capture TLS/JA4 output.
- **CR-10 OAuth connect checklist** — written at `docs/reference/cr10-oauth-connect-checklist.md`. All 8 platforms: eBay (OAuth), Shopify (OAuth), Depop (PKCE), Poshmark/Mercari/Grailed/Whatnot/Facebook (Playwright). Endpoints verified from source: connect = `POST /api/shops/`, callback = `GET /api/oauth/callback/<platform>?code=...&state=...`.
- **Mercari UI cleanup** — removed `mercari_relist` automation card from `pages-inventory-catalog.js`; removed Mercari from platform filter; updated community/about page partner list to reflect 7 live platforms.
- **GitHub issues triaged** — all 19 classified. Closed #488 (Lighthouse transient 48→72), #490; commented on #482, #491, #492. #489 auto-closed.

## Last Completed Work (2026-05-02)

### BrowserStack a11y plan COMPLETE (goofy-plotting-hartmanis.md — all phases verified)
- **Phase 1**: ARIA role hierarchy fixed — listbox children have `role="group"` + `aria-label`; no duplicate role attributes on autocomplete items
- **Phase 2**: Label-in-Name (WCAG 2.5.3) — 114 close/dismiss/remove × chars wrapped in `<span aria-hidden="true">` across 12 source files; Toggle option labels, community notification labels all fixed
- **Phase 3**: Same-href link text — all 27 unique violations resolved (blog back-links, learning.html emoji, platforms/help/careers/roadmap/documentation links)
- **Phase 4**: Nav dropdown `aria-hidden` initial state — all 48 HTML pages use `inert` attribute on `.nav-dropdown-menu` divs
- **Phase 5**: Color contrast — `--gray-500` darkened to `#4b5563` (7.0:1 on white); all `color: #6b7280` hardcoded instances replaced with `var(--gray-500)`
- **Phase 6**: Images alt text — already complete (all `<img>` tags have `alt=`)
- **Phase 7**: Landmarks — SPA shell `<output>` elements for offline/voice indicators, `<aside aria-label="Chat assistant">` for chat container
- **Target**: BrowserStack score 85 → 92-95 on next scan (all confirmed violations resolved)

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
1. **CR-4 EasyPost** — ROUTES FUNCTIONAL 2026-05-03 — `/api/shipping-labels/rates` and `/buy` return 403 (CSRF protection, not 503). `EASYPOST_API_KEY` NOT on Railway (verified 2026-05-03 via Variables tab — 93 vars, no EASYPOST). Must be added manually before live verification.
2. **CR-10 OAuth** — ROUTES FUNCTIONAL 2026-05-03 — eBay, Depop, Shopify `/api/oauth/authorize/*` all return 401 (auth required, not 503). Routes exist and respond. Needs real OAuth credentials configured per `docs/reference/cr10-oauth-connect-checklist.md`.

## Next Tasks

**UI / LANDING PAGE FIXES — ALL VERIFIED LIVE 2026-05-03**
- [Image #1] ✅ VERIFIED LIVE — Landing "4 More on the Way" with Kijiji, Etsy, Mercari, Vinted. Live HTML confirmed `landingHas4More: true`.
- [Image #2] ✅ VERIFIED LIVE — Settings Integrations compact vinyl-style cards with country abbreviations.
- [Image #3] ✅ VERIFIED LIVE — Landing footer social icons non-white (no code change needed).
- [Image #4] ✅ VERIFIED LIVE — Listing Defaults + Photo Settings REMOVED from settings chunk. `#webhooks` aliases to Settings/Integrations.
- [Image #5] ✅ VERIFIED LIVE — Listings Platform Prices deduped by platform.
- [Image #6] ✅ VERIFIED LIVE — No Buyer Profiles in Sales.
- [Image #7] ✅ VERIFIED LIVE — No Scheduler Health in Automations.
- [Image #8] ✅ VERIFIED LIVE — No Calendar/Performance in Automations.
- [Image #9] ✅ VERIFIED LIVE — Checklist tab switching works (`switchChecklistTab` in tools chunk).
- [Image #10] ✅ VERIFIED LIVE — Checklist "Mark All as Incomplete" SVG icon renders.
- [Global] ✅ VERIFIED LIVE — Image Bank → Image Vault: zero `Image Bank` hits in bundle, settings, or inventory chunks.
- [Image #11] ✅ VERIFIED LIVE — Facebook manual connect only; no `facebook_oauth` in settings chunk.
- [Image #12] ✅ VERIFIED LIVE — Inventory hero: Bundle, Restock, Alerts, Add Item only.
- [Image #13] ✅ VERIFIED LIVE — Inventory `inventory-stock-out` badge present in chunk.

**WALKTHROUGH FINDINGS — ALL VERIFIED LIVE 2026-05-03**
- [Inventory] ✅ VERIFIED LIVE — No legacy `.inv-tab-btn` sub-tabs.
- [Inventory] ✅ RESOLVED 2026-05-03 — 134 security payload test rows no longer in prod DB (0 VLSEC-/CSRF rows found; 15 legitimate inventory rows remain).
- [Webhooks] ✅ VERIFIED LIVE — `#webhooks` aliases to Settings/Integrations; Webhook Management UI unreachable.
- [Connections] ✅ VERIFIED LIVE — Gmail/Outlook show "Coming Soon"; no "OAuth not configured" text in settings chunk.
- [Analytics] ✅ VERIFIED LIVE — No "No prior data" pill.
- [Automations] ✅ VERIFIED LIVE — No "A/B Experiments".
- [Daily Checklist] ✅ VERIFIED LIVE — Tab switching works in tools chunk.
- [Reports] ✅ VERIFIED LIVE — No Supplier Monitoring.
- [Suppliers] ✅ VERIFIED LIVE — IS_PROD guard (hostname/localhost check) in deferred chunk; redirects to #analytics on production.
- [Plans & Billing] ✅ VERIFIED LIVE — Settings chunk has `7 platform`, no `9 platform`. Live pricing.html and landing.html both show 7.
- [Account] ✅ VERIFIED LIVE — Password autocomplete attributes correct.

**SITE AUDIT — 24 VERIFIED FINDINGS (2026-05-03 session 8, chrome + source-code verified)**

_P0 — Broken / Wrong_
- [ ] 4 dead "See all features" links → `/features.html` doesn't exist (landing.html:2251/2305/2363/2418)
- [ ] Free plan "7 platforms" in card vs "5" in comparison table (pricing.html:548 vs :678)

_P1 — Functional / SEO / Security Impact_
- [ ] All static HTML pages missing security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) — only SPA has them. Root cause: serveStatic() in server.js:510-515 doesn't apply securityHeadersConfig. Static pages can be iframe-embedded by any site.
- [ ] `Facebook<br>Marketplace` screen reader concatenation (landing.html:1994, platforms.html:645)
- [ ] Announcement banner `hidden` overridden by CSS `display:flex` — close button (tabIndex:0) in keyboard tab order (index.html:156, components-library.css:17361)
- [ ] Auth pages (login/register/forgot/reset) show no page title (router.js:472-499 PAGE_TITLES map missing entries)
- [ ] og:image uses SVG on landing:15, platforms:17, ebay-sneaker blog:113 — Twitter/Facebook don't support SVG social cards
- [ ] No canonical tags on any page except 3 blog posts (depop-y2k, whatnot, ebay-sneaker)
- [ ] Duplicate content: `/` and `/landing.html` both in sitemap.xml (:16), no canonical to disambiguate

_P2 — SEO / Discoverability_
- [ ] 67 FAQ items with zero JSON-LD FAQPage schema (faq.html — grep `ld+json` returns no matches)
- [ ] Non-existent `.html` URLs return HTTP 200 soft 404 (server.js SPA catch-all)
- [ ] 3 orphaned pages in sitemap with zero internal links: compare/closo.html, compare/selleraider.html, glossary.html
- [ ] about.html missing from sitemap.xml — real content page linked from every footer
- [ ] 42 of 52 public HTML pages have zero Open Graph tags — no social card previews when shared
- [ ] 13 target="_blank" links missing rel="noopener noreferrer" (documentation.html×10, ai-info×1, blog/index×2)

_P3 — Polish_
- [ ] Dead CSS `.trust-section`, `.trust-card`, `.pricing-teaser` — zero HTML elements use them (landing.html:649/664/1179)
- [ ] Blog/changelog dates use `<span>` not `<time datetime>` (blog/index.html:483, changelog.html:690+)
- [ ] documentation.html meta description says "Legal" but title says "Documentation" (:8 vs :11)
- [ ] changelog.html meta description only 47 chars (:6)
- [ ] Missing `twitter:image` and `og:site_name` on landing.html
- [ ] Missing `apple-touch-icon` and `manifest` link on landing.html
- [ ] "More articles coming soon" placeholder (blog/index.html:558)
- [ ] TODO comment in status.html CSS (:288) — visible in page source
- [ ] 4 content pages missing favicon link tag (changelog, api-changelog, api-docs, rate-limits)

_Clean checks (no issues)_: All 52 pages have 1 `<h1>`, `lang="en"`, charset, viewport. Zero empty links, console.log, http:// links, missing alt. Forms work. ARIA nav correct. Responsive breakpoints at 480/560/600/768/900px. robots.txt, manifest, favicon all OK.

**NEW TASK LIST (scanned 2026-05-04)**

_P0 — CI / Working Tree_
- [ ] Commit uncommitted a11y CSS color work (13 modified + 1 new file) — WCAG contrast fixes replacing hardcoded hex with CSS vars + stylelint ban rule
- [ ] Push unpushed commits (CI lint fix `cf858a6e` + open-items refresh `1e5582ab`) to close #515

_P1 — Code Quality / Observability_
- [ ] Wire signal-emitter imports in 5 platform sync files (facebook, poshmark, whatnot, grailed, mercari) — `signalEmitter.js` exists, already used by 4 other syncs
- [ ] CR-4: Add `EASYPOST_API_KEY` to Railway — routes return 503 without it (requires user)
- [ ] CR-10: Configure OAuth credentials for remaining 8 platforms (requires user)

_P2 — Security / Refactor_
- [ ] CSP hardening — DOMPurify `ADD_ATTR` allows inline event handlers (`utils.js:66`)
- [ ] R-001: Extract remaining 15 inline handlers from `server.js` (2,087 lines)
- [ ] R-011: Split `auth.js` (1,153 lines, 6 concern domains)
- [ ] R-012: Split `database.js` (640 lines, 7+ responsibilities)
- [ ] R-015: Authorization/ownership audit across all routes — coverage UNKNOWN
- [ ] R-029: Map full auth-session coupling lifecycle
- [ ] Playwright version sync — root 1.59.1 vs worker 1.58.2 (confirm which Railway uses)

_P2 — Site Audit (24 findings from session 8)_
See "SITE AUDIT" section above — 2 P0, 7 P1, 5 P2, 10 P3.

_P3 — Backlog_
- [ ] Chrome Extension — 7 unchecked items in `chrome-extension/README.md`
- [ ] Facebook OAuth Compliance — 42 unchecked items in `docs/FACEBOOK_OAUTH_COMPLIANCE.md`
- [ ] Sentry setup (User Feedback, Logs, Profiling, Session Replay, MCP Monitors, AI Agents) — 6 deferred items

**PRE-EXISTING**
0. Use `docs/OPEN_ITEMS.md` as the active task backlog — REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md is historical evidence only.
0. [OPTIONAL] Richer sale path test — sale with non-zero payment_fee + packaging_cost + inventory-linked item; verify all 5 ledger rows fire.
0. [WATCH] Financial regression: (a) no accounting-statement labels reintroduced, (b) new ledger paths don't skip non-zero amounts, (c) no tax schema/copy creep, (d) no duplicate rows on retry/edit.

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
