-- Performance Optimization Indexes
-- Created: 2026-02-03
-- Purpose: Add missing indexes for frequently queried columns

-- ============================================
-- Users Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- ============================================
-- Inventory Table Indexes
-- ============================================
-- Composite index for common filters
CREATE INDEX IF NOT EXISTS idx_inventory_user_status ON inventory(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_user_category ON inventory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_updated ON inventory(updated_at DESC);

-- Full-text search support (SQLite FTS5)
-- Note: FTS5 requires separate virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS inventory_fts USING fts5(
    title,
    description,
    brand,
    category,
    tags,
    content='inventory',
    content_rowid='rowid'
);

-- Trigger to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS inventory_fts_insert AFTER INSERT ON inventory BEGIN
    INSERT INTO inventory_fts(rowid, title, description, brand, category, tags)
    VALUES (NEW.rowid, NEW.title, NEW.description, NEW.brand, NEW.category, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS inventory_fts_delete AFTER DELETE ON inventory BEGIN
    INSERT INTO inventory_fts(inventory_fts, rowid, title, description, brand, category, tags)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.brand, OLD.category, OLD.tags);
END;

CREATE TRIGGER IF NOT EXISTS inventory_fts_update AFTER UPDATE ON inventory BEGIN
    INSERT INTO inventory_fts(inventory_fts, rowid, title, description, brand, category, tags)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.brand, OLD.category, OLD.tags);
    INSERT INTO inventory_fts(rowid, title, description, brand, category, tags)
    VALUES (NEW.rowid, NEW.title, NEW.description, NEW.brand, NEW.category, NEW.tags);
END;

-- ============================================
-- Listings Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_listings_user_platform ON listings(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_listings_user_status ON listings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_inventory ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_external ON listings(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);

-- ============================================
-- Sales Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(user_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_platform ON sales(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_sales_listing ON sales(listing_id);
CREATE INDEX IF NOT EXISTS idx_sales_date_range ON sales(sold_at);

-- ============================================
-- Sessions Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- Automations Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_automations_user_active ON automations(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_automations_next_run ON automations(next_run_at) WHERE is_active = 1;

-- ============================================
-- Security Logs Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON security_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON security_logs(ip_or_user, created_at DESC);

-- ============================================
-- Notifications Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- ============================================
-- Orders Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- ============================================
-- Analytics: Analyze tables for query optimizer
-- ============================================
ANALYZE users;
ANALYZE inventory;
ANALYZE listings;
ANALYZE sales;
ANALYZE sessions;
ANALYZE automations;
ANALYZE security_logs;
ANALYZE notifications;
ANALYZE orders;

-- ============================================
-- Vacuum to reclaim space and defragment
-- Note: VACUUM should be run periodically, not on every migration
-- ============================================
-- VACUUM;

-- DOWN: DROP TRIGGER IF EXISTS inventory_fts_insert;
-- DOWN: DROP TRIGGER IF EXISTS inventory_fts_delete;
-- DOWN: DROP TRIGGER IF EXISTS inventory_fts_update;
-- DOWN: DROP INDEX IF EXISTS idx_users_email_active;
-- DOWN: DROP INDEX IF EXISTS idx_users_subscription_tier;
-- DOWN: DROP INDEX IF EXISTS idx_users_last_login;
-- DOWN: DROP INDEX IF EXISTS idx_inventory_user_status;
-- DOWN: DROP INDEX IF EXISTS idx_inventory_user_category;
-- DOWN: DROP INDEX IF EXISTS idx_inventory_created;
-- DOWN: DROP INDEX IF EXISTS idx_inventory_updated;
-- DOWN: DROP INDEX IF EXISTS idx_listings_user_platform;
-- DOWN: DROP INDEX IF EXISTS idx_listings_user_status;
-- DOWN: DROP INDEX IF EXISTS idx_listings_inventory;
-- DOWN: DROP INDEX IF EXISTS idx_listings_external;
-- DOWN: DROP INDEX IF EXISTS idx_listings_created;
-- DOWN: DROP INDEX IF EXISTS idx_sales_user_date;
-- DOWN: DROP INDEX IF EXISTS idx_sales_user_platform;
-- DOWN: DROP INDEX IF EXISTS idx_sales_listing;
-- DOWN: DROP INDEX IF EXISTS idx_sales_date_range;
-- DOWN: DROP INDEX IF EXISTS idx_sessions_user;
-- DOWN: DROP INDEX IF EXISTS idx_sessions_token;
-- DOWN: DROP INDEX IF EXISTS idx_sessions_expires;
-- DOWN: DROP INDEX IF EXISTS idx_automations_user_active;
-- DOWN: DROP INDEX IF EXISTS idx_automations_next_run;
-- DOWN: DROP INDEX IF EXISTS idx_security_logs_event;
-- DOWN: DROP INDEX IF EXISTS idx_security_logs_ip;
-- DOWN: DROP INDEX IF EXISTS idx_notifications_user_read;
-- DOWN: DROP INDEX IF EXISTS idx_orders_user_status;
-- DOWN: DROP INDEX IF EXISTS idx_orders_tracking;
-- DOWN: DROP TABLE IF EXISTS inventory_fts;
