# VaultLister 3.0 — Master QA Findings
**Created:** 2026-04-05 | **Compiled from:** 14-session Chrome walkthrough (35+ pages), source code audit, post-walkthrough session testing
**Launch Scope:** Canada only | **Platforms at launch:** eBay, Poshmark, Facebook, Depop, Whatnot

---

## FIXED THIS SESSION

Four bugs discovered and fixed in the post-walkthrough live testing session (2026-04-05).

| # | Severity | Component | Description | Commit |
|---|----------|-----------|-------------|--------|
| 186 | HIGH | Vault Buddy / API Routes | Vault Buddy chat GET 404 after POST 201 — route regex `[a-f0-9-]+` didn't match `conv_TIMESTAMP_HEXSUFFIX` ID format. Both GET and DELETE routes were broken. Fixed by changing regex to `[\w-]+`. | `5a7c6c0` |
| 187 | HIGH | Auth / Social Login | Google OAuth "Continue with Google" was a dead stub — `handlers.socialLogin()` showed a toast warning instead of calling the backend. Backend was fully implemented. | `cf7345e` |
| 188 | MEDIUM | Auth / Social Auth | Social auth initiation blocked by auth middleware — `GET /api/social-auth/:provider` returned 401 for unauthenticated users due to missing public endpoint exemption. | `2226ae3` |
| 189 | LOW | Build / Cloudflare CDN | Cloudflare CDN caching stale bundle after deploy — `index.html` version hash (`87960710→d844d3ce`) wasn't committed alongside `core-bundle.js`, so Cloudflare kept serving old bundle. | `457a85a` |

---

## HEADER SUMMARY

### Counts by Severity

| Severity | Walkthrough Findings | Code Audit Findings | Post-Session Finds | Grand Total |
|----------|---------------------|--------------------|--------------------|-------------|
| CRITICAL | 22 | 5 | 0 | **27** |
| HIGH | 44 | 8 | 2 (both FIXED) | **54** |
| MEDIUM | 64 | 10 | 1 (FIXED) | **75** |
| LOW | 45 | 2 | 1 (FIXED) | **48** |
| COSMETIC | 10 | 0 | 0 | **10** |
| **TOTAL** | **185** | **25** | **4** | **214** |

> Note: Some code audit findings overlap with walkthrough findings (e.g., rate limiter disabled appears in both). Where findings are duplicates, both are preserved since they were discovered independently and provide complementary detail (code location vs. user-visible impact).

### Counts by Status

| Status | Count |
|--------|-------|
| OPEN | 210 |
| FIXED (with commit) | 4 |
| **TOTAL** | **214** |

---

## PART 1 — WALKTHROUGH FINDINGS (Findings #1–#185)

Discovered across 14 sessions of Chrome-based testing (70/70 pages, 41 modals, all CTA buttons, dark mode, responsive, form interactions, error states).

---

### CRITICAL — OPEN

| # | Page / Component | Issue | Session |
|---|-----------------|-------|---------|
| CR-1 | Auth | `checkLoginAttempts()` in auth.js:105-107 always returns `{locked: false}` — brute force protection completely bypassed | Session 1 |
| CR-2 | Platform Integrations | `OAUTH_MODE` defaults to `'mock'` — if not set in Railway `.env`, all platform integrations use fake tokens. 32 files reference this var | Session 1 |
| CR-3 | Plans & Billing / Stripe | "Upgrade to Pro" / "Upgrade to Business" buttons will fail — `STRIPE_PRICE_ID_*` not set in Railway | Session 1 |
| CR-4 | Shipping | Shipping integration uses deprecated Shippo, not EasyPost. EasyPost API key under anti-fraud review | Session 1 |
| CR-5 | eBay Integration | No eBay bot in `worker/bots/` — cross-listing to eBay via bot is impossible | Session 1 |
| CR-6 | Market Intel | "Vintage Denim HOT 92", "Designer Bags HOT 87", "vintage levis 2.4k +15%" are all hardcoded fake data (**Fixed in later session per dark mode pass — shown as N/A**) | Session 1 |
| CR-7 | Help / Getting Started | Help page shows 2/5 steps complete (40%) for brand new users who haven't done anything | Session 1 |
| CR-8 | Help / Knowledge Base | Help page shows "1,240 views", "980 views" — no real KB exists | Session 1 |
| CR-9 | Analytics | Sales Funnel "Views 50" is hardcoded fake data | Session 1 |
| CR-10 | My Shops | All 9 "Connect" buttons — none have working OAuth flows | Session 1 |
| CR-11 | Predictions | Entire page is hardcoded fake data — "Vintage Levi's 501 $45→$62", "Nike Air Max 90 $120→$145", "77% Model Confidence", fake AI confidence scores 87%/82%/75% | Session 2 |
| CR-12 | Predictions | "6 items analyzed" shown when user has 0 items — fabricated count | Session 2 |
| CR-13 | Changelog | All version dates are wrong — v1.6.0 "Jan 26", v1.0.0 "Nov 30" — product didn't exist then. Fabricated changelog | Session 2 |
| CR-14 | Affiliate | "Apply Now" with 30% commission, $50 payout — no affiliate backend built | Session 2 |
| CR-15 | Landing Page | Massive white space gap between hero section and feature cards — layout broken | Session 2 |
| CR-16 | Predictions | (Confirmed duplicate of CR-11/CR-12 from Pass 3) — 100% hardcoded fake data: 6 fake items with fake prices, fake AI confidence 77%/87%/82%/75%, fake trend charts | Session 3 |
| CR-17 | Planner | `pages.planner()` function doesn't exist — sidebar nav item is dead. Route registered but no page function defined in any source module | Session 3 |
| #150 | Inventory Import | Import CSV — Parse Data crashes: "Failed to parse data: Cannot read properties of undefined (reading 'get')" — handler calls `.get()` on uninitialized state Map. Core onboarding feature completely broken | Session 6 |
| #151 | SKU Rules | Create SKU Rule crashes: "Failed to create SKU rule: Cannot read properties of undefined (reading 'get')" — same root cause as #150 | Session 6 |
| #160 | Plans & Billing | "Upgrade to Pro" crashes immediately: "Cannot read properties of undefined (reading 'get')" — same crash pattern as #150/#151. Core monetization flow broken | Session 8 |
| #161 | Plans & Billing | "Upgrade to Business" crashes with same error — core monetization flow broken | Session 8 |
| #171 | Calendar | Calendar page fails to render: `ReferenceError: date is not defined` at `pages-deferred.js:7537` — stale bundle variable name. Entire Calendar feature unavailable | Session 11 |

---

### HIGH — OPEN

| # | Page / Component | Issue | Session |
|---|-----------------|-------|---------|
| H-1 | App-wide | 100+ `Math.random()` fallbacks in app.js — fake health scores, prices, percentages throughout if data is missing | Session 1 |
| H-2 | Dashboard / Orders / Offers / Financials / Analytics | All dollar amounts show "$" not "C$" — global currency localization missing for Canadian launch | Session 1 |
| H-3 | My Shops | Mercari/Grailed/Etsy/Shopify show active "Connect" buttons — should be "Coming Soon" for post-launch platforms | Session 1 |
| H-4 | Orders | Shipping Labels button enabled but EasyPost not built — clicking will fail | Session 1 |
| H-5 | Settings | "Enable 2FA" button — STATUS.md marks as Fail | Session 1 |
| H-6 | Dashboard | Massive empty space on scroll — scrolling past dashboard widgets shows huge white void with sidebar detached | Session 1 |
| H-7 | Automations | "Est. at $30/hr" rate hardcoded — should be C$ and user-configurable | Session 1 |
| H-8 | Plans & Billing | Pricing shows USD ($19/$49) not CAD — plans page uses US pricing for Canadian launch | Session 1 |
| H-9 | Plans & Billing | "Upgrade to Premium" (top button) vs "Upgrade to Pro" (plan cards) — naming inconsistency | Session 1 |
| H-10 | Middleware | Rate limiting disabled in production — `rateLimiter.js:27` has `// TODO: disabled during development/testing` always returns `true` | Session 1 |
| H-11 | Login / Auth Pages | Login page gradient seam — blue gradient stops at ~75% width, white strip on right edge | Session 1 |
| H-12 | Database | No SKU unique constraint in live DB — migration 004 exists but may not be applied | Session 1 |
| H-13 | Automations | "83% Success Rate" stale data — shows test run data from development | Session 1 |
| H-14 | Predictions | "Run AI Model" button requires `ANTHROPIC_API_KEY` — will fail silently | Session 2 |
| H-15 | Shipping Labels | "Create Label" and "Compare Rates" buttons present but EasyPost not built | Session 2 |
| H-16 | Connections | Only 6 of 9 platforms shown — missing Etsy, Shopify, Whatnot | Session 2 |
| H-17 | Refer a Friend | Referral link `https://vaultlister.com/signup?ref=VAULTDEMO` — referral backend wiring unclear | Session 2 |
| H-18 | Forgot Password | "Send Reset Link" requires `RESEND_API_KEY`/SMTP — will fail silently | Session 2 |
| H-19 | Help / Support | "Getting Started 2/5 (40%)" hardcoded as complete for new users | Session 2 |
| H-20 | Feedback & Suggestions | "Top Contributor — top 10%" badge shown to user with 0 submissions | Session 3 |
| H-21 | Changelog | All version dates fabricated — v1.6.0 "Jan 26", v1.0.0 "Nov 30" | Session 3 |
| H-22 | Affiliate | Full affiliate page (30% commission, $50 payout) — no backend built | Session 3 |
| H-23 | Shipping Labels | "Create Label" + "Compare Rates" buttons enabled — EasyPost not built | Session 3 |
| H-24 | Connections | Only 6/9 platforms shown — missing Etsy, Shopify, Whatnot | Session 3 |
| H-25 | Forgot Password | "Send Reset Link" requires SMTP — will fail | Session 3 |
| H-26 | Listings | Platform dropdown only shows 6 of 9 platforms — missing Etsy, Shopify, Whatnot | Session 3 |
| H-27 | Listings | "Add New Listing(s)" primary CTA dropdown button has NO onclick handler | Session 3 |
| H-28 | Responsive | Sidebar doesn't collapse on mobile viewport — no hamburger menu visible | Session 4 |
| #123 | Community | `modals.viewPost()` crashes: "Cannot read properties of undefined (reading 'find')" — community post viewing broken | Session 5 |
| #125 | Support Tickets | `modals.viewTicket()` crashes: "Cannot read properties of undefined (reading 'length')" — support ticket viewing broken | Session 5 |
| #126 | Cross-list Modal | Cross-list modal shows Etsy/Mercari/Grailed as active — for Canada launch only eBay, Poshmark, Facebook, Depop, Whatnot should be active | Session 5 |
| #131 | Confirm Dialogs | `modals.confirm()` — danger button invisible in light mode. `btn-danger` has transparent background (`--red-600`/`--error` CSS variable not resolving). Affects all delete confirmations | Session 5 |
| #141 | Inventory | Add Item success triggers "undefined" content in main area — router navigates post-submit but target page function returns undefined. Page crashes after every successful item add | Session 6 |
| #143 | Add Transaction | Modal HTML bleeds into page body — raw HTML attribute text renders visibly below modal: `onclick="event.stopPropagation()" role="document"> Add Transaction` | Session 6 |
| #144 | Submit Feedback | Form simultaneously fires success AND error toasts on valid submission — conflicting UX | Session 6 |
| #148 | Inventory | Inventory search bar fires error toast on any input — even with valid 200 API response | Session 6 |
| #152 | Dashboard | Log Sale crashes: "Failed to log sale: Cannot read properties of undefined (reading 'get')" — same `db.get()` crash as #150 | Session 7 |
| #153 | Orders | Orders Sync crashes: fires success toast then immediate failure: "Cannot read properties of undefined (reading 'get')" | Session 7 |
| #154 | Automations | Export button fires 4+ simultaneous "Export failed" error toasts — no CSV/JSON produced | Session 7 |
| #158 | Reports | Create Report buttons silently do nothing — no modal, no toast, no navigation | Session 8 |
| #170 | My Shops | All Connect modals pre-fill username with hardcoded "demo@vaultlister.com" — users must manually clear field | Session 11 |
| #172 | Calendar | Calendar "Today" and "Week" buttons crash: `ReferenceError: date is not defined` — same stale bundle as #171 | Session 11 |
| #182 | File Upload (DnD) | `sanitizeHTML()` / DOMPurify strips all drag-and-drop event handlers — `ondragover`, `ondragleave`, `ondrop`, `ondragenter`, `ondragstart`, `ondragend` missing from ADD_ATTR allowlist. Drop zones on Add Item modal, Inventory Import, and Image Bank all broken | Session 14 |
| #186 | Vault Buddy | Vault Buddy chat completely non-functional — all operations crash with `undefined.get` error (same root cause as #150). No conversations can be loaded, no new chats can be started | Session 14 |

---

### HIGH — FIXED

| # | Page / Component | Issue | Commit | Session Fixed |
|---|-----------------|-------|--------|---------------|
| 186-new | Vault Buddy / API Routes | Vault Buddy chat GET 404 after POST 201 — route regex `[a-f0-9-]+` didn't match `conv_TIMESTAMP_HEXSUFFIX` format. Both GET and DELETE routes broken. | `5a7c6c0` | Post-session |
| 187-new | Auth / Social Login | Google OAuth "Continue with Google" was a dead stub — `handlers.socialLogin()` showed warning toast instead of calling backend | `cf7345e` | Post-session |

---

### MEDIUM — OPEN

| # | Page / Component | Issue | Session |
|---|-----------------|-------|---------|
| M-1 | Dashboard | "100% Listing Health" shown at 0 listings — should show N/A | Session 1 |
| M-2 | Analytics | Market Trends Radar labels truncated — "intage" (Vintage), "Electron" (Electronics) | Session 1 |
| M-3 | Dashboard / Analytics | "0% Avg Offer" when 0 offers exist — should show N/A | Session 1 |
| M-4 | Analytics | Financial score "30" with no data — should be 0 or N/A | Session 1 |
| M-5 | Analytics | "Consider optimizing costs" advice shown with no data — irrelevant for empty-state users | Session 1 |
| M-6 | Analytics | "Profit margin below target (15%)" warning shown with no sales data | Session 1 |
| M-7 | Analytics / Dashboard | Green "0.0%" up arrows on empty data — KPI cards show green arrow with no prior data to compare | Session 1 |
| M-8 | Settings | Timezone defaults to Eastern, not user's timezone — should auto-detect or default to MST for Calgary launch | Session 1 |
| M-9 | Orders | "More" button truncated to "Mo..." at right edge | Session 1 |
| M-10 | Market Intel | "Your items: 89" hardcoded — should reflect actual inventory count | Session 1 |
| M-11 | Dashboard | "$2,000 goal" hardcoded Monthly Goal — should be user-set or hidden until set | Session 1 |
| M-12 | Help | Keyboard shortcut shows ⌘K (Mac) on Windows | Session 1 |
| M-13 | Image Bank | "5.00 GB free" — unclear if this is actual R2 limit or hardcoded | Session 1 |
| M-14 | Plans | "Cross-list to 3 platforms" on Free plan confusing — only 5 available at launch; Pro says "all 9" but 4 are Coming Soon | Session 1 |
| M-15 | Register / Login | Sidebar visible on register/login page — should be hidden for unauthenticated views | Session 2 |
| M-16 | Sales | "Sales Tax Nexus" — US concept, Canada uses GST/HST/PST | Session 2 |
| M-17 | Transactions | "$0 / $999" filter defaults shown in USD | Session 2 |
| M-18 | Transactions | "All Categorie" dropdown text truncated — missing 's' | Session 2 |
| M-19 | Roadmap | "No features found" — should have planned features pre-populated | Session 2 |
| M-20 | Affiliate | "$50 Minimum Payout" in USD not CAD | Session 2 |
| M-21 | Connections | Chrome Extension "Install Extension" button — destination link unclear | Session 2 |
| M-22 | Landing | "Push listings to all 9 marketplaces" — should say 5 at launch | Session 2 |
| M-23 | Auth Pages | All auth pages (Landing/Login/Register) show gradient seam — white strip at ~75% width | Session 2 |
| M-24 | Size Charts | Measurements in inches (in) — should offer metric (cm) for Canada | Session 2 |
| M-25 | Calendar | "Month" button invisible in dark mode — white text on white background | Session 3 |
| M-26 | Knowledge Base | "No FAQs" + "No articles" — needs basic content before launch | Session 3 |
| M-27 | Report Builder | "Custom Query — Run SQL queries" — security concern if raw SQL exposed to users | Session 3 |
| M-28 | Teams | "Create Team" available on Free plan — needs tier gating | Session 3 |
| M-29 | Roadmap | Empty — needs at least planned features pre-populated | Session 3 |
| M-30 | Sales | "Sales Tax Nexus" — US concept, Canada uses GST/HST/PST (duplicate of M-16) | Session 3 |
| M-31 | Transactions | "All Categorie" truncated dropdown text — missing 's' (duplicate of M-18) | Session 3 |
| M-32 | Transactions | "$0 / $999" filter in USD not CAD (duplicate of M-17) | Session 3 |
| M-33 | Privacy Policy | Contact email "privacy@vaultlister.com" — may not be set up | Session 3 |
| M-34 | Vault Buddy | Chat bubble click does nothing — no chat window opens | Session 3 |
| M-35 | Batch Photo | "Remove Background" and "AI Upscale" require AI backend — unclear error handling | Session 3 |
| M-36 | Privacy (in-app) | "GDPR Compliant" claim — Canada uses PIPEDA, not GDPR. Legal risk | Session 3 |
| M-37 | Calendar (dark) | "Month" view button invisible — white text on white bg in active state in dark mode | Session 4 |
| M-38 | Responsive | 34 mobile breakpoints in CSS but mobile bottom nav absent | Session 4 |
| M-39 | Privacy (in-app) | Claims "GDPR Compliant" — Canada uses PIPEDA. Legal risk (duplicate of M-36) | Session 4 |
| #122 | Templates | `modals.editTemplate()` silent failure — returns without error but no modal opens outside Templates page context | Session 5 |
| #124 | Help Articles | `modals.viewArticle()` fails to open — modal immediately closes or renders in wrong DOM target | Session 5 |
| #129 | Whatnot | `modals.viewWhatnotEvent()` — 3 data bugs: "Invalid Date" start time, "undefined" status badge, blank event title in modal header | Session 5 |
| #142 | Add Transaction | Empty submit shows no validation error — `required` fields but no `<form>` element; state-controlled form bypasses HTML5 validation | Session 6 |
| #143b | Add Transaction | No success feedback on submit — modal closes silently, no toast, no confirmation, no page update | Session 6 |
| #145 | Community | Create Post modal: empty submit shows no validation — required Title/Content fields with no `<form>` wrapper | Session 6 |
| #146 | Calendar | Add Event modal: empty submit shows no validation — required Event Title field with no `<form>` wrapper | Session 6 |
| #147 | Global Search | Search bar in top nav non-functional — typing produces no results, no dropdown, pressing Enter has no effect | Session 6 |
| #149 | Shipping Calculator | Shows USPS carriers with imperial units (lbs/inches) — app targets Canadian sellers, should show Canada Post/Chitchats/Purolator with kg/cm and CAD | Session 6 |
| #155 | Listings / Fee Calculator | Platform Fee Calculator shows wrong platforms — includes Mercari/Etsy (not at launch), missing Whatnot (IS at launch) | Session 7 |
| #159 | Vault Buddy | Vault Buddy auto-opens on every page render — `renderApp()` triggers panel open automatically on every page load; fires "Failed to load conversations" error toast each time | Session 8 |
| #164 | Listings / Fee Calculator | Platform Fee Calculator uses "$" not "C$", includes Etsy fees (not a launch platform) | Session 10 |
| #165 | Automations | "Calendar" toolbar button calls `handlers.showScheduleCalendar()` — no modal opens, no output | Session 10 |
| #166 | Automations | "Performance" toolbar button calls `handlers.showAutomationPerformance()` — no modal opens, no output | Session 10 |
| #167 | Financials | Financials page uses "$" not "C$" for all monetary values | Session 10 |
| #169 | My Shops | 4 non-launch platforms (Mercari, Grailed, Etsy, Shopify) shown with active "Connect" buttons — no "Coming Soon" indicator | Session 11 |
| #173 | Reports | Reports "Create Report" button — no response when clicked | Session 11 |
| #174 | Settings | Settings "Enable 2FA" button — no response when clicked | Session 11 |
| #175 | Plans & Billing | Shows USD pricing ($19, $49) for Canadian launch. Pro plan claims "Cross-list to all 9 platforms" — only 5 at launch | Session 11 |
| #177 | Plans & Billing | "Upgrade to Pro" / "Upgrade to Business" buttons produce no UI response — no toast, no modal, no Stripe redirect | Session 11 |
| #178 | Offline Page | `offline.html` server-redirects to `/` — Service Worker offline fallback broken | Session 13 |
| #180 | Router | Unknown routes while authenticated silently fall back to dashboard — expected 404 page | Session 13 |
| #183 | Error Handling | 401 Unauthorized response does not redirect to login — user stays on current page with silent API failures | Session 14 |
| #185 | Vault Buddy | `toggleVaultBuddy` crashes: `TypeError: pages[store.state.currentPage] is not a function` — calls `pages[currentPage]()` instead of `window.pages[currentPage]()` for deferred chunk pages | Session 14 |

---

### MEDIUM — FIXED

| # | Page / Component | Issue | Commit | Session Fixed |
|---|-----------------|-------|--------|---------------|
| 188-new | Auth / Social Auth | `GET /api/social-auth/:provider` returned 401 for unauthenticated users — missing from public endpoint exemption list | `2226ae3` | Post-session |

---

### LOW — OPEN

| # | Page / Component | Issue | Session |
|---|-----------------|-------|---------|
| L-1 | Login | No "show password" toggle on login | Session 1 |
| L-2 | Login | Green WebSocket indicator dot visible on login page — should be hidden for unauthenticated pages | Session 1 |
| L-3 | Dashboard | "Not yet refreshed" text shown to first-time users | Session 1 |
| L-4 | Dashboard | "Good afternoon, demo!" uses username instead of display_name or full_name | Session 1 |
| L-5 | Inventory | "Low Stock" card highlights in yellow at value 0 | Session 1 |
| L-6 | Inventory | "Stale (90+ days)" label wraps to two lines in stat card | Session 1 |
| L-7 | Settings | "Full Name" empty — registration doesn't collect full name | Session 1 |
| L-8 | Help / Support | "Contact support to change email" — no support channel defined | Session 1 |
| L-9 | Vault Buddy | Chat bubble occludes content — covers "Net" label in financials, "Goal" in analytics | Session 1 |
| L-10 | Backend | Console.log statements in production — ~10 instances in error handlers | Session 1 (Code audit) |
| L-11 | Backend | Fake 555-xxxx phone numbers in supplier data — FCC reserved range, obviously fake | Session 1 (Code audit) |
| L-12 | Market Intel | "Competitor Activity — Live Activity" with green dot suggesting live feed that doesn't exist | Session 1 |
| L-13 | Register | No Full Name or Display Name field in registration | Session 2 |
| L-14 | Refer a Friend | Referral code "VAULTDEMO" hardcoded — should be user-specific | Session 2 |
| L-15 | Terms of Service | "Last updated: March 2026" — should be April 2026 | Session 2 |
| L-16 | Terms / Landing | Logo shows "M" purple circle — should be "V" blue square (brand inconsistency) | Session 2 |
| L-17 | Size Charts | "us US" in dropdown — double "US" label | Session 2 |
| L-18 | Connections | Gmail/Outlook/Cloudinary/Google Drive "Connect" buttons — unclear if functional | Session 2 |
| L-19 | Dashboard | Massive empty space below widgets on scroll — layout/height issue | Session 2 |
| L-20 | Size Charts | "us US" dropdown label — double "US" (duplicate of L-17) | Session 3 |
| L-21 | Size Charts | Measurements in inches — should offer cm for Canada (duplicate of M-24) | Session 3 |
| L-22 | Privacy / ToS | "Last updated: March 2026" — should be April (duplicate of L-15) | Session 3 |
| L-23 | Checklist | "Keep up the momentum!" shown at 0% — odd encouragement for nothing done | Session 3 |
| L-24 | Refer a Friend | "VAULTDEMO" referral code — hardcoded, not user-specific (duplicate of L-14) | Session 3 |
| L-25 | Listings | "Customize" columns button has no onclick handler | Session 3 |
| L-26 | Listings | Announcement banner "✕" close button has no onclick handler | Session 3 |
| L-27 | Connections (dark) | Cloudinary/Anthropic AI toggle buttons nearly invisible in dark mode | Session 3 |
| L-28 | Privacy (in-app) | "Download PDF" button — unclear if it generates a real PDF | Session 3 |
| L-29 | Connections (dark) | Cloudinary/Anthropic toggles nearly invisible (duplicate of L-27) | Session 4 |
| L-30 | Batch Photo | "Remove Background"/"AI Upscale" may not have backend support | Session 4 |
| L-31 | Privacy (in-app) | "Download PDF" button — untested (duplicate of L-28) | Session 4 |
| #127 | Cross-list Modal | "Ebay" brand name misspelled — should be "eBay" | Session 5 |
| #128 | Calendar | Edit Event has "Depends On" field not present in Add Event — inconsistency | Session 5 |
| #130 | Reports | `modals.viewReport()` shows raw ID string instead of report content | Session 5 |
| #132 | Changelog | Version thumbnail cards have light background in dark mode — visual inconsistency | Session 5 |
| #134 | Feedback Analytics | Admin badge does not inherit dark mode | Session 5 (Session 4 dark mode) |
| #135 | Help | Quick Start Guide step 4 text truncates: "Set up automati... to save t..." | Session 5 (Session 4 dark mode) |
| #137 | Privacy Policy (in-app) | Shows "Last updated: January 2026" — static privacy page shows April 5, 2026 | Session 5 (Session 4 dark mode) |
| #138 | Account | Text truncates in narrow card columns: "Member Since: Marc...", "Curre plan" | Session 5 (Session 4 dark mode) |
| #139 | Submit Feedback | Inactive feedback type buttons retain white/light backgrounds in dark mode | Session 5 (Session 4 dark mode) |
| #156 | Analytics | Weekly Report shows same start/end date — "Week of Apr 5 - Apr 5, 2026" | Session 8 |
| #162 | Orders | Orders page "More" button has no onclick handler — dropdown completely inaccessible | Session 10 |
| #176 | Plans & Billing | "Upgrade to Premium" button (Current Plan section) vs "Pro" plan cards — naming inconsistency | Session 11 |
| #179 | Sidebar | Sidebar collapse state not persisted — collapsing does not survive page reload | Session 13 |
| #184 | Error Handling | 429 Too Many Requests shows generic error toast with no retry guidance | Session 14 |

---

### LOW — FIXED

| # | Page / Component | Issue | Commit | Session Fixed |
|---|-----------------|-------|--------|---------------|
| 189-new | Build / Cloudflare CDN | `index.html` version hash not committed alongside `core-bundle.js` — Cloudflare served stale bundle | `457a85a` | Post-session |

---

### COSMETIC — OPEN

| # | Page / Component | Issue | Session |
|---|-----------------|-------|---------|
| CO-1 | Analytics / Dashboard | Green up arrows on 0% changes — should be neutral/gray when no comparison data | Session 1 |
| CO-2 | Analytics | Financial score 30 color (red) — arbitrary default looks alarming | Session 1 |
| CO-3 | Market Intel | "Updated Just now" — misleading when no data has been fetched | Session 1 |
| CO-4 | Register | Password requirement checkmarks not validated live as user types | Session 2 |
| CO-5 | Whatnot Live | Green "0% vs last week" arrows — should be neutral | Session 2 |
| CO-6 | Refer a Friend | Logo shows "V" overlaid on purple — inconsistent with other pages | Session 3 |
| #157 | My Shops | "Connect to Ebay" — should be "Connect to eBay" | Session 8 |
| #163 | Listings / Health | Listing Health modal shows "Poor Health" score 0 AND "All listings have good health scores!" simultaneously — contradictory | Session 10 |
| #168 | My Shops | eBay Connect modal title shows "Connect to Ebay" not "Connect to eBay" | Session 11 |
| #181 | Planner / Sidebar | Sidebar label "Planner" doesn't match page H2 title "Daily Checklist" | Session 13 |

---

## PART 2 — SOURCE CODE AUDIT FINDINGS

Discovered by automated source code scan of `src/`, `worker/bots/` (excluding legacy `app.js` and `core-bundle.js`). Date: 2026-04-05.

---

### CRITICAL — OPEN (Code Audit)

| ID | File:Line | Issue | Code Reference |
|----|-----------|-------|----------------|
| CA-CR-1 | `src/backend/middleware/rateLimiter.js:27-28` | Rate limiting DISABLED for production — `isRateLimitBypassed()` always returns `true`. Zero brute-force, API abuse, or DoS protection. **Fix:** Change `return true` to `return false` or use env gate. | `function isRateLimitBypassed() { return true; }` |
| CA-CR-2 | `src/backend/services/platformSync/imageUploadHelper.js:48,138` | `Math.random()` in production image filenames — temp files are predictable, attackers can guess and access other users' temp images. **Fix:** Use `crypto.getRandomValues()`. | `'c-${Date.now()}-${Math.random().toString(36)}'` |
| CA-CR-3 | `src/backend/routes/ai.js:73,75` | Mercari/Grailed in active AI templates — these are post-launch platforms. Code executes if triggered. **Fix:** Remove or wrap with feature flag. | `mercari: 'Stylish Fashion Item', grailed: 'Designer Streetwear'` |
| CA-CR-4 | `src/backend/db/seeds/demoData.js:383-471` | `Math.random()` in demo order/tracking numbers (7 instances) — non-deterministic demo data. | `order_number: 'PSH-' + Math.random().toString(36).substr(2,8)` |
| CA-CR-5 | `app.js:29521` | "Cross-list to all 6 platforms" — legacy file, stale copy (not served but misleading) | `Cross-list to all 6 platforms` |

---

### HIGH — OPEN (Code Audit)

| ID | File:Line | Issue | Code Reference |
|----|-----------|-------|----------------|
| CA-H-1 | `src/backend/routes/analytics.js:28` | `analyticsRouter()` — no top-level try/catch. Unhandled errors crash route handler. | `export async function analyticsRouter(ctx) {` |
| CA-H-2 | `src/backend/routes/automations.js:25` | `automationsRouter()` — no try/catch | `export async function automationsRouter(ctx) {` |
| CA-H-3 | `src/backend/routes/barcode.js:7` | `barcodeRouter()` — no error boundary | `export async function barcodeRouter(ctx) {` |
| CA-H-4 | `src/backend/routes/checklists.js:6` | `checklistsRouter()` — no try/catch | `export async function checklistsRouter(ctx) {` |
| CA-H-5 | `src/backend/routes/community.js:22` | `communityRouter()` — no error handler | `export async function communityRouter(ctx) {` |
| CA-H-6 | `src/backend/routes/currency.js:3` | `currencyRouter()` — no error boundary | `export async function currencyRouter(ctx) {` |
| CA-H-7 | `src/backend/routes/emailOAuth.js:32` | `emailOAuthRouter()` — no try/catch. **OAuth-critical** — auth flows can crash silently | `export async function emailOAuthRouter(ctx) {` |
| CA-H-8 | `src/backend/routes/extension.js:14` | `extensionRouter()` — no error handler | `export async function extensionRouter(ctx) {` |
| CA-H-9 | `src/backend/routes/ai.js:173,178,183,298,457,820,823,1145,1148` | 9 bare `JSON.parse()` calls in AI route — malformed JSON crashes handler, returns 500 instead of 400 | `analysisData = JSON.parse(responseText);` |
| CA-H-10 | `src/backend/routes/automations.js:62,68,255,261,355,361,456,462` | 8 bare `JSON.parse()` calls on rule objects — unprotected. **Fix:** Use `safeJsonParse(str, {})`. | `rule.conditions = JSON.parse(rule.conditions or '{}');` |

---

### MEDIUM — OPEN (Code Audit)

| ID | File:Line | Issue | Code Reference |
|----|-----------|-------|----------------|
| CA-M-1 | `src/backend/workers/taskWorker.js:1160,1162` | Mercari/Grailed case statements active — should be feature-gated for post-launch | `case 'mercari': return await executeMercariBot(...)` |
| CA-M-2 | `src/frontend/ui/widgets.js:6132,6138,6139,6140` | Supplier metrics use `Math.random()` fallback — fake health/accuracy/delivery/quality scores on prod if data is missing | `Math.floor(Math.random() * 30) + 70` |
| CA-M-3 | `src/frontend/handlers/handlers-tools-tasks.js:344` | Tag randomization uses `Math.random()` | `sort(() => 0.5 - Math.random())` |
| CA-M-4 | `src/frontend/core/utils.js:11-20` | `SUPPORTED_PLATFORMS` lists all 9 platforms — Canada launch = 5 only. **Fix:** Create `LAUNCH_PLATFORMS` filter constant. | Lists poshmark, ebay, mercari, depop, grailed, etsy, shopify, facebook, whatnot |
| CA-M-5 | `src/frontend/handlers/handlers-tools-tasks.js:3803` | Comment says "6 platform presets" — stale | `// 6 platform-specific presets` |
| CA-M-6 | `src/frontend/handlers/handlers-deferred.js:21168` | Comment says "6 platform presets" — stale | `// 6 platform-specific presets` |
| CA-M-7 | `src/frontend/pages/pages-intelligence.js:1826,1914` | "Coming soon" toast messages in production pages | `toast.info('...coming soon.')` |
| CA-M-8 | `src/shared/ai/listing-generator.js:167,180,185,189` | `Math.random()` in template selection (4 instances) — non-deterministic listing generation | `templates.intro[Math.floor(Math.random() * length)]` |
| CA-M-9 | `src/backend/db/demoData.js:383,388,410,415,422,446,471` | 7 `Math.random()` calls in demo seeds for order/tracking numbers — non-reproducible demo data | `order_number: 'PSH-' + Math.random().toString(36).substr(2, 8).toUpperCase()` |
| CA-M-10 | `src/frontend/ui/widgets.js:6132,6138,6139,6140` | Supplier metrics `Math.random()` fallback (duplicate reference with expanded detail) — `healthScore`, `orderAccuracy`, `onTimeDelivery`, `qualityRating` all generate fake "good" values (90-95% range) if DB fields missing | `const healthScore = supplier.health_score \|\| Math.floor(Math.random() * 30) + 70` |

---

### LOW — OPEN (Code Audit)

| ID | File:Line | Issue |
|----|-----------|-------|
| CA-L-1 | `src/backend/db/database.js:328` | TODO comment: "Phase 3: implement tsvector full-text search" — incomplete feature |
| CA-L-2 | `src/backend/middleware/rateLimiter.js:27` | TODO comment: "Re-enable for production release" — advisory only (root issue is CA-CR-1) |

---

## PLATFORM READINESS MATRIX

| Platform | OAuth | Bot | Sync | Launch Status |
|----------|-------|-----|------|---------------|
| **eBay** | Exists (mock) | No bot (API-based, implemented) | eBay sync exists | **NEEDS** real OAuth credentials |
| **Poshmark** | Exists (mock) | ✅ poshmark-bot.js | Poshmark sync | **NEEDS** real OAuth |
| **Facebook** | Exists (mock) | ✅ facebook-bot.js | FB sync | **NEEDS** real OAuth |
| **Depop** | Exists (mock) | ✅ depop-bot.js | Depop sync | **NEEDS** real OAuth |
| **Whatnot** | Exists (mock) | ✅ whatnot-bot.js | Whatnot sync | **NEEDS** real OAuth |
| Mercari | Exists (mock) | ✅ mercari-bot.js | Mercari sync | Coming Soon — code must be feature-gated |
| Grailed | Exists (mock) | ✅ grailed-bot.js | Grailed sync | Coming Soon — code must be feature-gated |
| Etsy | Deferred | None | Exists | Coming Soon |
| Shopify | Incomplete | None | Exists | Coming Soon |

---

## ENVIRONMENT REQUIREMENTS (Railway)

| Variable | Status | Required For |
|----------|--------|-------------|
| `DATABASE_URL` | ✅ Set | PostgreSQL |
| `OAUTH_MODE` | **MUST be `'real'`** | Platform integrations |
| `STRIPE_PRICE_ID_PRO` | ❌ Not set | Paid plan upgrades |
| `STRIPE_PRICE_ID_BUSINESS` | ❌ Not set | Paid plan upgrades |
| `STRIPE_SECRET_KEY` | ❌ Not set | Stripe payments |
| `ANTHROPIC_API_KEY` | ❓ Check | AI listing generation, Vault Buddy |
| `EASYPOST_API_KEY` | ❌ Blocked | Shipping labels (under anti-fraud review) |
| `RESEND_API_KEY` | ❓ Check | Transactional email (forgot password, verification) |
| `EBAY_*` OAuth keys | ❌ Not set | eBay integration |
| `POSHMARK_*` keys | ❌ Not set | Poshmark integration |
| `DISABLE_RATE_LIMIT` | N/A | Rate limiter re-enable gate (see CA-CR-1) |

---

## TOP PRIORITY LAUNCH BLOCKERS

1. **Fix `checkLoginAttempts()`** (CR-1) — implement real brute force protection. Security critical.
2. **Fix `isRateLimitBypassed()`** (CA-CR-1) — change `return true` to `return false`. Security critical.
3. **Set `OAUTH_MODE=real` in Railway** (CR-2) — without this, all 5 launch platforms use fake tokens.
4. **Fix `undefined.get()` crash** (affects #150, #151, #152, #153, #160, #161, #186-walkthrough) — single root cause killing Import CSV, SKU Rules, Log Sale, Orders Sync, Upgrade flows, and Vault Buddy. Highest user-facing impact.
5. **Fix Calendar `date is not defined`** (#171) — bundle variable name mismatch makes Calendar entirely inaccessible.
6. **Configure Stripe** (CR-3) — set `STRIPE_PRICE_ID_*` for CAD pricing; fix "Premium" vs "Pro" naming.
7. **Remove ALL hardcoded fake data** (CR-6, CR-7, CR-8, CR-9, CR-11, CR-12, CR-13, CA-CR-4) — Predictions, Help Getting Started, Changelog, Market Intel, Sales Funnel.
8. **Replace `Math.random()` in image filenames** (CA-CR-2) — security: predictable filenames expose other users' temp files.
9. **Build eBay bot** (CR-5) — currently missing from `worker/bots/`.
10. **Feature-gate Mercari/Grailed** (CA-CR-3, CA-M-1) — active case statements + AI templates for post-launch platforms.
11. **Global `$` → `C$` currency localization** (H-2) — every page with dollar amounts.
12. **Mark post-launch platforms "Coming Soon"** (H-3, #169) — My Shops, Connections, Plans, Landing.
13. **Fix `btn-danger` invisible in light mode** (#131) — delete confirmations broken for all users.
14. **Fix DOMPurify drag-and-drop stripping** (#182) — file upload broken on Add Item, Inventory Import, Image Bank.
15. **Add missing `safeJsonParse()` guards** (CA-H-9, CA-H-10) — 17 bare `JSON.parse()` calls crash route handlers.
16. **Add try/catch to 8 routes** (CA-H-1 through CA-H-8) — unhandled errors crash handlers.
17. **Fix social auth middleware** (#188 — FIXED `2226ae3`).
18. **Disable/hide Affiliate Program** (CR-14) — no backend built.
19. **Fix Plans page** (#175, #177) — show CAD pricing, fix broken Upgrade flow.
20. **Add metric measurements** (M-24) — Size Charts should offer cm for Canada.

---

## COVERAGE ACHIEVED

| Category | Coverage |
|----------|----------|
| Pages screenshotted | 70/70 (100%) |
| Dark mode tested | 70/70 (100%) |
| Modals tested | 41/41 (100%) |
| CTA buttons tested | ~95% |
| Form submissions | 8 forms tested |
| Error states | Partial (limited by fake session) |
| Responsive/mobile | Not visually verified (blocked by Chrome min width) |
| Source code audit | All files in `src/`, `worker/bots/` (not legacy app.js/core-bundle.js) |

---

*Document generated: 2026-04-05. Source: LAUNCH_READINESS_2026-04-05.md (185 findings, 14 sessions), LAUNCH_AUDIT_FINDINGS_2026-04-05.md (25 findings, code scan), post-walkthrough session fixes (#186–#189).*
