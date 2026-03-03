-- Monitoring and Alerting Tables
-- Created: 2026-02-02

-- Error logs table for tracking application errors
CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    message TEXT,
    stack TEXT,
    context TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);

-- Alerts table for tracking system alerts
-- Note: existing table may have 'type' instead of 'alert_type'
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged INTEGER DEFAULT 0,
    acknowledged_at DATETIME,
    acknowledged_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

-- Health check history
CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    checks TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_health_checks_created ON health_checks(created_at);

-- Cleanup old records (keep 30 days of error logs, 90 days of alerts)
-- This should be run periodically via a scheduled task
