-- Migration 011: Add ON DELETE CASCADE / SET NULL to foreign keys missing cascade behavior
-- Fixes GDPR compliance gap: user deletion now cascades to all user-owned data
-- Uses IF EXISTS guards so this is safe to re-run

DO $$
BEGIN
    -- listings.user_id → CASCADE (user deleted = listings deleted)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'listings_user_id_fkey' AND table_name = 'listings'
    ) THEN
        ALTER TABLE listings DROP CONSTRAINT listings_user_id_fkey;
    END IF;
    ALTER TABLE listings ADD CONSTRAINT listings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- listings.inventory_id → SET NULL (listing can outlive its inventory item)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'listings_inventory_id_fkey' AND table_name = 'listings'
    ) THEN
        ALTER TABLE listings DROP CONSTRAINT listings_inventory_id_fkey;
    END IF;
    ALTER TABLE listings ADD CONSTRAINT listings_inventory_id_fkey
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL;

    -- password_resets.user_id → CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'password_resets_user_id_fkey' AND table_name = 'password_resets'
    ) THEN
        ALTER TABLE password_resets DROP CONSTRAINT password_resets_user_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_resets') THEN
        ALTER TABLE password_resets ADD CONSTRAINT password_resets_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- email_verifications.user_id → CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'email_verifications_user_id_fkey' AND table_name = 'email_verifications'
    ) THEN
        ALTER TABLE email_verifications DROP CONSTRAINT email_verifications_user_id_fkey;
    END IF;
    ALTER TABLE email_verifications ADD CONSTRAINT email_verifications_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- whatnot_events.user_id → CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'whatnot_events_user_id_fkey' AND table_name = 'whatnot_events'
    ) THEN
        ALTER TABLE whatnot_events DROP CONSTRAINT whatnot_events_user_id_fkey;
    END IF;
    ALTER TABLE whatnot_events ADD CONSTRAINT whatnot_events_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- whatnot_event_items.event_id → CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'whatnot_event_items_event_id_fkey' AND table_name = 'whatnot_event_items'
    ) THEN
        ALTER TABLE whatnot_event_items DROP CONSTRAINT whatnot_event_items_event_id_fkey;
    END IF;
    ALTER TABLE whatnot_event_items ADD CONSTRAINT whatnot_event_items_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES whatnot_events(id) ON DELETE CASCADE;

    -- whatnot_event_items.inventory_id → SET NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'whatnot_event_items_inventory_id_fkey' AND table_name = 'whatnot_event_items'
    ) THEN
        ALTER TABLE whatnot_event_items DROP CONSTRAINT whatnot_event_items_inventory_id_fkey;
    END IF;
    ALTER TABLE whatnot_event_items ADD CONSTRAINT whatnot_event_items_inventory_id_fkey
        FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL;

    -- custom_reports.user_id → CASCADE
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'custom_reports_user_id_fkey' AND table_name = 'custom_reports'
    ) THEN
        ALTER TABLE custom_reports DROP CONSTRAINT custom_reports_user_id_fkey;
    END IF;
    ALTER TABLE custom_reports ADD CONSTRAINT custom_reports_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

    -- tos_acceptances.tos_version_id → SET NULL (acceptance record survives version removal)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tos_acceptances_tos_version_id_fkey' AND table_name = 'tos_acceptances'
    ) THEN
        ALTER TABLE tos_acceptances DROP CONSTRAINT tos_acceptances_tos_version_id_fkey;
    END IF;
    -- tos_version_id must become nullable to allow SET NULL
    ALTER TABLE tos_acceptances ALTER COLUMN tos_version_id DROP NOT NULL;
    ALTER TABLE tos_acceptances ADD CONSTRAINT tos_acceptances_tos_version_id_fkey
        FOREIGN KEY (tos_version_id) REFERENCES tos_versions(id) ON DELETE SET NULL;

    -- affiliate_referrals.tier_id → SET NULL (referral record survives tier removal)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'affiliate_referrals_tier_id_fkey' AND table_name = 'affiliate_referrals'
    ) THEN
        ALTER TABLE affiliate_referrals DROP CONSTRAINT affiliate_referrals_tier_id_fkey;
    END IF;
    ALTER TABLE affiliate_referrals ADD CONSTRAINT affiliate_referrals_tier_id_fkey
        FOREIGN KEY (tier_id) REFERENCES affiliate_tiers(id) ON DELETE SET NULL;

END $$;
