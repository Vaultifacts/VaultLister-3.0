# Environment Variable Reference — VaultLister 3.0

**Canonical source:** `.env.example` (83 variables). Copy to `.env` and fill in values for local dev.
**Production:** Variables are set in Railway. Never commit `.env`.

---

## Required for Production

These must be set or the app will fail at startup or at first use.

| Variable | Where to Get | Notes |
|---|---|---|
| `NODE_ENV` | Set `production` | Enables production optimizations |
| `PORT` | Railway sets automatically | Default 3000 |
| `JWT_SECRET` | `openssl rand -base64 64` | Min 32 chars |
| `SESSION_SECRET` | `openssl rand -base64 64` | Separate from JWT_SECRET |
| `DATABASE_URL` | Railway PostgreSQL plugin | `postgresql://user:pass@host:5432/db` |
| `POSTGRES_PASSWORD` | Railway PostgreSQL plugin | Used by Docker Compose only |
| `BASE_URL` | `https://vaultlister.com` | OAuth callbacks and email links break without it |
| `APP_URL` | `https://vaultlister.com` | Billing redirects and email links |
| `CORS_ORIGINS` | Your domains | Comma-separated; missing → overly permissive or rejected |
| `RP_ID` | `vaultlister.com` | WebAuthn relying party ID; falls back to localhost |
| `ORIGIN` | `https://vaultlister.com` | Passkey/MFA auth fails without it |
| `OAUTH_REDIRECT_URI` | `https://vaultlister.com/oauth-callback` | NOT `/api/oauth/callback` |
| `OAUTH_ENCRYPTION_KEY` | `openssl rand -hex 32` | AES-256-GCM key for OAuth token storage |
| `OAUTH_MODE` | `real` | Set `mock` only for local development |

---

## Billing — Stripe

| Variable | Notes |
|---|---|
| `STRIPE_PUBLIC_KEY` | Publishable key (`pk_live_…` or `pk_test_…`) |
| `STRIPE_SECRET_KEY` | Secret key — never expose client-side |
| `STRIPE_WEBHOOK_SECRET` | From Stripe → Webhooks → your endpoint |
| `STRIPE_PRICE_STARTER` | Price ID for Starter plan (C$9/mo) — set in Railway 2026-04-20 |
| `STRIPE_PRICE_PRO` | Price ID for Pro plan (C$19/mo) — set in Railway 2026-04-20 |
| `STRIPE_PRICE_BUSINESS` | Price ID for Business plan (C$49/mo) — set in Railway 2026-04-20 |

---

## Email — Resend

| Variable | Notes |
|---|---|
| `RESEND_API_KEY` | From resend.com → API Keys |
| `EMAIL_FROM` | Display name + verified sender address |

---

## Platform OAuth / Credentials

| Variable | Platform | Notes |
|---|---|---|
| `EBAY_CLIENT_ID` | eBay | From eBay Developer → Application Keys |
| `EBAY_CLIENT_SECRET` | eBay | — |
| `EBAY_REDIRECT_URI` | eBay | RuName from eBay Developer portal |
| `EBAY_ENVIRONMENT` | eBay | `production` or `sandbox` |
| `EBAY_DELETION_VERIFICATION_TOKEN` | eBay | Random 32-char token for account deletion webhook |
| `EBAY_DELETION_ENDPOINT` | eBay | `https://vaultlister.com/api/webhooks/ebay/account-deletion` |
| `POSHMARK_USERNAME` / `POSHMARK_PASSWORD` | Poshmark | Playwright bot credentials |
| `MERCARI_USERNAME` / `MERCARI_PASSWORD` | Mercari | Playwright bot credentials |
| `GRAILED_USERNAME` / `GRAILED_PASSWORD` | Grailed | Playwright bot credentials |
| `FACEBOOK_EMAIL` / `FACEBOOK_PASSWORD` | Facebook | Playwright bot credentials |
| `WHATNOT_USERNAME` / `WHATNOT_PASSWORD` | Whatnot | Playwright bot credentials |
| `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET` | Shopify | OAuth app credentials — set in Railway 2026-04-20 |
| `SHOPIFY_STORE_URL` / `SHOPIFY_ACCESS_TOKEN` | Shopify | Admin API access |
| `DEPOP_CLIENT_ID` / `DEPOP_CLIENT_SECRET` | Depop | OAuth PKCE app credentials |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google (email/login) | — |

---

## AI Services

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | From console.anthropic.com — used for listing generation, Vault Buddy, image analysis |
| `OPENAI_API_KEY` | Optional fallback |
| `XAI_API_KEY` | Optional xAI/Grok integration |
| `VAULTLISTER_LISTING_GENERATOR` | Claude model override for listing gen (blank = default) |
| `VAULTLISTER_SUPPORT_BOT` | Claude model override for Vault Buddy |
| `VAULTLISTER_IMAGE_ANALYZER` | Claude model override for image analysis |
| `VAULTLISTER_PREDICTIONS` | Claude model override for price predictions |
| `VAULTLISTER_RECEIPT_PARSER` | Claude model override for receipt parsing |

---

## Shipping — EasyPost

| Variable | Notes |
|---|---|
| `EASYPOST_API_KEY` | From easypost.com — anti-fraud review cleared 2026-04-20; set in Railway |

---

## Infrastructure

| Variable | Notes |
|---|---|
| `REDIS_URL` | BullMQ job queues — `redis://…` |
| `REDIS_PASSWORD` | Optional if Redis requires auth |
| `IMAGE_STORAGE` | `local` or `cloudflare-r2` |
| `CLOUDFLARE_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | Cloudflare R2 image storage |
| `LOG_LEVEL` | `info` (production), `debug` (local) |
| `LOG_DIR` | Default `./logs` |
| `BETTERSTACK_SOURCE_TOKEN` | BetterStack log shipping (optional) |
| `PROMETHEUS_METRICS_TOKEN` | Metrics endpoint auth token (optional) |

---

## Monitoring & Alerting

| Variable | Notes |
|---|---|
| `SENTRY_DSN` | From sentry.io → Project → DSN |
| `SENTRY_DSN_FRONTEND` | Browser SDK DSN (can match backend) |
| `SENTRY_RELEASE` | Set via CI from `RAILWAY_GIT_COMMIT_SHA` |
| `SENTRY_TRACES_SAMPLE_RATE` | 0.0–1.0; use `0.1` in production |
| `SENTRY_PROFILES_SAMPLE_RATE` | Must be ≤ traces rate |
| `SLACK_WEBHOOK` | From Slack → Incoming Webhooks |
| `MEMORY_WARNING_THRESHOLD` | % (default 80) |
| `MEMORY_CRITICAL_THRESHOLD` | % (default 90) |
| `ERROR_RATE_THRESHOLD` | % (default 5) |
| `GA_MEASUREMENT_PROTOCOL_SECRET` | GA4 → Data Streams → Measurement Protocol API secrets |

---

## Feature Flags

| Variable | Default | Notes |
|---|---|---|
| `FEATURE_AI_LISTING` | `true` | AI-powered listing generation |
| `FEATURE_WHATNOT_INTEGRATION` | `true` | Whatnot platform support |
| `FEATURE_ADVANCED_ANALYTICS` | `true` | Advanced analytics tab visibility |

---

## Push Notifications — Firebase

| Variable | Notes |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase console → Project settings |
| `FIREBASE_PRIVATE_KEY` | Service account private key (JSON escaped) |
| `FIREBASE_CLIENT_EMAIL` | Service account email |

---

## Backup

| Variable | Notes |
|---|---|
| `DATABASE_PUBLIC_URL` | Railway public endpoint — used by CI backup scripts, not the app |
| `CLOUD_BACKUP_ENABLED` | `false` by default |
| `CLOUD_BACKUP_PROVIDER` | `s3` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | S3/Backblaze B2 credentials |

---

## Adding a New Variable

1. Add to `.env.example` with a placeholder value and inline comment
2. Add to this file under the appropriate section
3. Set in Railway Variables tab before deploying
4. If required for production, add to the Required table above

> See also: `CLAUDE.md` → "Environment variables are in `.env` — never hardcode secrets"
