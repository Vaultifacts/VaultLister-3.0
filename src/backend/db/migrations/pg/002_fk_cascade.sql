-- Migration: Add ON DELETE CASCADE to foreign keys missing cascade behaviour
-- Issue #320: Add ON DELETE CASCADE to 10 foreign keys
-- Uses IF EXISTS guards for idempotency

-- ============================================================
-- listings → inventory (currently no CASCADE)
-- ============================================================
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_inventory_id_fkey;
ALTER TABLE listings
    ADD CONSTRAINT listings_inventory_id_fkey
    FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL;

-- listings → user (currently no CASCADE)
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_user_id_fkey;
ALTER TABLE listings
    ADD CONSTRAINT listings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- sales → listings (currently ON DELETE SET NULL — promote to CASCADE)
-- sales → inventory (currently ON DELETE SET NULL — keep SET NULL; losing inventory ≠ losing sale record)
-- ============================================================
-- sales.listing_id: keep SET NULL (sale record should survive listing deletion)
-- Already defined correctly in schema — no change needed.

-- ============================================================
-- image_edit_history → image_bank (already CASCADE in schema)
-- image_bank_usage → image_bank (already CASCADE in schema)
-- ============================================================

-- ============================================================
-- automation_logs → automation_rules (currently ON DELETE SET NULL)
-- Promote to CASCADE: logs are child records of the rule.
-- ============================================================
ALTER TABLE automation_logs DROP CONSTRAINT IF EXISTS automation_logs_rule_id_fkey;
ALTER TABLE automation_logs
    ADD CONSTRAINT automation_logs_rule_id_fkey
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE;

-- ============================================================
-- listing_templates → users (currently CASCADE — confirm; re-add if missing)
-- ============================================================
ALTER TABLE listing_templates DROP CONSTRAINT IF EXISTS listing_templates_user_id_fkey;
ALTER TABLE listing_templates
    ADD CONSTRAINT listing_templates_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- batch_photo_items → batch_photo_jobs (already CASCADE)
-- batch_photo_presets → users (already CASCADE)
-- ============================================================

-- ============================================================
-- chat_messages → chat_conversations (already CASCADE)
-- ============================================================

-- ============================================================
-- tasks → users (currently ON DELETE CASCADE — already correct)
-- ============================================================

-- ============================================================
-- notifications → users (already CASCADE in schema)
-- ============================================================

-- ============================================================
-- password_resets → users (currently no CASCADE action)
-- ============================================================
ALTER TABLE password_resets DROP CONSTRAINT IF EXISTS password_resets_user_id_fkey;
ALTER TABLE password_resets
    ADD CONSTRAINT password_resets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- email_verifications → users (currently no CASCADE action)
-- ============================================================
ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_user_id_fkey;
ALTER TABLE email_verifications
    ADD CONSTRAINT email_verifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================
-- security_logs → users (currently ON DELETE SET NULL — keep; audit trail must survive user deletion)
-- ============================================================

-- ============================================================
-- request_logs → users (currently ON DELETE SET NULL — keep)
-- ============================================================

-- ============================================================
-- error_logs → users (currently ON DELETE SET NULL — keep)
-- ============================================================

-- ============================================================
-- analytics_snapshots → users (already CASCADE)
-- user_preferences → users (already CASCADE)
-- ============================================================

-- ============================================================
-- image_bank_folders → users (already CASCADE)
-- image_bank → users (already CASCADE)
-- ============================================================

-- ============================================================
-- community_posts → users (already CASCADE)
-- community_replies → users (already CASCADE)
-- ============================================================
