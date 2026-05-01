# VaultLister 3.0

Zero-cost, offline-capable multi-channel reselling platform. List to 9 marketplaces, manage inventory, automate workflows with AI.

## Tech Stack
- **Runtime:** Bun.js 1.3+ (server + package manager)
- **Frontend:** Vanilla JS SPA (route-based chunking, no framework)
- **Database:** PostgreSQL (TSVECTOR full-text search, postgres npm)
- **Automations:** Playwright (stealth mode) for marketplace bots
- **AI:** Claude API (@anthropic-ai/sdk) for listings, pricing, predictions
- **Auth:** JWT + bcryptjs + TOTP MFA + OAuth 2.0 (eBay, Etsy, Depop, Shopify)
- **Deploy:** Railway + Cloudflare + GitHub Actions CI/CD

## Prerequisites
- Bun 1.3+ (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 18+ (for Playwright and some scripts)
- Git 2.30+

## Quick Start
```bash
git clone https://github.com/Vaultifacts/VaultLister-3.0.git
cd vaultlister-3
cp .env.example .env        # Edit with your keys
bun install
bun run db:init              # Create database + run migrations
bun run db:seed              # Seed demo data
bun run dev                  # Start at http://localhost:3000
```

## Key Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server (port 3000) |
| `bun run dev:bg` | Start server in background |
| `bun run dev:stop` | Stop background server |
| `bun run test:all` | Run unit + E2E tests |
| `bun run test:unit` | Run Bun unit tests |
| `bun run test:e2e` | Run Playwright E2E tests |
| `bun run lint` | ESLint check (backend + shared) |
| `bun run db:init` | Initialize database |
| `bun run db:seed` | Seed demo data |
| `bun run db:reset` | Re-apply migrations and seeds |
| `bun run db:backup` | Backup database |
| `bun run build` | Build frontend bundle |
| `node scripts/visual-test.js` | Run visual regression tests |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Section | Variables | Required |
|---------|-----------|----------|
| Core | `JWT_SECRET`, `PORT` | Yes |
| Database | `DATABASE_URL` | Yes |
| AI | `ANTHROPIC_API_KEY` | For AI features |
| eBay | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI` | For eBay OAuth |
| Poshmark | `POSHMARK_USERNAME`, `POSHMARK_PASSWORD` | For Poshmark bots |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | For billing |
| Push | `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` | For push notifications |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Drive/Calendar |
| Redis | `REDIS_PASSWORD` | For Docker deploy |
| Email | `RESEND_API_KEY` | Resend transactional email |

## Database Migrations

Migrations run automatically on server start. To run manually:
```bash
bun run db:init    # Applies all pending migrations
```

The migration chain is in `src/backend/db/migrations.js` (32 migrations). Schema is in `src/backend/db/pg-schema.sql`.

## Git Hooks

The pre-push hook runs the full unit test suite and requires the server to be running on `PORT` (default 3000). Before pushing:
```bash
bun run dev:bg   # Start server in background
git push         # Hook will run tests then push
bun run dev:stop # Stop background server after push
```

## Deployment

### Deployment Status
```bash
# Production deploy validation runs automatically on push to master/main.
# Railway then auto-deploys from GitHub after CI + smoke checks pass.
```

### Requirements
- Railway project access
- GitHub Actions access
- Required production env vars configured in Railway
- PostgreSQL + Redis services attached to the Railway project

### Railway Production
- `vaultlister-app` serves HTTP/WebSocket traffic.
- `vaultlister-worker` runs BullMQ automation jobs plus the moved background schedulers/workers.
- Railway PostgreSQL backs the app and worker via `DATABASE_URL`.
- Railway Redis is required in production for BullMQ, worker heartbeats, and cross-replica WebSocket fanout via `REDIS_URL`.

Required production env vars:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `OAUTH_ENCRYPTION_KEY`
- `OAUTH_MODE=real`
- platform-specific OAuth/bot credentials as needed

Worker deployment notes:
- The worker service uses [`worker/railway.json`](worker/railway.json) and [`worker/Dockerfile`](worker/Dockerfile).
- The worker Dockerfile path must be set to `worker/Dockerfile` in Railway.
- The worker service must share the same `DATABASE_URL` and `REDIS_URL` as the app service.

### Production Operations
- App readiness: `GET /api/health/ready`
- Worker heartbeats: `GET /api/workers/health`
- Local production smoke:

```bash
bun scripts/launch-ops-check.mjs https://vaultlister.com --task-queue --queue-metrics --json
```

- GitHub Actions runs `.github/workflows/production-smoke.yml` every 15 minutes and after successful deploys.
- If production smoke fails, GitHub automatically opens or updates a `production-smoke-failure` issue with the failing run link.

## Project Structure
```
src/
  backend/          # Bun HTTP server, routes, middleware, services
    routes/         # API route handlers (77 files)
    middleware/     # Auth, CSRF, rate limiting, security headers
    services/      # Platform sync, notifications, billing
    workers/       # Task worker, price check worker
    db/            # Schema, migrations (32), database.js
  frontend/        # Vanilla JS SPA
    core/          # Router, store, API client, toast
    pages/         # Route pages (lazy-loaded)
    handlers/      # Event handlers by domain
    ui/            # Modals, widgets, components
  shared/          # Cross-cutting code
    ai/            # Claude SDK integration
    automations/   # Automation orchestration runner
    utils/         # Blockchain, AR preview
e2e/               # Playwright E2E tests (83 spec files)
scripts/           # CLI tools (build, backup, scheduler)
chrome-extension/  # MV3 Chrome extension
```

## Testing

- **Unit tests:** 321+ test files in `src/tests/` (Bun:test)
- **E2E tests:** 83 spec files in `e2e/tests/` (Playwright)
- **Visual tests:** `node scripts/visual-test.js`

Run chunked E2E suite:
```bash
PORT=3000 node scripts/run-e2e-chunks.js --summary
```

## Marketplace Integrations

| Platform | Auth | Publish | Sync | Bot |
|----------|------|---------|------|-----|
| Poshmark | Credentials | Playwright | Playwright | Share, follow, OTL |
| eBay | OAuth 2.0 | Sell API | Sell API | — |
| Mercari | Credentials | Playwright | Playwright | Relist |
| Depop | OAuth 2.0 | REST API | REST API | Refresh |
| Grailed | Credentials | Playwright | Playwright | Bump |
| Etsy | OAuth (PKCE) | REST API | REST API | — |
| Shopify | OAuth 2.0 | Admin API | Admin API | — |
| Facebook | Credentials | Playwright | Playwright | — |
| Whatnot | Credentials | Playwright | Playwright | Refresh |

## Health Checks
- `GET /api/health` — Quick liveness (public)
- `GET /api/health/detailed` — Full system check (public)

## License
Proprietary. All rights reserved.
