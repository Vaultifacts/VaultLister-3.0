# Competitor Extension Popups + Flyp Web App Sub-Tabs
**Date:** 2026-04-19  
**Method:** Live browser audit via `mcp__claude-in-chrome` (user's Chrome, real logins). Extension files read from disk where popup rendering failed.

---

## Findings Summary

| Extension | Has Popup | Profile | Notes |
|-----------|-----------|---------|-------|
| PrimeLister | Yes (`popup.html`) | Default | Full side-panel tool, Plasmo framework |
| Crosslist Magic | Yes (`popup.html`) | Profile 3 | Platform selector + checkboxes |
| SellerAider | Yes (`popup.html`) | Profile 3 | Login gate → Home with 4 actions |
| Flyp Crosslister | No popup | Profile 3 | Content-script only, no action popup |
| Flyp Bot Sharer | No popup | Profile 3 | Content-script only, no action popup |
| Vendoo | No popup | Profile 3 | Content-script only, injects into marketplace pages |

---

## 1. PrimeLister (v2.0.125) — Default Profile

**Extension ID:** `eepbhjeldlodgnndnjofcnnoampciipg`  
**Popup:** `popup.html` → loads `popup.cc3817b7.js` (Plasmo framework, React)  
**Side panel:** `panel.6bd34c46.js` — the main UI surface  

### Route / Page Structure
Routes extracted from `router.8c53223e.js`:
- `/` → home
- `/dashboard`
- `/account` → login/auth
- `/account/check-permission`
- `/account/cookies`
- `/listings` → listing management
- `/listings/mappings` → field mapping config
- `/queue` → active task queue
- `/tasks/task-record` → task history log
- `/profile`

### The 19+ Actions (extracted from `panel.js`)

**Poshmark Automations:**
- Share to Followers
- Share to Party
- Auto Party Share (scheduled)
- Return Share
- Follow Fresh Closets
- Follow Just Joined
- Return Follow
- Offer to Likers
- Auto Offer to Likers
- Send Offer / Send Offer to All Listings
- Organize Closet
- Hide Poshmark Banner (UI toggle)

**Cross-platform:**
- Cross-list (create listing on other platforms from Poshmark inventory)
- Relist
- Delist / Auto-Delist
- Duplicate
- Delete from Inventory
- Import
- Bulk Price Update
- Enhance-Listing (AI listing improvement)

**Settings/Account:**
- Account settings
- Extension Settings
- Login to PrimeLister Account / Select which closet to login
- Clear all data / Remove all data
- Poshmark Credentials (US + CA)
- Subscription settings / Crosspost Subscription

### Login Gate
When not connected: `"Click the button below to login to PrimeLister."` with a single login button. Shows `"Select which closet to login"` for multi-closet Poshmark accounts.

### Gating / Plans
- `"Basic "` tier visible
- `"Crosspost Subscription"` — separate add-on for cross-listing
- `"Subscription expired"` / `"Subscribe Now"` states exist
- `"Poshmark Automation Trial"` referenced — timed trial for automation features
- `"Not eligible for crosslisting"` error state for lower-tier accounts

### Activity Log
- Routes `/queue` and `/tasks/task-record` confirm a task queue and history log panel
- `"Remove All"` tasks button
- Status states: Active, Completed, Failed, Pending, In Transit, Cancelled, Delivered

### Platforms Supported (cross-listing)
eBay (US, CA, UK, AU, DE, FR, ES, IT, NL, BE, HK, SG, PH, MY, IN, PL, IE, Motor), Etsy, Depop, Grailed, Facebook, Shopify, Mercari — plus Poshmark as source

### Comparison to Web Dashboard
PrimeLister is extension-only (no web dashboard). The side panel IS the full product. Everything lives in the Plasmo extension panel — inventory, cross-listing queue, all automations, account settings.

---

## 2. Crosslist Magic (v0.0.337) — Profile 3

**Extension ID:** `lkjldebnppchfbcgbeelhpjplklnjfbk`  
**Popup:** `popup.html` → `src/popup.js` (React + jQuery)

### Layout
300px wide × 450px min-height popup. Header with logo + "CROSSLIST MAGIC" title. Root `<div id="root">` renders React component.

### Platform Checkboxes (all verified from source)
| Platform | Checkbox Label |
|----------|----------------|
| Depop | `label:"Depop"` |
| eBay (US) | `title:"eBay United States"` |
| eBay (UK) | `title:"eBay United Kingdom"` |
| eBay (CA) | `title:"eBay Canada"` |
| eBay (AU) | `title:"eBay Australia"` |
| Etsy | `label:"Etsy"` |
| Facebook Marketplace | `label:"Facebook Marketplace"` |
| Facebook Commerce | `label:"Facebook Commerce"` + Catalog ID field |
| Grailed | `label:"Grailed"` |
| Instagram | `label:"Instagram"` |
| Mercari | `label:"Mercari"` + Rectangularize photos toggle |
| Poshmark US | `title:"Poshmark United States"` |
| Poshmark CA | `title:"Poshmark Canada"` |
| Shopify | `label:"Shopify"` + Shop name + Business ID fields |
| Starluv | `label:"Starluv"` (niche platform) |
| Vinted US | `title:"Vinted United States"` |
| Vinted UK | `title:"Vinted United Kingdom"` |
| Whatnot | `label:"Whatnot"` |

### Controls
- **AI Assist toggle** (`id:"ai-assist"`) — AI listing improvement, separate checkbox
- **Rectangularize photos** toggle (Mercari-specific image processing)
- **Show copy icon** toggle (`id:"show-copy-icon"`)
- **Crosslist!** button — primary action
- **Refresh** button — re-reads current page
- Sign-in prompt: `"You are not signed in. Please sign in here."`

### Settings
No separate settings tab — all config is inline in the popup. Settings confirmation: `"Settings have been updated successfully."` toast.

### Navigation
Single-view popup (Home only). No tabs.

### Not Visible / Gated
No automation (no sharing/offers). Purely a copy-paste crosslister — opens target platform forms and fills fields. No subscription UI visible at popup level.

---

## 3. SellerAider (v1.0.8.53) — Profile 3

**Extension ID:** `hoadkegncldcimofoogeljainpjpblpk`  
**Popup:** `popup.html` → `popup.bundle.js` (React, 450×550px)

### Navigation States (View States)
- **View Home** — main action panel (logged-in state)
- **View Log In** — login form
- **View Sign Up** — account creation form
- **View Request Permissions** — browser permissions gate

### Home View Actions (verified from source)
| Action | Status |
|--------|--------|
| Crosslist Listings between all supported marketplaces | Live |
| Bulk delete listings | Live |
| Bulk relist listings | "Soon" (disabled) |
| Copy over all supported product details | Live |
| Debug Log | Dev/troubleshooting button |
| Force Reload (Debug) | Dev button |
| Affiliate Program | Link |
| Start Subscription | Subscription CTA |

### CRITICAL FINDING — Share Closet / Send Offers NOT in popup
Code audit result confirmed: **Share Closet, Relist automation, and Send Offers are not present as popup UI controls**. The popup is a crosslister + inventory manager only. Poshmark sharing bots (if any) are not exposed through this popup.

### Platform Support (confirmed from bundle)
depop, ebay, etsy, facebook, grailed, instagram, mercari, poshmark, shopify, shpock, vestiaire, vinted, whatnot — **13 platforms**

### Subscription Tiers (from feature arrays in source)

**Starter tier features (~5 items):**
- Crosslist Listings between all supported marketplaces
- Bulk delete listings
- Automatic Delisting/Mark sold (of listings tracked in inventory)
- Inventory Management (100 listings per month)
- _(+ 1 unlisted item)_

**Pro/Full tier features (~8 items, superset of Starter):**
- Automatic Delisting/Mark sold
- Inventory Management (Unlimited)
- Get all bots for just $10 per month (Depop, Poshmark, Vinted)*
- All Starter features
- Bulk relist listings (coming soon)
- Automatic Quantity Reduction

### Comparison to Web Dashboard
SellerAider appears extension-only. No separate web dashboard found. All functionality is in the extension popup and content scripts that inject into marketplace pages.

---

## 4. Flyp Crosslister (v1.0.4) — Profile 3

**Extension ID:** `kbflhgfmfbghhjafnjbgpiopcdjeajio`  
**Popup:** None — content-script only extension  
**Files:** `background.js`, `poshmark.js`, `mercari.js`, `facebook.js`, `facebookPage.js`, `mercariPage.js`, `poshmark.js`, `flypWeb.js`

**Finding:** No popup.html and no `action.default_popup` in manifest. This extension injects scripts directly into marketplace listing pages (Poshmark, Mercari, Facebook). It's a companion to the Flyp web app — the web app fills in forms using the extension's page injection scripts.

---

## 5. Flyp Bot Sharer (v1.7.6) — Profile 3

**Extension ID:** `ehicjmkogfjifombjmdinmhpaghfggcd`  
**Popup:** None — content-script only extension  
**Files:** `background.js`, `flypWeb.js`

**Finding:** No popup. Even simpler than the Crosslister extension — just background.js + flypWeb.js. The sharer automation runs from the web app at `tools.joinflyp.com/poshmark` which communicates with this extension to drive Poshmark in the browser.

---

## 6. Vendoo (v3.1.10) — Profile 3

**Extension ID:** `mnampbajndaipakjhcbbaihllmghlcdf`  
**Popup:** None — content-script only extension  
**Platforms injected:** Facebook, Mercari, Depop, Tradesy, Grailed, Poshmark, Etsy, Shopify, Vestiaire Collective, Vinted, eBay UK, plus Vendoo web app itself

**Finding:** The extension patches marketplace listing forms with a single script (`scripts/patch.js` injected via `web_accessible_resources`). All real UI lives at `web.vendoo.co`. The extension is purely a DOM bridge for the web app.

---

## 7. Flyp Web App Sub-Tabs — tools.joinflyp.com

**Account:** @vaultifacts (99-day trial active, 98 days left as of audit)  
**Note:** "We detected you're using Flyp from outside the US. We currently only support US marketplaces." banner shown.

### Top Navigation
`🌎 Crosslister` | `⚙️ Sharer` | `🚚 Orders` | `💰 Offers` | `📊 Analytics`  
Header buttons: **Settings** (dropdown) | **Help** | **Get $10** (referral)

---

### Crosslister Tab (`/my-items`)

**Inventory list view:**
- 57 items total: 1 Draft, 56 Listed, 0 Sold shown in list
- Sort by: Date Created (Newest) — dropdown
- Filter by: Marketplace (All/per-platform)
- Status tabs: All / Draft / Listed / Sold
- Pagination: 10/page, 6 pages
- Per-item row: title, date, price, marketplace badges, status chip, **Actions** button

**Per-item edit form** (`/item/:id`):
- Platform status bar at top: Universal, Poshmark, Mercari, eBay, Depop, Facebook, Etsy
  - Each shows "X fields left" or "Listed ✓" or "Not connected"
- **Universal form** — auto-populates all platform forms
  - Fields: Images (16 max, 8MB), Remove Background button, Title (255 char), Description (1500 char), Brand, Condition, Primary/Secondary Color, SKU, Zip Code, Tags, Quantity, Note to self, Package weight (lb/oz), Package Dimensions, Listing Price, Cost of Goods
  - 2 Save buttons (top and bottom)
  - Created/Last Saved timestamps
- Clicking a platform tab (Poshmark, Mercari, etc.) shows platform-specific remaining fields

**Top-level actions:**
- **Import items** button
- **Create item** button  
- **Bulk Delist & Relist** dropdown button

---

### Sharer Tab (`/poshmark`) — Poshmark Only

**Finding: Sharer is Poshmark-exclusive.** No eBay, Mercari, Depop, or Facebook sharer exists. The tab navigates directly to `/poshmark` with the connected closet name (@vaultifacts).

**Sub-tabs within Sharer:**
`Share` | `Auto-Offers` | `Bulk Offers` | `Follow` | `Community Share`

**Share sub-tab controls:**
- Sharing mode: Scheduled / Continuous / Just once
- Share my items `[N]` time(s) every day
- Wait `[N]` minutes between each full share
- # of schedules
- Schedule #1 [time zone MDT]
- Share: All my closet / Portion of my closet
- Daily shares limit
- Sharing Order: Randomize / Keep current order / Switch order
- Sharing speed: Fast / Slow
- Share to party: Not active (toggle)
- **Start** button
- Activity Logs: Shares Today counter, Captcha Solved Today counter

**Auto-Offers sub-tab controls:**
- Send offer to new likers every `[N]` Minutes
- Discount offer: `[N]`%
- Discounted shipping: No Discount / $4.99 / FREE
- Minimum Price/Earnings filters
- Exclude items listed in the last `[N]` days
- **Start** button
- Activity Logs: Offers Sent Today, Captcha Solved Today

---

### Orders Tab (`/orders`)

**Multi-platform aggregated view.** Platforms shown: Poshmark ✅, eBay ✅, Mercari ✅, Depop ✅, Etsy 🚫 (not connected), Facebook ✅

**Filter controls:**
- Marketplace filter dropdown
- Search box
- Status tabs: All (40) / Pending Shipping / Shipped (3) / Complete (36) / Cancelled (1)

**Per-order row fields:**
- Title
- Sold date
- Marketplace icon
- Status chip (Shipped / Complete / Cancelled)
- "Part of bundle" flag (Poshmark bundles)
- Sold price (bundle total if applicable)
- **Track order** button (opens carrier tracking in new tab)
- **View on [Platform]** button

**Sample orders from account:** 40 total orders across Poshmark (35+), Depop (1), eBay (1)

---

### Offers Tab (`/offers`)

**Multi-platform "Offers to Likers" panel.** One section per marketplace, each independently controlled.

| Platform | Items with new likers | Controls |
|----------|----------------------|----------|
| Poshmark | 0 | Offer % field + Send offers button |
| Mercari | 0 | Offer % field + Send offers button |
| eBay | 0 | Offer % field + Send offers button |
| Depop | 8 | Offer % field + Send offers button |

- **Refresh** button + Last update timestamp
- **Offers Activity Logs** at bottom: "Offers sent to all new likers of 0 items today"

**Default offer:** 10% pre-filled in all fields

---

### Analytics Tab (`/analytics`)

**Date range controls:** MM/DD/YYYY start-end date picker + calendar icon

**Top KPI tiles:**
- Total revenue: $28
- Total profit: $20
- Avg sale price: $14
- # sold items: 2 items
- # of new listings: 13 items

**Charts/sections:**
- Revenue & Profit (combined chart)
- Marketplace Revenue (breakdown by platform)
- Marketplace Profit
- Number of Sold Items by Marketplace
- Average Sale Price by Marketplace
- Top Selling Category
- Top Selling Sub-category
- Sales Map (US state choropleth)

**Action buttons:**
- View/Edit data
- Export data
- "Fill now" (2 items with missing sales data in range)

---

### Settings Dropdown (from header)

Expanded via Settings button (ant-dropdown):
- **Profile**
- **Account connections**
- **Logout**
- `"98 days left in free trial"` (trial status badge)

---

## Cross-Competitor Comparison

| Feature | PrimeLister | Crosslist Magic | SellerAider | Flyp Web |
|---------|-------------|-----------------|-------------|----------|
| Has popup UI | Yes (side panel) | Yes (300px popup) | Yes (450px popup) | N/A (web app) |
| Platform count | 8+ platforms | 18 targets (11 platforms) | 13 platforms | 6 platforms |
| Poshmark sharing bot | Yes (full) | No | No | Yes (full) |
| Auto-offers | Yes | No | No | Yes (4 platforms) |
| Cross-listing | Yes | Yes (core feature) | Yes | Yes |
| Inventory mgmt | Yes | No | Yes (100 or unlimited) | Yes (57 items seen) |
| AI listing assist | Yes (Enhance-Listing) | Yes (AI Assist toggle) | No | No |
| Bulk price update | Yes | No | No | No |
| Orders tracking | No | No | No | Yes (multi-platform) |
| Analytics | No | No | No | Yes (full charts) |
| Activity logs | Yes (queue/task-record) | No | Yes (debug log) | Yes (per-automation) |
| Subscription gate | Yes (Basic + Crosspost) | None visible | Yes (2 tiers) | Yes (trial/paid) |

---

*Audit conducted 2026-04-19. All data sourced from live Chrome extension files and authenticated Flyp session.*
