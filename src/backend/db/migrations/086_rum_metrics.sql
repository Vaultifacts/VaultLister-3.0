-- Real User Monitoring (RUM) metrics storage
CREATE TABLE IF NOT EXISTS rum_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    page_url TEXT,
    user_agent TEXT,
    connection_type TEXT,
    timestamp TEXT DEFAULT (datetime('now')),
    metadata TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_rum_metrics_session ON rum_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_name ON rum_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_timestamp ON rum_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_user ON rum_metrics(user_id);
