# Competitor Website Claims vs. Extension Code — 2026-04-18
> Ground truth: code audit at `docs/COMPETITOR_EXTENSION_AUDIT_2026-04-18.md`.
> Website data: fetched 2026-04-18. Short quotes (<15 words) used throughout.

## Methodology Note — Extension vs. Product

Several extensions are **thin bridges** (Tier B): the Chrome extension relays cookies to a backend server that drives automation. For Nifty and OneShop, the audit confirmed the extension is a bridge only — all automation runs server-side via the web app. Claims on those websites describe the *product*, which is the web app + extension together. Labeling those claims as OVERSTATES would be wrong.

Labels used:
- **MATCH** — website claim aligns with what code does
- **UNDERSTATES** — website says less than code actually does
- **OVERSTATES** — website claims more than code evidence supports (including no server delegation path)
- **MISLEADING** — technically defensible but creates a materially false impression
- **DELEGATED** — extension code alone doesn't do it, but the Tier-B backend plausibly delivers it; claim is architecturally consistent

---

## Comparison Table

### 1 — PrimeLister

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | Not mentioned on homepage | `Automation.AUTO_CLOSET_SHARE`, `AUTO_COMMUNITY_SHARE`, `AUTO_PARTY_SHARE` confirmed | UNDERSTATES |
| Relisting | "refresh stale listings with one click" | `ActionLabelsEnum.RELIST` + `Automation.AUTO_RELIST` confirmed | MATCH |
| Delisting | "Sync sold items across platforms automatically" | `ActionLabelsEnum.DELIST` confirmed | MATCH |
| Send offers to likers | Not mentioned on homepage | `AUTO_SEND_OFFER_TO_LIKERS` confirmed in Automation enum | UNDERSTATES |
| Cross-listing | "List once, sell on Poshmark, eBay, Mercari & more" | `ActionLabelsEnum.CROSSLIST` confirmed | MATCH |
| Scheduling | "Schedule to post your listings later" | 1-second `setInterval` task-queue poll; no `chrome.alarms` | MATCH (mechanism differs but scheduling is real) |
| Credential handling | No claim made | Cookies relayed bidirectionally to `api.primelister.com/cookies` | UNDERSTATES |

**Summary:** Homepage undersells the product. Share and offers automations exist in code but are not mentioned. Pricing/features pages returned 404 — may be disclosed there.

---

### 2 — Crosslist

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | Not mentioned | No closet-share function found | MATCH |
| Relisting | "Delist and relist with one click" | No relist function; `relist` hits are eBay prelist URL strings only | **OVERSTATES** |
| Delisting | "Delist and relist with one click" | `async delistListing()` confirmed | MATCH |
| Send offers to likers | Not mentioned | No offer-sending function | MATCH |
| Cross-listing | "Create your listing once, then publish to all major marketplaces" | Core function confirmed | MATCH |
| Scheduling | Not mentioned | `chrome.alarms` for sales polling only | MATCH |
| Credential handling | "We do not ask for your marketplace password"; "actions happen directly on your computer" | Cookie relay to `app.crosslist.com` with `credentials:include`; alarm polls server | **MISLEADING** |

**Summary:** "Delist and relist" is a material overstatement — relist is not implemented. The credential claim is technically accurate (no *password* requested) but the phrase "actions happen directly on your computer" is misleading: sales data is polled from and cookies are sent to `app.crosslist.com`.

---

### 3 — Crosslist Magic

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | Not mentioned | No evidence found | MATCH |
| Relisting | Not mentioned | No relist function | MATCH |
| Delisting | Not mentioned | No delist function | MATCH |
| Send offers to likers | Not mentioned | No evidence found | MATCH |
| Cross-listing | "A browser extension that helps you copy listings between" platforms | Core function via `crosslistmagic.com/api/proxy` | MATCH |
| Scheduling | Not mentioned | `setInterval` bridge heartbeat only | MATCH |
| Credential handling | No claim | Proxies through `crosslistmagic.com/api/proxy` | No claim to verify |

**Summary:** Modest website for a modest extension. Claims align with audit findings. No discrepancies.

---

### 4 — SellerAider

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | "Share Your Closet" (homepage) | No DOM share action found; `share` hits are lodash/core-js | **OVERSTATES** |
| Relisting | "Relist Your Listings" (homepage) | `relist` = eBay prelist URL string only; no relist automation | **OVERSTATES** |
| Delisting | Implied in crosslister feature | `DELIST_DELETE_COMPLETE`, `DELIST_TRY_DELETE` confirmed | MATCH |
| Send offers to likers | "Send Offers" (homepage) | No offer-sending action found | **OVERSTATES** |
| Cross-listing | Core product claim | `crosslister.bundle.js` (805 KB) confirmed | MATCH |
| Scheduling | Not mentioned | Queue drain `setInterval` only; no scheduled automations | MATCH |
| Credential handling | No claim | Tier A: cookies read locally, not relayed to server | No claim to verify |

**Summary:** SellerAider is a Tier-A extension (no server relay). The claims "Share Your Closet," "Relist Your Listings," and "Send Offers" on the homepage are not supported by the extension code — and since there is no backend automation pipeline to delegate to, these cannot be server-side either. Three independent OVERSTATEs.

---

### 5 — Flyp

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | "Closet sharing" listed as feature | No closet-share found in extension | DELEGATED (Tier-B backend likely handles via relayed cookies) |
| Relisting | AI listing auto-fill implied | `EXECUTE:RELIST_ITEM_POSHMARK` confirmed | MATCH |
| Delisting | "Auto-Delist sold items" | `EXECUTE:DELIST_ITEM_POSHMARK/MERCARI` confirmed | MATCH |
| Send offers to likers | "Offer to Likers" listed | No offer function found in extension | DELEGATED (Tier-B backend; cookie relay to `tools.joinflyp.com`) |
| Cross-listing | "Crosslist to Poshmark, eBay, Mercari, FB, Depop & Etsy" | Core function confirmed | MATCH |
| Scheduling | "Scheduling" listed as feature | No `chrome.alarms`, no scheduling code found | DELEGATED |
| Pricing | "just $9/mo all-included" | N/A | MATCH |

**Summary:** Share, offers, and scheduling are not in the extension code, but Flyp is Tier B with a backend at `tools.joinflyp.com`. These features plausibly run server-side. DELEGATED, not OVERSTATES.

---

### 6 — Nifty

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | "Automatically share, relist, follow, and send offers" | Extension is bridge only; all logic in nifty.ai web app | DELEGATED |
| Relisting | "Automatically share, relist..." | Bridge only; web app drives | DELEGATED |
| Delisting | "Enable auto-delisting to prevent duplicate sales" | Bridge only; web app drives | DELEGATED |
| Send offers to likers | "...send offers across platforms" | Bridge only; web app drives | DELEGATED |
| Cross-listing | "AI listing generation" + multi-marketplace management | Extension is bridge; no cross-list code in extension | DELEGATED |
| Scheduling | Implied by "automatically" language | No scheduling in extension; web app manages | DELEGATED |

**Summary:** Every automation claim is DELEGATED — the extension is purely a cookie-access bridge (`chrome.cookies.getAll` → `onConnectExternal` response). The nifty.ai web app drives all actions. Website claims are architecturally consistent with the product design.

---

### 7 — OneShop

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | "automatically do your repetitive work like...sharing" | No automation in extension; auth+linking only | DELEGATED |
| Relisting | "relisting, bumping...automatically" | No relist in extension | DELEGATED |
| Delisting | "Automatically delist when you sell" | No delist in extension | DELEGATED |
| Send offers to likers | Not mentioned | Not found | MATCH |
| Cross-listing | "Draft once...post on every site" | No create-listing action in extension; institution linking only | DELEGATED |
| Scheduling | Not mentioned | `setInterval` for metadata refresh only | MATCH |
| Credential handling | No claim | GraphQL `gql-api.oneshop.com` session token relay | No claim to verify |

**Summary:** OneShop's extension handles auth and account linking only. All automation runs via the `gql-api.oneshop.com` backend using relayed session tokens. DELEGATED across the board. No OVERSTATES.

---

### 8 — Closo

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | "Share Products" at peak buyer activity | `poshmark_script.js` clicks `button[data-et-on-name="listing_flow_share"]` | MATCH |
| Relisting | "Auto-Relist" listings | `taskOp === 'relist'` in `poshmark_script.js` | MATCH |
| Delisting | "Auto-Delist" listings | `async function delist()` confirmed | MATCH |
| Send offers to likers | "Send Offers" with "real-time trends" | `'offersToLikers'` in action dispatcher | MATCH |
| Cross-listing | "Lists your products on multiple marketplaces" | No cross-listing code found; no platform create-listing action | **OVERSTATES** |
| Scheduling | Implied via "peak activity times" | `chrome.alarms` (REST_POLL 60s, SOLD_CHECK 15min) | MATCH (partial) |
| Pricing | "Pro Seller Tools. Zero Fees" free tier mentioned | N/A | — |

**Summary:** Core Poshmark automation claims all match code. The cross-listing claim is the one misfire — audit found no cross-platform create-listing action. Closo's architecture (WS + REST to `app.closo.co`) is Poshmark-only based on evidence.

---

### 9 — Vendoo

| Feature | Website Claims | Extension Code (Audit) | Alignment |
|---------|---------------|------------------------|-----------|
| Closet sharing | "Marketplace Sharing: Poshmark, Depop & Grailed" (Pro plan) | No share action in `service_worker.js` | **OVERSTATES** |
| Relisting | "Delist and relist hundreds of items at once" | `relist` as queue operation confirmed | MATCH |
| Delisting | "Removes sold items from all remaining marketplaces" | 22 delist handler hits confirmed | MATCH |
| Send offers to likers | "Auto Send Offers on 6+ marketplaces" (Growth plan) | `"doesn't have enough likes to receive offers"` confirmed | MATCH |
| Cross-listing | "List Once, Sell Everywhere" | Core function; 16 platform `corsRules.json` | MATCH |
| Scheduling | Not explicitly named | `VendooQueuePulling` alarm every 5 min | UNDERSTATES |
| Credential handling | No claim | `cookies.set` writes to marketplace domains; session injection confirmed | No claim to verify |

**Summary:** Sharing is the gap — "Marketplace Sharing" listed in the Pro plan pricing table but no share action found in the extension's action dispatch table (`TN` object). All other major features verified. The 5-minute queue alarm (meaningful scheduling infrastructure) goes unmentioned.

---

## Top 5 Notable Discrepancies

**1. Crosslist — "Relist with one click" (OVERSTATE)**
Website prominently claims "Delist and relist with one click." The audit found zero relist implementation — `relist` keyword hits resolve to eBay prelist URL path strings, not automation. Customers paying $29.99–$44.99/month for a tool that advertises relisting as a core differentiator cannot get it from the extension.

**2. SellerAider — Three phantom features (OVERSTATE x3)**
"Send Offers, Relist Your Listings, Share Your Closet" all appear on the homepage. SellerAider is the only Tier-A extension in the audit (no server relay, no backend automation pipeline). The extension code contains none of these functions. There is no plausible delegation path — this is not a bridge architecture.

**3. Crosslist — Credential claim vs. cookie relay (MISLEADING)**
"We do not ask for your marketplace password" + "actions happen directly on your computer." Both statements are technically true. However, the extension uses `credentials:include` when polling `app.crosslist.com`, and a recurring `chrome.alarms` beacon sends sales data to the server. The combined impression — that no data leaves the user's machine — is false.

**4. Closo — Cross-listing claim without cross-listing code (OVERSTATE)**
Closo claims "Lists your products on multiple marketplaces at once." Closo's extension is deeply instrumented for Poshmark (share, relist, delist, offers all confirmed in `poshmark_script.js`). But no cross-platform listing creation code exists in the audit. The claim is a meaningful expansion of scope that the code does not support.

**5. Vendoo — "Marketplace Sharing" on pricing page vs. no share action (OVERSTATE)**
Vendoo's pricing page lists "Marketplace Sharing: Poshmark, Depop & Grailed" as a Pro-tier feature. The extension's action dispatch table (`TN` object in `execPageScriptContent.js`) contains `click`, `setInput`, `sendRequest`, `uploadImages`, `mercariList` — no share action. Given Vendoo's server-dispatch architecture, this could be a feature under development or gated to specific queue commands not present in this build, but no evidence supports the claim as currently implemented.

---

*Sources: Website fetches 2026-04-18. Code audit: `docs/COMPETITOR_EXTENSION_AUDIT_2026-04-18.md`.*
