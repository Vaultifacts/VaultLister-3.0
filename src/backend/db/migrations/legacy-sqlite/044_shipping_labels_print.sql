-- Add print tracking to shipping labels
ALTER TABLE shipping_labels ADD COLUMN printed_at TEXT;
ALTER TABLE shipping_labels ADD COLUMN format TEXT DEFAULT 'thermal_4x6';

-- DOWN: ALTER TABLE shipping_labels DROP COLUMN IF EXISTS printed_at;
-- DOWN: ALTER TABLE shipping_labels DROP COLUMN IF EXISTS format;
