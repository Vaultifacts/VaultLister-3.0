-- Automation rule version history
CREATE TABLE IF NOT EXISTS automation_rule_versions (
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
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_rule ON automation_rule_versions(rule_id, version DESC);
