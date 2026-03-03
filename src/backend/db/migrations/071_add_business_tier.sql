-- No-op: schema.sql already includes 'business' in subscription_tier CHECK constraint.
-- Original migration did ALTER TABLE users RENAME TO users_old + rebuild, which caused
-- SQLite to auto-update all 113 FK references to point to users_old, corrupting them.
-- Keeping this file so the migration runner marks it as "applied" without side effects.
SELECT 1;
