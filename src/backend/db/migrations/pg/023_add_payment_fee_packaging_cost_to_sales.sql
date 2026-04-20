-- Add payment_fee and packaging_cost columns to sales table (2026-04-19)

ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC(10,2) DEFAULT 0;
