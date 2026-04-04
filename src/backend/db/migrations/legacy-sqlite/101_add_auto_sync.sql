ALTER TABLE shops ADD COLUMN auto_sync_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE shops ADD COLUMN auto_sync_interval_minutes INTEGER NOT NULL DEFAULT 15;

-- DOWN: ALTER TABLE shops DROP COLUMN IF EXISTS auto_sync_enabled;
-- DOWN: ALTER TABLE shops DROP COLUMN IF EXISTS auto_sync_interval_minutes;
