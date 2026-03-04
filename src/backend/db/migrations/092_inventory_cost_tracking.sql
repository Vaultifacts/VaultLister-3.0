-- Add purchase date and supplier to inventory
ALTER TABLE inventory ADD COLUMN purchase_date TEXT;
ALTER TABLE inventory ADD COLUMN supplier TEXT;
