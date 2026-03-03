-- Add compound index on listings(inventory_id, platform) for duplicate detection
-- The query WHERE inventory_id = ? AND platform = ? currently requires two separate index scans

CREATE INDEX IF NOT EXISTS idx_listings_inventory_platform
ON listings(inventory_id, platform);
