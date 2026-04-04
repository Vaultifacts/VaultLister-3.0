-- Listing Refresh Tracking Migration
-- Adds fields and tables for delist/relist feature with staleness detection

-- Add refresh tracking columns to listings table
ALTER TABLE listings ADD COLUMN last_delisted_at DATETIME;
ALTER TABLE listings ADD COLUMN last_relisted_at DATETIME;
ALTER TABLE listings ADD COLUMN staleness_days INTEGER DEFAULT 30;
ALTER TABLE listings ADD COLUMN auto_relist_enabled INTEGER DEFAULT 0;
ALTER TABLE listings ADD COLUMN marked_as_sold INTEGER DEFAULT 0;

-- Create listing refresh history table
CREATE TABLE IF NOT EXISTS listing_refresh_history (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('delist', 'relist', 'mark_sold')),
    reason TEXT, -- 'manual', 'stale', 'automation', 'schedule'
    previous_status TEXT,
    new_status TEXT,
    platform_response TEXT, -- JSON response from platform API
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_listing ON listing_refresh_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_user ON listing_refresh_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_action ON listing_refresh_history(action);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_created ON listing_refresh_history(created_at);

-- Index for staleness queries
CREATE INDEX IF NOT EXISTS idx_listings_last_relisted ON listings(last_relisted_at);
CREATE INDEX IF NOT EXISTS idx_listings_staleness ON listings(staleness_days, status, auto_relist_enabled);

-- DOWN: DROP INDEX IF EXISTS idx_listing_refresh_history_listing;
-- DOWN: DROP INDEX IF EXISTS idx_listing_refresh_history_user;
-- DOWN: DROP INDEX IF EXISTS idx_listing_refresh_history_action;
-- DOWN: DROP INDEX IF EXISTS idx_listing_refresh_history_created;
-- DOWN: DROP INDEX IF EXISTS idx_listings_last_relisted;
-- DOWN: DROP INDEX IF EXISTS idx_listings_staleness;
-- DOWN: DROP TABLE IF EXISTS listing_refresh_history;
-- DOWN: ALTER TABLE listings DROP COLUMN IF EXISTS last_delisted_at;
-- DOWN: ALTER TABLE listings DROP COLUMN IF EXISTS last_relisted_at;
-- DOWN: ALTER TABLE listings DROP COLUMN IF EXISTS staleness_days;
-- DOWN: ALTER TABLE listings DROP COLUMN IF EXISTS auto_relist_enabled;
-- DOWN: ALTER TABLE listings DROP COLUMN IF EXISTS marked_as_sold;
