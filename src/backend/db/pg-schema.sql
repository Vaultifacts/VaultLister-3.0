-- VaultLister 3.0 — PostgreSQL Schema
-- Consolidated from SQLite schema.sql + 112 migrations + 11 service/route files
-- This is migration 001 for fresh PostgreSQL installs
-- Do not modify existing tables here — add new migrations instead
--
-- Conversion notes:
--   AUTOINCREMENT  → SERIAL
--   DATETIME       → TIMESTAMPTZ (with NOW() default)
--   TEXT DEFAULT '{}' (JSON) → JSONB DEFAULT '{}'::jsonb
--   TEXT DEFAULT '[]' (JSON) → JSONB DEFAULT '[]'::jsonb
--   REAL           → DOUBLE PRECISION
--   BLOB           → BYTEA
--   FTS5 virtual   → tsvector column + GIN index + trigger
--   Booleans kept as INTEGER (Phase 3+ cleanup)

BEGIN;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users table (schema.sql + migrations 047, 084, 098, 102)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'business')),
    subscription_expires_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',
    locale TEXT DEFAULT 'en-US',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active INTEGER DEFAULT 1,
    preferences JSONB DEFAULT '{}'::jsonb,
    onboarding_completed INTEGER DEFAULT 0,
    -- 047: security features
    email_verified INTEGER DEFAULT 0,
    email_verified_at TIMESTAMPTZ,
    mfa_enabled INTEGER DEFAULT 0,
    mfa_secret TEXT,
    mfa_backup_codes JSONB,
    -- 084: enhanced MFA
    mfa_method TEXT,
    phone_number TEXT,
    phone_verified INTEGER DEFAULT 0,
    pending_phone TEXT,
    phone_verification_code TEXT,
    phone_verification_expires TEXT,
    -- 098: admin flag
    is_admin INTEGER NOT NULL DEFAULT 0,
    -- 102: Stripe
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT
);

-- Sessions table for refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_valid INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Connected platforms/shops (schema.sql + migrations 004, 045, 101, 110)
CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_username TEXT,
    platform_user_id TEXT,
    credentials TEXT,
    is_connected INTEGER DEFAULT 1,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'idle',
    settings JSONB DEFAULT '{}'::jsonb,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- 004: OAuth
    oauth_provider TEXT,
    oauth_token TEXT,
    oauth_refresh_token TEXT,
    oauth_token_expires_at TIMESTAMPTZ,
    oauth_scopes TEXT,
    connection_type TEXT DEFAULT 'manual',
    -- 045: token refresh tracking
    consecutive_refresh_failures INTEGER DEFAULT 0,
    last_token_refresh_at TIMESTAMPTZ,
    token_refresh_error TEXT,
    token_refresh_error_at TIMESTAMPTZ,
    -- 101: auto sync
    auto_sync_enabled INTEGER NOT NULL DEFAULT 1,
    auto_sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
    -- 110: sync error
    sync_error TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, platform)
);

-- Inventory items (schema.sql + migrations 001, 053, 092)
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sku TEXT,
    title TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    category TEXT,
    subcategory TEXT,
    size TEXT,
    color TEXT,
    condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    cost_price DOUBLE PRECISION DEFAULT 0,
    list_price DOUBLE PRECISION NOT NULL,
    quantity INTEGER DEFAULT 1,
    low_stock_threshold INTEGER DEFAULT 5,
    weight DOUBLE PRECISION,
    dimensions TEXT,
    material TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    thumbnail_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold', 'archived', 'deleted')),
    location TEXT,
    notes TEXT,
    blockchain_hash TEXT,
    sustainability_score DOUBLE PRECISION,
    ai_generated_data JSONB DEFAULT '{}'::jsonb,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- 001: soft delete
    deleted_at TIMESTAMPTZ,
    -- 053: bin location
    bin_location TEXT,
    -- 063: acquired date
    acquired_date DATE,
    -- 092: cost tracking
    purchase_date TEXT,
    supplier TEXT,
    -- tsvector for full-text search (replaces FTS5)
    search_vector TSVECTOR,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Listings folders (migration 016 + 104 fix)
CREATE TABLE IF NOT EXISTS listings_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Platform-specific listings (schema.sql + 020 + 035 final state)
CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    inventory_id TEXT,
    platform TEXT NOT NULL,
    platform_listing_id TEXT,
    platform_url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    price DOUBLE PRECISION,
    original_price DOUBLE PRECISION,
    shipping_price DOUBLE PRECISION DEFAULT 0,
    category_path TEXT,
    condition_tag TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'sold', 'ended', 'error', 'archived')),
    images JSONB DEFAULT '[]'::jsonb,
    platform_specific_data JSONB DEFAULT '{}'::jsonb,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    last_shared_at TIMESTAMPTZ,
    listed_at TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    folder_id TEXT,
    -- 020: refresh tracking
    refresh_count INTEGER DEFAULT 0,
    last_refresh_at TIMESTAMPTZ,
    stale_days_threshold INTEGER DEFAULT 30,
    auto_refresh_enabled INTEGER DEFAULT 0,
    last_delisted_at TIMESTAMPTZ,
    last_relisted_at TIMESTAMPTZ,
    marked_as_sold INTEGER DEFAULT 0,
    staleness_days INTEGER,
    auto_relist_enabled INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id),
    FOREIGN KEY (folder_id) REFERENCES listings_folders(id) ON DELETE SET NULL
);

-- Sales/Orders (schema.sql + migration 019)
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT,
    inventory_id TEXT,
    platform TEXT NOT NULL,
    platform_order_id TEXT,
    buyer_username TEXT,
    buyer_address TEXT,
    sale_price DOUBLE PRECISION NOT NULL,
    platform_fee DOUBLE PRECISION DEFAULT 0,
    shipping_cost DOUBLE PRECISION DEFAULT 0,
    tax_amount DOUBLE PRECISION DEFAULT 0,
    net_profit DOUBLE PRECISION,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
    tracking_number TEXT,
    carrier TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- 019: enhanced cost columns
    item_cost DOUBLE PRECISION DEFAULT 0,
    customer_shipping_cost DOUBLE PRECISION DEFAULT 0,
    seller_shipping_cost DOUBLE PRECISION DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- Listing templates
CREATE TABLE IF NOT EXISTS listing_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    title_pattern TEXT,
    description_template TEXT,
    tags TEXT,
    pricing_strategy TEXT DEFAULT 'fixed',
    markup_percentage DOUBLE PRECISION DEFAULT 0,
    platform_settings TEXT,
    shipping_profile_id TEXT,
    condition_default TEXT,
    is_favorite INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Offers received (schema.sql + 108 soft delete)
CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_offer_id TEXT,
    buyer_username TEXT,
    offer_amount DOUBLE PRECISION NOT NULL,
    counter_amount DOUBLE PRECISION,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'countered', 'expired', 'cancelled')),
    auto_action TEXT,
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

-- Automation rules (schema.sql + 093 + 094)
CREATE TABLE IF NOT EXISTS automation_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('share', 'follow', 'offer', 'relist', 'price_drop', 'custom')),
    platform TEXT,
    is_enabled INTEGER DEFAULT 1,
    schedule TEXT,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Automation logs
CREATE TABLE IF NOT EXISTS automation_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    rule_id TEXT,
    type TEXT NOT NULL,
    platform TEXT,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'skipped')),
    action_taken TEXT,
    target_id TEXT,
    details TEXT,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE SET NULL
);

-- Task queue for background jobs
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    priority INTEGER DEFAULT 5,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    result TEXT,
    error_message TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    is_read INTEGER DEFAULT 0,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- AUTH & SECURITY TABLES
-- ============================================================

-- Security logs
CREATE TABLE IF NOT EXISTS security_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    ip_or_user TEXT NOT NULL,
    user_id TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- OAuth states for marketplace connections (migration 004 + 087 PKCE)
CREATE TABLE IF NOT EXISTS oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT,
    code_verifier TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email verification tokens (migration 047)
CREATE TABLE IF NOT EXISTS verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'mfa_setup', 'mfa_login')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MFA events (migration 047)
CREATE TABLE IF NOT EXISTS mfa_events (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('enabled', 'disabled', 'verified', 'backup_used', 'failed')),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password resets (migration 070)
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Email verifications (migration 070)
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- WebAuthn credentials (migration 081)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    sign_count INTEGER DEFAULT 0,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Backup codes (migration 081)
CREATE TABLE IF NOT EXISTS backup_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    batch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SMS verification codes (migration 081)
CREATE TABLE IF NOT EXISTS sms_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- TOTP secrets (migration 081)
CREATE TABLE IF NOT EXISTS totp_secrets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    secret TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth accounts / social login (migration 052)
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id)
);

-- CSRF tokens (migration 112)
CREATE TABLE IF NOT EXISTS csrf_tokens (
    token TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

-- ============================================================
-- OBSERVABILITY & LOGGING
-- ============================================================

-- Request logs
CREATE TABLE IF NOT EXISTS request_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Error logs (schema.sql version — superset)
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    stack TEXT,
    method TEXT,
    path TEXT,
    user_id TEXT,
    ip_address TEXT,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit logs (schema.sql + 052 enhanced)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    category TEXT,
    severity TEXT DEFAULT 'info',
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- System alerts
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health checks (migration 050)
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    status TEXT NOT NULL,
    checks JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics events (from services/analytics.js)
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    properties TEXT,
    user_id TEXT,
    session_id TEXT,
    timestamp TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
);

-- Analytics snapshots
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    platform TEXT,
    metrics TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date, platform)
);

-- Rate limit logs (from routes/rateLimitDashboard.js)
CREATE TABLE IF NOT EXISTS rate_limit_logs (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    ip TEXT,
    user_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RUM metrics (migration 086)
CREATE TABLE IF NOT EXISTS rum_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DOUBLE PRECISION NOT NULL,
    page_url TEXT,
    user_agent TEXT,
    connection_type TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================
-- USER PREFERENCES & SETTINGS
-- ============================================================

-- User preferences (key/value)
CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, key)
);

-- App settings (system-wide key/value)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- IMAGE BANK
-- ============================================================

-- Image bank folders
CREATE TABLE IF NOT EXISTS image_bank_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES image_bank_folders(id) ON DELETE CASCADE
);

-- Image bank
CREATE TABLE IF NOT EXISTS image_bank (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_id TEXT,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    aspect_ratio DOUBLE PRECISION,
    dominant_color TEXT,
    title TEXT,
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    used_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    source_inventory_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- tsvector for full-text search
    search_vector TSVECTOR,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES image_bank_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (source_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- Image bank usage (many-to-many)
CREATE TABLE IF NOT EXISTS image_bank_usage (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    UNIQUE(image_id, inventory_id)
);

-- Image edit history
CREATE TABLE IF NOT EXISTS image_edit_history (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    edit_type TEXT NOT NULL,
    parameters TEXT,
    original_path TEXT,
    edited_path TEXT NOT NULL,
    cloudinary_public_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Batch photo jobs (migration 024)
CREATE TABLE IF NOT EXISTS batch_photo_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    total_images INTEGER NOT NULL,
    processed_images INTEGER DEFAULT 0,
    failed_images INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    transformations TEXT NOT NULL,
    preset_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batch_photo_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    original_url TEXT,
    result_url TEXT,
    cloudinary_public_id TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    FOREIGN KEY (job_id) REFERENCES batch_photo_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS batch_photo_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    transformations TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Watermark presets (migration 065)
CREATE TABLE IF NOT EXISTS watermark_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'qr')),
    content TEXT,
    position TEXT DEFAULT 'bottom-right',
    opacity DOUBLE PRECISION DEFAULT 0.5,
    size INTEGER DEFAULT 24,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- CHATBOT
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    is_resolved INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    helpful_rating INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_canned_responses (
    id TEXT PRIMARY KEY,
    trigger_keywords TEXT NOT NULL,
    category TEXT,
    response_template TEXT NOT NULL,
    quick_actions JSONB DEFAULT '[]'::jsonb,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMMUNITY
-- ============================================================

CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('discussion', 'success', 'tip')),
    category TEXT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    sold_item_title TEXT,
    sale_price DOUBLE PRECISION,
    cost_price DOUBLE PRECISION,
    profit DOUBLE PRECISION,
    platform TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    flagged_count INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    -- tsvector for full-text search
    search_vector TSVECTOR,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_replies (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_reply_id TEXT,
    body TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES community_replies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_reactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('upvote', 'downvote', 'congratulate', 'helpful')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, target_type, target_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS community_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation', 'other')),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS community_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_type TEXT NOT NULL,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_type)
);

CREATE TABLE IF NOT EXISTS community_stats (
    user_id TEXT PRIMARY KEY,
    posts_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    upvotes_received INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    total_sales_shared DOUBLE PRECISION DEFAULT 0,
    total_profit_shared DOUBLE PRECISION DEFAULT 0,
    badge_count INTEGER DEFAULT 0,
    last_active_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- HELP & SUPPORT
-- ============================================================

CREATE TABLE IF NOT EXISTS help_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    category TEXT,
    duration INTEGER,
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS help_faq (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    position INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS help_faq_votes (
    id TEXT PRIMARY KEY,
    faq_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (faq_id) REFERENCES help_faq(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(faq_id, user_id)
);

CREATE TABLE IF NOT EXISTS help_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    author_id TEXT,
    is_published INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- tsvector for full-text search
    search_vector TSVECTOR,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS help_article_votes (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(article_id, user_id)
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('contact', 'bug', 'feature_request')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    screenshots JSONB DEFAULT '[]'::jsonb,
    page_context TEXT,
    browser_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT,
    is_staff_reply INTEGER DEFAULT 0,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- ROADMAP & FEEDBACK
-- ============================================================

CREATE TABLE IF NOT EXISTS roadmap_features (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
    category TEXT,
    eta TEXT,
    votes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roadmap_votes (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (feature_id) REFERENCES roadmap_features(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(feature_id, user_id)
);

CREATE TABLE IF NOT EXISTS feedback_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('feature', 'improvement', 'bug', 'general')),
    category TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'planned', 'completed', 'declined')),
    admin_response TEXT,
    -- 059: enhancements
    votes_up INTEGER DEFAULT 0,
    votes_down INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_anonymous INTEGER DEFAULT 0,
    screenshot_data TEXT,
    screenshot_mime TEXT,
    roadmap_feature_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback_votes (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(feedback_id, user_id),
    FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback_responses (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- CALENDAR & CHECKLISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    type TEXT CHECK (type IN ('listing', 'order', 'automation', 'reminder', 'custom')),
    color TEXT DEFAULT '#6366f1',
    related_id TEXT,
    related_type TEXT CHECK (related_type IN ('inventory', 'listing', 'order', 'automation')),
    all_day INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    depends_on TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_sync_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'ical')),
    sync_direction TEXT NOT NULL DEFAULT 'both' CHECK (sync_direction IN ('import', 'export', 'both')),
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('realtime', 'hourly', 'daily', 'manual')),
    is_active INTEGER NOT NULL DEFAULT 0,
    calendar_name TEXT,
    last_synced_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    checklist_id TEXT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    due_date DATE,
    recurring_interval TEXT DEFAULT 'once',
    last_completed_at TIMESTAMPTZ,
    notes TEXT DEFAULT '',
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_shares (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shared_with TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- FINANCIAL ACCOUNTING
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN (
        'Bank', 'AR', 'Other Current Asset', 'Fixed Asset', 'Other Asset',
        'AP', 'Credit Card', 'Other Current Liability', 'Long Term Liability',
        'Equity', 'Income', 'COGS', 'Expense', 'Other Income', 'Other Expense'
    )),
    description TEXT,
    balance DOUBLE PRECISION DEFAULT 0,
    parent_account_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purchase_number TEXT,
    vendor_name TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
    shipping_cost DOUBLE PRECISION DEFAULT 0,
    tax_amount DOUBLE PRECISION DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Credit Card', 'Bank Transfer', 'Check', 'PayPal', 'Other')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'import')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    inventory_id TEXT,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    account_id TEXT,
    category TEXT,
    reference_type TEXT CHECK (reference_type IN ('purchase', 'sale', 'expense', 'income', 'manual', 'transfer')),
    reference_id TEXT,
    -- 060: split columns
    parent_transaction_id TEXT REFERENCES financial_transactions(id),
    is_split INTEGER DEFAULT 0,
    split_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory_cost_layers (
    id TEXT PRIMARY KEY,
    inventory_id TEXT,
    purchase_item_id TEXT,
    quantity_original INTEGER NOT NULL,
    quantity_remaining INTEGER NOT NULL,
    unit_cost DOUBLE PRECISION NOT NULL,
    purchase_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_parse_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_subject TEXT,
    email_from TEXT,
    email_body TEXT,
    email_date TIMESTAMPTZ,
    parsed_data TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    -- 023: receipt parsing
    receipt_type TEXT DEFAULT 'purchase',
    confidence_score DOUBLE PRECISION,
    source_file TEXT,
    file_type TEXT DEFAULT 'image',
    image_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_vendors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases JSONB DEFAULT '[]'::jsonb,
    default_category TEXT,
    default_payment_method TEXT,
    is_platform INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categorization_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    pattern TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'image/jpeg',
    file_size INTEGER DEFAULT 0,
    file_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurring_transaction_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    account_id TEXT REFERENCES accounts(id),
    category TEXT DEFAULT 'Expense',
    frequency TEXT DEFAULT 'monthly',
    last_executed TIMESTAMPTZ,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_audit_log (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cost_price DOUBLE PRECISION,
    list_price DOUBLE PRECISION,
    previous_cost_price DOUBLE PRECISION,
    previous_list_price DOUBLE PRECISION,
    change_reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'expense' CHECK (type IN ('expense', 'deduction', 'cogs')),
    tax_deductible INTEGER DEFAULT 0,
    total_amount DOUBLE PRECISION DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS platform_fee_summary (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    period TEXT NOT NULL,
    total_fees DOUBLE PRECISION DEFAULT 0,
    total_sales DOUBLE PRECISION DEFAULT 0,
    fee_percentage DOUBLE PRECISION DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales_tax_nexus (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    state TEXT NOT NULL,
    total_sales DOUBLE PRECISION DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    nexus_threshold_amount DOUBLE PRECISION DEFAULT 100000,
    nexus_threshold_transactions INTEGER DEFAULT 200,
    has_nexus INTEGER DEFAULT 0,
    registered INTEGER DEFAULT 0,
    period_year INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, state, period_year)
);

-- ============================================================
-- ORDERS & SHIPPING
-- ============================================================

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_number TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
    buyer_username TEXT,
    buyer_email TEXT,
    buyer_address TEXT,
    item_id TEXT,
    item_title TEXT NOT NULL,
    item_sku TEXT,
    sale_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    shipping_cost DOUBLE PRECISION DEFAULT 0,
    platform_fee DOUBLE PRECISION DEFAULT 0,
    tracking_number TEXT,
    shipping_provider TEXT,
    shipping_label_url TEXT,
    expected_delivery TEXT,
    actual_delivery TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    -- 063: priority & split shipment
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    priority_note TEXT,
    is_split_shipment INTEGER DEFAULT 0,
    parent_order_id TEXT REFERENCES orders(id),
    shipment_number INTEGER,
    total_shipments INTEGER,
    -- 057: return fields
    return_status TEXT,
    return_reason TEXT,
    return_requested_at TIMESTAMPTZ,
    refund_amount DOUBLE PRECISION,
    return_tracking TEXT,
    refund_processed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS shipping_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    carrier TEXT,
    service_type TEXT,
    package_type TEXT,
    weight_oz DOUBLE PRECISION DEFAULT 0,
    length DOUBLE PRECISION DEFAULT 0,
    width DOUBLE PRECISION DEFAULT 0,
    height DOUBLE PRECISION DEFAULT 0,
    handling_time_days INTEGER DEFAULT 1,
    domestic_cost DOUBLE PRECISION DEFAULT 0,
    international_cost DOUBLE PRECISION,
    free_shipping_threshold DOUBLE PRECISION,
    is_default INTEGER DEFAULT 0,
    platforms JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipping_labels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT,
    sale_id TEXT,
    tracking_number TEXT,
    carrier TEXT NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
    service_type TEXT,
    weight_oz DOUBLE PRECISION,
    length_in DOUBLE PRECISION,
    width_in DOUBLE PRECISION,
    height_in DOUBLE PRECISION,
    package_type TEXT DEFAULT 'package',
    from_name TEXT NOT NULL,
    from_company TEXT,
    from_street1 TEXT NOT NULL,
    from_street2 TEXT,
    from_city TEXT NOT NULL,
    from_state TEXT NOT NULL,
    from_zip TEXT NOT NULL,
    from_country TEXT DEFAULT 'US',
    from_phone TEXT,
    to_name TEXT NOT NULL,
    to_company TEXT,
    to_street1 TEXT NOT NULL,
    to_street2 TEXT,
    to_city TEXT NOT NULL,
    to_state TEXT NOT NULL,
    to_zip TEXT NOT NULL,
    to_country TEXT DEFAULT 'US',
    to_phone TEXT,
    to_email TEXT,
    label_format TEXT DEFAULT 'pdf' CHECK (label_format IN ('pdf', 'png', 'zpl', 'epl')),
    label_size TEXT DEFAULT '4x6' CHECK (label_size IN ('4x6', '4x4', '8.5x11')),
    label_url TEXT,
    label_data TEXT,
    postage_cost DOUBLE PRECISION,
    insurance_cost DOUBLE PRECISION DEFAULT 0,
    total_cost DOUBLE PRECISION,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'purchased', 'printed', 'shipped', 'delivered', 'returned', 'voided')),
    purchased_at TIMESTAMPTZ,
    printed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    external_label_id TEXT,
    external_shipment_id TEXT,
    rate_id TEXT,
    notes TEXT,
    batch_id TEXT,
    format TEXT DEFAULT 'thermal_4x6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS label_batches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    total_labels INTEGER DEFAULT 0,
    completed_labels INTEGER DEFAULT 0,
    failed_labels INTEGER DEFAULT 0,
    combined_pdf_url TEXT,
    manifest_url TEXT,
    total_postage DOUBLE PRECISION DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS shipping_rates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label_id TEXT,
    carrier TEXT NOT NULL,
    service TEXT NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    currency TEXT DEFAULT 'USD',
    delivery_days INTEGER,
    delivery_date TEXT,
    rate_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS return_addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT,
    street1 TEXT NOT NULL,
    street2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    country TEXT DEFAULT 'US',
    phone TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHROME EXTENSION & PRICE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS price_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    listing_url TEXT NOT NULL,
    listing_id TEXT,
    title TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    size TEXT,
    current_price DOUBLE PRECISION NOT NULL,
    original_price DOUBLE PRECISION,
    price_history JSONB DEFAULT '[]'::jsonb,
    alert_on_price_drop INTEGER DEFAULT 0,
    alert_threshold DOUBLE PRECISION,
    last_checked_at TIMESTAMPTZ,
    images JSONB DEFAULT '[]'::jsonb,
    seller_username TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scraped_products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_site TEXT NOT NULL,
    title TEXT NOT NULL,
    brand TEXT,
    price DOUBLE PRECISION,
    original_price DOUBLE PRECISION,
    description TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    category TEXT,
    color TEXT,
    size TEXT,
    material TEXT,
    imported_to_inventory INTEGER DEFAULT 0,
    inventory_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS extension_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- ENGAGEMENT & ANALYTICS
-- ============================================================

CREATE TABLE IF NOT EXISTS listing_engagement (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE,
    inventory_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    source TEXT,
    location TEXT,
    device_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    predicted_price DOUBLE PRECISION NOT NULL,
    confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    price_range_low DOUBLE PRECISION,
    price_range_high DOUBLE PRECISION,
    demand_score DOUBLE PRECISION CHECK (demand_score >= 0 AND demand_score <= 100),
    recommendation TEXT NOT NULL,
    recommendation_reason TEXT,
    comparable_count INTEGER DEFAULT 0,
    avg_days_to_sell INTEGER,
    seasonality_factor DOUBLE PRECISION DEFAULT 1.0,
    platform TEXT,
    expires_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS demand_forecasts (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    forecast_date TEXT NOT NULL,
    demand_level TEXT NOT NULL,
    volume_estimate INTEGER,
    avg_price DOUBLE PRECISION,
    price_trend TEXT,
    seasonality_index DOUBLE PRECISION DEFAULT 1.0,
    competitor_count INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    metric_a TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'divide',
    metric_b TEXT NOT NULL,
    display_format TEXT NOT NULL DEFAULT 'number',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_digests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    email TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    search_term TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    results_found INTEGER DEFAULT 0,
    last_searched_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- SUPPLIER & COMPETITOR MONITORING
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    website TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_order_date TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent DOUBLE PRECISION DEFAULT 0,
    -- 063: lead time
    lead_time_days INTEGER,
    avg_delivery_days DOUBLE PRECISION,
    order_accuracy DOUBLE PRECISION,
    on_time_delivery DOUBLE PRECISION,
    quality_rating DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    url TEXT,
    current_price DOUBLE PRECISION,
    target_price DOUBLE PRECISION,
    alert_threshold DOUBLE PRECISION DEFAULT 0.10,
    last_price DOUBLE PRECISION,
    price_change DOUBLE PRECISION DEFAULT 0,
    last_checked_at TEXT,
    alert_enabled INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_price_history (
    id TEXT PRIMARY KEY,
    supplier_item_id TEXT NOT NULL REFERENCES supplier_items(id) ON DELETE CASCADE,
    price DOUBLE PRECISION NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    po_number TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'shipped', 'received', 'cancelled')),
    total_amount DOUBLE PRECISION DEFAULT 0,
    notes TEXT,
    expected_delivery DATE,
    actual_delivery DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DOUBLE PRECISION DEFAULT 0,
    total_price DOUBLE PRECISION DEFAULT 0,
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    profile_url TEXT,
    category_focus TEXT,
    avg_price DOUBLE PRECISION,
    listing_count INTEGER DEFAULT 0,
    sell_through_rate DOUBLE PRECISION,
    last_checked_at TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, username)
);

CREATE TABLE IF NOT EXISTS competitor_listings (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    original_price DOUBLE PRECISION,
    category TEXT,
    brand TEXT,
    condition TEXT,
    listed_at TEXT,
    sold_at TEXT,
    days_to_sell INTEGER,
    url TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    saturation_score DOUBLE PRECISION CHECK (saturation_score >= 0 AND saturation_score <= 100),
    opportunity_score DOUBLE PRECISION CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
    avg_price DOUBLE PRECISION,
    price_range_low DOUBLE PRECISION,
    price_range_high DOUBLE PRECISION,
    avg_days_to_sell DOUBLE PRECISION,
    listing_count INTEGER,
    demand_trend TEXT,
    competition_level TEXT,
    recommended_price_range TEXT,
    insights_json TEXT,
    valid_until TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_keywords (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    cluster_name TEXT,
    competitor_count INTEGER DEFAULT 0,
    avg_price DOUBLE PRECISION,
    your_listing_count INTEGER DEFAULT 0,
    opportunity_score DOUBLE PRECISION DEFAULT 0,
    last_analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- DUPLICATE DETECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS duplicate_detections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    primary_item_id TEXT NOT NULL,
    duplicate_item_id TEXT NOT NULL,
    detection_type TEXT NOT NULL CHECK (detection_type IN ('sku_match', 'hash_match', 'title_brand_size', 'exact_title')),
    confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    user_action TEXT DEFAULT 'pending' CHECK (user_action IN ('pending', 'confirmed', 'ignored')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    FOREIGN KEY (primary_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (duplicate_item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- ============================================================
-- TEAMS & COLLABORATION
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    max_members INTEGER DEFAULT 3,
    settings TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by TEXT,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
    permissions TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by TEXT NOT NULL,
    message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_activity_log (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collaborations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('listing_share', 'bundle', 'referral', 'mentorship')),
    title TEXT NOT NULL,
    description TEXT,
    terms TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    participants JSONB DEFAULT '[]'::jsonb,
    max_participants INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- SMART RELISTING
-- ============================================================

CREATE TABLE IF NOT EXISTS relisting_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    stale_days INTEGER DEFAULT 30,
    min_views INTEGER DEFAULT 0,
    max_views INTEGER,
    min_likes INTEGER DEFAULT 0,
    price_strategy TEXT DEFAULT 'fixed' CHECK (price_strategy IN ('fixed', 'percentage', 'tiered', 'prediction')),
    price_reduction_amount DOUBLE PRECISION DEFAULT 0,
    price_floor_percentage DOUBLE PRECISION DEFAULT 50,
    use_ai_pricing INTEGER DEFAULT 0,
    tiered_reductions TEXT,
    refresh_photos INTEGER DEFAULT 0,
    refresh_title INTEGER DEFAULT 0,
    refresh_description INTEGER DEFAULT 0,
    add_sale_tag INTEGER DEFAULT 0,
    auto_relist INTEGER DEFAULT 0,
    relist_time TEXT,
    relist_days TEXT,
    max_relists_per_day INTEGER DEFAULT 10,
    categories TEXT,
    exclude_categories TEXT,
    brands TEXT,
    min_price DOUBLE PRECISION,
    max_price DOUBLE PRECISION,
    platforms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relisting_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    rule_id TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    scheduled_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    original_price DOUBLE PRECISION,
    new_price DOUBLE PRECISION,
    price_change_reason TEXT,
    changes_made TEXT,
    error_message TEXT,
    views_before INTEGER,
    likes_before INTEGER,
    days_listed INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relisting_performance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    relist_queue_id TEXT,
    price_before DOUBLE PRECISION,
    views_before INTEGER,
    likes_before INTEGER,
    days_without_sale INTEGER,
    price_after DOUBLE PRECISION,
    views_after INTEGER DEFAULT 0,
    likes_after INTEGER DEFAULT 0,
    sold INTEGER DEFAULT 0,
    sold_at TIMESTAMPTZ,
    sale_price DOUBLE PRECISION,
    days_to_sale INTEGER,
    relisted_at TIMESTAMPTZ DEFAULT NOW(),
    last_checked TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_refresh_history (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('delist', 'relist', 'mark_sold')),
    reason TEXT,
    previous_status TEXT,
    new_status TEXT,
    platform_response TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- AUTOMATION ADVANCED
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    automation_id TEXT NOT NULL,
    automation_name TEXT NOT NULL,
    automation_type TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'skipped')),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    result_message TEXT,
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_experiments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_rule_id TEXT NOT NULL,
    variant_rule_id TEXT NOT NULL,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    winner TEXT CHECK (winner IN ('base', 'variant', 'inconclusive')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (base_rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_templates (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    platform TEXT DEFAULT 'all',
    schedule TEXT,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    is_public INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_template_installs (
    template_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (template_id, user_id),
    FOREIGN KEY (template_id) REFERENCES automation_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_rule_versions (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    platform TEXT,
    schedule TEXT,
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- IMPORT & INVENTORY MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'excel', 'tsv', 'json')),
    original_filename TEXT,
    file_size INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapping', 'validating', 'importing', 'completed', 'failed', 'cancelled')),
    field_mapping TEXT,
    has_header_row INTEGER DEFAULT 1,
    skip_rows INTEGER DEFAULT 0,
    date_format TEXT DEFAULT 'MM/DD/YYYY',
    decimal_separator TEXT DEFAULT '.',
    update_existing INTEGER DEFAULT 0,
    skip_duplicates INTEGER DEFAULT 1,
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,
    errors TEXT,
    preview_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS import_rows (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'updated', 'skipped', 'failed', 'duplicate')),
    raw_data TEXT,
    parsed_data TEXT,
    inventory_id TEXT,
    error_message TEXT,
    validation_errors TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS import_mappings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    source_type TEXT,
    source_name TEXT,
    field_mapping TEXT NOT NULL,
    has_header_row INTEGER DEFAULT 1,
    skip_rows INTEGER DEFAULT 0,
    date_format TEXT DEFAULT 'MM/DD/YYYY',
    is_default INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sku_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    pattern TEXT NOT NULL,
    description TEXT,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    prefix TEXT,
    suffix TEXT,
    separator TEXT DEFAULT '-',
    counter_start INTEGER DEFAULT 1,
    counter_padding INTEGER DEFAULT 4,
    counter_current INTEGER DEFAULT 0,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sku_platform_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    master_sku TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_sku TEXT,
    inventory_id TEXT,
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS barcode_lookups (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    title TEXT,
    brand TEXT,
    category TEXT,
    description TEXT,
    image_url TEXT,
    source TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouse_locations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    warehouse TEXT,
    zone TEXT,
    aisle TEXT,
    shelf TEXT,
    bin TEXT,
    description TEXT,
    capacity INTEGER DEFAULT 0,
    current_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS warehouse_bins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bin_code TEXT NOT NULL,
    label TEXT,
    zone TEXT,
    item_count INTEGER DEFAULT 0,
    barcode_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, bin_code)
);

-- ============================================================
-- SIZE CHARTS
-- ============================================================

CREATE TABLE IF NOT EXISTS size_charts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    garment_type TEXT,
    brand TEXT,
    gender TEXT DEFAULT 'unisex' CHECK (gender IN ('mens', 'womens', 'kids', 'unisex')),
    size_system TEXT DEFAULT 'US',
    measurements JSONB DEFAULT '[]'::jsonb,
    sizes JSONB DEFAULT '[]'::jsonb,
    custom_fields JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    is_template INTEGER DEFAULT 0,
    linked_listings JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS brand_size_guides (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    garment_type TEXT NOT NULL,
    size_label TEXT NOT NULL,
    us_size TEXT,
    uk_size TEXT,
    eu_size TEXT,
    jp_size TEXT,
    cn_size TEXT,
    it_size TEXT,
    fr_size TEXT,
    au_size TEXT,
    chest_cm DOUBLE PRECISION,
    waist_cm DOUBLE PRECISION,
    hips_cm DOUBLE PRECISION,
    length_cm DOUBLE PRECISION,
    shoulder_cm DOUBLE PRECISION,
    sleeve_cm DOUBLE PRECISION,
    inseam_cm DOUBLE PRECISION,
    foot_length_cm DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WHATNOT LIVE SELLING
-- ============================================================

CREATE TABLE IF NOT EXISTS whatnot_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    estimated_duration INTEGER DEFAULT 60,
    shipping_option TEXT DEFAULT 'standard',
    notes TEXT,
    status TEXT DEFAULT 'scheduled',
    stream_url TEXT,
    viewers_peak INTEGER DEFAULT 0,
    total_sales DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS whatnot_event_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    starting_price DOUBLE PRECISION DEFAULT 0,
    buy_now_price DOUBLE PRECISION,
    min_price DOUBLE PRECISION DEFAULT 0,
    sold_price DOUBLE PRECISION,
    buyer_username TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (event_id) REFERENCES whatnot_events(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

CREATE TABLE IF NOT EXISTS whatnot_cohosts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cohost_name TEXT NOT NULL,
    role TEXT DEFAULT 'moderator' CHECK (role IN ('host', 'cohost', 'moderator')),
    revenue_split DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (event_id) REFERENCES whatnot_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stream_staging (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT,
    inventory_id TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    flash_price DOUBLE PRECISION,
    bundle_group TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    widgets JSONB DEFAULT '[]'::jsonb,
    date_range TEXT DEFAULT '30d',
    is_favorite INTEGER DEFAULT 0,
    schedule TEXT,
    last_generated TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS saved_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'custom',
    config JSONB DEFAULT '{}'::jsonb,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_schedules (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    recipients JSONB DEFAULT '[]'::jsonb,
    format TEXT DEFAULT 'csv' CHECK (format IN ('csv', 'pdf', 'json')),
    next_run_at TIMESTAMPTZ,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (report_id) REFERENCES saved_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- PREDICTION MODELS
-- ============================================================

CREATE TABLE IF NOT EXISTS prediction_models (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model_type TEXT NOT NULL DEFAULT 'linear' CHECK (model_type IN ('linear', 'exponential', 'seasonal', 'moving_average', 'weighted')),
    parameters JSONB DEFAULT '{}'::jsonb,
    is_active INTEGER DEFAULT 1,
    accuracy_score DOUBLE PRECISION,
    last_trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prediction_scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_data JSONB DEFAULT '{}'::jsonb,
    adjustments JSONB DEFAULT '{}'::jsonb,
    results JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- WEBHOOKS & INTEGRATIONS
-- ============================================================

-- Incoming webhook endpoints (migration 029)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_triggered_at TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    endpoint_id TEXT REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    processed_at TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outgoing webhooks (migration 052 / services/outgoingWebhooks.js)
CREATE TABLE IF NOT EXISTS user_webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    headers TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    attempt INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id) ON DELETE CASCADE
);

-- ============================================================
-- EMAIL
-- ============================================================

-- Email accounts (migration 027)
CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_address TEXT NOT NULL,
    provider TEXT NOT NULL,
    oauth_token TEXT,
    oauth_refresh_token TEXT,
    oauth_token_expires_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    last_message_id TEXT,
    sync_status TEXT DEFAULT 'idle',
    consecutive_failures INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    is_enabled INTEGER DEFAULT 1,
    filter_senders JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email_address),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email marketing (migration 052 / services/emailMarketing.js)
CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    data TEXT,
    scheduled_for TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    subject TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PUSH NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS push_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    sales INTEGER DEFAULT 1,
    offers INTEGER DEFAULT 1,
    messages INTEGER DEFAULT 1,
    inventory_alerts INTEGER DEFAULT 1,
    marketing INTEGER DEFAULT 0,
    weekly_digest INTEGER DEFAULT 1,
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS push_notification_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    channel TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- GDPR & COMPLIANCE
-- ============================================================

CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    export_data TEXT,
    error TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'failed')),
    reason TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL,
    reminder_sent INTEGER DEFAULT 0,
    error TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    consent_type TEXT NOT NULL,
    granted INTEGER DEFAULT 0,
    granted_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, consent_type)
);

CREATE TABLE IF NOT EXISTS data_rectification_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    corrections TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cookie_consent (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    analytics INTEGER DEFAULT 0,
    marketing INTEGER DEFAULT 0,
    functional INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tos_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary_of_changes TEXT,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tos_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tos_version_id TEXT NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tos_version_id) REFERENCES tos_versions(id)
);

-- ============================================================
-- AFFILIATE & BILLING
-- ============================================================

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS affiliate_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    min_referrals INTEGER DEFAULT 0,
    commission_rate DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id TEXT PRIMARY KEY,
    affiliate_user_id TEXT NOT NULL,
    referred_user_id TEXT,
    tier_id TEXT,
    amount DOUBLE PRECISION DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    landing_page_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    FOREIGN KEY (affiliate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES affiliate_tiers(id)
);

CREATE TABLE IF NOT EXISTS plan_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    current_value INTEGER DEFAULT 0,
    plan_limit INTEGER DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- MISC TABLES
-- ============================================================

-- Sustainability tracking
CREATE TABLE IF NOT EXISTS sustainability_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    inventory_id TEXT,
    sale_id TEXT,
    category TEXT,
    water_saved_liters DOUBLE PRECISION DEFAULT 0,
    co2_saved_kg DOUBLE PRECISION DEFAULT 0,
    waste_prevented_kg DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
);

-- Offline sync queue
CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
    conflict_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Task queue (migration 025)
CREATE TABLE IF NOT EXISTS task_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Changelog
CREATE TABLE IF NOT EXISTS changelog (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    changes TEXT NOT NULL,
    highlights TEXT,
    breaking_changes TEXT,
    published INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS changelog_items (
    id TEXT PRIMARY KEY,
    changelog_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('feature', 'improvement', 'fix', 'breaking', 'security')),
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (changelog_id) REFERENCES changelog(id) ON DELETE CASCADE
);

-- Soft-delete tracking
CREATE TABLE IF NOT EXISTS deleted_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('inventory', 'listing', 'order', 'offer', 'checklist')),
    original_id TEXT NOT NULL,
    original_data TEXT NOT NULL,
    deletion_reason TEXT DEFAULT 'manual' CHECK (deletion_reason IN ('manual', 'automation', 'bulk_operation', 'expired', 'duplicate', 'other')),
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Buyer profiles
CREATE TABLE IF NOT EXISTS buyer_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_username TEXT,
    platform TEXT,
    total_purchases INTEGER DEFAULT 0,
    total_returns INTEGER DEFAULT 0,
    total_spent DOUBLE PRECISION DEFAULT 0,
    avg_payment_days DOUBLE PRECISION DEFAULT 0,
    communication_rating INTEGER DEFAULT 3,
    is_blocked INTEGER DEFAULT 0,
    notes TEXT,
    last_purchase_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- QR code analytics
CREATE TABLE IF NOT EXISTS qr_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    qr_type TEXT NOT NULL DEFAULT 'listing',
    reference_id TEXT,
    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Onboarding progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'reseller',
    current_step INTEGER DEFAULT 0,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    badges JSONB DEFAULT '[]'::jsonb,
    points INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Feature flags (from services/featureFlags.js)
CREATE TABLE IF NOT EXISTS feature_flags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    enabled INTEGER DEFAULT 0,
    rollout_percentage INTEGER DEFAULT 100,
    conditions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flag_usage (
    id TEXT PRIMARY KEY,
    flag_name TEXT NOT NULL,
    user_id TEXT,
    variant TEXT DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_test_conversions (
    id TEXT PRIMARY KEY,
    flag_name TEXT NOT NULL,
    user_id TEXT,
    variant TEXT NOT NULL,
    event_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notion integration (migration 049)
CREATE TABLE IF NOT EXISTS notion_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    encrypted_token TEXT,
    workspace_id TEXT,
    workspace_name TEXT,
    workspace_icon TEXT,
    bot_id TEXT,
    inventory_database_id TEXT,
    sales_database_id TEXT,
    notes_database_id TEXT,
    sync_enabled INTEGER DEFAULT 1,
    sync_interval_minutes INTEGER DEFAULT 60,
    conflict_strategy TEXT DEFAULT 'manual' CHECK (conflict_strategy IN ('manual', 'vaultlister_wins', 'notion_wins', 'newest_wins')),
    last_sync_at TEXT,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed', 'in_progress')),
    last_sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notion_sync_map (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('inventory', 'sale', 'note')),
    local_id TEXT NOT NULL,
    notion_page_id TEXT NOT NULL,
    local_updated_at TEXT,
    notion_updated_at TEXT,
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_push', 'pending_pull', 'conflict', 'error')),
    sync_error TEXT,
    last_synced_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, entity_type, local_id),
    UNIQUE(user_id, entity_type, notion_page_id)
);

CREATE TABLE IF NOT EXISTS notion_field_mappings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('inventory', 'sale', 'note')),
    local_field TEXT NOT NULL,
    notion_property TEXT NOT NULL,
    notion_property_type TEXT NOT NULL,
    value_mapping TEXT,
    sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'push_only', 'pull_only')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, entity_type, local_field)
);

CREATE TABLE IF NOT EXISTS notion_sync_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'push', 'pull', 'manual')),
    direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_deleted INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'cancelled')),
    error_message TEXT,
    error_details TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notion_sync_conflicts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_map_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    local_id TEXT NOT NULL,
    notion_page_id TEXT NOT NULL,
    local_data TEXT NOT NULL,
    notion_data TEXT NOT NULL,
    conflicting_fields TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolution TEXT CHECK (resolution IN ('keep_local', 'keep_notion', 'merge', 'ignore')),
    resolved_at TEXT,
    resolved_by TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sync_map_id) REFERENCES notion_sync_map(id) ON DELETE CASCADE
);

-- Google integration tokens (migration 103)
CREATE TABLE IF NOT EXISTS google_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('drive', 'calendar', 'drive_and_calendar')),
    email TEXT,
    oauth_token TEXT,
    oauth_refresh_token TEXT,
    oauth_token_expires_at TEXT,
    is_connected INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, scope),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS google_oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Poshmark monitoring (migration 111)
CREATE TABLE IF NOT EXISTS poshmark_monitoring_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    total_listings INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    active_offers INTEGER DEFAULT 0,
    recent_sales INTEGER DEFAULT 0,
    closet_value DOUBLE PRECISION DEFAULT 0,
    checked_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);

-- Shops
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_platform ON shops(platform);
CREATE INDEX IF NOT EXISTS idx_shops_token_refresh ON shops(connection_type, is_connected, oauth_token_expires_at);

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_user_status ON inventory(user_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_user_category ON inventory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_updated ON inventory(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at ON inventory(deleted_at);
CREATE INDEX IF NOT EXISTS idx_inventory_bin_location ON inventory(bin_location);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON inventory(brand);
CREATE INDEX IF NOT EXISTS idx_inventory_search ON inventory USING GIN(search_vector);

-- Listings
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_inventory_id ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_folder_id ON listings(folder_id);
CREATE INDEX IF NOT EXISTS idx_listings_user_status ON listings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_last_relisted ON listings(last_relisted_at);
CREATE INDEX IF NOT EXISTS idx_listings_staleness ON listings(staleness_days, status, auto_relist_enabled);
CREATE INDEX IF NOT EXISTS idx_listings_folders_user ON listings_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_templates_user ON listing_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_templates_favorite ON listing_templates(user_id, is_favorite);

-- Sales
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales(platform);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_user_created ON sales(user_id, created_at DESC);

-- Offers
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_listing_id ON offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_deleted_at ON offers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_offers_user_deleted ON offers(user_id, deleted_at);

-- Automation
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_id ON automation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON automation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON automation_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_started ON automation_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_user ON automation_experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON automation_experiments(status);
CREATE INDEX IF NOT EXISTS idx_templates_author ON automation_templates(author_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON automation_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_template_installs_user ON automation_template_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_rule ON automation_rule_versions(rule_id, version DESC);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_task_queue_status_scheduled ON task_queue(status, scheduled_at);

-- Analytics
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_date ON analytics_snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events(name, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);

-- Security & Auth
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip_or_user ON security_logs(ip_or_user);
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_type ON verification_tokens(type);
CREATE INDEX IF NOT EXISTS idx_mfa_events_user ON mfa_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_events_type ON mfa_events(event_type);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON backup_codes(user_id, used_at);
CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_codes(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_totp_user ON totp_secrets(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session_id ON csrf_tokens(session_id);

-- Request/Error/Audit logs
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON health_checks(created_at);
CREATE INDEX IF NOT EXISTS idx_rl_logs_timestamp ON rate_limit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_rl_logs_ip ON rate_limit_logs(ip, timestamp);
CREATE INDEX IF NOT EXISTS idx_rl_logs_endpoint ON rate_limit_logs(endpoint, timestamp);

-- RUM
CREATE INDEX IF NOT EXISTS idx_rum_metrics_session ON rum_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_name ON rum_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_timestamp ON rum_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_user ON rum_metrics(user_id);

-- User preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);

-- Image bank
CREATE INDEX IF NOT EXISTS idx_image_bank_user ON image_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_folder ON image_bank(folder_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_created ON image_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_bank_usage_image ON image_bank_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_usage_inventory ON image_bank_usage(inventory_id);
CREATE INDEX IF NOT EXISTS idx_folders_user ON image_bank_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_search ON image_bank USING GIN(search_vector);

-- Community
CREATE INDEX IF NOT EXISTS idx_community_posts_type ON community_posts(type);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_activity ON community_posts(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_upvotes ON community_posts(upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_target ON community_reactions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_community_stats_upvotes ON community_stats(upvotes_received DESC);
CREATE INDEX IF NOT EXISTS idx_community_stats_profit ON community_stats(total_profit_shared DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_search ON community_posts USING GIN(search_vector);

-- Help & Support
CREATE INDEX IF NOT EXISTS idx_help_videos_category ON help_videos(category, position);
CREATE INDEX IF NOT EXISTS idx_help_faq_category ON help_faq(category, position);
CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_published ON help_articles(is_published);
CREATE INDEX IF NOT EXISTS idx_help_articles_search ON help_articles USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket ON support_ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_help_faq_votes_user ON help_faq_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_help_article_votes_user ON help_article_votes(user_id);

-- Roadmap & Feedback
CREATE INDEX IF NOT EXISTS idx_roadmap_features_status ON roadmap_features(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_votes_user ON roadmap_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_votes_feature ON roadmap_votes(feature_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_submissions(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_submissions(type);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user ON feedback_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_feedback ON feedback_responses(feedback_id);

-- Calendar & Checklists
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_type ON calendar_events(type);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_user ON calendar_sync_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sync_user_provider ON calendar_sync_settings(user_id, provider);
CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON checklist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_due_date ON checklist_items(due_date);

-- Financial
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_vendor ON purchases(vendor_name);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_inventory ON purchase_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_user ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_account ON financial_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_ref ON financial_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_cost_layers_inventory ON inventory_cost_layers(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cost_layers_remaining ON inventory_cost_layers(inventory_id, quantity_remaining);
CREATE INDEX IF NOT EXISTS idx_cost_layers_date ON inventory_cost_layers(purchase_date);
CREATE INDEX IF NOT EXISTS idx_email_parse_queue_user ON email_parse_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_parse_queue_status ON email_parse_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_parse_queue_type ON email_parse_queue(user_id, receipt_type);
CREATE INDEX IF NOT EXISTS idx_receipt_vendors_user ON receipt_vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_vendors_name ON receipt_vendors(user_id, name);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_user ON categorization_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_pattern ON categorization_rules(pattern);
CREATE INDEX IF NOT EXISTS idx_tx_attachments_transaction ON transaction_attachments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_user ON recurring_transaction_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_audit_transaction ON transaction_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_audit_user ON transaction_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_inventory ON price_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_expense_categories_user ON expense_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_fee_summary_user ON platform_fee_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_tax_nexus_user ON sales_tax_nexus(user_id);

-- Orders & Shipping
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_shipping_profiles_user ON shipping_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_profiles_default ON shipping_profiles(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_user ON shipping_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_status ON shipping_labels(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_batch ON shipping_labels(batch_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_label_batches_user ON label_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_label_batches_status ON label_batches(status);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_label ON shipping_rates(label_id);
CREATE INDEX IF NOT EXISTS idx_return_addresses_user ON return_addresses(user_id);

-- Chrome Extension
CREATE INDEX IF NOT EXISTS idx_price_tracking_user ON price_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_price_tracking_platform ON price_tracking(platform);
CREATE INDEX IF NOT EXISTS idx_scraped_products_user ON scraped_products(user_id);
CREATE INDEX IF NOT EXISTS idx_scraped_products_imported ON scraped_products(imported_to_inventory, user_id);
CREATE INDEX IF NOT EXISTS idx_extension_sync_status ON extension_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_extension_sync_user ON extension_sync_queue(user_id, status);

-- Engagement
CREATE INDEX IF NOT EXISTS idx_engagement_user ON listing_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_listing ON listing_engagement(listing_id);
CREATE INDEX IF NOT EXISTS idx_engagement_time ON listing_engagement(hour_of_day, day_of_week);
CREATE INDEX IF NOT EXISTS idx_engagement_platform ON listing_engagement(platform);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON listing_engagement(event_type);
CREATE INDEX IF NOT EXISTS idx_engagement_created ON listing_engagement(created_at);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON price_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_inventory ON price_predictions(inventory_id);
CREATE INDEX IF NOT EXISTS idx_predictions_recommendation ON price_predictions(recommendation);
CREATE INDEX IF NOT EXISTS idx_predictions_expires ON price_predictions(expires_at);
CREATE INDEX IF NOT EXISTS idx_forecasts_category ON demand_forecasts(category);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON demand_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_platform ON demand_forecasts(platform);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_competitor_keywords_user ON competitor_keywords(user_id);

-- Suppliers & Competitors
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(type);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_items_user ON supplier_items(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_alert ON supplier_items(alert_enabled);
CREATE INDEX IF NOT EXISTS idx_supplier_price_history_item ON supplier_price_history(supplier_item_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_history_date ON supplier_price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_competitors_user ON competitors(user_id);
CREATE INDEX IF NOT EXISTS idx_competitors_platform ON competitors(platform);
CREATE INDEX IF NOT EXISTS idx_competitors_active ON competitors(is_active);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_competitor ON competitor_listings(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_sold ON competitor_listings(sold_at);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_category ON competitor_listings(category);
CREATE INDEX IF NOT EXISTS idx_market_insights_category ON market_insights(category);
CREATE INDEX IF NOT EXISTS idx_market_insights_platform ON market_insights(platform);
CREATE INDEX IF NOT EXISTS idx_market_insights_opportunity ON market_insights(opportunity_score);

-- Duplicate detections
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_user_id ON duplicate_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_primary_item ON duplicate_detections(primary_item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_duplicate_item ON duplicate_detections(duplicate_item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_user_action ON duplicate_detections(user_id, user_action);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_created ON duplicate_detections(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_duplicate_detections_unique_pair ON duplicate_detections(user_id, primary_item_id, duplicate_item_id);

-- Teams
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_created ON teams(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_activity_team ON team_activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_user ON team_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity_log(created_at DESC);

-- Relisting
CREATE INDEX IF NOT EXISTS idx_relisting_rules_user ON relisting_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_relisting_rules_active ON relisting_rules(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_user ON relisting_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_status ON relisting_queue(status);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_scheduled ON relisting_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_relisting_queue_listing ON relisting_queue(listing_id);
CREATE INDEX IF NOT EXISTS idx_relisting_performance_user ON relisting_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_relisting_performance_listing ON relisting_performance(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_listing ON listing_refresh_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_user ON listing_refresh_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_action ON listing_refresh_history(action);
CREATE INDEX IF NOT EXISTS idx_listing_refresh_history_created ON listing_refresh_history(created_at);

-- Import
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_rows_job ON import_rows(job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON import_rows(status);
CREATE INDEX IF NOT EXISTS idx_import_mappings_user ON import_mappings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name ON inventory_categories(user_id, name);
CREATE INDEX IF NOT EXISTS idx_sku_rules_user ON sku_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_sku_rules_default ON sku_rules(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_sku_platform_links_user ON sku_platform_links(user_id);
CREATE INDEX IF NOT EXISTS idx_sku_platform_links_sku ON sku_platform_links(master_sku);
CREATE INDEX IF NOT EXISTS idx_barcode_lookups_barcode ON barcode_lookups(barcode);
CREATE INDEX IF NOT EXISTS idx_barcode_lookups_brand ON barcode_lookups(brand);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_user ON warehouse_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_locations_name ON warehouse_locations(name);
CREATE INDEX IF NOT EXISTS idx_warehouse_bins_user ON warehouse_bins(user_id);

-- Size Charts
CREATE INDEX IF NOT EXISTS idx_size_charts_user ON size_charts(user_id);
CREATE INDEX IF NOT EXISTS idx_size_charts_category ON size_charts(category);
CREATE INDEX IF NOT EXISTS idx_size_charts_brand ON size_charts(brand);
CREATE INDEX IF NOT EXISTS idx_brand_size_guides_brand ON brand_size_guides(brand);
CREATE INDEX IF NOT EXISTS idx_brand_size_guides_garment ON brand_size_guides(garment_type);
CREATE INDEX IF NOT EXISTS idx_brand_size_guides_brand_garment ON brand_size_guides(brand, garment_type);

-- Whatnot
CREATE INDEX IF NOT EXISTS idx_whatnot_events_user ON whatnot_events(user_id);
CREATE INDEX IF NOT EXISTS idx_whatnot_events_status ON whatnot_events(status);
CREATE INDEX IF NOT EXISTS idx_whatnot_event_items_event ON whatnot_event_items(event_id);
CREATE INDEX IF NOT EXISTS idx_whatnot_cohosts_event ON whatnot_cohosts(event_id);
CREATE INDEX IF NOT EXISTS idx_stream_staging_user ON stream_staging(user_id);

-- Reports & Predictions
CREATE INDEX IF NOT EXISTS idx_custom_reports_user ON custom_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_models_user ON prediction_models(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_scenarios_user ON prediction_scenarios(user_id);

-- Webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user ON webhook_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_enabled ON webhook_endpoints(is_enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user ON webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON user_webhooks(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries(webhook_id, created_at DESC);

-- Email
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_enabled ON email_accounts(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_email_accounts_sync ON email_accounts(is_enabled, sync_status, last_sync_at);
CREATE INDEX IF NOT EXISTS idx_email_accounts_provider_enabled ON email_accounts(provider, is_enabled);
CREATE INDEX IF NOT EXISTS idx_email_oauth_states_token ON email_oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_email_oauth_states_expires ON email_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_consents ON user_consents(user_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_email_unsub ON email_unsubscribes(email);

-- Push Notifications
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_token ON push_devices(token);
CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_notification_log(user_id, created_at DESC);

-- GDPR & Compliance
CREATE INDEX IF NOT EXISTS idx_account_deletion_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_scheduled ON account_deletion_requests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_data_export_status ON data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cookie_consent_user ON cookie_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_tos_acceptances_user ON tos_acceptances(user_id);

-- Affiliate & Billing
CREATE INDEX IF NOT EXISTS idx_affiliate_landing_user ON affiliate_landing_pages(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user ON affiliate_commissions(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_usage_user ON plan_usage(user_id);

-- Misc
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_user ON offline_sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_changelog_version ON changelog(version);
CREATE INDEX IF NOT EXISTS idx_changelog_date ON changelog(date DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_items_changelog ON changelog_items(changelog_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_user ON deleted_items(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_type ON deleted_items(item_type);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user ON buyer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_analytics_user ON qr_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_settings_user ON notion_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_user ON notion_sync_map(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_entity ON notion_sync_map(entity_type, local_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_notion ON notion_sync_map(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_status ON notion_sync_map(sync_status);
CREATE INDEX IF NOT EXISTS idx_notion_field_mappings_user ON notion_field_mappings(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_notion_sync_history_user ON notion_sync_history(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_notion_sync_conflicts_user ON notion_sync_conflicts(user_id, resolved);
CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON google_tokens(user_id, scope);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_token ON google_oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires ON google_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_poshmark_monitoring_user_checked ON poshmark_monitoring_log(user_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user ON batch_photo_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_photo_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_items_job ON batch_photo_items(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON batch_photo_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_presets_user ON batch_photo_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_watermark_presets_user ON watermark_presets(user_id);

-- ============================================================
-- FULL-TEXT SEARCH (tsvector triggers)
-- ============================================================

-- Inventory search
CREATE OR REPLACE FUNCTION inventory_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.description, '') || ' ' ||
        COALESCE(NEW.brand, '') || ' ' ||
        COALESCE(NEW.sku, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_search_vector_trigger
    BEFORE INSERT OR UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION inventory_search_vector_update();

-- Image bank search
CREATE OR REPLACE FUNCTION image_bank_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.description, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER image_bank_search_vector_trigger
    BEFORE INSERT OR UPDATE ON image_bank
    FOR EACH ROW EXECUTE FUNCTION image_bank_search_vector_update();

-- Community posts search
CREATE OR REPLACE FUNCTION community_posts_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.body, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER community_posts_search_vector_trigger
    BEFORE INSERT OR UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION community_posts_search_vector_update();

-- Help articles search
CREATE OR REPLACE FUNCTION help_articles_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' ||
        COALESCE(NEW.content, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER help_articles_search_vector_trigger
    BEFORE INSERT OR UPDATE ON help_articles
    FOR EACH ROW EXECUTE FUNCTION help_articles_search_vector_update();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default affiliate tiers
INSERT INTO affiliate_tiers (id, name, min_referrals, commission_rate) VALUES
    ('tier-bronze', 'Bronze', 0, 0.10),
    ('tier-silver', 'Silver', 10, 0.15),
    ('tier-gold', 'Gold', 25, 0.20)
ON CONFLICT (id) DO NOTHING;

-- Default expense categories
INSERT INTO expense_categories (id, user_id, name, type, tax_deductible) VALUES
    ('exp-shipping', 'system', 'Shipping Supplies', 'expense', 1),
    ('exp-packaging', 'system', 'Packaging Materials', 'expense', 1),
    ('exp-platform', 'system', 'Platform Fees', 'expense', 1),
    ('exp-inventory', 'system', 'Inventory Purchases', 'cogs', 1),
    ('exp-storage', 'system', 'Storage & Warehouse', 'expense', 1),
    ('exp-software', 'system', 'Software Subscriptions', 'expense', 1),
    ('exp-travel', 'system', 'Travel & Sourcing Trips', 'expense', 1),
    ('exp-returns', 'system', 'Returns & Refunds', 'expense', 0)
ON CONFLICT (id) DO NOTHING;

-- Initial ToS version
INSERT INTO tos_versions (id, version, title, content, effective_date) VALUES
    ('tos-v1', '1.0', 'Terms of Service v1.0',
     'By creating an account or using VaultLister (the "Service"), you agree to be bound by these Terms of Service. The full Terms of Service are available at /terms.html and are incorporated here by reference. Key provisions: (1) You must be 18 or older to use the Service. (2) You are responsible for maintaining account security and all activity under your account. (3) Automation features may violate certain marketplace terms; you use them at your own risk. (4) VaultLister is not affiliated with or endorsed by any third-party marketplace. (5) AI-generated content is provided as-is; you are responsible for reviewing it before publishing. (6) Liability is limited to the greater of fees paid in the prior 12 months or $100. (7) The Service is provided "as is" without warranties. Full terms: https://vaultlister.com/terms.html -- contact: legal@vaultlister.com',
     '2026-03-01')
ON CONFLICT (id) DO NOTHING;

COMMIT;
