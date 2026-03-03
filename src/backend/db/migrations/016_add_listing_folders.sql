-- Migration 016: Add Listing Folders
-- Allows users to organize listings into folders

-- Create listing folders table
CREATE TABLE IF NOT EXISTS listings_folders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listings_folders_user ON listings_folders(user_id);

-- Add folder_id to listings table
ALTER TABLE listings ADD COLUMN folder_id TEXT REFERENCES listings_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_folder ON listings(folder_id);
