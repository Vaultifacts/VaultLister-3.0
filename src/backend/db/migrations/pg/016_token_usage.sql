-- Migration 016: token_usage table for per-user AI budget tracking
-- Tracks cumulative token consumption per user per provider per calendar month.
-- period format: YYYY-MM (e.g. '2026-04')

CREATE TABLE IF NOT EXISTS token_usage (
    id          SERIAL PRIMARY KEY,
    user_id     TEXT        NOT NULL,
    provider    TEXT        NOT NULL CHECK (provider IN ('anthropic', 'openai', 'grok')),
    period      TEXT        NOT NULL,  -- YYYY-MM
    input_tokens  BIGINT    NOT NULL DEFAULT 0,
    output_tokens BIGINT    NOT NULL DEFAULT 0,
    total_tokens  BIGINT    NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT token_usage_user_provider_period_key UNIQUE (user_id, provider, period)
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_period ON token_usage (user_id, period);
