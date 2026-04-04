-- Migration: 021_add_shipping_profiles.sql
-- Description: Add shipping profiles table for reusable shipping configurations

CREATE TABLE IF NOT EXISTS shipping_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    carrier TEXT,                    -- USPS, UPS, FedEx, etc.
    service_type TEXT,               -- Priority, Ground, Express, etc.
    package_type TEXT,               -- Box, Envelope, Poly Mailer, etc.
    weight_oz REAL DEFAULT 0,        -- Default weight in ounces
    length REAL DEFAULT 0,           -- Package dimensions
    width REAL DEFAULT 0,
    height REAL DEFAULT 0,
    handling_time_days INTEGER DEFAULT 1,
    domestic_cost REAL DEFAULT 0,    -- Flat rate for domestic
    international_cost REAL,         -- Flat rate for international (null = no intl)
    free_shipping_threshold REAL,    -- Order total for free shipping (null = none)
    is_default INTEGER DEFAULT 0,    -- Only one default per user
    platforms TEXT DEFAULT '[]',     -- JSON array: ["poshmark","ebay","mercari"]
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shipping_profiles_user ON shipping_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_profiles_default ON shipping_profiles(user_id, is_default);

-- DOWN: DROP INDEX IF EXISTS idx_shipping_profiles_user;
-- DOWN: DROP INDEX IF EXISTS idx_shipping_profiles_default;
-- DOWN: DROP TABLE IF EXISTS shipping_profiles;
