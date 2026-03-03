-- Migration: Add listing engagement tracking
-- Tracks views, likes, shares by time of day for heatmap visualization

CREATE TABLE IF NOT EXISTS listing_engagement (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE,
    inventory_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'view', 'like', 'share', 'offer', 'sale'
    platform TEXT NOT NULL,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    source TEXT, -- 'search', 'browse', 'share', 'direct', etc.
    location TEXT, -- Geographic region if available
    device_type TEXT, -- 'mobile', 'desktop', 'tablet'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for heatmap aggregation queries
CREATE INDEX IF NOT EXISTS idx_engagement_user ON listing_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_listing ON listing_engagement(listing_id);
CREATE INDEX IF NOT EXISTS idx_engagement_time ON listing_engagement(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_engagement_platform ON listing_engagement(platform);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON listing_engagement(event_type);
CREATE INDEX IF NOT EXISTS idx_engagement_created ON listing_engagement(created_at);
