-- Add Calendar Events Table
-- Tracks user calendar events for listings, orders, and automations

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    type TEXT CHECK(type IN ('listing', 'order', 'automation', 'reminder', 'custom')),
    color TEXT DEFAULT '#6366f1',
    related_id TEXT,
    related_type TEXT CHECK(related_type IN ('inventory', 'listing', 'order', 'automation', NULL)),
    all_day INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_calendar_type ON calendar_events(type);
