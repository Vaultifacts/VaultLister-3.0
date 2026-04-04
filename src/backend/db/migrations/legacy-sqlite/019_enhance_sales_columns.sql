-- Migration 019: Enhance Sales Table with FIFO Cost Tracking
-- Adds columns for detailed cost tracking and profit calculation

-- Add item_cost column for COGS (from FIFO calculation)
ALTER TABLE sales ADD COLUMN item_cost REAL DEFAULT 0;

-- Add customer_shipping_cost (what customer paid for shipping)
ALTER TABLE sales ADD COLUMN customer_shipping_cost REAL DEFAULT 0;

-- Add seller_shipping_cost column (actual shipping cost to seller)
-- Note: The existing 'shipping_cost' column was ambiguous
-- This new column is for clarity; shipping_cost can be deprecated or used as seller cost
ALTER TABLE sales ADD COLUMN seller_shipping_cost REAL DEFAULT 0;

-- Copy existing shipping_cost values to seller_shipping_cost
UPDATE sales SET seller_shipping_cost = COALESCE(shipping_cost, 0);

-- Populate item_cost from inventory cost_price for existing records
UPDATE sales SET item_cost = (
    SELECT COALESCE(cost_price, 0) FROM inventory WHERE inventory.id = sales.inventory_id
) WHERE inventory_id IS NOT NULL AND item_cost = 0;

-- Recalculate net_profit for existing records with new formula
-- net_profit = sale_price - platform_fee - item_cost - seller_shipping_cost - tax_amount
UPDATE sales SET net_profit = (
    COALESCE(sale_price, 0) -
    COALESCE(platform_fee, 0) -
    COALESCE(item_cost, 0) -
    COALESCE(seller_shipping_cost, 0) -
    COALESCE(tax_amount, 0)
);

-- Create index for date-based queries on sales
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- DOWN: DROP INDEX IF EXISTS idx_sales_created_at;
-- DOWN: ALTER TABLE sales DROP COLUMN IF EXISTS item_cost;
-- DOWN: ALTER TABLE sales DROP COLUMN IF EXISTS customer_shipping_cost;
-- DOWN: ALTER TABLE sales DROP COLUMN IF EXISTS seller_shipping_cost;
-- DOWN: -- (includes data migration — manual data rollback required)
