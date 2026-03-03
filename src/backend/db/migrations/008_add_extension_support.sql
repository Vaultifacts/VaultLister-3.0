-- Chrome Extension Support Migration
-- Adds tables for extension features: price tracking, product scraping, sync queue

-- Price tracking for competitor listings
CREATE TABLE IF NOT EXISTS price_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Source information
    platform TEXT NOT NULL, -- 'poshmark', 'ebay', 'mercari'
    listing_url TEXT NOT NULL,
    listing_id TEXT,

    -- Item details
    title TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    size TEXT,

    -- Price tracking
    current_price REAL NOT NULL,
    original_price REAL,
    price_history TEXT DEFAULT '[]', -- JSON: [{ price, timestamp }]

    -- Monitoring
    alert_on_price_drop INTEGER DEFAULT 0,
    alert_threshold REAL, -- Alert if price drops below this
    last_checked_at DATETIME,

    -- Metadata
    images TEXT DEFAULT '[]',
    seller_username TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Scraped product data (from retail sites)
CREATE TABLE IF NOT EXISTS scraped_products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Source
    source_url TEXT NOT NULL,
    source_site TEXT NOT NULL, -- 'amazon', 'nordstrom', etc.

    -- Product data
    title TEXT NOT NULL,
    brand TEXT,
    price REAL,
    original_price REAL,
    description TEXT,
    images TEXT DEFAULT '[]', -- JSON array
    category TEXT,
    color TEXT,
    size TEXT,
    material TEXT,

    -- Status
    imported_to_inventory INTEGER DEFAULT 0,
    inventory_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- Extension sync queue
CREATE TABLE IF NOT EXISTS extension_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'scrape', 'track', 'crosslist'
    payload TEXT NOT NULL, -- JSON
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_tracking_user ON price_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_price_tracking_platform ON price_tracking(platform);
CREATE INDEX IF NOT EXISTS idx_scraped_products_user ON scraped_products(user_id);
CREATE INDEX IF NOT EXISTS idx_scraped_products_imported ON scraped_products(imported_to_inventory, user_id);
CREATE INDEX IF NOT EXISTS idx_extension_sync_status ON extension_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_extension_sync_user ON extension_sync_queue(user_id, status);
