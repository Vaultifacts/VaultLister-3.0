-- Fix: Add missing UNIQUE(inventory_id, platform) constraint on listings table.
-- The constraint was declared in schema.sql but never applied to the live table
-- because CREATE TABLE IF NOT EXISTS skips recreation.
--
-- First, deduplicate any existing rows that would violate the constraint.
-- Keep the most recently updated row for each (inventory_id, platform) pair.
DELETE FROM listings WHERE rowid NOT IN (
    SELECT MAX(rowid) FROM listings
    WHERE inventory_id IS NOT NULL
    GROUP BY inventory_id, platform
) AND inventory_id IN (
    SELECT inventory_id FROM listings
    WHERE inventory_id IS NOT NULL
    GROUP BY inventory_id, platform
    HAVING COUNT(*) > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_inv_platform ON listings(inventory_id, platform);

-- DOWN: DROP INDEX IF EXISTS idx_listings_inv_platform;
-- DOWN: -- (includes data migration — manual data rollback required)
