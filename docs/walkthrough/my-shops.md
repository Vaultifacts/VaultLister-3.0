# My Shops — Walkthrough Findings

## Open (Needs Fix)

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-10 | My Shops | Marketplace connection state is still incomplete: eBay and Shopify OAuth init are live, but Depop OAuth is unconfigured and several remaining marketplace connects still rely on manual / Playwright credential flows | Session 1 | OPEN — verified 2026-04-24: eBay ✅ live OAuth init, Shopify ✅ live OAuth init, Depop ❌ /api/oauth/authorize/depop returns 503, Poshmark/Grailed/Whatnot/Facebook ❌ Playwright bot approach (no OAuth connect UI — credential flows only), Mercari deferred post-launch, Etsy deferred post-launch |
| MANUAL-shops-1 | My Shops | Vaultlister logo is missing in top right corner. Also the platform integration cards are not being displayed correctly. Some of the text is behind the cards, some extends past the cards, some is not showing up. Also Depop and Facebook should be Official API integrations with OAUTH 2.0 (image-22) | Backlog | PARTIALLY FIXED — logo in app header (components.js); Depop OAuth PKCE live (oauth.js:23,601); Facebook N/A (no public listing API); card layout needs live manual recheck |

## Completed & Verified

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| MANUAL-shops-2 | My Shops | Proper platform Icons are not being used. Platform Names are not including (CA) at the end of them. Also Shopify import listings is not an option but should be. (image-51) | Backlog | VERIFIED ✅ — pages-settings-account.js:5 defines PLATFORM_DISPLAY_NAMES with (CA)/(U.S) suffixes |
| #129 | Whatnot | modals.viewWhatnotEvent() -- 3 data bugs: "Invalid Date" start time, "undefined" status badge, blank event title in modal header | Session 5 | VERIFIED -- 72af65a -- modal shows "TBD" start time, "Scheduled" status, "Untitled Event" title for bad data (2026-04-07) |
| H-3 | My Shops | Mercari/Grailed/Etsy/Shopify show active "Connect" buttons — should be "Coming Soon" for post-launch platforms | Session 1 | VERIFIED ✅ — d81cb79 |
| #170 | My Shops | All Connect modals pre-fill username with hardcoded "demo@vaultlister.com" — users must manually clear field | Session 11 | CONFIRMED N/A — not found in source; likely already removed |
| CO-5 | Whatnot Live | Green "0% vs last week" arrows — should be neutral | Session 2 | VERIFIED ✅ — same fix as CO-1, confirmed in source (2026-04-07) |
| #157 | My Shops | "Connect to Ebay" — should be "Connect to eBay" | Session 8 | VERIFIED ✅ — 15dba34 — handlers-deferred.js: PLATFORM_DISPLAY_NAMES lookup gives correct casing |
| #168 | My Shops | eBay Connect modal title shows "Connect to Ebay" not "Connect to eBay" | Session 11 | VERIFIED ✅ — 15dba34 — same fix as #157 (PLATFORM_DISPLAY_NAMES in handlers-deferred.js) |
| #169 | My Shops | 4 non-launch platforms (Mercari, Grailed, Etsy, Shopify) shown with active "Connect" buttons — no "Coming Soon" indicator | Session 11 | CONFIRMED N/A — confirmed correct in source (documented 15dba34) |
| #226 | My Shops | Platform priority update: Poshmark, eBay, Depop, Shopify, Facebook, and Whatnot are now the priority launch platforms. All others (Mercari, Grailed, Etsy, and any remaining) should display as "Coming Soon" | 2026-04-08 | VERIFIED ✅ 7ac7b46 |
| #227 | My Shops | No OAuth connection setup for any priority platform except eBay — Poshmark, Depop, Shopify, Facebook, and Whatnot all need real OAuth flows built. | 2026-04-08 | VERIFIED ✅ — e6b1180 + a59edab + 62a10e9 |

## Extended QA Session Findings (My Shops Tab)

### Completed & Verified

| Finding | Status |
|---------|--------|
| "Export Report" button crashes — TypeError: Cannot read properties of undefined (reading 'toUpperCase') at Object.exportFinancials | VERIFIED ✅ — 92d10d9 — exportFinancials() now called with 'csv' default; format.toUpperCase() no longer crashes on undefined |
| "Import Data" modal has severe HTML injection / rendering bug — raw unescaped HTML attribute code visible as page text | VERIFIED ✅ — 92d10d9 — rewrote showImportModal using correct single-content modals.show() pattern |
| "Import Data" modal is missing a close (X) button | VERIFIED ✅ — 92d10d9 — X close button added to modal header in showImportModal rewrite |
| "Import Data" modal is visually positioned off-screen / overlaps sidebar | VERIFIED ✅ — 92d10d9 — resolved by modal rewrite; modal now uses standard fixed-overlay pattern |
| "Sync All Shops" provides zero user feedback | VERIFIED ✅ — 92d10d9 — loading toast fires immediately; success toast fires 1.5s later |
| Connect modals for Poshmark, Depop, and Whatnot auto-populate fields with VaultLister login credentials | PRE-EXISTING ✅ — not found in source code; likely browser autofill behavior, not a code bug |
| FAB button has no accessible label | VERIFIED ✅ — 92d10d9 — aria-label="Quick Actions" and title="Quick Actions" added to business-fab-btn |
| "Sync All Shops" menu item text is clipped by the Vault Buddy button | VERIFIED ✅ — 92d10d9 — z-index:1001 and white-space:nowrap added to FAB menu |
| No visual differentiation between "Coming Soon" card state and "Not Connected" card state | VERIFIED ✅ — 92d10d9 — badge-coming-soon gray pill badge added to Mercari/Grailed/Etsy cards |
