-- Add UNIQUE constraint on inventory_items.sku
-- Prevents duplicate SKUs (e.g. VL-1774975842425 appeared twice in audit)
-- First de-duplicates any existing rows by appending a suffix to the older duplicate

-- Step 1: De-duplicate existing SKUs by appending '-dup-N' to older entries
DO $$
DECLARE
    rec RECORD;
    dup_num INTEGER;
BEGIN
    FOR rec IN
        SELECT id, sku, ROW_NUMBER() OVER (PARTITION BY sku ORDER BY created_at DESC) AS rn
        FROM inventory_items
        WHERE sku IN (SELECT sku FROM inventory_items GROUP BY sku HAVING COUNT(*) > 1)
    LOOP
        IF rec.rn > 1 THEN
            dup_num := rec.rn - 1;
            UPDATE inventory_items SET sku = rec.sku || '-dup-' || dup_num WHERE id = rec.id;
        END IF;
    END LOOP;
END $$;

-- Step 2: Add UNIQUE constraint (safe now that duplicates are resolved)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_sku_unique'
    ) THEN
        ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_sku_unique UNIQUE (sku);
    END IF;
END $$;
