-- Fix affiliate_landing_pages slug uniqueness: should be per-user, not global
-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table

CREATE TABLE IF NOT EXISTS affiliate_landing_pages_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT,
    description TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    visits INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, slug)
);

INSERT OR IGNORE INTO affiliate_landing_pages_new
    SELECT * FROM affiliate_landing_pages;

DROP TABLE IF EXISTS affiliate_landing_pages;

ALTER TABLE affiliate_landing_pages_new RENAME TO affiliate_landing_pages;

CREATE INDEX IF NOT EXISTS idx_affiliate_landing_user ON affiliate_landing_pages(user_id);
