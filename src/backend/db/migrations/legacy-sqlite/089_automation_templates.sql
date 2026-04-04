-- Migration 089: Add automation template marketplace

CREATE TABLE IF NOT EXISTS automation_templates (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    platform TEXT DEFAULT 'all',
    schedule TEXT,
    conditions TEXT DEFAULT '{}',
    actions TEXT DEFAULT '{}',
    description TEXT,
    tags TEXT DEFAULT '[]',
    is_public INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS automation_template_installs (
    template_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (template_id, user_id),
    FOREIGN KEY (template_id) REFERENCES automation_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_author ON automation_templates(author_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON automation_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_template_installs_user ON automation_template_installs(user_id);

-- DOWN: DROP INDEX IF EXISTS idx_templates_author;
-- DOWN: DROP INDEX IF EXISTS idx_templates_public;
-- DOWN: DROP INDEX IF EXISTS idx_template_installs_user;
-- DOWN: DROP TABLE IF EXISTS automation_template_installs;
-- DOWN: DROP TABLE IF EXISTS automation_templates;
