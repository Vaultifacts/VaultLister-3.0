-- Migration 065: Batch 3 features schema

-- Competitor keyword clusters
CREATE TABLE IF NOT EXISTS competitor_keywords (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    cluster_name TEXT,
    competitor_count INTEGER DEFAULT 0,
    avg_price REAL,
    your_listing_count INTEGER DEFAULT 0,
    opportunity_score REAL DEFAULT 0,
    last_analyzed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Search analytics
CREATE TABLE IF NOT EXISTS search_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    search_term TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    results_found INTEGER DEFAULT 0,
    last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Expense categories for receipts
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'deduction', 'cogs')),
    tax_deductible INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Cross-platform SKU sync
CREATE TABLE IF NOT EXISTS sku_platform_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    master_sku TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_sku TEXT,
    inventory_id TEXT,
    sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('synced', 'pending', 'conflict', 'error')),
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- QR code analytics
CREATE TABLE IF NOT EXISTS qr_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    qr_type TEXT NOT NULL DEFAULT 'listing',
    reference_id TEXT,
    scan_count INTEGER DEFAULT 0,
    last_scanned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Warehouse bin locations
CREATE TABLE IF NOT EXISTS warehouse_bins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bin_code TEXT NOT NULL,
    label TEXT,
    zone TEXT,
    item_count INTEGER DEFAULT 0,
    barcode_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, bin_code)
);

-- Batch watermark settings
CREATE TABLE IF NOT EXISTS watermark_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'qr')),
    content TEXT,
    position TEXT DEFAULT 'bottom-right',
    opacity REAL DEFAULT 0.5,
    size INTEGER DEFAULT 24,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Whatnot co-hosts
CREATE TABLE IF NOT EXISTS whatnot_cohosts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cohost_name TEXT NOT NULL,
    role TEXT DEFAULT 'moderator' CHECK(role IN ('host', 'cohost', 'moderator')),
    revenue_split REAL DEFAULT 0,
    status TEXT DEFAULT 'invited' CHECK(status IN ('invited', 'accepted', 'declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES whatnot_events(id) ON DELETE CASCADE
);

-- Pre-stream staging
CREATE TABLE IF NOT EXISTS stream_staging (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT,
    inventory_id TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    flash_price REAL,
    bundle_group TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Onboarding progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'reseller',
    current_step INTEGER DEFAULT 0,
    completed_steps TEXT DEFAULT '[]',
    badges TEXT DEFAULT '[]',
    points INTEGER DEFAULT 0,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Offline sync queue
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    payload TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_competitor_keywords_user ON competitor_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON expense_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_sku_platform_links_user ON sku_platform_links(user_id);
CREATE INDEX IF NOT EXISTS idx_sku_platform_links_sku ON sku_platform_links(master_sku);
CREATE INDEX IF NOT EXISTS idx_qr_analytics_user ON qr_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_bins_user ON warehouse_bins(user_id);
CREATE INDEX IF NOT EXISTS idx_watermark_presets_user ON watermark_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_whatnot_cohosts_event ON whatnot_cohosts(event_id);
CREATE INDEX IF NOT EXISTS idx_stream_staging_user ON stream_staging(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user ON offline_sync_queue(user_id);

-- Seed default expense categories
INSERT OR IGNORE INTO expense_categories (id, user_id, name, type, tax_deductible) VALUES
    ('exp-shipping', 'system', 'Shipping Supplies', 'expense', 1),
    ('exp-packaging', 'system', 'Packaging Materials', 'expense', 1),
    ('exp-platform', 'system', 'Platform Fees', 'expense', 1),
    ('exp-inventory', 'system', 'Inventory Purchases', 'cogs', 1),
    ('exp-storage', 'system', 'Storage & Warehouse', 'expense', 1),
    ('exp-software', 'system', 'Software Subscriptions', 'expense', 1),
    ('exp-travel', 'system', 'Travel & Sourcing Trips', 'expense', 1),
    ('exp-returns', 'system', 'Returns & Refunds', 'expense', 0);
