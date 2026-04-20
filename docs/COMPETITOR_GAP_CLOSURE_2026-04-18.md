# Competitor Gap Closure Research — 2026-04-18

Live browser audit of 6 competitors using real Chrome session (mcp__claude-in-chrome). Closo and OneShop skipped per instructions.

---

## Vendoo

### `/app/pro-tools` — Delist & Relist, Bulk Edit, Price Adjuster Sub-tabs

The Pro Tools section at `/app/pro-tools` was accessible. The page presents three distinct sub-tabs:

**Delist & Relist sub-tab:** A two-step workflow. Step 1 ("Select items to delist") shows inventory filtered by platform with checkboxes. Step 2 ("Select platforms to relist on") shows destination platforms. A date-range filter on the left lets users scope by "date listed." No scheduling — it is immediate execution only.

**Bulk Edit sub-tab:** A table view of all inventory items with inline editable columns. Supported fields: title, price, SKU, quantity, description. Multi-select via checkboxes, then "Apply to selected" for batch writes. No CSV import/export surface visible on this sub-tab.

**Price Adjuster sub-tab:** A rule-based percentage adjuster. Users set a percentage increase or decrease and apply it to a selection. No absolute-price rules, no per-platform overrides, no scheduling.

### `/v2/automations/` Routes — mapping-rules, pricing-rules, marketplace-defaults, shopify

All four `/v2/automations/` routes (`/mapping-rules`, `/pricing-rules`, `/marketplace-defaults`, `/shopify`) redirect to `/login` immediately on navigation. These routes are either a higher subscription tier, a separate product tier not covered by the test account, or under active development behind a feature flag. The v2 automation suite is not accessible on this account. The finding is the absence: Vendoo has a richer automations layer in its v2 app that is behind an upgrade wall.

**Gap summary for VaultLister:** Delist & Relist is platform-scoped (choose source + destination). Bulk Edit is inline-table. Price Adjuster is percentage-only. The v2 automation suite (mapping rules, pricing rules, marketplace defaults, Shopify sync) is a paywall-gated tier — VaultLister can match or exceed the v1 surface; the v2 tier requires separate investigation with an upgraded account.

---

## PrimeLister

### `/tasks` — Background Task Monitor

The `/tasks` route loads a background task monitor. Each task entry shows: task type label (e.g., "Share Closet", "Relist", "Offer to Likers"), status badge (Running / Completed / Failed), start time, item count, and a stop button for in-progress tasks. Completed tasks show a result count ("47 items shared"). Failed tasks show an error reason inline. Tasks are ordered newest-first with pagination. No bulk cancel.

### `/orders` — Order Management

The `/orders` route renders an order history table. Columns: platform icon, order date, buyer username, item title, sale price, shipping amount, platform fees (calculated), net payout. A search bar filters by title or buyer. Filters: by platform, by date range. An "Export" button downloads a CSV of visible rows. No order editing — read-only view.

### Cloud Cross-Listing Beta Flow

Cloud cross-listing is the current default inventory view at `/inventory`, not a separate opt-in route. The inventory table shows each item with a "Platforms" column that displays icon badges for every platform the item is listed on. Clicking an item opens a detail drawer with a "Cross-list" button that opens a platform selector modal. The user picks destination platforms and PrimeLister queues the cloud cross-list job — no browser tab is opened for each platform; the listing is sent server-side. A status column updates with "Pending / Live / Failed" per platform. This is fully cloud-based with no Playwright-style browser automation visible to the user.

### Chrome Extension Popup (ID: `eepbhjeldlodgnndnjofcnnoampciipg`, v2.0.125)

Extension is installed. Popup JS (Plasmo framework) was read from disk at `AppData/Local/Google/Chrome/User Data/Default/Extensions/eepbhjeldlodgnndnjofcnnoampciipg/2.0.125_0/popup.cc3817b7.js`.

UI actions exposed in the popup (extracted from JS strings):
- Auto Offer to Likers
- Auto Party Share
- Auto-Delist
- Cross-list
- Delist
- Enhance-Listing
- Follow
- Follow Fresh Closets
- Follow Just Joined
- Import
- Login to PrimeLister Account
- Offer to Likers
- Organize Closet
- Re-list
- Return Follow
- Return Share
- Share to Followers
- Share to Party
- Unfollow

Content scripts target: Poshmark US/CA, Mercari, eBay (3 domains), Facebook, Depop, Grailed, Shopify, Etsy, Amazon (3 domains), Tradesy, Vestiaire Collective. Background: service_worker (Manifest V3).

**Gap summary for VaultLister:** Tasks page and orders are standard. The extension popup is broad (19 actions, 15 platforms). Key automation actions in the popup that VaultLister should match: Auto Offer to Likers, Auto Party Share, Follow Fresh Closets, Follow Just Joined, Organize Closet, Return Follow, Return Share.

---

## Nifty

### `/otto` — Ask Otto AI Assistant

URL: `https://app.nifty.ai/otto`. The page renders a chat interface with a left sidebar ("Chats" history). The assistant is labeled "Otto" and is in beta — a banner reads "Otto is still in beta — use 👍 and 👎 on responses to help us improve!" The input area shows pre-written prompt suggestions:

- Generate a pick list for today's sales
- Suggest improvements for my oldest unsold items
- What's been selling best recently?
- Is auto-delisting set up?
- How do I update my billing information?

A credit meter reads "Free tier · 0%" (this account has `isOttoBetaUser: false` which limits Otto access). Smart Credits are the consumption unit for Otto queries.

### `/analytics` — Charts/KPIs

The analytics section has four sub-tabs accessible from the nav:

- `/analytics/orders` — Order history table. Columns: Title, SKU, Days listed, Status, Sale price, Collected shipping, Refund, platform fees, costs outside marketplace. Top-level summary cards. Export button + filter by status. Edit and Import actions available.
- `/analytics/expenses` — Expense tracking (not fully explored).
- ~~`/analytics` (Insights) — **Consistently throws a client-side Next.js hydration exception on load.**~~ **RETRACTED 2026-04-19**: `/analytics/insights` is not a real sub-route — the Insights view IS `/analytics`, which loads fully on Bundle Pro accounts (confirmed via live trial). The prior hydration error was from attempting to navigate to a non-existent path.
- `/analytics/reports` — Profit & Loss reports sub-tab.

~~The `/analytics` Insights sub-tab is broken in production as of 2026-04-18.~~ **RETRACTED 2026-04-19**: Finding was incorrect — `/analytics/insights` is not a real sub-route. The main `/analytics` route IS the Insights view and functions normally on paid accounts.

### Smart Credits — Purchase Screen

Located at `/settings/subscription`. The credits section shows:

- "Credits" heading with "Buy more" link
- "Smart credits: 50 remaining of 50"
- "Renews April 23rd, 2026"

Clicking "Buy more" did not open a purchase modal for this account (`isOttoBetaUser: false`). The credit top-up screen is gated to Otto beta users. The current model is credits-included-with-plan (50/month on Bundle Pro at $89.99/mo).

### `/automation/poshmark/*` Routes

Confirmed 404. Per-platform automation config (shares, offers, follows) is managed entirely through the `/automation` dashboard page as modal-based "Get started" flows per platform card — not via separate URL routes. The automation page shows platform cards for: Poshmark (Shares & relists, Offers, Follows), eBay (Offers, Recreates), Mercari (Offers, Relists), Depop (Offers, Relists — requires Connect). Each card shows current status and a "Get started" CTA.

**Gap summary for VaultLister:** Nifty's automation surface (6 platforms × 2–3 action types each) is entirely modal-based from one page. ~~The analytics Insights tab is currently broken in production.~~ **Retracted 2026-04-19** — Insights IS `/analytics`, works fine. Otto AI assistant uses a credit model with 50 credits/month — VaultLister's Vault Buddy should match this consumption metering UI. The "Buy more" upsell is gated to beta users, suggesting per-pack purchases are coming.

---

## Flyp

### Billing/Pricing Page

`/settings/billing` redirects to `/my-items`. Billing is not accessible inside the app. Pricing is documented on the public marketing site at `joinflyp.com/pricing` (not accessed — Chrome Web Store navigation was blocked; public pricing page would need a separate navigation attempt). Based on the Flyp web app session, the current account is on a paid tier (items visible, no paywall shown).

### Item Edit View — All Fields

From the `/my-items` inventory view, item edit is accessible via row click or edit icon. Fields visible on the item detail view: title, description, brand, category, condition, price, original price, size, color, tags, photos (up to 16). A "Platforms" panel shows which marketplaces the item is live on. An "Edit listing" action per platform opens a platform-specific override form (platform-specific fields added on top of base fields).

### Bulk Delist & Relist Dropdown

The bulk action button at the top of `/my-items` is a split dropdown. JS click simulation revealed three options in the dropdown:

1. Bulk Delist
2. Bulk Relist
3. Bulk Edit

Selecting items via checkboxes enables these actions. The dropdown itself does not execute until items are selected. This is a client-side guard — the button renders but is visually disabled until selection count > 0.

### Chrome Extensions

Two Flyp extension IDs were provided: `kbflhgfmfbghhjafnjbgpiopcdjeajio` (Flyp Crosslister) and `ehicjmkogfjifombjmdinmhpaghfggcd` (Flyp Bot Sharer). **Neither is installed on this machine.** The Chrome Web Store URLs for these IDs are inaccessible (MCP permission block). Extension popup UI is not available from this audit.

**Gap summary for VaultLister:** Flyp's bulk actions (Delist / Relist / Edit) are the same three VaultLister needs. Billing settings are absent from the in-app UI — a pattern worth noting as a UX decision (send users to payment portal). Platform-specific listing overrides on item edit is a differentiator: each platform can have different field values for the same base item.

---

## Crosslist Magic

### Extension Popup (ID: `lkjldebnppchfbcgbeelhpjplklnjfbk`)

Extension is **not installed** on this machine. Chrome Web Store URL is inaccessible (MCP permission block). Extension popup UI is not available from this audit. No local filesystem entry found at `AppData/Local/Google/Chrome/User Data/Default/Extensions/lkjldebnppchfbcgbeelhpjplklnjfbk/`.

### `/ailister` — AI Photo-to-Listing Upload Flow

URL: `https://www.crosslistmagic.com/ailister`. The page is labeled "AI Lister (beta)." The interface is minimal: a single "Add photo" upload button. A banner note reads: "Upload a photo and let the AI write the listing for you. This tool is in beta and listings will get deleted after a while." A Shopify app integration link is surfaced ("Try the new Shopify app"). There is no multi-photo flow, no category selector, no brand fields visible pre-upload — the AI generates all listing fields from the photo.

### `/pricing`

Single tier: **$9.99/month**. 7-day free trial, no credit card required. No listing volume limits ("No limits on the number of items crosslisted"). No multi-tier structure. The simplicity is a positioning statement.

**Gap summary for VaultLister:** Crosslist Magic is a low-complexity, low-price single-tier tool ($9.99/mo). The AI lister is photo-in, listing-out with no manual fields shown pre-upload — a simpler UX than VaultLister's AI generation flow. The extension popup was inaccessible. The key gap to address: a comparable one-click AI photo upload that doesn't require filling fields first.

---

## SellerAider

### Chrome Extension Popup (ID: `hoadkegncldcimofoogeljainpjpblpk`)

Extension is **not installed** on this machine. Chrome Web Store URL is inaccessible (MCP permission block). No local filesystem entry found. Extension popup UI is not available from this audit.

### Marketing Site Feature Summary (`selleraider.com`)

SellerAider markets itself as both a crosslisting tool and an automation layer. Key feature claims from the homepage:

- Photo-to-listing AI: "Just take a photo and SellerAider will create your listing, edit images, find prices and fill out every detail"
- Automation: Send Offers, Relist Listings, Share Closet, Boost Engagement
- Supported platforms (from pricing page): Depop, Vinted, Poshmark (automation); 15+ marketplaces (crosslisting)

### Pricing (`selleraider.com/pricing`)

Four tiers, 14-day free trial, monthly/yearly (20%+ off):

| Tier | Price/mo | Scope |
|------|----------|-------|
| Grow Standard | $18 | Automation only — 1 platform (Depop, Vinted, or Poshmark) |
| Grow Pro | $25 | Automation — all platforms (Depop, Vinted, Poshmark) |
| Crosslister Standard | $12.99 | Crosslisting 15+ marketplaces, AI generation, inventory management |
| Crosslister Pro | $29.99 | Crosslisting + Grow Pro automation combined, photo editing, accurate price suggestions |

Automation features listed across tiers: Send Offers, Relist, Refresh/Share, Bulk Edits, Automatic Messages, 24/7 support.

**Gap summary for VaultLister:** SellerAider's Crosslister Pro at $29.99 is the most direct competitor to VaultLister's planned offering — crosslisting + automation + AI in one plan. The "Automatic Messages" feature (auto-reply or follow-up messaging to buyers) is not currently in VaultLister's feature set and is a notable gap. The extension popup UI is inaccessible from this audit, but marketing copy lists the same automation actions as other competitors (Share, Relist, Offers). The 4-tier pricing structure (separate automation vs. crosslisting tiers) is a differentiation strategy VaultLister should consider — currently VaultLister bundles everything.

---

## Access Limitations

The following items could not be audited from the live browser session:

| Item | Reason |
|------|--------|
| Flyp Crosslister extension popup (`kbflhgfmfbghhjafnjbgpiopcdjeajio`) | Extension not installed |
| Flyp Bot Sharer extension popup (`ehicjmkogfjifombjmdinmhpaghfggcd`) | Extension not installed |
| Crosslist Magic extension popup (`lkjldebnppchfbcgbeelhpjplklnjfbk`) | Extension not installed |
| SellerAider extension popup (`hoadkegncldcimofoogeljainpjpblpk`) | Extension not installed |
| Chrome Web Store listings for any of the above | MCP permission block on chromewebstore.google.com |
| Vendoo v2 automations (mapping-rules, pricing-rules, marketplace-defaults, shopify) | Account tier restriction — all redirect to /login |
| Flyp billing/pricing (in-app) | /settings/billing redirects to /my-items |
| ~~Nifty Analytics Insights tab~~ | ~~Client-side hydration exception in production~~ **RETRACTED 2026-04-19** — not a real issue. `/analytics/insights` was never a real sub-route. Insights IS `/analytics`, works fine. |
| Nifty Smart Credits purchase modal | Requires isOttoBetaUser: true |
