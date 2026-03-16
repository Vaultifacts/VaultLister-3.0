-- Optimize common queries that use TEMP B-TREE for ORDER BY
-- Covers: listings filtered by user+status sorted by date, offers same pattern

CREATE INDEX IF NOT EXISTS idx_listings_user_status_date ON listings(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_user_status_date ON offers(user_id, status, created_at DESC);
