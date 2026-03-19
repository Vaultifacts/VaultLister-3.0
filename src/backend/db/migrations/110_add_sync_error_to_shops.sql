-- Migration 110: Add sync_error column to shops table
-- Required by platformSync services that write sync errors after failed syncs

ALTER TABLE shops ADD COLUMN sync_error TEXT;
