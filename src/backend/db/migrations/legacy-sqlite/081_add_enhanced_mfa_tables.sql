-- Enhanced MFA: WebAuthn credentials, backup codes, SMS codes, phone columns
-- Migration from services/enhancedMFA.js

-- WebAuthn credentials
CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    sign_count INTEGER DEFAULT 0,
    device_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);

-- Backup codes
CREATE TABLE IF NOT EXISTS backup_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    batch_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user ON backup_codes(user_id, used_at);

-- SMS verification codes
CREATE TABLE IF NOT EXISTS sms_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_codes(user_id, expires_at);

-- TOTP secrets (referenced by getMFAStatus)
CREATE TABLE IF NOT EXISTS totp_secrets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    secret TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_totp_user ON totp_secrets(user_id);

-- DOWN: DROP INDEX IF EXISTS idx_webauthn_user;
-- DOWN: DROP INDEX IF EXISTS idx_backup_codes_user;
-- DOWN: DROP INDEX IF EXISTS idx_sms_codes_user;
-- DOWN: DROP INDEX IF EXISTS idx_totp_user;
-- DOWN: DROP TABLE IF EXISTS totp_secrets;
-- DOWN: DROP TABLE IF EXISTS sms_codes;
-- DOWN: DROP TABLE IF EXISTS backup_codes;
-- DOWN: DROP TABLE IF EXISTS webauthn_credentials;
