-- Custom Reports Builder
CREATE TABLE IF NOT EXISTS custom_reports (
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
);

CREATE INDEX IF NOT EXISTS idx_custom_reports_user ON custom_reports(user_id);

-- DOWN: DROP INDEX IF EXISTS idx_custom_reports_user;
-- DOWN: DROP TABLE IF EXISTS custom_reports;
