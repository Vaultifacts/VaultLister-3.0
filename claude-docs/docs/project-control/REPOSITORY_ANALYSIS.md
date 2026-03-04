# REPOSITORY ANALYSIS

Generated: 2026-03-04
Source: STATE_SNAPSHOT.md + codebase inspection

---

## Identity

| Field | Value |
|-------|-------|
| Name | VaultLister 3.0 |
| Purpose | Zero-cost, offline-capable multi-channel reselling platform |
| Runtime | Bun.js 1.3+ |
| Database | SQLite 3 (WAL mode, FTS5) |
| Frontend | Vanilla JS SPA (route-based chunking, no framework) |
| Auth | JWT (15-min access / 7-day refresh) + bcryptjs + TOTP MFA |
| AI | @anthropic-ai/sdk (Claude) for listing gen, image analysis, pricing |
| Automations | Playwright headless bots for marketplace actions |
| Deploy target | Docker + Nginx (self-hosted) + GitHub Actions CI/CD |
| Repo | https://github.com/Vaultifacts/VaultLister-3.0.git |
| Branch | master (42 commits ahead of origin, unpushed) |

---

## Scale

| Metric | Count |
|--------|-------|
| Total JS files | 608 |
| Total LOC (JS) | ~396,000 |
| SQL migrations | 96 |
| Backend routes | 65 modules (~36,700 LOC) |
| Backend services | 43 modules (~15,600 LOC) |
| Middleware | 7 modules (~47,000 LOC) |
| Frontend pages | 11 modules (~36,000 LOC) |
| Frontend handlers | 11 modules (~60,000 LOC) |
| Test files | 271 |
| npm scripts | 45 |
| Marketplace integrations | 9 (eBay, Etsy, Poshmark, Mercari, Depop, Grailed, Shopify, Facebook, Whatnot) |
| Development sessions | 28+ |
| Features implemented | 936+ |

---

## Largest Files (risk concentration)

| File | LOC | Role | Risk |
|------|-----|------|------|
| app.js | 71,808 | SPA entry, state, router, handlers monolith | HIGH — single point of failure, merge conflicts |
| handlers-deferred.js | 28,021 | Deferred handler source-of-truth | HIGH — must stay synced with chunk files |
| core-bundle.js | 27,762 | Frontend utilities bundle | MEDIUM |
| pages-deferred.js | 17,240 | Deferred page source-of-truth | MEDIUM — must stay synced with chunk files |
| handlers-inventory-catalog.js | 11,401 | Inventory + automations handlers | MEDIUM |
| rateLimiter.js (middleware) | 9,707 | Rate limiting | LOW — stable, rarely changed |

---

## Three-File Sync Pattern (critical operational constraint)

All frontend changes must be applied to 3 parallel file sets:
1. **Chunk file** (e.g., `handlers-inventory-catalog.js`) — live route-loaded code
2. **Deferred file** (e.g., `handlers-deferred.js`) — source-of-truth for deferred loading
3. **app.js** — monolith fallback

Desynchronization between these files is the #1 source of UI bugs. Any tooling or process that modifies frontend code must account for this.

---

## Git State

- **Branch:** master
- **Ahead of origin:** 42 commits (UNPUSHED)
- **Unstaged changes:** claude-docs/CLAUDE.md modified, docs/ARCHITECTURE.md deleted
- **Untracked:** claude-docs/PROJECT_BRAIN.md, claude-docs/docs/project-control/, scripts/state_snapshot.ps1

---

## Test Health (last known)

| Suite | Pass | Fail | Notes |
|-------|------|------|-------|
| Full suite | 4,898 | 372 | Pre-existing failures, mostly worker-taskWorker-coverage and CSRF test-mode issues |
| Auth + Security | 44 | 14 | CSRF failures are test-mode configuration issue (DISABLE_CSRF not suppressing all checks) |

The 372 failures are pre-existing and do not regress with feature changes. However, this is a deployment blocker — any CI gate will reject the build.

---

## Environment Dependencies

| Dependency | Required | Status |
|------------|----------|--------|
| Bun 1.3+ | Yes | Installed |
| SQLite | Yes | Built into Bun |
| ANTHROPIC_API_KEY | Yes (AI features) | In .env |
| JWT_SECRET | Yes | In .env |
| eBay OAuth credentials | Optional | Sandbox verified |
| Etsy OAuth credentials | Optional | Needs real-mode .env |
| Playwright browsers | Optional (automations) | Installed |
| Redis | Optional (production caching) | docker-compose only |
| Docker | Optional (deployment) | Dockerfile exists |

---

## Key Architectural Decisions

| ADR | Decision | Trade-off |
|-----|----------|-----------|
| ADR-001 | Bun.js (not Node.js) | Faster, but smaller community |
| ADR-002 | Vanilla JS SPA (no framework) | Zero overhead, but more boilerplate |
| ADR-003 | SQLite over PostgreSQL | Local-first, but single-writer |
| ADR-004 | Playwright for marketplace bots | Works without APIs, but fragile to UI changes |
| ADR-005 | Claude for AI features | Best multimodal, but API cost per listing |
