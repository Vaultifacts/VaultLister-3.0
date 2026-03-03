-- Migration: 039_shipping_labels
-- Description: Add shipping labels generation and batch printing
-- Created: 2026-01-29

-- Shipping labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT,
    sale_id TEXT,

    -- Shipment info
    tracking_number TEXT,
    carrier TEXT NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
    service_type TEXT,                          -- e.g., 'Priority Mail', 'Ground', 'Express'

    -- Package details
    weight_oz REAL,
    length_in REAL,
    width_in REAL,
    height_in REAL,
    package_type TEXT DEFAULT 'package',        -- package, envelope, flat_rate_box, etc.

    -- Addresses
    from_name TEXT NOT NULL,
    from_company TEXT,
    from_street1 TEXT NOT NULL,
    from_street2 TEXT,
    from_city TEXT NOT NULL,
    from_state TEXT NOT NULL,
    from_zip TEXT NOT NULL,
    from_country TEXT DEFAULT 'US',
    from_phone TEXT,

    to_name TEXT NOT NULL,
    to_company TEXT,
    to_street1 TEXT NOT NULL,
    to_street2 TEXT,
    to_city TEXT NOT NULL,
    to_state TEXT NOT NULL,
    to_zip TEXT NOT NULL,
    to_country TEXT DEFAULT 'US',
    to_phone TEXT,
    to_email TEXT,

    -- Label details
    label_format TEXT DEFAULT 'pdf' CHECK (label_format IN ('pdf', 'png', 'zpl', 'epl')),
    label_size TEXT DEFAULT '4x6' CHECK (label_size IN ('4x6', '4x4', '8.5x11')),
    label_url TEXT,                             -- URL or path to generated label
    label_data TEXT,                            -- Base64 encoded label for inline display

    -- Costs
    postage_cost REAL,
    insurance_cost REAL DEFAULT 0,
    total_cost REAL,
    currency TEXT DEFAULT 'USD',

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'purchased', 'printed', 'shipped', 'delivered', 'returned', 'voided')),
    purchased_at DATETIME,
    printed_at DATETIME,
    shipped_at DATETIME,
    delivered_at DATETIME,
    voided_at DATETIME,

    -- Integration
    external_label_id TEXT,                     -- ID from shipping API (EasyPost, Shippo, etc.)
    external_shipment_id TEXT,
    rate_id TEXT,                               -- Selected rate ID

    -- Metadata
    notes TEXT,
    batch_id TEXT,                              -- For bulk operations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Label batches for bulk printing
CREATE TABLE IF NOT EXISTS label_batches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),

    -- Stats
    total_labels INTEGER DEFAULT 0,
    completed_labels INTEGER DEFAULT 0,
    failed_labels INTEGER DEFAULT 0,

    -- Output
    combined_pdf_url TEXT,                      -- Combined PDF of all labels
    manifest_url TEXT,                          -- Shipping manifest/SCAN form

    -- Costs
    total_postage REAL DEFAULT 0,

    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Shipping rates cache (for rate shopping)
CREATE TABLE IF NOT EXISTS shipping_rates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label_id TEXT,

    carrier TEXT NOT NULL,
    service TEXT NOT NULL,
    rate REAL NOT NULL,
    currency TEXT DEFAULT 'USD',

    delivery_days INTEGER,
    delivery_date TEXT,

    rate_id TEXT,                               -- External rate ID for purchasing

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME                         -- Rates expire after some time
);

-- Default return address
CREATE TABLE IF NOT EXISTS return_addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    street1 TEXT NOT NULL,
    street2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    country TEXT DEFAULT 'US',
    phone TEXT,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_batch ON shipping_labels(batch_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_label_batches_user ON label_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_label_batches_status ON label_batches(status);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_label ON shipping_rates(label_id);
CREATE INDEX IF NOT EXISTS idx_return_addresses_user ON return_addresses(user_id);
