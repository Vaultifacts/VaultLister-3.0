-- Migration 006: Allow OAuth users to have no password
-- OAuth users authenticate via provider only; password_hash should be NULL for them.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
