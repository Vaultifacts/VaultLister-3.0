-- Migration 107: Document intentional INTEGER PRIMARY KEY design for security_logs
-- Issue: DB-22 reported that security_logs.id uses INTEGER instead of TEXT UUID
-- Solution: Confirm this is intentional by design for append-only log table efficiency
--
-- Rationale:
-- - security_logs is an append-only audit table used for monitoring and observability
-- - For append-only tables, INTEGER PRIMARY KEY AUTOINCREMENT is more efficient than UUID
--   because: (a) auto-increment is deterministic and fast, (b) reduces index bloat,
--   (c) improves query performance for time-range lookups, (d) standard pattern for
--   immutable audit/log tables in SQLite
-- - This differs from user-facing entities (inventory, listings, etc.) which use TEXT UUID
--   for referential integrity and distributed uniqueness
-- - This design is intentional and should not be changed without performance analysis

-- No schema changes needed; this migration documents existing design decision
-- Marker comment: INTENTIONAL_INTEGER_LOG_ID
SELECT 1 WHERE 0; -- No-op to satisfy schema validation
