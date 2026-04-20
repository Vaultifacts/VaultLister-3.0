-- Manually-authored incidents surfaced on status.html per platform.
-- The uptime probe can auto-raise generic "reachability degraded" strings, but
-- humans write titled incidents here with optional postmortem URLs.

CREATE TABLE IF NOT EXISTS platform_incidents (
    id              SERIAL PRIMARY KEY,
    platform_id     TEXT        NOT NULL,
    kind            TEXT        NOT NULL CHECK (kind IN ('market', 'vl')),
    title           TEXT        NOT NULL,
    body            TEXT,
    status          TEXT        NOT NULL DEFAULT 'investigating'
                                  CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    severity        TEXT        NOT NULL DEFAULT 'minor'
                                  CHECK (severity IN ('minor', 'major', 'critical')),
    postmortem_url  TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_incidents_lookup
    ON platform_incidents (platform_id, kind, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_incidents_open
    ON platform_incidents (platform_id, kind)
    WHERE resolved_at IS NULL;
