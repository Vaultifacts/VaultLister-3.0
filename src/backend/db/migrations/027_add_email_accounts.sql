-- Migration 027: Email Accounts for Receipt Fetching
-- Adds table for storing connected email accounts (Gmail, Outlook)

-- Email accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email_address TEXT NOT NULL,
    provider TEXT NOT NULL,  -- 'gmail' or 'outlook'
    oauth_token TEXT,        -- encrypted access token
    oauth_refresh_token TEXT, -- encrypted refresh token
    oauth_token_expires_at DATETIME,
    last_sync_at DATETIME,
    last_message_id TEXT,    -- Track last fetched email for pagination
    sync_status TEXT DEFAULT 'idle',  -- idle, syncing, error
    consecutive_failures INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at DATETIME,
    is_enabled INTEGER DEFAULT 1,
    filter_senders TEXT DEFAULT '[]',  -- JSON array of sender patterns to match
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, email_address),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for finding enabled accounts to poll
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_enabled
ON email_accounts(user_id, is_enabled);

-- Index for polling worker queries
CREATE INDEX IF NOT EXISTS idx_email_accounts_sync
ON email_accounts(is_enabled, sync_status, last_sync_at);

-- OAuth states for email providers (reuse pattern from shops)
CREATE TABLE IF NOT EXISTS email_oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for state token lookup
CREATE INDEX IF NOT EXISTS idx_email_oauth_states_token
ON email_oauth_states(state_token);

-- Cleanup expired states automatically (states expire after 10 minutes)
CREATE INDEX IF NOT EXISTS idx_email_oauth_states_expires
ON email_oauth_states(expires_at);
