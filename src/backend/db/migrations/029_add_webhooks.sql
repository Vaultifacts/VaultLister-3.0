-- Migration: Add webhook support
-- Tables for user webhook endpoints and incoming events

-- Webhook endpoints registered by users
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]', -- JSON array of subscribed event types
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_triggered_at TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Incoming webhook events (received from platforms)
CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    endpoint_id TEXT REFERENCES webhook_endpoints(id) ON DELETE SET NULL,
    source TEXT NOT NULL, -- 'ebay', 'poshmark', 'internal', etc.
    event_type TEXT NOT NULL, -- 'listing.sold', 'order.created', etc.
    payload TEXT NOT NULL DEFAULT '{}', -- JSON payload
    signature TEXT, -- HMAC signature for verification
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed
    processed_at TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user ON webhook_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_enabled ON webhook_endpoints(is_enabled);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user ON webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
