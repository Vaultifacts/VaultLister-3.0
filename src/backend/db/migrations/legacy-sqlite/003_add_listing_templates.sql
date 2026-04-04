-- Add listing_templates table for reusable listing configurations
CREATE TABLE IF NOT EXISTS listing_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,

    -- Template field patterns
    title_pattern TEXT,
    description_template TEXT,
    tags TEXT, -- JSON array

    -- Pricing configuration
    pricing_strategy TEXT DEFAULT 'fixed', -- fixed, cost_plus, market
    markup_percentage REAL DEFAULT 0,

    -- Platform-specific settings
    platform_settings TEXT, -- JSON object with platform-specific configs

    -- Shipping configuration
    shipping_profile_id TEXT,

    -- Other settings
    condition_default TEXT,
    is_favorite INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listing_templates_user ON listing_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_templates_favorite ON listing_templates(user_id, is_favorite);

-- DOWN: DROP INDEX IF EXISTS idx_listing_templates_user;
-- DOWN: DROP INDEX IF EXISTS idx_listing_templates_favorite;
-- DOWN: DROP TABLE IF EXISTS listing_templates;
