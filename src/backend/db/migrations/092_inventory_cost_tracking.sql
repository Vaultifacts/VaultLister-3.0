-- Add purchase date and supplier to inventory
ALTER TABLE inventory ADD COLUMN purchase_date TEXT;
ALTER TABLE inventory ADD COLUMN supplier TEXT;

-- DOWN: ALTER TABLE inventory DROP COLUMN IF EXISTS purchase_date;
-- DOWN: ALTER TABLE inventory DROP COLUMN IF EXISTS supplier;
