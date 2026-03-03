-- Migration: 036_duplicate_detections
-- Description: Add duplicate item detection system
-- Created: 2026-01-29

-- Duplicate detections table
CREATE TABLE IF NOT EXISTS duplicate_detections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    primary_item_id TEXT NOT NULL,
    duplicate_item_id TEXT NOT NULL,
    detection_type TEXT NOT NULL CHECK (detection_type IN ('sku_match', 'hash_match', 'title_brand_size', 'exact_title')),
    confidence_score REAL NOT NULL DEFAULT 0.0,
    user_action TEXT DEFAULT 'pending' CHECK (user_action IN ('pending', 'confirmed', 'ignored')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (primary_item_id) REFERENCES inventory(id) ON DELETE CASCADE,
    FOREIGN KEY (duplicate_item_id) REFERENCES inventory(id) ON DELETE CASCADE
);

-- Indexes for efficient duplicate queries
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_user_id ON duplicate_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_primary_item ON duplicate_detections(primary_item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_duplicate_item ON duplicate_detections(duplicate_item_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_user_action ON duplicate_detections(user_id, user_action);
CREATE INDEX IF NOT EXISTS idx_duplicate_detections_created ON duplicate_detections(created_at DESC);

-- Unique constraint to prevent duplicate detection records
CREATE UNIQUE INDEX IF NOT EXISTS idx_duplicate_detections_unique_pair
ON duplicate_detections(user_id, primary_item_id, duplicate_item_id);
