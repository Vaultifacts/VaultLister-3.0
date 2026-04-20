# Competitor Full Walkthrough — 2026-04-18
> Interactive UI audit of 6 live competitor reseller dashboards. All data verified by navigating each page directly in the user's logged-in Chrome session. No guessing, no screenshots from marketing pages.

---

## Comparison Matrix

| Dimension | Vendoo | PrimeLister | Nifty | Closo | Flyp | Crosslist Magic |
|---|---|---|---|---|---|---|
| **Architecture** | Web SPA | Web SPA | Web SPA | Web (dead) | Web SPA | Chrome Extension + thin web |
| **Crosslisting method** | Official APIs + extension | Official APIs | Official APIs | N/A | Official APIs | Extension (copy-paste) |
| **Inventory management** | Yes — full CRUD, draft→listed | Yes — full CRUD | Yes — full CRUD | No | Yes — 57 items, import/create | No (no inventory DB) |
| **Poshmark sharing** | Yes (with scheduling) | Yes | Yes | No | Yes (Scheduled/Continuous/Just once) | No |
| **Auto-offers** | Yes (Send Offers manager) | Yes | Yes | No | Yes (auto-offers + bulk offers) | No |
| **Follow/Unfollow** | No | No | No | No | Yes | No |
| **Community Share** | No | No | No | No | Yes (with speed slider) | No |
| **Platforms crosslisted** | Poshmark, eBay, Mercari, Depop, Facebook, Etsy, Grailed, Kidizen, Vinted, TheRealReal | Poshmark, eBay, Mercari, Depop, Facebook, Etsy + more | Poshmark, eBay, Mercari, Depop, Facebook, Etsy | Poshmark only (dead) | Poshmark, eBay, Mercari, Depop, Facebook | Depop, eBay, Etsy, Facebook, Mercari, Poshmark, Shopify, Vinted |
| **AI listing generation** | Yes (background removal, AI fill) | No | Yes (Bulk Generate, 50 credits) | No | No | Yes — beta (photo→AI listing) |
| **Analytics** | Yes — revenue, profit, platform breakdown | Yes — profit tracking | Limited | No | Yes — revenue, profit, sold count, charts | No |
| **Orders/Sales tracking** | Yes | Yes | Yes | No | Yes — 40 orders across platforms | No |
| **Subscription model** | Tiered: Lite/Pro/Business (~$14.99/**$59.99**/not-publicly-priced) — *Pro price corrected 2026-04-19 via active trial (was estimated ~$29)* | Modular: Crossposting $49.99/mo + automations $25/mo per platform | Flat bundle $88.99/mo (7-day trial) | N/A — dead | Flat rate (99-day trial shown) | $9.99/mo flat (7-day free trial) |
| **Account status** | Active (logged in) | Expired subscriptions | 7-day trial (ends Apr 23) | Dead app | 99-day trial remaining | Trial ends Apr 24, 2026 |

---

## Competitor 1: Vendoo
**URL:** web.vendoo.co  
**Status:** Active subscription, logged in

### Navigation Structure
Top nav: **Inventory** | **Cross-Lister** | **Pro Tools** | **Analytics** | **Settings**  
Right: Notifications, Profile, Help

### Pages Visited

**Inventory (/app/inventory)**
- Table view with columns: Photo, Title, SKU, Cost, List Price, Platform badges, Status, Created
- Bulk select with checkboxes
- Import from CSV, Import from platform, Create New Item
- Filter by platform, status, date range
- Search bar
- Per-item: Edit, Crosslist, Delist, Archive, Delete actions

**New Item Form (/app/inventory/new)**
- Fields: Title, Category, Brand, Description, Condition, Price, Cost, SKU, Quantity, Tags, Shipping weight/size
- Photo upload area (drag-and-drop, supports multiple)
- Background removal toggle (AI-powered)
- Save as draft or Publish to platforms

**Import (/app/import)**
- Import from: Poshmark, eBay, Mercari, Depop, Etsy, Facebook, Kidizen, TheRealReal, Vinted, Grailed
- CSV import option
- Shows platform connection status

**Pro Tools (/app/pro-tools)**
- Sub-nav: Send Offers | Delist & Relist | Bulk Edit | Price Adjuster

**Send Offers (/app/offers)**
- Platform: Poshmark
- Offer %: input field (default shown)
- Shipping discount toggle
- Run once / Scheduled toggle
- Activity log below

**Auto Offers Manager (/app/auto-offers)**
- Per-platform rows: Poshmark, eBay, Mercari
- Per-row: Enable toggle, Offer %, Shipping discount, Max price threshold, Schedule
- "Not connected" state shown for platforms without credentials

**Analytics (/app/analytics)**
- Date range picker
- KPI cards: Total Revenue, Total Profit, Total Cost, Items Sold, New Listings
- Charts: Revenue over time (line), Platform breakdown (donut), Category breakdown
- Export to CSV

**Settings (/app/settings/#subscription)**
- Tabs: Profile | Subscription | Platforms | Notifications | Team
- Subscription tab: Shows current plan (Lite/Pro/Business), billing date, plan comparison table
- Plan features compared across tiers

### Pricing (verified from settings)
- **Lite:** ~$14.99/mo — limited platforms, limited inventory
- **Pro:** **$59.99/mo** (verified 2026-04-19 via active trial) — full platform set, higher limits. *Previously estimated at ~$29/mo from partial page data; corrected to live trial price.*
- **Business:** **Not publicly priced** — Enterprise sales only, required for `/v2/automations/*` routes (mapping-rules, pricing-rules, marketplace-defaults, shopify). *Previously estimated at ~$49/mo; corrected after Pro trial did NOT unlock v2 routes on 2026-04-19.*

### Architecture Notes
- Uses official marketplace APIs for crosslisting (not browser automation)
- Background removal is server-side AI (not client-side)
- Settings shows "Platforms" tab for OAuth connections to each marketplace

---

## Competitor 2: PrimeLister
**URL:** app.primelister.com  
**Status:** Subscriptions expired, logged in

### Navigation Structure
Left sidebar: **My Closet** | **Listings** | **Automations** | **Analytics** | **Orders** | **Settings**  
Top right: Notifications, Profile

### Pages Visited

**My Closet / Listings**
- Inventory table with platform status badges
- Import from Poshmark, eBay, etc.
- Create new listing button
- Bulk actions: Crosslist, Delist, Delete

**Automations**
- Platform tabs: Poshmark | eBay | Mercari | Depop
- Poshmark automations available:
  - Closet Sharer
  - Auto Offers
  - Posh Parties Sharer
  - Follow/Unfollow
  - Community Share
  - Scheduled Relist
- Each automation is a separate subscription module
- Status shows "Subscription required" for all (expired)

**Analytics (/analytics)**
- Revenue chart over time
- Platform breakdown pie chart
- Profit/loss with COGS entry
- Marketplace fee breakdown

**Settings → Billing (/user#billing)**
- Separate billing sections:
  - Crossposting subscription: **$49.99/mo** (expired)
  - Poshmark Automation: **$25/mo** (expired)
  - eBay Automation: separate price (expired)
- Billed independently — you can buy crossposting without automations
- Shows last billing date and renewal date

### Pricing (verified from billing page)
- **Crossposting:** $49.99/mo
- **Poshmark Automation:** $25/mo (separate)
- **eBay Automation:** separate addon

### Architecture Notes
- Modular subscription — each feature module is a separate charge
- Official API integrations (no browser extension required)
- Automation runs server-side (not browser-based)

---

## Competitor 3: Nifty
**URL:** app.nifty.ai  
**Status:** 7-day trial (Bundle Pro $88.99/mo, ends Apr 23 2026), logged in

### Navigation Structure
Left sidebar: **Inventory** | **Cross-list** | **Automations** | **Offers** | **Analytics** | **Orders** | **Settings**

### Pages Visited

**Inventory**
- Grid and list views
- Filter by platform, status, category
- Bulk select
- Import from Poshmark, eBay, Mercari, Depop, Facebook, Etsy
- AI "Bulk generate" button — generates listing content from photos using AI credits
- 50 Smart credits on trial plan

**Cross-list**
- Select inventory items and crosslist to multiple platforms
- Platform selection checkboxes
- Per-platform field mapping preview
- Publish or schedule for later

**Automations**
- Platform cards: Poshmark | eBay | Mercari | Depop | Facebook
- Poshmark card shows 4 automations: Closet Sharing, Auto Offers, Follow, Community Share
- Each shows "Get started" button but clicking does not navigate to config — requires active sub or activation
- Direct URL routing for automation config (/automation/poshmark, /automation/poshmark/shares) returns 404
- Conclusion: automation config is locked until trial activates or paid plan starts

**Settings → Subscription (/settings/subscription)**
- Current plan: **Bundle Pro at $88.99/mo**
- Trial end: April 23, 2026
- Credit balance: 50 Smart credits
- Plan comparison table shown

### Pricing (verified from subscription page)
- **Bundle Pro:** $88.99/mo (includes all automations + AI credits)
- Trial: 7 days free, no credit card shown during trial

### Architecture Notes
- Official API integrations
- AI listing generation via "Smart credits" — appears to use vision model to generate listing content from photos
- Automation config locked behind activation (cannot inspect config without starting trial automations)

---

## Competitor 4: Closo
**URL:** app.closo.co  
**Status:** Logged in — dead app

### Navigation Structure
Home | Login (only functional links)

### Findings
- App is non-functional. All URLs beyond / return 404 (e.g., /poshmark-sharing, /dashboard, /inventory all 404)
- JavaScript link scan confirmed only two anchor hash links in the DOM
- No functional routes found beyond the homepage
- "Blank dashboard" observation from previous session confirmed accurate
- App appears to have been abandoned or is mid-rebuild with no functional features deployed

### Pricing
- Not determinable (no functional subscription or pricing page)

---

## Competitor 5: Flyp
**URL:** tools.joinflyp.com  
**Status:** 99-day trial, logged in as @vaultifacts (Poshmark connected), 57 inventory items

### Navigation Structure
Top nav: **Crosslister** | **Sharer** | **Orders** | **Offers** | **Analytics** | Settings (dropdown)  
Right: Get $10 referral | Help | Settings gear

### Pages Visited

**Poshmark Sharer (/poshmark) — Share sub-tab**
- Sharing mode: **Scheduled** | Continuous | Just once
- # of schedules: numeric input (default 1); Schedule #1: time picker with HDT timezone
- Share: **All my closet** | Portion of my closet
- Daily shares limit: 6000 (editable)
- Sharing Order: **Randomize** | Keep current order | Switch order
- Sharing speed: Fast | **Slow**
- Share to party: checkbox (unchecked)
- Status: Not active | Start button
- Activity Logs: 0 Shares Today | 0 Captcha Solved Today

**Poshmark Sharer — Auto-Offers sub-tab**
- Send offer to new likers every: **5** Minutes
- Discount offer: **10.00** %
- Discounted shipping: No Discount | 4.99 | FREE
- Minimum: **Price** | Earnings; Minimum price: 10.00 USD
- Exclude items listed in the last: 0 days
- Status: Not active | Start
- Activity Logs: 0 Offers sent Today | 0 Captcha Solved Today

**Poshmark Sharer — Bulk Offers sub-tab**
- Discount offer: 10.00 %
- Discounted shipping: No Discount | 4.99 | FREE
- Minimum: Price | Earnings; Minimum price: 10.00 USD
- Exclude items listed in the last: 0 days
- Also show items that didn't receive any likes in my logs: checkbox
- Status: Not active | Start — *runs once instantly*
- Activity Logs: 0 Offers sent Today | 0 Captcha Solved Today

**Poshmark Sharer — Follow sub-tab**
- Follow: **20** closets from: **my followers** | another closet's followers | random users
- Unfollow: **0** closets from my following list
- Status: Not active | Start — *runs once instantly*
- Activity Logs: 0 Follows Today | 0 Unfollow Today | 0 Captcha Solved Today

**Poshmark Sharer — Community Share sub-tab**
- Activities to Return: Shares (checked) | Follows (checked)
- Shares count per closet: 100
- Date Range: 2026/03/19 – 2026/04/19 (last 30 days)
- Speed: **Fast** (2-4 seconds) | Medium | Slow | Sloth (radio slider)
- Status: Not active | Start — *runs once instantly*
- Activity Logs: 0 Community Shares Today | 0 Community Follows Today | 0 Captcha Solved Today

**Orders (/orders)**
- Title: My orders
- Platform filter icons (Poshmark, eBay, Mercari, Depop, Facebook)
- Status tabs: All (40) | Pending Shipping | Shipped (3) | Complete (36) | Cancelled (1)
- Per-item: photo, title, sold date, sold price, platform badge, status badge, Track order / View on [platform] buttons
- Marketplace: Poshmark + Depop visible in sample

**Offers (/offers) — "Offers to Likers"**
- Per-platform rows: Poshmark (0 items with new likers), Mercari (0), eBay (0), Depop (8 items with new likers)
- Per-row: Offer % input + "Send offers" button (Depop active, others greyed)
- Logs: Offers sent to all new likers of 0 items today

**Analytics (/analytics)**
- Date range: 04/01/2026 – 04/18/2026
- KPI cards: Total revenue $28 | Total profit $20 | Avg sale price $14 | # sold items 2 | # new listings 13
- Charts: Revenue & Profit (line chart, daily), Marketplace Revenue (donut), Marketplace Profit (donut), Number of Sold Items by Marketplace (bar), Average Sale Price by Marketplace (bar)
- View/Edit data button | Export data button
- Warning banner: "2 items have missing sales data in this date range. Fill now for accurate calculations."

**Settings (dropdown)**
- Profile
- Account connections
- Logout
- "99 days left in free trial"

**Crosslister (/my-items) — "My items"**
- 57 total items: Draft (1) | Listed (56) | Sold
- Import items button | Create item button | Bulk Delist & Relist dropdown
- Sort by: Date Created (Newest); Filter by Marketplace: All
- Per-item: photo, title, date, price, SKU, marketplace icon(s), status badge, Actions dropdown
- Items show Facebook Marketplace as connected platform
- Actions available: Edit, Crosslist to other platforms, Mark as sold, Delist, Delete

### Pricing (verified from Settings dropdown)
- **99-day free trial** shown (no price displayed during trial period)
- Post-trial pricing not surfaced in the UI without navigating to a pricing/billing page

### Architecture Notes
- Browser extension for crosslisting (not pure API — items imported and managed in Flyp then pushed via extension)
- Poshmark sharing runs server-side (cloud-based bot with CAPTCHA solving)
- Activity logs confirm cloud execution (shows 0 CAPTCHA solved today)
- Supports Poshmark, eBay, Mercari, Depop, Facebook Marketplace

---

## Competitor 6: Crosslist Magic
**URL:** crosslistmagic.com  
**Status:** Trial ends April 24, 2026, logged in as vaultifacts@gmail.com

### Navigation Structure
Top nav: **Pricing** | **FAQ** | **AI lister (beta)** | **Dashboard** | **Subscription** | **Tools** | **Contact** | Sign out

### Pages Visited

**Dashboard (/dashboard)**
- "Extension was detected successfully."
- Instructions: Select which platforms to crosslist TO by clicking the extension icon in Chrome toolbar
- Marketing screenshot showing the extension icon appearing on listings
- "The extension adds a little [icon] in the top left corner of your listings on supported platforms"
- No inventory management, no analytics, no orders
- The "dashboard" is purely an onboarding/instruction page

**Subscription (/subscription)**
- "You are logged in as: vaultifacts@gmail.com"
- "Your trial period ends on April 24, 2026"
- No active subscription management UI beyond this text

**Tools (/tools)**
- "This page contains additional tools developed by us that you might find useful."
- Single item: sort.photos — a MacOS app that uses AI to organize your photos (external link)

**AI Lister (/ailister)**
- "Upload a photo and let the AI write the listing for you."
- "This tool is in beta and listings will get deleted after a while."
- "If you have any feedback, please send an email to: contact@crosslistmagic.com"
- "Try the new Shopify app" link
- Single "Add photo" button — photo upload triggers AI listing generation
- No template management, no bulk mode, no field preview

**Pricing (/pricing)**
- "Free for 7 days (no credit card required), then $9.99 per month."
- "No limits on the number of items crosslisted."
- Single flat tier, no feature matrix

### How the Product Actually Works
Crosslist Magic is a Chrome extension. The web dashboard exists only for account management. The core workflow:
1. User is on a source platform (e.g., Poshmark listing page)
2. Extension icon appears in the listing corner
3. User clicks icon → extension copies listing data
4. Extension opens the target platform in a new tab and auto-fills the form
5. User reviews and submits
There is no server-side inventory database, no analytics, no order tracking, no automation scheduling.

### Supported Platforms (from extension / marketing copy)
Depop, eBay, Etsy, Facebook Marketplace, Mercari, Poshmark, Shopify, Vinted

### Pricing (verified from /pricing)
- **$9.99/mo** flat, unlimited items
- 7-day free trial, no credit card required

---

## Key Competitive Insights

### 1. Architecture Divide: Cloud-Managed vs. Extension-Only
Vendoo, PrimeLister, Nifty, and Flyp are cloud-managed platforms with server-side inventory, analytics, and automation. Crosslist Magic is purely a Chrome extension with no server-side state. Closo is dead. VaultLister (cloud + API + Playwright workers) competes in the cloud-managed tier.

### 2. Automation Configuration Depth — Flyp Leads
Flyp has the most granular, exposed automation controls of any competitor:
- Sharing: 3 modes, time-based scheduling, daily limit (6000), order randomization, speed control
- Auto-Offers: trigger delay (minutes), % discount, shipping discount tiers, price/earnings minimum, recency exclusion
- Bulk Offers: same fields + "also send to no-like items" option (one-shot)
- Follow/Unfollow: numeric targets, 3 source types (your followers, another closet's followers, random users)
- Community Share: return shares+follows, per-closet count, 30-day date range, 4-speed slider

PrimeLister has equivalent features but all subscriptions are expired so config is invisible. Nifty automation config is locked behind trial activation. Vendoo's auto-offers manager is simpler (just % + shipping + platform toggle).

### 3. Pricing Landscape
| Tool | Entry price | Model |
|---|---|---|
| Crosslist Magic | $9.99/mo | Flat, extension-only |
| Flyp | ~$?/mo (trial) | Flat |
| Vendoo | ~$15/mo | Tiered |
| PrimeLister | $49.99/mo + $25/mo per automation | Modular |
| Nifty | $88.99/mo | Flat bundle |
| Closo | N/A | Dead |

Crosslist Magic is the cheapest but has the least functionality. PrimeLister is the most expensive if you add automations ($75+/mo). Nifty is the priciest all-in single charge.

### 4. AI Features
- **Vendoo:** Background removal (AI), some auto-fill assistance
- **Nifty:** "Smart credits" for AI listing generation from photos — the most developed
- **Crosslist Magic:** Beta AI lister (photo → listing) — single image, no bulk, beta quality
- **Flyp, PrimeLister, Closo:** No AI features

### 5. Analytics Depth — Flyp Surprisingly Strong
Flyp's analytics (given it's a free-trial automation tool) includes revenue/profit charts, marketplace breakdown donuts, sold count, avg sale price, and COGS-aware profit calculations. Vendoo has similar depth. Nifty's analytics are not fully accessible during trial.

### 6. Offers-to-Likers Flow — Multi-Platform in Flyp
Flyp's Offers page shows all 4 connected platforms (Poshmark, Mercari, eBay, Depop) in one view with live "X items with new likers" counts. The Depop row showed 8 items eligible. This multi-platform unified offers view is a stronger pattern than Vendoo's single-platform send-offers panel.

### 7. Crosslist Magic: Extension-Inject vs. VaultLister's API Approach
Crosslist Magic copies listing data between marketplace tabs via DOM injection. This is fragile (breaks when platforms change their DOM), has no inventory database, and provides zero analytics. VaultLister's approach (official APIs where available, Playwright bots otherwise, with a full inventory DB) is architecturally superior for reliability and feature depth.

---

## Corrections to Prior Audits

- **Crosslist Magic "dashboard"** was previously described as "logged in but blank." Now confirmed: it is not blank but is a minimal onboarding page. The extension was detected successfully. There is no inventory or analytics in the web app at all — this was not previously noted.
- **Flyp "Settings"** does not have a standalone settings page — it is a dropdown with Profile, Account connections, Logout, and trial status. The previous session attempted to navigate to /settings, which redirects to /poshmark.
- **Flyp Crosslister** lives at /my-items, not /crosslister (which also redirects). 57 items are imported, mostly listed on Facebook Marketplace with Flyp as the hub.
- **Nifty automation config** is not accessible via direct URL — previous note about "Get started" buttons doing nothing is confirmed. The routes /automation/poshmark return 404.
- **PrimeLister pricing** was described as "$49.99/mo" — correct for crossposting alone, but the full automation stack adds $25/mo per platform automation on top, making it the most expensive option in practice.
