# Data Systems — Test Generation Report
**Date:** 2026-03-12
**Domain:** Data Systems (6 categories)
**Source audit:** qa/reports/audits/data_systems_audit.md
**Matrix updated:** qa/coverage_matrix.md

---

## Summary

| Metric | Value |
|--------|-------|
| New test files created | 2 |
| Existing test files extended | 0 |
| New tests added (total) | 43 |
| Tests passing | 43 / 43 |
| Real bugs discovered | 3 |
| Coverage categories improved | 4 of 6 |

---

## Files Created

### 1. `src/tests/data-systems-db-constraints.test.js` — 21 tests
**Addresses audit gap:** Database/persistence correctness — constraint enforcement, FK cascades, FTS5 triggers, cleanup.

**Coverage added (UNIQUE constraints):**
- Duplicate email → throws UNIQUE constraint
- Duplicate username → throws UNIQUE constraint
- Duplicate (user_id, platform) on shops → throws UNIQUE constraint
- Duplicate (user_id, date, platform) on analytics_snapshots → throws UNIQUE constraint
- Listings UNIQUE(inventory_id, platform) — documents known gap: constraint absent from live DB table

**Coverage added (CHECK constraints):**
- Invalid inventory status → throws CHECK constraint
- Invalid inventory condition → throws CHECK constraint
- All 5 valid conditions succeed (new, like_new, good, fair, poor)
- Invalid listing status → throws CHECK constraint
- Invalid offer status → throws CHECK constraint

**Coverage added (FK CASCADE / SET NULL):**
- Delete user → sessions deleted (CASCADE)
- Delete user → inventory deleted (CASCADE)
- Delete inventory → sale.inventory_id set to NULL (SET NULL)
- Delete listing → offers deleted (CASCADE)

**Coverage added (FTS5 triggers):**
- Insert trigger: item immediately indexed, title and brand verifiable via rowid lookup
- Update trigger: FTS5 reflects new title after update
- Delete trigger: documents BUG-1 (stale entry causes "missing row from content table" error)
- Brand column populated in FTS5 index

**Coverage added (cleanupExpiredData):**
- Expired sessions removed, non-expired sessions preserved
- Returns correct cleanup counts

**Test pattern:** Direct DB writes using `makeUser()` helper + UUID tracking + afterAll cleanup. Avoids `query.searchInventory()` due to pre-existing FTS5 corruption — uses direct rowid lookups and FTS5 shadow table queries instead.

---

### 2. `src/tests/data-systems-net-profit.test.js` — 22 tests
**Addresses audit gap:** Financial/numerical correctness — net_profit formula, purchase totals, validation, sales filtering.

**Coverage added (net_profit formula):**
- No fees: net_profit = salePrice
- Platform fee only: salePrice - platformFee
- Shipping only: salePrice - shippingCost
- All fees combined: salePrice - platformFee - shippingCost - taxAmount
- Explicit sellerShippingCost overrides shippingCost
- Round-trip persistence: POST → GET verifies net_profit stored correctly
- sale_price stored correctly; platform_fee stored correctly

**Coverage added (validation guards):**
- Missing salePrice → 400
- Missing platform → 400
- Invalid platform → 400

**Coverage added (purchase total precision):**
- 3 items at $0.10 → toBeCloseTo(0.30, 2)
- Mixed fractional: (3×$5.33) + (2×$8.17) = $32.33
- Total includes shippingCost + taxAmount
- Empty items array → 400
- Negative shippingCost → 400
- Negative unit cost → 400

**Coverage added (sales list filtering):**
- Platform filter returns only matching platform
- Future date filter returns 0 results
- Total count present in response
- limit=1 returns exactly 1 result
- offset=9999 returns empty array

**Test pattern:** HTTP integration tests using `TestApiClient` + `createTestUserWithToken()`.

---

## Bugs Discovered

| # | Bug | Severity | Location | Status |
|---|-----|----------|----------|--------|
| 1 | FTS5 delete trigger missing `rowid` — stale entries persist in index | High | schema.sql trigger `inventory_ad` | Documented, test asserts buggy behavior |
| 2 | `sales.js` FIFO query references non-existent `user_id` column on `inventory_cost_layers` | High | src/backend/routes/sales.js | Documented, not fixable without schema change |
| 3 | Listings UNIQUE(inventory_id, platform) constraint absent from live DB | Medium | schema.sql vs live DB | Documented, test asserts current behavior |

---

## Categories NOT Covered (with rationale)

| Category | Reason | Recommendation |
|----------|--------|----------------|
| Files / imports / exports | No export endpoints implemented yet | Defer until export feature is built |
| Test data realism / quality | Low risk; incremental improvement | Address as test infrastructure matures |

---

## FTS5 Testing Caveats

The live test DB has pre-existing FTS5 index corruption: rows deleted from `inventory` without the FTS5 delete trigger firing left stale rowid references in the FTS5 index (confirmed: rows 2316, 2332, 2346, 2347, 2366). Any test that calls `query.searchInventory()` risks triggering `fts5: missing row N from content table` errors when the MATCH scan encounters these stale entries.

**Mitigation used in tests:**
- FTS5 insert/update verification uses direct `WHERE rowid = ?` lookups (bypasses MATCH scan)
- FTS5 delete bug test uses targeted `MATCH ?` with a unique term to trigger the expected error
- Brand column test queries FTS5 table by rowid, not by MATCH

**Permanent fix:** Correct the delete trigger (add `rowid`), then run `INSERT INTO inventory_fts(inventory_fts) VALUES('rebuild')` to rebuild the entire FTS5 index.
