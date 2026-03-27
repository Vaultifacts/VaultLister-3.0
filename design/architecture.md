# VaultLister 3.0 — System Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Vanilla JS SPA)                                       │
│  app.js → pages/*.js (lazy-loaded) → handlers/*.js             │
│  WebSocket client (real-time notifications)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP / WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│  Bun HTTP Server  (src/backend/server.js)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Middleware chain                                          │ │
│  │  securityHeaders → rateLimiter → auth → CSRF → routes     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  67 Route files  │  │  Domain services  │  │  WebSocket    │  │
│  │  src/backend/   │  │  src/backend/    │  │  service      │  │
│  │  routes/        │  │  services/       │  └───────────────┘  │
│  └─────────────────┘  └──────────────────┘                     │
└───────┬───────────────────────┬─────────────────────────────────┘
        │                       │
┌───────▼───────┐   ┌───────────▼─────────────────────────────────┐
│  PostgreSQL   │   │  Side services (spawned per-request or       │
│  (Railway     │   │  as background tasks)                        │
│  managed)     │   │                                              │
│  TSVECTOR+GIN │   │  ┌─────────────────┐  ┌──────────────────┐  │
│  for FTS      │   │  │  Playwright bots │  │  Claude AI SDK   │  │
│               │   │  │  worker/bots/   │  │  listing gen     │  │
│  189 tables   │   │  │  poshmark-bot   │  │  image analysis  │  │
│  +indexes     │   │  │  mercari-bot    │  │  price predict   │  │
└───────────────┘   │  │  depop-bot      │  │  Vault Buddy     │  │
                    │  │  grailed-bot    │  └──────────────────┘  │
                    │  │  facebook-bot   │                         │
                    │  │  whatnot-bot    │                         │
                    │  └─────────────────┘                         │
                    │                                              │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │  Platform sync (OAuth REST APIs)        │ │
                    │  │  eBay · Etsy · Shopify                  │ │
                    │  └─────────────────────────────────────────┘ │
                    └─────────────────────────────────────────────┘

Deployment: Cloudflare → Railway (managed PaaS) → GitHub Actions CI/CD
```

---

## Architecture Decision Records

### ADR-001 — Bun.js over Node.js

**Decision:** Use Bun.js 1.3+ as the runtime.

**Rationale:** Bun provides built-in HTTP server and WebSocket support, measurably faster startup than Node.js, and broad npm package compatibility including the `postgres` npm package. It runs the same JS/ESM code without a separate transpile step.

**Trade-offs accepted:** Bun is younger than Node.js; some Node ecosystem packages need compatibility shims. The `postgres` npm package is used for PostgreSQL access (not Bun's deprecated bun:sqlite).

---

### ADR-002 — Vanilla JS SPA over React/Vue/Svelte

**Decision:** No JS framework. Route-based chunk loading via dynamic `import()`.

**Rationale:** Zero bundle overhead. The SPA is served as static files from `public/` and lazy-loads page modules on navigation. No virtual DOM diffing or hydration cost. State lives in a single `store` object in `app.js` with explicit `persist()` / `hydrate()` for localStorage. This is viable because the UI surface is primarily forms and tables, not reactive component trees.

**Trade-offs accepted:** Manual DOM manipulation in page modules. Any future team member must understand the `store` contract before touching `app.js`.

**Risk:** `app.js` is a single large file and a risk concentration point. All auth-related changes require running `auth.test.js` before commit.

---

### ADR-003 — SQLite over PostgreSQL (**SUPERSEDED by ADR-012**)

**Status: Superseded — March 2026**

This decision was superseded by the PostgreSQL migration. See **ADR-012** for the replacement decision.

**Original decision:** SQLite 3 with WAL mode and FTS5 for local-first single-user deployment.

**Why superseded:** As VaultLister moved toward multi-tenant SaaS and Railway hosting, SQLite's lack of horizontal scaling and connection pooling became blockers. PostgreSQL with TSVECTOR+GIN replaces FTS5. All IDs remain TEXT (UUIDs).

---

### ADR-004 — Playwright for marketplace automations

**Decision:** Playwright headless bots for platforms without a public API.

**Platforms affected:** Poshmark, Mercari, Depop, Grailed, Facebook Marketplace, Whatnot.

**Rationale:** These platforms provide no public seller API. Playwright allows automated listing creation, closet sharing, follow-back, and offer management by driving the web UI. Bot scripts live in `src/shared/automations/` and are spawned as child processes from the publish services to avoid Playwright's internal timeouts affecting the main Bun server.

**Safety constraints:** Bots must read credentials from `.env` only. All actions log to `data/automation-audit.log`. Rate limits are defined in `worker/bots/rate-limits.js` with ±30% jitter. Any CAPTCHA or bot detection stops the bot immediately — no bypass attempts.

---

### ADR-005 — @anthropic-ai/sdk for AI features

**Decision:** Claude API via `@anthropic-ai/sdk` for all AI-powered features.

**Features:** Listing title and description generation, image analysis and tagging, price prediction, Vault Buddy conversational assistant.

**Rationale:** Claude produces high-quality structured text suitable for marketplace listings. All AI calls route through `src/shared/ai/` — no direct SDK calls from route handlers. This isolates prompt engineering and token management from the request/response cycle.

**Trade-offs accepted:** API cost per AI call. Requires `ANTHROPIC_API_KEY` in `.env`. Offline mode degrades gracefully — AI features are unavailable but core inventory and listing functions continue.

---

### ADR-012 — PostgreSQL over SQLite

**Decision:** Migrate from SQLite to PostgreSQL. **Status: Accepted (March 2026)**

**Rationale:** Horizontal scaling for multi-tenant SaaS, Railway managed PostgreSQL, connection pooling via `postgres` npm, TSVECTOR + GIN replaces FTS5. See Notion for full rationale.

---

### ADR-013 — Railway for Production Hosting

**Decision:** Railway managed PaaS over self-hosted Docker + Nginx. **Status: Accepted (March 2026)**

**Rationale:** Managed PostgreSQL and Redis included, auto-deploy from GitHub, no server ops burden. Cloudflare handles CDN and SSL termination.

---

### ADR-014 — Resend for Transactional Email

**Decision:** Resend API over SMTP. **Status: Accepted (March 2026)**

**Rationale:** Reliable deliverability, simple API, generous free tier. `RESEND_API_KEY` in `.env`.

---

### ADR-015 — Cloudflare R2 for Image Storage

**Decision:** Cloudflare R2 over local filesystem or AWS S3. **Status: Accepted (March 2026)**

**Rationale:** Zero egress fees, S3-compatible API, integrated with Cloudflare CDN. Falls back to `IMAGE_STORAGE=local` in development.

---

### ADR-016 — BullMQ + Redis for Background Jobs

**Decision:** BullMQ queue over in-process task worker. **Status: Accepted (March 2026)**

**Rationale:** Persistent job queue survives process restarts, retry logic, job priorities, separate worker container for Playwright bots.

---

### ADR-017 — Backblaze B2 for Database Backups

**Decision:** Backblaze B2 over AWS S3 for pg_dump archive storage. **Status: Accepted (March 2026)**

**Rationale:** Lowest cost object storage, S3-compatible API, Railway cron job triggers nightly pg_dump + B2 upload.

---

## Directory Structure (key paths)

```
src/
  backend/
    server.js              — Bun HTTP entry point
    routes/                — 67 route files (one per domain)
    middleware/            — auth, rateLimiter, CSRF, securityHeaders
    db/
      pg-schema.sql        — single source of truth for all 189 tables
      database.js          — postgres npm connection + pool init
      migrations/          — 112 numbered migration files
    services/
      platformSync/        — per-platform publish + sync handlers
      websocket.js         — real-time WebSocket service
  frontend/
    app.js                 — SPA entry: store, router, api client
    pages/                 — lazy-loaded page modules
    handlers/              — event handler modules grouped by domain
  shared/
    ai/                    — all Claude SDK interactions
worker/
    index.js               — BullMQ worker entry point
    bots/                  — Playwright bot files + rate-limits.js
public/                    — static assets served by Bun
e2e/                       — Playwright E2E test files
```
