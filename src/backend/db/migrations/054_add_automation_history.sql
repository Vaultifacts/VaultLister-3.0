-- Add automation run history table
-- Migration 054: Track automation execution history with success/failure logs

CREATE TABLE IF NOT EXISTS automation_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    automation_id TEXT NOT NULL,
    automation_name TEXT NOT NULL,
    automation_type TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'skipped')),
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    duration_ms INTEGER,
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    result_message TEXT,
    error_message TEXT,
    error_code TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON automation_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status);
CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON automation_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user_started ON automation_runs(user_id, started_at DESC);

-- DOWN: DROP INDEX IF EXISTS idx_automation_runs_user;
-- DOWN: DROP INDEX IF EXISTS idx_automation_runs_automation;
-- DOWN: DROP INDEX IF EXISTS idx_automation_runs_status;
-- DOWN: DROP INDEX IF EXISTS idx_automation_runs_started;
-- DOWN: DROP INDEX IF EXISTS idx_automation_runs_user_started;
-- DOWN: DROP TABLE IF EXISTS automation_runs;
