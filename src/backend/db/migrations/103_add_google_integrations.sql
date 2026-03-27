-- Migration 103: Google Drive + Google Calendar OAuth token storage
-- Shared google_tokens table keyed by (user_id, scope)
-- Scopes: 'drive' | 'calendar' | 'drive_and_calendar'
-- Tokens are AES-256-GCM encrypted before storage

CREATE TABLE IF NOT EXISTS google_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK(scope IN ('drive', 'calendar', 'drive_and_calendar')),
    email TEXT,
    oauth_token TEXT,            -- encrypted access token
    oauth_refresh_token TEXT,    -- encrypted refresh token
    oauth_token_expires_at TEXT,
    is_connected INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, scope),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_google_tokens_user ON google_tokens(user_id, scope);

-- State tokens for CSRF protection during the OAuth redirect flow
CREATE TABLE IF NOT EXISTS google_oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_google_oauth_states_token ON google_oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_google_oauth_states_expires ON google_oauth_states(expires_at);
