-- Migration 025: OAuth Token Refresh Tracking Enhancements
-- Adds tables and columns for automatic token refresh scheduling and error tracking

-- Create task_queue table for background job processing
CREATE TABLE IF NOT EXISTS task_queue (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table for user alerts
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_queue_status_scheduled
ON task_queue(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at);

-- DOWN: DROP INDEX IF EXISTS idx_task_queue_status_scheduled;
-- DOWN: DROP INDEX IF EXISTS idx_notifications_user_unread;
-- DOWN: DROP INDEX IF EXISTS idx_notifications_user_created;
-- DOWN: DROP TABLE IF EXISTS notifications;
-- DOWN: DROP TABLE IF EXISTS task_queue;
