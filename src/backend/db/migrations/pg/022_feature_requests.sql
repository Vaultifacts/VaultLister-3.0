-- Public feature requests board (2026-04-18)
-- Visitors can submit feature requests and vote on them (one vote per IP).

CREATE TABLE IF NOT EXISTS feature_requests (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    submitter_name TEXT,
    submitter_email TEXT,
    submitter_ip TEXT,
    status TEXT NOT NULL DEFAULT 'under_consideration',
    vote_count INTEGER NOT NULL DEFAULT 0,
    hidden BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_request_votes (
    id TEXT PRIMARY KEY,
    feature_request_id TEXT NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    voter_ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(feature_request_id, voter_ip)
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_votes ON feature_requests(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created ON feature_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_request_votes_lookup ON feature_request_votes(feature_request_id, voter_ip);
