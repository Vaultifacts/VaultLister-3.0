-- SKU Rules table for pattern-based SKU generation
-- Session 17: SKU Rules Builder feature

CREATE TABLE IF NOT EXISTS sku_rules (
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
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_sku_rules_user ON sku_rules(user_id);

-- Index for finding default rules
CREATE INDEX IF NOT EXISTS idx_sku_rules_default ON sku_rules(user_id, is_default);

-- DOWN: DROP INDEX IF EXISTS idx_sku_rules_user;
-- DOWN: DROP INDEX IF EXISTS idx_sku_rules_default;
-- DOWN: DROP TABLE IF EXISTS sku_rules;
