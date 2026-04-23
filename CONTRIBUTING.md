# Contributing to VaultLister 3.0

## Development Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET, DATA_DIR, and NODE_ENV=development

# 3. Initialize the database
bun run db:init
bun run db:seed        # optional: seed with test data

# 4. Start the development server
bun run dev            # runs on http://localhost:3000
```

**Additional setup for specific features:**

- AI features (listing generation, Vault Buddy): set `ANTHROPIC_API_KEY` in `.env`
- Marketplace automations: install Playwright browsers — `bunx playwright install chromium`
- Marketplace OAuth (eBay, Etsy): see `docs/SETUP.md` for per-platform credential setup

---

## Code Conventions

**File naming:** kebab-case for all files (`inventory-routes.js`, `offer-service.js`). No camelCase filenames.

**Entity names:** Use the canonical names exactly — no synonyms, abbreviations, or alternate capitalizations:

> InventoryItem, Listing, Sale, Offer, Automation, Platform, PriceHistory, ImageAsset, Analytics, Report, User, Session, Notification, Tag, AuditLog

**Source layout:**

| Path | What goes here |
|------|---------------|
| `src/backend/routes/` | Route handlers — one file per domain |
| `src/backend/middleware/` | Middleware — never inline in route files |
| `src/frontend/pages/` | SPA pages — lazy-loaded, self-contained |
| `src/frontend/handlers/` | Event handlers grouped by domain |
| `src/shared/ai/` | All Anthropic SDK calls |
| `src/shared/automations/` | All Playwright automation code |

**Do not:**

- Add type annotations, docstrings, or comments to code you did not modify
- Refactor code outside the scope of your change
- Create new global state patterns — use the existing `store` object in `src/frontend/core/store.js`
- Use raw string interpolation in SQL — parameterized queries only
- Store credentials anywhere except `.env`

---

## Branch Naming

| Prefix | Use for |
|--------|---------|
| `feature/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `chore/` | Tooling, dependencies, config |

Examples: `feature/bulk-listing-export`, `fix/csrf-token-refresh`, `docs/api-routes`

---

## Commit Conventions

This repo uses **Conventional Commits**. Format:

```
<type>: <short description>
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`

**For Claude Code automated commits**, prefix with `[AUTO]`:

```
[AUTO] fix: correct CSRF token validation on refresh endpoint
[AUTO] feat: add WAL checkpoint cron documentation
```

**Rules:**

- Never commit `.env`, secrets, or credentials
- Use `git add <specific-files>` — never `git add -A` or `git add .`
- Never force-push to `main`/`master`
- Never use `--no-verify` to skip pre-commit hooks
- Never amend published commits

---

## Testing Requirements

Run these before every commit. The pre-commit hook enforces them:

```bash
# Auth and security tests are mandatory before any commit
bun test src/tests/auth.test.js src/tests/security.test.js

# If you modified backend routes, also run the relevant test file
bun test src/tests/<domain>.test.js

# Full unit test suite
bun run test:unit

# E2E tests (run before opening a PR that touches user-facing flows)
bun run test:e2e
```

**Coverage requirement:** Line coverage must stay at or above 60% (enforced in CI).

**Do not:**

- Delete failing tests to make the suite pass
- Mark tests as known-fail in `.test-baseline` without explaining why in the PR description
- Write tests against live marketplace websites — use mock HTML fixtures

---

## Pull Request Process

1. Create a branch from `master` using the naming conventions above.
2. Make your changes. Update `memory/STATUS.md` if work spans multiple sessions.
3. Run the mandatory test commands listed above — all must pass.
4. Open a PR against `master`. The CI pipeline must be green before merge:
   - Lint (syntax check)
   - Unit tests + 60% coverage
   - E2E guardian tests
   - Security scan + secret check
   - Dependency audit (no high-severity CVEs)
   - Docker build
5. Add a description that explains the why, not just the what.
6. If your PR touches auth (`src/frontend/core/store.js` or `src/frontend/core/api.js`), security headers (`src/backend/middleware/securityHeaders.js`), or the database schema, note this explicitly — these files require extra review care.

PRs are squash-merged to keep `master` history clean.

---

## Agent Boundaries

Eleven specialized agents operate in this repo. Direct work to the right agent to avoid scope conflicts:

| Agent | Owns | Never touches |
|-------|------|--------------|
| **Architect-Planner** | Architecture decisions, folder structure, tech stack, design reviews | Writing code |
| **Backend** | Routes, middleware, database, auth, API endpoints | Frontend, AI calls, testing |
| **Frontend-UI** | Vanilla JS SPA, UI components, accessibility | Backend, database |
| **Automations-AI** | Anthropic SDK, Playwright bots, external APIs | Routes, frontend |
| **Security-Auth** | Auth flows, JWT, rate-limiting, OWASP, secret management | Business logic, UI |
| **Testing** | Bun:test unit tests, Playwright E2E, visual tests, coverage | Application code |
| **DevOps-Deployment** | Docker, CI/CD, `.env.example`, backups, scaling, logging | `src/`, `tests/`, `e2e/` |
| **NoCode-Workflow** | n8n, webhooks, JSON exports, external triggers | JavaScript code |
| **Marketplace-Integration** | `src/shared/marketplaces/`, per-platform OAuth/API/bots, rate limiting, credential encryption | Frontend, general routes, sync orchestration, AI pipeline |
| **Data-Sync-Orchestrator** | `src/backend/services/syncOrchestrator/`, sync state machine, conflict resolution, audit trail, rollback | Platform API calls, frontend, general routes |
| **AI-Listing-Pipeline** | `src/shared/ai/listing-pipeline/`, prompt versioning, cost tracking, quality validation, batch generation | Marketplace API calls, inventory sync, frontend, general routes |

If a change spans two agents (e.g. a new API endpoint that also needs a UI page), make two separate commits and describe the boundary in the PR.
