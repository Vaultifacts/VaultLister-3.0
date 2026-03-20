-- Migration 111: Add poshmark_monitoring_log table
-- Stores periodic closet activity snapshots scraped by the poshmark_monitoring task

CREATE TABLE IF NOT EXISTS poshmark_monitoring_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    total_listings INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    active_offers INTEGER DEFAULT 0,
    recent_sales INTEGER DEFAULT 0,
    closet_value REAL DEFAULT 0,
    checked_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poshmark_monitoring_user_checked
    ON poshmark_monitoring_log (user_id, checked_at DESC);
