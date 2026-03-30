-- Fix onboarding_progress.current_step: change from INTEGER to TEXT
-- The column stores step names (e.g., 'welcome'), not integers
ALTER TABLE onboarding_progress
    ALTER COLUMN current_step TYPE TEXT USING current_step::TEXT;

ALTER TABLE onboarding_progress
    ALTER COLUMN current_step SET DEFAULT 'welcome';

-- Add updated_at column (used by route but missing from original schema)
ALTER TABLE onboarding_progress
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint to plan_usage so ON CONFLICT works
-- Required by billing/usage/refresh route
-- Idempotent: skip if constraint already exists (created by pg-schema.sql on fresh installs)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'plan_usage_user_metric_period_unique'
    ) THEN
        ALTER TABLE plan_usage
            ADD CONSTRAINT plan_usage_user_metric_period_unique
            UNIQUE (user_id, metric, period_start);
    END IF;
END $$;
