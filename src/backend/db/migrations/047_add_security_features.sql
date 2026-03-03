-- Security Features Migration
-- Adds email verification and MFA support

-- Add email verification columns to users
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified_at DATETIME;

-- Add MFA columns to users
ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN mfa_secret TEXT;
ALTER TABLE users ADD COLUMN mfa_backup_codes TEXT;  -- JSON array of hashed backup codes

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email_verification', 'password_reset', 'mfa_setup', 'mfa_login')),
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_type ON verification_tokens(type);

-- MFA recovery codes table (for audit trail)
CREATE TABLE IF NOT EXISTS mfa_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('enabled', 'disabled', 'verified', 'backup_used', 'failed')),
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mfa_events_user ON mfa_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_events_type ON mfa_events(event_type);
