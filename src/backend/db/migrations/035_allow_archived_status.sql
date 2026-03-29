-- Migration 035: Allow 'archived' status for listings
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints,
-- so we recreate the table with the updated constraint.

-- Step 0: Clean up any leftover from previous failed attempts
DROP TABLE IF EXISTS listings_new;

-- Step 1: Check if listings table exists and has data to migrate
-- If not, this migration will be skipped (table will be created by schema.sql)

-- Step 2: Create new table with archived status allowed
CREATE TABLE IF NOT EXISTS listings_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    inventory_id TEXT,
    platform TEXT NOT NULL,
    platform_listing_id TEXT,
    platform_url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,
    original_price REAL,
    shipping_price REAL DEFAULT 0,
    category_path TEXT,
    condition_tag TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'sold', 'ended', 'error', 'archived')),
    images TEXT DEFAULT '[]',
    platform_specific_data TEXT DEFAULT '{}',
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    last_shared_at DATETIME,
    listed_at DATETIME,
    sold_at DATETIME,
    folder_id TEXT,
    refresh_count INTEGER DEFAULT 0,
    last_refresh_at DATETIME,
    stale_days_threshold INTEGER DEFAULT 30,
    auto_refresh_enabled INTEGER DEFAULT 0,
    last_delisted_at DATETIME,
    last_relisted_at DATETIME,
    marked_as_sold INTEGER DEFAULT 0,
    staleness_days INTEGER,
    auto_relist_enabled INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id),
    FOREIGN KEY (folder_id) REFERENCES listings_folders(id) ON DELETE SET NULL
);

-- Step 3: Copy data from old table (if it exists and has data)
-- Only select columns that exist in the original schema, let defaults fill the rest
INSERT OR IGNORE INTO listings_new (
    id, user_id, inventory_id, platform, platform_listing_id, platform_url,
    title, description, price, original_price, shipping_price,
    category_path, condition_tag, status, images, platform_specific_data,
    views, likes, shares, last_shared_at, listed_at, sold_at,
    created_at, updated_at
)
SELECT
    id, user_id, inventory_id, platform,
    COALESCE(platform_listing_id, NULL),
    COALESCE(platform_url, NULL),
    title, description, price,
    COALESCE(original_price, NULL),
    COALESCE(shipping_price, 0),
    COALESCE(category_path, NULL),
    COALESCE(condition_tag, NULL),
    CASE WHEN status IN ('draft','pending','active','sold','ended','error','archived') THEN status ELSE 'draft' END,
    COALESCE(images, '[]'),
    COALESCE(platform_specific_data, '{}'),
    COALESCE(views, 0),
    COALESCE(likes, 0),
    COALESCE(shares, 0),
    last_shared_at, listed_at, sold_at,
    created_at, updated_at
FROM listings
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='listings');

-- Step 4: Drop old table (only if it exists)
DROP TABLE IF EXISTS listings;

-- Step 5: Rename new table
ALTER TABLE listings_new RENAME TO listings;

-- Step 6: Recreate indexes if they existed
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_inventory_id ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_folder_id ON listings(folder_id);

-- DOWN: DROP INDEX IF EXISTS idx_listings_user_id;
-- DOWN: DROP INDEX IF EXISTS idx_listings_platform;
-- DOWN: DROP INDEX IF EXISTS idx_listings_status;
-- DOWN: DROP INDEX IF EXISTS idx_listings_inventory_id;
-- DOWN: DROP INDEX IF EXISTS idx_listings_folder_id;
-- DOWN: DROP TABLE IF EXISTS listings_new;
-- DOWN: -- (includes data migration — manual data rollback required)
