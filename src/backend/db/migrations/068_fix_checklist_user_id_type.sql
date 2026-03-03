-- Migration 068: Fix checklists user_id type from INTEGER to TEXT
-- users.id is TEXT (UUID), so foreign key type must match

-- Fix checklists table
ALTER TABLE checklists RENAME TO checklists_old;

CREATE TABLE checklists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO checklists SELECT * FROM checklists_old;
DROP TABLE checklists_old;

-- Fix checklist_items table
ALTER TABLE checklist_items RENAME TO checklist_items_old;

CREATE TABLE checklist_items (
    id TEXT PRIMARY KEY,
    checklist_id TEXT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    due_date DATE,
    recurring_interval TEXT DEFAULT 'once',
    last_completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT DEFAULT '',
    attachments TEXT DEFAULT '[]',
    FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO checklist_items SELECT * FROM checklist_items_old;
DROP TABLE checklist_items_old;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON checklist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_due_date ON checklist_items(due_date);
CREATE INDEX IF NOT EXISTS idx_checklist_items_priority ON checklist_items(priority);
CREATE INDEX IF NOT EXISTS idx_checklist_items_completed ON checklist_items(completed);
