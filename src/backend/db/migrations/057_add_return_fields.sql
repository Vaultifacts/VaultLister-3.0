-- Add return/refund management fields to orders
ALTER TABLE orders ADD COLUMN return_status TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN return_reason TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN return_requested_at DATETIME DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_amount REAL DEFAULT NULL;
ALTER TABLE orders ADD COLUMN return_tracking TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN refund_processed_at DATETIME DEFAULT NULL;
