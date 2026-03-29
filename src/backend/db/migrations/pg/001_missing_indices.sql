-- Migration: Add missing database indices for query performance
-- Issue #171: Add missing database indices to 22 tables
-- Uses CREATE INDEX IF NOT EXISTS for idempotency

-- ============================================================
-- sessions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_valid ON sessions(is_valid) WHERE is_valid = 1;

-- ============================================================
-- shops
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_platform ON shops(platform);
CREATE INDEX IF NOT EXISTS idx_shops_user_platform ON shops(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_shops_sync_status ON shops(sync_status);

-- ============================================================
-- inventory
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_user_status_date ON inventory(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_search_vector ON inventory USING GIN(search_vector);

-- ============================================================
-- listings
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_inventory_id ON listings(inventory_id);
CREATE INDEX IF NOT EXISTS idx_listings_folder_id ON listings(folder_id);
CREATE INDEX IF NOT EXISTS idx_listings_platform ON listings(platform);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_user_status_date ON listings(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_deleted_at ON listings(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- listings_folders
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_listings_folders_user_id ON listings_folders(user_id);

-- ============================================================
-- sales
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_listing_id ON sales(listing_id);
CREATE INDEX IF NOT EXISTS idx_sales_inventory_id ON sales(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_platform ON sales(platform);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_user_platform_date ON sales(user_id, platform, created_at DESC);

-- ============================================================
-- listing_templates
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_listing_templates_user_id ON listing_templates(user_id);

-- ============================================================
-- offers
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_offers_user_id ON offers(user_id);
CREATE INDEX IF NOT EXISTS idx_offers_listing_id ON offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_platform ON offers(platform);
CREATE INDEX IF NOT EXISTS idx_offers_deleted_at ON offers(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- automation_rules
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_enabled ON automation_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_next_run_at ON automation_rules(next_run_at) WHERE is_enabled = 1;
CREATE INDEX IF NOT EXISTS idx_automation_rules_platform ON automation_rules(platform);

-- ============================================================
-- automation_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_id ON automation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);

-- ============================================================
-- tasks
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks(scheduled_at) WHERE status = 'pending';

-- ============================================================
-- notifications
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_date ON notifications(user_id, is_read, created_at DESC);

-- ============================================================
-- security_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);

-- ============================================================
-- oauth_states
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state_token ON oauth_states(state_token);

-- ============================================================
-- verification_tokens
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);

-- ============================================================
-- mfa_events
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_mfa_events_user_id ON mfa_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_events_created_at ON mfa_events(created_at DESC);

-- ============================================================
-- password_resets / email_verifications
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- ============================================================
-- webauthn_credentials / backup_codes / sms_codes / totp_secrets
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_user_id ON sms_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_codes_expires_at ON sms_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_totp_secrets_user_id ON totp_secrets(user_id);

-- ============================================================
-- oauth_accounts
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);

-- ============================================================
-- csrf_tokens
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_session_id ON csrf_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires_at ON csrf_tokens(expires_at);

-- ============================================================
-- request_logs / error_logs / audit_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_request_logs_user_id ON request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_status_code ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- analytics_events / analytics_snapshots
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user_id ON analytics_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(date DESC);

-- ============================================================
-- rum_metrics
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rum_metrics_user_id ON rum_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_session_id ON rum_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_metric_name ON rum_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_rum_metrics_timestamp ON rum_metrics(timestamp DESC);

-- ============================================================
-- user_preferences
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================================
-- image_bank_folders / image_bank / image_bank_usage
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_image_bank_folders_user_id ON image_bank_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_folders_parent_id ON image_bank_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_user_id ON image_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_folder_id ON image_bank(folder_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_source_inventory_id ON image_bank(source_inventory_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_search_vector ON image_bank USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_image_bank_usage_image_id ON image_bank_usage(image_id);
CREATE INDEX IF NOT EXISTS idx_image_bank_usage_inventory_id ON image_bank_usage(inventory_id);

-- ============================================================
-- batch_photo_jobs / batch_photo_items / batch_photo_presets
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_batch_photo_jobs_user_id ON batch_photo_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_photo_jobs_status ON batch_photo_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_photo_items_job_id ON batch_photo_items(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_photo_items_image_id ON batch_photo_items(image_id);
CREATE INDEX IF NOT EXISTS idx_batch_photo_presets_user_id ON batch_photo_presets(user_id);

-- ============================================================
-- watermark_presets
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_watermark_presets_user_id ON watermark_presets(user_id);

-- ============================================================
-- chat_conversations / chat_messages
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- ============================================================
-- community_posts / community_replies / community_reactions
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_type ON community_posts(type);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_search_vector ON community_posts USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON community_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_user_id ON community_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_user_id ON community_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_target ON community_reactions(target_type, target_id);

-- ============================================================
-- price_history
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_price_history_inventory_id ON price_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_price_history_user_id ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON price_history(changed_at DESC);

-- ============================================================
-- rate_limit_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_endpoint ON rate_limit_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_ip ON rate_limit_logs(ip);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_timestamp ON rate_limit_logs(timestamp DESC);
