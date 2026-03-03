# Source Code Rules — VaultLister 3.0
> Auto-loaded by Claude Code when editing files in src/. These rules take precedence over CLAUDE.md for source editing.

## Naming
- Entity names must match canonical names exactly: InventoryItem, Listing, Sale, Offer, Automation, Platform, PriceHistory, ImageAsset, Analytics, Report, User, Session, Notification, Tag, AuditLog
- Screen names must match canonical terms: Inventory, Cross-Lister, Automations, Offers, Analytics, Sales, Image Bank — never Dashboard, Home, or Item List
- API routes: `/api/[resource-name]` kebab-case (e.g., `/api/inventory`, `/api/cross-list`)
- File names: kebab-case (e.g., `inventory-routes.js`, `offer-service.js`)
- Never use synonyms, abbreviations, or camelCase for canonical entity names in route handlers

## Web Full-Stack (Bun.js + Vanilla JS) Conventions
- Backend routes live in `src/backend/routes/` — one file per domain
- Middleware stack lives in `src/backend/middleware/` — never inline middleware in route files
- Frontend SPA entry: `src/frontend/app.js` — do NOT add new global state management patterns
- Frontend route pages: `src/frontend/pages/` — lazy-loaded; each page is a self-contained module
- Frontend handlers: `src/frontend/handlers/` — event handlers grouped by domain
- Shared utilities: `src/shared/` — no route-specific or frontend-specific code in this layer
- All AI interactions go through `src/shared/ai/` — never call @anthropic-ai/sdk directly from routes
- All Playwright automations live in `src/shared/automations/` — never inline browser code in routes

## Security Rules (Non-Negotiable)
- Always escape user content with `escapeHtml()` before rendering in the DOM
- Never store raw tokens in localStorage without the existing `store.persist()` / `store.hydrate()` pattern
- All POST/PUT/PATCH/DELETE routes must validate CSRF token via `validateCsrf()` middleware
- Parameterized queries only — never string-interpolate user input into SQL
- Rate limiting via `rateLimiter()` middleware is required on all auth and public-facing routes
- OAuth tokens from marketplace APIs must be encrypted with AES-256-CBC before SQLite storage

## Automation Safety Rules
- Playwright bots must read credentials from `.env` only — never accept credentials as function arguments
- All automation actions must be logged to `data/automation-audit.log`
- Bots must respect platform-specific rate limits (see `src/shared/automations/rate-limits.js`)
- Never run two automations against the same platform simultaneously
- Any CAPTCHA detection must stop the bot and alert the user — never attempt to bypass

## Modification Rules
- Do not refactor code outside the scope of the requested change
- Do not add type annotations, docstrings, or comments to code you did not modify
- Do not change import order or formatting in untouched files
- Do not create new global state patterns — use the existing `store` object in app.js
- SQLite: always use WAL mode and parameterized statements; never raw string queries
