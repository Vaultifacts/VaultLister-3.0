-- Migration: Add competitor monitoring tables
-- Tracks competitor sellers and market insights

-- Competitor seller accounts to monitor
CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    profile_url TEXT,
    category_focus TEXT, -- Primary category they sell
    avg_price REAL,
    listing_count INTEGER DEFAULT 0,
    sell_through_rate REAL,
    last_checked_at TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, platform, username)
);

-- Tracked competitor listings
CREATE TABLE IF NOT EXISTS competitor_listings (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- Platform's listing ID
    title TEXT NOT NULL,
    price REAL NOT NULL,
    original_price REAL,
    category TEXT,
    brand TEXT,
    condition TEXT,
    listed_at TEXT,
    sold_at TEXT,
    days_to_sell INTEGER,
    url TEXT,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Market insights and opportunity scores
CREATE TABLE IF NOT EXISTS market_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    saturation_score REAL CHECK (saturation_score >= 0 AND saturation_score <= 100),
    opportunity_score REAL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
    avg_price REAL,
    price_range_low REAL,
    price_range_high REAL,
    avg_days_to_sell REAL,
    listing_count INTEGER,
    demand_trend TEXT, -- 'rising', 'stable', 'falling'
    competition_level TEXT, -- 'low', 'medium', 'high'
    recommended_price_range TEXT,
    insights_json TEXT, -- Additional insights as JSON
    valid_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_competitors_user ON competitors(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_platform ON competitors(platform);
CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_competitor ON competitor_listings(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_sold ON competitor_listings(sold_at);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_category ON competitor_listings(category);
CREATE INDEX IF NOT EXISTS idx_market_insights_category ON market_insights(category);
CREATE INDEX IF NOT EXISTS idx_market_insights_platform ON market_insights(platform);
CREATE INDEX IF NOT EXISTS idx_market_insights_opportunity ON market_insights(opportunity_score);
