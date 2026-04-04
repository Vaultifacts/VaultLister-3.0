-- Migration 095: Add user_preferences table
-- Stores per-user key/value settings (e.g. notification prefs, UI settings)

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(key);

-- DOWN: DROP INDEX IF EXISTS idx_user_preferences_user_id;
-- DOWN: DROP INDEX IF EXISTS idx_user_preferences_key;
-- DOWN: DROP TABLE IF EXISTS user_preferences;
