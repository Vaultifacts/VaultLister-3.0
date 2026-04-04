-- Migration: 040_inventory_import
-- Description: Add inventory import from spreadsheets tracking
-- Created: 2026-01-29

-- Import jobs table
CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('csv', 'excel', 'tsv', 'json')),
    original_filename TEXT,
    file_size INTEGER,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'mapping', 'validating', 'importing', 'completed', 'failed', 'cancelled')),

    -- Field mapping (JSON)
    -- Format: { "title": "Product Name", "brand": "Brand", "price": "List Price", ... }
    field_mapping TEXT,

    -- Import settings
    has_header_row INTEGER DEFAULT 1,
    skip_rows INTEGER DEFAULT 0,
    date_format TEXT DEFAULT 'MM/DD/YYYY',
    decimal_separator TEXT DEFAULT '.',
    update_existing INTEGER DEFAULT 0,          -- Update if SKU matches
    skip_duplicates INTEGER DEFAULT 1,          -- Skip if duplicate detected

    -- Stats
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    imported_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    duplicate_rows INTEGER DEFAULT 0,

    -- Error tracking
    errors TEXT,                                -- JSON array of errors

    -- Preview data (first 5 rows for mapping UI)
    preview_data TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);

-- Import row results (for detailed error tracking)
CREATE TABLE IF NOT EXISTS import_rows (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'updated', 'skipped', 'failed', 'duplicate')),

    -- Original data
    raw_data TEXT,                              -- JSON of original row

    -- Parsed data
    parsed_data TEXT,                           -- JSON of parsed/mapped data

    -- Result
    inventory_id TEXT,                          -- Created/updated inventory item ID
    error_message TEXT,
    validation_errors TEXT,                     -- JSON array of field-level errors

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);

-- Saved field mappings (reusable templates)
CREATE TABLE IF NOT EXISTS import_mappings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Source info
    source_type TEXT,
    source_name TEXT,                           -- e.g., "Poshmark Export", "eBay CSV"

    -- Mapping configuration (JSON)
    field_mapping TEXT NOT NULL,

    -- Settings
    has_header_row INTEGER DEFAULT 1,
    skip_rows INTEGER DEFAULT 0,
    date_format TEXT DEFAULT 'MM/DD/YYYY',

    is_default INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_rows_job ON import_rows(job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON import_rows(status);
CREATE INDEX IF NOT EXISTS idx_import_mappings_user ON import_mappings(user_id);

-- DOWN: DROP INDEX IF EXISTS idx_import_jobs_user;
-- DOWN: DROP INDEX IF EXISTS idx_import_jobs_status;
-- DOWN: DROP INDEX IF EXISTS idx_import_rows_job;
-- DOWN: DROP INDEX IF EXISTS idx_import_rows_status;
-- DOWN: DROP INDEX IF EXISTS idx_import_mappings_user;
-- DOWN: DROP TABLE IF EXISTS import_mappings;
-- DOWN: DROP TABLE IF EXISTS import_rows;
-- DOWN: DROP TABLE IF EXISTS import_jobs;
