-- Uptime samples for per-platform status page (status.html).
-- Populated hourly by uptimeProbeWorker; queried by GET /api/health/platforms.

CREATE TABLE IF NOT EXISTS platform_uptime_samples (
    id           SERIAL PRIMARY KEY,
    platform_id  TEXT        NOT NULL,
    kind         TEXT        NOT NULL CHECK (kind IN ('market', 'vl')),
    sampled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_up        BOOLEAN     NOT NULL,
    latency_ms   INTEGER,
    error_text   TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_uptime_samples_lookup
    ON platform_uptime_samples (platform_id, kind, sampled_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_uptime_samples_recent
    ON platform_uptime_samples (sampled_at DESC);
