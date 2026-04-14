-- Migration 014: Add buyer_state column to orders table for tax nexus tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_state TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_buyer_state ON orders(buyer_state) WHERE buyer_state IS NOT NULL;
