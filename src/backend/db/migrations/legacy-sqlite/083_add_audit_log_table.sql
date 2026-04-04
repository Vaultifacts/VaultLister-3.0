-- Audit logs table (from services/auditLog.js)
-- Service defines migration SQL as export but it was never applied

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    metadata TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at DESC);

-- DOWN: DROP INDEX IF EXISTS idx_audit_user;
-- DOWN: DROP INDEX IF EXISTS idx_audit_category;
-- DOWN: DROP INDEX IF EXISTS idx_audit_severity;
-- DOWN: DROP INDEX IF EXISTS idx_audit_action;
-- DOWN: DROP INDEX IF EXISTS idx_audit_resource;
-- DOWN: DROP INDEX IF EXISTS idx_audit_date;
-- DOWN: DROP TABLE IF EXISTS audit_logs;
