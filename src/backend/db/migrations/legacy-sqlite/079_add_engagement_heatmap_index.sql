-- Migration: Add composite index for heatmap aggregation query performance
CREATE INDEX IF NOT EXISTS idx_engagement_user_event_time ON listing_engagement(user_id, event_time);

-- DOWN: DROP INDEX IF EXISTS idx_engagement_user_event_time;
