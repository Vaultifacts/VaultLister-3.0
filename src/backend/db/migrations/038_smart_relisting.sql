-- Migration: 038_smart_relisting
-- Description: Add smart relisting rules and history tracking
-- Created: 2026-01-29

-- Smart relisting rules table
CREATE TABLE IF NOT EXISTS relisting_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,

    -- Trigger conditions
    stale_days INTEGER DEFAULT 30,              -- Days before considering stale
    min_views INTEGER DEFAULT 0,                -- Minimum views before eligible
    max_views INTEGER,                          -- Maximum views (low engagement indicator)
    min_likes INTEGER DEFAULT 0,                -- Minimum likes before eligible

    -- Price adjustment strategy
    price_strategy TEXT DEFAULT 'fixed' CHECK (price_strategy IN ('fixed', 'percentage', 'tiered', 'prediction')),
    price_reduction_amount REAL DEFAULT 0,      -- Fixed amount or percentage
    price_floor_percentage REAL DEFAULT 50,     -- Never go below this % of original
    use_ai_pricing INTEGER DEFAULT 0,           -- Use AI predictions for new price

    -- Tiered price drops (JSON array)
    -- Format: [{"days": 7, "reduction": 5}, {"days": 14, "reduction": 10}, ...]
    tiered_reductions TEXT,

    -- Relisting options
    refresh_photos INTEGER DEFAULT 0,           -- Re-upload photos
    refresh_title INTEGER DEFAULT 0,            -- Regenerate title
    refresh_description INTEGER DEFAULT 0,      -- Regenerate description
    add_sale_tag INTEGER DEFAULT 0,             -- Add "SALE" or "REDUCED" to title

    -- Scheduling
    auto_relist INTEGER DEFAULT 0,              -- Automatically relist
    relist_time TEXT,                           -- Preferred time (HH:MM)
    relist_days TEXT,                           -- Days of week (JSON array: [1,2,3,4,5])
    max_relists_per_day INTEGER DEFAULT 10,     -- Rate limit

    -- Filters
    categories TEXT,                            -- JSON array of categories to include
    exclude_categories TEXT,                    -- JSON array of categories to exclude
    brands TEXT,                                -- JSON array of brands to include
    min_price REAL,                             -- Minimum item price
    max_price REAL,                             -- Maximum item price
    platforms TEXT,                             -- JSON array of platforms

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Relisting history/queue table
CREATE TABLE IF NOT EXISTS relisting_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    rule_id TEXT,
    platform TEXT NOT NULL,

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    scheduled_at DATETIME,
    processed_at DATETIME,

    -- Price changes
    original_price REAL,
    new_price REAL,
    price_change_reason TEXT,

    -- Changes made
    changes_made TEXT,                          -- JSON: what was changed
    error_message TEXT,

    -- Metrics before/after
    views_before INTEGER,
    likes_before INTEGER,
    days_listed INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Relisting performance tracking
CREATE TABLE IF NOT EXISTS relisting_performance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    relist_queue_id TEXT,

    -- Before metrics
    price_before REAL,
    views_before INTEGER,
    likes_before INTEGER,
    days_without_sale INTEGER,

    -- After metrics (tracked over time)
    price_after REAL,
    views_after INTEGER DEFAULT 0,
    likes_after INTEGER DEFAULT 0,

    -- Outcome
    sold INTEGER DEFAULT 0,
    sold_at DATETIME,
    sale_price REAL,
    days_to_sale INTEGER,

    relisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_relisting_rules_user ON relisting_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_relisting_rules_active ON relisting_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_user ON relisting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_status ON relisting_queue(status);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_scheduled ON relisting_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_listing ON relisting_queue(listing_id);
CREATE INDEX IF NOT EXISTS idx_relisting_performance_user ON relisting_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_relisting_performance_listing ON relisting_performance(listing_id);
