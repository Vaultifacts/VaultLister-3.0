-- Service tables that were defined in service files but never migrated
-- Covers: outgoing webhooks, email marketing

-- Outgoing Webhooks (from services/outgoingWebhooks.js)
CREATE TABLE IF NOT EXISTS user_webhooks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    headers TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON user_webhooks(user_id, is_active);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL,
    status_code INTEGER,
    response_body TEXT,
    attempt INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries(webhook_id, created_at DESC);

-- Email Marketing (from services/emailMarketing.js)
CREATE TABLE IF NOT EXISTS email_queue (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    data TEXT,
    scheduled_for TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);

CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    template_key TEXT NOT NULL,
    subject TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id, created_at DESC);

-- User consents for email marketing opt-in
CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    consent_type TEXT NOT NULL DEFAULT 'email_marketing',
    granted INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_consents ON user_consents(user_id, consent_type);

-- Email unsubscribes
CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    unsubscribed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_unsub ON email_unsubscribes(email);
