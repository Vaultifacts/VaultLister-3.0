-- Migration: Add GDPR tables for account deletion and data export requests

-- Account deletion requests table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'cancelled', 'failed')),
    reason TEXT,
    scheduled_for DATETIME NOT NULL,
    reminder_sent INTEGER DEFAULT 0,
    error TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Data export requests table
CREATE TABLE IF NOT EXISTS data_export_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    export_data TEXT,
    error TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_deletion_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_deletion_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_scheduled ON account_deletion_requests(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_data_export_status ON data_export_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id);
