-- Migration: Add categorization rules table
-- Allows users to set up auto-categorization for transactions

CREATE TABLE IF NOT EXISTS categorization_rules (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    pattern TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_user ON categorization_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_pattern ON categorization_rules(pattern);

-- DOWN: DROP INDEX IF EXISTS idx_categorization_rules_user;
-- DOWN: DROP INDEX IF EXISTS idx_categorization_rules_pattern;
-- DOWN: DROP TABLE IF EXISTS categorization_rules;
