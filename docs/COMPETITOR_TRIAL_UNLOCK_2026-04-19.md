# Competitor Trial Unlock — 2026-04-19
> Four active trials walkthroughs closing the gaps documented in COMPETITOR_MASTER_2026-04-18.md.
> All data collected 2026-04-18/19 via live browser sessions.

---

## PrimeLister

### Access state
- **Before trial:** Poshmark Automation subscription expired. All 10 automation cards on `/automations/poshmark/settings` showed "Subscription required" — no config panels accessible. Billing page showed no active plan.
- **After trial:** Poshmark Automation Trial (status: Trial, quota: Unlimited, created Apr 18) is active. All 10 automation cards are fully interactive. Each "Configure" button opens an inline modal with complete control sets. Crosslisting trial also active.

### Automation panel controls — full inventory

**Auto Activity (Smart Activity group)**
- Enable/disable toggle only. No additional controls.

**Auto List New Items (Smart Activity group)**
- Enable/disable toggle only. No additional controls.

**Auto Refresh Listings (Smart Activity group)**
- Enable/disable toggle only. No additional controls.

**Closet Share**
- Enable/disable toggle
- 24-hour time-block selector (enable sharing during specific hours)
- Max shares per day slider (1–9000)
- Price filter (min/max, optional)

**Community Share**
- Enable/disable toggle
- Daily limit slider (1–9000)

**Re-list**
- Enable/disable toggle
- Hourly rate control
- 24-hour time-block selector
- Max relists per day (cap: 200)
- Age threshold filter (list only items older than N days)
- Likes threshold filter (min likes before relisting)
- Price filter (min/max)

**Offer to Likers**
- Enable/disable toggle
- 15-minute enforced delay between offers (platform-imposed)
- Multi-rule support with "Add New Rule" button
- Per rule: discount %, optional shipping offer, 6 item-level filters (price, likes, age, category, size, brand)

**Posh Parties Sharer**
- Enable/disable toggle
- Day session limit (up to 250 shares)
- Evening session limit (up to 1000 shares)
- Loop option (repeat sharing within session)
- Category filter (target specific party categories)

**Return Share**
- Enable/disable toggle
- Daily return-share limit (1–1000)
- Shares per return event (1–10)

**Return Follow**
- Enable/disable toggle only. No additional controls.

**Follow New Closets**
- Enable/disable toggle
- Daily follow limit (1–9000)

**Bundle Creation**
- Enable/disable toggle
- Minimum likes threshold before bundle offer
- Default comment text field
- Multi-rule support with "Add New Rule" button
- Per rule: discount %, 5 item-level filters (price, likes, age, size, brand)

### Billing page
- Active subscriptions: Crosslisting Trial + Poshmark Automation Trial
- Both show as Trial status with Unlimited quota
- No credit card on file for either trial
- No pricing tiers shown — trials bypass billing screen

### Remaining gaps
- Pricing grid for Poshmark Automation (monthly vs annual) not visible during trial — no card on file, no upgrade CTA with price shown
- eBay, Mercari, Depop automation configs not accessible (separate subscription required per platform)
- Mobile app automation controls may differ from web — not inspected

---

## OneShop

### Access state
- **Before trial:** "Dashboard not accessible during this research session (login required)" — entire product was a black box.
- **After trial:** Logged in as phone account +15874320514. Account is on the **free tier** — no Premium subscription was activated. Bot/automation routes all redirect to `/u/settings` paywall. Core navigation (Home, Crosslisting, Orders, Connections) is accessible.

> Note: The user provided login credentials but no Premium trial was activated. The findings below reflect what the free tier exposes plus route architecture discovered via Next.js build manifest.

### Navigation structure
Top-level nav items (React div onClick handlers, not anchor elements):
- **Home** — dashboard with connected platforms count, goals tracker, rankings, recent sales
- **Crosslisting** (`/u/listings`) — import listings, draft management, autofill, filter tabs (All/Draft/Published/Delisted)
- **Orders** (`/u/orders`) — pending orders, shipping label generation
- **Institution Accounts** (`/u/institution-accounts`) — Mercari web login only on free tier; Poshmark/eBay/others shown as locked
- **Settings** (`/u/settings`) — subscription/upgrade page, notification prefs, connected platforms

### Bot route architecture (from `__BUILD_MANIFEST`)
Bot sub-routes follow pattern `/u/bots/[institution]/[bot-type]`. Confirmed sub-pages per institution:
- `account-shares` — closet sharing bot
- `follows` — follow/unfollow bot
- `offer-to-likers` — OTL automation
- `otl-listings` — OTL listing management
- `relisting` — auto-relist bot
- `share-order` — share sequencing

All 6 redirect to `/u/settings` paywall on the free tier. The `[institution]` parameter maps to connected marketplaces (poshmark, mercari, ebay, depop, etc.).

### Home dashboard (free tier)
- Shows "4 Enabled" (connected platforms count)
- Goals panel with weekly targets
- Rankings section (community percentile)
- Sales data visible at high level
- "best hands-free Poshmark bot" and "Only crosslisting product with autodelisting" marketing copy inline

### Crosslisting page (`/u/listings`)
- Import from URL, file upload, or existing listing
- Autofill from listing data
- Filter tabs: All / Draft / Published / Delisted
- No platform-specific configuration visible without Premium

### Premium subscription
- Single tier (no Free/Pro/Business tiers)
- Pricing not shown in DOM on free tier — only "Try monthly" CTA visible
- No trial activation confirmed from this session — account remained on free tier

### Remaining gaps
- All bot/automation configuration panels (behind Premium paywall — not accessible without active subscription)
- Premium monthly price (DOM shows "Try monthly" CTA but no figure in page text)
- Analytics section (not present in nav on free tier)
- Crosslisting publish flow controls (require at least one platform connected with Premium)
- AI/autofill capabilities beyond the "Autofill" button label

---

## Nifty Bundle Pro

### Access state
- **Before trial:** Automation config sub-routes `/automation/poshmark/*` returning 404. Otto AI and Analytics Insights inaccessible or error-throwing. Smart Credits locked.
- **After trial:** BUNDLE_II subscription (= Bundle Pro, $89.99/mo), status TRIALING, trial ends 2026-04-24. Automation page fully accessible. Analytics Insights working. Otto accessible.

### Automation route clarification
`/automation/poshmark/shares`, `/automation/poshmark/offers`, etc. — **these are confirmed 404s. They do not exist as routes.** The prior documentation of these as gaps was accurate. The actual automation interface lives entirely at `/automation` (singular, no platform sub-path). All automation type selection and configuration opens inline on that single page.

### Automation controls

**Poshmark**
- Blocked by "not connected" account requirement (connection, not paywall)
- Available when connected: Closet Shares, OTL, Relists (inferred from UI labels visible in locked state)

**eBay Offers**
- Enable/disable toggle
- Price base selector: Current price or Original price
- Discount % input
- Advanced options toggle (expands per-rule configuration)
- Multi-rule support per item criteria
- "Include personal message" text field per rule

**eBay Recreates**
- Enable/disable toggle
- Days-approaching selector (default: 30 days before listing expires)
- Daily limit input (default: 100)
- Price adjustment % on recreate

**Mercari Offers**
- Enable/disable toggle
- Base price selector (current vs original)
- Wait delay between offers (default: 10 minutes)
- Discount % input
- Waterfall offers toggle (progressively lower offers over time)

**Mercari Relists**
- Enable/disable toggle
- Age threshold (default: 30 days — relist items older than this)
- Daily limit input
- Price adjustment % on relist

**Depop**
- Both Offers and Relists show "not connected" — requires Depop account connection
- Controls not inspectable in disconnected state

### Otto AI
- Accessible on BUNDLE_II subscription
- Current tier display: "Free tier · 0%" (Otto has its own internal tier separate from Nifty subscription)
- `isOttoBetaUser: false` (confirmed via SSR hydration data)
- Interface: chat UI with preset prompt buttons
- Sub-tab: `/otto/chats` for conversation history
- Smart Credits "Buy more" button: gated to Otto beta users only — not accessible on this account despite BUNDLE_II subscription

### Analytics
- `/analytics` route loads fully with real account data
- Metrics visible: 289 listings, 2 sold, 0.7% sell-through rate, $28 revenue, $20.10 profit
- Charts: marketplace breakdown, time-series sales
- Previous Insights 404 finding: **the Insights tab IS `/analytics`** — there is no `/analytics/insights` sub-route. The prior 404 was for a path that never existed.

### Remaining gaps
- Poshmark automations: blocked by missing account connection, not subscription — controls not inspectable without a connected Poshmark account
- Depop automations: same — not connected
- Otto beta features (Smart Credits "Buy more", advanced Otto controls): gated to `isOttoBetaUser: true` accounts — not accessible on Bundle Pro alone
- Whatnot / Facebook / Grailed automations: not present in automation UI (platform coverage limited to eBay, Mercari, Poshmark, Depop on web)

---

## Vendoo

### Access state
- **Before trial:** All four v2 automation routes (`/v2/automations/mapping-rules`, `/v2/automations/pricing-rules`, `/v2/automations/marketplace-defaults`, `/v2/automations/shopify`) redirected to `/login` — documented as paywall-gated.
- **After trial:** Pro trial active ($59.99/mo, ends 2026-05-03, set to cancel). All four routes **still redirect to `/app/?`** — not unlocked by Pro tier.

### v2 route status — confirmed

| Route | With Pro Trial | Notes |
|---|---|---|
| `/v2/automations/mapping-rules` | Redirect to `/app/?` | Not unlocked |
| `/v2/automations/pricing-rules` | Redirect to `/app/?` | Not unlocked |
| `/v2/automations/marketplace-defaults` | Redirect to `/app/?` | Not unlocked |
| `/v2/automations/shopify` | Redirect to `/app/?` | Not unlocked |

Direct navigation to `https://web.vendoo.co/v2/` redirects to `enterprise.vendoo.co/v2/inventory` — a separate Firebase deployment returning a 404 "No index.html" page. The v2 app is a separate frontend application entirely.

### Tier architecture (from Gatsby chunk map `window.___chunkMapping`)
The JS bundles for all v2 routes exist in the Pro-tier Gatsby build:
- `component---src-pages-v-2-automations-auto-offers-tsx`
- `component---src-pages-v-2-automations-mapping-rules-tsx`
- `component---src-pages-v-2-automations-pricing-rules-tsx`
- `component---src-pages-v-2-automations-shopify-tsx`

The chunks exist client-side but server-side route guards redirect before rendering. This confirms the v2 UI is built and functional — it simply requires a higher tier than Pro to access via the standard `web.vendoo.co` domain.

### Pro tier — what IS included
From the trial dashboard:
- Unlimited Items
- 11 marketplaces
- Sale Detection
- Bulk Actions (bulk delist, relist, price change)
- Auto Offers (accessible in current `/app/` UI — not the v2 version)
- Marketplace Sharing
- 1500 background removals/month
- Listing Videos

### Pricing tiers (from pricing page)
- **Starter** ~$14.99/mo — limited items, basic crosslisting
- **Pro** $59.99/mo — unlimited items, 11 marketplaces, bulk actions, auto offers
- **Business** — not publicly priced on standard pricing page; likely the tier unlocking v2 routes
- **Enterprise** — `enterprise.vendoo.co` separate deployment; v2 routes live here

### Remaining gaps
- v2 automation routes require Business or Enterprise tier — price and exact feature delta unknown (Business tier not publicly priced)
- `/v2/automations/mapping-rules` — mapping rule controls unknown
- `/v2/automations/pricing-rules` — pricing rule controls unknown
- `/v2/automations/marketplace-defaults` — per-marketplace default settings unknown
- `/v2/automations/shopify` — Shopify-specific sync controls unknown
- Enterprise tier capabilities and pricing entirely opaque (separate app)

---

## Summary — gaps closed vs remaining

| Competitor | Key gaps closed | Still locked |
|---|---|---|
| PrimeLister | All 10 automation panel control sets documented | Pricing grid, per-platform tiers (eBay/Mercari/Depop automation subs) |
| OneShop | Full route map, bot sub-route architecture, nav structure, free-tier UI | All bot configs (Premium required), Premium price not in DOM |
| Nifty Bundle Pro | eBay/Mercari automation controls, Otto AI UI, Analytics confirmed working, /automation/poshmark/* confirmed as non-existent routes | Poshmark/Depop configs (not connected), Otto beta features |
| Vendoo | v2 routes confirmed NOT unlocked by Pro, separate enterprise deployment confirmed, Pro feature set documented | All v2 automation controls (Business/Enterprise tier required) |
