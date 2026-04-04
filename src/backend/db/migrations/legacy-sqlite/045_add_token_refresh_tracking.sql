-- Migration 045: Add Token Refresh Tracking columns to shops table
-- Adds columns for tracking OAuth token refresh status and failures

-- Add token refresh tracking columns
ALTER TABLE shops ADD COLUMN consecutive_refresh_failures INTEGER DEFAULT 0;
ALTER TABLE shops ADD COLUMN last_token_refresh_at DATETIME;
ALTER TABLE shops ADD COLUMN token_refresh_error TEXT;
ALTER TABLE shops ADD COLUMN token_refresh_error_at DATETIME;

-- Create index for efficient token refresh queries
CREATE INDEX IF NOT EXISTS idx_shops_token_refresh
ON shops(connection_type, is_connected, oauth_token_expires_at);

-- DOWN: DROP INDEX IF EXISTS idx_shops_token_refresh;
-- DOWN: ALTER TABLE shops DROP COLUMN IF EXISTS consecutive_refresh_failures;
-- DOWN: ALTER TABLE shops DROP COLUMN IF EXISTS last_token_refresh_at;
-- DOWN: ALTER TABLE shops DROP COLUMN IF EXISTS token_refresh_error;
-- DOWN: ALTER TABLE shops DROP COLUMN IF EXISTS token_refresh_error_at;
