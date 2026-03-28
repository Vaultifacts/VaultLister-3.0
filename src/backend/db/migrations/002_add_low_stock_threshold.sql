-- Add low_stock_threshold column to inventory table
ALTER TABLE inventory ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;

-- DOWN: ALTER TABLE inventory DROP COLUMN IF EXISTS low_stock_threshold;
