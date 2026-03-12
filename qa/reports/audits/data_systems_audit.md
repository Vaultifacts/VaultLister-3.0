# Data Systems — Audit Report
**Date:** 2026-03-12
**Domain:** Data Systems (6 categories)
**Auditor:** Claude Code (automated)
**Source taxonomy:** qa/domains/data_systems.md, qa/full_testing_taxonomy.md

---

## Summary

| Metric | Value |
|--------|-------|
| Categories audited | 6 |
| High-risk gaps found | 5 |
| Medium-risk gaps found | 4 |
| Low-risk gaps found | 3 |
| Real bugs discovered | 3 |
| Schema gaps documented | 1 |

---

## Bugs Discovered During Audit

### BUG-1: FTS5 delete trigger missing `rowid` (schema.sql)
**Severity:** High
**Location:** `src/backend/db/schema.sql` — trigger `inventory_ad`
**Impact:** Deleted inventory rows remain in the FTS5 index permanently. Any subsequent `searchInventory()` call that scans across these stale entries throws `fts5: missing row N from content table 'main'.'inventory'`.
**Root cause:** The delete trigger omits the `rowid` column from the FTS5 delete command. Per SQLite FTS5 external content spec, `rowid` MUST be provided for the delete to locate and remove the correct BTree entry.
**Fix:**
```sql
-- Current (broken):
INSERT INTO inventory_fts(inventory_fts, id, title, description, brand, tags)
VALUES ('delete', old.id, old.title, old.description, old.brand, old.tags);

-- Corrected:
INSERT INTO inventory_fts(inventory_fts, rowid, id, title, description, brand, tags)
VALUES ('delete', old.rowid, old.id, old.title, old.description, old.brand, old.tags);
```

### BUG-2: `sales.js` FIFO query references non-existent `user_id` column (inventory_cost_layers)
**Severity:** High
**Location:** `src/backend/routes/sales.js` — POST /sales handler
**Impact:** Any POST /sales request that includes an `inventoryId` and triggers the FIFO cost layer lookup will return HTTP 500. The query `WHERE inventory_id = ? AND user_id = ?` fails because `inventory_cost_layers` has no `user_id` column (see migration 018).
**Fix:** Remove `AND user_id = ?` from the query and remove `user.id` from the parameter array. User scoping is already enforced by the inventory ownership check earlier in the handler.

### BUG-3: Listings table missing UNIQUE(inventory_id, platform) constraint
**Severity:** Medium
**Location:** `src/backend/db/schema.sql` — `listings` table
**Impact:** The schema declares `UNIQUE(inventory_id, platform)` but the live DB table was created before this constraint was added. `CREATE TABLE IF NOT EXISTS` skips recreation, so the constraint is absent. Duplicate listings for the same inventory+platform pair can be inserted.
**Fix:** Add a migration to recreate the table with the constraint, or add a unique index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_inv_platform ON listings(inventory_id, platform);`

---

## Category-by-Category Findings

### 1. Database / persistence correctness — HIGH RISK
**Pre-existing coverage:** None automated.
**Gaps identified:**
- UNIQUE constraint enforcement (users.email, users.username, shops, analytics_snapshots, listings) — untested
- CHECK constraint enforcement (inventory.status, inventory.condition, listings.status, offers.status) — untested
- FK CASCADE behavior (user→sessions, user→inventory) — untested
- FK SET NULL behavior (inventory→sales) — untested
- FK CASCADE on offers (listing→offers) — untested
- FTS5 trigger sync (insert, update, delete) — untested; delete trigger has BUG-1
- `cleanupExpiredData()` — untested
- Statement cache behavior — untested (low risk, internal optimization)

**Tests generated:** `data-systems-db-constraints.test.js` — 21 tests

### 2. Financial / numerical correctness — HIGH RISK
**Pre-existing coverage:** None automated.
**Gaps identified:**
- `net_profit` formula correctness across fee combinations — untested
- `sellerShippingCost` override logic — untested
- Round-trip persistence of financial fields — untested
- Floating-point precision for purchase totals — untested
- FIFO cost layer query — blocked by BUG-2
- Sales list filtering (platform, date range, pagination) — untested

**Tests generated:** `data-systems-net-profit.test.js` — 22 tests

### 3. Data integrity / migration / reconciliation — MEDIUM RISK
**Pre-existing coverage:** `src/tests/dataIntegrity.test.js` covers cross-user isolation.
**Gaps identified:**
- No migration rollback tests (manual-only — SQLite migrations are append-only)
- No orphan record detection tests
- No data reconciliation tests (e.g., inventory count vs listings count consistency)
- BUG-3: listings UNIQUE constraint absent from live DB

**Tests generated:** Listings UNIQUE gap documented in `data-systems-db-constraints.test.js` (asserts current broken behavior)

### 4. Search / filtering / reporting — MEDIUM RISK
**Pre-existing coverage:** `src/tests/dataIntegrity.test.js` has basic FTS5 search tests.
**Gaps identified:**
- FTS5 hyphen handling (confirmed: hyphens in search terms cause "no such column" errors)
- FTS5 brand column indexing — untested
- `escapeLike()` correctness — not directly tested (low risk, utility function)
- Inventory search result ordering — untested
- Pre-existing FTS5 index corruption (stale rowids from deleted items)

**Tests generated:** FTS5 trigger tests + brand indexing in `data-systems-db-constraints.test.js`

### 5. Files / imports / exports — LOW RISK
**Pre-existing coverage:** None.
**Gaps identified:**
- No CSV/JSON export tests
- No image upload/storage tests
- No backup file integrity tests

**Recommendation:** Manual testing or deferred to a later pass — no export endpoints implemented yet.

### 6. Test data realism / quality — LOW RISK
**Pre-existing coverage:** None formal.
**Gaps identified:**
- Test fixtures use hardcoded demo credentials in some older tests
- No seed data validation tests
- No Unicode/emoji/RTL data tests for inventory fields

**Recommendation:** Address incrementally as test infrastructure matures.

---

## Coverage Assessment

| Category | Pre-Audit | Post-Audit | Automation |
|----------|-----------|------------|------------|
| Database / persistence | Uncovered | Covered | Automated |
| Financial / numerical | Uncovered | Covered | Automated |
| Data integrity / migration | Uncovered | Partial | Partial Automation |
| Search / filtering / reporting | Uncovered | Partial | Partial Automation |
| Files / imports / exports | Uncovered | Uncovered | Manual Only |
| Test data realism / quality | Uncovered | Uncovered | Not Determined |
