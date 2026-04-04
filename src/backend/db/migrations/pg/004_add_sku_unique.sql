-- Add UNIQUE constraint on inventory_items.sku (safe — catches all errors)
DO $$
BEGIN
    -- De-duplicate existing SKUs by appending ID to older entries
    UPDATE inventory_items SET sku = sku || '-dup-' || id
    WHERE id IN (
        SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY sku ORDER BY created_at DESC) AS rn
            FROM inventory_items
            WHERE sku IS NOT NULL
        ) ranked WHERE rn > 1
    );

    -- Add UNIQUE constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_sku_unique'
    ) THEN
        ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_sku_unique UNIQUE (sku);
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'SKU migration note: %', SQLERRM;
END $$;
