# Competitor Final Gap Closure — 2026-04-19
Live browser session. All findings from authenticated accounts.

---

## Task 1: Flyp — Sharer Sub-tabs + Crosslister Platform Overrides

**Attempted:** Navigated to `/poshmark` (Sharer) and `/item/:id` (Crosslister edit).

**Found:**

Sharer top nav: Crosslister | Sharer | Orders | Offers | Analytics

Sharer sub-tabs (all Poshmark-only, URL path `/poshmark`):
- **Share** — Scheduled / Continuous / Just once modes; all closet or portion; daily limit; randomize / keep / switch order; fast/slow speed; party sharing toggle
- **Auto-Offers** — Send offer to new likers every N minutes; discount %; discounted shipping (No/4.99/FREE); min price; exclude items listed in last N days
- **Bulk Offers** — (tab visible, content not extracted)
- **Follow** — (tab visible)
- **Community Share** — (tab visible)

Crosslister item edit — platform selector sidebar shows:
- Universal form (auto-fills all)
- Poshmark (2 fields left)
- Mercari (3 fields left)
- eBay (3 fields left)
- Depop (5 fields left)
- Facebook (Listed)
- Etsy (Not connected)

**Platform-specific field overrides:** Clicking a platform tab changes URL to `?marketplace=poshmark` etc. and is expected to render platform-specific required fields. However this URL change triggers a server-side redirect to the login page for non-US accounts (geo-block: "We detected you're using Flyp from outside the US"). The Universal form fields visible are: Title, Description, Brand, Condition, Primary/Secondary Color, SKU, Zip Code, Tags, Quantity, Note, Package weight/dimensions, Listing Price, Cost of Goods. The "N fields left" badge indicates platform-specific mandatory overrides exist but their field names could not be captured due to the geo-redirect.

**Gap status:** Sharer is confirmed Poshmark-only (no eBay/Mercari/Depop sub-tabs). Crosslister platform overrides confirmed to exist but field-level detail blocked by geo-restriction. Newly closed: Sharer sub-tab count and names.

---

## Task 2: Closo — App Dashboard + Blog + AI Agents

**Attempted:** `app.closo.co`, `closo.co/blog`, `closo.co/ai-agents`, `closo.co/pricing`, `app.closo.co/dashboard`.

**Found:**

- `app.closo.co` — Renders "closo app" title page with "Home / Login / Вийти (Exit)" and footer. No product content. No agent UI. No pricing. The app is a near-empty shell.
- `closo.co/blog` — 404
- `closo.co/ai-agents` — 404 (nav shows AI AGENTS as category but all sub-links are 404)
- `closo.co/pricing` — 404
- `app.closo.co/dashboard` — 404

The Closo website nav lists many free tools (List faster with AI, Price Smarter, Import Products, Crosslist Products, Share Products, Send Offers, Auto-Relist, Auto-Delist, Liquidate Products, Analyze Demand, Track Buyer Activity) and AI Agents (Sourcing Agent, Crosslisting Agent, Promotion Agent) but all page links resolve to 404. The app itself shows only a language switcher (en-US/Ukrainian) and an exit button.

**Gap status:** Closo is still a skeleton post-revival. No functional AI agent UI accessible. No pricing discoverable. No blog content. Newly closed: confirmed the "revival" is cosmetic-only as of 2026-04-19.

---

## Task 3: PrimeLister Public Roadmap

**Attempted:** `roadmap.primelister.com/roadmap`

**Found (FeatureOS platform, fully rendered):**

**Planned (2 items):**
1. Depop refresh listings — 69 votes
2. Adding Price and Shipping Information on Crosslist — 57 votes

**In Progress:** No posts found (empty column)

**Completed (top items by vote):**
1. Auto Delist — 183 votes
2. Relist Feature for Ebay — 52 votes
3. Create a Listing on PrimeLister Inventory — 77 votes
4. Shopify Integration — 54 votes
5. Grailed & Depop Relister & Product Importer — 22 votes
6. Depop cross-listing supports — 18 votes
7. Auto Send offer to Likers on poshmark — 16 votes
8. Mobile Functionality — 32 votes
9. Filter by Platform — 13 votes
10. Bundle Offers being supported on Primelister — 11 votes

Additional completed: Mark as a sold (9), SKU's for listings (9), Automatic offers for eBay (9), Multiple Closets (7), Bulk offer/price drop to likers on Poshmark (12), Bulk offer to liker on Mercari (5), Automated AUTO SHARE to Followers (8), Automated Party Share (6), Recurring Closet Share (6), Offer IF/THEN options (8), Listings Shared at Poshmark Party (8), Allow re-listing/deletion of multi-item listings (8).

**Gap status:** Newly closed. PrimeLister's roadmap is public and current. Key insight: their "In Progress" column is empty — no active dev work shown publicly. Depop refresh and crosslist price/shipping are the only Planned items.

---

## Task 4: Nifty Otto AI Test

**Attempted:** `app.nifty.ai/otto` — clicked "What's been selling best recently?" suggested prompt chip.

**Found:**

The prompt was sent successfully (chat session created at `/otto/chat/9be77925-...`, chat titled "Best selling items recently"). However no AI response was generated after multiple checks spanning several minutes. The credit counter remained at "Free tier · 0%".

Root cause identified from Nifty's Next.js hydration data: `"isOttoBetaUser": false` — this account is NOT in the Otto beta. The Otto interface renders and accepts prompts but does not generate responses for non-beta users. The "Free tier · 0%" indicator reflects free-tier credit allocation, not whether beta access is granted.

**Credit structure visible:** "Free tier · 0%" — free accounts have some credit allocation but beta access gates actual response generation.

**Response structure (from UI):** Intended to show conversational AI responses referencing user's actual listing data. The suggested prompts include inventory-aware queries ("Generate a pick list for today's sales", "Suggest improvements for my oldest unsold items") implying the AI queries connected marketplace data.

**Gap status:** Otto test blocked — not an Otto beta user. Newly closed: confirmed Otto requires beta enrollment separate from subscription tier; free tier alone is insufficient.

---

## Task 5: OneShop Free-Tier Full Walkthrough

**Attempted:** All pages at `oneshop.com/u/*`

**Found:**

Nav: Home | Orders | Crosslisting | Use iOS/Android App | Settings

**`/u/listings`** — Listing tabs: All Listings / To Crosslist / Drafts / Crosslisted / Scheduled / Has Listing Issues / Sold Out / Archived. Actions: Draft a listing, Import listings from another site, Autofill Settings. No listings in account. Basic Search visible.

**`/u/orders`** — Shows "Pending Orders, See all" and "Shipping Labels — You don't have any orders to ship!". Synced 16 minutes ago. No order data.

**`/u/institution-accounts`** — Renders onboarding: "You're now logged into OneShop. Log into Mercari Or Continue to OneShop." Only Mercari shown as linkable platform in this onboarding step (Chrome Extension required for marketplace connections).

**`/u/settings`** — Shows upgrade modal: "OneShop Premium — The best reseller groups and tools, trusted by over 5,000 paying customers. The best hands-free Poshmark bot / Mercari relisting bot / Only crosslisting product with autodelistingWorks on iOS and Android. Try monthly." No price amount visible in the server-rendered text.

**`/u/bots/poshmark/account-shares`** — Redirects to `/u/settings` (upgrade paywall). All bot routes are paywalled.

**Home page** (`/u`) — 404.

**Gap status:** Newly closed. OneShop free tier confirmed: crosslisting and listing management only; all bot/automation routes redirect to paywall. Price not visible in free-tier settings page (requires clicking "Try monthly" button which was not pressed per safety rules).

---

## Task 6: Crosslist Public Roadmap

**Attempted:** `feedback.crosslist.com/en/roadmap`

**Found (fully rendered via accessibility tree):**

**Under Consideration (108 total items, top by votes):**
1. Listing Variations (Size/Scale) with Quantity & Stock Sync — 108 votes
2. Add OfferUp — 102 votes
3. Add Vestiaire Collective — (votes not shown in initial render)
4. Add TikTok Shops
5. Add Instagram Shopping
6. Detect Duplicate Listings (and SKUs) to Prevent Double-Selling
7. Set eBay Promoted Listings Rate When Crossposting
8. Add Amazon
9. Archive & End Listings (Sold/Inactive) Instead of Deleting — with Per-Marketplace Options
10. See a listing's price directly from the "My listings" dashboard

**Planned (5 items):**
1. Set Minimum & Auto-Accept Offer Thresholds for eBay Listings
2. Support eBay Simple Delivery
3. More Size Options in Crosslist (Junior, Shirt, Tall sizes)
4. Add draft label versus ready to post label
5. Ability to purchase additional AI listing credits

**In Progress (3 items):**
1. Auto-Delist (and Mark Sold) Across Marketplaces When an Item Sells — **274 votes**
2. Full Mobile Listing: Post, Import, Schedule, and Bulk Delist from Your Phone — **121 votes**
3. Sales analytics & reporting — **109 votes**

**Released (recent):**
- Edit listing without relisting
- Import listings through .CSV Import
- Add delist/relist timestamps
- Set different prices by marketplace
- Add filter on "Created" and "Last Updated" to identify stale listings
- Choose eBay and Etsy shipping policy per listing
- Sort listings by "Last Updated"
- Improved AI listings
- Add WooCommerce
- Edit prices in bulk

**Gap status:** Fully closed. Key insight: Crosslist's 3 active in-progress items (auto-delist 274 votes, mobile 121 votes, analytics 109 votes) are all high-demand features VaultLister can position against. OfferUp (102 votes) and TikTok Shops are top marketplace requests not yet on VaultLister radar.

---

## Task 7: Vendoo Pro Tools Sub-tabs

**Attempted:** `web.vendoo.co/app/pro-tools`, `/app/offers`, `/app/auto-offers`, `/v2/automations/sharing`

**Found:**

Pro Tools landing (`/app/pro-tools`) shows 3 cards — **the previous Delist & Relist / Bulk Edit / Price Adjuster tabs no longer exist**. The current Pro Tools are:
1. **Send Offers** (ACTIVE) — "Send bulk offers to likers across multiple marketplaces at once"
2. **Auto Offers** (ACTIVE) — "Create custom rules for Vendoo to send automatic offers to new likers and watchers"
3. **Marketplace Sharing** (ACTIVE) — "Automate Poshmark Sharing, Depop Refreshing, and Grailed Bumping to increase visibility and sales"
4. **More Pro Tools Coming Soon...**

**Send Offers (`/app/offers`):**
- Marketplaces: eBay (0), Poshmark (0), Mercari (0), Depop (0), Grailed (0), Vestiaire Collective (0)
- Per-platform: Offer % field + "Offer price based on" selector
- Status: "You currently have no items available to make offers" (empty inventory)

**Auto Offers (`/app/auto-offers` or `/v2/automations/auto-offers`):**
- Marketplaces: eBay (OFF), Poshmark (OFF), Mercari (OFF), Depop (OFF), Grailed (OFF), Vestiaire Collective (OFF)
- Per-platform config (shown for Depop): Active toggle, Offer price based on, Price Rules (1), If price is between $X-$Y, Offer % off, Add new rule button
- Exclusions: New with tags (NWT), Items listed in last N hours, Category, Brand, Label, Exclude specific items
- Actions: Save, Save + Copy to

**Marketplace Sharing (`/v2/automations/sharing`):**
- Platforms: Depop / Poshmark / Grailed
- Poshmark config: Amount of items to share (max 6000/day), Sharing order, Sharing speed, Schedule sharing, Share now
- Depop config: Amount of items to refresh (max 6000/day), Refreshing order, Refreshing speed, Schedule refreshing, Refresh now
- Grailed config: Amount of items to bump (max 6000/day), Bumping order, Bumping speed, Schedule bumping, Bump now. Note: "Items on Grailed can only be bumped once every 7 days, and after 30 days must be discounted by at least 10% to bump again."

**Gap status:** Fully closed. The previously-documented Delist & Relist / Bulk Edit / Price Adjuster Pro Tools appear to have been removed or restructured into the v2 interface. The current Pro tier is automation-focused (offers + sharing).

---

## Task 8: Vendoo v2 Routes — Pro Trial Access Check

**Attempted:** Direct navigation to all 6 routes.

**Results:**

| Route | Result |
|-------|--------|
| `/v2/automations/sharing` | **ACCESSIBLE** — Marketplace Sharing UI (Poshmark/Depop/Grailed) |
| `/v2/automations/auto-offers` | **ACCESSIBLE** — Auto Offers Manager UI |
| `/v2/automations/offers` (Send Offers) | **ACCESSIBLE** (via `/app/offers`) |
| `/v2/automations/mapping-rules` | Redirects to `/login` — **NOT accessible on Pro** |
| `/v2/automations/pricing-rules` | Redirects to `/login` — **NOT accessible on Pro** |
| `/v2/automations/marketplace-defaults` | Redirects to `/login` — **NOT accessible on Pro** |
| `/v2/automations/shopify` | Redirects to `/login` — **NOT accessible on Pro** |

The v2 nav (visible from sharing page) shows all routes including Mapping Rules, Pricing Rules, Marketplace Defaults, and Shopify Automations under a "Rules" section — but these are Business-tier gates. Nav links point to `web.vendoo.co/v2/automations/mapping-rules` but direct navigation from browser triggers a session-auth failure (redirects to `/login`). When clicked from within an active v2 session the link resolved to `enterprise.vendoo.co/v2/automations/mapping-rules` which returns a Firebase 404 (broken Business-tier subdomain).

**Gap status:** Newly closed. Pro unlocks: sharing + auto-offers + send-offers. Business-tier-only (broken/enterprise subdomain): mapping-rules, pricing-rules, marketplace-defaults, shopify.

---

## Task 9: Nifty /orders Page

**Attempted:** `app.nifty.ai/orders`

**Found:** 404 — "Page Not Found". The `/orders` route does not exist on Nifty.

Nifty's actual route structure (confirmed from nav and 404 page links):
- `/inventory`
- `/analytics` (tabs: Orders, Expenses, Insights, Profit & Loss, Export — these are analytics sub-views, not a standalone orders page)
- `/automation`
- `/otto` (Ask Otto)
- `/affiliate`
- `/settings`

The "Orders" tab exists within `/analytics` as a sub-view showing sales data. The Analytics page showed: Units Listed 289, Units Sold 2, Sell Through Rate 0.7%, Total Revenue $28.00, Total Profit $20.10. Connected marketplaces: eBay, Mercari, Etsy, Poshmark, Depop. Subscription: BUNDLE_II (monthly trial, renews 2026-04-24).

**Gap status:** Newly closed. `/orders` does not exist as a standalone Nifty route. Orders data lives within `/analytics` as a sub-tab.

---

## Task 10: Vendoo Go Mobile App (App Store)

**Attempted:** Apple App Store page via WebFetch — `apps.apple.com/us/app/vendoo-go/id6746722923`

**Found:**

- **Name:** Vendoo Go
- **Version:** 1.0.1 (released ~4 days before 2026-04-19, i.e. ~April 15, 2026)
- **Description:** "Snap a photo, let AI generate your item details, and publish directly to platforms like eBay and Mercari with just one tap."
- **AI Capabilities:** AI-powered product detail generation from photos
- **Supported platforms in app:** eBay and Mercari (explicitly mentioned)
- **Price:** Free
- **Ratings:** Not enough ratings to display (very new app)
- **Requirements:** iOS 15.1+, iPad compatible, Mac compatible (M1+)
- **Version 1.0 original release:** January 21 (2026)

**Gap status:** Newly closed. Vendoo Go is a minimal mobile listing tool (photo → AI details → publish to eBay/Mercari). It is NOT a companion to the full Vendoo web app — no crosslisting to 9 platforms, no inventory sync, no analytics. Pure quick-list mobile experience.

---

## Summary Matrix

| Task | Status | Key New Finding |
|------|--------|-----------------|
| 1. Flyp Sharer sub-tabs | Closed (partial) | 5 Poshmark-only sub-tabs confirmed; platform field overrides geo-blocked |
| 2. Closo revival | Closed | App is empty skeleton; blog/AI agents/pricing all 404 |
| 3. PrimeLister roadmap | Closed | 2 Planned items, 0 In Progress, ~70 Completed |
| 4. Nifty Otto | Blocked | `isOttoBetaUser: false` — not enrolled in beta despite Bundle II trial |
| 5. OneShop free tier | Closed | Bots redirect to paywall; Mercari-only account linking shown |
| 6. Crosslist roadmap | Closed | Auto-delist (274 votes) + mobile (121) + analytics (109) in progress |
| 7. Vendoo Pro Tools | Closed | Delist/Relist/BulkEdit/PriceAdjuster removed; replaced by Offers + Sharing |
| 8. Vendoo v2 routes | Closed | sharing + auto-offers accessible on Pro; mapping/pricing/defaults/shopify are Business-only (and broken on enterprise subdomain) |
| 9. Nifty /orders | Closed | Route is 404; Orders data lives in /analytics as sub-tab |
| 10. Vendoo Go | Closed | v1.0.1, AI photo-to-listing, eBay+Mercari only, free, very new |
