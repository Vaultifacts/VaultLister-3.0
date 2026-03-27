# Database Schema

Generated from live PostgreSQL schema (`data/vaultlister.db`).

## Tables

### account_deletion_requests
```sql
CREATE TABLE account_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled', 'failed')),
    reason TEXT,
    scheduled_for DATETIME NOT NULL,
    reminder_sent INTEGER DEFAULT 0,
    error TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### accounts
```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN (
        'Bank', 'AR', 'Other Current Asset', 'Fixed Asset', 'Other Asset',
        'AP', 'Credit Card', 'Other Current Liability', 'Long Term Liability',
        'Equity', 'Income', 'COGS', 'Expense', 'Other Income', 'Other Expense'
    )),
    description TEXT,
    balance REAL DEFAULT 0,
    parent_account_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_account_id) REFERENCES accounts(id) ON DELETE SET NULL
)
```

### affiliate_commissions
```sql
CREATE TABLE affiliate_commissions (
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
)
```

### affiliate_landing_pages
```sql
CREATE TABLE "affiliate_landing_pages" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT,
    description TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    visits INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, slug)
)
```

### affiliate_tiers
```sql
CREATE TABLE affiliate_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    min_referrals INTEGER DEFAULT 0,
    commission_rate REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### alerts
```sql
CREATE TABLE alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### analytics_digests
```sql
CREATE TABLE analytics_digests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    email TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### analytics_snapshots
```sql
CREATE TABLE analytics_snapshots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    platform TEXT,
    metrics TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date, platform)
)
```

### audit_logs
```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

### automation_experiments
```sql
CREATE TABLE automation_experiments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_rule_id TEXT NOT NULL,
    variant_rule_id TEXT NOT NULL,
    status TEXT DEFAULT 'running' CHECK(status IN ('running', 'paused', 'completed')),
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    winner TEXT CHECK(winner IN ('base', 'variant', 'inconclusive', NULL)),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (base_rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE
)
```

### automation_logs
```sql
CREATE TABLE automation_logs (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE SET NULL
)
```

### automation_rule_versions
```sql
CREATE TABLE automation_rule_versions (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    platform TEXT,
    schedule TEXT,
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '{}',
    change_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### automation_rules
```sql
CREATE TABLE automation_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('share', 'follow', 'offer', 'relist', 'price_drop', 'custom')),
    platform TEXT,
    is_enabled INTEGER DEFAULT 1,
    schedule TEXT, -- cron expression or interval
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '{}',
    last_run_at DATETIME,
    next_run_at DATETIME,
    run_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, sort_order INTEGER DEFAULT 0, tags TEXT DEFAULT '[]',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### automation_runs
```sql
CREATE TABLE automation_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    automation_id TEXT NOT NULL,
    automation_name TEXT NOT NULL,
    automation_type TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'skipped')),
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    duration_ms INTEGER,
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    result_message TEXT,
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### automation_template_installs
```sql
CREATE TABLE automation_template_installs (
    template_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (template_id, user_id),
    FOREIGN KEY (template_id) REFERENCES automation_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### automation_templates
```sql
CREATE TABLE automation_templates (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    platform TEXT DEFAULT 'all',
    schedule TEXT,
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '{}',
    description TEXT,
    tags TEXT DEFAULT '[]',
    is_public INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### barcode_lookups
```sql
CREATE TABLE barcode_lookups (
    id TEXT PRIMARY KEY,
    barcode TEXT UNIQUE NOT NULL,
    title TEXT,
    brand TEXT,
    category TEXT,
    description TEXT,
    image_url TEXT,
    source TEXT, -- 'openfoodfacts', 'upcitemdb', 'user', 'local'
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### batch_photo_items
```sql
CREATE TABLE batch_photo_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    original_url TEXT,
    result_url TEXT,
    cloudinary_public_id TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (job_id) REFERENCES batch_photo_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE
)
```

### batch_photo_jobs
```sql
CREATE TABLE batch_photo_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,                           -- Optional job name
    total_images INTEGER NOT NULL,
    processed_images INTEGER DEFAULT 0,
    failed_images INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    transformations TEXT NOT NULL,       -- JSON: {removeBackground, enhance, upscale, cropWidth, cropHeight}
    preset_id TEXT,                      -- Optional link to saved preset
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### batch_photo_presets
```sql
CREATE TABLE batch_photo_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    transformations TEXT NOT NULL,       -- JSON: {removeBackground, enhance, upscale, cropWidth, cropHeight}
    is_default INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### brand_size_guides
```sql
CREATE TABLE brand_size_guides (
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
    chest_cm REAL,
    waist_cm REAL,
    hips_cm REAL,
    length_cm REAL,
    shoulder_cm REAL,
    sleeve_cm REAL,
    inseam_cm REAL,
    foot_length_cm REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### buyer_profiles
```sql
CREATE TABLE buyer_profiles (
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
)
```

### calendar_events
```sql
CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    type TEXT CHECK(type IN ('listing', 'order', 'automation', 'reminder', 'custom')),
    color TEXT DEFAULT '#6366f1',
    related_id TEXT,
    related_type TEXT CHECK(related_type IN ('inventory', 'listing', 'order', 'automation', NULL)),
    all_day INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, depends_on TEXT DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### calendar_sync_settings
```sql
CREATE TABLE calendar_sync_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL CHECK(provider IN ('google', 'outlook', 'ical')),
    sync_direction TEXT NOT NULL DEFAULT 'both' CHECK(sync_direction IN ('import', 'export', 'both')),
    frequency TEXT NOT NULL DEFAULT 'daily' CHECK(frequency IN ('realtime', 'hourly', 'daily', 'manual')),
    is_active INTEGER NOT NULL DEFAULT 0,
    calendar_name TEXT,
    last_synced_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### categorization_rules
```sql
CREATE TABLE categorization_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    pattern TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
)
```

### changelog
```sql
CREATE TABLE changelog (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    date DATE NOT NULL,
    changes TEXT NOT NULL, -- JSON array of change items
    highlights TEXT, -- Notable features/improvements
    breaking_changes TEXT, -- Any breaking changes
    published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### changelog_items
```sql
CREATE TABLE changelog_items (
    id TEXT PRIMARY KEY,
    changelog_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('feature', 'improvement', 'fix', 'breaking', 'security')),
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changelog_id) REFERENCES changelog(id) ON DELETE CASCADE
)
```

### chat_canned_responses
```sql
CREATE TABLE chat_canned_responses (
    id TEXT PRIMARY KEY,
    trigger_keywords TEXT NOT NULL, -- JSON array of keywords
    category TEXT, -- 'getting_started', 'cross_list', 'automation', etc.
    response_template TEXT NOT NULL,
    quick_actions TEXT DEFAULT '[]', -- JSON array of {label, action, route}
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### chat_conversations
```sql
CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT, -- Auto-generated from first message
    context TEXT DEFAULT '{}', -- JSON: page user was on, recent actions
    is_resolved INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### chat_messages
```sql
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON: suggested actions, links, code snippets
    helpful_rating INTEGER, -- 1-5 stars, null if not rated
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### checklist_items
```sql
CREATE TABLE checklist_items (
    id TEXT PRIMARY KEY,
    checklist_id TEXT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    due_date DATE,
    recurring_interval TEXT DEFAULT 'once',
    last_completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT '',
    attachments TEXT DEFAULT '[]',
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### checklist_shares
```sql
CREATE TABLE checklist_shares (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shared_with TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### checklists
```sql
CREATE TABLE checklists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### collaborations
```sql
CREATE TABLE collaborations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('listing_share', 'bundle', 'referral', 'mentorship')),
    title TEXT NOT NULL,
    description TEXT,
    terms TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    participants TEXT DEFAULT '[]',
    max_participants INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### community_badges
```sql
CREATE TABLE community_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_type TEXT NOT NULL, -- 'first_post', 'helpful_10', 'top_seller', etc.
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_type)
)
```

### community_flags
```sql
CREATE TABLE community_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'misinformation', 'other')),
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, target_type, target_id)
)
```

### community_posts
```sql
CREATE TABLE community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Post type and categorization
    type TEXT NOT NULL CHECK (type IN ('discussion', 'success', 'tip')),
    category TEXT, -- 'General', 'Tips', 'Questions', 'Poshmark', 'eBay', etc.

    -- Content
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    images TEXT DEFAULT '[]', -- JSON array of image URLs

    -- For success stories
    sold_item_title TEXT,
    sale_price REAL,
    cost_price REAL,
    profit REAL,
    platform TEXT,

    -- Engagement
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,

    -- Moderation
    is_pinned INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    flagged_count INTEGER DEFAULT 0,

    -- Tags
    tags TEXT DEFAULT '[]', -- JSON array

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### community_posts_fts
```sql
CREATE VIRTUAL TABLE community_posts_fts USING fts5(
    id,
    title,
    body,
    tags,
    content='community_posts',
    content_rowid='rowid'
)
```

### community_posts_fts_config
```sql
CREATE TABLE 'community_posts_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID
```

### community_posts_fts_data
```sql
CREATE TABLE 'community_posts_fts_data'(id INTEGER PRIMARY KEY, block BLOB)
```

### community_posts_fts_docsize
```sql
CREATE TABLE 'community_posts_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)
```

### community_posts_fts_idx
```sql
CREATE TABLE 'community_posts_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID
```

### community_reactions
```sql
CREATE TABLE community_reactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('upvote', 'downvote', 'congratulate', 'helpful')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, target_type, target_id, reaction_type)
)
```

### community_replies
```sql
CREATE TABLE community_replies (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_reply_id TEXT, -- For nested replies (1 level deep)
    body TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_reply_id) REFERENCES community_replies(id) ON DELETE CASCADE
)
```

### community_stats
```sql
CREATE TABLE community_stats (
    user_id TEXT PRIMARY KEY,
    posts_count INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    upvotes_received INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    total_sales_shared REAL DEFAULT 0,
    total_profit_shared REAL DEFAULT 0,
    badge_count INTEGER DEFAULT 0,
    last_active_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### competitor_keywords
```sql
CREATE TABLE competitor_keywords (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    cluster_name TEXT,
    competitor_count INTEGER DEFAULT 0,
    avg_price REAL,
    your_listing_count INTEGER DEFAULT 0,
    opportunity_score REAL DEFAULT 0,
    last_analyzed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### competitor_listings
```sql
CREATE TABLE competitor_listings (
    id TEXT PRIMARY KEY,
    competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- Platform's listing ID
    title TEXT NOT NULL,
    price REAL NOT NULL,
    original_price REAL,
    category TEXT,
    brand TEXT,
    condition TEXT,
    listed_at TEXT,
    sold_at TEXT,
    days_to_sell INTEGER,
    url TEXT,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### competitors
```sql
CREATE TABLE competitors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    profile_url TEXT,
    category_focus TEXT, -- Primary category they sell
    avg_price REAL,
    listing_count INTEGER DEFAULT 0,
    sell_through_rate REAL,
    last_checked_at TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, platform, username)
)
```

### cookie_consent
```sql
CREATE TABLE cookie_consent (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    analytics INTEGER DEFAULT 0,
    marketing INTEGER DEFAULT 0,
    functional INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### custom_metrics
```sql
CREATE TABLE custom_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    metric_a TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'divide',
    metric_b TEXT NOT NULL,
    display_format TEXT NOT NULL DEFAULT 'number',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### custom_reports
```sql
CREATE TABLE custom_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    widgets TEXT DEFAULT '[]',
    date_range TEXT DEFAULT '30d',
    is_favorite INTEGER DEFAULT 0,
    schedule TEXT,
    last_generated TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### data_export_requests
```sql
CREATE TABLE data_export_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    export_data TEXT,
    error TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### deleted_items
```sql
CREATE TABLE deleted_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('inventory', 'listing', 'order', 'offer', 'checklist')),
    original_id TEXT NOT NULL,
    original_data TEXT NOT NULL,
    deletion_reason TEXT DEFAULT 'manual' CHECK(deletion_reason IN ('manual', 'automation', 'bulk_operation', 'expired', 'duplicate', 'other')),
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### demand_forecasts
```sql
CREATE TABLE "demand_forecasts" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    forecast_date TEXT NOT NULL,
    demand_level TEXT NOT NULL,
    volume_estimate INTEGER,
    avg_price REAL,
    price_trend TEXT,
    seasonality_index REAL DEFAULT 1.0,
    competitor_count INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### duplicate_detections
```sql
CREATE TABLE duplicate_detections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    primary_item_id TEXT NOT NULL,
    duplicate_item_id TEXT NOT NULL,
    detection_type TEXT NOT NULL CHECK (detection_type IN ('sku_match', 'hash_match', 'title_brand_size', 'exact_title')),
    confidence_score REAL NOT NULL DEFAULT 0.0,
    user_action TEXT DEFAULT 'pending' CHECK (user_action IN ('pending', 'confirmed', 'ignored')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (primary_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (duplicate_item_id) REFERENCES inventory(id) ON DELETE CASCADE
)
```

### email_accounts
```sql
CREATE TABLE email_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_address TEXT NOT NULL,
    provider TEXT NOT NULL,  -- 'gmail' or 'outlook'
    oauth_token TEXT,        -- encrypted access token
    oauth_refresh_token TEXT, -- encrypted refresh token
    oauth_token_expires_at DATETIME,
    last_sync_at DATETIME,
    last_message_id TEXT,    -- Track last fetched email for pagination
    sync_status TEXT DEFAULT 'idle',  -- idle, syncing, error
    consecutive_failures INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at DATETIME,
    is_enabled INTEGER DEFAULT 1,
    filter_senders TEXT DEFAULT '[]',  -- JSON array of sender patterns to match
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_address),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### email_oauth_states
```sql
CREATE TABLE email_oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### email_parse_queue
```sql
CREATE TABLE email_parse_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_subject TEXT,
    email_from TEXT,
    email_body TEXT,
    email_date DATETIME,
    parsed_data TEXT, -- JSON of parsed purchase data
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME, receipt_type TEXT DEFAULT 'purchase', confidence_score REAL, source_file TEXT, file_type TEXT DEFAULT 'image', image_data TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### email_verifications
```sql
CREATE TABLE email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### error_logs
```sql
CREATE TABLE error_logs (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    method TEXT,
    path TEXT,
    user_id TEXT,
    ip_address TEXT,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

### expense_categories
```sql
CREATE TABLE expense_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'expense' CHECK(type IN ('expense', 'deduction', 'cogs')),
    tax_deductible INTEGER DEFAULT 0,
    total_amount REAL DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### extension_sync_queue
```sql
CREATE TABLE extension_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'scrape', 'track', 'crosslist'
    payload TEXT NOT NULL, -- JSON
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### feedback_responses
```sql
CREATE TABLE feedback_responses (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### feedback_submissions
```sql
CREATE TABLE feedback_submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('feature', 'improvement', 'bug', 'general')),
    category TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewing', 'planned', 'completed', 'declined')),
    admin_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, votes_up INTEGER DEFAULT 0, votes_down INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0, is_anonymous INTEGER DEFAULT 0, screenshot_data TEXT, screenshot_mime TEXT, roadmap_feature_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### feedback_votes
```sql
CREATE TABLE feedback_votes (
    id TEXT PRIMARY KEY,
    feedback_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feedback_id, user_id),
    FOREIGN KEY (feedback_id) REFERENCES feedback_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### financial_transactions
```sql
CREATE TABLE financial_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id TEXT,
    category TEXT,
    reference_type TEXT CHECK (reference_type IN ('purchase', 'sale', 'expense', 'income', 'manual', 'transfer')),
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, parent_transaction_id TEXT REFERENCES financial_transactions(id), is_split INTEGER DEFAULT 0, split_note TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
)
```

### health_checks
```sql
CREATE TABLE health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    checks TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### help_article_votes
```sql
CREATE TABLE help_article_votes (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES help_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(article_id, user_id)
)
```

### help_articles
```sql
CREATE TABLE help_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL, -- Markdown or HTML
    category TEXT,
    tags TEXT DEFAULT '[]',
    author_id TEXT,
    is_published INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
)
```

### help_articles_fts
```sql
CREATE VIRTUAL TABLE help_articles_fts USING fts5(
    id,
    title,
    content,
    tags,
    content='help_articles',
    content_rowid='rowid'
)
```

### help_articles_fts_config
```sql
CREATE TABLE 'help_articles_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID
```

### help_articles_fts_data
```sql
CREATE TABLE 'help_articles_fts_data'(id INTEGER PRIMARY KEY, block BLOB)
```

### help_articles_fts_docsize
```sql
CREATE TABLE 'help_articles_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)
```

### help_articles_fts_idx
```sql
CREATE TABLE 'help_articles_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID
```

### help_faq
```sql
CREATE TABLE help_faq (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    position INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### help_faq_votes
```sql
CREATE TABLE help_faq_votes (
    id TEXT PRIMARY KEY,
    faq_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (faq_id) REFERENCES help_faq(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(faq_id, user_id)
)
```

### help_videos
```sql
CREATE TABLE help_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL, -- YouTube embed or local file
    category TEXT, -- 'getting_started', 'cross_listing', 'automation', etc.
    duration INTEGER, -- Seconds
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0, -- Order in category
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### image_bank
```sql
CREATE TABLE image_bank (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_id TEXT,

    -- File information
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,

    -- Image metadata
    width INTEGER,
    height INTEGER,
    aspect_ratio REAL,
    dominant_color TEXT,

    -- Organization
    title TEXT,
    description TEXT,
    tags TEXT DEFAULT '[]', -- JSON array

    -- AI analysis results (from Claude Vision)
    ai_analysis TEXT DEFAULT '{}', -- JSON object with brand, category, etc.

    -- Usage tracking
    used_count INTEGER DEFAULT 0,
    last_used_at DATETIME,

    -- Relationships
    source_inventory_id TEXT, -- If imported from inventory item

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES image_bank_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (source_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
)
```

### image_bank_folders
```sql
CREATE TABLE image_bank_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES image_bank_folders(id) ON DELETE CASCADE
)
```

### image_bank_fts
```sql
CREATE VIRTUAL TABLE image_bank_fts USING fts5(
    id,
    title,
    description,
    tags,
    content='image_bank',
    content_rowid='rowid'
)
```

### image_bank_fts_config
```sql
CREATE TABLE 'image_bank_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID
```

### image_bank_fts_data
```sql
CREATE TABLE 'image_bank_fts_data'(id INTEGER PRIMARY KEY, block BLOB)
```

### image_bank_fts_docsize
```sql
CREATE TABLE 'image_bank_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)
```

### image_bank_fts_idx
```sql
CREATE TABLE 'image_bank_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID
```

### image_bank_usage
```sql
CREATE TABLE image_bank_usage (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    position INTEGER DEFAULT 0, -- Order in listing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    UNIQUE(image_id, inventory_id)
)
```

### image_edit_history
```sql
CREATE TABLE image_edit_history (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    edit_type TEXT NOT NULL, -- 'crop', 'filter', 'bg_remove', etc.
    parameters TEXT, -- JSON with edit settings
    original_path TEXT,
    edited_path TEXT NOT NULL,
    cloudinary_public_id TEXT, -- If using Cloudinary
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### import_jobs
```sql
CREATE TABLE import_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'excel', 'tsv', 'json')),
    original_filename TEXT,
    file_size INTEGER,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapping', 'validating', 'importing', 'completed', 'failed', 'cancelled')),

    -- Field mapping (JSON)
    -- Format: { "title": "Product Name", "brand": "Brand", "price": "List Price", ... }
    field_mapping TEXT,

    -- Import settings
    has_header_row INTEGER DEFAULT 1,
    skip_rows INTEGER DEFAULT 0,
    date_format TEXT DEFAULT 'MM/DD/YYYY',
    decimal_separator TEXT DEFAULT '.',
    update_existing INTEGER DEFAULT 0,          -- Update if SKU matches
    skip_duplicates INTEGER DEFAULT 1,          -- Skip if duplicate detected

    -- Stats
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,

    -- Error tracking
    errors TEXT,                                -- JSON array of errors

    -- Preview data (first 5 rows for mapping UI)
    preview_data TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
)
```

### import_mappings
```sql
CREATE TABLE import_mappings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Source info
    source_type TEXT,
    source_name TEXT,                           -- e.g., "Poshmark Export", "eBay CSV"

    -- Mapping configuration (JSON)
    field_mapping TEXT NOT NULL,

    -- Settings
    has_header_row INTEGER DEFAULT 1,
    skip_rows INTEGER DEFAULT 0,
    date_format TEXT DEFAULT 'MM/DD/YYYY',

    is_default INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### import_rows
```sql
CREATE TABLE import_rows (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'updated', 'skipped', 'failed', 'duplicate')),

    -- Original data
    raw_data TEXT,                              -- JSON of original row

    -- Parsed data
    parsed_data TEXT,                           -- JSON of parsed/mapped data

    -- Result
    inventory_id TEXT,                          -- Created/updated inventory item ID
    error_message TEXT,
    validation_errors TEXT,                     -- JSON array of field-level errors

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
)
```

### inventory
```sql
CREATE TABLE inventory (
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
    cost_price REAL DEFAULT 0,
    list_price REAL NOT NULL,
    quantity INTEGER DEFAULT 1,
    low_stock_threshold INTEGER DEFAULT 5,
    weight REAL,
    dimensions TEXT,
    material TEXT,
    tags TEXT DEFAULT '[]',
    images TEXT DEFAULT '[]',
    thumbnail_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'sold', 'archived', 'deleted')),
    location TEXT,
    notes TEXT,
    blockchain_hash TEXT,
    sustainability_score REAL,
    ai_generated_data TEXT DEFAULT '{}',
    custom_fields TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME, bin_location TEXT, purchase_date TEXT, supplier TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### inventory_categories
```sql
CREATE TABLE inventory_categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### inventory_cost_layers
```sql
CREATE TABLE inventory_cost_layers (
    id TEXT PRIMARY KEY,
    inventory_id TEXT,
    purchase_item_id TEXT,
    quantity_original INTEGER NOT NULL,
    quantity_remaining INTEGER NOT NULL,
    unit_cost REAL NOT NULL,
    purchase_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL
)
```

### inventory_fts
```sql
CREATE VIRTUAL TABLE inventory_fts USING fts5(
    id,
    title,
    description,
    brand,
    tags,
    content='inventory',
    content_rowid='rowid'
)
```

### inventory_fts_config
```sql
CREATE TABLE 'inventory_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID
```

### inventory_fts_data
```sql
CREATE TABLE 'inventory_fts_data'(id INTEGER PRIMARY KEY, block BLOB)
```

### inventory_fts_docsize
```sql
CREATE TABLE 'inventory_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)
```

### inventory_fts_idx
```sql
CREATE TABLE 'inventory_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID
```

### label_batches
```sql
CREATE TABLE label_batches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),

    -- Stats
    total_labels INTEGER DEFAULT 0,
    completed_labels INTEGER DEFAULT 0,
    failed_labels INTEGER DEFAULT 0,

    -- Output
    combined_pdf_url TEXT,                      -- Combined PDF of all labels
    manifest_url TEXT,                          -- Shipping manifest/SCAN form

    -- Costs
    total_postage REAL DEFAULT 0,

    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
)
```

### listing_engagement
```sql
CREATE TABLE listing_engagement (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE,
    inventory_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'view', 'like', 'share', 'offer', 'sale'
    platform TEXT NOT NULL,
    hour_of_day INTEGER NOT NULL CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday
    source TEXT, -- 'search', 'browse', 'share', 'direct', etc.
    location TEXT, -- Geographic region if available
    device_type TEXT, -- 'mobile', 'desktop', 'tablet'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### listing_refresh_history
```sql
CREATE TABLE listing_refresh_history (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('delist', 'relist', 'mark_sold')),
    reason TEXT, -- 'manual', 'stale', 'automation', 'schedule'
    previous_status TEXT,
    new_status TEXT,
    platform_response TEXT, -- JSON response from platform API
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### listing_templates
```sql
CREATE TABLE listing_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,

    -- Template field patterns
    title_pattern TEXT,
    description_template TEXT,
    tags TEXT, -- JSON array

    -- Pricing configuration
    pricing_strategy TEXT DEFAULT 'fixed', -- fixed, cost_plus, market
    markup_percentage REAL DEFAULT 0,

    -- Platform-specific settings
    platform_settings TEXT, -- JSON object with platform-specific configs

    -- Shipping configuration
    shipping_profile_id TEXT,

    -- Other settings
    condition_default TEXT,
    is_favorite INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### listings
```sql
CREATE TABLE "listings" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    inventory_id TEXT,
    platform TEXT NOT NULL,
    platform_listing_id TEXT,
    platform_url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL,
    original_price REAL,
    shipping_price REAL DEFAULT 0,
    category_path TEXT,
    condition_tag TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'sold', 'ended', 'error', 'archived')),
    images TEXT DEFAULT '[]',
    platform_specific_data TEXT DEFAULT '{}',
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    last_shared_at DATETIME,
    listed_at DATETIME,
    sold_at DATETIME,
    folder_id TEXT,
    refresh_count INTEGER DEFAULT 0,
    last_refresh_at DATETIME,
    stale_days_threshold INTEGER DEFAULT 30,
    auto_refresh_enabled INTEGER DEFAULT 0,
    last_delisted_at DATETIME,
    last_relisted_at DATETIME,
    marked_as_sold INTEGER DEFAULT 0,
    staleness_days INTEGER,
    auto_relist_enabled INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id),
    FOREIGN KEY (folder_id) REFERENCES listings_folders(id) ON DELETE SET NULL
)
```

### listings_folders
```sql
CREATE TABLE listings_folders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### market_insights
```sql
CREATE TABLE market_insights (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    brand TEXT,
    platform TEXT,
    saturation_score REAL CHECK (saturation_score >= 0 AND saturation_score <= 100),
    opportunity_score REAL CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
    avg_price REAL,
    price_range_low REAL,
    price_range_high REAL,
    avg_days_to_sell REAL,
    listing_count INTEGER,
    demand_trend TEXT, -- 'rising', 'stable', 'falling'
    competition_level TEXT, -- 'low', 'medium', 'high'
    recommended_price_range TEXT,
    insights_json TEXT, -- Additional insights as JSON
    valid_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### mfa_events
```sql
CREATE TABLE mfa_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('enabled', 'disabled', 'verified', 'backup_used', 'failed')),
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### migrations
```sql
CREATE TABLE migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
```

### notification_preferences
```sql
CREATE TABLE notification_preferences (
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### notifications
```sql
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### notion_field_mappings
```sql
CREATE TABLE notion_field_mappings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('inventory', 'sale', 'note')),
    -- VaultLister field name
    local_field TEXT NOT NULL,
    -- Notion property name
    notion_property TEXT NOT NULL,
    -- Notion property type: title, rich_text, number, select, multi_select, date, checkbox, url, email, phone_number, files, relation
    notion_property_type TEXT NOT NULL,
    -- Optional: for select/multi_select, map of local values to Notion option names
    value_mapping TEXT, -- JSON object
    -- Direction: bidirectional, push_only, pull_only
    sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('bidirectional', 'push_only', 'pull_only')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, entity_type, local_field)
)
```

### notion_settings
```sql
CREATE TABLE notion_settings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    -- Encrypted token stored here (uses same encryption as OAuth tokens)
    encrypted_token TEXT,
    -- Workspace info (populated after successful connection)
    workspace_id TEXT,
    workspace_name TEXT,
    workspace_icon TEXT,
    bot_id TEXT,
    -- Database IDs for different data types
    inventory_database_id TEXT,
    sales_database_id TEXT,
    notes_database_id TEXT,
    -- Sync configuration
    sync_enabled INTEGER DEFAULT 1,
    sync_interval_minutes INTEGER DEFAULT 60,
    conflict_strategy TEXT DEFAULT 'manual' CHECK (conflict_strategy IN ('manual', 'vaultlister_wins', 'notion_wins', 'newest_wins')),
    -- Sync state
    last_sync_at TEXT,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed', 'in_progress')),
    last_sync_error TEXT,
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### notion_sync_conflicts
```sql
CREATE TABLE notion_sync_conflicts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_map_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    local_id TEXT NOT NULL,
    notion_page_id TEXT NOT NULL,
    -- Snapshot of both versions at conflict time
    local_data TEXT NOT NULL, -- JSON
    notion_data TEXT NOT NULL, -- JSON
    -- Which fields differ
    conflicting_fields TEXT NOT NULL, -- JSON array
    -- Resolution
    resolved INTEGER DEFAULT 0,
    resolution TEXT CHECK (resolution IN ('keep_local', 'keep_notion', 'merge', 'ignore')),
    resolved_at TEXT,
    resolved_by TEXT,
    -- Timestamps
    detected_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sync_map_id) REFERENCES notion_sync_map(id) ON DELETE CASCADE
)
```

### notion_sync_history
```sql
CREATE TABLE notion_sync_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'push', 'pull', 'manual')),
    -- Sync direction
    direction TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
    -- Entity counts
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_deleted INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    -- Details
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'cancelled')),
    error_message TEXT,
    error_details TEXT, -- JSON array of individual errors
    -- Timing
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### notion_sync_map
```sql
CREATE TABLE notion_sync_map (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    -- Entity type: inventory, sale, note
    entity_type TEXT NOT NULL CHECK (entity_type IN ('inventory', 'sale', 'note')),
    -- Local VaultLister ID
    local_id TEXT NOT NULL,
    -- Notion page ID
    notion_page_id TEXT NOT NULL,
    -- For conflict detection
    local_updated_at TEXT,
    notion_updated_at TEXT,
    -- Sync state
    sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_push', 'pending_pull', 'conflict', 'error')),
    sync_error TEXT,
    last_synced_at TEXT,
    -- Timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, entity_type, local_id),
    UNIQUE(user_id, entity_type, notion_page_id)
)
```

### oauth_states
```sql
CREATE TABLE oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0, code_verifier TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### offers
```sql
CREATE TABLE offers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_offer_id TEXT,
    buyer_username TEXT,
    offer_amount REAL NOT NULL,
    counter_amount REAL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'countered', 'expired', 'cancelled')),
    auto_action TEXT,
    responded_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
)
```

### offline_sync_queue
```sql
CREATE TABLE offline_sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    payload TEXT DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'syncing', 'synced', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### onboarding_progress
```sql
CREATE TABLE onboarding_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT DEFAULT 'reseller',
    current_step INTEGER DEFAULT 0,
    completed_steps TEXT DEFAULT '[]',
    badges TEXT DEFAULT '[]',
    points INTEGER DEFAULT 0,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### orders
```sql
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_number TEXT,
    platform TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
    buyer_username TEXT,
    buyer_email TEXT,
    buyer_address TEXT,
    item_id TEXT,
    item_title TEXT NOT NULL,
    item_sku TEXT,
    sale_price REAL NOT NULL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    platform_fee REAL DEFAULT 0,
    tracking_number TEXT,
    shipping_provider TEXT,
    shipping_label_url TEXT,
    expected_delivery TEXT,
    actual_delivery TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    shipped_at DATETIME,
    delivered_at DATETIME, return_status TEXT DEFAULT NULL, return_reason TEXT DEFAULT NULL, return_requested_at DATETIME DEFAULT NULL, refund_amount REAL DEFAULT NULL, return_tracking TEXT DEFAULT NULL, refund_processed_at DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES inventory(id) ON DELETE SET NULL
)
```

### password_resets
```sql
CREATE TABLE password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### plan_usage
```sql
CREATE TABLE plan_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    metric TEXT NOT NULL,
    current_value INTEGER DEFAULT 0,
    plan_limit INTEGER DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### price_history
```sql
CREATE TABLE price_history (
    id TEXT PRIMARY KEY,
    inventory_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cost_price REAL,
    list_price REAL,
    previous_cost_price REAL,
    previous_list_price REAL,
    change_reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### price_predictions
```sql
CREATE TABLE price_predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    predicted_price REAL NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    price_range_low REAL,
    price_range_high REAL,
    demand_score REAL CHECK (demand_score >= 0 AND demand_score <= 100),
    recommendation TEXT NOT NULL, -- 'price_up', 'price_down', 'hold', 'relist'
    recommendation_reason TEXT,
    comparable_count INTEGER DEFAULT 0,
    avg_days_to_sell INTEGER,
    seasonality_factor REAL DEFAULT 1.0,
    platform TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### price_tracking
```sql
CREATE TABLE price_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Source information
    platform TEXT NOT NULL, -- 'poshmark', 'ebay', 'mercari'
    listing_url TEXT NOT NULL,
    listing_id TEXT,

    -- Item details
    title TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    size TEXT,

    -- Price tracking
    current_price REAL NOT NULL,
    original_price REAL,
    price_history TEXT DEFAULT '[]', -- JSON: [{ price, timestamp }]

    -- Monitoring
    alert_on_price_drop INTEGER DEFAULT 0,
    alert_threshold REAL, -- Alert if price drops below this
    last_checked_at DATETIME,

    -- Metadata
    images TEXT DEFAULT '[]',
    seller_username TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### purchase_items
```sql
CREATE TABLE purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT NOT NULL,
    inventory_id TEXT,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_cost REAL NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
)
```

### purchases
```sql
CREATE TABLE purchases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purchase_number TEXT,
    vendor_name TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Credit Card', 'Bank Transfer', 'Check', 'PayPal', 'Other')),
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'import')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### push_devices
```sql
CREATE TABLE "push_devices" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT
)
```

### push_notification_log
```sql
CREATE TABLE push_notification_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    channel TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### push_subscriptions
```sql
CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
)
```

### qr_analytics
```sql
CREATE TABLE qr_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    qr_type TEXT NOT NULL DEFAULT 'listing',
    reference_id TEXT,
    scan_count INTEGER DEFAULT 0,
    last_scanned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### receipt_vendors
```sql
CREATE TABLE receipt_vendors (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT DEFAULT '[]',
    -- JSON array of alternative names for matching
    default_category TEXT,
    -- 'thrift', 'wholesale', 'retail', 'shipping', 'platform', 'other'
    default_payment_method TEXT,
    -- 'Cash', 'Credit Card', 'Debit Card', 'PayPal', 'Venmo', 'Other'
    is_platform INTEGER DEFAULT 0,
    -- 1 if this is a selling platform (eBay, Poshmark, etc.)
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### recurring_transaction_templates
```sql
CREATE TABLE recurring_transaction_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id),
    category TEXT DEFAULT 'Expense',
    frequency TEXT DEFAULT 'monthly',
    last_executed DATETIME,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### relisting_performance
```sql
CREATE TABLE relisting_performance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    relist_queue_id TEXT,

    -- Before metrics
    price_before REAL,
    views_before INTEGER,
    likes_before INTEGER,
    days_without_sale INTEGER,

    -- After metrics (tracked over time)
    price_after REAL,
    views_after INTEGER DEFAULT 0,
    likes_after INTEGER DEFAULT 0,

    -- Outcome
    sold INTEGER DEFAULT 0,
    sold_at DATETIME,
    sale_price REAL,
    days_to_sale INTEGER,

    relisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### relisting_queue
```sql
CREATE TABLE relisting_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    rule_id TEXT,
    platform TEXT NOT NULL,

    -- Status tracking
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    scheduled_at DATETIME,
    processed_at DATETIME,

    -- Price changes
    original_price REAL,
    new_price REAL,
    price_change_reason TEXT,

    -- Changes made
    changes_made TEXT,                          -- JSON: what was changed
    error_message TEXT,

    -- Metrics before/after
    views_before INTEGER,
    likes_before INTEGER,
    days_listed INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### relisting_rules
```sql
CREATE TABLE relisting_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,

    -- Trigger conditions
    stale_days INTEGER DEFAULT 30,              -- Days before considering stale
    min_views INTEGER DEFAULT 0,                -- Minimum views before eligible
    max_views INTEGER,                          -- Maximum views (low engagement indicator)
    min_likes INTEGER DEFAULT 0,                -- Minimum likes before eligible

    -- Price adjustment strategy
    price_strategy TEXT DEFAULT 'fixed' CHECK (price_strategy IN ('fixed', 'percentage', 'tiered', 'prediction')),
    price_reduction_amount REAL DEFAULT 0,      -- Fixed amount or percentage
    price_floor_percentage REAL DEFAULT 50,     -- Never go below this % of original
    use_ai_pricing INTEGER DEFAULT 0,           -- Use AI predictions for new price

    -- Tiered price drops (JSON array)
    -- Format: [{"days": 7, "reduction": 5}, {"days": 14, "reduction": 10}, ...]
    tiered_reductions TEXT,

    -- Relisting options
    refresh_photos INTEGER DEFAULT 0,           -- Re-upload photos
    refresh_title INTEGER DEFAULT 0,            -- Regenerate title
    refresh_description INTEGER DEFAULT 0,      -- Regenerate description
    add_sale_tag INTEGER DEFAULT 0,             -- Add "SALE" or "REDUCED" to title

    -- Scheduling
    auto_relist INTEGER DEFAULT 0,              -- Automatically relist
    relist_time TEXT,                           -- Preferred time (HH:MM)
    relist_days TEXT,                           -- Days of week (JSON array: [1,2,3,4,5])
    max_relists_per_day INTEGER DEFAULT 10,     -- Rate limit

    -- Filters
    categories TEXT,                            -- JSON array of categories to include
    exclude_categories TEXT,                    -- JSON array of categories to exclude
    brands TEXT,                                -- JSON array of brands to include
    min_price REAL,                             -- Minimum item price
    max_price REAL,                             -- Maximum item price
    platforms TEXT,                             -- JSON array of platforms

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### report_schedules
```sql
CREATE TABLE report_schedules (
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
)
```

### request_logs
```sql
CREATE TABLE request_logs (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

### return_addresses
```sql
CREATE TABLE return_addresses (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### roadmap_features
```sql
CREATE TABLE roadmap_features (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed')),
    category TEXT,
    eta TEXT,
    votes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### roadmap_votes
```sql
CREATE TABLE roadmap_votes (
    id TEXT PRIMARY KEY,
    feature_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feature_id) REFERENCES roadmap_features(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(feature_id, user_id)
)
```

### rum_metrics
```sql
CREATE TABLE rum_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    page_url TEXT,
    user_agent TEXT,
    connection_type TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    metadata TEXT DEFAULT '{}'
)
```

### sales
```sql
CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT,
    inventory_id TEXT,
    platform TEXT NOT NULL,
    platform_order_id TEXT,
    buyer_username TEXT,
    buyer_address TEXT,
    sale_price REAL NOT NULL,
    platform_fee REAL DEFAULT 0,
    shipping_cost REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    net_profit REAL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),
    tracking_number TEXT,
    carrier TEXT,
    shipped_at DATETIME,
    delivered_at DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, item_cost REAL DEFAULT 0, customer_shipping_cost REAL DEFAULT 0, seller_shipping_cost REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
)
```

### sales_tax_nexus
```sql
CREATE TABLE sales_tax_nexus (
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
)
```

### saved_reports
```sql
CREATE TABLE saved_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    report_type TEXT NOT NULL DEFAULT 'custom',
    config TEXT DEFAULT '{}',
    last_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### scraped_products
```sql
CREATE TABLE scraped_products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Source
    source_url TEXT NOT NULL,
    source_site TEXT NOT NULL, -- 'amazon', 'nordstrom', etc.

    -- Product data
    title TEXT NOT NULL,
    brand TEXT,
    price REAL,
    original_price REAL,
    description TEXT,
    images TEXT DEFAULT '[]', -- JSON array
    category TEXT,
    color TEXT,
    size TEXT,
    material TEXT,

    -- Status
    imported_to_inventory INTEGER DEFAULT 0,
    inventory_id TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
)
```

### search_analytics
```sql
CREATE TABLE search_analytics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    search_term TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    results_found INTEGER DEFAULT 0,
    last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### security_logs
```sql
CREATE TABLE security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    ip_or_user TEXT NOT NULL,
    user_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)
```

### sessions
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    refresh_token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_valid INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### shipping_labels
```sql
CREATE TABLE shipping_labels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    order_id TEXT,
    sale_id TEXT,

    -- Shipment info
    tracking_number TEXT,
    carrier TEXT NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
    service_type TEXT,                          -- e.g., 'Priority Mail', 'Ground', 'Express'

    -- Package details
    weight_oz REAL,
    length_in REAL,
    width_in REAL,
    height_in REAL,
    package_type TEXT DEFAULT 'package',        -- package, envelope, flat_rate_box, etc.

    -- Addresses
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

    -- Label details
    label_format TEXT DEFAULT 'pdf' CHECK (label_format IN ('pdf', 'png', 'zpl', 'epl')),
    label_size TEXT DEFAULT '4x6' CHECK (label_size IN ('4x6', '4x4', '8.5x11')),
    label_url TEXT,                             -- URL or path to generated label
    label_data TEXT,                            -- Base64 encoded label for inline display

    -- Costs
    postage_cost REAL,
    insurance_cost REAL DEFAULT 0,
    total_cost REAL,
    currency TEXT DEFAULT 'USD',

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'purchased', 'printed', 'shipped', 'delivered', 'returned', 'voided')),
    purchased_at DATETIME,
    printed_at DATETIME,
    shipped_at DATETIME,
    delivered_at DATETIME,
    voided_at DATETIME,

    -- Integration
    external_label_id TEXT,                     -- ID from shipping API (EasyPost, Shippo, etc.)
    external_shipment_id TEXT,
    rate_id TEXT,                               -- Selected rate ID

    -- Metadata
    notes TEXT,
    batch_id TEXT,                              -- For bulk operations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### shipping_profiles
```sql
CREATE TABLE shipping_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    carrier TEXT,                    -- USPS, UPS, FedEx, etc.
    service_type TEXT,               -- Priority, Ground, Express, etc.
    package_type TEXT,               -- Box, Envelope, Poly Mailer, etc.
    weight_oz REAL DEFAULT 0,        -- Default weight in ounces
    length REAL DEFAULT 0,           -- Package dimensions
    width REAL DEFAULT 0,
    height REAL DEFAULT 0,
    handling_time_days INTEGER DEFAULT 1,
    domestic_cost REAL DEFAULT 0,    -- Flat rate for domestic
    international_cost REAL,         -- Flat rate for international (null = no intl)
    free_shipping_threshold REAL,    -- Order total for free shipping (null = none)
    is_default INTEGER DEFAULT 0,    -- Only one default per user
    platforms TEXT DEFAULT '[]',     -- JSON array: ["poshmark","ebay","mercari"]
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### shipping_rates
```sql
CREATE TABLE shipping_rates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label_id TEXT,

    carrier TEXT NOT NULL,
    service TEXT NOT NULL,
    rate REAL NOT NULL,
    currency TEXT DEFAULT 'USD',

    delivery_days INTEGER,
    delivery_date TEXT,

    rate_id TEXT,                               -- External rate ID for purchasing

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME                         -- Rates expire after some time
)
```

### shops
```sql
CREATE TABLE shops (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_username TEXT,
    platform_user_id TEXT,
    credentials TEXT, -- encrypted
    is_connected INTEGER DEFAULT 1,
    last_sync_at DATETIME,
    sync_status TEXT DEFAULT 'idle',
    settings TEXT DEFAULT '{}',
    stats TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, oauth_provider TEXT, oauth_token TEXT, oauth_refresh_token TEXT, oauth_token_expires_at DATETIME, oauth_scopes TEXT, connection_type TEXT DEFAULT 'manual', consecutive_refresh_failures INTEGER DEFAULT 0, last_token_refresh_at DATETIME, token_refresh_error TEXT, token_refresh_error_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, platform)
)
```

### sku_platform_links
```sql
CREATE TABLE sku_platform_links (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    master_sku TEXT NOT NULL,
    platform TEXT NOT NULL,
    platform_sku TEXT,
    inventory_id TEXT,
    sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('synced', 'pending', 'conflict', 'error')),
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### sku_rules
```sql
CREATE TABLE sku_rules (
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
    variables TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### stream_staging
```sql
CREATE TABLE stream_staging (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT,
    inventory_id TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    flash_price REAL,
    bundle_group TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### supplier_items
```sql
CREATE TABLE supplier_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    url TEXT,
    current_price REAL,
    target_price REAL, -- Alert when price drops below this
    alert_threshold REAL DEFAULT 0.10, -- 10% drop triggers alert
    last_price REAL,
    price_change REAL DEFAULT 0,
    last_checked_at TEXT,
    alert_enabled INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### supplier_price_history
```sql
CREATE TABLE supplier_price_history (
    id TEXT PRIMARY KEY,
    supplier_item_id TEXT NOT NULL REFERENCES supplier_items(id) ON DELETE CASCADE,
    price REAL NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### suppliers
```sql
CREATE TABLE suppliers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'wholesale', 'thrift', 'estate', 'online', 'auction', 'other'
    website TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_active INTEGER NOT NULL DEFAULT 1,
    last_order_date TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### support_ticket_replies
```sql
CREATE TABLE support_ticket_replies (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    user_id TEXT, -- NULL if from support staff
    is_staff_reply INTEGER DEFAULT 0,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### support_tickets
```sql
CREATE TABLE support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('contact', 'bug', 'feature_request')),
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),

    -- Attachments
    screenshots TEXT DEFAULT '[]', -- JSON array of image URLs

    -- Metadata
    page_context TEXT, -- Page user was on when submitting
    browser_info TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### sustainability_log
```sql
CREATE TABLE sustainability_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    inventory_id TEXT,
    sale_id TEXT,
    category TEXT,
    water_saved_liters REAL DEFAULT 0,
    co2_saved_kg REAL DEFAULT 0,
    waste_prevented_kg REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL
)
```

### sync_queue
```sql
CREATE TABLE sync_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
    conflict_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### task_queue
```sql
CREATE TABLE task_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### tasks
```sql
CREATE TABLE tasks (
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
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### team_activity_log
```sql
CREATE TABLE team_activity_log (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT, -- JSON details
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
)
```

### team_invitations
```sql
CREATE TABLE "team_invitations" (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by TEXT NOT NULL,
    message TEXT,
    expires_at DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
)
```

### team_members
```sql
CREATE TABLE "team_members" (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
    invited_by TEXT,
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
    permissions TEXT,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
)
```

### teams
```sql
CREATE TABLE "teams" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_user_id TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'enterprise')),
    max_members INTEGER DEFAULT 3,
    settings TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### tos_acceptances
```sql
CREATE TABLE tos_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tos_version_id TEXT NOT NULL,
    accepted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tos_version_id) REFERENCES tos_versions(id)
)
```

### tos_versions
```sql
CREATE TABLE tos_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary_of_changes TEXT,
    effective_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### transaction_attachments
```sql
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT DEFAULT 'image/jpeg',
    file_size INTEGER DEFAULT 0,
    file_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### transaction_audit_log
```sql
CREATE TABLE transaction_audit_log (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### user_webhooks
```sql
CREATE TABLE user_webhooks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                secret TEXT NOT NULL,
                events TEXT NOT NULL,
                headers TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
```

### users
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'business')),
    subscription_expires_at DATETIME,
    timezone TEXT DEFAULT 'America/New_York',
    locale TEXT DEFAULT 'en-US',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    is_active INTEGER DEFAULT 1,
    preferences TEXT DEFAULT '{}',
    onboarding_completed INTEGER DEFAULT 0
, email_verified INTEGER DEFAULT 0, email_verified_at DATETIME, mfa_enabled INTEGER DEFAULT 0, mfa_secret TEXT, mfa_backup_codes TEXT)
```

### verification_tokens
```sql
CREATE TABLE verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'mfa_setup', 'mfa_login')),
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### warehouse_bins
```sql
CREATE TABLE warehouse_bins (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    bin_code TEXT NOT NULL,
    label TEXT,
    zone TEXT,
    item_count INTEGER DEFAULT 0,
    barcode_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, bin_code)
)
```

### warehouse_locations
```sql
CREATE TABLE warehouse_locations (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### watermark_presets
```sql
CREATE TABLE watermark_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'qr')),
    content TEXT,
    position TEXT DEFAULT 'bottom-right',
    opacity REAL DEFAULT 0.5,
    size INTEGER DEFAULT 24,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

### webhook_deliveries
```sql
CREATE TABLE webhook_deliveries (
                id TEXT PRIMARY KEY,
                webhook_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT,
                status TEXT NOT NULL,
                status_code INTEGER,
                response_body TEXT,
                attempt INTEGER DEFAULT 1,
                created_at TEXT,
                FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id) ON DELETE CASCADE
            )
```

### webhook_endpoints
```sql
CREATE TABLE webhook_endpoints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]', -- JSON array of subscribed event types
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_triggered_at TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### webhook_events
```sql
CREATE TABLE webhook_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    endpoint_id TEXT REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
    source TEXT NOT NULL, -- 'ebay', 'poshmark', 'internal', etc.
    event_type TEXT NOT NULL, -- 'listing.sold', 'order.created', etc.
    payload TEXT NOT NULL DEFAULT '{}', -- JSON payload
    signature TEXT, -- HMAC signature for verification
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed
    processed_at TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### whatnot_cohosts
```sql
CREATE TABLE whatnot_cohosts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    cohost_name TEXT NOT NULL,
    role TEXT DEFAULT 'moderator' CHECK(role IN ('host', 'cohost', 'moderator')),
    revenue_split REAL DEFAULT 0,
    status TEXT DEFAULT 'invited' CHECK(status IN ('invited', 'accepted', 'declined')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES whatnot_events(id) ON DELETE CASCADE
)
```

### whatnot_event_items
```sql
CREATE TABLE whatnot_event_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    starting_price REAL DEFAULT 0,
    buy_now_price REAL,
    min_price REAL DEFAULT 0,
    sold_price REAL,
    buyer_username TEXT,
    sort_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES whatnot_events(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
)
```

### whatnot_events
```sql
CREATE TABLE whatnot_events (
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
    total_sales REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
```

## Indexes

- account_deletion_requests.idx_account_deletion_scheduled: `CREATE INDEX idx_account_deletion_scheduled ON account_deletion_requests(scheduled_for)`
- account_deletion_requests.idx_account_deletion_status: `CREATE INDEX idx_account_deletion_status ON account_deletion_requests(status)`
- account_deletion_requests.idx_account_deletion_user: `CREATE INDEX idx_account_deletion_user ON account_deletion_requests(user_id)`
- accounts.idx_accounts_parent: `CREATE INDEX idx_accounts_parent ON accounts(parent_account_id)`
- accounts.idx_accounts_type: `CREATE INDEX idx_accounts_type ON accounts(account_type)`
- accounts.idx_accounts_user: `CREATE INDEX idx_accounts_user ON accounts(user_id)`
- affiliate_commissions.idx_affiliate_commissions_user: `CREATE INDEX idx_affiliate_commissions_user ON affiliate_commissions(affiliate_user_id)`
- affiliate_landing_pages.idx_affiliate_landing_user: `CREATE INDEX idx_affiliate_landing_user ON affiliate_landing_pages(user_id)`
- alerts.idx_alerts_acknowledged: `CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged)`
- alerts.idx_alerts_created: `CREATE INDEX idx_alerts_created ON alerts(created_at)`
- alerts.idx_alerts_created_at: `CREATE INDEX idx_alerts_created_at ON alerts(created_at)`
- alerts.idx_alerts_type: `CREATE INDEX idx_alerts_type ON alerts(type)`
- analytics_snapshots.idx_analytics_snapshots_user_date: `CREATE INDEX idx_analytics_snapshots_user_date ON analytics_snapshots(user_id, date)`
- audit_logs.idx_audit_logs_action: `CREATE INDEX idx_audit_logs_action ON audit_logs(action)`
- audit_logs.idx_audit_logs_created_at: `CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)`
- audit_logs.idx_audit_logs_resource_id: `CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id)`
- audit_logs.idx_audit_logs_resource_type: `CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type)`
- audit_logs.idx_audit_logs_user_id: `CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)`
- automation_experiments.idx_experiments_status: `CREATE INDEX idx_experiments_status ON automation_experiments(status)`
- automation_experiments.idx_experiments_user: `CREATE INDEX idx_experiments_user ON automation_experiments(user_id)`
- automation_logs.idx_automation_logs_created_at: `CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at)`
- automation_logs.idx_automation_logs_user_id: `CREATE INDEX idx_automation_logs_user_id ON automation_logs(user_id)`
- automation_rule_versions.idx_rule_versions_rule: `CREATE INDEX idx_rule_versions_rule ON automation_rule_versions(rule_id, version DESC)`
- automation_rules.idx_automation_rules_user_id: `CREATE INDEX idx_automation_rules_user_id ON automation_rules(user_id)`
- automation_runs.idx_automation_runs_automation: `CREATE INDEX idx_automation_runs_automation ON automation_runs(automation_id)`
- automation_runs.idx_automation_runs_started: `CREATE INDEX idx_automation_runs_started ON automation_runs(started_at)`
- automation_runs.idx_automation_runs_status: `CREATE INDEX idx_automation_runs_status ON automation_runs(status)`
- automation_runs.idx_automation_runs_user: `CREATE INDEX idx_automation_runs_user ON automation_runs(user_id)`
- automation_runs.idx_automation_runs_user_started: `CREATE INDEX idx_automation_runs_user_started ON automation_runs(user_id, started_at DESC)`
- automation_template_installs.idx_template_installs_user: `CREATE INDEX idx_template_installs_user ON automation_template_installs(user_id)`
- automation_templates.idx_templates_author: `CREATE INDEX idx_templates_author ON automation_templates(author_id)`
- automation_templates.idx_templates_public: `CREATE INDEX idx_templates_public ON automation_templates(is_public)`
- barcode_lookups.idx_barcode_lookups_barcode: `CREATE INDEX idx_barcode_lookups_barcode ON barcode_lookups(barcode)`
- barcode_lookups.idx_barcode_lookups_brand: `CREATE INDEX idx_barcode_lookups_brand ON barcode_lookups(brand)`
- batch_photo_items.idx_batch_items_job: `CREATE INDEX idx_batch_items_job ON batch_photo_items(job_id)`
- batch_photo_items.idx_batch_items_status: `CREATE INDEX idx_batch_items_status ON batch_photo_items(job_id, status)`
- batch_photo_jobs.idx_batch_jobs_status: `CREATE INDEX idx_batch_jobs_status ON batch_photo_jobs(user_id, status)`
- batch_photo_jobs.idx_batch_jobs_user: `CREATE INDEX idx_batch_jobs_user ON batch_photo_jobs(user_id)`
- batch_photo_presets.idx_batch_presets_user: `CREATE INDEX idx_batch_presets_user ON batch_photo_presets(user_id)`
- brand_size_guides.idx_brand_size_guides_brand: `CREATE INDEX idx_brand_size_guides_brand ON brand_size_guides(brand)`
- brand_size_guides.idx_brand_size_guides_brand_garment: `CREATE INDEX idx_brand_size_guides_brand_garment ON brand_size_guides(brand, garment_type)`
- brand_size_guides.idx_brand_size_guides_garment: `CREATE INDEX idx_brand_size_guides_garment ON brand_size_guides(garment_type)`
- buyer_profiles.idx_buyer_profiles_user: `CREATE INDEX idx_buyer_profiles_user ON buyer_profiles(user_id)`
- calendar_events.idx_calendar_date: `CREATE INDEX idx_calendar_date ON calendar_events(date)`
- calendar_events.idx_calendar_type: `CREATE INDEX idx_calendar_type ON calendar_events(type)`
- calendar_events.idx_calendar_user: `CREATE INDEX idx_calendar_user ON calendar_events(user_id)`
- calendar_sync_settings.idx_calendar_sync_user: `CREATE INDEX idx_calendar_sync_user ON calendar_sync_settings(user_id)`
- calendar_sync_settings.idx_calendar_sync_user_provider: `CREATE UNIQUE INDEX idx_calendar_sync_user_provider ON calendar_sync_settings(user_id, provider)`
- categorization_rules.idx_categorization_rules_pattern: `CREATE INDEX idx_categorization_rules_pattern ON categorization_rules(pattern)`
- categorization_rules.idx_categorization_rules_user: `CREATE INDEX idx_categorization_rules_user ON categorization_rules(user_id)`
- changelog.idx_changelog_date: `CREATE INDEX idx_changelog_date ON changelog(date DESC)`
- changelog.idx_changelog_version: `CREATE INDEX idx_changelog_version ON changelog(version)`
- changelog_items.idx_changelog_items_changelog: `CREATE INDEX idx_changelog_items_changelog ON changelog_items(changelog_id)`
- chat_conversations.idx_chat_conversations_user: `CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id)`
- chat_messages.idx_chat_messages_conversation: `CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id)`
- chat_messages.idx_chat_messages_created: `CREATE INDEX idx_chat_messages_created ON chat_messages(created_at)`
- checklist_items.idx_checklist_items_checklist: `CREATE INDEX idx_checklist_items_checklist ON checklist_items(checklist_id)`
- checklist_items.idx_checklist_items_completed: `CREATE INDEX idx_checklist_items_completed ON checklist_items(completed)`
- checklist_items.idx_checklist_items_due_date: `CREATE INDEX idx_checklist_items_due_date ON checklist_items(due_date)`
- checklist_items.idx_checklist_items_priority: `CREATE INDEX idx_checklist_items_priority ON checklist_items(priority)`
- checklist_items.idx_checklist_items_user: `CREATE INDEX idx_checklist_items_user ON checklist_items(user_id)`
- collaborations.idx_collaborations_status: `CREATE INDEX idx_collaborations_status ON collaborations(status)`
- collaborations.idx_collaborations_type: `CREATE INDEX idx_collaborations_type ON collaborations(type)`
- collaborations.idx_collaborations_user_id: `CREATE INDEX idx_collaborations_user_id ON collaborations(user_id)`
- community_posts.idx_community_posts_activity: `CREATE INDEX idx_community_posts_activity ON community_posts(last_activity_at DESC)`
- community_posts.idx_community_posts_category: `CREATE INDEX idx_community_posts_category ON community_posts(category)`
- community_posts.idx_community_posts_type: `CREATE INDEX idx_community_posts_type ON community_posts(type)`
- community_posts.idx_community_posts_upvotes: `CREATE INDEX idx_community_posts_upvotes ON community_posts(upvotes DESC)`
- community_posts.idx_community_posts_user: `CREATE INDEX idx_community_posts_user ON community_posts(user_id)`
- community_reactions.idx_community_reactions_target: `CREATE INDEX idx_community_reactions_target ON community_reactions(target_type, target_id)`
- community_replies.idx_community_replies_post: `CREATE INDEX idx_community_replies_post ON community_replies(post_id)`
- community_stats.idx_community_stats_profit: `CREATE INDEX idx_community_stats_profit ON community_stats(total_profit_shared DESC)`
- community_stats.idx_community_stats_upvotes: `CREATE INDEX idx_community_stats_upvotes ON community_stats(upvotes_received DESC)`
- competitor_keywords.idx_competitor_keywords_user: `CREATE INDEX idx_competitor_keywords_user ON competitor_keywords(user_id)`
- competitor_listings.idx_competitor_listings_category: `CREATE INDEX idx_competitor_listings_category ON competitor_listings(category)`
- competitor_listings.idx_competitor_listings_competitor: `CREATE INDEX idx_competitor_listings_competitor ON competitor_listings(competitor_id)`
- competitor_listings.idx_competitor_listings_sold: `CREATE INDEX idx_competitor_listings_sold ON competitor_listings(sold_at)`
- competitors.idx_competitors_active: `CREATE INDEX idx_competitors_active ON competitors(is_active)`
- competitors.idx_competitors_platform: `CREATE INDEX idx_competitors_platform ON competitors(platform)`
- competitors.idx_competitors_user: `CREATE INDEX idx_competitors_user ON competitors(user_id)`
- cookie_consent.idx_cookie_consent_user: `CREATE INDEX idx_cookie_consent_user ON cookie_consent(user_id)`
- custom_reports.idx_custom_reports_user: `CREATE INDEX idx_custom_reports_user ON custom_reports(user_id)`
- data_export_requests.idx_data_export_status: `CREATE INDEX idx_data_export_status ON data_export_requests(status)`
- data_export_requests.idx_data_export_user: `CREATE INDEX idx_data_export_user ON data_export_requests(user_id)`
- deleted_items.idx_deleted_items_type: `CREATE INDEX idx_deleted_items_type ON deleted_items(item_type)`
- deleted_items.idx_deleted_items_user: `CREATE INDEX idx_deleted_items_user ON deleted_items(user_id)`
- demand_forecasts.idx_demand_forecasts_date: `CREATE INDEX idx_demand_forecasts_date ON demand_forecasts(forecast_date)`
- demand_forecasts.idx_demand_forecasts_user: `CREATE INDEX idx_demand_forecasts_user ON demand_forecasts(user_id)`
- duplicate_detections.idx_duplicate_detections_created: `CREATE INDEX idx_duplicate_detections_created ON duplicate_detections(created_at DESC)`
- duplicate_detections.idx_duplicate_detections_duplicate_item: `CREATE INDEX idx_duplicate_detections_duplicate_item ON duplicate_detections(duplicate_item_id)`
- duplicate_detections.idx_duplicate_detections_primary_item: `CREATE INDEX idx_duplicate_detections_primary_item ON duplicate_detections(primary_item_id)`
- duplicate_detections.idx_duplicate_detections_unique_pair: `CREATE UNIQUE INDEX idx_duplicate_detections_unique_pair
ON duplicate_detections(user_id, primary_item_id, duplicate_item_id)`
- duplicate_detections.idx_duplicate_detections_user_action: `CREATE INDEX idx_duplicate_detections_user_action ON duplicate_detections(user_id, user_action)`
- duplicate_detections.idx_duplicate_detections_user_id: `CREATE INDEX idx_duplicate_detections_user_id ON duplicate_detections(user_id)`
- email_accounts.idx_email_accounts_provider_enabled: `CREATE INDEX idx_email_accounts_provider_enabled
    ON email_accounts(provider, is_enabled)`
- email_accounts.idx_email_accounts_sync: `CREATE INDEX idx_email_accounts_sync
ON email_accounts(is_enabled, sync_status, last_sync_at)`
- email_accounts.idx_email_accounts_user_enabled: `CREATE INDEX idx_email_accounts_user_enabled
ON email_accounts(user_id, is_enabled)`
- email_oauth_states.idx_email_oauth_states_expires: `CREATE INDEX idx_email_oauth_states_expires
ON email_oauth_states(expires_at)`
- email_oauth_states.idx_email_oauth_states_token: `CREATE INDEX idx_email_oauth_states_token
ON email_oauth_states(state_token)`
- email_parse_queue.idx_email_parse_queue_status: `CREATE INDEX idx_email_parse_queue_status ON email_parse_queue(user_id, status)`
- email_parse_queue.idx_email_parse_queue_type: `CREATE INDEX idx_email_parse_queue_type ON email_parse_queue(user_id, receipt_type)`
- email_parse_queue.idx_email_queue_status: `CREATE INDEX idx_email_queue_status ON email_parse_queue(status)`
- email_parse_queue.idx_email_queue_user: `CREATE INDEX idx_email_queue_user ON email_parse_queue(user_id)`
- email_verifications.idx_email_verifications_token: `CREATE INDEX idx_email_verifications_token ON email_verifications(token)`
- email_verifications.idx_email_verifications_user: `CREATE INDEX idx_email_verifications_user ON email_verifications(user_id)`
- error_logs.idx_error_logs_created: `CREATE INDEX idx_error_logs_created ON error_logs(created_at)`
- error_logs.idx_error_logs_created_at: `CREATE INDEX idx_error_logs_created_at ON error_logs(created_at)`
- error_logs.idx_error_logs_error_type: `CREATE INDEX idx_error_logs_error_type ON error_logs(error_type)`
- error_logs.idx_error_logs_type: `CREATE INDEX idx_error_logs_type ON error_logs(error_type)`
- error_logs.idx_error_logs_user_id: `CREATE INDEX idx_error_logs_user_id ON error_logs(user_id)`
- expense_categories.idx_expense_categories_user: `CREATE INDEX idx_expense_categories_user ON expense_categories(user_id)`
- extension_sync_queue.idx_extension_sync_status: `CREATE INDEX idx_extension_sync_status ON extension_sync_queue(status)`
- extension_sync_queue.idx_extension_sync_user: `CREATE INDEX idx_extension_sync_user ON extension_sync_queue(user_id, status)`
- feedback_responses.idx_feedback_responses_feedback: `CREATE INDEX idx_feedback_responses_feedback ON feedback_responses(feedback_id)`
- feedback_submissions.idx_feedback_status: `CREATE INDEX idx_feedback_status ON feedback_submissions(status)`
- feedback_submissions.idx_feedback_type: `CREATE INDEX idx_feedback_type ON feedback_submissions(type)`
- feedback_submissions.idx_feedback_user: `CREATE INDEX idx_feedback_user ON feedback_submissions(user_id)`
- feedback_votes.idx_feedback_votes_feedback: `CREATE INDEX idx_feedback_votes_feedback ON feedback_votes(feedback_id)`
- feedback_votes.idx_feedback_votes_user: `CREATE INDEX idx_feedback_votes_user ON feedback_votes(user_id)`
- financial_transactions.idx_financial_transactions_account: `CREATE INDEX idx_financial_transactions_account ON financial_transactions(account_id)`
- financial_transactions.idx_financial_transactions_date: `CREATE INDEX idx_financial_transactions_date ON financial_transactions(transaction_date)`
- financial_transactions.idx_financial_transactions_ref: `CREATE INDEX idx_financial_transactions_ref ON financial_transactions(reference_type, reference_id)`
- financial_transactions.idx_financial_transactions_user: `CREATE INDEX idx_financial_transactions_user ON financial_transactions(user_id)`
- health_checks.idx_health_checks_created: `CREATE INDEX idx_health_checks_created ON health_checks(created_at)`
- help_article_votes.idx_help_article_votes_user: `CREATE INDEX idx_help_article_votes_user ON help_article_votes(user_id)`
- help_articles.idx_help_articles_category: `CREATE INDEX idx_help_articles_category ON help_articles(category)`
- help_articles.idx_help_articles_published: `CREATE INDEX idx_help_articles_published ON help_articles(is_published)`
- help_faq.idx_help_faq_category: `CREATE INDEX idx_help_faq_category ON help_faq(category, position)`
- help_faq_votes.idx_help_faq_votes_user: `CREATE INDEX idx_help_faq_votes_user ON help_faq_votes(user_id)`
- help_videos.idx_help_videos_category: `CREATE INDEX idx_help_videos_category ON help_videos(category, position)`
- image_bank.idx_image_bank_created: `CREATE INDEX idx_image_bank_created ON image_bank(created_at DESC)`
- image_bank.idx_image_bank_folder: `CREATE INDEX idx_image_bank_folder ON image_bank(folder_id)`
- image_bank.idx_image_bank_user: `CREATE INDEX idx_image_bank_user ON image_bank(user_id)`
- image_bank_folders.idx_folders_user: `CREATE INDEX idx_folders_user ON image_bank_folders(user_id)`
- image_bank_usage.idx_image_bank_usage_image: `CREATE INDEX idx_image_bank_usage_image ON image_bank_usage(image_id)`
- image_bank_usage.idx_image_bank_usage_inventory: `CREATE INDEX idx_image_bank_usage_inventory ON image_bank_usage(inventory_id)`
- import_jobs.idx_import_jobs_status: `CREATE INDEX idx_import_jobs_status ON import_jobs(status)`
- import_jobs.idx_import_jobs_user: `CREATE INDEX idx_import_jobs_user ON import_jobs(user_id)`
- import_mappings.idx_import_mappings_user: `CREATE INDEX idx_import_mappings_user ON import_mappings(user_id)`
- import_rows.idx_import_rows_job: `CREATE INDEX idx_import_rows_job ON import_rows(job_id)`
- import_rows.idx_import_rows_status: `CREATE INDEX idx_import_rows_status ON import_rows(status)`
- inventory.idx_inventory_bin_location: `CREATE INDEX idx_inventory_bin_location ON inventory(bin_location)`
- inventory.idx_inventory_brand: `CREATE INDEX idx_inventory_brand ON inventory(brand)`
- inventory.idx_inventory_category: `CREATE INDEX idx_inventory_category ON inventory(category)`
- inventory.idx_inventory_deleted_at: `CREATE INDEX idx_inventory_deleted_at ON inventory(deleted_at)`
- inventory.idx_inventory_sku: `CREATE INDEX idx_inventory_sku ON inventory(sku)`
- inventory.idx_inventory_status: `CREATE INDEX idx_inventory_status ON inventory(status)`
- inventory.idx_inventory_user_created: `CREATE INDEX idx_inventory_user_created ON inventory(user_id, created_at DESC)`
- inventory.idx_inventory_user_id: `CREATE INDEX idx_inventory_user_id ON inventory(user_id)`
- inventory.idx_inventory_user_status: `CREATE INDEX idx_inventory_user_status ON inventory(user_id, status)`
- inventory_categories.idx_categories_user_name: `CREATE UNIQUE INDEX idx_categories_user_name ON inventory_categories(user_id, name)`
- inventory_cost_layers.idx_cost_layers_date: `CREATE INDEX idx_cost_layers_date ON inventory_cost_layers(purchase_date)`
- inventory_cost_layers.idx_cost_layers_inventory: `CREATE INDEX idx_cost_layers_inventory ON inventory_cost_layers(inventory_id)`
- inventory_cost_layers.idx_cost_layers_remaining: `CREATE INDEX idx_cost_layers_remaining ON inventory_cost_layers(inventory_id, quantity_remaining)`
- label_batches.idx_label_batches_status: `CREATE INDEX idx_label_batches_status ON label_batches(status)`
- label_batches.idx_label_batches_user: `CREATE INDEX idx_label_batches_user ON label_batches(user_id)`
- listing_engagement.idx_engagement_created: `CREATE INDEX idx_engagement_created ON listing_engagement(created_at)`
- listing_engagement.idx_engagement_listing: `CREATE INDEX idx_engagement_listing ON listing_engagement(listing_id)`
- listing_engagement.idx_engagement_platform: `CREATE INDEX idx_engagement_platform ON listing_engagement(platform)`
- listing_engagement.idx_engagement_time: `CREATE INDEX idx_engagement_time ON listing_engagement(hour_of_day, day_of_week)`
- listing_engagement.idx_engagement_type: `CREATE INDEX idx_engagement_type ON listing_engagement(event_type)`
- listing_engagement.idx_engagement_user: `CREATE INDEX idx_engagement_user ON listing_engagement(user_id)`
- listing_refresh_history.idx_listing_refresh_history_action: `CREATE INDEX idx_listing_refresh_history_action ON listing_refresh_history(action)`
- listing_refresh_history.idx_listing_refresh_history_created: `CREATE INDEX idx_listing_refresh_history_created ON listing_refresh_history(created_at)`
- listing_refresh_history.idx_listing_refresh_history_listing: `CREATE INDEX idx_listing_refresh_history_listing ON listing_refresh_history(listing_id)`
- listing_refresh_history.idx_listing_refresh_history_user: `CREATE INDEX idx_listing_refresh_history_user ON listing_refresh_history(user_id)`
- listing_templates.idx_listing_templates_favorite: `CREATE INDEX idx_listing_templates_favorite ON listing_templates(user_id, is_favorite)`
- listing_templates.idx_listing_templates_user: `CREATE INDEX idx_listing_templates_user ON listing_templates(user_id)`
- listings.idx_listings_folder_id: `CREATE INDEX idx_listings_folder_id ON listings(folder_id)`
- listings.idx_listings_inventory_id: `CREATE INDEX idx_listings_inventory_id ON listings(inventory_id)`
- listings.idx_listings_inventory_platform: `CREATE INDEX idx_listings_inventory_platform
ON listings(inventory_id, platform)`
- listings.idx_listings_platform: `CREATE INDEX idx_listings_platform ON listings(platform)`
- listings.idx_listings_status: `CREATE INDEX idx_listings_status ON listings(status)`
- listings.idx_listings_user_id: `CREATE INDEX idx_listings_user_id ON listings(user_id)`
- listings.idx_listings_user_status: `CREATE INDEX idx_listings_user_status ON listings(user_id, status)`
- listings_folders.idx_listings_folders_user: `CREATE INDEX idx_listings_folders_user ON listings_folders(user_id)`
- market_insights.idx_market_insights_category: `CREATE INDEX idx_market_insights_category ON market_insights(category)`
- market_insights.idx_market_insights_opportunity: `CREATE INDEX idx_market_insights_opportunity ON market_insights(opportunity_score)`
- market_insights.idx_market_insights_platform: `CREATE INDEX idx_market_insights_platform ON market_insights(platform)`
- mfa_events.idx_mfa_events_type: `CREATE INDEX idx_mfa_events_type ON mfa_events(event_type)`
- mfa_events.idx_mfa_events_user: `CREATE INDEX idx_mfa_events_user ON mfa_events(user_id)`
- notifications.idx_notifications_is_read: `CREATE INDEX idx_notifications_is_read ON notifications(is_read)`
- notifications.idx_notifications_user_created: `CREATE INDEX idx_notifications_user_created
ON notifications(user_id, created_at)`
- notifications.idx_notifications_user_id: `CREATE INDEX idx_notifications_user_id ON notifications(user_id)`
- notifications.idx_notifications_user_unread: `CREATE INDEX idx_notifications_user_unread
ON notifications(user_id, is_read)`
- notion_field_mappings.idx_notion_field_mappings_user: `CREATE INDEX idx_notion_field_mappings_user ON notion_field_mappings(user_id, entity_type)`
- notion_settings.idx_notion_settings_user: `CREATE INDEX idx_notion_settings_user ON notion_settings(user_id)`
- notion_sync_conflicts.idx_notion_sync_conflicts_user: `CREATE INDEX idx_notion_sync_conflicts_user ON notion_sync_conflicts(user_id, resolved)`
- notion_sync_history.idx_notion_sync_history_user: `CREATE INDEX idx_notion_sync_history_user ON notion_sync_history(user_id, started_at DESC)`
- notion_sync_map.idx_notion_sync_map_entity: `CREATE INDEX idx_notion_sync_map_entity ON notion_sync_map(entity_type, local_id)`
- notion_sync_map.idx_notion_sync_map_notion: `CREATE INDEX idx_notion_sync_map_notion ON notion_sync_map(notion_page_id)`
- notion_sync_map.idx_notion_sync_map_status: `CREATE INDEX idx_notion_sync_map_status ON notion_sync_map(sync_status)`
- notion_sync_map.idx_notion_sync_map_user: `CREATE INDEX idx_notion_sync_map_user ON notion_sync_map(user_id)`
- oauth_states.idx_oauth_states_expiry: `CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at)`
- oauth_states.idx_oauth_states_token: `CREATE INDEX idx_oauth_states_token ON oauth_states(state_token)`
- offers.idx_offers_listing_id: `CREATE INDEX idx_offers_listing_id ON offers(listing_id)`
- offers.idx_offers_status: `CREATE INDEX idx_offers_status ON offers(status)`
- offers.idx_offers_user_id: `CREATE INDEX idx_offers_user_id ON offers(user_id)`
- offline_sync_queue.idx_offline_sync_queue_user: `CREATE INDEX idx_offline_sync_queue_user ON offline_sync_queue(user_id)`
- onboarding_progress.idx_onboarding_progress_user: `CREATE INDEX idx_onboarding_progress_user ON onboarding_progress(user_id)`
- orders.idx_orders_created: `CREATE INDEX idx_orders_created ON orders(created_at)`
- orders.idx_orders_platform: `CREATE INDEX idx_orders_platform ON orders(platform)`
- orders.idx_orders_status: `CREATE INDEX idx_orders_status ON orders(status)`
- orders.idx_orders_user: `CREATE INDEX idx_orders_user ON orders(user_id)`
- orders.idx_orders_user_status: `CREATE INDEX idx_orders_user_status ON orders(user_id, status)`
- password_resets.idx_password_resets_token: `CREATE INDEX idx_password_resets_token ON password_resets(token)`
- password_resets.idx_password_resets_user: `CREATE INDEX idx_password_resets_user ON password_resets(user_id)`
- plan_usage.idx_plan_usage_user: `CREATE INDEX idx_plan_usage_user ON plan_usage(user_id)`
- price_history.idx_price_history_inventory: `CREATE INDEX idx_price_history_inventory ON price_history(inventory_id)`
- price_history.idx_price_history_user: `CREATE INDEX idx_price_history_user ON price_history(user_id)`
- price_predictions.idx_predictions_expires: `CREATE INDEX idx_predictions_expires ON price_predictions(expires_at)`
- price_predictions.idx_predictions_inventory: `CREATE INDEX idx_predictions_inventory ON price_predictions(inventory_id)`
- price_predictions.idx_predictions_recommendation: `CREATE INDEX idx_predictions_recommendation ON price_predictions(recommendation)`
- price_predictions.idx_predictions_user: `CREATE INDEX idx_predictions_user ON price_predictions(user_id)`
- price_tracking.idx_price_tracking_platform: `CREATE INDEX idx_price_tracking_platform ON price_tracking(platform)`
- price_tracking.idx_price_tracking_user: `CREATE INDEX idx_price_tracking_user ON price_tracking(user_id)`
- purchase_items.idx_purchase_items_inventory: `CREATE INDEX idx_purchase_items_inventory ON purchase_items(inventory_id)`
- purchase_items.idx_purchase_items_purchase: `CREATE INDEX idx_purchase_items_purchase ON purchase_items(purchase_id)`
- purchases.idx_purchases_date: `CREATE INDEX idx_purchases_date ON purchases(purchase_date)`
- purchases.idx_purchases_status: `CREATE INDEX idx_purchases_status ON purchases(status)`
- purchases.idx_purchases_user: `CREATE INDEX idx_purchases_user ON purchases(user_id)`
- purchases.idx_purchases_vendor: `CREATE INDEX idx_purchases_vendor ON purchases(vendor_name)`
- push_devices.idx_push_devices_user: `CREATE INDEX idx_push_devices_user ON push_devices(user_id)`
- push_notification_log.idx_push_log_user: `CREATE INDEX idx_push_log_user ON push_notification_log(user_id, created_at DESC)`
- push_subscriptions.idx_push_subscriptions_active: `CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active)`
- push_subscriptions.idx_push_subscriptions_endpoint: `CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint)`
- push_subscriptions.idx_push_subscriptions_user: `CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id)`
- qr_analytics.idx_qr_analytics_user: `CREATE INDEX idx_qr_analytics_user ON qr_analytics(user_id)`
- receipt_vendors.idx_receipt_vendors_name: `CREATE INDEX idx_receipt_vendors_name ON receipt_vendors(user_id, name)`
- receipt_vendors.idx_receipt_vendors_user: `CREATE INDEX idx_receipt_vendors_user ON receipt_vendors(user_id)`
- recurring_transaction_templates.idx_recurring_templates_user: `CREATE INDEX idx_recurring_templates_user ON recurring_transaction_templates(user_id)`
- relisting_performance.idx_relisting_performance_listing: `CREATE INDEX idx_relisting_performance_listing ON relisting_performance(listing_id)`
- relisting_performance.idx_relisting_performance_user: `CREATE INDEX idx_relisting_performance_user ON relisting_performance(user_id)`
- relisting_queue.idx_relisting_queue_listing: `CREATE INDEX idx_relisting_queue_listing ON relisting_queue(listing_id)`
- relisting_queue.idx_relisting_queue_scheduled: `CREATE INDEX idx_relisting_queue_scheduled ON relisting_queue(scheduled_at)`
- relisting_queue.idx_relisting_queue_status: `CREATE INDEX idx_relisting_queue_status ON relisting_queue(status)`
- relisting_queue.idx_relisting_queue_user: `CREATE INDEX idx_relisting_queue_user ON relisting_queue(user_id)`
- relisting_rules.idx_relisting_rules_active: `CREATE INDEX idx_relisting_rules_active ON relisting_rules(user_id, is_active)`
- relisting_rules.idx_relisting_rules_user: `CREATE INDEX idx_relisting_rules_user ON relisting_rules(user_id)`
- request_logs.idx_request_logs_created_at: `CREATE INDEX idx_request_logs_created_at ON request_logs(created_at)`
- request_logs.idx_request_logs_path: `CREATE INDEX idx_request_logs_path ON request_logs(path)`
- request_logs.idx_request_logs_status_code: `CREATE INDEX idx_request_logs_status_code ON request_logs(status_code)`
- request_logs.idx_request_logs_user_id: `CREATE INDEX idx_request_logs_user_id ON request_logs(user_id)`
- return_addresses.idx_return_addresses_user: `CREATE INDEX idx_return_addresses_user ON return_addresses(user_id)`
- roadmap_features.idx_roadmap_features_status: `CREATE INDEX idx_roadmap_features_status ON roadmap_features(status)`
- roadmap_votes.idx_roadmap_votes_feature: `CREATE INDEX idx_roadmap_votes_feature ON roadmap_votes(feature_id)`
- roadmap_votes.idx_roadmap_votes_user: `CREATE INDEX idx_roadmap_votes_user ON roadmap_votes(user_id)`
- rum_metrics.idx_rum_metrics_name: `CREATE INDEX idx_rum_metrics_name ON rum_metrics(metric_name)`
- rum_metrics.idx_rum_metrics_session: `CREATE INDEX idx_rum_metrics_session ON rum_metrics(session_id)`
- rum_metrics.idx_rum_metrics_timestamp: `CREATE INDEX idx_rum_metrics_timestamp ON rum_metrics(timestamp)`
- rum_metrics.idx_rum_metrics_user: `CREATE INDEX idx_rum_metrics_user ON rum_metrics(user_id)`
- sales.idx_sales_created_at: `CREATE INDEX idx_sales_created_at ON sales(created_at)`
- sales.idx_sales_platform: `CREATE INDEX idx_sales_platform ON sales(platform)`
- sales.idx_sales_status: `CREATE INDEX idx_sales_status ON sales(status)`
- sales.idx_sales_user_created: `CREATE INDEX idx_sales_user_created ON sales(user_id, created_at DESC)`
- sales.idx_sales_user_id: `CREATE INDEX idx_sales_user_id ON sales(user_id)`
- sales_tax_nexus.idx_sales_tax_nexus_user: `CREATE INDEX idx_sales_tax_nexus_user ON sales_tax_nexus(user_id)`
- saved_reports.idx_saved_reports_user: `CREATE INDEX idx_saved_reports_user ON saved_reports(user_id)`
- scraped_products.idx_scraped_products_imported: `CREATE INDEX idx_scraped_products_imported ON scraped_products(imported_to_inventory, user_id)`
- scraped_products.idx_scraped_products_user: `CREATE INDEX idx_scraped_products_user ON scraped_products(user_id)`
- search_analytics.idx_search_analytics_user: `CREATE INDEX idx_search_analytics_user ON search_analytics(user_id)`
- security_logs.idx_security_logs_created_at: `CREATE INDEX idx_security_logs_created_at ON security_logs(created_at)`
- security_logs.idx_security_logs_event_type: `CREATE INDEX idx_security_logs_event_type ON security_logs(event_type)`
- security_logs.idx_security_logs_ip_or_user: `CREATE INDEX idx_security_logs_ip_or_user ON security_logs(ip_or_user)`
- sessions.idx_sessions_refresh_token: `CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token)`
- sessions.idx_sessions_user_id: `CREATE INDEX idx_sessions_user_id ON sessions(user_id)`
- shipping_labels.idx_shipping_labels_batch: `CREATE INDEX idx_shipping_labels_batch ON shipping_labels(batch_id)`
- shipping_labels.idx_shipping_labels_order: `CREATE INDEX idx_shipping_labels_order ON shipping_labels(order_id)`
- shipping_labels.idx_shipping_labels_status: `CREATE INDEX idx_shipping_labels_status ON shipping_labels(status)`
- shipping_labels.idx_shipping_labels_tracking: `CREATE INDEX idx_shipping_labels_tracking ON shipping_labels(tracking_number)`
- shipping_labels.idx_shipping_labels_user: `CREATE INDEX idx_shipping_labels_user ON shipping_labels(user_id)`
- shipping_profiles.idx_shipping_profiles_default: `CREATE INDEX idx_shipping_profiles_default ON shipping_profiles(user_id, is_default)`
- shipping_profiles.idx_shipping_profiles_user: `CREATE INDEX idx_shipping_profiles_user ON shipping_profiles(user_id)`
- shipping_rates.idx_shipping_rates_label: `CREATE INDEX idx_shipping_rates_label ON shipping_rates(label_id)`
- shops.idx_shops_platform: `CREATE INDEX idx_shops_platform ON shops(platform)`
- shops.idx_shops_token_refresh: `CREATE INDEX idx_shops_token_refresh
ON shops(connection_type, is_connected, oauth_token_expires_at)`
- shops.idx_shops_user_id: `CREATE INDEX idx_shops_user_id ON shops(user_id)`
- sku_platform_links.idx_sku_platform_links_sku: `CREATE INDEX idx_sku_platform_links_sku ON sku_platform_links(master_sku)`
- sku_platform_links.idx_sku_platform_links_user: `CREATE INDEX idx_sku_platform_links_user ON sku_platform_links(user_id)`
- sku_rules.idx_sku_rules_default: `CREATE INDEX idx_sku_rules_default ON sku_rules(user_id, is_default)`
- sku_rules.idx_sku_rules_user: `CREATE INDEX idx_sku_rules_user ON sku_rules(user_id)`
- stream_staging.idx_stream_staging_user: `CREATE INDEX idx_stream_staging_user ON stream_staging(user_id)`
- supplier_items.idx_supplier_items_alert: `CREATE INDEX idx_supplier_items_alert ON supplier_items(alert_enabled)`
- supplier_items.idx_supplier_items_supplier: `CREATE INDEX idx_supplier_items_supplier ON supplier_items(supplier_id)`
- supplier_items.idx_supplier_items_user: `CREATE INDEX idx_supplier_items_user ON supplier_items(user_id)`
- supplier_price_history.idx_price_history_date: `CREATE INDEX idx_price_history_date ON supplier_price_history(recorded_at)`
- supplier_price_history.idx_price_history_item: `CREATE INDEX idx_price_history_item ON supplier_price_history(supplier_item_id)`
- suppliers.idx_suppliers_active: `CREATE INDEX idx_suppliers_active ON suppliers(is_active)`
- suppliers.idx_suppliers_type: `CREATE INDEX idx_suppliers_type ON suppliers(type)`
- suppliers.idx_suppliers_user: `CREATE INDEX idx_suppliers_user ON suppliers(user_id)`
- support_ticket_replies.idx_support_ticket_replies_ticket: `CREATE INDEX idx_support_ticket_replies_ticket ON support_ticket_replies(ticket_id)`
- support_tickets.idx_support_tickets_status: `CREATE INDEX idx_support_tickets_status ON support_tickets(status)`
- support_tickets.idx_support_tickets_user: `CREATE INDEX idx_support_tickets_user ON support_tickets(user_id)`
- sustainability_log.idx_sustainability_log_category: `CREATE INDEX idx_sustainability_log_category ON sustainability_log(category)`
- sustainability_log.idx_sustainability_log_created_at: `CREATE INDEX idx_sustainability_log_created_at ON sustainability_log(created_at)`
- sustainability_log.idx_sustainability_log_user_id: `CREATE INDEX idx_sustainability_log_user_id ON sustainability_log(user_id)`
- sync_queue.idx_sync_queue_status: `CREATE INDEX idx_sync_queue_status ON sync_queue(status)`
- task_queue.idx_task_queue_status_scheduled: `CREATE INDEX idx_task_queue_status_scheduled
ON task_queue(status, scheduled_at)`
- tasks.idx_tasks_scheduled_at: `CREATE INDEX idx_tasks_scheduled_at ON tasks(scheduled_at)`
- tasks.idx_tasks_status: `CREATE INDEX idx_tasks_status ON tasks(status)`
- team_activity_log.idx_team_activity_created: `CREATE INDEX idx_team_activity_created ON team_activity_log(created_at DESC)`
- team_activity_log.idx_team_activity_team: `CREATE INDEX idx_team_activity_team ON team_activity_log(team_id)`
- team_activity_log.idx_team_activity_user: `CREATE INDEX idx_team_activity_user ON team_activity_log(user_id)`
- team_invitations.idx_team_invitations_email: `CREATE INDEX idx_team_invitations_email ON team_invitations(email)`
- team_invitations.idx_team_invitations_status: `CREATE INDEX idx_team_invitations_status ON team_invitations(status)`
- team_invitations.idx_team_invitations_team: `CREATE INDEX idx_team_invitations_team ON team_invitations(team_id)`
- team_invitations.idx_team_invitations_token: `CREATE INDEX idx_team_invitations_token ON team_invitations(token)`
- team_members.idx_team_members_team: `CREATE INDEX idx_team_members_team ON team_members(team_id)`
- team_members.idx_team_members_user: `CREATE INDEX idx_team_members_user ON team_members(user_id)`
- teams.idx_teams_created: `CREATE INDEX idx_teams_created ON teams(created_at DESC)`
- teams.idx_teams_owner: `CREATE INDEX idx_teams_owner ON teams(owner_user_id)`
- tos_acceptances.idx_tos_acceptances_user: `CREATE INDEX idx_tos_acceptances_user ON tos_acceptances(user_id)`
- transaction_attachments.idx_tx_attachments_transaction: `CREATE INDEX idx_tx_attachments_transaction ON transaction_attachments(transaction_id)`
- transaction_audit_log.idx_tx_audit_transaction: `CREATE INDEX idx_tx_audit_transaction ON transaction_audit_log(transaction_id)`
- transaction_audit_log.idx_tx_audit_user: `CREATE INDEX idx_tx_audit_user ON transaction_audit_log(user_id)`
- user_webhooks.idx_webhooks_user: `CREATE INDEX idx_webhooks_user ON user_webhooks(user_id, is_active)`
- users.idx_users_email: `CREATE INDEX idx_users_email ON users(email)`
- users.idx_users_username: `CREATE INDEX idx_users_username ON users(username)`
- verification_tokens.idx_verification_tokens_token: `CREATE INDEX idx_verification_tokens_token ON verification_tokens(token)`
- verification_tokens.idx_verification_tokens_type: `CREATE INDEX idx_verification_tokens_type ON verification_tokens(type)`
- verification_tokens.idx_verification_tokens_user: `CREATE INDEX idx_verification_tokens_user ON verification_tokens(user_id)`
- warehouse_bins.idx_warehouse_bins_user: `CREATE INDEX idx_warehouse_bins_user ON warehouse_bins(user_id)`
- warehouse_locations.idx_warehouse_locations_name: `CREATE INDEX idx_warehouse_locations_name ON warehouse_locations(name)`
- warehouse_locations.idx_warehouse_locations_user: `CREATE INDEX idx_warehouse_locations_user ON warehouse_locations(user_id)`
- watermark_presets.idx_watermark_presets_user: `CREATE INDEX idx_watermark_presets_user ON watermark_presets(user_id)`
- webhook_deliveries.idx_webhook_deliveries: `CREATE INDEX idx_webhook_deliveries ON webhook_deliveries(webhook_id, created_at DESC)`
- webhook_endpoints.idx_webhook_endpoints_enabled: `CREATE INDEX idx_webhook_endpoints_enabled ON webhook_endpoints(is_enabled)`
- webhook_endpoints.idx_webhook_endpoints_user: `CREATE INDEX idx_webhook_endpoints_user ON webhook_endpoints(user_id)`
- webhook_events.idx_webhook_events_source: `CREATE INDEX idx_webhook_events_source ON webhook_events(source)`
- webhook_events.idx_webhook_events_status: `CREATE INDEX idx_webhook_events_status ON webhook_events(status)`
- webhook_events.idx_webhook_events_type: `CREATE INDEX idx_webhook_events_type ON webhook_events(event_type)`
- webhook_events.idx_webhook_events_user: `CREATE INDEX idx_webhook_events_user ON webhook_events(user_id)`
- whatnot_cohosts.idx_whatnot_cohosts_event: `CREATE INDEX idx_whatnot_cohosts_event ON whatnot_cohosts(event_id)`
- whatnot_event_items.idx_whatnot_event_items_event: `CREATE INDEX idx_whatnot_event_items_event ON whatnot_event_items(event_id)`
- whatnot_events.idx_whatnot_events_status: `CREATE INDEX idx_whatnot_events_status ON whatnot_events(status)`
- whatnot_events.idx_whatnot_events_user: `CREATE INDEX idx_whatnot_events_user ON whatnot_events(user_id)`

Table count: 183
Index count: 336