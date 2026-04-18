-- Incident email subscriptions (audit finding #39).
-- Allows visitors to subscribe to incident notifications via status.html.

CREATE TABLE IF NOT EXISTS incident_subscriptions (
    id            SERIAL PRIMARY KEY,
    email         TEXT        NOT NULL,
    confirmed     BOOLEAN     NOT NULL DEFAULT FALSE,
    confirm_token TEXT        UNIQUE,
    unsubscribe_token TEXT    UNIQUE NOT NULL,
    platform_id   TEXT,  -- NULL = subscribe to all platforms; specific id = just that one
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at  TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    CONSTRAINT incident_subscriptions_email_len CHECK (length(email) <= 320),
    CONSTRAINT incident_subscriptions_platform_check
        CHECK (platform_id IS NULL OR platform_id IN ('ebay','shopify','poshmark','depop','facebook','whatnot','_self'))
);

-- One pending subscription per email per platform scope (allows re-subscribing after unsubscribing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_subscriptions_active
    ON incident_subscriptions (email, COALESCE(platform_id, ''))
    WHERE unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_incident_subscriptions_confirmed
    ON incident_subscriptions (confirmed, unsubscribed_at)
    WHERE confirmed = TRUE AND unsubscribed_at IS NULL;
