-- Push notification devices
CREATE TABLE IF NOT EXISTS push_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_token ON push_devices(token);

-- Notification preferences
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Push notification log
CREATE TABLE IF NOT EXISTS push_notification_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    channel TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_notification_log(user_id, created_at DESC);
