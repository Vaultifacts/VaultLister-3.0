# Database Layer Deep Audit — VaultLister 3.0

**Date:** 2026-03-19
**Scope:** schema.sql, migrations/001-103 + .js files, database.js, all src/backend/routes/*.js

---

## Executive Summary

103 migration files exist on disk. database.js registers 102 of them — migration 103 is absent from the array. Three registered filenames at positions 079, 081, and 082 do not match any file on disk (the runner's file-not-found branch marks them as applied without executing them). Two .js migration files exist in the directory but the runner never reads them. schema.sql declares `listings_folders.user_id` as INTEGER while `users.id` is TEXT — UUID strings stored in INTEGER affinity columns coerce to 0, silently breaking user isolation for all folder data. `audit_logs` has a three-way schema conflict between schema.sql, migration 083, and migration 084 that silently omits `category` and `severity` columns on schema.sql-first installs. 14+ bare `JSON.parse` calls in routes will throw unhandled 500s on any malformed stored JSON. The FIFO transaction in `sales.js` references `query.db` which is not exported from `database.js`, making the transaction non-atomic in practice. Net profit is stored as raw floating-point REAL with no rounding normalization, accumulating drift in aggregate reports.

**Finding count by severity:**

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 10 |
| Medium | 13 |
| Low | 6 |

---

## Finding Table

| # | Category | File / Table | Location | Severity | Description |
|---|----------|--------------|----------|----------|-------------|
| DB-01 | Migration chain integrity | database.js | migrationFiles array | Critical | `103_add_google_integrations.sql` exists on disk and creates `google_tokens` and `google_oauth_states` tables but is NOT registered in database.js. The file-not-found branch marks missing entries as applied without running them. On fresh install those tables are never created. Any route requiring them returns a no-such-table 500. |
| DB-02 | Migration chain integrity | database.js | migrationFiles entry for 079 | Critical | database.js registers `079_add_watermark_tables.sql`. That filename does not exist on disk. The file on disk is `079_add_engagement_heatmap_index.sql`. The watermarks table is never created — `watermark.js` 500s on a fresh database. The heatmap index is also never applied because its real filename is not in the registry. |
| DB-03 | Migration chain integrity | database.js | migrationFiles entries 081 and 082 | Critical | database.js registers `081_add_onboarding_tables.sql` and `082_add_offline_sync.sql`. The files on disk are `081_add_enhanced_mfa_tables.sql` and `082_add_service_tables.sql`. `webauthn_credentials`, `backup_codes`, `sms_codes`, `totp_secrets`, `user_webhooks`, `webhook_deliveries`, `email_queue`, and `email_unsubscribes` are never created on fresh install. Enhanced MFA login and outgoing webhook delivery will 500. |
| DB-04 | Migration chain integrity | migrations/ | `add_security_logs.js`, `add_sku_unique_index.js` | High | Two `.js` files exist in the migrations directory. The runner reads only the explicit SQL filename array — neither file ever executes. `add_sku_unique_index.js` presumably adds `UNIQUE(user_id, sku)` on `inventory`; its absence means duplicate SKUs per user are silently allowed, breaking SKU sync and SKU rule generation. |
| DB-05 | Schema consistency — type mismatch | `listings_folders` | migration 016 line 7 | Critical | `listings_folders.user_id` is declared `INTEGER NOT NULL` but `users.id` is `TEXT` (UUID). SQLite coerces non-numeric UUID strings to 0 in INTEGER affinity columns. All folder records created via the route store `user_id = 0`. Every folder becomes cross-user-readable for any query filtering `user_id = 0`. |
| DB-06 | Schema consistency — column collision | `audit_logs` | schema.sql vs migration 083 vs migration 084 | High | schema.sql creates `audit_logs` without `category`, `severity`, `metadata`, `session_id`. Migration 083 creates the same table with those extra columns — the CREATE TABLE IF NOT EXISTS is a no-op because schema.sql already created the table. Migration 084 then tries `ALTER TABLE audit_logs ADD COLUMN category TEXT` and `ADD COLUMN resource_type TEXT` — these fail as duplicate column if migration 083 had somehow run, or silently add nullable/no-default columns. On a schema.sql-first fresh install the table is permanently missing `category` and `severity`. Audit log queries filtering by `category` return no rows silently. |
| DB-07 | Schema consistency — columns in query not in schema | `sales` | sales.js lines 14, 93 | High | SELECT queries reference `s.item_cost`, `s.customer_shipping_cost`, and `s.seller_shipping_cost`. These columns are not in schema.sql — they are added by migration 019. If migration 019 is skipped by the duplicate-column catch block, every GET /api/sales call returns a runtime column-not-found error. |
| DB-08 | Schema consistency — nonexistent column in report whitelist | `orders` | reports.js ALLOWED_COLUMNS line 25 | High | reports.js whitelists `orders.total_amount` as a queryable column. The `orders` table (migration 026) has no `total_amount` column — the column is `sale_price`. Any custom report querying `orders.total_amount` returns a no-such-column 500 or NULL silently. |
| DB-09 | Missing indexes | `sales.created_at` | schema.sql | Medium | No index on `sales.created_at` in schema.sql. Migration 019 adds `idx_sales_created_at` but if that migration is skipped, all date-range filters in `sales.js` and the analytics dashboard run a full table scan on `sales`. |
| DB-10 | Missing indexes | `inventory` composite | schema.sql / migration 099 | Medium | The main inventory list filters `WHERE user_id = ? AND status != ? ORDER BY created_at DESC`. Separate single-column indexes on `user_id` and `status` exist but no composite `(user_id, status, created_at DESC)`. Migration 099 adds this composite for `listings` and `offers` only, not `inventory`. |
| DB-11 | Missing indexes | `price_history` composite | migration 055 | Medium | `idx_price_history_inventory` covers `inventory_id` alone. The route fetches `WHERE inventory_id = ? ORDER BY changed_at DESC`. No composite `(inventory_id, changed_at DESC)` — SQLite sorts after filter on large price histories. |
| DB-12 | Missing indexes | `automation_logs` composite | schema.sql | Medium | Route uses `WHERE user_id = ? ORDER BY created_at DESC`. Separate single-column indexes on `user_id` and `created_at` exist but no composite `(user_id, created_at DESC)`. |
| DB-13 | Missing indexes | `notifications` composite | schema.sql | Medium | Notification queries use `WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC`. No composite `(user_id, is_read, created_at DESC)` covering index. |
| DB-14 | Foreign key gaps — type mismatch on FK | `listings_folders` | migration 016 | High | `listings_folders.user_id INTEGER` references `users.id TEXT`. The FK is nominally declared but UUID-to-integer coercion causes all folders to store `user_id = 0`. See DB-05. |
| DB-15 | Foreign key gaps — orphaned log rows on rule delete | `automation_logs` | schema.sql line 251 | Medium | `automation_logs.rule_id ON DELETE SET NULL`. When a rule is deleted all its log rows have `rule_id = NULL`. Run count statistics that group by `rule_id` silently exclude all historical logs from deleted rules, undercounting automation activity. |
| DB-16 | Foreign key gaps — listing title lost on delete | `sales` | schema.sql line 155 | Medium | `sales.listing_id ON DELETE SET NULL`. After a listing is deleted, historical sale records lose the platform listing title (JOIN returns NULL). No snapshot of the listing title is stored at sale time. |
| DB-17 | JSON column risks — bare JSON.parse without try/catch | Multiple routes | 14+ locations | Medium | The following `JSON.parse` calls are outside any try/catch and will throw unhandled 500s on malformed stored values: `ai.js:528` and `:610` (item.tags); `duplicates.js:64-65` (primary_images, duplicate_images); `inventoryImport.js:360`, `:375`, `:480`, `:669` (field_mapping, raw_data, parsed_data); `marketIntel.js:265` (insights_json); `monitoring.js:153` and `:216` (a.data, e.context); `notion.js:757-759` (local_data, notion_data, conflicting_fields); `offlineSync.js:46` and `:89` (payload); `tasks.js:34` and `:59` (task.result); `teams.js:695` (a.details); `shippingProfiles.js:20` and `:48` (platforms). A `safeJsonParse` helper already exists in `inventory.js` and `listings.js` — it is not used in these locations. |
| DB-18 | Transaction gaps — offer accept multi-write | offers.js | High | Offer accept updates `offers.status`, `listings.status`, and optionally `inventory.status` in three separate `query.run()` calls with no `query.transaction()` wrapper. A crash between calls leaves state inconsistent — offer accepted but listing still active — enabling duplicate sales. |
| DB-19 | Transaction gaps — cross-list bulk insert | listings.js line 418 | High | `/api/listings/crosslist` creates one listing per platform in a loop. No transaction wrapper. A crash mid-loop leaves partial cross-listing state. Migration 096 prevents duplicate inserts on retry but does not restore the complete pre-crash state. |
| DB-20 | Transaction gaps — FIFO transaction non-atomic | sales.js line 140 | Critical | `db` is obtained via `query.db` (undefined — not exported from `database.js`) with a `require()` fallback. In an ES module context `require()` throws `ReferenceError: require is not defined` at runtime. The transaction wrapper is never established. The inventory cost layer update, sales INSERT, and inventory status change execute as three independent unatomic statements. |
| DB-21 | Transaction gaps — async callback in sync transaction | reports.js line 902 | Medium | `await query.transaction()` wraps an async function. The `query.transaction` helper (database.js line 310) calls `db.transaction(fn)()` synchronously — it cannot await the callback. Async work inside silently escapes the transaction boundary. |
| DB-22 | Data type mismatches — `security_logs.id` INTEGER | schema.sql line 418 | Medium | `security_logs` uses `INTEGER PRIMARY KEY AUTOINCREMENT`. Every other table uses `TEXT PRIMARY KEY` (UUID). `models.create()` would fail for this table. Breaks the UUID-everywhere convention. |
| DB-23 | Data type mismatches — `mfa_events.id` INTEGER | migration 047 | Low | Same `INTEGER PRIMARY KEY AUTOINCREMENT` pattern. Inconsistent with UUID convention. |
| DB-24 | Data type mismatches — DATETIME vs TEXT timestamp format | Multiple migrations | Medium | schema.sql uses `DATETIME DEFAULT CURRENT_TIMESTAMP`. Migrations 081, 082, 086, and others use `TEXT DEFAULT (datetime('now'))`. Both produce the same string in SQLite. However application code using `new Date().toISOString()` produces `2026-03-19T12:00:00.000Z` (T-separator ISO 8601) which SQLite `datetime()` does not parse. Any row written with `toISOString()` format is silently excluded from all date-range queries and from `cleanupExpiredData`. |
| DB-25 | Default value gaps — `audit_logs.category` | migration 083 / 084 | High | Migration 083 would create `category TEXT NOT NULL` — but on schema.sql-first installs the table already exists so migration 083 is a no-op. Migration 084 adds `category TEXT` with no default. Result: `category` is nullable with no default. Audit log inserts that omit `category` store NULL. Queries filtering `WHERE category = 'security'` return no rows. |
| DB-26 | Default value gaps — `inventory_cost_layers.updated_at` | sales.js FIFO loop | Low | The FIFO deduction raw query only sets `quantity_remaining`. It does not update `updated_at`. The column retains the creation timestamp after deduction, making it impossible to determine when a cost layer was last consumed. |
| DB-27 | Constraint gaps — `purchases.purchase_number` not UNIQUE | migration 018 | Low | No UNIQUE constraint on `purchase_number`. Duplicate PO numbers per vendor per user are silently allowed. |
| DB-28 | Constraint gaps — `offers` no UNIQUE on `platform_offer_id` | schema.sql / migration 080 | Medium | No UNIQUE constraint on `(listing_id, platform_offer_id)`. Webhook retries or sync races can insert duplicate offer rows for the same platform offer. Both rows appear in the offers list and both count toward the pending badge, inflating it. |
| DB-29 | Soft delete inconsistency | `inventory` vs `listings` vs `deleted_items` | Medium | `inventory` uses both `status = 'deleted'` and `deleted_at`. `listings` uses only `status` with no `deleted_at`. `deleted_items` (migration 064) is a third separate snapshot approach. If `status` is set to `'deleted'` without setting `deleted_at`, the item does not appear in Recently Deleted. If `deleted_at` is set without a status change, the item appears in both active inventory and Recently Deleted simultaneously. |
| DB-30 | Soft delete inconsistency | `offers` | Low | `offers` uses only status values (`cancelled`, `expired`) with no `deleted_at`. `deleted_items` includes `'offer'` as an `item_type`. Restoring an offer from `deleted_items` would re-insert a row while the original cancelled row still exists, creating a duplicate. |
| DB-31 | Financial correctness — no ROUND on net_profit | sales.js line 183 | High | `net_profit = salePrice - platformFee - itemCost - actualSellerShipping - taxAmount` is computed in JavaScript floating-point arithmetic and stored as REAL with no rounding applied. `SUM(net_profit)` across many sales accumulates floating-point drift. No reconciliation exists between stored `net_profit` and values recomputable from stored components. |
| DB-32 | Financial correctness — analytics date filter string interpolation | analytics.js lines 78-84 | Medium | `PERIOD_FILTERS` maps period keys to raw SQL fragments that are interpolated into queries via template literals. Currently safe because values come from a hardcoded object with a safe fallback. The pattern is fragile — a future change sourcing `period` from user input directly would be SQL injection. |
| DB-33 | Migration chain integrity — dead .js migration file | migrations/ | Low | `add_sku_unique_index.js` is a JavaScript file in the SQL migrations directory and is never executed. If intended to enforce `UNIQUE(user_id, sku)` on `inventory`, that index is absent and duplicate SKUs per user are silently allowed. |

---

## Migration Registry vs Disk Matrix

| Registered in database.js but NOT on disk | On disk but NOT in database.js |
|---|---|
| `079_add_watermark_tables.sql` | `079_add_engagement_heatmap_index.sql` |
| `081_add_onboarding_tables.sql` | `081_add_enhanced_mfa_tables.sql` |
| `082_add_offline_sync.sql` | `082_add_service_tables.sql` |
| (none) | `103_add_google_integrations.sql` |
| (none) | `add_security_logs.js` (not SQL — unrunnable) |
| (none) | `add_sku_unique_index.js` (not SQL — unrunnable) |

---

## Prioritized Fixes

1. **DB-20 (Critical — data loss):** Export `db` from `database.js` or import it directly at the top of `sales.js`. The transaction must actually wrap all three writes.
2. **DB-01/02/03 (Critical — schema never applied):** Correct the `migrationFiles` array: fix 079/081/082 names to match actual disk filenames, add `103_add_google_integrations.sql`.
3. **DB-05/14 (Critical — data corruption):** Rebuild `listings_folders` with `user_id TEXT` via a table-recreation migration.
4. **DB-18/19 (High — consistency):** Wrap offer accept/decline in `query.transaction()`. Wrap the crosslist platform loop in `query.transaction()`.
5. **DB-06/25 (High — silent data loss):** Resolve the `audit_logs` schema conflict. Create the table once with the full column set including `category TEXT DEFAULT NULL`, `severity TEXT DEFAULT NULL`, `metadata TEXT`, `session_id TEXT`.
6. **DB-17 (Medium — 500 on corrupt data):** Replace 14+ bare `JSON.parse` calls with the `safeJsonParse` helper already established in `inventory.js` and `listings.js`.
7. **DB-31 (High — financial drift):** Apply `ROUND(value, 2)` to `net_profit` before storage. Add a reconciliation check that recomputes from stored components and logs any discrepancy.
8. **DB-24 (Medium — silent query exclusion):** Audit all timestamp writes. Replace any `new Date().toISOString()` storage with a SQLite-compatible format. Never store T-separator ISO 8601 in `DATETIME` or `TEXT` date columns.
9. **DB-28 (Medium — duplicate offers):** Add migration: `CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_listing_platform_offer ON offers(listing_id, platform_offer_id) WHERE platform_offer_id IS NOT NULL`.
10. **DB-29 (Medium — soft delete chaos):** Standardize: adopt `status + deleted_at` on all soft-deletable tables. One backfill migration: `UPDATE inventory SET deleted_at = updated_at WHERE status = 'deleted' AND deleted_at IS NULL`.

---

## Missing Integration Tests

Recommended file: `src/tests/data-systems-db-audit.test.js`

- `listings_folders` user_id type coercion: create folder, read back `user_id`, assert it equals the UUID string not integer `0`
- Sale FIFO transaction atomicity: mock `inventory_cost_layers` update to throw, confirm no `sales` row was written
- Cross-list partial failure rollback: mock the second platform INSERT to throw, confirm the first listing row is also absent
- Concurrent offer accept race: two simultaneous accept requests on the same offer, only one should succeed with `status = 'accepted'`
- `net_profit` floating-point precision: `price=9.99 fee=1.00 ship=2.49 tax=0`, assert stored `net_profit === 6.50` not `6.499999...`
- `audit_logs.category` null on schema.sql-only init: init DB from schema.sql only, insert audit log without category, assert `category IS NULL` (documents gap)
- `google_tokens` table absent without migration 103: init DB without migration 103, attempt `INSERT INTO google_tokens`, expect no-such-table error
- `monitoring.js` JSON.parse throw on malformed data: seed alert row with `data = 'INVALID'`, call `GET /api/monitoring/alerts`, assert 200 response not 500
- Duplicate SKU allowed: create two inventory items with same `sku` and `user_id`, confirm no constraint error fires (documents gap)
