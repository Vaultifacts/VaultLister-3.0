# Platform Readiness — Walkthrough Findings

## Platform Readiness Matrix

| Platform | OAuth | Bot | Sync | Publish | Launch Status |
|----------|-------|-----|------|---------|---------------|
| **eBay** | Exists (mock) | OAuth REST API (ebayPublish.js) | eBay sync exists | ebayPublish.js | **NEEDS** real OAuth — uses REST API, no bot required |
| **Poshmark** | Exists (mock) | ✅ poshmark-bot.js | Poshmark sync | Via bot | **NEEDS** real OAuth |
| **Facebook** | Exists (mock) | ✅ facebook-bot.js | FB sync | Via bot | **NEEDS** real OAuth |
| **Depop** | Exists (mock) | ✅ depop-bot.js | Depop sync | Via bot | **NEEDS** real OAuth |
| **Whatnot** | Exists (mock) | ✅ whatnot-bot.js | Whatnot sync | Via bot | **NEEDS** real OAuth |
| Mercari | Exists (mock) | ✅ mercari-bot.js | Mercari sync | Via bot | Coming Soon — code must be feature-gated |
| Grailed | Exists (mock) | ✅ grailed-bot.js | Grailed sync | Via bot | Coming Soon — code must be feature-gated |
| Etsy | Deferred | ❌ | Exists | ❌ | Coming Soon |
| Shopify | Incomplete | ❌ | Exists | ❌ | Coming Soon |

## Open Items

| ID | Area | Finding | Session | Status |
|----|------|---------|---------|--------|
| CR-10 | My Shops | Marketplace connection state is still incomplete: eBay and Shopify OAuth init are live, but Depop OAuth is unconfigured and several remaining marketplace connects still rely on manual / Playwright credential flows | Session 1 | OPEN — verified 2026-04-24: eBay ✅ live OAuth init, Shopify ✅ live OAuth init, Depop ❌ /api/oauth/authorize/depop returns 503, Poshmark/Grailed/Whatnot/Facebook ❌ Playwright bot approach (no OAuth connect UI — credential flows only), Mercari deferred post-launch, Etsy deferred post-launch |

## Resolved

| ID | Area | Finding | Session | Status |
|----|------|---------|---------|--------|
| CR-2 | Platform Integrations | `OAUTH_MODE` defaults to `'mock'` — if not set in Railway `.env`, all platform integrations use fake tokens. 32 files reference this var | Session 1 | VERIFIED ✅ — `OAUTH_MODE=real` confirmed in Railway production variables (2026-04-07) |
| CR-5 | eBay Integration | eBay cross-listing uses OAuth REST API (ebayPublish.js / ebaySync.js) — no Playwright bot needed | Session 1 | VERIFIED ✅ — 2026-04-22 source confirmed `ebayPublish.js` + `ebaySync.js`; `ebay-bot.js` absent |
| H-3 | My Shops | Mercari/Grailed/Etsy/Shopify show active "Connect" buttons — should be "Coming Soon" for post-launch platforms | Session 1 | VERIFIED ✅ — d81cb79 |
| H-16 | Connections | Only 6 of 9 platforms shown — missing Etsy, Shopify, Whatnot | Session 2 | VERIFIED ✅ — dd50369 |
| H-24 | Connections | Only 6/9 platforms shown — missing Etsy, Shopify, Whatnot | Session 3 | VERIFIED ✅ — dd50369 |
| H-26 | Listings | Platform dropdown only shows 6 of 9 platforms — missing Etsy, Shopify, Whatnot | Session 3 | VERIFIED ✅ — eb9e086 |
| #126 | Cross-list Modal | Cross-list modal shows Etsy/Mercari/Grailed as active — for Canada launch only eBay, Poshmark, Facebook, Depop, Whatnot should be active | Session 5 | VERIFIED ✅ — e097efa |
| #169 | My Shops | 4 non-launch platforms (Mercari, Grailed, Etsy, Shopify) shown with active "Connect" buttons — no "Coming Soon" indicator | Session 11 | CONFIRMED N/A — confirmed correct in source (documented 15dba34) |
| #226 | My Shops | Platform priority update: Poshmark, eBay, Depop, Shopify, Facebook, and Whatnot are now the priority launch platforms. All others (Mercari, Grailed, Etsy, and any remaining) should display as "Coming Soon" | 2026-04-08 | VERIFIED ✅ 7ac7b46 |
| #227 | My Shops | No OAuth connection setup for any priority platform except eBay — Poshmark, Depop, Shopify, Facebook, and Whatnot all need real OAuth flows built. *(See also: CR-10 — all 9 connect buttons have no working OAuth flows)* | 2026-04-08 | VERIFIED ✅ — e6b1180 + a59edab + 62a10e9 |
| CA-CR-3 | `src/backend/routes/ai.js:73,75` | Mercari/Grailed in active AI templates — these are post-launch platforms. Code executes if triggered. **Fix:** Remove or wrap with feature flag. | Code Audit | VERIFIED ✅ — 8a1d58e |
| CA-M-1 | `src/backend/workers/taskWorker.js:1160,1162` | Mercari/Grailed case statements active — should be feature-gated for post-launch | Code Audit | VERIFIED ✅ — e097efa |
| CA-M-4 | `src/frontend/core/utils.js:11-20` | `SUPPORTED_PLATFORMS` lists all 9 platforms — Canada launch = 5 only. **Fix:** Create `LAUNCH_PLATFORMS` filter constant. | Code Audit | VERIFIED ✅ — e097efa |
