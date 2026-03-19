-- Add soft delete support to offers table (DB-30: restore duplicate prevention)

ALTER TABLE offers ADD COLUMN deleted_at DATETIME;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_offers_deleted_at ON offers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_offers_user_deleted ON offers(user_id, deleted_at);
