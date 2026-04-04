-- Migration 113: Add updated_at column to audit tables
-- Adds update tracking to security_logs, mfa_events, and health_checks
-- which previously only had created_at

ALTER TABLE security_logs  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE mfa_events     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE health_checks  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- DOWN:
-- ALTER TABLE security_logs  DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE mfa_events     DROP COLUMN IF EXISTS updated_at;
-- ALTER TABLE health_checks  DROP COLUMN IF EXISTS updated_at;
