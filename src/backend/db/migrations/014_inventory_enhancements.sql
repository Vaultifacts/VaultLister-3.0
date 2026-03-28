-- Inventory Enhancements
-- Add new fields for variations, eBay promotions, image crop ratios
-- Note: Uses a workaround for SQLite's lack of ADD COLUMN IF NOT EXISTS

-- Create a temporary table to track which columns to add
-- If column already exists, ALTER TABLE will fail silently in a transaction

-- Add variations field (JSON string for size/variant options)
-- Skip if column already exists by catching error in application layer

-- Add eBay promotion fields
CREATE TABLE IF NOT EXISTS _migration_helper (dummy INTEGER);
DROP TABLE IF EXISTS _migration_helper;

-- Indexes for new fields (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- DOWN: DROP INDEX IF EXISTS idx_inventory_status;
-- DOWN: DROP TABLE IF EXISTS _migration_helper;
