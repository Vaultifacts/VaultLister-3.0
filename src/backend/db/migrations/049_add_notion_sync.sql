-- Migration 049: Add Notion Integration Support
-- Enables bidirectional sync with Notion databases

-- User's Notion settings and connection info
CREATE TABLE IF NOT EXISTS notion_settings (
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
);

-- Mapping between VaultLister entities and Notion pages
-- Tracks which local items are linked to which Notion pages
CREATE TABLE IF NOT EXISTS notion_sync_map (
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
);

-- Custom field mappings (allows users to customize how fields are mapped)
CREATE TABLE IF NOT EXISTS notion_field_mappings (
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
);

-- Sync history for audit trail and debugging
CREATE TABLE IF NOT EXISTS notion_sync_history (
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
);

-- Conflict queue for manual resolution
CREATE TABLE IF NOT EXISTS notion_sync_conflicts (
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
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notion_settings_user ON notion_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_user ON notion_sync_map(user_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_entity ON notion_sync_map(entity_type, local_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_notion ON notion_sync_map(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_map_status ON notion_sync_map(sync_status);
CREATE INDEX IF NOT EXISTS idx_notion_field_mappings_user ON notion_field_mappings(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_notion_sync_history_user ON notion_sync_history(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_notion_sync_conflicts_user ON notion_sync_conflicts(user_id, resolved);
