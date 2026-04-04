-- Add UNIQUE constraint on inventory_items.sku
-- Prevents duplicate SKUs (e.g. VL-1774975842425 appeared twice in audit)
-- If duplicates exist, resolve them before applying this migration.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_sku_unique'
    ) THEN
        ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_sku_unique UNIQUE (sku);
    END IF;
END $$;
