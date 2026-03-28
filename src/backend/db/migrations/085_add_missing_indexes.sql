-- Add missing indexes for sustainability_log, alerts, and collaborations tables
-- These tables were created without indexes on commonly queried columns

-- sustainability_log indexes
CREATE INDEX IF NOT EXISTS idx_sustainability_log_user_id ON sustainability_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sustainability_log_created_at ON sustainability_log(created_at);
CREATE INDEX IF NOT EXISTS idx_sustainability_log_category ON sustainability_log(category);

-- alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

-- collaborations indexes
CREATE INDEX IF NOT EXISTS idx_collaborations_user_id ON collaborations(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborations_status ON collaborations(status);
CREATE INDEX IF NOT EXISTS idx_collaborations_type ON collaborations(type);

-- DOWN: DROP INDEX IF EXISTS idx_sustainability_log_user_id;
-- DOWN: DROP INDEX IF EXISTS idx_sustainability_log_created_at;
-- DOWN: DROP INDEX IF EXISTS idx_sustainability_log_category;
-- DOWN: DROP INDEX IF EXISTS idx_alerts_type;
-- DOWN: DROP INDEX IF EXISTS idx_alerts_created_at;
-- DOWN: DROP INDEX IF EXISTS idx_alerts_acknowledged;
-- DOWN: DROP INDEX IF EXISTS idx_collaborations_user_id;
-- DOWN: DROP INDEX IF EXISTS idx_collaborations_status;
-- DOWN: DROP INDEX IF EXISTS idx_collaborations_type;
