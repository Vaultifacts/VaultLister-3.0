-- Migration 063: Add missing schema for verified features
-- Fixes: listings stale, order priority/split, inventory age, supplier lead time, size charts, prediction models

-- Fix listings/stale 500 error: add last_relisted_at column
ALTER TABLE listings ADD COLUMN last_relisted_at DATETIME DEFAULT NULL;

-- Order priority flags (completely missing)
ALTER TABLE orders ADD COLUMN priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent'));
ALTER TABLE orders ADD COLUMN priority_note TEXT DEFAULT NULL;

-- Split shipment support (completely missing)
ALTER TABLE orders ADD COLUMN is_split_shipment INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN parent_order_id TEXT DEFAULT NULL REFERENCES orders(id);
ALTER TABLE orders ADD COLUMN shipment_number INTEGER DEFAULT NULL;
ALTER TABLE orders ADD COLUMN total_shipments INTEGER DEFAULT NULL;

-- Inventory acquired_date for age tracking
ALTER TABLE inventory ADD COLUMN acquired_date DATE DEFAULT NULL;

-- Supplier lead time tracking
ALTER TABLE suppliers ADD COLUMN lead_time_days INTEGER DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN avg_delivery_days REAL DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN order_accuracy REAL DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN on_time_delivery REAL DEFAULT NULL;
ALTER TABLE suppliers ADD COLUMN quality_rating REAL DEFAULT NULL;

-- Purchase orders table for suppliers
CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    po_number TEXT,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'confirmed', 'shipped', 'received', 'cancelled')),
    total_amount REAL DEFAULT 0,
    notes TEXT,
    expected_delivery DATE,
    actual_delivery DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price REAL DEFAULT 0,
    total_price REAL DEFAULT 0,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

-- Size charts tables (full backend)
CREATE TABLE IF NOT EXISTS size_charts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    garment_type TEXT,
    brand TEXT,
    gender TEXT DEFAULT 'unisex' CHECK(gender IN ('mens', 'womens', 'kids', 'unisex')),
    size_system TEXT DEFAULT 'US',
    measurements TEXT DEFAULT '[]',
    sizes TEXT DEFAULT '[]',
    custom_fields TEXT DEFAULT '[]',
    notes TEXT,
    is_template INTEGER DEFAULT 0,
    linked_listings TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_size_charts_user ON size_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_size_charts_category ON size_charts(category);
CREATE INDEX IF NOT EXISTS idx_size_charts_brand ON size_charts(brand);

-- Brand-specific size guide data
CREATE TABLE IF NOT EXISTS brand_size_guides (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    garment_type TEXT NOT NULL,
    size_label TEXT NOT NULL,
    us_size TEXT,
    uk_size TEXT,
    eu_size TEXT,
    jp_size TEXT,
    cn_size TEXT,
    it_size TEXT,
    fr_size TEXT,
    au_size TEXT,
    chest_cm REAL,
    waist_cm REAL,
    hips_cm REAL,
    length_cm REAL,
    shoulder_cm REAL,
    sleeve_cm REAL,
    inseam_cm REAL,
    foot_length_cm REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_brand_guides_brand ON brand_size_guides(brand);

-- Prediction model configurations
CREATE TABLE IF NOT EXISTS prediction_models (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'linear' CHECK(model_type IN ('linear', 'exponential', 'seasonal', 'moving_average', 'weighted')),
    parameters TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    accuracy_score REAL DEFAULT NULL,
    last_trained_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- What-if scenarios
CREATE TABLE IF NOT EXISTS prediction_scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_data TEXT DEFAULT '{}',
    adjustments TEXT DEFAULT '{}',
    results TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Platform fee tracking
CREATE TABLE IF NOT EXISTS platform_fee_summary (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    period TEXT NOT NULL,
    total_fees REAL DEFAULT 0,
    total_sales REAL DEFAULT 0,
    fee_percentage REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_prediction_models_user ON prediction_models(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_scenarios_user ON prediction_scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_fee_summary_user ON platform_fee_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);

-- DOWN: DROP INDEX IF EXISTS idx_size_charts_user;
-- DOWN: DROP INDEX IF EXISTS idx_size_charts_category;
-- DOWN: DROP INDEX IF EXISTS idx_size_charts_brand;
-- DOWN: DROP INDEX IF EXISTS idx_brand_guides_brand;
-- DOWN: DROP INDEX IF EXISTS idx_purchase_orders_user;
-- DOWN: DROP INDEX IF EXISTS idx_purchase_orders_supplier;
-- DOWN: DROP INDEX IF EXISTS idx_prediction_models_user;
-- DOWN: DROP INDEX IF EXISTS idx_prediction_scenarios_user;
-- DOWN: DROP INDEX IF EXISTS idx_platform_fee_summary_user;
-- DOWN: DROP INDEX IF EXISTS idx_orders_priority;
-- DOWN: DROP TABLE IF EXISTS platform_fee_summary;
-- DOWN: DROP TABLE IF EXISTS prediction_scenarios;
-- DOWN: DROP TABLE IF EXISTS prediction_models;
-- DOWN: DROP TABLE IF EXISTS brand_size_guides;
-- DOWN: DROP TABLE IF EXISTS size_charts;
-- DOWN: DROP TABLE IF EXISTS purchase_order_items;
-- DOWN: DROP TABLE IF EXISTS purchase_orders;
-- DOWN: ALTER TABLE listings DROP COLUMN IF EXISTS last_relisted_at;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS priority;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS priority_note;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS is_split_shipment;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS parent_order_id;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS shipment_number;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS total_shipments;
-- DOWN: ALTER TABLE inventory DROP COLUMN IF EXISTS acquired_date;
-- DOWN: ALTER TABLE suppliers DROP COLUMN IF EXISTS lead_time_days;
-- DOWN: ALTER TABLE suppliers DROP COLUMN IF EXISTS avg_delivery_days;
-- DOWN: ALTER TABLE suppliers DROP COLUMN IF EXISTS order_accuracy;
-- DOWN: ALTER TABLE suppliers DROP COLUMN IF EXISTS on_time_delivery;
-- DOWN: ALTER TABLE suppliers DROP COLUMN IF EXISTS quality_rating;
