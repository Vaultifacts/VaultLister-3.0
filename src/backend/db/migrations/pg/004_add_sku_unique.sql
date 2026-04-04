-- Add UNIQUE constraint on inventory_items.sku
-- Prevents duplicate SKUs (e.g. VL-1774975842425 appeared twice in audit)
-- Safely handles existing duplicates by appending suffix to older entries

-- Step 1: De-duplicate existing SKUs
UPDATE inventory_items SET sku = sku || '-dup-' || id
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY sku ORDER BY created_at DESC) AS rn
        FROM inventory_items
        WHERE sku IS NOT NULL
    ) ranked WHERE rn > 1
);

-- Step 2: Add UNIQUE constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_sku_unique'
    ) THEN
        ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_sku_unique UNIQUE (sku);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'SKU unique constraint: %', SQLERRM;
END $$;
