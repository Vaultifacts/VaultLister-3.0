-- Add return/refund management fields to orders
ALTER TABLE orders ADD COLUMN return_status TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN return_reason TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN return_requested_at DATETIME DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_amount REAL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN return_tracking TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_processed_at DATETIME DEFAULT NULL;

-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS return_status;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS return_reason;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS return_requested_at;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS refund_amount;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS return_tracking;
-- DOWN: ALTER TABLE orders DROP COLUMN IF EXISTS refund_processed_at;
