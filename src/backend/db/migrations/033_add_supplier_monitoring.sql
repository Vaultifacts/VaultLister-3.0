-- Migration: Add supplier monitoring tables
-- Tracks suppliers, monitored items, and price history

-- Suppliers (wholesalers, thrift stores, estate sales, etc.)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'wholesale', 'thrift', 'estate', 'online', 'auction', 'other'
    website TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_order_date TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Items monitored for price changes
CREATE TABLE IF NOT EXISTS supplier_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    url TEXT,
    current_price REAL,
    target_price REAL, -- Alert when price drops below this
    alert_threshold REAL DEFAULT 0.10, -- 10% drop triggers alert
    last_price REAL,
    price_change REAL DEFAULT 0,
    last_checked_at TEXT,
    alert_enabled INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price history for tracking trends
CREATE TABLE IF NOT EXISTS supplier_price_history (
    id TEXT PRIMARY KEY,
    supplier_item_id TEXT NOT NULL REFERENCES supplier_items(id) ON DELETE CASCADE,
    price REAL NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(type);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_items_user ON supplier_items(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_alert ON supplier_items(alert_enabled);
CREATE INDEX IF NOT EXISTS idx_price_history_item ON supplier_price_history(supplier_item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON supplier_price_history(recorded_at);
