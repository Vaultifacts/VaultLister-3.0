# Competitor Intelligence — Master Consolidated Report — 2026-04-18

> Synthesized from 4 research passes across 9 competitors.
> Sources: COMPETITOR_EXTENSION_AUDIT, COMPETITOR_WEBSITE_VS_CODE, COMPETITOR_DASHBOARD_VERIFICATION, COMPETITOR_FULL_WALKTHROUGH, COMPETITOR_GAP_CLOSURE (all 2026-04-18).

---

## Executive Summary

### Competitors Analyzed (9)
PrimeLister, Crosslist, Crosslist Magic, SellerAider, Flyp, Nifty, OneShop, Closo, Vendoo.

### Research Methodology (4 passes)
1. **Code audit** — Chrome extensions in `Profile 3/Extensions/` read directly from disk; all claims backed by code quotes. 10 extensions across 9 products.
2. **Marketing vs. code comparison** — each competitor's website claims cross-referenced against extension audit findings (MATCH / OVERSTATES / MISLEADING / DELEGATED).
3. **Dashboard verification** — live browser sessions (vaultifacts@gmail.com) into 6 dashboards; every page visited documented.
4. **Gap-closure walkthrough** — targeted deep-dive into sub-tabs, billing pages, AI features, and extension popup UIs missed in prior passes.

### Top 5 Strategic Insights

1. **The market is split at the architecture layer.** Vendoo, Nifty, and PrimeLister are server-driven cloud platforms that work without a browser open. Flyp is a hybrid. Crosslist, Crosslist Magic, and SellerAider are extension-heavy with minimal server logic. Closo is dead. VaultLister's full-stack architecture (API + Playwright workers + BullMQ) is aligned with the top tier.

2. **Three competitors make claims their code cannot support.** Crosslist advertises "relist with one click" — no relist function exists. SellerAider lists "Share, Relist, Send Offers" on its homepage — it is the only Tier-A extension with no server relay, so none of these can be delegated. Closo claims multi-marketplace listing — no cross-platform code found, and the app appears abandoned.

3. **Flyp has the deepest public automation UX.** Its Sharer tab exposes granular controls no competitor matches publicly: 3 sharing modes, HDT scheduling, 4-speed slider, Community Share return-rate targeting, follow/unfollow counts, Bulk Offers vs. Auto-Offers as separate tools. VaultLister can replicate and exceed this.

4. **Nifty leads on AI + credits model.** The "Smart Credits" metering UI (50/month, "Buy more" upsell) is a monetization pattern worth copying for Vault Buddy. ~~Analytics Insights broken~~ **RETRACTED 2026-04-19:** The prior "broken analytics" finding was a misinterpretation — `/analytics/insights` never existed as a sub-route. The Insights IS `/analytics`, which loads fully with real data (289 listings, 2 sold, 0.7% sell-through, $28 revenue, $20.10 profit).

5. **No competitor has automatic buyer messaging — confirmed.** ~~SellerAider claims "Automatic Messages" on its pricing page — no other competitor lists this. This is the single feature absent from all other dashboards that VaultLister could ship as a differentiator.~~ **VERIFIED 2026-04-19:** SellerAider's "Automatic Messages" is confirmed phantom — `/dashboard/messages` shows a "Coming Soon — Manage your messages on all platforms/marketplaces" placeholder with no controls or templates. Zero competitors deliver this in any dashboard. VaultLister can be first to ship verified buyer messaging with zero competitive overlap.

---

## Per-Competitor Master Profiles

---

### 1. PrimeLister

**Architecture:** Tier B. Cookies bidirectionally relayed — extension reads cookies from every marketplace tab and POSTs them to `api.primelister.com/cookies`; writeback (`SET_COOKIES`) also exists. Server dispatches tasks; extension polls at 1-second intervals via `setInterval`. Web app handles inventory + cross-listing; automation controls live exclusively in the Chrome extension popup.

**Extension(s):**
- `eepbhjeldlodgnndnjofcnnoampciipg/2.0.125_0` (Plasmo framework, Manifest V3)
- Permissions: `cookies`, `storage`, `tabs`, `scripting`, `alarms`
- Content scripts target: Poshmark US/CA, Mercari, eBay (3 domains), Facebook, Depop, Grailed, Shopify, Etsy, Amazon (3 domains), Tradesy, Vestiaire Collective (15 platforms)

**Features confirmed in code:**
- `ActionLabelsEnum.DELIST`, `.RELIST`, `.SEND_OFFER`, `.CROSSLIST`, `.IMPORT`
- `Automation.AUTO_CLOSET_SHARE`, `.AUTO_COMMUNITY_SHARE`, `.AUTO_PARTY_SHARE`, `.AUTO_RELIST`, `.AUTO_SEND_OFFER_TO_LIKERS`, `.RETURN_SHARE`, `.RETURN_FOLLOW`

**Features confirmed in UI (extension popup — 19 actions):**
Auto Offer to Likers, Auto Party Share, Auto-Delist, Cross-list, Delist, Enhance-Listing, Follow, Follow Fresh Closets, Follow Just Joined, Import, Offer to Likers, Organize Closet, Re-list, Return Follow, Return Share, Share to Followers, Share to Party, Unfollow + Login to PrimeLister Account

**Features confirmed in web dashboard:**
- Inventory CRUD with platform status badges
- Cloud cross-listing (server-side, no browser tabs opened per platform) — "Cloud Cross-listing beta" banner
- Automations web page — **12 panels fully documented via 2026-04-19 trial** (was previously gated): Auto Activity, Auto List New Items, Auto Refresh Listings (Smart Activity trio, toggle-only), Closet Share (24-hr time-block + 1–9000/day slider + price filter), Community Share (1–9000/day), Re-list (hourly rate + time-block + max 200/day + age + likes + price filters), Offer to Likers (15-min enforced delay + multi-rule + 6 item filters), Posh Parties Sharer (day 250 + evening 1000 + loop + category), Return Share (daily 1–1000 + 1–10 per event), Return Follow (toggle), Follow New Closets (1–9000/day), Bundle Creation (min likes threshold + comment + multi-rule + 5 filters)
- Tasks monitor: task type, status badge, start time, item count, stop button
- Orders: buyer, item, sale price, shipping, fees, net payout, CSV export
- Analytics: revenue chart, platform breakdown, profit/loss with COGS, fee breakdown

**Marketing vs. reality:** Homepage UNDERSTATES — closet sharing and offers automations exist in code but are not listed on the homepage. No OVERSTATES found.

**Mobile app (T1 verified):**
- iOS App Store: `4.9★ / 2,200 reviews / v1.0.30 / last updated March 17 2026` — app name in Store: "Poshmark Bot: PrimeLister" (Poshmark-only automation)
- Android Play Store: `4.7★ / 493 reviews`

**Pricing (verified):**
- Crossposting: $49.99/mo
- Poshmark Automation: $25/mo (separate)
- eBay Automation: separate add-on
- Effective all-in: ~$75+/mo

**Scheduling:** `setInterval` polling at 1-second intervals when a task queue is active. Zero `chrome.alarms.create` in codebase.

**Public roadmap (VERIFIED 2026-04-19 via `roadmap.primelister.com/roadmap` on FeatureOS):**
- **Planned (2 items):** Depop refresh listings (69 votes), Adding Price and Shipping Information on Crosslist (57 votes)
- **In Progress:** Empty — no active dev work shown publicly
- **Completed (~70+ items, top by vote):** Auto Delist (183v), Create a Listing on PrimeLister Inventory (77v), Mobile Functionality (32v), Relist Feature for eBay (52v), Shopify Integration (54v), Auto Send offer to Likers on Poshmark (16v), Automatic offers for eBay (9v), Grailed & Depop Relister (22v), Bundle Offers (11v), + many more

**Notable strengths:**
- Broadest extension action set of any competitor (19 actions, 15 platform targets)
- Modular billing — buyers can choose crossposting-only without automation
- Follow Fresh Closets, Follow Just Joined, Organize Closet are unique actions not found in other audited extensions
- Cloud cross-listing beta reduces need for browser tab orchestration
- Roadmap "In Progress" column is empty — no publicly-signaled active development; roadmap is a weakness signal

**Notable gaps:**
- Most expensive option when fully loaded ($75+/mo)
- ~~Automation subscription expired — config not fully inspectable~~ **CLOSED 2026-04-19:** All 12 automation panels fully documented via trial access
- PrimeLister leaks user's email to `isharemyscreen.com` via a referral link in the panel JS

---

### 2. Crosslist

**Architecture:** Tier B. Uses `chrome.cookies.getAll` internally (e.g. Vinted token); `chrome.alarms` polls `app.crosslist.com` with `credentials:"include"`. Sales data sent server-side; automation (cross-listing) runs in-extension.

**Extension(s):**
- `knfhdmkccnbhbgpahakkcmoddgikegjl/3.9.13_0`
- Permissions: `cookies`, `alarms`, `tabs`, `storage`
- External: `externally_connectable: ["*://*.crosslist.io/*","*://*.crosslist.com/*"]`

**Features confirmed in code:**
- Cross-list: yes (core function)
- Delist: `async delistListing(e)` → POSTs to Vinted `/items/${e}/delete`
- Relist: **NO** — keyword hits are eBay prelist URL strings only
- Share, Offers: **NO**

**Features confirmed in UI:** Not logged in during dashboard pass; extension-side only.

**Marketing vs. reality:**
- "Delist and relist with one click" — **OVERSTATES**. Relist is not implemented.
- "We do not ask for your marketplace password" + "actions happen directly on your computer" — **MISLEADING**. Cookies are relayed to `app.crosslist.com`; alarm beacons sales data server-side.

**Pricing:** $29.99–$44.99/mo (from website, not verified in-app).

**Scheduling:** `chrome.alarms` named "SalesPolling" for periodic sales detection. No automation scheduling.

**Notable strengths:**
- Broad marketplace support for cross-listing
- Clean single-purpose product positioning

**Public roadmap (CORRECTED 2026-04-19 via `feedback.crosslist.com/en/roadmap`):** 108 under-consideration items. Top voted: Listing Variations/Stock Sync (108 votes), Add OfferUp (102 votes), Add Vestiaire Collective, Add TikTok Shops, Add Instagram Shopping. **Planned (5 items):** eBay offer thresholds, eBay Simple Delivery, More size options, Draft vs ready label, Purchase additional AI credits. **In Progress (3 items):** Auto-Delist (274 votes), Full Mobile Listing — post/import/schedule/bulk delist from phone (121 votes), Sales analytics & reporting (109 votes). Recent Released: edit without relisting, CSV import, delist/relist timestamps, set different prices by marketplace, WooCommerce, bulk price edit. Last changelog entry: Jan 14 2026 (`feedback.crosslist.com/en/changelogs`). Native mobile app: none (In Progress, 121 votes).

**Notable gaps:**
- Relist is missing despite being a headline feature claim
- No sharing, no offers
- MISLEADING credential claim creates trust risk

---

### 3. Crosslist Magic

**Architecture:** Tier B. Routes marketplace requests through `crosslistmagic.com/api/proxy` — server proxies API calls. Extension places an icon on source-platform listing pages; user clicks → data copies to target platform form in new tab. No server-side inventory DB.

**Extension(s):**
- `lkjldebnppchfbcgbeelhpjplklnjfbk/0.0.337_0`
- Permissions: `storage`, `tabs`, `scripting`
- External: `externally_connectable` covers crosslistmagic.com and marketplace domains

**Features confirmed in code:** Cross-list only (via proxy). No share, relist, delist, or offers.

**Features confirmed in UI (web dashboard):**
- Dashboard is an onboarding/instruction page only
- AI Lister (beta): single photo upload → AI generates all listing fields
- Pricing page: $9.99/mo flat, no credit card required, no listing limits
- Tools page: external link to unrelated MacOS photo app (sort.photos)
- No inventory, no analytics, no orders

**Marketing vs. reality:** Claims align with code. No OVERSTATES.

**Pricing (verified):** $9.99/mo flat, 7-day trial.

**Scheduling:** `setInterval` bridge heartbeat only — no automation scheduling.

**Supported platforms:** Amazon, Depop, eBay, Etsy, Facebook Commerce, Facebook Marketplace, Grailed, Instagram, Mercari, Poshmark, Shopify, Vinted (12).

**Notable strengths:**
- Cheapest option in the market at $9.99/mo
- No credit card required for trial
- Simple one-click workflow on listing pages
- Beta AI lister: photo-in, listing-out with no required manual fields

**Notable gaps:**
- No inventory DB, no analytics, no orders
- No automation of any kind (share, relist, offers)
- Extension-only — breaks if platform changes DOM
- AI lister is single-image, beta quality, no bulk mode

---

### 4. SellerAider

**Architecture:** Tier A (unique in the audit). `chrome.cookies.get` reads one session cookie locally for auth verification — consumed in-extension, NOT relayed to `app.selleraider.com`. No `cookies.getAll` relay, no `cookies.set`. No server automation pipeline exists, meaning all automation must run in the extension.

**Extension(s):**
- `hoadkegncldcimofoogeljainpjpblpk/1.0.8.53_0`
- ~~Endpoints: `app.selleraider.com`, `dashboard.selleraider.com`~~ **CORRECTED 2026-04-19:** Production dashboard is `my.selleraider.com`. `dashboard.selleraider.com` is a stale/separate app (blank React root when not logged in). `app.selleraider.com` is the extension popup URL, unreachable in a regular browser tab.
- Primary automation module: `crosslister.bundle.js` (805 KB)

**Features confirmed in code:**
- Cross-list: yes (`crosslister.bundle.js`)
- Delist: `DELIST_EDIT_COMPLETE`, `DELIST_DELETE_COMPLETE`, `DELIST_TRY_DELETE` constants
- Share: **NO** — `share` keyword hits are lodash/core-js code only
- Relist: **NO** — `relist` = eBay prelist URL string, not automation
- Offers: **NO**

**Features confirmed in UI:** Not logged in; `app.selleraider.com` is an extension popup URL that renders blank in a regular browser tab.

**Marketing vs. reality:**
- "Share Your Closet" — **OVERSTATES** (no code, no delegation path)
- "Relist Your Listings" — **OVERSTATES** (no code, no delegation path)
- "Send Offers" — **OVERSTATES** (no code, no delegation path)
- **CORRECTED 2026-04-19:** "Automatic Messages" — **OVERSTATES** (confirmed false). `/dashboard/messages` shows "Coming Soon — Manage your messages on all platforms/marketplaces." No functional controls, no templates, no trigger conditions. Feature is listed as a pricing-page bullet on all Grow tiers but has no working implementation.
- **CORRECTED 2026-04-19:** "Analytics" — **NOT IMPLEMENTED.** `/dashboard/analytics` shows "Coming Soon" placeholder. Dashboard home KPIs (Total Listings Value, Total Earnings This Week) are visible; full analytics section is a stub.
- Four independent false advertising claims for a Tier-A extension (was three)

**Pricing (verified from marketing site):**
| Tier | Price |
|------|-------|
| Grow Standard | $18/mo (automation, 1 platform) |
| Grow Pro | $25/mo (automation, all platforms) |
| Crosslister Standard | $12.99/mo (crosslisting + AI + inventory) |
| Crosslister Pro | $29.99/mo (crosslisting + all automation + photo editing) |
14-day free trial; ~20% off yearly.

**Scheduling:** `setInterval` queue drain only; no scheduled automations.

**Notable strengths:**
- Tier-A architecture means user credentials never leave the browser
- Crosslister Pro ($29.99) is most direct competitor to VaultLister's planned bundle
- ~~"Automatic Messages" feature claimed on pricing page — unique in the market~~ **RETRACTED 2026-04-19** — confirmed Coming Soon placeholder; not a real differentiator
- Photo-to-listing AI claimed (extension-based; not testable from web dashboard)

**Notable gaps:**
- Four headline features (Share, Relist, Offers, Automatic Messages) are not implemented — three in code, one confirmed Coming Soon in authenticated dashboard
- No server-side automation or scheduling possible in Tier-A architecture
- ~~Web dashboard (`dashboard.selleraider.com`) is account management only, not automation~~ **CORRECTED 2026-04-19:** Dashboard is at `my.selleraider.com`. 5 sections: Home (KPIs), Listings (inventory + AI generate), Analytics (Coming Soon), Messages (Coming Soon), Settings. Crosslister and Grow automation are Chrome extension products accessed via quick-action links — not web-app features.

---

### 5. Flyp

**Architecture:** Tier B hybrid. Two separate extensions: (1) Crosslister reads marketplace cookies and uses them as Bearer tokens to `tools.joinflyp.com`; (2) Bot Sharer (1.14 MB background.js) has full action vocabulary but only `storage` permission (no `cookies` permission directly). Web app drives configuration and scheduling; cloud bot executes sharing with CAPTCHA solving. Activity logs confirm cloud execution.

**Extension(s):**
- `kbflhgfmfbghhjafnjbgpiopcdjeajio/1.0.4_0` — "Crosslister by Flyp" (cross-listing + delist)
- `ehicjmkogfjifombjmdinmhpaghfggcd/1.7.6_0` — "Poshmark Bot Sharer by Flyp" (1.14 MB background.js)
  - Permissions: `storage` only (no `cookies`)
  - Action vocabulary: `EXECUTE:SHARE_LISTING`, `EXECUTE:RELIST_ITEM`, `EXECUTE:CREATE_OFFER`, `EXECUTE:ADD_FOLLOWER`, `EXECUTE:REMOVE_FOLLOWER`, `EXECUTE:GET_USER_FOLLOWERS`, `EXECUTE:GET_NEWLY_JOINED_FOLLOWERS`, `EXECUTE:GET_NEWLY_OPENED_FOLLOWERS`, `EXECUTE:GET_SHARES_FROM_NEWS`, `EXECUTE:GET_ACTIVE_PARTIES`, `EXECUTE:GET_SHIPPING_DISCOUNTS`, `EXECUTE:SOLVE_CAPTCHA`, `START:AUTO_OFFERS`, `STOP:AUTO_OFFERS`, `START:SHARE_CLOSET`, `STOP:SHARE_CLOSET`
  - 108 CAPTCHA references — built-in CAPTCHA solving integration

**Features confirmed in code (Crosslister extension):**
- Relist: `EXECUTE:RELIST_ITEM_POSHMARK`
- Delist: `EXECUTE:DELIST_ITEM_POSHMARK`, `RETURN:DELIST_LISTING_POSHMARK`, `RETURN:DELIST_LISTING_MERCARI`
- Cross-list: core function

**Features confirmed in UI (Flyp web app — most granular in audit):**
- **Sharer / Share sub-tab:** Sharing mode (Scheduled/Continuous/Just once), # schedules, HDT time picker, All closet or Portion, Daily limit (6000), Order (Randomize/Keep/Switch), Speed (Fast/Slow), Share to party toggle, Activity logs (Shares Today + Captcha Solved Today)
- **Auto-Offers sub-tab:** Trigger interval (every N minutes), Discount %, Shipping discount tiers, Min price/earnings filter, Recency exclusion (last N days listed), Start/Stop toggle
- **Bulk Offers sub-tab:** Same fields + "also send to no-like items" option — runs once instantly
- **Follow sub-tab:** Follow N closets from (my followers / another closet / random), Unfollow N from my following
- **Community Share sub-tab:** Return Shares + Follows toggles, shares count per closet, 30-day date range, 4-speed slider (Fast/Medium/Slow/Sloth)
- **Orders:** 40 orders, 5-platform filter, status tabs (Pending/Shipped/Complete/Cancelled), track/view buttons
- **Offers page:** Per-platform rows (Poshmark/Mercari/eBay/Depop), live "X items with new likers" count, per-row Send offers button
- **Crosslister (/my-items):** 57 items, bulk Delist / Relist / Edit dropdown, platform-specific listing overrides per item
- **Analytics:** Revenue/Profit line chart (daily), Marketplace Revenue donut, Marketplace Profit donut, Sold Items by Marketplace bar, Avg Sale Price by Marketplace bar; COGS-aware profit

**Marketing vs. reality:** Share, Offers, and Scheduling are DELEGATED (Tier-B backend). Relist and Delist confirmed in code. Claims are architecturally consistent.

**Pricing:** 99-day free trial shown; post-trial pricing not surfaced in-app (requires public pricing page navigation).

**Scheduling:** Cloud-based scheduled sharing (no `chrome.alarms` in extension — server drives timing). CAPTCHA solving built-in (108 references).

**Notable strengths:**
- Most detailed, granular automation UI in the market
- Unified multi-platform Offers view with live liker counts
- Built-in CAPTCHA solving (unique)
- Dual-extension architecture separates cross-listing from bot automation cleanly
- Community Share "return activity" targeting is a unique feature

**Mobile app (T1 verified 2026-04-19):**
- ~~iOS App Store: active~~ **CORRECTED 2026-04-19:** iOS App Store URL returns 404 — **app is DELISTED**
- ~~Android Play Store: active~~ **CORRECTED 2026-04-19:** `com.flyp.android` also 404 — **app abandoned on both platforms**
- Flyp abandoned mobile entirely in mid-2024; pivoted to web-first at `tools.joinflyp.com`

**Notable gaps:**
- No AI listing generation
- Pricing not surfaced in-app during trial
- Poshmark-focused; eBay/Mercari automation less complete

---

### 6. Nifty

**Architecture:** Tier B bridge. Extension is a cookie-access relay only (1737-byte `background.js`). On `autoposher/get-all-cookies-request`, reads `chrome.cookies.getAll` for marketplace URLs and returns cookies to the requesting nifty.ai web app page via `onConnectExternal`. All automation logic, scheduling, and configuration lives in the web app.

**Extension(s):**
- `ggcfdkgmekpddencdddinlmpekbcohoa/3.1.1_0`
- Permissions: `cookies`, `storage`
- External: `externally_connectable: ["*://*.poshmark.com/","*://*.nifty.ai/*"]`
- No outbound fetch calls in extension; web app is the automation engine

**Features confirmed in code:** Extension is bridge only — no automation logic in extension.

**Features confirmed in UI (Nifty web app):**
- **Automation page:** Platform cards — Poshmark (Shares & relists, Offers, Follows), eBay (Offers, Recreates), Mercari (Offers, Relists), Depop (Offers, Relists — connection expired)
- **Ask Otto (/otto):** Chat interface, beta; pre-written prompt suggestions: "Generate pick list," "Suggest improvements for oldest unsold items," "What's been selling best?," "Is auto-delisting set up?," "How do I update billing?" Credit meter: "Free tier · 0%" — **VERIFIED 2026-04-19:** Otto requires `isOttoBetaUser: true` role flag. Prompts send successfully but no AI response is generated without beta enrollment. Beta access is role-gated (not plan-gated) — Bundle Pro trial alone is insufficient.
- **`/orders`:** **VERIFIED 2026-04-19:** Route returns 404. Orders data lives inside `/analytics` as a sub-tab ("Orders" showing title, SKU, days listed, sale price, fees, costs). No standalone orders page exists.
- **Analytics sub-tabs:** Orders (title, SKU, days listed, sale price, fees, costs), Expenses, Insights (loads fully at `/analytics` with real data — **prior "BROKEN" finding retracted**: `/analytics/insights` is not a sub-route, Insights IS `/analytics`), Reports (P&L)
- **Smart Credits:** 50/month on Bundle Pro; "Buy more" gated to Otto beta users
- **Cross-list:** Platform checkboxes, field-mapping preview, Publish or schedule
- **AI Bulk Generate:** Photo → AI listing, 50 Smart credits on trial plan
- **Connected platforms:** Mercari, Etsy, eBay, Poshmark (Depop expired)

**Marketing vs. reality:** All automation claims are DELEGATED (web-app-driven). Architecturally consistent. No OVERSTATES.

**Pricing (verified):** Bundle Pro $88.99/mo; 7-day trial. Highest flat price in the market.

**Scheduling:** Web app manages all scheduling — extension has no scheduling logic.

**Notable strengths:**
- Fully web-app-driven automation (works without browser open)
- Otto AI chat assistant with reseller-specific prompt suggestions
- Smart Credits metering + "Buy more" upsell model
- AI Bulk Generate for listings (most developed AI feature found)
- Automation config in modal flows from a single `/automation` page

**Notable gaps:**
- ~~Analytics Insights tab is BROKEN in production~~ **Retracted 2026-04-19** — `/analytics/insights` was never a real sub-route. Insights IS `/analytics` and works fine.
- Automation config locked behind trial activation — could not inspect full config
- $88.99/mo is the highest price point in the market
- Otto credit purchase modal gated to beta users only

---

### 7. OneShop

**Architecture:** Tier B. Extension uses `chrome.cookies.getAll({domain:"oneshop.com"})` to read session tokens and attaches them as headers to GraphQL mutations at `gql-api.oneshop.com/graphql`. Extension handles authentication and institution linking only; all automation runs server-side.

**Extension(s):**
- `pcapaniacmdmabfopeeimmpjkkjpeiok/2_0`
- Key mutation: `invsysStartInstitutionLink(institution, reauthStrategy: BROWSER_EXTENSION)`
- GraphQL: `gql-api.oneshop.com/graphql`, `metadata.app.oneshop.com`
- Scheduling: `setInterval` ~2s for metadata/config refresh only

**Features confirmed in code:** Auth and institution linking only. No automation actions in extension.

**Features confirmed in UI:** Session not active during verification; could not log in.

**Marketing vs. reality:** "Automatically share, relist, bump, and delist" — DELEGATED. Architecture is consistent with these claims running server-side.

**Pricing:** ~~Not verified in-dashboard.~~ **CORRECTED 2026-04-19 (currency):** OneShop has a **single tier: $45/month USD** (verified live from `tools.oneshop.com/pricing`). ~~"Growing" plan is $67.99/mo~~ — this was a CAD conversion error. OneShop prices in USD only; $67.99 CAD ≈ $45 USD at current rates. No annual plan, no free tier, 7-day trial via "Try monthly."

**Company status:** NOT shutdown. ~~YC "Inactive" status implied pivot or shutdown.~~ **CORRECTED 2026-04-19:** YC "Inactive" = not in YC program, not shut down. Active-maintenance mode. Hit **$1M ARR in 2024** (T2: Latka self-report; 6-person team, bootstrapped). YC batch: **S21**. Founders: Albert Chuang (now Head of Strategy at Giga), Aaron Evans (CTO). Blog last post Jan 2022; zero hiring; minimal founder involvement.

**Connection method (VERIFIED 2026-04-19):** No OAuth flows. Chrome extension bridges marketplace sessions — user logs into marketplace sites in browser with OneShop extension installed; extension links the session to the OneShop account. Onboarding at `/u/institution-accounts` shows Mercari as the first linkable platform.

**6 bot types confirmed (VERIFIED 2026-04-19 from Next.js build manifest):** `account-shares`, `follows`, `offer-to-likers`, `otl-listings`, `relisting`, `share-order`. All at `/u/bots/[institution]/[bot-type]` — all paywalled behind Premium.

**`share-order` unique feature:** Share sequencing bot — controls the priority/rotation order in which listings are shared (e.g., most liked first, newest first, least recently shared first). No other competitor exposes share rotation order as a configurable bot parameter. Full controls undocumented until Premium activated.

**Mobile app (T1 verified 2026-04-19):**
- iOS App Store: `3.4★ / 461 ratings / v1.0.856 / last updated Oct 29 2025`
- Android: active (both platforms confirmed)

**Scheduling:** Server-side (web app). Extension has no scheduling.

**Notable strengths:**
- GraphQL architecture suggests well-structured server-side automation
- Image alt text `"bots-status"` and `"bots"` confirms a Bots UI section in the dashboard
- Marketing confirms auto-delist, auto-relist, sharing, bumping
- $1M ARR with 6-person team — lean, profitable, not dead
- `share-order` bot is unique — no competitor exposes share rotation sequencing as configurable

**Notable gaps:**
- ~~Dashboard not accessible during this research session (login required)~~ **PARTIALLY CLOSED 2026-04-19** — free tier accessed; bot configs all paywalled behind Premium (not activated)
- ~~Extension is auth-only — entire product is a black box from audit perspective~~ **PARTIALLY CLOSED 2026-04-19** — 6 bot route names confirmed from build manifest; configs still unknown
- Minimal founder involvement; blog frozen since Jan 2022; no hiring

---

### 8. Closo

**Architecture:** Tier B. Authenticates with `app.closo.co` via `X-Closo-Token`. Tasks dispatched server-side via WebSocket (`wss://app.closo.co/ws/`), with REST fallback. Content scripts target Poshmark; no evidence of other platform scripts.

**Extension(s):**
- `aipjhdapgmimfdfcjmlpeoopbdldcfke/3.1.42_0`
- Permissions: `cookies`, `storage`, `alarms`, `tabs`
- External: `externally_connectable: ["https://app.closo.co/*"]`
- Multiple named alarms: `SOLD_CHECK_ALARM` (15 min), `REST_POLL_ALARM` (60s), `CONFIG_REFRESH_ALARM`, `OUTBOX_DRAIN_ALARM` (30s), `KEEPALIVE_ALARM`

**Features confirmed in code:**
- Share: clicks `button[data-et-on-name="listing_flow_share"]`
- Relist: `taskOp === 'relist'` in `poshmark_script.js`
- Delist: `async function delist()` in `poshmark_script.js`
- Offers: `'offersToLikers'` in action dispatcher
- Cross-list: **NO evidence found**

**Features confirmed in UI (web dashboard):** ~~App is non-functional. All URLs beyond `/` return 404. Only two anchor hash links in DOM. "Task Manager" sidebar shows "No active tasks." Framework appears to be Yii PHP / AdminLTE. App appears abandoned or mid-rebuild.~~ ~~**CORRECTED 2026-04-19:** App is REVIVED. AI agent suite launched 2025. Blog published new posts Feb 2026. Free unlimited crosslisting tier confirmed.~~ **RE-RETRACTED 2026-04-19 (same-day):** Second live check confirms app is still a skeleton. `app.closo.co` renders only a title page ("Home / Login / Exit") with no product content. `closo.co/blog`, `/ai-agents`, `/pricing`, `app.closo.co/dashboard` all return 404. Website nav lists many features but all page links resolve to 404. The "revival" is cosmetic-only — marketing copy exists but no functional UI is accessible.

**Marketing vs. reality:**
- Share/Relist/Delist/Offers all MATCH code
- "Lists your products on multiple marketplaces" — ~~**OVERSTATES** (no cross-platform code found)~~ ~~**UPDATED 2026-04-19:** Crosslisting Agent now launched — claim no longer verifiably false~~ **RE-RETRACTED 2026-04-19:** All agent pages return 404; crosslisting claim remains unverifiable
- ~~"Zero Fees" free tier claim — now consistent with confirmed free unlimited crosslisting tier~~ **RE-RETRACTED 2026-04-19:** No pricing page accessible; free tier cannot be confirmed
- ~~"App appears abandoned"~~ ~~**RETRACTED 2026-04-19** — AI pivot confirmed active~~ **RE-RETRACTED 2026-04-19:** App IS still a skeleton; prior retraction was premature

**Pricing:** ~~Not determinable.~~ ~~**UPDATED 2026-04-19:** Free unlimited crosslisting tier confirmed.~~ **RE-RETRACTED 2026-04-19:** `/pricing` returns 404; pricing still unknown.

**Scheduling:** `chrome.alarms` (most sophisticated alarm setup in the audit — 5 named alarms with different intervals).

**Notable strengths:**
- Well-instrumented Poshmark automation (all 4 core actions confirmed)
- WebSocket + REST failover architecture
- Most granular alarm scheduling design
- ~~**Revived 2025:** AI agent suite (Sourcing, Crosslisting, Promotion) — first competitor to ship agentic sourcing~~ **RE-RETRACTED 2026-04-19:** Agent pages all 404; no working UI accessible
- ~~Free unlimited crosslisting tier as growth lever~~ **RE-RETRACTED 2026-04-19:** Pricing page 404; unconfirmable

**Notable gaps:**
- ~~App is effectively dead~~ ~~**RETRACTED 2026-04-19** — REVIVED with AI pivot~~ **RE-RETRACTED 2026-04-19:** App IS still a skeleton; dashboard and all feature pages return 404
- No cross-listing code found in original audit; Crosslisting Agent page returns 404 — remains unverifiable
- No AI features confirmed (Agent pages inaccessible)
- Pricing unknown (pricing page 404)

---

### 9. Vendoo

**Architecture:** Tier B. Extension writes cookies to marketplace domains via `chrome.cookies.set` using tokens sourced from `api.web.vendoo.co` (session injection). `VendooQueuePulling` alarm fires every 5+ minutes, pulls command sequences from `api.web.vendoo.co`, and dispatches `EXEC_PAGE_SCRIPT` via `chrome.tabs.sendMessage` to marketplace tabs. 16 `modifyHeaders` rules in `corsRules.json` spoof `Origin`/`Referer` for Depop, Facebook, and other platforms. The web app is UI/orchestrator only.

**Extension(s):**
- `mnampbajndaipakjhcbbaihllmghlcdf/3.1.10_0`
- Permissions: `cookies`, `declarativeNetRequest`, `storage`, `tabs`, `alarms`
- External: `externally_connectable` covers `web.vendoo.co`, `internal-beta.vendoo.co`, `enterprise.vendoo.co`
- Action dispatch table `TN`: `click`, `fireEvent`, `getFromStorage`, `hover`, `setInput`, `renderModal`, `removeModal`, `uploadImages`, `wait`, `waitForElement`, `sendRequest`, `mercariList`
- `corsRules.json`: 16 rules spoofing headers for Depop, Facebook, and others
- DataDog RUM: `cdn.vendoo.co/ddpv2rum`

**Features confirmed in code:**
- Relist: queue operation confirmed
- Delist: 22 handler hits; `unhandledDelistingError`, `deniedDelist`, `itemHasOffers` → skip
- Offers: `"doesn't have enough likes to receive offers"` (offers-to-likers confirmed)
- Cross-list: core function; 16-platform `corsRules.json`
- Share: originally flagged as absent in code — **CORRECTED by dashboard verification** (see below)

**Features confirmed in UI (Vendoo web dashboard):**
- **Inventory:** Full CRUD, draft→listed, per-item Edit/Crosslist/Delist/Archive/Delete, filter by platform/status/date, CSV import
- **New Item Form:** Title, category, brand, description, condition, price, cost, SKU, quantity, tags, shipping weight/size; drag-drop multi-photo; AI background removal toggle; Save draft or Publish
- **Import:** From Poshmark, eBay, Mercari, Depop, Etsy, Facebook, Kidizen, TheRealReal, Vinted, Grailed + CSV
- ~~**Pro Tools / Delist & Relist:** Two-step workflow (select items → select destination platforms); immediate execution only (no scheduling)~~ **REMOVED 2026-04-19** — this sub-tab no longer exists in Pro Tools
- ~~**Pro Tools / Bulk Edit:** Inline-editable table (title, price, SKU, quantity, description); multi-select + Apply to selected~~ **REMOVED 2026-04-19** — this sub-tab no longer exists in Pro Tools
- ~~**Pro Tools / Price Adjuster:** Percentage increase/decrease rule; no absolute-price rules, no per-platform override, no scheduling~~ **REMOVED 2026-04-19** — this sub-tab no longer exists in Pro Tools
- **Pro Tools (CORRECTED 2026-04-19 — 3-card layout):** `/app/pro-tools` now shows 3 cards: (1) **Send Offers** — bulk offers to likers across multiple marketplaces; (2) **Auto Offers** — custom rules for automatic offers to new likers/watchers; (3) **Marketplace Sharing** — Poshmark sharing, Depop refreshing, Grailed bumping. "More Pro Tools Coming Soon..." placeholder card also shown.
- **Send Offers (`/app/offers`):** Marketplaces: eBay, Poshmark, Mercari, Depop, Grailed, Vestiaire Collective. Per-platform Offer % + "Offer price based on" selector.
- **Auto Offers (`/app/auto-offers` or `/v2/automations/auto-offers`):** Per-platform rows (eBay, Poshmark, Mercari, Depop, Grailed, Vestiaire Collective — 6 platforms). Per-platform config: Active toggle, Offer price based on, Price Rules (if price between $X–$Y → Offer % off, add new rule), Exclusions (NWT, items listed in last N hours, Category, Brand, Label, specific items). Actions: Save, Save + Copy to.
- **Marketplace Sharing (`/v2/automations/sharing`):** Tabs: Depop / Poshmark / Grailed. Per-platform: Amount of items (max 6000/day), order, speed, schedule, act-now button. Grailed note: items can only be bumped once every 7 days; after 30 days must be discounted ≥10% to bump again.
- **Analytics:** Revenue, Profit, Cost, Items Sold, New Listings KPI cards; Revenue over time (line), Platform breakdown (donut), Category breakdown; CSV export
- **v2 automations — CORRECTED 2026-04-19 (Pro vs Business split):** `mapping-rules`, `pricing-rules`, `marketplace-defaults`, `shopify` are **Business-tier-only** (not just "current account tier"). These 4 routes redirect to `/login` on Pro. When clicked from within a v2 session they resolve to `enterprise.vendoo.co/v2/automations/...` which returns a Firebase 404 (broken Business-tier subdomain). Sharing + auto-offers + send-offers are accessible on Pro.

**Marketing vs. reality:**
- "Marketplace Sharing: Poshmark, Depop & Grailed" — **WAS FLAGGED as OVERSTATES in code audit; CORRECTED to MATCH** — feature is real and functional; Vendoo calls it "Marketplace Refresh" not "Share"
- Scheduling: "5-minute queue alarm" not mentioned on website — UNDERSTATES
- Credential handling (`cookies.set` session injection): no claim — no evaluation

**Mobile app (T1 verified 2026-04-19):**
- iOS App Store: `4.5★ / 2,500 reviews / v3.2.0 / last updated ~Apr 16 2026` — most mature mobile app in the market
- Android Play Store: `10K+ downloads / updated April 14 2026 / co.vendoo.mobile`
- **Vendoo Go** (separate app, id6746722923): AI quick-listing iOS app, v1.0.1 ~Apr 15 2026

**Pricing (verified):**
- Lite: ~$14.99/mo
- Pro: **$59.99/mo** (verified 2026-04-19 via active trial, not ~$29 as initially estimated)
- ~~Business: not publicly priced~~ **CORRECTED 2026-04-19:** Enterprise (high-volume) at `vendoo.co/enterprise/high-volume` — **$399/mo Standard** + custom one-time imports $499–$1,299 (up to 5K–20K items) + White Glove Listing Service
- Enterprise: separate deployment at `enterprise.vendoo.co` (Firebase app)

**Scheduling:** `chrome.alarms` named `VendooQueuePulling`, minimum 5-minute interval. Most sophisticated server-dispatch scheduling in the audit.

**Notable strengths:**
- Only competitor with server-dispatched automation (web app works without browser open)
- Broadest import source list (10 platforms + CSV)
- AI background removal on item creation (server-side)
- ~~Full Pro Tools suite (Delist & Relist, Bulk Edit, Price Adjuster)~~ **CORRECTED 2026-04-19:** Pro Tools restructured — now Send Offers + Auto Offers + Marketplace Sharing (3-card layout); old Delist/Relist/BulkEdit/PriceAdjuster sub-tabs removed
- Auto Offers supports 6 platforms with per-platform price rules, exclusions, and "Save + Copy to" for reuse
- Business-tier v2 automation suite (mapping rules, pricing rules, marketplace defaults, Shopify) exists but is inaccessible on Pro and broken on enterprise subdomain
- DataDog RUM suggests production monitoring investment

**Notable gaps:**
- Vendoo calls sharing "Marketplace Refresh" — non-standard naming creates user confusion
- ~~Price Adjuster is percentage-only (no absolute price, no per-platform override)~~ **CORRECTED 2026-04-19:** Price Adjuster sub-tab removed from Pro Tools entirely
- v2 Business-tier automation routes (mapping rules, pricing rules, marketplace defaults, Shopify sync) redirect to `/login` on Pro; enterprise subdomain returns Firebase 404
- ~~Pro Delist & Relist has no scheduling (immediate only)~~ **CORRECTED 2026-04-19:** Delist & Relist sub-tab removed from Pro Tools entirely

---

## Cross-Cutting Insights

### Credential Tiers

**Tier A (local only — cookies never leave the browser):**
- SellerAider

**Tier B (cookie relay — extension reads cookies and sends to vendor server):**
- PrimeLister (bidirectional relay via `api.primelister.com/cookies`)
- Crosslist (relay to `app.crosslist.com` with `credentials:include`)
- Crosslist Magic (proxied via `crosslistmagic.com/api/proxy`)
- Flyp Crosslister (Depop `access_token` used as Bearer to `tools.joinflyp.com`)
- Nifty (cookies returned to web app page via `onConnectExternal` bridge)
- OneShop (session tokens as headers to `gql-api.oneshop.com`)
- Closo (`X-Closo-Token` auth to `app.closo.co`)
- Vendoo (`cookies.set` writes marketplace session cookies; server-injected sessions)

### Architecture Patterns

**Extension-driven (automation logic in extension; web app is account management):**
- PrimeLister (popup is automation UI; web app is cross-listing inventory only)
- Closo (Poshmark scripts in extension; web app dead)
- SellerAider (Tier A; extension is entire product for automation)

**Web-app-driven (extension is auth/bridge; server executes automation):**
- Nifty (extension = 1737-byte cookie bridge)
- OneShop (extension = GraphQL session linker)
- Vendoo (extension = `VendooQueuePulling` command receiver + `cookies.set` injector)

**Hybrid (web app configures + schedules; extension executes in browser):**
- Flyp (web app for config; Bot Sharer extension executes in browser; cloud CAPTCHA)
- Crosslist (alarm polls server; cross-listing runs in extension)
- Crosslist Magic (server proxy + extension DOM injector)

### Feature Matrix

| Feature | PrimeLister | Crosslist | C. Magic | SellerAider | Flyp | Nifty | OneShop | Closo | Vendoo |
|---------|:-----------:|:---------:|:--------:|:-----------:|:----:|:-----:|:-------:|:-----:|:------:|
| Cross-list | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Closet Share | ✅ | ❌ | ❌ | ❌* | ~ | ✅ | ~ | ✅ | ✅ |
| Relist | ✅ | ❌* | ❌ | ❌* | ✅ | ✅ | ~ | ✅ | ✅ |
| Delist | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ~ | ✅ | ✅ |
| Offers to Likers | ✅ | ❌ | ❌ | ❌* | ✅ | ✅ | ❌ | ✅ | ✅ |
| Follow/Unfollow | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Community Share | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| AI Listing Gen | ❌ | ❌ | ~(beta) | ~(claimed) | ❌ | ✅ | ❌ | ❌ | ~(bg remove) |
| Analytics | ✅ | ❌ | ❌ | ❌* | ✅ | ✅ | ❌ | ❌ | ✅ |
| CAPTCHA Solving | ❌ | ❌ | ❌ | ❌ | ✅ | ~ | ❌ | ❌ | ❌ |
| Auto Messaging | ❌ | ❌ | ❌ | ❌* | ❌ | ❌ | ❌ | ❌ | ❌ |

✅ = confirmed in code or UI | ❌ = not found | ~ = partial/claimed/uncertain | * = claimed but NOT implemented
Notes (CORRECTED 2026-04-19): SellerAider Analytics = Coming Soon placeholder (`/dashboard/analytics`); SellerAider Auto Messaging = Coming Soon placeholder (`/dashboard/messages`) — both confirmed false in authenticated dashboard. Nifty Analytics = `/analytics` fully functional (was incorrectly marked `~(broken)` — retracted 2026-04-19).

### Pricing Landscape (low to high monthly)

| Competitor | Entry Price | Model |
|------------|------------|-------|
| Crosslist Magic | $9.99/mo | Flat, extension-only |
| SellerAider Crosslister Standard | $12.99/mo | Crosslisting only |
| Vendoo Lite | ~$14.99/mo | Tiered |
| SellerAider Grow Standard | $18/mo | Automation, 1 platform |
| SellerAider Grow Pro | $25/mo | Automation, all platforms |
| Flyp | ~$9/mo (claimed) | Flat (not verified in-app) |
| Vendoo Pro | **$59.99/mo** (verified 2026-04-19) | Mid-tier |
| SellerAider Crosslister Pro | $29.99/mo | Cross-list + all automation |
| Crosslist | $29.99–$44.99/mo | Tiered |
| Vendoo Enterprise (high-volume) | ~~Not publicly priced~~ **CORRECTED 2026-04-19: $399/mo Standard** + custom imports $499–$1,299 | `vendoo.co/enterprise/high-volume`; White Glove Listing Service add-on |
| PrimeLister all-in | $75+/mo | Modular add-ons |
| Nifty Bundle Pro | $88.99/mo | Flat bundle, highest price |

### Discovered Vulnerabilities and Weaknesses

- ~~**Nifty Analytics Insights tab** — broken in production (Next.js hydration exception); charts and KPIs inaccessible live as of 2026-04-18~~ **RETRACTED 2026-04-19** — `/analytics/insights` was never a sub-route. The Insights view IS `/analytics`, which loads fully with real data on Bundle Pro accounts.
- **Crosslist "delist and relist"** — headline marketing claim; relist function does not exist in code (OVERSTATE)
- **SellerAider "Share/Relist/Offers"** — three homepage claims; none implemented; Tier-A extension means no server delegation path possible
- ~~**Closo** — app appears abandoned; all dashboard URLs return 404; Poshmark automation code exists but is unreachable~~ ~~**RETRACTED 2026-04-19** — Closo REVIVED with AI agent suite in 2025~~ **RE-INSTATED 2026-04-19:** Second live check confirms app is still a skeleton. Blog, AI agents, pricing, dashboard all return 404. Original finding stands — Closo remains effectively non-functional as a product.
- **Vendoo "Marketplace Sharing" naming** — called "Marketplace Refresh" in the dashboard; "Sharing" only in the pricing table; creates confusion
- **PrimeLister email leak** — panel JS contains a referral href that appends the user's email to `isharemyscreen.com` URL when clicked
- **Crosslist MISLEADING credential claim** — "actions happen directly on your computer" is false; cookies relayed to server via `credentials:include`

### Mobile App Landscape (T1 verified 2026-04-19)

| Competitor | iOS | Android | Notes |
|-----------|-----|---------|-------|
| Vendoo | ✅ 4.5★ / 2.5K reviews + Vendoo Go AI app | ✅ 10K+ downloads | Most mature; two separate iOS apps |
| OneShop | ✅ 3.4★ / 461 ratings | ✅ Active | Both platforms Oct 2025 |
| PrimeLister | ✅ 4.9★ / 2.2K reviews (Poshmark-only bot) | ✅ 4.7★ / 493 reviews | Bot app, not full cross-listing |
| Crosslist | ❌ | ❌ | Native mobile on roadmap (In Progress) |
| Flyp | **❌ DELISTED** | **❌ 404** | Abandoned mobile entirely mid-2024 |
| Nifty | PWA only | PWA only | No native apps confirmed |
| Crosslist Magic | ❌ | ❌ | Desktop extension only |
| SellerAider | ❌ | ❌ | Desktop extension only |
| Closo | ❌ | ❌ | Web app + Chrome extension only |

**Key finding:** Vendoo is the only competitor with a mature, actively-maintained native mobile app (4.5★, updated weekly). The mobile gap is a real opportunity — only 3 of 9 competitors have any native mobile presence.

---

### Best UX Patterns Observed

- **Flyp unified Offers-to-Likers view** — single page showing all 4 platforms simultaneously with live "X items with new likers" counts and per-row Send button; superior to Vendoo's single-platform panel
- **Flyp sharing mode granularity** — Scheduled / Continuous / Just once modes with 3-mode sharing order (Randomize/Keep/Switch), HDT time picker, 4-speed slider on Community Share
- **Vendoo Auto Offers Manager** — per-platform table (Poshmark/eBay/Mercari) with Enable toggle, Offer %, shipping discount, max price threshold, and schedule in one row
- **Nifty Smart Credits AI budget visibility** — credits meter on every AI action, "50 remaining of 50," renews date shown; consumable AI budget model creates predictability
- **PrimeLister modular subscription** — crossposting and per-platform automation sold separately; buyers control spend; reduces entry price
- **Flyp Community Share "return activity" targeting** — configure how many shares to return per closet, over what date range, at what speed; no other competitor has this granularity
- **Nifty Otto prompt suggestions** — pre-written reseller-specific prompts ("Generate pick list for today's sales," "Suggest improvements for oldest unsold items") reduce AI adoption friction

---

## Where VaultLister Can Win

1. **Unified multi-platform automation dashboard** — only Flyp exposes granular automation controls publicly. Nifty locks config behind trial activation. Build VaultLister's automation page with Flyp-level control depth (sharing modes, speed, daily limits, return-share targeting) and make it visible before purchase. No competitor does this.

2. **Deeper analytics than any competitor** — Nifty's `/analytics` works and shows 289 listings / 2 sold / 0.7% sell-through / $28 revenue. Vendoo's analytics are solid but lack per-item profitability. Flyp has COGS-aware profit. **None** surface per-platform fee breakdowns + profit-per-SKU + slow-mover detection in one view. VaultLister can ship a unified analytics dashboard that beats all three.

3. **Automatic buyer messaging** — **VERIFIED 2026-04-19: zero competitors deliver this in a live dashboard.** SellerAider's `/dashboard/messages` is a "Coming Soon" stub with no controls. Every other competitor audited has no messaging feature at all. This is a confirmed gap across all 9 competitors. VaultLister can be first to ship verified automated follow-up messages to buyers and claimers. Platform-safe approach required (Poshmark/Mercari message APIs).

4. **Honest credential disclosure** — the market has one MISLEADING claim (Crosslist) and one factual data leak (PrimeLister). VaultLister can differentiate on trust: clear language about what data the extension reads, what goes server-side, and why. A one-pager in the extension popup explaining the data flow is novel and builds trust.

5. **AI listing generation without a credit paywall** — Nifty's AI is the best but costs $88.99/mo with 50 credits. Crosslist Magic's AI is free-form beta. VaultLister can bundle photo-to-listing AI at a mid-market price point ($19–$29/mo) with a credit allowance that is visible and purchasable — matching Nifty's UI model at half the price.

6. **Vendoo's v2 automation tier is inaccessible** — mapping rules, pricing rules, marketplace defaults, and Shopify sync are all paywalled. VaultLister should inspect this tier (upgrade a test account) before launch to avoid shipping a known gap at the enterprise level.

7. **Platform-specific listing overrides on the base item** — Flyp surfaces this in its item edit view; no other competitor confirmed this pattern. Allowing per-platform field overrides (different title, price, category per marketplace) on a single inventory item reduces duplicate work and is a real power-user feature.

---

## Open Intelligence Gaps

| Gap | Reason Unresolved |
|-----|------------------|
| Vendoo `/v2/automations/` Business-tier (mapping-rules, pricing-rules, marketplace-defaults, shopify) | **PARTIALLY CLOSED 2026-04-19** — confirmed Business-tier-only (not Pro). All 4 routes redirect to `/login` on Pro; from within an active v2 session they resolve to `enterprise.vendoo.co/...` which returns a Firebase 404. Business-tier routes are broken on enterprise subdomain. |
| ~~Nifty automation config detail~~ | **FULLY CLOSED 2026-04-19** — all 9 automation panels across 4 platforms documented. Full walkthrough in `COMPETITOR_NIFTY_POSHMARK_DEPOP_2026-04-19.md`. **Still gated:** Otto beta (`isOttoBetaUser: true` role-gated, not plan-gated); Whatnot automation (`isWhatnotBetaUser: false`). Facebook/Grailed automation absent from Nifty UI entirely. |
| ~~PrimeLister automation config~~ | **CLOSED 2026-04-19** via Poshmark Automation Trial. All 12 panels documented. eBay/Mercari/Depop automation still require separate per-platform sub. |
| ~~OneShop dashboard (bot configs, Premium pricing)~~ | **PARTIALLY CLOSED 2026-04-19** — free tier accessed; 6 bot route names confirmed from Next.js build manifest; all paywalled behind Premium (not activated). Pricing: single tier $45 USD/month confirmed from `tools.oneshop.com/pricing`. |
| ~~SellerAider dashboard and extension popup~~ | **CLOSED 2026-04-19** — authenticated at `my.selleraider.com` (not `dashboard.selleraider.com`). 5 sections mapped. Messages = Coming Soon. Analytics = Coming Soon. |
| Flyp post-trial pricing | `/settings/billing` redirects to `/my-items`; pricing page not navigated |
| Flyp Bot Sharer extension popup | Extension not installed in `Profile 3/Extensions/` at time of gap-closure pass |
| Closo post-rebuild state | ~~**CLOSED 2026-04-19** — App REVIVED~~ **RE-OPENED 2026-04-19 (same-day):** Second live check: `app.closo.co` is a near-empty shell. Blog, AI agents, pricing, dashboard all return 404. Revival is cosmetic-only; no functional UI accessible. |
| ~~SellerAider "Automatic Messages" feature~~ | **CLOSED 2026-04-19** — Confirmed false. `/dashboard/messages` = "Coming Soon" placeholder in authenticated dashboard. Feature is listed on pricing tiers as marketing copy but has no working implementation. |
| Nifty Smart Credits purchase modal | Requires `isOttoBetaUser: true` — not triggered on trial account. **VERIFIED 2026-04-19:** Otto beta is role-gated; Bundle II trial alone insufficient. |
| ~~PrimeLister public roadmap~~ | **CLOSED 2026-04-19** — 2 Planned, 0 In Progress, ~70 Completed items. See profile above. |
| ~~Crosslist public roadmap~~ | **CLOSED 2026-04-19** — 3 In Progress (auto-delist 274v, mobile 121v, analytics 109v), 5 Planned, 108 Under Consideration. |
| ~~Vendoo Go mobile app~~ | **CLOSED 2026-04-19** — v1.0.1, AI photo-to-listing, eBay + Mercari only, free. Pure quick-list mobile, not a full Vendoo companion app. |
| ~~Flyp Sharer sub-tabs~~ | **CLOSED 2026-04-19 (partial)** — 5 Poshmark-only sub-tabs confirmed: Share, Auto-Offers, Bulk Offers, Follow, Community Share. Platform-specific field override detail geo-blocked. |
| OneShop bot configs (all 6 controls) | All 6 bot routes paywalled behind Premium (not activated). Route names known; UI controls undocumented. |

---

## Appendix: Source Reports

Reports dated 2026-04-18 through 2026-04-19, stored in `docs/`:

1. `COMPETITOR_EXTENSION_AUDIT_2026-04-18.md` — Chrome extension code audit; 9 extensions classified by credential tier, action vocabulary, scheduling mechanism, and endpoint contacts
2. `COMPETITOR_WEBSITE_VS_CODE_2026-04-18.md` — Marketing claims vs. extension code reality; MATCH/OVERSTATES/MISLEADING/DELEGATED labels for each competitor
3. `COMPETITOR_DASHBOARD_VERIFICATION_2026-04-18.md` — Live dashboard visits for 6 competitors (vaultifacts@gmail.com); corrections to code-audit claims
4. `COMPETITOR_FULL_WALKTHROUGH_2026-04-18.md` — Full interactive UI walkthrough of 6 dashboards; comparison matrix, pricing verification, architectural notes
5. `COMPETITOR_GAP_CLOSURE_2026-04-18.md` — Targeted deep-dive into sub-tabs, billing, AI features, and extension popups; SellerAider pricing verified; Vendoo Pro Tools sub-tabs documented
6. `COMPETITOR_TECHNICAL_APPENDIX_2026-04-18.md` — Exhaustive technical reference; file sizes/endpoints/function names/metrics for all 9 competitors
7. `COMPETITOR_TRIAL_UNLOCK_2026-04-19.md` — 4 trial-activation findings (PrimeLister Poshmark Automation Trial, OneShop free-tier login, Nifty Bundle Pro trial, Vendoo Pro trial); PrimeLister 12-panel documentation; Vendoo Pro does NOT unlock v2 routes; Nifty Insights "broken" finding retracted
8. `COMPETITOR_NIFTY_POSHMARK_DEPOP_2026-04-19.md` — Full walkthrough of Nifty's 5 Poshmark + Depop automation panels after user connected both accounts; unique features documented (Waterfall offers, Bundle offer to last liker, closet-size-dynamic recommendations, drag-reorderable multi-rule)

**Late discoveries (not in source reports — incorporated here):**
- Flyp has two separate extensions: Crosslister (`kbflhgfmfbghhjafnjbgpiopcdjeajio/1.0.4_0`) and Bot Sharer (`ehicjmkogfjifombjmdinmhpaghfggcd/1.7.6_0`). Bot Sharer has 1.14 MB background.js with CAPTCHA solving (108 references) and a 15-action vocabulary.
- All 10 extensions ARE installed in `Profile 3/Extensions/`, not `Default` profile. The gap-closure agent's claim that several were "not installed" was incorrect — it was searching the wrong Chrome profile.
