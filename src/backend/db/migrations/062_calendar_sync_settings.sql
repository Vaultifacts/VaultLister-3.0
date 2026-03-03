-- Calendar Sync Settings
-- Stores user preferences for Google Calendar / Outlook / iCal sync

CREATE TABLE IF NOT EXISTS calendar_sync_settings (
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
);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_user ON calendar_sync_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_sync_user_provider ON calendar_sync_settings(user_id, provider);
