-- Image Bank Migration
-- Adds tables for centralized image storage, organization, and editing

-- Image Bank folders/collections
CREATE TABLE IF NOT EXISTS image_bank_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES image_bank_folders(id) ON DELETE CASCADE
);

-- Image Bank - centralized image library
CREATE TABLE IF NOT EXISTS image_bank (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_id TEXT,

    -- File information
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,

    -- Image metadata
    width INTEGER,
    height INTEGER,
    aspect_ratio REAL,
    dominant_color TEXT,

    -- Organization
    title TEXT,
    description TEXT,
    tags TEXT DEFAULT '[]', -- JSON array

    -- AI analysis results (from Claude Vision)
    ai_analysis TEXT DEFAULT '{}', -- JSON object with brand, category, etc.

    -- Usage tracking
    used_count INTEGER DEFAULT 0,
    last_used_at DATETIME,

    -- Relationships
    source_inventory_id TEXT, -- If imported from inventory item

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES image_bank_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (source_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- Link images to inventory items (many-to-many)
CREATE TABLE IF NOT EXISTS image_bank_usage (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    position INTEGER DEFAULT 0, -- Order in listing
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE CASCADE,
    UNIQUE(image_id, inventory_id)
);

-- Image edit history (for tracking edits)
CREATE TABLE IF NOT EXISTS image_edit_history (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    edit_type TEXT NOT NULL, -- 'crop', 'filter', 'bg_remove', etc.
    parameters TEXT, -- JSON with edit settings
    original_path TEXT,
    edited_path TEXT NOT NULL,
    cloudinary_public_id TEXT, -- If using Cloudinary
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_image_bank_user ON image_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_folder ON image_bank(folder_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_created ON image_bank(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_bank_usage_image ON image_bank_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_usage_inventory ON image_bank_usage(inventory_id);
CREATE INDEX IF NOT EXISTS idx_folders_user ON image_bank_folders(user_id);

-- Full-text search for image bank
CREATE VIRTUAL TABLE IF NOT EXISTS image_bank_fts USING fts5(
    id,
    title,
    description,
    tags,
    content='image_bank',
    content_rowid='rowid'
);

-- FTS triggers for automatic sync
CREATE TRIGGER IF NOT EXISTS image_bank_ai AFTER INSERT ON image_bank BEGIN
    INSERT INTO image_bank_fts(rowid, id, title, description, tags)
    VALUES (new.rowid, new.id, new.title, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS image_bank_au AFTER UPDATE ON image_bank BEGIN
    DELETE FROM image_bank_fts WHERE rowid = old.rowid;
    INSERT INTO image_bank_fts(rowid, id, title, description, tags)
    VALUES (new.rowid, new.id, new.title, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS image_bank_ad AFTER DELETE ON image_bank BEGIN
    DELETE FROM image_bank_fts WHERE rowid = old.rowid;
END;

-- DOWN: DROP TRIGGER IF EXISTS image_bank_ai;
-- DOWN: DROP TRIGGER IF EXISTS image_bank_au;
-- DOWN: DROP TRIGGER IF EXISTS image_bank_ad;
-- DOWN: DROP INDEX IF EXISTS idx_image_bank_user;
-- DOWN: DROP INDEX IF EXISTS idx_image_bank_folder;
-- DOWN: DROP INDEX IF EXISTS idx_image_bank_created;
-- DOWN: DROP INDEX IF EXISTS idx_image_bank_usage_image;
-- DOWN: DROP INDEX IF EXISTS idx_image_bank_usage_inventory;
-- DOWN: DROP INDEX IF EXISTS idx_folders_user;
-- DOWN: DROP TABLE IF EXISTS image_bank_fts;
-- DOWN: DROP TABLE IF EXISTS image_edit_history;
-- DOWN: DROP TABLE IF EXISTS image_bank_usage;
-- DOWN: DROP TABLE IF EXISTS image_bank;
-- DOWN: DROP TABLE IF EXISTS image_bank_folders;
