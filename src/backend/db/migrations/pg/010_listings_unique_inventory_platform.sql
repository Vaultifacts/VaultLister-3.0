-- Add UNIQUE constraint on listings(inventory_id, platform, user_id)
-- Prevents duplicate listings for the same inventory item on the same platform per user.
-- Uses a partial index (WHERE deleted_at IS NULL) so soft-deleted listings don't block re-listing.

-- First, clean up any existing duplicates (keep the oldest listing per group)
DELETE FROM listings
WHERE id NOT IN (
    SELECT DISTINCT ON (inventory_id, platform, user_id) id
    FROM listings
    WHERE inventory_id IS NOT NULL AND deleted_at IS NULL
    ORDER BY inventory_id, platform, user_id, created_at ASC
)
AND inventory_id IS NOT NULL
AND deleted_at IS NULL
AND EXISTS (
    SELECT 1 FROM listings l2
    WHERE l2.inventory_id = listings.inventory_id
      AND l2.platform = listings.platform
      AND l2.user_id = listings.user_id
      AND l2.deleted_at IS NULL
      AND l2.id != listings.id
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_unique_inventory_platform
ON listings(inventory_id, platform, user_id)
WHERE inventory_id IS NOT NULL AND deleted_at IS NULL;
