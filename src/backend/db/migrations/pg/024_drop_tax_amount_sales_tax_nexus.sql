-- Drop dormant tax columns and sales_tax_nexus table (2026-04-19)
-- tax_amount columns have been DEFAULT 0 with no active reads/writes since tax feature removal
-- sales_tax_nexus routes were deleted; table has no active usage

DROP INDEX IF EXISTS idx_sales_tax_nexus_user;
DROP TABLE IF EXISTS sales_tax_nexus;

ALTER TABLE sales DROP COLUMN IF EXISTS tax_amount;
ALTER TABLE financial_transactions DROP COLUMN IF EXISTS tax_amount;
