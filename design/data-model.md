# VaultLister 3.0 — Data Model

Source of truth: `src/backend/db/pg-schema.sql`
PostgreSQL (postgres npm, DATABASE_URL). IDs are TEXT (UUID). Full-text search via TSVECTOR + GIN index on inventory. 189 total tables across 112 migrations.

---

## Core Tables (18 original — 189 total including migration-added tables)

| Table | Purpose |
|-------|---------|
| `users` | Accounts — email, password hash, subscription tier (free/starter/pro/business), timezone, preferences JSON |
| `sessions` | Refresh token store — one row per device session; invalidated on logout |
| `shops` | Connected platform accounts — one row per user+platform pair; stores encrypted OAuth credentials and last sync state |
| `inventory` | Master item catalog — all reseller items regardless of where they are listed; source of truth for stock |
| `listings` | Platform-specific listing records — one row per inventory_item+platform combination |
| `sales` | Completed and in-progress orders — linked to listing and inventory; tracks net profit, shipping, fees |
| `offers` | Incoming buyer offers — tracks amount, counter-amount, status, and auto-action rules |
| `automation_rules` | User-defined automation configs — type (share/follow/offer/relist/price_drop/custom), schedule, conditions, actions |
| `automation_logs` | Execution history for automation_rules — success/failure/skipped per action |
| `tasks` | Background job queue — typed payloads, priority, retry counter, scheduled_at |
| `analytics_snapshots` | Daily per-platform metric snapshots — metrics stored as JSON |
| `notifications` | In-app notifications — typed, user-scoped, read/unread state |
| `sync_queue` | Offline action buffer — queued mutations that need to be pushed when connectivity is restored |
| `collaborations` | Community marketplace — listing shares, bundles, referrals, mentorships |
| `listing_templates` | Reusable listing configs — title patterns, description templates, pricing strategy, platform-specific settings |
| `sustainability_log` | Environmental impact tracking — water saved, CO2 saved, waste prevented per item sold |
| `alerts` | System-level monitoring alerts — acknowledged flag |
| `user_preferences` | Per-user key/value settings store — supplement to the JSON `preferences` column on `users` |

## Observability Tables (5)

| Table | Purpose |
|-------|---------|
| `security_logs` | Auth and security events — login failures, lockouts, suspicious activity |
| `request_logs` | HTTP request trace — method, path, status code, duration_ms, user_id |
| `error_logs` | Runtime errors — type, message, stack trace, request context |
| `audit_logs` | User action audit trail — action, resource_type, resource_id, IP address |

## Full-Text Search

PostgreSQL TSVECTOR column on `inventory` with GIN index. Triggers keep the tsvector column updated on INSERT/UPDATE. Replaces the SQLite FTS5 virtual table from the original design.

---

## Key Relationships

```
users
  ├── sessions (1:N) — refresh tokens per device
  ├── shops (1:N, unique on user_id+platform) — connected marketplaces
  ├── inventory (1:N) — owned items
  │     └── listings (1:N) — platform instances of each item
  │           └── offers (1:N) — buyer offers on a listing
  ├── sales (1:N) — linked to listing + inventory (SET NULL on delete)
  ├── automation_rules (1:N)
  │     └── automation_logs (1:N)
  ├── tasks (1:N)
  ├── analytics_snapshots (1:N, unique on user_id+date+platform)
  ├── notifications (1:N)
  ├── sync_queue (1:N)
  ├── collaborations (1:N)
  ├── listing_templates (1:N)
  ├── sustainability_log (1:N, also linked to inventory and sales)
  ├── audit_logs (N — SET NULL on user delete)
  ├── request_logs (N — SET NULL on user delete)
  └── error_logs (N — SET NULL on user delete)
```

## Notable Design Choices

- **Encrypted credentials:** `shops.credentials` (and OAuth token columns) are encrypted with AES-256-GCM before storage. Never read raw — use `decryptToken()` from `src/backend/utils/encryption.js`.
- **JSON columns:** `inventory.tags`, `inventory.images`, `listings.platform_specific_data`, `automation_rules.conditions/actions` use PostgreSQL JSONB where appropriate, or TEXT with application-layer parsing.
- **Subscription tier enforcement:** `users.subscription_tier` CHECK constraint enforces valid values. Feature gating logic lives in application code, not the DB schema.
- **Soft delete pattern:** `inventory.status` includes `'deleted'`; rows are not physically removed. `sales` and `listings` use `ON DELETE SET NULL` for inventory/listing FKs to preserve financial records.
- **Unique constraint on listings:** `UNIQUE(inventory_id, platform)` — one listing per item per platform at the DB level.
