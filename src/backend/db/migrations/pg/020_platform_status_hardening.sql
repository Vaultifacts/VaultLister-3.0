-- Data-model hardening for status-page tables (audit findings #34, #35, #36, #37).
-- Safe to re-run; all guards are IF NOT EXISTS / exception-swallowing DO blocks.

-- #34: cap error_text so bot-detection pages can't balloon storage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'platform_uptime_samples' AND constraint_name = 'platform_uptime_samples_error_text_len'
    ) THEN
        ALTER TABLE platform_uptime_samples
            ADD CONSTRAINT platform_uptime_samples_error_text_len
            CHECK (error_text IS NULL OR length(error_text) <= 2000);
    END IF;
END $$;

-- #37: lock platform_id to the supported set (plus '_self' meta-incidents)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'platform_uptime_samples' AND constraint_name = 'platform_uptime_samples_platform_id_check'
    ) THEN
        ALTER TABLE platform_uptime_samples
            ADD CONSTRAINT platform_uptime_samples_platform_id_check
            CHECK (platform_id IN ('ebay','shopify','poshmark','depop','facebook','whatnot','_self'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'platform_incidents' AND constraint_name = 'platform_incidents_platform_id_check'
    ) THEN
        ALTER TABLE platform_incidents
            ADD CONSTRAINT platform_incidents_platform_id_check
            CHECK (platform_id IN ('ebay','shopify','poshmark','depop','facebook','whatnot','_self'));
    END IF;
END $$;

-- #35: auto-update updated_at on UPDATE
CREATE OR REPLACE FUNCTION set_platform_incidents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_incidents_updated_at ON platform_incidents;
CREATE TRIGGER trg_platform_incidents_updated_at
    BEFORE UPDATE ON platform_incidents
    FOR EACH ROW
    EXECUTE FUNCTION set_platform_incidents_updated_at();

-- #36: retention — drop resolved incidents older than 2 years via a scheduled cleanup.
-- No schema change needed here; the cleanup will run via cleanupExpiredData().
-- This migration exists so the policy is documented in version control.
