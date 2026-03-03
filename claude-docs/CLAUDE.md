# Global Rules for Claude Code Assistant

> **Note:** For Claude Code session workflow, Notion integration, and daily work management, see `memory/MEMORY.md` (loaded automatically). This file covers code conventions, commands, architecture, and implementation history.

## Project Overview

**VaultLister** - Zero-cost, offline-capable multi-channel reselling platform for inventory management, cross-listing, and analytics.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun.js v1.3.6+ |
| Database | SQLite (WAL mode, FTS5) |
| Auth | JWT + bcryptjs |
| Frontend | Vanilla JS SPA (no framework) |
| Testing | Bun:test + Playwright |

---

## Project Structure

```
/
├── src/
│   ├── backend/         # Server, routes, middleware, services
│   ├── frontend/        # app.js (SPA), styles/
│   ├── shared/          # AI, automations, utils
│   └── tests/           # API and unit tests
├── e2e/                 # Playwright E2E tests
├── data/                # SQLite database
├── public/              # Static assets, uploads
├── scripts/             # Utility scripts
└── claude-docs/         # Documentation
    ├── CLAUDE.md        # This file (global rules)
    └── docs/
        ├── PRD.md       # Product requirements
        └── reference/   # Detailed reference docs
```

---

## Commands

| Task | Command |
|------|---------|
| Start server | `bun run dev` |
| Run all tests | `bun run test:all` |
| Run specific test | `bun test src/tests/[file].test.js` |
| Run E2E tests | `bun run test:e2e` |
| Reset database | `bun run db:reset` |
| Check DB health | `bun run scripts/checkDatabase.js` |
| Syntax check | `node -c src/frontend/app.js` |

**Testing with security disabled:**
```bash
DISABLE_CSRF=true DISABLE_RATE_LIMIT=true bun test
```

---

## Code Conventions

- **ES Modules** - `import`/`export` syntax
- **async/await** - All async operations
- **camelCase** - Variables and functions
- **PascalCase** - Classes only
- **UUIDs** - All IDs use TEXT type (never INTEGER)
- **Template literals** - For HTML rendering
- **escapeHtml()** - Always for user content (XSS prevention)

---

## Reusable Commands

**Quick Reference:** See `COMMAND_CHEATSHEET.md` for when to use each command.

| Command | Purpose |
|---------|---------|
| `/commit` | Smart git commits |
| `/pr` | Create pull requests |
| `/feature` | End-to-end feature implementation |
| `/migration` | Create database migrations |
| `/route` | Create backend API routes |
| `/page` | Create frontend pages |
| `/handler` | Create event handlers |
| `/test` | Run and fix tests |
| `/debug` | Systematic debugging |
| `/fix` | Quick fixes for common errors |
| `/evolve` | Turn bugs into system improvements |

**Full list:** See `docs/commands/README.md`

---

## Evolution System

**Every bug is an opportunity to improve.**

After completing features or fixing bugs, run `/evolve`:
1. Identify what went wrong or caused friction
2. Add rule to `evolution-rules.md` or create context doc
3. Log in `evolution-log.md`

| File | Purpose |
|------|---------|
| `docs/evolution-rules.md` | Quick-reference rules (check before coding) |
| `docs/evolution-log.md` | Chronological record of improvements |
| `docs/commands/evolve.md` | Full evolution workflow |

---

## Reference Documents

Load these on-demand based on your task:

| Task | Reference |
|------|-----------|
| API endpoints, routes | `docs/reference/api.md` |
| Backend architecture, services | `docs/reference/backend.md` |
| Frontend components, state, handlers | `docs/reference/frontend.md` |
| Database schema, migrations, queries | `docs/reference/database.md` |
| CSRF, rate limiting, auth | `docs/reference/security.md` |
| Test patterns, commands | `docs/reference/testing.md` |

**Usage:** Read the relevant reference doc before working on that area.

---

## Key Patterns

### API Route Pattern
```javascript
export async function routerName(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;
    return { status: 200, data: {...} };
}
```

### Database Query Pattern
```javascript
import { query } from '../db/database.js';
query.get(sql, params);   // Single row
query.all(sql, params);   // Multiple rows
query.run(sql, params);   // INSERT/UPDATE/DELETE
```

### State Update Pattern
```javascript
store.setState({ key: value });
renderApp(pages.currentPage());
```

---

## Critical Rules

1. **Never call `router.handleRoute()` from data loading functions** (causes infinite loops)
2. **Always use TEXT for ID columns** (UUIDs, not INTEGER)
3. **Always validate user input** before database operations
4. **Always escape HTML** for user-provided content
5. **Include CSRF token** for POST/PUT/PATCH/DELETE requests
6. **Run tests** after implementing new features
7. **Run /evolve** after bugs or friction - turn problems into improvements
8. **Check evolution-rules.md** before writing code - avoid repeated mistakes
9. **Update PRD.md** after completing features - keep "Recently Completed" and session count current
10. **Always provide next step suggestions** at the end of each implementation session or bug fix iteration

---

**Session log moved to `claude-docs/docs/progress.md`** — see that file for full implementation history (936+ implementations across 28 sessions).
