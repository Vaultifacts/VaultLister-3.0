# VaultLister 3.0 — Design Documentation

Zero-cost, offline-capable multi-channel reselling platform. Lists to 9 marketplaces,
manages inventory, and automates reseller workflows via AI-powered tools.

## Documents

| File | Contents |
|------|----------|
| [architecture.md](architecture.md) | System architecture, ADRs, component diagram |
| [data-model.md](data-model.md) | All 26 DB tables, purposes, and key relationships |
| [api-overview.md](api-overview.md) | All 67 route files grouped by domain |
| [platform-integrations.md](platform-integrations.md) | All 9 platform integrations: auth, publish, sync, bots |

## Key Facts

- **Runtime:** Bun.js 1.3+ (not Node.js)
- **Frontend:** Vanilla JS SPA — no framework, route-based chunk loading
- **Database:** SQLite 3 (WAL mode + FTS5 full-text search on inventory)
- **Auth:** JWT (15-min access / 7-day refresh) + bcryptjs + TOTP MFA + OAuth 2.0
- **AI:** @anthropic-ai/sdk — listing generation, image analysis, price predictions, Vault Buddy chat
- **Automations:** Playwright headless bots for platforms with no public API
- **Deploy:** Docker + Nginx (self-hosted) + GitHub Actions CI/CD

## Source of Truth

For canonical entity names and API contracts, see `CLAUDE.md` and `src/backend/db/schema.sql`.
The existing `ARCHITECTURE.md` at the project root covers the operational control plane (runbook/gate system).
