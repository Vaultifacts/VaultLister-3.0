# Environment Requirements — Walkthrough Findings

## Railway Environment Variables

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

## Sentry Setup — Open Items

| ID | Area | Finding | Status |
|----|------|---------|--------|
| Sentry-1 | Infrastructure | Setup User Feedback | OPEN / NOT VERIFIED |
| Sentry-2 | Infrastructure | Setup Logs | OPEN / NOT VERIFIED |
| Sentry-3 | Infrastructure | Setup Profiling | OPEN / NOT VERIFIED |
| Sentry-4 | Infrastructure | Setup Session Replay | OPEN / NOT VERIFIED |
| Sentry-5 | Infrastructure | Setup Monitor MCP Servers | OPEN / NOT VERIFIED |
| Sentry-6 | Infrastructure | Setup Monitor AI Agents | OPEN / NOT VERIFIED |
