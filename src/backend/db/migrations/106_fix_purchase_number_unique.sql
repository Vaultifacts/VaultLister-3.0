-- Migration 106: Add UNIQUE constraint on purchases.purchase_number
-- Issue: DB-27 reported that purchase_number is not UNIQUE, allowing duplicate POs
-- Solution: Create UNIQUE index to prevent duplicate purchase numbers per user

-- Create UNIQUE index on purchase_number (per user scope)
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_number_unique ON purchases(user_id, purchase_number)
WHERE purchase_number IS NOT NULL;

-- DOWN: DROP INDEX IF EXISTS idx_purchases_number_unique;
