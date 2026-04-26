# Environment Requirements — Walkthrough Findings

## Railway Environment Variables

> Verified 2026-04-26 via Railway Variables tab scan (claude-in-chrome).

| Variable | Status | Required For |
|----------|--------|-------------|
| `DATABASE_URL` | ✅ Set | PostgreSQL |
| `OAUTH_MODE` | ✅ Set | Platform integrations (must be `'real'`) |
| `STRIPE_PRICE_STARTER` | ✅ Set | Starter plan checkout |
| `STRIPE_PRICE_PRO` | ✅ Set | Pro plan checkout |
| `STRIPE_PRICE_BUSINESS` | ✅ Set | Business plan checkout |
| `STRIPE_SECRET_KEY` | ✅ Set | Stripe payments |
| `STRIPE_PUBLIC_KEY` | ✅ Set | Stripe frontend |
| `STRIPE_WEBHOOK_SECRET` | ✅ Set | Stripe webhook verification |
| `ANTHROPIC_API_KEY` | ✅ Set | AI listing generation, Vault Buddy |
| `RESEND_API_KEY` | ✅ Set | Transactional email (forgot password, verification) |
| `CLOUDINARY_CLOUD_NAME` | ✅ Set | Image processing (background removal, upscale, enhance) |
| `CLOUDINARY_API_KEY` | ✅ Set | Image processing |
| `CLOUDINARY_API_SECRET` | ✅ Set | Image processing |
| `EBAY_CLIENT_ID` | ✅ Set | eBay OAuth |
| `EBAY_CLIENT_SECRET` | ✅ Set | eBay OAuth |
| `EBAY_REDIRECT_URI` | ✅ Set | eBay OAuth callback |
| `EBAY_ENVIRONMENT` | ✅ Set | eBay API environment |
| `POSHMARK_CLIENT_SECRET` | ✅ Set | Poshmark OAuth |
| `POSHMARK_USERNAME` | ✅ Set | Poshmark bot credentials |
| `POSHMARK_PASSWORD` | ✅ Set | Poshmark bot credentials |
| `DEPOP_CLIENT_SECRET` | ✅ Set | Depop OAuth |
| `GRAILED_CLIENT_SECRET` | ✅ Set | Grailed OAuth |
| `SHOPIFY_CLIENT_ID` | ✅ Set | Shopify OAuth |
| `SHOPIFY_CLIENT_SECRET` | ✅ Set | Shopify OAuth |
| `ETSY_CLIENT_ID` | ✅ Set | Etsy OAuth |
| `ETSY_CLIENT_SECRET` | ✅ Set | Etsy OAuth |
| `JWT_SECRET` | ✅ Set | Auth |
| `REDIS_URL` | ✅ Set | BullMQ background jobs |
| `SENTRY_DSN` | ✅ Set | Error monitoring |
| `EASYPOST_API_KEY` | ❌ NOT SET | Shipping labels — CR-4 still open |

## Open (Needs Fix)

| ID | Area | Finding | Session | Status |
|----|------|---------|---------|--------|
| CR-4 | Shipping | Shipping integration uses deprecated Shippo, not EasyPost. EasyPost API key under anti-fraud review | Session 1 | OPEN / NOT VERIFIED — 2026-04-22 live `GET /api/shipping-labels-mgmt/easypost/track/TEST123456789` returned `503 {"error":"EasyPost not configured"}` |
| M-33 | Privacy Policy | Contact email "privacy@vaultlister.com" — may not be set up | Session 3 | OPEN — verified 2026-04-24: `privacy@vaultlister.com` and `hello@vaultlister.com` referenced correctly in public pages ✅, `vaultlister.com` MX points to Google Workspace ✅, but actual mailbox delivery NOT re-proven — send a test email to both addresses to confirm they land before launch |

## Completed & Verified

| ID | Area | Finding | Session | Status |
|----|------|---------|---------|--------|
| H-18 | Forgot Password | "Send Reset Link" requires `RESEND_API_KEY`/SMTP — will fail silently | Session 2 | DEPLOY CONFIG — email.js gracefully falls back to console log if RESEND_API_KEY unset; set key before launch |
| H-25 | Forgot Password | "Send Reset Link" requires SMTP — will fail | Session 3 | DEPLOY CONFIG — same as H-18; set RESEND_API_KEY before launch |
| CR-3 | Plans & Billing / Stripe | "Upgrade to Pro" / "Upgrade to Business" buttons will fail — `STRIPE_PRICE_ID_*` not set in Railway | Session 1 | VERIFIED ✅ — 2026-04-22 live `/api/billing/checkout` returned 200 with Stripe Checkout session URL |
| CA-CR-1 | `src/backend/middleware/rateLimiter.js:27-28` | Rate limiting DISABLED for production — `isRateLimitBypassed()` always returns `true`. Zero brute-force, API abuse, or DoS protection. | Code Audit | VERIFIED ✅ — abeccbb |
| CA-L-2 | `src/backend/middleware/rateLimiter.js:27` | TODO comment: "Re-enable for production release" — advisory only (root issue is CA-CR-1) | Code Audit | VERIFIED ✅ — abeccbb |

## Sentry Setup — Deferred (Post-Launch Infrastructure)

> **NOT counted in INDEX open total.** These are Sentry dashboard configuration tasks — not launch blockers. Address after launch when monitoring needs expand.

| ID | Area | Finding | Status |
|----|------|---------|--------|
| Sentry-1 | Infrastructure | Setup User Feedback | DEFERRED |
| Sentry-2 | Infrastructure | Setup Logs | DEFERRED |
| Sentry-3 | Infrastructure | Setup Profiling | DEFERRED |
| Sentry-4 | Infrastructure | Setup Session Replay | DEFERRED |
| Sentry-5 | Infrastructure | Setup Monitor MCP Servers | DEFERRED |
| Sentry-6 | Infrastructure | Setup Monitor AI Agents | DEFERRED |
