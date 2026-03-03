-- Migration 004: Add OAuth fields to shops and create oauth_states table
-- This migration adds OAuth 2.0 authentication support for platform connections

-- Add OAuth columns to existing shops table
ALTER TABLE shops ADD COLUMN oauth_provider TEXT;
ALTER TABLE shops ADD COLUMN oauth_token TEXT;
ALTER TABLE shops ADD COLUMN oauth_refresh_token TEXT;
ALTER TABLE shops ADD COLUMN oauth_token_expires_at DATETIME;
ALTER TABLE shops ADD COLUMN oauth_scopes TEXT;
ALTER TABLE shops ADD COLUMN connection_type TEXT DEFAULT 'manual';

-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS oauth_states (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    state_token TEXT NOT NULL UNIQUE,
    redirect_uri TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    used INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for efficient state token lookup
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);
