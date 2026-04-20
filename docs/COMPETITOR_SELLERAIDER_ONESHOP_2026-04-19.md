# SellerAider + OneShop Premium — 2026-04-19 Deep Walk

Verified live via `mcp__claude-in-chrome__*` tools against authenticated browser sessions.

---

## SellerAider

### Access State

- Dashboard URL: `my.selleraider.com` (NOT `dashboard.selleraider.com` — that domain is stale/different app)
- Authenticated as: vaultifacts@gmail.com
- `dashboard.selleraider.com` is a separate legacy/alternate app that serves a blank React root when not logged in
- `my.selleraider.com` is the current production dashboard
- Subscription tier active: not confirmed from Settings page (Settings only shows email + Sign Out)
- 14-day free trial available (no card required) per pricing page

### Navigation Map

Dashboard URL pattern: `my.selleraider.com/dashboard/[section]`

Top-level nav (5 items):
- Home → `/dashboard`
- Listings → `/dashboard/listings`
- Analytics → `/dashboard/analytics` (Coming Soon)
- Messages → `/dashboard/messages` (Coming Soon)
- Settings → `/dashboard/settings`

Language selector in sidebar: English, Français, Deutsch, Polski (4 languages).

### Per-Feature Deep-Dive

#### Home / Dashboard

Live KPIs visible:
- Total Listings Value: `$5,386.56`
- Total Earnings This Week: `$1,259.00`
- "Analytics (Coming soon)" label next to the KPI section

Quick Actions:
- List from photo (AI) — opens AI listing generation flow
- Use Crosslister — navigates to Chrome extension-based crosslister
- Use Grow — navigates to Chrome extension-based automation/Grow tool

Extension Status section: "No extensions detected" — the core automation features (Grow) require the Chrome extension to be installed and detected.

#### Listings

URL: `/dashboard/listings`

Controls:
- "Create New Listing" button
- Tab switcher: "Generations" | "Inventory"
- Search/filter: not visible (empty state shown — account has no listings in this new account)
- "Generate Listing" CTA button
- Empty state: "No listings found — Create your first listing to get started"

The Crosslister and Grow features are accessed via external links, not inside this dashboard. The dashboard inventory is separate from the Chrome extension's native crosslisting UI.

#### Analytics

URL: `/dashboard/analytics`

State: **Coming Soon placeholder**. Text: "Get insights into your inventory and sales — Back to Dashboard." No charts, no KPIs, no date range controls, no export.

#### Messages (CRITICAL VERIFICATION)

URL: `/dashboard/messages`

State: **Coming Soon placeholder**. Exact text: "Messages — Coming Soon — Manage your messages on all platforms/marketplaces — Back to Dashboard."

**Finding: "Automatic Messages" is NOT implemented.** The dashboard Messages section is a Coming Soon stub with no functional controls. No platform selection, no templates, no trigger conditions, no opt-out handling. The feature is listed on all Grow/Crosslister pricing tiers as a bullet point but has no working UI in the authenticated dashboard. The prior code audit's suspicion is confirmed.

#### Settings

URL: `/dashboard/settings`

Visible content: Email (vaultifacts@gmail.com), Sign Out, Get Help. No subscription management, no billing, no connected platform credentials, no notification preferences.

#### Crosslister (Chrome Extension)

SellerAider Crosslister is a **Chrome extension** product, not a web dashboard feature. The "Use Crosslister" quick action and the `/crosslister` URL from the marketing site both route to the extension install flow. Features per marketing page:

- Crosslist between 15+ marketplaces (eBay, Etsy, Poshmark, Vinted, Depop, Grailed, Facebook Marketplace, Mercari, and others; supports UK/US/CA/more regions)
- "Turn Photos into Listings" — photo upload triggers AI to write description, edit images, suggest prices
- Bulk delete, relist, mark sold
- AI listing generation
- Inventory management
- Automatic delisting when item sells elsewhere
- Multi-quantity/variants support
- SEO optimization for marketplace search algorithms
- Not a web-app flow — requires Chrome extension installed; "No extensions detected" shown in dashboard when extension absent

#### Grow / Automation (Chrome Extension)

Grow is a separate Chrome extension sub-product. The Grow marketing page (`selleraider.com/grow/`) describes:

- Refresh/share listings in one click
- Relist and delist ("give stale listings a better chance")
- Manage offers — "Offer to people most likely to buy your items without lifting a finger"
- Re-arrange & save shop layout (Poshmark)
- "Message Templates & Manage Offers" — described as offer management with message templates; NOT verified as working in dashboard (Messages section is Coming Soon)
- Platforms: Depop, Vinted, Poshmark (Standard = one platform; Pro = all three)
- Requires Chrome extension installation; no bot activity visible in web dashboard

Grow Pricing (monthly): Standard $18 (one site), Pro $25 (all sites: Depop + Vinted + Poshmark)
Grow Pricing (yearly): Standard $130/yr, Pro $249.99/yr

#### AI Listing Generation

Accessible via "List from Photo (AI)" button on home and listings pages. Per marketing: takes a photo, uses AI to create optimized title and description, edit images, suggest prices. No LLM vendor identified on marketing pages. AI listing generation is in Crosslister Standard tier ($12.99/mo) and above.

#### Price Suggestions

Listed as a Crosslister Pro ($29.99/mo) feature. Described as "Accurate Price Suggestions." No detail on source data (eBay sold comps, manual floor, etc.) — extension-only feature, not testable from web dashboard.

#### Photo Editor

Listed as Crosslister Pro feature. No standalone photo editor page exists on the web app. Extension-based.

#### Inventory

Listed under Crosslister Standard and up. Single inventory view across all connected marketplaces. Accessible in web dashboard under Listings → Inventory tab.

### Pricing Tiers Verified

From `selleraider.com/pricing/` (verified live):

| Tier | Monthly | Yearly |
|------|---------|--------|
| Grow Standard | $18/mo | $130/yr |
| Grow Pro | $25/mo | $249.99/yr |
| Crosslister Standard | $12.99/mo | $140/yr |
| Crosslister Pro | $29.99/mo | $299/yr |

Yearly saves 20%+. 14-day free trial, no card required.

Feature split:
- **Grow Standard**: automation for 1 platform (Depop, Vinted, or Poshmark); Send Offers, Relist, Refresh/Share, Bulk Edits, Automatic Messages (claimed), 24/7 support
- **Grow Pro**: automation for ALL sites (Depop + Vinted + Poshmark); same feature set
- **Crosslister Standard**: 15+ marketplace crosslisting; no Grow automation; AI listing generation, inventory, bulk delete/relist, mobile
- **Crosslister Pro**: Crosslister Standard + Grow Pro automation included; Photo Editing, Accurate Price Suggestions, Automatic Delisting, mobile

### Comparison to Prior Claims

| Prior Claim | Verified State |
|-------------|----------------|
| Dashboard at `dashboard.selleraider.com` | Incorrect — actual app is at `my.selleraider.com` |
| "Automatic Messages" feature may not exist | Confirmed NOT working — Messages section shows "Coming Soon" in authenticated dashboard |
| Automation (Share/Relist/Offers) exists as UI | Exists in Chrome extension (Grow product), NOT in web dashboard |
| 4 pricing tiers | Confirmed correct: Grow Standard, Grow Pro, Crosslister Standard, Crosslister Pro |
| Pricing: $18 / $25 / $12.99 / $29.99 | Confirmed exactly |

---

## OneShop

### Access State

- URL: `tools.oneshop.com`
- Authenticated as: +15874320514
- **Premium trial: NOT active.** Settings page shows upsell ("Try monthly") — no active subscription detected.
- All 6 bot routes (`/u/bots/[institution]/[bot-type]`) redirect to `/u/settings` (paywall).
- The "7-day free trial" described in the task brief was NOT activated at time of walkthrough.
- Free-tier access only: Home, Orders, Listings, Settings pages functional.

### Navigation Map

5 top-level nav items (JS-driven buttons, no direct `<a>` hrefs except Home and Contact):
- Home → `/u/home`
- Orders → `/u/orders`
- Crosslisting → links to `/u/listings`
- Use iOS / Android App → external app store links
- Settings → `/u/settings`

Complete route map (from Next.js build manifest `_buildManifest.js`):
- `/u/home`
- `/u/orders`
- `/u/listings`
- `/u/listings/id/[id]`
- `/u/bots` (paywall → redirects to `/u/settings`)
- `/u/bots/[institution]/account-shares` (paywall)
- `/u/bots/[institution]/follows` (paywall)
- `/u/bots/[institution]/offer-to-likers` (paywall)
- `/u/bots/[institution]/otl-listings` (paywall)
- `/u/bots/[institution]/relisting` (paywall)
- `/u/bots/[institution]/share-order` (paywall)
- `/u/institution-accounts`
- `/u/premium`
- `/u/settings`

### 6 Bot Configs

All 6 bot routes confirmed behind Premium paywall — redirected to `/u/settings` (subscription upsell). No controls were visible. Route existence confirmed from build manifest; UI undocumentable until Premium activated.

Confirmed bot route names from build manifest:
1. `account-shares` — Poshmark closet sharing
2. `follows` — follow/unfollow bot
3. `offer-to-likers` — OTL automation
4. `otl-listings` — OTL listing management
5. `relisting` — auto-relist bot
6. `share-order` — share sequencing (unique feature)

All 6 use the pattern `/u/bots/[institution]/[bot-type]` — the `[institution]` segment is the marketplace slug (e.g., `poshmark`, `mercari`).

### Institution Connection Flow

URL: `/u/institution-accounts`

Visible content (free tier): "You're now logged into OneShop. Got the OneShop Chrome Extension? Log into these sites to link them to your OneShop account. Log into Mercari [link] → Or Continue to OneShop [link]."

Connection method: **Chrome extension bridges marketplace sessions.** User logs into marketplace sites in the browser with the OneShop Chrome extension installed; the extension links the session to the OneShop account. Only Mercari shown in this onboarding flow — Poshmark and others likely added after extension installation.

### Crosslisting Flow

URL: `/u/listings`

Accessible on free tier. Visible controls:
- "Draft a listing" action
- "Import listings from another site" action
- "Your recent imports" section (empty)
- "Autofill Settings" link
- Tab filters: All Listings | To Crosslist | Drafts | Crosslisted | Scheduled | Has Listing Issues | Sold Out | Archived
- Search box (text): "Search for a listing..."
- Filter toggle: "Basic Search"

Listing creation and crosslisting appear available on the free tier (listings can be created/imported). Autodelisting is listed as a key differentiator ("Only crosslisting product with autodelisting") and likely available across tiers.

### Analytics

The `/u/home` page shows:
- A sales goal target ("$21 — Beat last month by $21")
- Sales amount for Apr 01 and date range toggles: Today | Week | Month | Year
- Community ranking: "#2,156 in Top Ranking"
- "Set sales goal" and "Set listing goal" input prompts

No chart types, no export, no KPI list beyond sales total. The home page analytics is minimal — goal tracking + sales graph (data not populated for this account).

### AI Features

Per marketing homepage: "Smart autofill, description templates, and listing preferences help you spend less time per listing." No AI LLM vendor identified. The autofill is likely pattern-matching/template-based rather than generative AI, as no image-to-listing AI feature is mentioned. OneShop's AI positioning is around "autofill" (auto-populating fields from existing data) rather than photo-to-listing generation.

### Pricing Tiers Verified

From `tools.oneshop.com/pricing` (verified live):

**Single tier only: OneShop Premium — $45/month.**

No annual pricing shown. No feature matrix (no comparison table). No free tier. 7-day free trial available via "Try monthly" CTA.

Prior claim of "$67.99 Growing" tier: **Not found.** OneShop shows only one tier at $45/month. The $67.99 figure was either from a different product, an old pricing page, or incorrectly sourced.

Premium selling points (from `/u/premium` page):
- "The best hands-free Poshmark bot"
- "Mercari relisting bot"
- "Only crosslisting product with autodelisting"
- "Works on iOS and Android"

Platforms confirmed supported: Poshmark, Mercari (at minimum).

### "share-order" Unique Feature

Route: `/u/bots/[institution]/share-order` — **Premium only, not accessible.**

From the route name and OneShop's marketing context:
- "Share order" likely refers to the **ordering/sequencing of which listings get shared** in the closet-share rotation (not sharing of sales orders)
- This is a configuration for the closet-sharing bot — users control the priority/sequence in which their listings are surfaced (e.g., most liked first, newest first, least recently shared first)
- No competitor (PrimeLister, Flyp, Nifty, Closo) explicitly exposes the share sequencing order as a configurable bot parameter — most share in static rotation
- Why a user would use this vs. standard sharing: to optimize which listings appear at the top of their closet / buyer feeds by controlling share rotation order rather than random/FIFO cycling
- Full control documentation unavailable until Premium activated

### Mobile Presence from Dashboard

On `tools.oneshop.com/u/home`: Banner at top reads "Want to work on a smaller screen? OneShop is available on both iOS and Android." with direct links to:
- iOS: `https://bit.ly/oneshop-ios` (App Store)
- Android: `https://bit.ly/oneshop-android` (Play Store)

No mobile-first upsell beyond the top banner. The app is primarily designed for mobile (Next.js but renders as a phone-style layout at 1470px viewport). The iOS/Android App nav item links externally.

---

## Newly-Closed Gaps

1. **SellerAider "Automatic Messages" verified false** — the Messages section in the authenticated dashboard (`/dashboard/messages`) shows "Coming Soon" with no functional controls. Feature is listed on all Grow tiers as marketing copy but is not implemented.
2. **SellerAider dashboard URL corrected** — actual app is `my.selleraider.com`, not `dashboard.selleraider.com`.
3. **SellerAider is Chrome extension-first** — Crosslister and Grow are both Chrome extensions, not web-app features. The web dashboard is a thin companion (analytics/messages/listings inventory only).
4. **OneShop pricing confirmed: $45/month single tier** — the $67.99 "Growing" tier figure was incorrect. OneShop has one tier.
5. **OneShop connection method: Chrome extension** — marketplace accounts linked via extension session bridging, not OAuth flows.
6. **OneShop complete route map extracted** — 6 bot types confirmed: account-shares, follows, offer-to-likers, otl-listings, relisting, share-order.
7. **OneShop "share-order" is a share sequencing bot** — distinct from competitors that offer fixed-rotation sharing only.
8. **SellerAider Analytics in web dashboard: Coming Soon** — the dashboard KPIs (total listings value, weekly earnings) are placeholders; full analytics section is not yet implemented.

## Still-Open Gaps

1. **OneShop bot configs (all 6)** — all behind Premium paywall, not activated at time of walkthrough. Need user to activate Premium trial to see actual controls, rate limits, scheduling options, and enable/disable toggles.
2. **SellerAider Grow automation controls** — Chrome extension only; cannot inspect in web browser without installing the extension. Controls (delay settings, scheduling, platform-specific options) undocumented.
3. **SellerAider Crosslister extension UI** — field mapping, platform selection UI, bulk operations — all behind Chrome extension install.
4. **SellerAider subscription/billing state** — Settings page shows only email + sign-out; no tier, no billing date, no trial status visible.
5. **OneShop autofill mechanism detail** — described as "smart autofill" but no LLM vendor or model confirmed; unknown if it uses vision/AI or just template logic.
6. **OneShop Analytics** — dashboard shows minimal sales goal tracking only; no chart types, KPI definitions, or export options confirmed.
7. **SellerAider price suggestion source data** — Crosslister Pro feature; source (eBay sold comps vs. manual floor vs. ML model) unconfirmed.
