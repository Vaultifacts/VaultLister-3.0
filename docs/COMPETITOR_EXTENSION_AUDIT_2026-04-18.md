# Competitor Extension Audit — 2026-04-18
> Read-only audit. All claims backed by direct code quotes. "Unverified" used where evidence is absent.

## Summary Table

| # | Extension | Cred Tier | Endpoints | Share | Relist | Delist | Offers | Cross-list | Scheduling | Ext Connect |
|---|-----------|-----------|-----------|-------|--------|--------|--------|------------|------------|-------------|
| 1 | PrimeLister | B | api.primelister.com | Yes | Yes | Yes | Yes | Yes | setInterval polling task queue (dynamic interval via variable `t`) | onMessageExternal + onConnectExternal (marketplace + primelister.com pages) |
| 2 | Crosslist | B | app.crosslist.com | No | No | Yes | No | Yes | chrome.alarms (sales polling) | onConnectExternal (crosslist.io/com) |
| 3 | Crosslist Magic | B | crosslistmagic.com | No | No | No | No | Yes | setInterval (bridge heartbeat) | onMessageExternal (crosslistmagic.com) |
| 4 | SellerAider | A | app.selleraider.com | No | No | Yes | No | Yes | setInterval (queue drain) | none |
| 5 | Flyp | B | tools.joinflyp.com | No | Yes | Yes | No | Yes | none found | none |
| 6 | Nifty | B | nifty.ai (via port) | No | No | No | No | No | none | onMessageExternal + onConnectExternal (poshmark.com + nifty.ai) |
| 7 | OneShop | B | gql-api.oneshop.com | No | No | No | No | No | setInterval (metadata refresh) | none |
| 8 | Closo | B | app.closo.co (WS + REST) | Yes | Yes | Yes | Yes | No | chrome.alarms (REST_POLL 60 s, SOLD_CHECK 15 min) | onConnectExternal (app.closo.co) |
| 9 | Vendoo | B | api.web.vendoo.co | No | Yes | Yes | Yes | Yes | chrome.alarms (VendooQueuePulling, 5 min server pull) | onConnectExternal (vendoo.co subdomains) |

**Vendoo execution model (100% in-extension):** The `VendooQueuePulling` alarm fires every 5 min, pulls command instructions from `api.web.vendoo.co`, and dispatches `EXEC_PAGE_SCRIPT` via `chrome.tabs.sendMessage` to the target marketplace tab. `execPageScriptContent.js` receives via `chrome.runtime.onMessage.addListener(lle)` and routes through action dispatch table `TN={click:aM, fireEvent:lM, getFromStorage:_M, hover:Oq, setInput:iM, renderModal:Tq, removeModal:wq, uploadImages:sM, wait:Sq, waitForElement:uM, sendRequest:bN, mercariList:xN}`. `sendRequest` (`bN`) executes authenticated `fetch()` calls to marketplace APIs from the content-script context with `credentials:"include"` (marketplace session cookies). `corsRules.json` permits the cross-origin requests by modifying `Origin`/`Referer` headers. Delist/Relist/Offers/Cross-list are all executed as server-dispatched sequences of these primitive actions (click + sendRequest + uploadImages + mercariList). The Vendoo web app is UI/orchestrator only; it does NOT make direct marketplace API calls.

---

## Evidence

### 1 — PrimeLister (`eepbhjeldlodgnndnjofcnnoampciipg/2.0.125_0`)

**Credential tier: B.** Cookies are read from every marketplace tab then POSTed to `api.primelister.com/cookies`. Writeback (`SET_COOKIES`) also exists. No email/password stored — JWT managed client-side.

**Endpoints:** `https://api.primelister.com` (kyInstance prefixUrl), `https://r2.primelister.com` (config JSON), `https://www.isharemyscreen.com/primelister` (panel.js referrer link — outbound email leak only, not automation).

**Scheduling:** No `chrome.alarms.create` anywhere in the bundle. Confirmed `setInterval` at 1 s polling `user-action-queue-requests` from `api.primelister.com`:
```
setInterval(async()=>{let t=await d(e);0===t.length&&(clearInterval(u),u=null)},t)},1e3)
```
Tasks are server-dispatched; the extension polls at 1-second intervals when a task queue is active.

**Action vocabulary (ActionLabelsEnum + Automation enum):**
- `ActionLabelsEnum.DELIST`, `.RELIST`, `.SEND_OFFER`, `.CROSSLIST`, `.IMPORT`, `.DELETE`, `.DUPLICATE`
- `Automation.AUTO_CLOSET_SHARE`, `.AUTO_COMMUNITY_SHARE`, `.AUTO_PARTY_SHARE`, `.RETURN_SHARE`, `.AUTO_RELIST`, `.AUTO_SEND_OFFER_TO_LIKERS`, `.RETURN_FOLLOW`
- Share and offers exist as automation modes, not panel action buttons (no `action_share` asset).

**Cookie relay path:**
```js
// saveAllMarketplacesCookies iterates all Marketplace enum values:
f=async()=>{Object.values(o.Marketplace).forEach(async e=>{p(e)})}
// p (saveCookiesHandler) reads cookies then calls:
await primeListerApi.setCookies({marketplace,email},{cookies,shopperId,...csrf,...accessToken})
// setCookies POSTs to api.primelister.com/cookies:
[PrimeListerRequest.SET_COOKIES]:async(e,t)=>await kyInstance.post("cookies",{json:t,searchParams:e}).json()
// Bidirectional: GET_COOKIES reads back from api.primelister.com/account/cookies:
[PrimeListerRequest.GET_COOKIES]:async e=>{let t=await kyInstance.get("account/cookies",{searchParams:e}).json()...}
```

**isharemyscreen.com:** Panel JS contains `href: email ? \`https://www.isharemyscreen.com/primelister?email=${email}\` : "..."` — this is a referral link that leaks the user's email to isharemyscreen.com when clicked.

**External connect surface:** `onMessageExternal` (replies "pong"). `onConnectExternal` via `externally_connectable` covering all 9 marketplace domains + primelister.com + sentry.io + vercel.app.

---

### 2 — Crosslist (`knfhdmkccnbhbgpahakkcmoddgikegjl/3.9.13_0`)

**Credential tier: B.** `chrome.cookies.getAll` used internally (e.g. Vinted token). Alarm polls `app.crosslist.com` with `credentials:"include"`.

**Endpoints:** `https://app.crosslist.com` (SalesPolling API), `https://logs.crosslist.com` (Sentry).

**Scheduling:** `chrome.alarms.create(Ci, {delayInMinutes:1, periodInMinutes:mn})` — named "SalesPolling", fires periodically to poll `${t.domain}/Api/SalesPolling/GetSalesDetectionConfig` and `/SubmitSales`.

**Share:** No closet-sharing automation found. Only hit for "share" was party name strings (e.g. `"Grandmas2Share"`).

**Relist:** No relist function found. `relist` hits were eBay prelist URL strings only.

**Delist:** Yes — `async delistListing(e)` calls `this._delistListing(e)` which POSTs to Vinted `/items/${e}/delete`.

**Offers:** No offer-sending function. `makeoffer` hit was a Depop listing field: `makeoffer:e.acceptOffers` (data label, not action).

**Cross-list:** Yes — the extension is a cross-listing tool; creates listings on target platforms.

**External connect:** `onConnectExternal` via `externally_connectable: ["*://*.crosslist.io/*","*://*.crosslist.com/*","*://localhost/*"]`.

---

### 3 — Crosslist Magic (`lkjldebnppchfbcgbeelhpjplklnjfbk/0.0.337_0`)

**Credential tier: B.** Fetches via `https://www.crosslistmagic.com/api/proxy` — acts as server proxy for marketplace requests.

**Endpoints:** `crosslistmagic.com/api/proxy`, `/api/get-product`, `/apiv2/extension/`, `/error-status`.

**Scheduling:** `setInterval(P, sK)` — bridge heartbeat (interval value `sK` is a variable, not a fixed ms literal).

**Share / Relist / Delist / Offers:** No evidence in background.js. `relist` hit was eBay prelist URL string. `offer` hits were brand names.

**Cross-list:** Yes — core function. Imports from one platform and posts to another via the `crosslistmagic.com/api/proxy`.

**External connect:** `onMessageExternal` (manifest `externally_connectable` covers crosslistmagic.com and marketplace domains).

---

### 4 — SellerAider (`hoadkegncldcimofoogeljainpjpblpk/1.0.8.53_0`)

**Credential tier: A.** `chrome.cookies.get` is used locally to read a session cookie for auth verification — code shows it is consumed locally, not relayed to `app.selleraider.com`. No `cookies.getAll` relay found. No `cookies.set` found.

**Endpoints:** `https://app.selleraider.com`, `https://dashboard.selleraider.com`.

**Scheduling:** `setInterval` in background for queue drain (not fixed-interval automation).

**Share:** No closet-sharing DOM action found in any bundle. `share` keyword hits (10 per bundle) are all shared lodash/core-js code.

**Relist:** `relist` found as an eBay prelist URL string reference (`ebay.com/sl/prelist/suggest`), not as a delete+repost automation.

**Delist:** Yes — `DELIST_EDIT_COMPLETE`, `DELIST_DELETE_COMPLETE`, `DELIST_TRY_DELETE` constants in poshmark.bundle.js. Crosslister bundle references `automatic-delist` docs URL.

**Offers:** No offer-sending action found.

**Cross-list:** Yes — core function; `crosslister.bundle.js` (805 KB) is the primary cross-listing module.

**External connect:** No `externally_connectable` in manifest, no `onConnectExternal` or `onMessageExternal` found.

---

### 5 — Flyp (`kbflhgfmfbghhjafnjbgpiopcdjeajio/1.0.4_0`)

**Credential tier: B.** `chrome.cookies.getAll` reads Depop `access_token` and session cookies and passes them into API calls to `tools.joinflyp.com`. Cookies stay in-extension for request auth headers; no explicit POST of raw cookie objects to server found, but the token is used as Bearer in requests to `tools.joinflyp.com`.

**Endpoints:** `https://tools.joinflyp.com` (primary API).

**Scheduling:** No `chrome.alarms` found. No long-`setInterval` scheduling.

**Share:** No closet-sharing found.

**Relist:** Yes — `EXECUTE:RELIST_ITEM_POSHMARK` message constant.

**Delist:** Yes — `EXECUTE:DELIST_ITEM_POSHMARK`, `RETURN:DELIST_LISTING_POSHMARK`, `RETURN:DELIST_LISTING_MERCARI`.

**Offers:** No offer-sending found.

**Cross-list:** Yes — described as "Crosslister by Flyp" in package name; creates listings across Poshmark, Mercari, Depop, Facebook.

**External connect:** No `externally_connectable` in manifest.

---

### 6 — Nifty (`ggcfdkgmekpddencdddinlmpekbcohoa/3.1.1_0`)

**Credential tier: B.** `background.js` (1737 bytes) responds to `onConnectExternal` from `poshmark.com` and `nifty.ai`. On `autoposher/get-all-cookies-request`, reads `chrome.cookies.getAll` for marketplace URLs and returns cookies **to the requesting page** (i.e. the nifty.ai web app page drives automation using the cookies via the extension bridge). Cookies never POSTed server-side by the extension itself.

```js
case "autoposher/get-all-cookies-request": {
  const o = await u();  // chrome.cookies.getAll for all marketplace URLs
  s({id:t.id, type:"autoposher/get-all-cookies-response", cookies: o.filter(...)});
```

**Endpoints:** `nifty.ai` (via extension bridge, not direct fetch from extension). No outbound fetch calls in `index-G6cBpr4F.js`.

**Share / Relist / Delist / Offers / Cross-list:** Logic lives entirely in the nifty.ai web app, which drives the extension via `onConnectExternal`. The extension is a cookie-access bridge only.

**Scheduling:** No `chrome.alarms`, no `setInterval` in the extension. Scheduling managed by the web app.

**External connect:** `externally_connectable: ["*://*.poshmark.com/","*://*.nifty.ai/*"]`. `onConnectExternal` + `onMessageExternal` both active.

---

### 7 — OneShop (`pcapaniacmdmabfopeeimmpjkkjpeiok/2_0`)

**Credential tier: B.** `chrome.cookies.getAll({domain:"oneshop.com"})` reads session tokens (`x-sp-bm-id`, `x-sp-bm-token`, etc.) and attaches them as headers to GraphQL requests to `gql-api.oneshop.com/graphql`.

**Endpoints:** `https://gql-api.oneshop.com/graphql`, `https://metadata.app.oneshop.com`.

**Key mutation found:**
```js
mutation { invsysStartInstitutionLink(institution: ${e}, reauthStrategy: BROWSER_EXTENSION...
```

**Scheduling:** `setInterval` at ~2 s for metadata/config refresh. No `chrome.alarms`.

**Share / Relist / Delist / Offers:** No evidence of any automation actions in `background.js` (18 KB only). Extension appears to handle authentication + institution linking only.

**Cross-list:** Architecture suggests cross-platform inventory sync (`invsysInstitutionLinks` + `cookieDomains` matching), but no explicit create-listing action found in the extension code.

**External connect:** No `externally_connectable`, no `onConnectExternal` in manifest.

---

### 8 — Closo (`aipjhdapgmimfdfcjmlpeoopbdldcfke/3.1.42_0`)

**Credential tier: B.** Authenticates with `app.closo.co` via `X-Closo-Token` header. Cookies read locally (`chrome.cookies.getAll` for Depop) for local use; no cookie relay to server found.

**Endpoints:** `https://app.closo.co` (REST + WebSocket `wss://app.closo.co/ws/`). Tasks dispatched server-side via WebSocket; REST is a fallback.

**Scheduling:**
- `SOLD_CHECK_ALARM` every 15 min — asks marketplace content scripts to check for sold items:
  `safeSendToTab(cfg.tabId, {action:'checkSoldItems', platform})`
- `REST_POLL_ALARM` every 60 s — fallback for when WS is down:
  `fetch(base + '/ext-tasks/pending?since=...')` with `X-Closo-Token`
- Plus: `CONFIG_REFRESH_ALARM`, `OUTBOX_DRAIN_ALARM` (30 s), `KEEPALIVE_ALARM`.

**Share:** Yes — `poshmark_script.js` clicks `button[data-et-on-name="listing_flow_share"]`.

**Relist:** Yes — `taskOp === 'relist'` handled in `poshmark_script.js`.

**Delist:** Yes — `async function delist()` in `poshmark_script.js`:
```js
if (taskOp === 'delist') { ... }
```

**Offers:** Yes — `['DeleteListing','openSharing','offersToLikers'].indexOf(action) !== -1` in background.js.

**Cross-list:** No evidence found.

**External connect:** `externally_connectable: ["https://app.closo.co/*"]`. `onConnectExternal` active.

---

### 9 — Vendoo (`mnampbajndaipakjhcbbaihllmghlcdf/3.1.10_0`)

**Credential tier: B.** `chrome.cookies.set` writes cookies to marketplace domains using tokens/values sourced from `api.web.vendoo.co`. `cookies.set` target URL defaults to `https://api.web.vendoo.co` unless overridden:
```js
Fb=e=>{let t=(e?.url)||"https://api.web.vendoo.co",...}
```
The extension writes platform cookies on behalf of Vendoo's web app (session injection for automation).

**Endpoints:** `https://api.web.vendoo.co` (primary), `https://cdn.vendoo.co/ddpv2rum` (DataDog RUM). `corsRules.json` has 16 `modifyHeaders` rules spoofing `origin`/`referer` for Depop, Facebook, and other platforms.

**Scheduling:** `chrome.alarms.create("VendooQueuePulling", ...)` — alarm name `Fi = "VendooQueuePulling"`. Queue runs every 5+ minutes (`db=5` minutes min interval). Queue dispatcher calls `Su()` which iterates queue commands.

**Share:** No share action found in `service_worker.js`.

**Relist:** Yes — `"Delist & Relist add-on"` referenced; `relist` as an operation in queue.

**Delist:** Yes — 22 hits; error messages and handler: `unhandledDelistingError`, `deniedDelist`, `itemHasOffers` → skip delist with offers.

**Offers:** Yes — `"doesn't have enough likes to receive offers"` (offer-to-likers feature referenced).

**Cross-list:** Yes — core function; 16 platform rules in `corsRules.json`, proxy API at `crosslistmagic.com` not used here but Vendoo has its own cross-posting pipeline via `api.web.vendoo.co`.

**External connect:** `onConnectExternal.addListener(RF("external"))` — `externally_connectable` covers `web.vendoo.co`, `internal-beta.vendoo.co`, `enterprise.vendoo.co`, `enterprise-internal-beta.vendoo.co`.

---

## Corrections to Prior Session Claims

| Claim | Prior | Corrected |
|-------|-------|-----------|
| PrimeLister scheduling | "Scheduled (alarms)" | **setInterval 1 s task-queue poll** — zero `chrome.alarms.create` in codebase |
| PrimeLister share | unlisted | **Yes** — `AUTO_CLOSET_SHARE`, `AUTO_COMMUNITY_SHARE`, `AUTO_PARTY_SHARE` in Automation enum |
| Crosslist share | "✅" | **No** — no closet-share function found; only party name strings |
| Crosslist relist | "✅" | **No** — only eBay prelist URL strings, not a relist function |
| Crosslist offers | "❌" | Confirmed **No** — `makeoffer` is a Depop listing field, not an action |
| Vendoo "web app only, no cookies" | WRONG | **Tier B** — `cookies.set` writes to marketplace domains; `VendooQueuePulling` alarm; full automation pipeline |
| Nifty automation in extension | unclear | **Bridge only** — nifty.ai web app drives via `onConnectExternal`; all scheduling/automation is in the web app |
