-- Migration 017: Add Checklists
-- Daily tasks with recurring intervals

CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    checklist_id TEXT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    due_date DATE,
    recurring_interval TEXT DEFAULT 'once',
    last_completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON checklist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_due_date ON checklist_items(due_date);

-- DOWN: DROP INDEX IF EXISTS idx_checklist_items_user;
-- DOWN: DROP INDEX IF EXISTS idx_checklist_items_checklist;
-- DOWN: DROP INDEX IF EXISTS idx_checklist_items_due_date;
-- DOWN: DROP TABLE IF EXISTS checklist_items;
-- DOWN: DROP TABLE IF EXISTS checklists;
