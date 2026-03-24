-- Migration: Add csrf_tokens table
-- Purpose: B-09 — replace in-memory CSRF token Map with DB-backed store
--          Survives server restarts; compatible with future multi-instance deploys
-- Date: 2026-03-23

CREATE TABLE IF NOT EXISTS csrf_tokens (
    token      TEXT    PRIMARY KEY,
    session_id TEXT    NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session_id ON csrf_tokens(session_id);
