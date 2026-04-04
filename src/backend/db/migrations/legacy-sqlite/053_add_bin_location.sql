-- Add warehouse bin location tracking
-- Migration 053: Add bin_location for detailed warehouse organization

-- Add bin_location column to inventory table
ALTER TABLE inventory ADD COLUMN bin_location TEXT;

-- Create warehouse_locations table for saved locations
CREATE TABLE IF NOT EXISTS warehouse_locations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    warehouse TEXT,
    zone TEXT,
    aisle TEXT,
    shelf TEXT,
    bin TEXT,
    description TEXT,
    capacity INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster location lookups
CREATE INDEX IF NOT EXISTS idx_inventory_bin_location ON inventory(bin_location);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_user ON warehouse_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_name ON warehouse_locations(name);

-- DOWN: DROP INDEX IF EXISTS idx_inventory_bin_location;
-- DOWN: DROP INDEX IF EXISTS idx_warehouse_locations_user;
-- DOWN: DROP INDEX IF EXISTS idx_warehouse_locations_name;
-- DOWN: DROP TABLE IF EXISTS warehouse_locations;
-- DOWN: ALTER TABLE inventory DROP COLUMN IF EXISTS bin_location;
