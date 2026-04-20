# Competitor Technical Appendix — 2026-04-18

> Exhaustive technical reference. Every specific file size, endpoint URL, function name, and code literal discovered during the audit session.
> Companion to `COMPETITOR_MASTER_2026-04-18.md` (strategic summary).

---

## File Path Reference

All extensions in `C:\Users\Matt1\AppData\Local\Google\Chrome\User Data\Profile 3\Extensions\`

| Extension | Folder/Version | Key files with sizes |
|-----------|----------------|----------------------|
| PrimeLister | `eepbhjeldlodgnndnjofcnnoampciipg/2.0.125_0/` | `static/background/index.js` (2.5MB), `panel.6bd34c46.js` (2.9MB), `router.8c53223e.js` (2.6MB), `popup.cc3817b7.js` (1.2MB) |
| Crosslist | `knfhdmkccnbhbgpahakkcmoddgikegjl/3.9.13_0/` | `background.js` (1.6MB) |
| Crosslist Magic | `lkjldebnppchfbcgbeelhpjplklnjfbk/0.0.337_0/` | `src/background.js`, 39 JS files under `src/content-scripts/` (one per marketplace) |
| SellerAider | `hoadkegncldcimofoogeljainpjpblpk/1.0.8.53_0/` | 17 bundles ~13MB total: `background.bundle.js` 263,430B, `crosslister.bundle.js` 806,151B, `ebay.bundle.js` 1,007,474B, `etsy.bundle.js` 854,378B, `facebook.bundle.js` 818,731B, `grailed.bundle.js` 823,138B, `instagram.bundle.js` 708,038B, `mercari.bundle.js` 838,889B, `popup.bundle.js` 680,677B, `poshmark.bundle.js` 803,470B, `shopify.bundle.js` 828,731B, `shpock.bundle.js` 811,076B, `vestiaire.bundle.js` 803,838B, `vinted.bundle.js` 804,286B, `whatnot.bundle.js` 815,990B, `depop.bundle.js` 803,121B, `pageContextScript.js` 1,868B |
| Flyp Crosslister | `kbflhgfmfbghhjafnjbgpiopcdjeajio/1.0.4_0/` | `background.js`, `facebook.js`, `facebookPage.js`, `flypWeb.js`, `mercari.js`, `mercariPage.js`, `poshmark.js`, `rules.json` |
| Flyp Bot Sharer | `ehicjmkogfjifombjmdinmhpaghfggcd/1.7.6_0/` | `background.js` 1,173,369B, `flypWeb.js` 12,587B, `common/constants.js` 2,730B, `common/errorMessages.js` 389B, `common/utils.js` 769B |
| Nifty | `ggcfdkgmekpddencdddinlmpekbcohoa/3.1.1_0/` | `background.js` **1,737 bytes** (cookie bridge), `index-G6cBpr4F.js` 522,406B (popup React UI), `assets/constants-DGiVZLla.js` 408,954B |
| OneShop | `pcapaniacmdmabfopeeimmpjkkjpeiok/2_0/` | `dist/js/background.js` **18,627 bytes** |
| Closo | `aipjhdapgmimfdfcjmlpeoopbdldcfke/3.1.42_0/` | `background.js`, `poshmark_script.js`, `depop_script.js`, `mercari_script.js`, `content.js` |
| Vendoo | `mnampbajndaipakjhcbbaihllmghlcdf/3.1.10_0/` | `service_worker.js` **269,984 bytes**, `execPageScriptContent.js` **552,455 bytes**, `interceptRequest.js` 61,168B, `vendooWeb.js` 62,270B, `scripts/patch.js` 60,798B, `corsRules.json` |

---

## PrimeLister — Technical Details

### Endpoints
- `https://api.primelister.com` (ky instance prefixUrl)
- `https://api.primelister.com/cookies` (POST — bidirectional cookie relay)
- `https://api.primelister.com/account/cookies` (GET — cookie writeback)
- `https://api.primelister.com/user-action-queue-requests/*`
- `https://r2.primelister.com/primeListerExtensionConfig.json` (polled every 15s; returns `{"V2ExtensionReady": true}`)
- `https://www.isharemyscreen.com/primelister?email=${email}` (**email leak via referral URL in panel.js**)

### Code artifacts
- `kyInstance.post("cookies", {json:t, searchParams:e})` — cookie relay endpoint
- `PrimeListerRequest.SET_COOKIES` / `GET_COOKIES` — bidirectional
- `fetchAndHandleActiveJobs` function in `user-action-queue-requests` module
- `setInterval(async()=>{let t=await d(e);0===t.length&&(clearInterval(u),u=null)},t)` — polling loop (interval `t` is dynamic variable, not literal)
- `ActionLabelsEnum.{DELIST, RELIST, SEND_OFFER, CROSSLIST, IMPORT, DELETE, DUPLICATE}`
- `Automation.{AUTO_CLOSET_SHARE, AUTO_COMMUNITY_SHARE, AUTO_PARTY_SHARE, AUTO_RELIST, AUTO_SEND_OFFER_TO_LIKERS, RETURN_SHARE, RETURN_FOLLOW}`

### Metrics
- `chrome.alarms.create` across all 4 bundles: **0 hits**
- `chrome.cookies.getAll`: 21 hits (panel:10, router:1, index:10)
- `chrome.cookies.set`: 20 hits (panel:9, router:2, index:9)
- `SEND_OFFER` references: 38 hits
- `onMessageExternal.addListener`: 2 (in index.js — **zero origin validation**)
- Popup exposes 19 actions: Auto Offer to Likers, Auto Party Share, Auto-Delist, Cross-list, Delist, Enhance-Listing, Follow, Follow Fresh Closets, Follow Just Joined, Import, Offer to Likers, Organize Closet, Re-list, Return Follow, Return Share, Share to Followers, Share to Party, Unfollow, Login to PrimeLister Account
- Content scripts target 15 platforms

---

## Crosslist — Technical Details

### Endpoints
- `https://app.crosslist.com` (SalesPolling + all relays with `credentials:"include"`)
- `${domain}/Api/SalesPolling/GetSalesDetectionConfig`
- `${domain}/Api/SalesPolling/SubmitSales`
- `https://logs.crosslist.com` (Sentry)
- Vinted: `/items/${e}/delete` (direct API call)

### Code artifacts
- `async delistListing(e)` → `this._delistListing(e)` → PUT to Vinted `/items/${e}/delete`
- `chrome.alarms.create(Ci, {delayInMinutes:1, periodInMinutes:mn})` — `Ci = "salesPollAlarm"`, `mn = 30` (every 30 min)
- `console.log("[SalesPolling] Alarm created")` — logging signature
- `externally_connectable: ["*://*.crosslist.io/*","*://*.crosslist.com/*","*://localhost/*"]`

### Public roadmap & changelog (verified 2026-04-19)
- Roadmap: `feedback.crosslist.com/en/roadmap` — **108 under-consideration items**. Top voted: listing variations/stock sync (102 votes). In Progress: Auto-Delist, Full Mobile Listing Functionality, variations/stock sync.
- Changelog: `feedback.crosslist.com/en/changelogs` — last entry Jan 14 2026.
- Native mobile app: **none** — marked In Progress on roadmap.

### Metrics
- `chrome.alarms.create`: 1 hit (sales polling only)
- `chrome.cookies.getAll`: 3 hits
- `onMessageExternal.addListener`: 1
- `delistListing` references: 20 hits
- Share / Relist / Offer action functions: **0 hits** (despite marketing claims)

---

## Crosslist Magic — Technical Details

### Endpoints
- `https://www.crosslistmagic.com/api/proxy` (all marketplace traffic routed through server proxy)
- `https://www.crosslistmagic.com/api/get-product`
- `https://www.crosslistmagic.com/apiv2/extension/`
- `https://www.crosslistmagic.com/error-status`

### Code artifacts
- `XMLHttpRequest = function(){...request.addEventListener('load',function(){chrome.runtime.sendMessage(extensionId,{data:{type:"ajaxResponse",url:request.responseURL,response:request.response}})})}` — XHR interceptor in `xhr-wrapper.js` (788 bytes)
- Content scripts (39 under `src/content-scripts/`): amazon.js, depop.js, ebay-au.js, ebay-ca.js, ebay-uk.js, ebay.js, etsy.js, facebook.js (144,354 bytes), grailed.js, mercari.js, poshmark-au.js, poshmark-ca.js, poshmark-uk.js, poshmark.js, shopify.js, vinted-ca.js, vinted-uk.js, vinted.js, walmart.js, whatnot.js, + 19 support files
- Each content script injects a "click to crosslist" button with `addEventListener("click",...)` pattern
- `setInterval(P, sK)` — bridge heartbeat (interval `sK` is a variable)

### Metrics
- Total content scripts: **39** (not 20 — earlier undercount)
- `chrome.cookies.*` calls: 0 in content scripts; 0 in background.js
- Share / Relist / Delist actions: **0 hits across all 39 content scripts**
- Feature set: Cross-list (import + post) only

---

## SellerAider — Technical Details

### Endpoints
- `https://app.selleraider.com` (extension popup URL only — blank in regular browser tab)
- ~~`https://dashboard.selleraider.com` (web dashboard)~~ **CORRECTED 2026-04-19:** `dashboard.selleraider.com` is a stale/separate app (blank React root when not logged in). Production dashboard is `https://my.selleraider.com` — 5 sections: Home, Listings, Analytics (Coming Soon), Messages (Coming Soon), Settings.

### Code artifacts
- `window.__INITIAL_STATE__` reader (from Poshmark DOM) in `pageContextScript.js` (1,868 bytes)
- `window.confirm = () => true` — overrides Grailed delete confirmation
- `chrome.cookies.get({url:g, name:m}, function(e){...CHECKTAB"...})` — local session check only
- `DELIST_EDIT_COMPLETE`, `DELIST_DELETE_COMPLETE`, `DELIST_TRY_DELETE` — constants in `poshmark.bundle.js`
- `ENDPOINT_LOGIN_USER` — server auth endpoint

### Metrics
- `chrome.cookies.getAll` across all 17 bundles: **0**
- `chrome.cookies.set` across all 17 bundles: **0**
- `chrome.cookies.get` (single): 1 (for CHECKTAB session verification)
- `onMessageExternal` / `onConnectExternal`: 0 each
- Share / Relist / Offer functions: 0 (despite homepage claims)
- **Tier A architecture** — unique among 9 competitors

### Pricing (from marketing)
- Grow Standard $18/mo (automation, 1 platform)
- Grow Pro $25/mo (automation, all platforms: Depop, Vinted, Poshmark)
- Crosslister Standard $12.99/mo (crosslisting + AI + inventory)
- Crosslister Pro $29.99/mo (crosslisting + all automation + photo editing)
- 14-day free trial; yearly saves ~20% (Grow Standard $130/yr, Grow Pro $249.99/yr, Crosslister Standard $140/yr, Crosslister Pro $299/yr)
- ~~Unique unverified feature claim: "Automatic Messages"~~ **CONFIRMED FALSE 2026-04-19:** `/dashboard/messages` at `my.selleraider.com` shows "Coming Soon — Manage your messages on all platforms/marketplaces." No functional controls. Feature is listed on all Grow tier pricing bullets as marketing copy only.

### Changelog
- Public changelog: `guide.selleraider.com/lister/info/updates` — last entry Sep 24 2025 (v1.0.8.53)

---

## Flyp — Technical Details (TWO extensions)

### Endpoints
- `https://tools.joinflyp.com` (primary web app + API)
- `https://flyp-tools-dev-web.herokuapp.com` (dev endpoint listed in manifest)
- `https://poshmark.com/vm-rest/responses/recaptcha?pm_version=161.0.0` (Bot Sharer direct fetch)
- `https://poshmark.com/create-listing` (Bot Sharer direct fetch)

### Extension #1: Crosslister by Flyp (`kbflhgfmfbghhjafnjbgpiopcdjeajio/1.0.4_0`)
- Permissions: `cookies`, `storage`, `tabs`, `scripting`
- `chrome.cookies.getAll({domain:"depop.com", name:"access_token"})` — Depop token as Bearer to joinflyp.com
- 24 action codes found via grep (`(?:RETURN|CREATE):[A-Z_]+`):
  - `CREATE:CREATE_LISTING_FACEBOOK`, `CREATE:CREATE_LISTING_MERCARI`, `CREATE:CREATE_LISTING_POSHMARK`, `CREATE:CREATE_LISTING_MERCARI_EXTENSION`
  - `RETURN:CHECK_USER_DETAILS_FACEBOOK/MERCARI/POSHMARK`
  - `RETURN:DELIST_LISTING_FACEBOOK/MERCARI/MERCARI_EXTENSION/POSHMARK`
  - `RETURN:GET_FACEBOOK_CATEGORIES/LISTING/LISTINGS/SHIPPING_OPTIONS`
  - `RETURN:GET_MERCARI_LISTING/LISTINGS/PRICES/SIZES`
  - `RETURN:GET_POSHMARK_LISTING/LISTINGS/PRICES/SIZES`
  - `RETURN:GET_SELLER_DETAILS`, `RETURN:MAKE_GRAPHQL_REQUEST`, `RETURN:UPLOAD_IMAGES`
- `EXECUTE:RELIST_ITEM_POSHMARK`, `EXECUTE:DELIST_ITEM_POSHMARK` hits confirmed
- Zero `chrome.alarms`, zero long-setInterval

### Extension #2: Poshmark Bot Sharer by Flyp (`ehicjmkogfjifombjmdinmhpaghfggcd/1.7.6_0`)
- Permissions: **`storage` only** (no `cookies` permission)
- Host permissions: `*://tools.joinflyp.com/*`, `*://*.poshmark.com/*`, `*://localhost/*`, `*://flyp-tools-dev-web.herokuapp.com/*`
- Content script: `flypWeb.js` on tools.joinflyp.com
- Web-accessible: `poshmarkPage.js` on `*://*.poshmark.com/*`
- 17 unique action codes:
  - `EXECUTE:SHARE_LISTING`, `EXECUTE:RELIST_ITEM`, `EXECUTE:CREATE_OFFER`
  - `EXECUTE:ADD_FOLLOWER`, `EXECUTE:REMOVE_FOLLOWER`, `EXECUTE:GET_USER_FOLLOWERS`
  - `EXECUTE:GET_NEWLY_JOINED_FOLLOWERS`, `EXECUTE:GET_NEWLY_OPENED_FOLLOWERS`
  - `EXECUTE:GET_SHARES_FROM_NEWS`, `EXECUTE:GET_ACTIVE_PARTIES`, `EXECUTE:GET_SHIPPING_DISCOUNTS`
  - `EXECUTE:SOLVE_CAPTCHA` — 108 CAPTCHA-related references
  - `RETURN:CHECK_USER_DETAILS_POSHMARK`
  - `START:AUTO_OFFERS`, `STOP:AUTO_OFFERS`
  - `START:SHARE_CLOSET`, `STOP:SHARE_CLOSET`
- Bridge mechanism: `flypWeb.js` uses 7 `window.postMessage` + 1 `addEventListener("message")` + 3 `chrome.runtime.sendMessage` to relay Flyp web app → background.js
- Direct Poshmark fetch (3 hits) — uses browser's existing poshmark.com session cookies automatically (no `chrome.cookies` relay needed)

### UI controls (from interactive walkthrough)
- Share tab: Scheduled/Continuous/Just once, # schedules, **HDT time picker**, All closet or Portion, daily limit **6000**, Randomize/Keep/Switch order, Fast/Slow speed, party toggle, activity logs "0 Shares Today | 0 Captcha Solved Today"
- Auto-Offers tab: every 5 min default, 10% discount, shipping tiers (No/$4.99/FREE), min $10, exclude recent N days
- Bulk Offers: same fields + "also send to no-like items" option
- Follow: 20 closets from my followers / another closet / random
- Community Share: return Shares+Follows, 100/closet, 30-day range, 4-speed slider (Fast 2-4s / Medium / Slow / Sloth)
- Orders (/orders): 40 orders across 5 platforms
- Offers (/offers): per-platform rows with live "8 items with new likers on Depop" count
- Analytics: Revenue $28, Profit $20, Avg sale $14, 2 sold, 13 new listings (as of walkthrough date)

---

## Nifty — Technical Details

### Endpoints
- `https://nifty.ai` / `https://app.nifty.ai`
- `onConnectExternal` from poshmark.com + nifty.ai pages only

### Code artifacts
- `background.js` = **1,737 bytes** (pure cookie bridge)
- `onMessageExternal.addListener((e,s,n)=>{n("pong")})` — returns "pong"
- `chrome.runtime.onConnectExternal.addListener(e=>{...})` — main bridge
- Message types:
  - `autoposher/get-all-cookies-request` → returns `chrome.cookies.getAll` for marketplaces
  - `autoposher/get-version-request` → returns extension version
  - `autoposher/get-extension-login-opts-request` → returns login options
- `index-G6cBpr4F.js` (522,406 bytes) is the popup React UI (`ReactDOM`, `createElement`, `useEffect`, `useState`; imports from `github.com` and `mui.com`; manifest `"default_popup":"index.html"`)
- `constants-DGiVZLla.js` (408,954 bytes) is marketplace constants
- `externally_connectable: ["*://*.poshmark.com/", "*://*.nifty.ai/*"]`

### UI controls (from interactive walkthrough)
- Automation page: Poshmark (Shares & relists, Offers, Follows), eBay (Offers, Recreates), Mercari (Offers, Relists), Depop (Offers, Relists — expired)
- Subscription: `BUNDLE_II`, TRIALING, ends 2026-04-24
- Home: Shares/Relists/Offers/Follows live counters (0/0/0/0 today)
- Otto AI prompts (5 pre-written):
  - "Generate a pick list for today's sales"
  - "Suggest improvements for my oldest unsold items"
  - "What's been selling best recently?"
  - "Is auto-delisting set up?"
  - "How do I update my billing information?"
- `isOttoBetaUser: false` gates Smart Credits purchase modal

### Known production bug
- ~~`/analytics` Insights sub-tab throws **Next.js hydration exception** on load~~ **RETRACTED 2026-04-19**: `/analytics/insights` is not a real sub-route. The Insights view IS `/analytics`, which loads fully with real data on Bundle Pro accounts (confirmed via active trial).

### Pricing
- Bundle Pro $88.99/mo, 7-day trial, 50 Smart Credits/month

---

## OneShop — Technical Details

### Endpoints
- `https://gql-api.oneshop.com/graphql`
- `https://metadata.app.oneshop.com`

### Code artifacts
- `background.js` = **18,627 bytes** (auth + linking only)
- `chrome.cookies.getAll({domain:"oneshop.com"})` → session tokens `x-sp-bm-id`, `x-sp-bm-token`
- GraphQL mutation: `invsysStartInstitutionLink(institution: ${e}, reauthStrategy: BROWSER_EXTENSION...)`
- `institutionMetadata` controls `cookieDomains` + `cookieNameRegexes` / `cookiePathRegexes` — server-controlled cookie capture
- `setInterval` ~2s for metadata/config refresh (no automation scheduling)
- Manifest has no `externally_connectable`; no `onConnectExternal` / `onMessageExternal`

### Pricing (T1 verified 2026-04-19)
- ~~Not verified in-dashboard~~ ~~**CORRECTED 2026-04-19:** "Growing" plan is **$67.99/mo**~~ **RE-CORRECTED 2026-04-19 (currency label fix):** Single tier: **$45 USD/month** (verified live from `tools.oneshop.com/pricing`). The $67.99 figure was a CAD conversion error — OneShop prices in USD only; $67.99 CAD ≈ $45 USD at current rates. No annual pricing, no free tier. 7-day trial via "Try monthly."
- Company: NOT shutdown. Active-maintenance. $1M ARR in 2024 (T2: Latka self-report). YC S21. 6-person bootstrapped team.
- Mobile: iOS `3.4★ / 461 ratings / v1.0.856 / Oct 29 2025`; Android active.

### Metrics
- `chrome.cookies.getAll`: 3 hits
- Action dispatchers (case / type strings): **0 for share/relist/delist/offer**
- Only `invsysInstitutionLinks` + `invsysStartInstitutionLink` GraphQL mutations

---

## Closo — Technical Details

### Endpoints
- `https://app.closo.co` (REST)
- `wss://app.closo.co/ws/` (WebSocket task dispatch)
- `${CLOSO_APP_API}/api-parser/save-batch-items` (POST scraped listing data)
- `X-Closo-Token` auth header

### Code artifacts
- 5 named alarms (most sophisticated in audit):
  - `chrome.alarms.create(CONFIG_REFRESH_ALARM, {periodInMinutes: EXT_CONFIG_REFRESH_MIN})`
  - `chrome.alarms.create(OUTBOX_DRAIN_ALARM, {periodInMinutes: 0.5})` (30s)
  - `chrome.alarms.create('processingIds_sweep', {periodInMinutes: 1})`
  - `chrome.alarms.create(KEEPALIVE_ALARM, {periodInMinutes: KEEPALIVE_INTERVAL_MIN})`
  - `chrome.alarms.create(SOLD_CHECK_ALARM, {periodInMinutes: SOLD_CHECK_INTERVAL_MIN, delayInMinutes: 2})` (15 min)
  - `chrome.alarms.create(REST_POLL_ALARM, {periodInMinutes: REST_POLL_INTERVAL_MIN, delayInMinutes: 0.2})` (60s)
- `poshmark_script.js` actions:
  - Share: clicks `button[data-et-on-name="listing_flow_share"]`
  - Relist: `taskOp === 'relist'` branch
  - Delist: `async function delist()` + `taskOp === 'delist'`
- `['openCreateListing','openEditListing','openDeleteListing','openSharing','offersToLikers'].indexOf(action)!==-1` — action dispatcher whitelist
- `safeSendToTab(cfg.tabId, {action:'checkSoldItems', platform})` — SOLD_CHECK_ALARM handler
- `fetch(base + '/ext-tasks/pending?since=...')` with `X-Closo-Token` — REST_POLL_ALARM handler

### Dashboard state
- ~~All routes 404: `/poshmark`, `/dashboard`, `/automation`, `/crosslist`, `/poshmark-sharing`, `/inventory`~~ ~~**CORRECTED 2026-04-19:** App REVIVED. AI agent suite launched 2025.~~ **RE-REINSTATED 2026-04-19 (same-day):** Second live check confirms `app.closo.co` is still a near-empty shell — renders only "Home / Login / Exit" with no product content. Blog (`closo.co/blog`), `/ai-agents`, `/pricing`, `app.closo.co/dashboard` all return 404. Original 404 finding stands.
- ~~Sidebar: Task Manager "No active tasks"~~ — Dashboard not accessible (404)
- Framework: Yii PHP / AdminLTE layout (original; dashboard inaccessible for re-verification)
- ~~**App appears abandoned**~~ ~~**CORRECTED 2026-04-19:** Active — AI pivot confirmed~~ **RE-REINSTATED 2026-04-19:** Website nav lists many features and AI agents but all page links resolve to 404. Revival is cosmetic-only; no functional UI accessible as of 2026-04-19.

---

## Vendoo — Technical Details

### Endpoints
- `https://api.web.vendoo.co` (primary API + queue)
- `https://cdn.vendoo.co/ddpv2rum` (DataDog RUM telemetry)
- `externally_connectable: ["*://web.vendoo.co/*", "*://internal-beta.vendoo.co/*", "*://enterprise.vendoo.co/*", "*://enterprise-internal-beta.vendoo.co/*"]`

### Architecture — server-dispatched in-extension execution
1. `chrome.alarms.create("VendooQueuePulling", ...)` fires every 5 min (`db=5`)
2. Alarm handler `AF` → `mb()` → `fb()` → `pullNextCommands()`
3. Commands routed via `Lv` lookup table:
   - `Lv = {EXEC_PAGE_SCRIPT: Cg, GET_COOKIES: Ov, INTERCEPT_REQUEST_BODY: Av, WEB_REQUEST: Cv, ...}`
4. `Cg = (e,t) => new Promise(r => {ri({url:e.url,active:!!e.activeTab}).then(n => {chrome.tabs.sendMessage(n.id, t, o => {r(o)})})})` — opens marketplace tab + sends EXEC_PAGE_SCRIPT
5. `execPageScriptContent.js` receives via `chrome.runtime.onMessage.addListener(lle)`
6. Dispatches via action table `TN`:
   ```
   TN = {click:aM, fireEvent:lM, getFromStorage:_M, hover:Oq,
         setInput:iM, renderModal:Tq, removeModal:wq, uploadImages:sM,
         wait:Sq, waitForElement:uM, sendRequest:bN, mercariList:xN}
   ```
7. `bN` (sendRequest):
   ```
   bN = async (e,t) => { if(!!sle(e)) try { let r = await ts(e.payload, {}); 
                         return JSON.stringify({response:r}) } catch(r) {...} }
   ```
8. `ts()` → `vN()` → fetch with `n.credentials = e.withCredentials || e.withCredentials === void 0 ? "include" : "omit"` — default uses marketplace session cookies
9. `corsRules.json`: 16 `modifyHeaders` rules spoof `Origin`/`Referer` on Depop, Facebook, Grailed, Filepicker, Kidizen, etc.

### Cookie injection (session-write)
- `Fb = e => { let t = (e?.url) || "https://api.web.vendoo.co", ... }`
- `Lb = ({url:e, domain:t}, r, n, o=Date.now()/1e3+60*60*24*365*10) => chrome.cookies.set({url:e, domain:t, name:r, value:n, path:"/", httpOnly:!0, secure:!0, sameSite:"strict", expirationDate:o})`
- `Ov = e => chrome.cookies.getAll(e)` — passive read for web app
- `Rb/Pb = (e,t) => chrome.cookies.get({url:e, name:t})` — specific cookie reads

### Error strings confirming features
- `emptyLikers: "The selected item does not have enough likes to receive offers"` — offers-to-likers
- `itemHasOffers: "This item was not delisted because it has active offers"` — delist with offer state
- `hasActiveOffers: "An active offer already exists for this item"` — offer conflict
- `uploadImages: "Your item was successfully listed but some images did not transfer..."` — cross-list confirmation
- `unhandledDelistingError`, `deniedDelist` — delist error branches
- `"you can relist this item again in 5 minutes"` — relist rate limit

### UI routes
- `/app/inventory`, `/app/inventory/new`, `/app/import`
- ~~`/app/pro-tools` (sub-tabs: Send Offers, Delist & Relist, Bulk Edit, Price Adjuster)~~ **CORRECTED 2026-04-19:** Pro Tools restructured — now 3-card layout: Send Offers, Auto Offers, Marketplace Sharing. Delist & Relist, Bulk Edit, and Price Adjuster sub-tabs removed.
- `/app/offers` (Send Offers — 6 platforms: eBay, Poshmark, Mercari, Depop, Grailed, Vestiaire Collective)
- `/app/auto-offers` or `/v2/automations/auto-offers` (Auto Offers — same 6 platforms; per-platform price rules + exclusions)
- `/app/analytics`, `/app/settings/#subscription`
- `/v2/automations/sharing` (Marketplace Sharing — Depop/Poshmark/Grailed; "Marketplace Refresh" UI label not "Share"; accessible on Pro)
- **Business-tier-only** v2 routes (redirect to `/login` on Pro; resolve to `enterprise.vendoo.co/...` which returns Firebase 404): `/v2/automations/mapping-rules`, `/v2/automations/pricing-rules`, `/v2/automations/marketplace-defaults`, `/v2/automations/shopify`

### Pricing
- Lite ~$14.99/mo, Pro **$59.99/mo** (verified 2026-04-19 via active trial), ~~Business not publicly priced~~ **CORRECTED 2026-04-19:** Enterprise (high-volume) at `vendoo.co/enterprise/high-volume` — **$399/mo Standard** + custom one-time imports $499–$1,299 (up to 5K–20K items) + White Glove Listing Service. Enterprise Firebase deployment at `enterprise.vendoo.co` is a separate tier.
- **Vendoo Go** (id6746722923): separate AI quick-listing iOS app, v1.0.1 ~Apr 15 2026

### Metrics
- `service_worker.js`: 269,984 bytes
- `execPageScriptContent.js`: 552,455 bytes (delist refs: 33 [all string constants], relist refs: 4 [all strings], click(): 0, direct marketplace fetch: 0, querySelector: 26)
- `interceptRequest.js`: 61,168 bytes (Facebook-only XHR wrapper)
- `scripts/patch.js`: 60,798 bytes (XHR.prototype.open/send wrapper, 6 XHR hits + 1 querySelector)
- `vendooWeb.js`: 62,270 bytes (on vendoo.co domains only)
- `chrome.tabs.sendMessage` in service_worker: 2 call sites (Cg + Av)

---

## Cross-cutting technical metrics

### Extension size comparison (JS total)
| Rank | Extension | Total JS ~size | Notes |
|------|-----------|---------------|-------|
| 1 | PrimeLister | ~9.2MB | 4 large bundles (background + panel + router + popup) |
| 2 | SellerAider | ~13MB | 17 bundles, per-marketplace |
| 3 | Vendoo | ~1.1MB | 5 minified scripts |
| 4 | Flyp Bot Sharer | ~1.2MB | Single background.js |
| 5 | Crosslist | 1.6MB | Single background.js |
| 6 | Flyp Crosslister | <1MB | Multiple per-platform scripts |
| 7 | Nifty | ~930KB | 1.7KB background + 522KB popup + 409KB constants |
| 8 | Crosslist Magic | ~500KB | 39 content scripts (small each) |
| 9 | Closo | ~400KB | Multiple Poshmark scripts |
| 10 | OneShop | 18.6KB | Smallest — auth/linking only |

### `chrome.alarms.create` usage
| Extension | Count | Purpose |
|-----------|-------|---------|
| PrimeLister | 0 | Uses setInterval polling |
| Crosslist | 1 | "SalesPolling" every 30 min |
| Crosslist Magic | 0 | Uses setInterval bridge heartbeat |
| SellerAider | 0 | Uses setInterval queue drain |
| Flyp Crosslister | 0 | Manual trigger |
| Flyp Bot Sharer | 0 | Server-driven via postMessage bridge |
| Nifty | 0 | Web-app-driven |
| OneShop | 0 | setInterval metadata refresh |
| Closo | 9 (6 unique) | Most sophisticated alarm design |
| Vendoo | 1 | `VendooQueuePulling` 5-min server pull |

### Credential tier
| Tier | Extensions |
|------|------------|
| A (local only) | SellerAider |
| B (cookie relay/bridge) | PrimeLister, Crosslist, Crosslist Magic, Flyp (both), Nifty, OneShop, Closo, Vendoo |

### Execution model
| Pattern | Extensions |
|---------|-----------|
| In-extension automation | PrimeLister, Closo, Vendoo (via content scripts) |
| Web-app-driven (extension is bridge) | Nifty, OneShop |
| Hybrid (config in web app, exec in extension) | Flyp (both), Crosslist, Crosslist Magic |
| Tier A extension-only | SellerAider |

### External connect validation
| Extension | `onMessageExternal` validates origin? |
|-----------|--------------------------------------|
| PrimeLister | **No** — zero origin validation in 2 listeners |
| Nifty | Matches list: poshmark.com + nifty.ai only |
| OneShop | No external listener |
| Closo | `externally_connectable: ["https://app.closo.co/*"]` only |
| Vendoo | `externally_connectable` restricted to vendoo.co subdomains |

---

## Marketing vs Code Discrepancies (final list)

| Extension | Claim | Evidence | Verdict |
|-----------|-------|----------|---------|
| Crosslist | "Delist and relist with one click" | No relist function — only eBay prelist URL strings | **OVERSTATES** |
| Crosslist | "Actions happen directly on your computer" | `credentials:"include"` + chrome.alarms poll app.crosslist.com | **MISLEADING** |
| SellerAider | "Share Your Closet" | No share code; Tier A has no delegation path | **OVERSTATES** |
| SellerAider | "Relist Your Listings" | Only eBay prelist URL strings | **OVERSTATES** |
| SellerAider | "Send Offers" | No offer code | **OVERSTATES** |
| Closo | "Lists on multiple marketplaces" | Poshmark-only in code | **OVERSTATES** |
| Vendoo | "Marketplace Sharing" in Pro pricing | Real feature — called "Marketplace Refresh" in UI | MATCH (naming confusing) |
| PrimeLister | Closet/Community/Party Share | In Automation enum, in popup UI | UNDERSTATES (not on homepage) |
| PrimeLister | — | `isharemyscreen.com?email=${email}` in panel.js referral URL | **PII leak** |

---

## Production Vulnerabilities Found

1. ~~**Nifty `/analytics` Insights tab** — Next.js hydration exception in production~~ **RETRACTED 2026-04-19** — not a real vulnerability. `/analytics/insights` was never a sub-route; the Insights view IS `/analytics` and works fine.
2. **PrimeLister email leak** — Referral href appends user email to `isharemyscreen.com` URL
3. **PrimeLister `onMessageExternal`** — zero origin validation on 2 listeners
4. ~~**Closo** — App non-functional (all routes 404); likely abandoned~~ **RETRACTED 2026-04-19** — App REVIVED with AI agent suite 2025; prior 404 state was during active rebuild
5. **Crosslist credential claim** — MISLEADING marketing creates legal/trust risk
6. **SellerAider** — 3 unimplemented marketing claims (Share/Relist/Offers on homepage)

---

## Open intelligence gaps

| Gap | Reason | How to close |
|-----|--------|--------------|
| Vendoo `/v2/automations/*` Business-tier (mapping-rules, pricing-rules, marketplace-defaults, shopify) | **PARTIALLY CLOSED 2026-04-19** — confirmed Business-tier-only (not unlocked by Pro $59.99). Routes redirect to `/login` on Pro; from active v2 session resolve to `enterprise.vendoo.co/...` = Firebase 404. Enterprise deployment is broken. | Contact Vendoo Business/Enterprise sales |
| ~~Nifty automation config detail~~ | **FULLY CLOSED 2026-04-19** — all 9 panels documented across 4 platforms. See `COMPETITOR_NIFTY_POSHMARK_DEPOP_2026-04-19.md`. **Remaining gates:** Otto beta (`isOttoBetaUser: true` role-gated), Whatnot (`isWhatnotBetaUser: false`), Facebook/Grailed absent from UI. | N/A |
| ~~PrimeLister automation popup UI~~ | **CLOSED 2026-04-19** — all 12 panels documented. eBay/Mercari/Depop still require per-platform sub. | N/A |
| ~~OneShop dashboard~~ | **PARTIALLY CLOSED 2026-04-19** — free tier accessed; 6 bot route names confirmed from build manifest; pricing $45 USD/month confirmed. Bot configs paywalled behind Premium (not activated). | Activate OneShop Premium trial |
| ~~SellerAider dashboard~~ | **CLOSED 2026-04-19** — authenticated at `my.selleraider.com`. 5 sections mapped. Messages = Coming Soon. Analytics = Coming Soon. | N/A |
| Flyp post-trial pricing | `/settings/billing` redirects to `/my-items`; pricing page not navigated | Navigate marketing /pricing page |
| Closo live product | ~~**CLOSED 2026-04-19** — App REVIVED~~ **RE-OPENED 2026-04-19:** Second check confirms app is still a skeleton (all feature pages 404). | Re-verify after Closo ships functional product |
| ~~SellerAider "Automatic Messages"~~ | **CLOSED 2026-04-19** — Confirmed false. `/dashboard/messages` = "Coming Soon" stub with no controls. | N/A |
| Nifty Smart Credits modal | Beta-gated — `isOttoBetaUser: true` required. **VERIFIED 2026-04-19:** Bundle II trial alone insufficient; role flag not granted on trial enrollment. | Requires Nifty beta invitation |
| OneShop bot configs (all 6 controls) | Paywalled behind Premium (not activated) | Activate OneShop Premium trial |

---

## Source session context (research timeline)

- Session dates: 2026-04-18 through 2026-04-19
- Research passes: 5 initial (code audit → marketing → dashboard → walkthrough → gap closure) + 1 late discovery (Flyp second extension) + 1 architecture correction (Vendoo "Hybrid" → "IN-EXTENSION") + 2 trial-activation passes (PrimeLister/OneShop/Nifty/Vendoo trial unlock; Nifty Poshmark+Depop connection unlock)
- Test account: vaultifacts@gmail.com / vaultlister@gmail.com; OneShop phone `+15874320514`
- Tool environment: Chrome Profile 3 (user's real Chrome with extensions + logins); `mcp__claude-in-chrome__*` tools only (never `chrome-devtools-mcp`)
- Source reports (all in `docs/`):
  1. `COMPETITOR_EXTENSION_AUDIT_2026-04-18.md`
  2. `COMPETITOR_WEBSITE_VS_CODE_2026-04-18.md`
  3. `COMPETITOR_DASHBOARD_VERIFICATION_2026-04-18.md`
  4. `COMPETITOR_FULL_WALKTHROUGH_2026-04-18.md`
  5. `COMPETITOR_GAP_CLOSURE_2026-04-18.md`
  6. `COMPETITOR_MASTER_2026-04-18.md` (strategic summary)
  7. `COMPETITOR_TRIAL_UNLOCK_2026-04-19.md` (PrimeLister 12 panels, OneShop free-tier, Nifty eBay/Mercari configs, Vendoo Pro doesn't unlock v2)
  8. `COMPETITOR_NIFTY_POSHMARK_DEPOP_2026-04-19.md` (Nifty Poshmark + Depop automation configs after user connected both accounts)
  7. `COMPETITOR_TECHNICAL_APPENDIX_2026-04-18.md` (this file)
