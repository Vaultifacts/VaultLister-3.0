-- Fix users_old: migration 071 renamed users→users_old and created a new users table,
-- but SQLite auto-updated all FK references in 117 child tables to point to users_old.
-- This means all inserts into child tables (sessions, inventory, etc.) now fail
-- because they reference users_old but new users are inserted into users.
--
-- Fix: merge the 3 users created after migration 071 back into users_old,
-- drop the new users table, then rename users_old back to users so SQLite
-- auto-updates all 117 FK references from users_old → users.

PRAGMA foreign_keys = OFF;

-- Step 1: Copy any users from the new 'users' table that aren't in users_old
INSERT OR IGNORE INTO users_old (
    id, email, password_hash, username, full_name, avatar_url,
    subscription_tier, subscription_expires_at, timezone, locale,
    created_at, updated_at, last_login_at, is_active, preferences,
    onboarding_completed, email_verified, email_verified_at,
    mfa_enabled, mfa_secret, mfa_backup_codes
)
SELECT
    id, email, password_hash, username, full_name, avatar_url,
    subscription_tier, subscription_expires_at, timezone, locale,
    created_at, updated_at, last_login_at, is_active, preferences,
    onboarding_completed, email_verified, email_verified_at,
    mfa_enabled, mfa_secret, mfa_backup_codes
FROM users
WHERE id NOT IN (SELECT id FROM users_old);

-- Step 2: Drop the new users table created by migration 071
DROP TABLE IF EXISTS users;

-- Step 3: Rename users_old back to users
-- SQLite 3.26+ automatically updates all FK references in child tables
-- from users_old → users when this rename executes
ALTER TABLE users_old RENAME TO users;

-- Step 4: Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

PRAGMA foreign_keys = ON;

-- DOWN: DROP INDEX IF EXISTS idx_users_email;
-- DOWN: DROP INDEX IF EXISTS idx_users_username;
-- DOWN: DROP INDEX IF EXISTS idx_users_subscription_tier;
-- DOWN: DROP INDEX IF EXISTS idx_users_email_active;
-- DOWN: DROP INDEX IF EXISTS idx_users_last_login;
-- DOWN: -- (includes data migration — manual data rollback required)
