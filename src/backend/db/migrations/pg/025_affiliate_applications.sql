CREATE TABLE IF NOT EXISTS affiliate_applications (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    website     TEXT,
    audience_size TEXT,
    promotion_plan TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    ip          TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_email ON affiliate_applications(email);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON affiliate_applications(status);
