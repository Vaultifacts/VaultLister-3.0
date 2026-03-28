-- DB-09: sales.created_at index for date-range filters
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);

-- DB-10: inventory composite for WHERE user_id=? AND status!=? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_inventory_user_status_date ON inventory(user_id, status, created_at DESC);

-- DB-11: price_history composite for WHERE inventory_id=? ORDER BY changed_at DESC
CREATE INDEX IF NOT EXISTS idx_price_history_inv_date ON price_history(inventory_id, changed_at DESC);

-- DB-12: automation_logs composite for WHERE user_id=? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_date ON automation_logs(user_id, created_at DESC);

-- DB-13: notifications composite covering index for WHERE user_id=? AND is_read=0 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_date ON notifications(user_id, is_read, created_at DESC);

-- DB-28: UNIQUE constraint on offers(listing_id, platform_offer_id) to prevent webhook duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_listing_platform_unique ON offers(listing_id, platform_offer_id);

-- Re-analyze affected tables
ANALYZE sales;
ANALYZE inventory;
ANALYZE price_history;
ANALYZE automation_logs;
ANALYZE notifications;
ANALYZE offers;

-- DOWN: DROP INDEX IF EXISTS idx_sales_created_at;
-- DOWN: DROP INDEX IF EXISTS idx_inventory_user_status_date;
-- DOWN: DROP INDEX IF EXISTS idx_price_history_inv_date;
-- DOWN: DROP INDEX IF EXISTS idx_automation_logs_user_date;
-- DOWN: DROP INDEX IF EXISTS idx_notifications_user_read_date;
-- DOWN: DROP INDEX IF EXISTS idx_offers_listing_platform_unique;
