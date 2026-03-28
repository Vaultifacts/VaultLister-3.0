---
applyTo: "**"
---

# Copilot Code Review Instructions — VaultLister 3.0

## Stack
- Runtime: Bun.js 1.3+ (not Node.js)
- Frontend: Vanilla JS SPA (no framework), route-based lazy loading
- Database: PostgreSQL (postgres npm package) with TSVECTOR + GIN indices
- Auth: JWT (15-min access + 7-day refresh) + bcryptjs (12 rounds) + TOTP MFA
- Automations: Playwright headless bots in `worker/bots/`
- AI: @anthropic-ai/sdk (Claude) via `src/shared/ai/`
- Tests: Bun:test for unit tests, Playwright for E2E

## Review Focus Areas

### Security (Critical)
- All user content MUST use `escapeHtml()` before DOM rendering
- SQL queries MUST use parameterized statements — never string interpolation
- All query-by-id routes MUST include `AND user_id = ?` to prevent IDOR
- OAuth tokens MUST be encrypted with AES-256-GCM before database storage
- Never use bare `JSON.parse()` — use `safeJsonParse(str, fallback)`
- CSRF is enforced globally — do not add per-route CSRF checks
- Never remove `'unsafe-inline'` from CSP script-src or style-src

### Auth Integrity
- `store.persist()` MUST persist `token` and `refreshToken`
- `store.hydrate()` MUST restore `token` and `refreshToken`
- Never remove token fields from persist/hydrate — breaks "Remember Me"

### Database
- All ID columns use TEXT type (UUIDs, not INTEGER)
- Always use LIMIT on SELECT queries returning arrays
- Use `query.get()` for single row, `query.all()` for multiple, `query.run()` for mutations

### Code Quality
- File names: kebab-case (e.g., `inventory-routes.js`)
- Entity names: exact canonical — InventoryItem, Listing, Sale, Offer, Automation, Platform
- API routes: `/api/[resource-name]` kebab-case
- No unused imports, dead code, or commented-out stubs
- No `console.log` in backend — use structured logger from `src/backend/shared/logger.js`
- Prefer existing patterns over new abstractions

### Automation Safety
- Playwright bots must read credentials from `.env` only
- All bot actions must be logged to `data/automation-audit.log`
- Bots must respect rate limits in `worker/bots/rate-limits.js`
- CAPTCHA detection must stop the bot — never attempt bypass

### Testing
- Test port: `process.env.PORT || 3000` — never hardcode
- Mock all external dependencies (DB, Playwright, Anthropic SDK)
- Auth changes require: `bun test src/tests/auth.test.js`
- Security changes require: `bun test src/tests/security.test.js`
