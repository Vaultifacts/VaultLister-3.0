-- Migration 024: Add Batch Photo Processing
-- Enables batch transformations on multiple images via Cloudinary

-- Batch photo processing jobs
CREATE TABLE IF NOT EXISTS batch_photo_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,                           -- Optional job name
    total_images INTEGER NOT NULL,
    processed_images INTEGER DEFAULT 0,
    failed_images INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    transformations TEXT NOT NULL,       -- JSON: {removeBackground, enhance, upscale, cropWidth, cropHeight}
    preset_id TEXT,                      -- Optional link to saved preset
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Individual image processing within a batch
CREATE TABLE IF NOT EXISTS batch_photo_items (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    image_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    original_url TEXT,
    result_url TEXT,
    cloudinary_public_id TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (job_id) REFERENCES batch_photo_jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (image_id) REFERENCES image_bank(id) ON DELETE CASCADE
);

-- Saved presets for quick reuse
CREATE TABLE IF NOT EXISTS batch_photo_presets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    transformations TEXT NOT NULL,       -- JSON: {removeBackground, enhance, upscale, cropWidth, cropHeight}
    is_default INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user ON batch_photo_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_photo_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_items_job ON batch_photo_items(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON batch_photo_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_presets_user ON batch_photo_presets(user_id);
