-- Performance Indexes Migration
-- Adds indexes for frequently queried columns to improve query performance
-- Only creates indexes for tables that exist in the base schema

-- Inventory indexes (core table)
CREATE INDEX IF NOT EXISTS idx_inventory_user_status ON inventory(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_user_created ON inventory(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON inventory(brand);

-- Listings indexes (core table)
CREATE INDEX IF NOT EXISTS idx_listings_user_status ON listings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_inventory_id ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);

-- Sales indexes (core table)
CREATE INDEX IF NOT EXISTS idx_sales_user_created ON sales(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales(platform);

-- Orders indexes (core table)
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Users indexes (core table)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Shops indexes (core table)
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_platform ON shops(platform);
