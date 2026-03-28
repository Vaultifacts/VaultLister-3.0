-- Custom metrics for analytics
CREATE TABLE IF NOT EXISTS custom_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    metric_a TEXT NOT NULL,
    operation TEXT NOT NULL DEFAULT 'divide',
    metric_b TEXT NOT NULL,
    display_format TEXT NOT NULL DEFAULT 'number',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Analytics email digest preferences
CREATE TABLE IF NOT EXISTS analytics_digests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    email TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Checklist sharing/assignment
CREATE TABLE IF NOT EXISTS checklist_shares (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    shared_with TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DOWN: DROP TABLE IF EXISTS checklist_shares;
-- DOWN: DROP TABLE IF EXISTS analytics_digests;
-- DOWN: DROP TABLE IF EXISTS custom_metrics;
