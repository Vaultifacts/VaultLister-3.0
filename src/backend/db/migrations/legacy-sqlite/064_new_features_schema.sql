-- Migration 064: Schema for new feature batch (Privacy, ToS, Affiliate, Trash, Reports, Billing, Sales, Mobile)

-- Cookie consent tracking
CREATE TABLE IF NOT EXISTS cookie_consent (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    analytics INTEGER DEFAULT 0,
    marketing INTEGER DEFAULT 0,
    functional INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Terms of Service versions
CREATE TABLE IF NOT EXISTS tos_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary_of_changes TEXT,
    effective_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Terms of Service user acceptances
CREATE TABLE IF NOT EXISTS tos_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tos_version_id TEXT NOT NULL,
    accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tos_version_id) REFERENCES tos_versions(id)
);

-- Affiliate landing pages
CREATE TABLE IF NOT EXISTS affiliate_landing_pages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT,
    description TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    visits INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Affiliate commission tiers
CREATE TABLE IF NOT EXISTS affiliate_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    min_referrals INTEGER DEFAULT 0,
    commission_rate REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Affiliate commissions
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id TEXT PRIMARY KEY,
    affiliate_user_id TEXT NOT NULL,
    referred_user_id TEXT,
    tier_id TEXT,
    amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'paid', 'rejected')),
    landing_page_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME,
    FOREIGN KEY (affiliate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES affiliate_tiers(id)
);

-- Soft-delete tracking for Recently Deleted
CREATE TABLE IF NOT EXISTS deleted_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('inventory', 'listing', 'order', 'offer', 'checklist')),
    original_id TEXT NOT NULL,
    original_data TEXT NOT NULL,
    deletion_reason TEXT DEFAULT 'manual' CHECK(deletion_reason IN ('manual', 'automation', 'bulk_operation', 'expired', 'duplicate', 'other')),
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved reports
CREATE TABLE IF NOT EXISTS saved_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'custom',
    config TEXT DEFAULT '{}',
    last_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Scheduled report delivery
CREATE TABLE IF NOT EXISTS report_schedules (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'weekly' CHECK(frequency IN ('daily', 'weekly', 'monthly')),
    recipients TEXT DEFAULT '[]',
    format TEXT DEFAULT 'csv' CHECK(format IN ('csv', 'pdf', 'json')),
    next_run_at DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES saved_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Plan usage metering
CREATE TABLE IF NOT EXISTS plan_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    current_value INTEGER DEFAULT 0,
    plan_limit INTEGER DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sales tax nexus tracking
CREATE TABLE IF NOT EXISTS sales_tax_nexus (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    state TEXT NOT NULL,
    total_sales REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    nexus_threshold_amount REAL DEFAULT 100000,
    nexus_threshold_transactions INTEGER DEFAULT 200,
    has_nexus INTEGER DEFAULT 0,
    registered INTEGER DEFAULT 0,
    period_year INTEGER NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, state, period_year)
);

-- Buyer reputation profiles
CREATE TABLE IF NOT EXISTS buyer_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_username TEXT,
    platform TEXT,
    total_purchases INTEGER DEFAULT 0,
    total_returns INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    avg_payment_days REAL DEFAULT 0,
    communication_rating INTEGER DEFAULT 3,
    is_blocked INTEGER DEFAULT 0,
    notes TEXT,
    last_purchase_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user ON cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_tos_acceptances_user ON tos_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_landing_user ON affiliate_landing_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user ON affiliate_commissions(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_user ON deleted_items(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_type ON deleted_items(item_type);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_usage_user ON plan_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_tax_nexus_user ON sales_tax_nexus(user_id);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user ON buyer_profiles(user_id);

-- Seed default affiliate tiers
INSERT OR IGNORE INTO affiliate_tiers (id, name, min_referrals, commission_rate) VALUES
    ('tier-bronze', 'Bronze', 0, 0.10),
    ('tier-silver', 'Silver', 10, 0.15),
    ('tier-gold', 'Gold', 25, 0.20);

-- Seed initial ToS version
-- Full text lives at /terms.html (the canonical static page). The content field stores
-- the plain-text version for acceptance records and API consumers.
INSERT OR IGNORE INTO tos_versions (id, version, title, content, effective_date) VALUES
    ('tos-v1', '1.0', 'Terms of Service v1.0',
     'By creating an account or using VaultLister (the "Service"), you agree to be bound by these Terms of Service. The full Terms of Service are available at /terms.html and are incorporated here by reference. Key provisions: (1) You must be 18 or older to use the Service. (2) You are responsible for maintaining account security and all activity under your account. (3) Automation features may violate certain marketplace terms; you use them at your own risk. (4) VaultLister is not affiliated with or endorsed by any third-party marketplace. (5) AI-generated content is provided as-is; you are responsible for reviewing it before publishing. (6) Liability is limited to the greater of fees paid in the prior 12 months or $100. (7) The Service is provided "as is" without warranties. Full terms: https://vaultlister.com/terms.html — contact: legal@vaultlister.com',
     '2026-03-01');

-- DOWN: DROP INDEX IF EXISTS idx_cookie_consent_user;
-- DOWN: DROP INDEX IF EXISTS idx_tos_acceptances_user;
-- DOWN: DROP INDEX IF EXISTS idx_affiliate_landing_user;
-- DOWN: DROP INDEX IF EXISTS idx_affiliate_commissions_user;
-- DOWN: DROP INDEX IF EXISTS idx_deleted_items_user;
-- DOWN: DROP INDEX IF EXISTS idx_deleted_items_type;
-- DOWN: DROP INDEX IF EXISTS idx_saved_reports_user;
-- DOWN: DROP INDEX IF EXISTS idx_plan_usage_user;
-- DOWN: DROP INDEX IF EXISTS idx_sales_tax_nexus_user;
-- DOWN: DROP INDEX IF EXISTS idx_buyer_profiles_user;
-- DOWN: DROP TABLE IF EXISTS buyer_profiles;
-- DOWN: DROP TABLE IF EXISTS sales_tax_nexus;
-- DOWN: DROP TABLE IF EXISTS plan_usage;
-- DOWN: DROP TABLE IF EXISTS report_schedules;
-- DOWN: DROP TABLE IF EXISTS saved_reports;
-- DOWN: DROP TABLE IF EXISTS deleted_items;
-- DOWN: DROP TABLE IF EXISTS affiliate_commissions;
-- DOWN: DROP TABLE IF EXISTS affiliate_tiers;
-- DOWN: DROP TABLE IF EXISTS affiliate_landing_pages;
-- DOWN: DROP TABLE IF EXISTS tos_acceptances;
-- DOWN: DROP TABLE IF EXISTS tos_versions;
-- DOWN: DROP TABLE IF EXISTS cookie_consent;
-- DOWN: -- (includes data migration — manual data rollback required)
