-- Migration 088: Add automation A/B testing (experiments)

CREATE TABLE IF NOT EXISTS automation_experiments (
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
);

CREATE INDEX IF NOT EXISTS idx_experiments_user ON automation_experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON automation_experiments(status);
