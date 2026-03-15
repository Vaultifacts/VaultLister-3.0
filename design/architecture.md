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
│  SQLite 3     │   │  Side services (spawned per-request or       │
│  WAL mode     │   │  as background tasks)                        │
│  FTS5 index   │   │                                              │
│  on inventory │   │  ┌─────────────────┐  ┌──────────────────┐  │
│               │   │  │  Playwright bots │  │  Claude AI SDK   │  │
│  26 tables    │   │  │  poshmark-bot   │  │  listing gen     │  │
│  +indexes     │   │  │  mercari-bot    │  │  image analysis  │  │
└───────────────┘   │  │  depop-bot      │  │  price predict   │  │
                    │  │  grailed-bot    │  │  Vault Buddy     │  │
                    │  │  facebook-bot   │  └──────────────────┘  │
                    │  │  whatnot-bot    │                         │
                    │  └─────────────────┘                         │
                    │                                              │
                    │  ┌─────────────────────────────────────────┐ │
                    │  │  Platform sync (OAuth REST APIs)        │ │
                    │  │  eBay · Etsy · Shopify                  │ │
                    │  └─────────────────────────────────────────┘ │
                    └─────────────────────────────────────────────┘

Deployment: Docker container → Nginx reverse proxy → GitHub Actions CI/CD
```

---

## Architecture Decision Records

### ADR-001 — Bun.js over Node.js

**Decision:** Use Bun.js 1.3+ as the runtime.

**Rationale:** Bun provides built-in HTTP server and WebSocket support, native SQLite bindings, and measurably faster startup than Node.js. It runs the same JS/ESM code without a separate transpile step. For a self-hosted single-binary server, startup speed and the reduced dependency surface matter more than ecosystem breadth.

**Trade-offs accepted:** Bun is younger than Node.js; some Node ecosystem packages need compatibility shims. The `better-sqlite3` native addon still requires node-gyp on first install.

---

### ADR-002 — Vanilla JS SPA over React/Vue/Svelte

**Decision:** No JS framework. Route-based chunk loading via dynamic `import()`.

**Rationale:** Zero bundle overhead. The SPA is served as static files from `public/` and lazy-loads page modules on navigation. No virtual DOM diffing or hydration cost. State lives in a single `store` object in `app.js` with explicit `persist()` / `hydrate()` for localStorage. This is viable because the UI surface is primarily forms and tables, not reactive component trees.

**Trade-offs accepted:** Manual DOM manipulation in page modules. Any future team member must understand the `store` contract before touching `app.js`.

**Risk:** `app.js` is a single large file and a risk concentration point. All auth-related changes require running `auth.test.js` before commit.

---

### ADR-003 — SQLite over PostgreSQL

**Decision:** SQLite 3 with WAL mode and FTS5.

**Rationale:** VaultLister is self-hosted by a single user or small team. SQLite in WAL mode handles concurrent reads well and serializes writes with negligible contention at this scale. No separate DB server process to manage. FTS5 virtual table provides full-text search over inventory (title, description, brand, tags) without an external search service. All IDs are TEXT (UUIDs) to avoid integer-sequence coupling.

**Trade-offs accepted:** No horizontal scaling of the DB layer. If the product ever moves to a multi-tenant SaaS model, a migration to PostgreSQL would be required.

---

### ADR-004 — Playwright for marketplace automations

**Decision:** Playwright headless bots for platforms without a public API.

**Platforms affected:** Poshmark, Mercari, Depop, Grailed, Facebook Marketplace, Whatnot.

**Rationale:** These platforms provide no public seller API. Playwright allows automated listing creation, closet sharing, follow-back, and offer management by driving the web UI. Bot scripts live in `src/shared/automations/` and are spawned as child processes from the publish services to avoid Playwright's internal timeouts affecting the main Bun server.

**Safety constraints:** Bots must read credentials from `.env` only. All actions log to `data/automation-audit.log`. Rate limits are defined in `src/shared/automations/rate-limits.js` with ±30% jitter. Any CAPTCHA or bot detection stops the bot immediately — no bypass attempts.

---

### ADR-005 — @anthropic-ai/sdk for AI features

**Decision:** Claude API via `@anthropic-ai/sdk` for all AI-powered features.

**Features:** Listing title and description generation, image analysis and tagging, price prediction, Vault Buddy conversational assistant.

**Rationale:** Claude produces high-quality structured text suitable for marketplace listings. All AI calls route through `src/shared/ai/` — no direct SDK calls from route handlers. This isolates prompt engineering and token management from the request/response cycle.

**Trade-offs accepted:** API cost per AI call. Requires `ANTHROPIC_API_KEY` in `.env`. Offline mode degrades gracefully — AI features are unavailable but core inventory and listing functions continue.

---

## Directory Structure (key paths)

```
src/
  backend/
    server.js              — Bun HTTP entry point
    routes/                — 67 route files (one per domain)
    middleware/            — auth, rateLimiter, CSRF, securityHeaders
    db/
      schema.sql           — single source of truth for all tables
      database.js          — better-sqlite3 connection + WAL init
      migrations/          — numbered migration files
    services/
      platformSync/        — per-platform publish + sync handlers
      websocket.js         — real-time WebSocket service
  frontend/
    app.js                 — SPA entry: store, router, api client
    pages/                 — lazy-loaded page modules
    handlers/              — event handler modules grouped by domain
  shared/
    ai/                    — all Claude SDK interactions
    automations/           — Playwright bot files + rate-limits.js
public/                    — static assets served by Bun
e2e/                       — Playwright E2E test files
```
