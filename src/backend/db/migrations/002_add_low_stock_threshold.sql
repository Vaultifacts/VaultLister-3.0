-- Add low_stock_threshold column to inventory table
ALTER TABLE inventory ADD COLUMN low_stock_threshold INTEGER DEFAULT 5;
