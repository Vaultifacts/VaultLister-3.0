-- Add is_admin column to users table.
-- SQLite does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so the
-- migration runner's duplicate-column catch block handles the case where the
-- column already exists.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
