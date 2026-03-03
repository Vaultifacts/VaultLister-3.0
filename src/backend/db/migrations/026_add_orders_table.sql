-- Add Orders Table
-- Tracks unfulfilled orders that need to be shipped

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_number TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
    buyer_username TEXT,
    buyer_email TEXT,
    buyer_address TEXT,
    item_id TEXT,
    item_title TEXT NOT NULL,
    item_sku TEXT,
    sale_price REAL NOT NULL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    platform_fee REAL DEFAULT 0,
    tracking_number TEXT,
    shipping_provider TEXT,
    shipping_label_url TEXT,
    expected_delivery TEXT,
    actual_delivery TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    shipped_at DATETIME,
    delivered_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
