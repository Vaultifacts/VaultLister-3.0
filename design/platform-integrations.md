# VaultLister 3.0 — Platform Integrations

Nine marketplace integrations. Three use official REST APIs; six require Playwright
browser automation because they provide no public seller API.

Source files:
- Publish handlers: `src/backend/services/platformSync/[platform]Publish.js`
- Sync handlers: `src/backend/services/platformSync/[platform]Sync.js`
- Playwright bots: `src/shared/automations/[platform]-bot.js`
- Rate limits: `src/shared/automations/rate-limits.js`

---

## Integration Matrix

| Platform | Auth Method | Publish Method | Sync Method | Bot Capabilities |
|----------|-------------|----------------|-------------|------------------|
| Poshmark | username/password (.env) | Playwright | Playwright | Share, follow-back, send offers |
| eBay | OAuth 2.0 (REST API) | eBay Sell API | eBay API | None (API-only) |
| Mercari | username/password (.env) | Playwright | Playwright | Relist, price drop |
| Depop | username/password (.env) | Playwright | Playwright | Relist |
| Grailed | username/password (.env) | Playwright | Playwright | Bump listings |
| Etsy | OAuth 2.0 (REST API) | Etsy REST API | Etsy API | None (API-only) |
| Shopify | Access token (.env) | Shopify Admin REST API | Shopify API | None (API-only) |
| Facebook Marketplace | email/password (.env) | Playwright | Playwright | None |
| Whatnot | username/password (.env) | Playwright | Playwright | Show scheduling |

---

## Platform Details

### Poshmark
- **Auth:** `POSHMARK_USERNAME` + `POSHMARK_PASSWORD` from `.env`. No OAuth — Poshmark has no public API.
- **Publish:** `poshmarkPublish.js` spawns `scripts/poshmark-publish-bot.js` as a child process (5-minute timeout). Child process isolation avoids Playwright pipe timeout issues on Windows.
- **Sync:** `poshmarkSync.js` drives the web UI to pull listing status and orders.
- **Bot (`poshmark-bot.js`):** Closet sharing, follow-back automation, send offers to likers.
- **Rate limits:** shareDelay 3s, followDelay 2.5s, offerDelay 5s; max 300 shares/run, 100 follows/run, 50 offers/run.

### eBay
- **Auth:** OAuth 2.0 — `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` + `EBAY_REFRESH_TOKEN`. Supports sandbox (`EBAY_ENVIRONMENT=sandbox`) and production.
- **Publish:** `ebayPublish.js` calls eBay Sell API: inventory_item → merchant policies → offer → publish. Resolves eBay leaf category IDs via the taxonomy suggestion API; falls back to category `57988` (Men's Clothing) on failure. Maps VaultLister conditions to eBay condition codes.
- **Sync:** `ebaySync.js` pulls active listings and orders via eBay REST API.
- **Bot:** None. All operations use the official API.

### Mercari
- **Auth:** `MERCARI_USERNAME` + `MERCARI_PASSWORD` from `.env`. No public API.
- **Publish:** Playwright-driven web form submission.
- **Sync:** Playwright-driven scraping of listing and order status.
- **Bot (`mercari-bot.js`):** Relist ended items, apply price drops.
- **Rate limits:** actionDelay 4s; max 50 actions/run.

### Depop
- **Auth:** `DEPOP_USERNAME` + `DEPOP_PASSWORD` from `.env`. No stable public API.
- **Publish:** Playwright-driven web form.
- **Sync:** Playwright-driven status polling.
- **Bot (`depop-bot.js`):** Relist items.
- **Rate limits:** actionDelay 3.5s; max 50 actions/run.

### Grailed
- **Auth:** `GRAILED_USERNAME` + `GRAILED_PASSWORD` from `.env`. No public seller API.
- **Publish:** Playwright-driven web form.
- **Sync:** Playwright-driven status polling.
- **Bot (`grailed-bot.js`):** Bump (re-list) items to top of feed.
- **Rate limits:** actionDelay 4s; max 30 actions/run.

### Etsy
- **Auth:** OAuth 2.0 — `ETSY_CLIENT_ID` + `ETSY_CLIENT_SECRET` + `ETSY_REFRESH_TOKEN`.
- **Publish:** `etsyPublish.js` calls Etsy REST API. Requires a connected shop ID.
- **Sync:** `etsySync.js` pulls listings and orders via Etsy API.
- **Bot:** None. All operations use the official API.

### Shopify
- **Auth:** `SHOPIFY_STORE_URL` + `SHOPIFY_ACCESS_TOKEN` from `.env`. Access token requires `write_products` scope. API version pinned to `2024-01`.
- **Publish:** `shopifyPublish.js` calls Shopify Admin REST API (`POST /products.json`). Maps VaultLister conditions to Shopify product tags.
- **Sync:** `shopifySync.js` pulls product and order data via Shopify API.
- **Bot:** None. All operations use the official API.

### Facebook Marketplace
- **Auth:** `FACEBOOK_EMAIL` + `FACEBOOK_PASSWORD` from `.env`. No public Marketplace seller API.
- **Publish:** `facebookPublish.js` uses Playwright to automate `marketplace/create/item`. CAPTCHA or security check throws immediately — no bypass attempted.
- **Sync:** `facebookSync.js` drives the Marketplace UI to check listing status.
- **Bot (`facebook-bot.js`):** No scheduled bot actions due to aggressive Facebook bot detection. Manual publish only.
- **Rate limits:** actionDelay 5s (most aggressive detection of all platforms); max 20 actions/run; loginCooldown 2 minutes.
- **Warning:** Facebook may trigger 2FA or account review. A dedicated Facebook account for VaultLister is recommended rather than a personal account.

### Whatnot
- **Auth:** `WHATNOT_USERNAME` + `WHATNOT_PASSWORD` from `.env`. No public seller API.
- **Publish:** `whatnotPublish.js` Playwright-driven listing creation.
- **Sync:** `whatnotSync.js` Playwright-driven status polling.
- **Bot (`whatnot-bot.js`):** Show scheduling assistance.
- **Rate limits:** actionDelay 4s; max 30 actions/run.
- **Extended features:** `whatnotEnhanced.js` route handles auction configuration and live show management.

---

## Shared Bot Safety Rules

These apply to all Playwright bots without exception:

1. Credentials are read from `.env` only — never passed as function arguments.
2. Every bot action is logged to `data/automation-audit.log` via `auditLog()`.
3. Rate limits from `rate-limits.js` are enforced with ±30% random jitter.
4. No two automations run against the same platform simultaneously.
5. Any CAPTCHA detection stops the bot immediately and alerts the user.
6. Bots must not be run against live platforms without explicit user confirmation.
