# VaultLister 3.0

Zero-cost, offline-capable multi-channel reselling platform. List to 9+ marketplaces, manage inventory, automate workflows with AI.

## Tech Stack
- **Runtime:** Bun.js 1.3+ (server + package manager)
- **Frontend:** Vanilla JS SPA (route-based chunking, no framework)
- **Database:** PostgreSQL (WAL mode, TSVECTOR full-text search, postgres npm)
- **Automations:** Playwright (stealth mode) for marketplace bots
- **AI:** Claude API (@anthropic-ai/sdk) for listings, pricing, predictions
- **Auth:** JWT + bcrypt + TOTP MFA + OAuth 2.0 (eBay, Etsy, Shopify)
- **Deploy:** Railway + Cloudflare + GitHub Actions CI/CD

## Prerequisites
- Bun 1.3+ (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 20+ (for Playwright and some scripts)
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
| `bun run db:reset` | Reset database (destructive) |
| `bun run db:backup` | Backup database |
| `bun run build` | Build frontend bundle |
| `node scripts/visual-test.js` | Run visual regression tests |

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Section | Variables | Required |
|---------|-----------|----------|
| Core | `JWT_SECRET`, `PORT` | Yes |
| Database | `DATA_DIR` | No (defaults to ./data) |
| AI | `ANTHROPIC_API_KEY` | For AI features |
| eBay | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI` | For eBay OAuth |
| Poshmark | `POSHMARK_USERNAME`, `POSHMARK_PASSWORD` | For Poshmark bots |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | For billing |
| Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | For push notifications |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Drive/Calendar |
| Redis | `REDIS_PASSWORD` | For Docker deploy |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | For email |

## Database Migrations

Migrations run automatically on server start. To run manually:
```bash
bun run db:init    # Applies all pending migrations
```

The migration chain is in `src/backend/db/database.js` (112 migrations). Schema is in `src/backend/db/pg-schema.sql`.

## Git Hooks

The pre-push hook runs the full unit test suite and requires the server to be running on `PORT` (default 3000). Before pushing:
```bash
bun run dev:bg   # Start server in background
git push         # Hook will run tests then push
bun run dev:stop # Stop background server after push
```

## Deployment

### Docker (Staging/Production)
```bash
# Build and push
git push origin master:staging   # Triggers GitHub Actions deploy

# Manual deploy on server
ssh ubuntu@server "bash /opt/vaultlister-staging/deploy.sh"
```

### Requirements
- Docker + Docker Compose
- GHCR access (GitHub Container Registry)
- Nginx reverse proxy (config in `nginx/nginx.staging.conf`)
- SSL via Let's Encrypt (Certbot)

## Project Structure
```
src/
  backend/          # Bun HTTP server, routes, middleware, services
    routes/         # API route handlers (67 files)
    middleware/     # Auth, CSRF, rate limiting, security headers
    services/      # Platform sync, notifications, billing
    workers/       # Task worker, price check worker
    db/            # Schema, migrations (104), database.js
  frontend/        # Vanilla JS SPA
    core/          # Router, store, API client, toast
    pages/         # Route pages (lazy-loaded)
    handlers/      # Event handlers by domain
    ui/            # Modals, widgets, components
  shared/          # Cross-cutting code
    ai/            # Claude SDK integration
    automations/   # Playwright marketplace bots
    utils/         # Blockchain, AR preview
e2e/               # Playwright E2E tests (54 spec files, 761 tests)
scripts/           # CLI tools (build, backup, scheduler)
chrome-extension/  # MV3 Chrome extension
```

## Testing

- **Unit tests:** 58+ test files in `src/tests/` (Bun:test)
- **E2E tests:** 54 spec files in `e2e/tests/` (Playwright, 761 tests)
- **Visual tests:** `node scripts/visual-test.js`
- **Baseline:** 747/761 passing (14 conditionally skipped)

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
| Depop | Credentials | Playwright | Playwright | Relist |
| Grailed | Credentials | Playwright | Playwright | Bump |
| Etsy | OAuth (PKCE) | REST API | REST API | — |
| Shopify | Access Token | Admin API | Admin API | — |
| Facebook | Credentials | Playwright | Playwright | — |
| Whatnot | Credentials | Playwright | Playwright | Shows |

## Health Checks
- `GET /api/health` — Quick liveness (public)
- `GET /api/health/detailed` — Full system check (authenticated)

## License
Proprietary. All rights reserved.
