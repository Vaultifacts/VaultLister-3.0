# Facebook/Meta OAuth & Commerce Integration — Complete Compliance Guide

**Prepared:** April 14, 2026  
**For:** VaultLister 3.0  
**Sources:** 19 official Meta policy documents reviewed (see Sources section)

---

## Table of Contents

1. [Strategic Reality](#1-strategic-reality)
2. [App Setup & Prerequisites](#2-app-setup--prerequisites)
3. [Business Verification](#3-business-verification)
4. [Required Permissions](#4-required-permissions)
5. [OAuth Implementation](#5-oauth-implementation)
6. [Required Endpoints](#6-required-endpoints)
7. [App Review Submission](#7-app-review-submission)
8. [Commerce Platform Integration](#8-commerce-platform-integration)
9. [Platform Terms Obligations](#9-platform-terms-obligations)
10. [Developer Policies](#10-developer-policies)
11. [Commercial Terms](#11-commercial-terms)
12. [Commerce Seller Agreement](#12-commerce-seller-agreement)
13. [Business Tools Terms](#13-business-tools-terms)
14. [App Development Guidelines](#14-app-development-guidelines)
15. [Login UX & Brand Requirements](#15-login-ux--brand-requirements)
16. [Login Security](#16-login-security)
17. [Rate Limits](#17-rate-limits)
18. [Existing Codebase Status](#18-existing-codebase-status)
19. [Compliance Checklist](#19-compliance-checklist)
20. [Recommended Action Plan](#20-recommended-action-plan)
21. [Sources](#21-sources)

---

## 1. Strategic Reality

### No Public Facebook Marketplace Listing API Exists

Unlike eBay, Etsy, or Poshmark, **Facebook has no public API for creating personal/C2C Marketplace listings.** This is verified by:
- Graph API Reference: zero Marketplace creation endpoints
- api2cart.com (2026): "there is no standalone or public API documentation for Facebook Marketplace like other platforms have"
- Marketplace Partner APIs require formal partnership: "eligible third-party partners to distribute listings"

### Three Available Paths

**Path A: Commerce Platform / Catalog API (Compliant)**
- Creates listings in a Facebook Shop (storefront on a Business Page)
- Products CAN appear in Marketplace: "Your products can be visible to buyers on Marketplace if you have a shop with checkout" (Meta Business Help Center)
- Requires: Business Page + Business Manager + Commerce eligibility + App Review
- Permissions: `catalog_management` (Advanced), `business_management` (Advanced), `commerce_manage_accounts` (Advanced)
- This is how Shopify, BigCommerce, etc. integrate

**Path B: Marketplace Partner Program (OCAS) — Not applicable**
- For platforms that operate their own marketplace (eBay, Poshmark, Craigslist)
- VaultLister is a cross-listing tool, not a marketplace operator — does not qualify
- Interest form: https://www.facebook.com/help/contact/2257996191228958

**Path C: Browser Automation (ToS-violating, industry-standard)**
- Playwright/Puppeteer simulates user filling out Marketplace listing form
- VaultLister already has this: `worker/bots/facebook-bot.js` + `facebookPublish.js`
- Violates Meta ToS 3.2.3: "You may not access or collect data from our Products using automated means (without our prior permission)"
- Explicitly prohibits "scripts, HTTP libraries, javascript or other executable code to automate actions"
- Every major competitor (Vendoo, Crosslist, List Perfectly) uses this approach — Crosslist's marketplaces page mentions "eBay's official API" explicitly but has no API mention for Facebook

**Recommendation:** Both paths can coexist. Commerce Platform (Path A) for business sellers wanting a proper Shop + Playwright (Path C) for personal C2C sellers with ToS risk disclosure.

### Canada Eligibility

Canada is in **open beta** for the full Shops and Shops ads experience. Some sellers may not have full capabilities. Full (non-beta) experience is US only.

Source: Meta Business Help Center "Supported countries for Shops on Facebook and Instagram" page.

---

## 2. App Setup & Prerequisites

### Create a Meta App
1. Go to developers.facebook.com
2. Create app — select **Business** type (not Consumer) for commerce access
3. Configure basic settings:
   - **App Icon:** 1024x1024, no Meta trademarks/logos
   - **Privacy Policy URL:** Publicly accessible, non-geo-blocked, crawlable by Meta bots
   - **Terms of Service URL:** Required for App Review
   - **App Category:** E-commerce / Business (accurate selection)
   - **Primary Contact Email:** Actively monitored — never filter `meta.com`, `fb.com`, `facebookmail.com`

### Facebook Login Product Configuration
- **Client OAuth Login:** ON
- **Web OAuth Login:** ON
- **Enforce HTTPS:** ON (default since 2018)
- **Use Strict Mode for Redirect URIs:** ON (required for all apps)
- **Valid OAuth Redirect URIs:** Exact match required, HTTPS only, no wildcards, one per line
- **App Domains:** All domains/subdomains using Facebook Login (each listed explicitly)

---

## 3. Business Verification

**Required since February 1, 2023 for Advanced Access permissions.**

### Process
1. App Dashboard > Settings > Basic > Verification
2. Connect app to Business Manager (only app admins can initiate)
3. Complete verification in Business Manager with documents
4. Meta verifies via phone or email code delivery

### Accepted Documents (complete list from official help center)
1. **Certificate/Articles of Incorporation**
2. **Business Registration or License Document**
3. **Government Issued Business Tax Document** (e.g., Tax Certificate — self-filed NOT accepted)
4. **Business Bank Statement**
5. **Utility Bill** — accepted for address/phone verification only, NOT for legal business name. Legal Business Name must appear on it.

### Requirements
- All documents must be **unexpired** and issued by relevant authorities
- Business name must **exactly match** Business Manager settings
- Non-English documents need official stamped translations
- Supported languages: Arabic, Bengali, English, French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Korean, Malaysian, Mandarin, Polish, Portuguese, Russian, Spanish, Thai, Turkish, Vietnamese

---

## 4. Required Permissions

### Permissions VaultLister Needs

| Permission | Access Level | Purpose | App Review Required |
|---|---|---|---|
| `public_profile` | Standard | Basic user identity | **No** |
| `email` | Standard | User's email | **No** |
| `catalog_management` | **Advanced** | Create/read/update/delete product catalogs | **Yes** |
| `business_management` | **Advanced** | Update catalogs, manage business assets | **Yes** |
| `commerce_account_manage_orders` | **Advanced** | Read/update commerce orders | **Yes** |
| `commerce_account_read_orders` | Standard | Read-only order access | **Yes** |
| `commerce_account_read_settings` | Standard | Read commerce account config | **Yes** |
| `commerce_manage_accounts` | **Advanced** | Create/manage commerce accounts | **Yes** |
| `pages_show_list` | Standard | List user's managed Pages | **No** |
| `pages_manage_posts` | **Advanced** | Create/edit/delete Page posts | **Yes** |
| `pages_read_engagement` | Standard | Read Page posts, followers | **Yes** |

### Standard vs Advanced Access
- **Standard Access:** Limited to app role holders only for most permissions (testing only)
- **Advanced Access:** Required for production use with real users. Requires Business Verification + App Review.
- **None Access:** Zero data access — can voluntarily reduce and restore later

### Development Mode vs Live Mode
- **Development Mode:** All permissions work for role-holders without App Review
- **Live Mode:** Only approved permissions can be requested. Switch ONLY after App Review approval. Test data from Dev mode becomes visible.

---

## 5. OAuth Implementation

### Authorization Code Flow (Graph API v25.0)

**Step 1 — Build Authorization URL:**
```
https://www.facebook.com/v25.0/dialog/oauth?
  client_id={app-id}
  &redirect_uri={exact-registered-uri}
  &state={csrf-random-token}
  &scope=catalog_management,business_management,commerce_manage_accounts
  &response_type=code
```

**Step 2 — Exchange code for token (server-to-server only):**
```
GET https://graph.facebook.com/v25.0/oauth/access_token?
  client_id={app-id}
  &redirect_uri={same-uri-as-step-1}
  &client_secret={app-secret}
  &code={code-from-callback}
```

**Step 3 — Verify token:**
```
GET https://graph.facebook.com/debug_token?
  input_token={token}
  &access_token={app-id}|{app-secret}
```
Verify `app_id` matches your own. Check `data_access_expires_at`.

### Token Types and Lifetimes

| Token Type | Lifetime | Use Case |
|---|---|---|
| Short-lived User Token | ~1-2 hours | Initial OAuth exchange |
| Long-lived User Token | ~60 days | Extended user sessions |
| Long-lived Page Token | Never expires | Server-side catalog management |
| System User Token | Never expires | Automated server-to-server (recommended) |
| App Token | Never expires | `{app-id}\|{app-secret}` — never expose client-side |

### Exchange Short-Lived → Long-Lived:
```
GET https://graph.facebook.com/v25.0/oauth/access_token?
  grant_type=fb_exchange_token
  &client_id={app-id}
  &client_secret={app-secret}
  &fb_exchange_token={short-lived-token}
```

### Data Access Expiration
- Separate from token expiration — `data_access_expires_at` field
- Expires after **90 days of user inactivity**
- Must detect Graph API error code 190 (subcode 463/467) and redirect through new login flow
- SDKs do NOT auto-handle this — app logic must detect and handle

### appsecret_proof (Server-Side Security)
```
appsecret_proof = HMAC-SHA256(access_token, app_secret)
```
Add `&appsecret_proof={hash}` to all server-to-server API calls. Can be made mandatory in Advanced Settings.

---

## 6. Required Endpoints

### Data Deletion Callback (`POST /api/facebook/data-deletion`)
- Receives `signed_request` parameter (base64url payload + HMAC-SHA256 signature)
- Verify signature using app secret
- Extract `user_id`, initiate deletion of all Facebook-sourced data
- Return JSON:
```json
{
  "url": "https://yourdomain.com/deletion-status?id=abc123",
  "confirmation_code": "abc123"
}
```
- Facebook displays confirmation code and URL to user in their settings

### Deauthorize Callback (`POST /api/facebook/deauth`)
- Same `signed_request` mechanism
- Triggered when user removes app from Facebook Settings
- Revoke stored tokens, flag user data for cleanup
- Return HTTP 200 quickly (fire-and-forget from Meta)
- URL must be HTTPS

### Webhook Endpoint (if subscribing to events)
- HTTPS required (no self-signed certs)
- Verification handshake: GET with `hub.mode=subscribe`, `hub.challenge`, `hub.verify_token`
- Echo back `hub.challenge` value to verify

---

## 7. App Review Submission

### Pre-Submission Checklist
- At least **1 successful API call per requested permission** within 30 days
- Wait 2 days for API call data to appear in Meta's system
- Screen recording for **every** permission
- App fully functional and accessible for Meta to test

### The 6-Step Process

1. **Select Permissions:** App Review > Permissions and Features. Request each individually. Button grayed out until API call is logged.
2. **Business Verification:** Complete if not done.
3. **Data Handling Questions:** Answer immediately — evaluated in ~30 seconds.
4. **App Settings:** Icon (no Meta trademarks), Privacy Policy URL, App Purpose ("Clients" for VaultLister), Category, Contact Email.
5. **Usage Descriptions:** Unique per permission. Must answer: How does this help users? Why does the app need it? How is data utilized? What's lost without it? **Copy-pasting between permissions = automatic rejection.**
6. **Submit:** Accept Platform Onboarding Terms. Wait.

### Timeline
Official FAQ: **"the entire process may take up to several weeks."** Business verification takes "a few days" depending on documentation quality.

### Screen Recording Requirements
- **1080p or better**, monitor ≤1440px width
- Full-screen or window-only, **no audio**
- English UI preferred; add captions if not English
- **Mouse interactions** (keyboard hard to assess visually)
- Enlarged cursor for visibility
- Show users granting each permission + actual usage
- **Any permission missing a recording = NOT APPROVED**

### Common Rejection Reasons
1. App not accessible for testing
2. Missing screen recording for any permission
3. Copy-pasted usage descriptions between permissions
4. Requesting permissions the app doesn't actually use
5. App crashes during review
6. Privacy policy URL broken/geo-blocked/not crawlable
7. No successful API call within 30 days
8. App icon contains Meta trademarks
9. Non-English UI without captions

---

## 8. Commerce Platform Integration

### Onboarding Flow
1. Set up Business Manager with all assets consolidated
2. Onboard to **Sandbox Commerce Account**
3. Generate **Page Access Token** or **System User Token**
4. Connect app to Commerce Manager
5. Test with test commerce accounts and staging shops
6. Submit for App Review with commerce permissions
7. After approval, access production commerce accounts

### Catalog Feed Requirements
- Required fields: `id`, `title`, `description`, `availability`, `condition`, `price`, `link`, `image_link`, `brand`
- Optional: `additional_image_link` (up to 10), `color`, `size`, `sale_price`, `google_product_category`, `product_type`
- At least one category required: Google Product Category or Facebook Product Category
- Physical goods only (no digital products, subscriptions, services)
- Links must be HTTPS on merchant's own domain

### Marketplace Partner Seller API (if partnership obtained)
- Endpoint: `POST /v25.0/{product-catalog-id}/marketplace_partner_sellers_details`
- Required: `seller_name`, `seller_id` (must match `partner_seller_id` in product uploads)
- Optional: `seller_review_count`, `seller_positive_ratings_pct` (0.0-1.0), `seller_member_since`
- Rate limits: max 5,000 sellers/call, max 200 calls/hour
- Upload sellers FIRST, then products

### System User Tokens (Recommended for Server-to-Server)
- Never expire — ideal for automated API calls
- Store encrypted (AES-256-GCM)
- Rotate periodically
- Segregate test and production tokens
- Access tiers: Development (1 user), Basic (3), Standard (10)

---

## 9. Platform Terms Obligations

Source: Meta Platform Terms, effective February 3, 2026 (full text reviewed)

### Data Handling
- **Never sell, license, or purchase Platform Data**
- Delete data when no longer needed for legitimate business purpose
- Delete upon user request (unless aggregated/de-identified)
- No building/augmenting user profiles without valid consent
- No decoding, de-anonymizing, or reverse-engineering data
- No discrimination based on protected attributes
- No eligibility determinations for housing, employment, credit, insurance
- No surveillance processing for law enforcement

### Privacy Policy
- Publicly accessible, non-geo-blocked, crawlable URL
- Disclosed in App Dashboard privacy policy field
- Must explain: what data processed, how, purposes, how to request deletion
- Cannot supersede, modify, or be inconsistent with Platform Terms

### Service Providers
- Must agree in writing to process data solely at your direction
- Sub-Service Providers need same written requirements
- You are responsible for their acts and omissions
- Must provide list of Service Providers upon Meta's request

### Data Security
- Administrative, physical, and technical safeguards meeting/exceeding industry standards
- Must have public vulnerability reporting mechanism
- Never request Meta user login credentials
- Protect and never share user IDs, access tokens, or app secrets

### Incident Reporting
- Report unauthorized data processing ASAP (per applicable laws)
- Immediately begin remediation
- Cooperate with Meta's investigation

### Audit Rights
- Regular monitoring by Meta or third-party auditors
- Formal audit up to once/year (10 business days notice)
- More frequent if "Necessary Condition" (breach, violation, etc.)
- Audit rights survive 1 year after you stop processing Platform Data

### Enforcement
- Meta can act at any time, with or without notice
- Actions: suspend/remove app, revoke permissions, require data deletion, terminate account
- 28-day inactivity on any API/permission = access may be suspended

### International Transfers
- EEA: Standard Contractual Clauses (Module One, controller-to-controller)
- UK: Approved Addendum (ICO)
- Other: Global Data Transfer Addendum

---

## 10. Developer Policies

Source: Meta Developer Policies, effective February 3, 2026 (full text reviewed)

### Prohibited
- Malware, spyware, adware distribution
- Inauthentic behavior, high-frequency bot creation
- Buying/selling feature privileges
- Prefilling message content (unless user-created)
- Sharing payment card numbers in messages
- Marketplace lead data transfer to third parties (except listing merchant)
- Using advertising data beyond campaign performance assessment
- Third-party ads in posts, comments, notifications

### Required
- Develop/manage apps using authentic accounts
- Verify correct Login integration — app must not crash during testing
- Obtain user consent before publishing content on their behalf
- Provide clear opt-out for messaging; respect all opt-out requests
- Keep Business Manager accounts current and accurate
- Comply with Meta Advertising Standards for app names, icons, descriptions
- Monitor emails from meta.com, fb.com, facebookmail.com — never filter

### Commerce-Specific
- Tech Providers must ensure customers agree to Seller Agreement
- Comply with all applicable laws and regulations
- Standard/Advanced API access **downgrades after 30 days of non-use**

---

## 11. Commercial Terms

Source: Meta Commercial Terms, effective March 6, 2024 (full text reviewed)

### Key Obligations
- Applies to any business/commercial use of Meta Products
- Must geo-filter or age-gate content where required by law
- Cannot use commercially if in US-embargoed country
- Meta gets non-exclusive, transferable, sublicensable, royalty-free worldwide license to all commercial content

### Data Restrictions
- Cannot send data from/about children under 13
- Cannot send health, financial, biometric, or similarly sensitive information (except where product terms allow)

### Disputes (Canadian business)
- Commercial claims between VaultLister and Meta Platforms Ireland Limited → courts of Republic of Ireland
- Claims against Meta Platforms, Inc. → US District Court for Northern District of California

---

## 12. Commerce Seller Agreement

Source: Seller Agreement, last updated October 31, 2023 (full text reviewed)

### Key Obligations
- **You are the seller of record** — responsible for all taxes, returns, refunds, customer service
- Seller Content must be **true, accurate, and complete at all times** — prices, descriptions, shipping, legal disclosures
- **Counterfeit/pirated products strictly prohibited** + sanctions compliance
- Must remove listings **immediately** upon any recall or safety alert
- User Data: only use to support transactions or with valid consent
- **No direct email marketing** unless user opted in
- You and Meta are **independent data controllers** (GDPR)
- Service Providers must comply with all Seller Terms — their breach = your breach
- **Indemnification**: You indemnify Meta for claims from products sold, including property damage and bodily injury
- **30 days written notice to terminate**
- Meta gets perpetual, irrevocable license to all Seller Content

---

## 13. Business Tools Terms

Source: Meta Business Tools Terms, effective November 3, 2025 (full text reviewed)

Applies when using Facebook Login, Social Plugins, Meta Pixel, Conversions API, or Facebook SDK.

### Data Restrictions
- Cannot send: social security numbers, credit card numbers, health/financial/consumer report info, data from children under 13
- Contact Information must be **hashed** before transmission via JS pixel

### Cookie Consent (EU/UK)
- Must get **verifiable** consent before Meta cookies are placed on end user's device
- See Meta's Cookie Consent Resource for implementation

### Notice Requirements
- **Every web page using Meta tools** must have clear, prominent notice linking to explanation of:
  - (a) Data collection by third parties including Meta
  - (b) How users can opt-out
  - (c) Link to opt-out mechanism (e.g., aboutads.info/choices, youronlinechoices.eu)
- **Every app** must have clear, prominent link in settings/privacy policy with same disclosures

### Pixel Restrictions
- Cannot place pixels on websites you don't own

### GDPR Joint Controllership
- For event data processing, you and Meta Ireland are **joint controllers** under Article 26 GDPR
- Controller Addendum applies
- For matching and measurement, you are Controller and Meta is Processor

### Data Retention
- Meta retains Event Data up to **2 years**
- Audiences retained until you delete them

---

## 14. App Development Guidelines

Source: App Development Guidelines (introduced October 2024, reviewed via WebFetch)

### Requirements
- Build stable, navigable apps with clear functionality
- Maintain current app descriptions and categorization
- **Implement working logout functionality** — must be easily discoverable
- Permission requests **only when actually needed** — not immediately after login
- Re-prompt permissions only after user indicates willingness to grant
- **Never prefill content** in captions, comments, messages, or posts — suggested content must be user-editable
- Personalize comments per user — no generic templates
- **Limit ad volume** — ads cannot overshadow app functionality
- Android/iOS: back button must return to Facebook app
- No unauthorized commercial communications

---

## 15. Login UX & Brand Requirements

### Button Design
- Label: **"Log in with Facebook"** or **"Connect to Facebook"**
- Colors: white + official Facebook blue **#1877F2**
- Include official "f" logo
- "Continue with Facebook" / "Continue as {Name}" variants available
- Button height not customizable for "Continue as" variant

### Permission Flow
- Request permissions only when feature needs them (not all at login)
- Handle declined permissions gracefully — app must function without optional permissions
- Re-request only after user indicates willingness

---

## 16. Login Security

### App Secret
- **NEVER expose client-side** or in decompilable binaries
- Server-side only — used for token exchange and API calls
- Store in `.env`, never commit to git
- Reset immediately if compromised (App Dashboard > Basic Settings)

### State Parameter
- Required for CSRF protection
- Generate unique random value per request
- Validate on callback — reject if missing or mismatched

### Strict Mode
- Required for all apps
- Redirect URI must exactly match registered URI
- No partial matches, no extra query parameters, no wildcards

### HTTPS
- Mandatory for all redirect URIs and SDK calls involving tokens
- All API calls to `https://graph.facebook.com`

---

## 17. Rate Limits

### Platform Rate Limits (Graph API)
- Rolling 1-hour window
- Formula: **`200 × Number of Daily Active Users`**
- Monitor via `X-App-Usage` response header (`call_count`, `total_cputime`, `total_time` percentages)
- HTTP 429 on throttle — implement exponential backoff

### Business Use Case Rate Limits (Marketing/Pages API)
- Read = 1 point, Write = 3 points
- Development tier: max 60 points, 300s decay
- Standard tier: max 9,000 points, 300s decay, 60s block on max
- Monitor via `X-Business-Use-Case-Usage` header

### Marketplace Partner Seller API
- Max 5,000 sellers per call
- Max 200 calls per hour

### Inactivity Downgrade
- Standard/Advanced API access downgrades after **30 days of non-use**
- Any API/permission unused for **28 days** may be suspended

---

## 18. Existing Codebase Status

### What Exists
- `worker/bots/facebook-bot.js` — Full Playwright bot (FacebookBot class: login, refreshListing, refreshAllListings, relistItem, getStats)
- `src/backend/services/platformSync/facebookPublish.js` — Playwright publish flow (logs in, navigates to marketplace/create/item, fills form)
- `src/backend/services/platformSync/facebookSync.js` — Sync service (API calls are stubs returning `[]` with comment "Facebook Commerce API requires approved Commerce account")
- `src/backend/routes/oauth.js:616-623` — Facebook OAuth config (Graph API v18.0, scopes `commerce_account.read`/`commerce_account.write`)
- `src/backend/routes/automations.js` — 3 Facebook automation presets
- `.env.example` — `FACEBOOK_EMAIL`/`FACEBOOK_PASSWORD` (active), `FACEBOOK_CLIENT_ID`/`SECRET` (commented)

### What Does NOT Exist
- Data deletion callback endpoint
- Deauthorize callback endpoint
- Catalog API integration
- Commerce Manager integration
- Facebook Business Extension (FBE) integration
- Webhook handler for Facebook

### What Needs Fixing
- **OAuth config is stale:** v18.0 → v25.0 (7 major versions behind)
- **Scopes are invalid:** `commerce_account.read`/`commerce_account.write` do not exist in Meta's permissions reference. Valid scopes: `catalog_management`, `business_management`, `commerce_account_manage_orders`, `commerce_account_read_orders`, `commerce_account_read_settings`, `commerce_manage_accounts`

---

## 19. Compliance Checklist

### Infrastructure
- [ ] Meta App created with Business type
- [ ] Business Manager set up with all assets consolidated
- [ ] Business Verification completed with valid documents
- [ ] Privacy Policy URL: live, accessible, non-geo-blocked, crawlable
- [ ] Privacy Policy covers: what FB data collected, how used, how to request deletion
- [ ] Data deletion callback implemented (`POST /api/facebook/data-deletion`)
- [ ] Deauthorize callback implemented (`POST /api/facebook/deauth`)
- [ ] HTTPS enforced on all redirect URIs and callbacks
- [ ] App secret stored server-side only (in `.env`)
- [ ] Token storage uses AES-256-GCM encryption
- [ ] `appsecret_proof` implemented for server-to-server calls
- [ ] State parameter for CSRF in OAuth flow
- [ ] Working logout functionality (easily discoverable)

### App Review Preparation
- [ ] At least 1 successful API call per requested permission (within 30 days)
- [ ] Screen recording for EVERY permission (1080p, no audio, English UI, mouse-driven)
- [ ] Unique usage description for each permission (no copy-paste)
- [ ] App icon 1024x1024, no Meta trademarks
- [ ] Test account credentials prepared for reviewers
- [ ] App publicly accessible or access instructions provided
- [ ] App does not crash during testing

### Commerce-Specific
- [ ] Sandbox Commerce Account onboarded
- [ ] Catalog feed with required product attributes configured
- [ ] System User tokens configured and encrypted
- [ ] Rate limits respected
- [ ] Seller upload flow: sellers first, then products

### Policy Compliance
- [ ] All data access via official Graph API only — no scraping
- [ ] No prefilling of user messages or content
- [ ] Marketplace lead data used only for contacting about specific listings
- [ ] Annual Data Use Checkup process planned
- [ ] Data retention/deletion policy documented and implemented
- [ ] User consent obtained before any profile building
- [ ] No sensitive data sent to Meta (health, financial, children under 13)
- [ ] Cookie consent mechanism for EU/UK users
- [ ] Meta Business Tools notice on every page using Meta tools
- [ ] Login button follows brand guidelines (#1877F2, "Log in with Facebook", f logo)

### Ongoing Obligations
- [ ] Monitor emails from meta.com, fb.com, facebookmail.com — never filter
- [ ] Rotate system user tokens periodically
- [ ] Re-certify Data Use Checkup annually (within 60 days of notice)
- [ ] Keep app active (API calls at least every 30 days)
- [ ] Maintain updated app description and categorization
- [ ] Respond promptly to all Meta requests
- [ ] Report security incidents immediately

---

## 20. Recommended Action Plan

Ordered by dependency and impact:

1. **Start Business Verification now** — longest lead time, blocks all Advanced Access
2. **Update OAuth config** — v18.0 → v25.0, fix invalid permission scopes
3. **Build data deletion + deauth callback endpoints** — required for App Review
4. **Draft privacy policy additions** — Facebook-specific data handling, deletion instructions
5. **Add Meta Business Tools notice** to pages using Facebook Login
6. **Implement cookie consent** for EU/UK users
7. **Add working logout** that's easily discoverable
8. **Set up Sandbox Commerce Account** — test Catalog API before submission
9. **Build Catalog API integration** — replace sync stubs with real API calls
10. **Record screencasts** for every permission (1080p, mouse-driven, no audio)
11. **Write unique permission descriptions** — explain the "why" per permission
12. **Make 1 API call per permission** — wait 2 days for data to appear
13. **Submit for App Review** — expect several weeks for processing
14. **Switch to Live Mode only after approval**

---

## 21. Sources

All official Meta documentation reviewed for this guide:

| # | Document | URL |
|---|---|---|
| 1 | Meta Platform Terms | https://developers.facebook.com/terms |
| 2 | Meta Commercial Terms | https://www.facebook.com/legal/commercial_terms |
| 3 | Meta Business Tools Terms | https://www.facebook.com/legal/technology_terms |
| 4 | Developer Policies | https://developers.facebook.com/devpolicy/ |
| 5 | App Development Guidelines | https://developers.facebook.com/docs/development/terms-and-policies/app-dev-guidelines/ |
| 6 | Automated Data Collection Terms | https://developers.facebook.com/docs/development/terms-and-policies/automated-data-collection/ |
| 7 | Commerce Seller Agreement | https://www.facebook.com/legal/commerce_product_merchant_agreement |
| 8 | App Review | https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review |
| 9 | App Review Submission Guide | https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/submission-guide |
| 10 | Permissions Reference | https://developers.facebook.com/docs/permissions/reference/ |
| 11 | Business Verification | https://developers.facebook.com/docs/development/release/business-verification/ |
| 12 | Business Verification Documents | https://www.facebook.com/business/help/159334372093366 |
| 13 | Supported Countries for Shops | https://www.facebook.com/business/help/549256849084694 |
| 14 | Commerce Eligibility | https://www.facebook.com/business/help/2347002662267537 |
| 15 | Marketplace Partnerships | https://developers.facebook.com/docs/marketplace/partnerships/ |
| 16 | Marketplace Partner Seller API | https://developers.facebook.com/docs/marketplace/partnerships/sellerAPI/ |
| 17 | Marketplace Approval API | https://developers.facebook.com/docs/commerce-platform/platforms/distribution/MPApprovalAPI/ |
| 18 | Rate Limiting | https://developers.facebook.com/docs/graph-api/overview/rate-limiting/ |
| 19 | 2024 Platform Terms Update | https://developers.facebook.com/blog/post/2024/10/15/platform-terms-and-developer-policies-updates/ |

### Additional Sources Referenced
- Commerce Platform Catalog Setup: https://developers.facebook.com/docs/commerce-platform/catalog/get-started
- Commerce Integration Planning: https://developers.facebook.com/docs/commerce-platform/best-practices/integration
- Data Deletion Callback: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
- Privacy Policy Requirements: https://developers.facebook.com/docs/development/terms-and-policies/privacy-policy/
- Manual OAuth Flow: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/
- Access Tokens Guide: https://developers.facebook.com/docs/facebook-login/guides/access-tokens/
- Login Security: https://developers.facebook.com/docs/facebook-login/security/
- Screen Recording Requirements: https://developers.facebook.com/docs/app-review/submission-guide/screen-recordings/
- App Review FAQs: https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review/AR-FAQs/
- Graph API v25.0 Announcement: https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/

---

## Corrections Log

Errors found and corrected during verification:

| Error | Original Claim | Corrected To | How Verified |
|---|---|---|---|
| Graph API version | v20.0 | **v25.0** | Official Meta blog post Feb 2026 |
| App Review timeline | 2-3 days, up to 1 week | **Several weeks** | App Review FAQ page |
| Rate limit formula | 200 + 40 × DAU | **200 × DAU** | Official rate limiting docs |
| OAuth scopes | `commerce_account.read`/`.write` valid | **Invalid — not in permissions reference** | Permissions reference + web search |
