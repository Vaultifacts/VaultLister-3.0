-- Fix listings_folders.user_id type from INTEGER to TEXT
-- Original schema declared INTEGER but users.id is TEXT (UUIDs)
-- SQLite INTEGER affinity coerces UUID strings to 0, making all folders cross-user

CREATE TABLE IF NOT EXISTS listings_folders_new (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO listings_folders_new (id, user_id, name, color, icon, created_at, updated_at)
    SELECT id, CAST(user_id AS TEXT), name, color, icon, created_at, updated_at
    FROM listings_folders;

DROP TABLE IF EXISTS listings_folders;
ALTER TABLE listings_folders_new RENAME TO listings_folders;

CREATE INDEX IF NOT EXISTS idx_listings_folders_user ON listings_folders(user_id);

-- DOWN: DROP INDEX IF EXISTS idx_listings_folders_user;
-- DOWN: DROP TABLE IF EXISTS listings_folders_new;
-- DOWN: -- (includes data migration — manual data rollback required)
