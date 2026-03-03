-- Migration: Add deleted_at column to inventory table
-- Purpose: Enable Recently Deleted feature with 30-day soft delete
-- Date: 2026-01-21

-- Add deleted_at column to track when items were soft deleted
ALTER TABLE inventory ADD COLUMN deleted_at DATETIME;

-- Create index for efficiently querying recently deleted items
CREATE INDEX IF NOT EXISTS idx_inventory_deleted_at ON inventory(deleted_at);

-- Update existing 'deleted' items to have a deleted_at timestamp
UPDATE inventory
SET deleted_at = updated_at
WHERE status = 'deleted' AND deleted_at IS NULL;
