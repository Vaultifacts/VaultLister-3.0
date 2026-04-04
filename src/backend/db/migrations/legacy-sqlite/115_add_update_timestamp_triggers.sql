-- Migration 115: Create update_timestamp() trigger function and apply BEFORE UPDATE
-- triggers to every table that has an updated_at column, including the three audit
-- tables that received updated_at in migration 113.

-- Trigger function — sets NEW.updated_at to the current time on every row update
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper macro: one trigger per table (DROP + CREATE to make migration idempotent)

DROP TRIGGER IF EXISTS trg_users_updated_at                    ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_shops_updated_at                    ON shops;
CREATE TRIGGER trg_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_inventory_updated_at                ON inventory;
CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_listings_folders_updated_at         ON listings_folders;
CREATE TRIGGER trg_listings_folders_updated_at
    BEFORE UPDATE ON listings_folders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_listings_updated_at                 ON listings;
CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_sales_updated_at                    ON sales;
CREATE TRIGGER trg_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_listing_templates_updated_at        ON listing_templates;
CREATE TRIGGER trg_listing_templates_updated_at
    BEFORE UPDATE ON listing_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_offers_updated_at                   ON offers;
CREATE TRIGGER trg_offers_updated_at
    BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_automation_rules_updated_at         ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated_at
    BEFORE UPDATE ON automation_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_oauth_accounts_updated_at           ON oauth_accounts;
CREATE TRIGGER trg_oauth_accounts_updated_at
    BEFORE UPDATE ON oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at         ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at             ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_image_bank_folders_updated_at       ON image_bank_folders;
CREATE TRIGGER trg_image_bank_folders_updated_at
    BEFORE UPDATE ON image_bank_folders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_image_bank_updated_at               ON image_bank;
CREATE TRIGGER trg_image_bank_updated_at
    BEFORE UPDATE ON image_bank
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_batch_photo_presets_updated_at      ON batch_photo_presets;
CREATE TRIGGER trg_batch_photo_presets_updated_at
    BEFORE UPDATE ON batch_photo_presets
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at       ON chat_conversations;
CREATE TRIGGER trg_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_community_posts_updated_at          ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
    BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_community_replies_updated_at        ON community_replies;
CREATE TRIGGER trg_community_replies_updated_at
    BEFORE UPDATE ON community_replies
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_help_faq_updated_at                 ON help_faq;
CREATE TRIGGER trg_help_faq_updated_at
    BEFORE UPDATE ON help_faq
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_help_articles_updated_at            ON help_articles;
CREATE TRIGGER trg_help_articles_updated_at
    BEFORE UPDATE ON help_articles
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at          ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_roadmap_features_updated_at         ON roadmap_features;
CREATE TRIGGER trg_roadmap_features_updated_at
    BEFORE UPDATE ON roadmap_features
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_feedback_submissions_updated_at     ON feedback_submissions;
CREATE TRIGGER trg_feedback_submissions_updated_at
    BEFORE UPDATE ON feedback_submissions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at          ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_calendar_sync_settings_updated_at   ON calendar_sync_settings;
CREATE TRIGGER trg_calendar_sync_settings_updated_at
    BEFORE UPDATE ON calendar_sync_settings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_checklists_updated_at               ON checklists;
CREATE TRIGGER trg_checklists_updated_at
    BEFORE UPDATE ON checklists
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_checklist_items_updated_at          ON checklist_items;
CREATE TRIGGER trg_checklist_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_accounts_updated_at                 ON accounts;
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_purchases_updated_at                ON purchases;
CREATE TRIGGER trg_purchases_updated_at
    BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_financial_transactions_updated_at   ON financial_transactions;
CREATE TRIGGER trg_financial_transactions_updated_at
    BEFORE UPDATE ON financial_transactions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_inventory_cost_layers_updated_at    ON inventory_cost_layers;
CREATE TRIGGER trg_inventory_cost_layers_updated_at
    BEFORE UPDATE ON inventory_cost_layers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_receipt_vendors_updated_at          ON receipt_vendors;
CREATE TRIGGER trg_receipt_vendors_updated_at
    BEFORE UPDATE ON receipt_vendors
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_categorization_rules_updated_at     ON categorization_rules;
CREATE TRIGGER trg_categorization_rules_updated_at
    BEFORE UPDATE ON categorization_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_sales_tax_nexus_updated_at          ON sales_tax_nexus;
CREATE TRIGGER trg_sales_tax_nexus_updated_at
    BEFORE UPDATE ON sales_tax_nexus
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_orders_updated_at                   ON orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_shipping_profiles_updated_at        ON shipping_profiles;
CREATE TRIGGER trg_shipping_profiles_updated_at
    BEFORE UPDATE ON shipping_profiles
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_shipping_labels_updated_at          ON shipping_labels;
CREATE TRIGGER trg_shipping_labels_updated_at
    BEFORE UPDATE ON shipping_labels
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_price_tracking_updated_at           ON price_tracking;
CREATE TRIGGER trg_price_tracking_updated_at
    BEFORE UPDATE ON price_tracking
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_price_predictions_updated_at        ON price_predictions;
CREATE TRIGGER trg_price_predictions_updated_at
    BEFORE UPDATE ON price_predictions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_analytics_digests_updated_at        ON analytics_digests;
CREATE TRIGGER trg_analytics_digests_updated_at
    BEFORE UPDATE ON analytics_digests
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at                ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_supplier_items_updated_at           ON supplier_items;
CREATE TRIGGER trg_supplier_items_updated_at
    BEFORE UPDATE ON supplier_items
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at          ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_competitors_updated_at              ON competitors;
CREATE TRIGGER trg_competitors_updated_at
    BEFORE UPDATE ON competitors
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_competitor_listings_updated_at      ON competitor_listings;
CREATE TRIGGER trg_competitor_listings_updated_at
    BEFORE UPDATE ON competitor_listings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_teams_updated_at                    ON teams;
CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_collaborations_updated_at           ON collaborations;
CREATE TRIGGER trg_collaborations_updated_at
    BEFORE UPDATE ON collaborations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_relisting_rules_updated_at          ON relisting_rules;
CREATE TRIGGER trg_relisting_rules_updated_at
    BEFORE UPDATE ON relisting_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_automation_experiments_updated_at   ON automation_experiments;
CREATE TRIGGER trg_automation_experiments_updated_at
    BEFORE UPDATE ON automation_experiments
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_automation_templates_updated_at     ON automation_templates;
CREATE TRIGGER trg_automation_templates_updated_at
    BEFORE UPDATE ON automation_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_import_mappings_updated_at          ON import_mappings;
CREATE TRIGGER trg_import_mappings_updated_at
    BEFORE UPDATE ON import_mappings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_inventory_categories_updated_at     ON inventory_categories;
CREATE TRIGGER trg_inventory_categories_updated_at
    BEFORE UPDATE ON inventory_categories
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_sku_rules_updated_at                ON sku_rules;
CREATE TRIGGER trg_sku_rules_updated_at
    BEFORE UPDATE ON sku_rules
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_barcode_lookups_updated_at          ON barcode_lookups;
CREATE TRIGGER trg_barcode_lookups_updated_at
    BEFORE UPDATE ON barcode_lookups
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_warehouse_locations_updated_at      ON warehouse_locations;
CREATE TRIGGER trg_warehouse_locations_updated_at
    BEFORE UPDATE ON warehouse_locations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_size_charts_updated_at              ON size_charts;
CREATE TRIGGER trg_size_charts_updated_at
    BEFORE UPDATE ON size_charts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_brand_size_guides_updated_at        ON brand_size_guides;
CREATE TRIGGER trg_brand_size_guides_updated_at
    BEFORE UPDATE ON brand_size_guides
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_whatnot_events_updated_at           ON whatnot_events;
CREATE TRIGGER trg_whatnot_events_updated_at
    BEFORE UPDATE ON whatnot_events
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_custom_reports_updated_at           ON custom_reports;
CREATE TRIGGER trg_custom_reports_updated_at
    BEFORE UPDATE ON custom_reports
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_saved_reports_updated_at            ON saved_reports;
CREATE TRIGGER trg_saved_reports_updated_at
    BEFORE UPDATE ON saved_reports
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_prediction_models_updated_at        ON prediction_models;
CREATE TRIGGER trg_prediction_models_updated_at
    BEFORE UPDATE ON prediction_models
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_webhook_endpoints_updated_at        ON webhook_endpoints;
CREATE TRIGGER trg_webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_user_webhooks_updated_at            ON user_webhooks;
CREATE TRIGGER trg_user_webhooks_updated_at
    BEFORE UPDATE ON user_webhooks
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_email_accounts_updated_at           ON email_accounts;
CREATE TRIGGER trg_email_accounts_updated_at
    BEFORE UPDATE ON email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at       ON push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_push_devices_updated_at             ON push_devices;
CREATE TRIGGER trg_push_devices_updated_at
    BEFORE UPDATE ON push_devices
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_data_export_requests_updated_at     ON data_export_requests;
CREATE TRIGGER trg_data_export_requests_updated_at
    BEFORE UPDATE ON data_export_requests
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_account_deletion_requests_updated_at ON account_deletion_requests;
CREATE TRIGGER trg_account_deletion_requests_updated_at
    BEFORE UPDATE ON account_deletion_requests
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_user_consents_updated_at            ON user_consents;
CREATE TRIGGER trg_user_consents_updated_at
    BEFORE UPDATE ON user_consents
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_cookie_consent_updated_at           ON cookie_consent;
CREATE TRIGGER trg_cookie_consent_updated_at
    BEFORE UPDATE ON cookie_consent
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_affiliate_landing_pages_updated_at  ON affiliate_landing_pages;
CREATE TRIGGER trg_affiliate_landing_pages_updated_at
    BEFORE UPDATE ON affiliate_landing_pages
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_plan_usage_updated_at               ON plan_usage;
CREATE TRIGGER trg_plan_usage_updated_at
    BEFORE UPDATE ON plan_usage
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_task_queue_updated_at               ON task_queue;
CREATE TRIGGER trg_task_queue_updated_at
    BEFORE UPDATE ON task_queue
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_changelog_updated_at                ON changelog;
CREATE TRIGGER trg_changelog_updated_at
    BEFORE UPDATE ON changelog
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_buyer_profiles_updated_at           ON buyer_profiles;
CREATE TRIGGER trg_buyer_profiles_updated_at
    BEFORE UPDATE ON buyer_profiles
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_feature_flags_updated_at            ON feature_flags;
CREATE TRIGGER trg_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notion_settings_updated_at          ON notion_settings;
CREATE TRIGGER trg_notion_settings_updated_at
    BEFORE UPDATE ON notion_settings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notion_sync_map_updated_at          ON notion_sync_map;
CREATE TRIGGER trg_notion_sync_map_updated_at
    BEFORE UPDATE ON notion_sync_map
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_notion_field_mappings_updated_at    ON notion_field_mappings;
CREATE TRIGGER trg_notion_field_mappings_updated_at
    BEFORE UPDATE ON notion_field_mappings
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_google_tokens_updated_at            ON google_tokens;
CREATE TRIGGER trg_google_tokens_updated_at
    BEFORE UPDATE ON google_tokens
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Audit tables that received updated_at via migration 113
DROP TRIGGER IF EXISTS trg_security_logs_updated_at            ON security_logs;
CREATE TRIGGER trg_security_logs_updated_at
    BEFORE UPDATE ON security_logs
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_mfa_events_updated_at               ON mfa_events;
CREATE TRIGGER trg_mfa_events_updated_at
    BEFORE UPDATE ON mfa_events
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trg_health_checks_updated_at            ON health_checks;
CREATE TRIGGER trg_health_checks_updated_at
    BEFORE UPDATE ON health_checks
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- DOWN:
-- DROP TRIGGER IF EXISTS trg_users_updated_at                    ON users;
-- DROP TRIGGER IF EXISTS trg_shops_updated_at                    ON shops;
-- DROP TRIGGER IF EXISTS trg_inventory_updated_at                ON inventory;
-- DROP TRIGGER IF EXISTS trg_listings_folders_updated_at         ON listings_folders;
-- DROP TRIGGER IF EXISTS trg_listings_updated_at                 ON listings;
-- DROP TRIGGER IF EXISTS trg_sales_updated_at                    ON sales;
-- DROP TRIGGER IF EXISTS trg_listing_templates_updated_at        ON listing_templates;
-- DROP TRIGGER IF EXISTS trg_offers_updated_at                   ON offers;
-- DROP TRIGGER IF EXISTS trg_automation_rules_updated_at         ON automation_rules;
-- DROP TRIGGER IF EXISTS trg_oauth_accounts_updated_at           ON oauth_accounts;
-- DROP TRIGGER IF EXISTS trg_user_preferences_updated_at         ON user_preferences;
-- DROP TRIGGER IF EXISTS trg_app_settings_updated_at             ON app_settings;
-- DROP TRIGGER IF EXISTS trg_image_bank_folders_updated_at       ON image_bank_folders;
-- DROP TRIGGER IF EXISTS trg_image_bank_updated_at               ON image_bank;
-- DROP TRIGGER IF EXISTS trg_batch_photo_presets_updated_at      ON batch_photo_presets;
-- DROP TRIGGER IF EXISTS trg_chat_conversations_updated_at       ON chat_conversations;
-- DROP TRIGGER IF EXISTS trg_community_posts_updated_at          ON community_posts;
-- DROP TRIGGER IF EXISTS trg_community_replies_updated_at        ON community_replies;
-- DROP TRIGGER IF EXISTS trg_help_faq_updated_at                 ON help_faq;
-- DROP TRIGGER IF EXISTS trg_help_articles_updated_at            ON help_articles;
-- DROP TRIGGER IF EXISTS trg_support_tickets_updated_at          ON support_tickets;
-- DROP TRIGGER IF EXISTS trg_roadmap_features_updated_at         ON roadmap_features;
-- DROP TRIGGER IF EXISTS trg_feedback_submissions_updated_at     ON feedback_submissions;
-- DROP TRIGGER IF EXISTS trg_calendar_events_updated_at          ON calendar_events;
-- DROP TRIGGER IF EXISTS trg_calendar_sync_settings_updated_at   ON calendar_sync_settings;
-- DROP TRIGGER IF EXISTS trg_checklists_updated_at               ON checklists;
-- DROP TRIGGER IF EXISTS trg_checklist_items_updated_at          ON checklist_items;
-- DROP TRIGGER IF EXISTS trg_accounts_updated_at                 ON accounts;
-- DROP TRIGGER IF EXISTS trg_purchases_updated_at                ON purchases;
-- DROP TRIGGER IF EXISTS trg_financial_transactions_updated_at   ON financial_transactions;
-- DROP TRIGGER IF EXISTS trg_inventory_cost_layers_updated_at    ON inventory_cost_layers;
-- DROP TRIGGER IF EXISTS trg_receipt_vendors_updated_at          ON receipt_vendors;
-- DROP TRIGGER IF EXISTS trg_categorization_rules_updated_at     ON categorization_rules;
-- DROP TRIGGER IF EXISTS trg_sales_tax_nexus_updated_at          ON sales_tax_nexus;
-- DROP TRIGGER IF EXISTS trg_orders_updated_at                   ON orders;
-- DROP TRIGGER IF EXISTS trg_shipping_profiles_updated_at        ON shipping_profiles;
-- DROP TRIGGER IF EXISTS trg_shipping_labels_updated_at          ON shipping_labels;
-- DROP TRIGGER IF EXISTS trg_price_tracking_updated_at           ON price_tracking;
-- DROP TRIGGER IF EXISTS trg_price_predictions_updated_at        ON price_predictions;
-- DROP TRIGGER IF EXISTS trg_analytics_digests_updated_at        ON analytics_digests;
-- DROP TRIGGER IF EXISTS trg_suppliers_updated_at                ON suppliers;
-- DROP TRIGGER IF EXISTS trg_supplier_items_updated_at           ON supplier_items;
-- DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at          ON purchase_orders;
-- DROP TRIGGER IF EXISTS trg_competitors_updated_at              ON competitors;
-- DROP TRIGGER IF EXISTS trg_competitor_listings_updated_at      ON competitor_listings;
-- DROP TRIGGER IF EXISTS trg_teams_updated_at                    ON teams;
-- DROP TRIGGER IF EXISTS trg_collaborations_updated_at           ON collaborations;
-- DROP TRIGGER IF EXISTS trg_relisting_rules_updated_at          ON relisting_rules;
-- DROP TRIGGER IF EXISTS trg_automation_experiments_updated_at   ON automation_experiments;
-- DROP TRIGGER IF EXISTS trg_automation_templates_updated_at     ON automation_templates;
-- DROP TRIGGER IF EXISTS trg_import_mappings_updated_at          ON import_mappings;
-- DROP TRIGGER IF EXISTS trg_inventory_categories_updated_at     ON inventory_categories;
-- DROP TRIGGER IF EXISTS trg_sku_rules_updated_at                ON sku_rules;
-- DROP TRIGGER IF EXISTS trg_barcode_lookups_updated_at          ON barcode_lookups;
-- DROP TRIGGER IF EXISTS trg_warehouse_locations_updated_at      ON warehouse_locations;
-- DROP TRIGGER IF EXISTS trg_size_charts_updated_at              ON size_charts;
-- DROP TRIGGER IF EXISTS trg_brand_size_guides_updated_at        ON brand_size_guides;
-- DROP TRIGGER IF EXISTS trg_whatnot_events_updated_at           ON whatnot_events;
-- DROP TRIGGER IF EXISTS trg_custom_reports_updated_at           ON custom_reports;
-- DROP TRIGGER IF EXISTS trg_saved_reports_updated_at            ON saved_reports;
-- DROP TRIGGER IF EXISTS trg_prediction_models_updated_at        ON prediction_models;
-- DROP TRIGGER IF EXISTS trg_webhook_endpoints_updated_at        ON webhook_endpoints;
-- DROP TRIGGER IF EXISTS trg_user_webhooks_updated_at            ON user_webhooks;
-- DROP TRIGGER IF EXISTS trg_email_accounts_updated_at           ON email_accounts;
-- DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at       ON push_subscriptions;
-- DROP TRIGGER IF EXISTS trg_push_devices_updated_at             ON push_devices;
-- DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
-- DROP TRIGGER IF EXISTS trg_data_export_requests_updated_at     ON data_export_requests;
-- DROP TRIGGER IF EXISTS trg_account_deletion_requests_updated_at ON account_deletion_requests;
-- DROP TRIGGER IF EXISTS trg_user_consents_updated_at            ON user_consents;
-- DROP TRIGGER IF EXISTS trg_cookie_consent_updated_at           ON cookie_consent;
-- DROP TRIGGER IF EXISTS trg_affiliate_landing_pages_updated_at  ON affiliate_landing_pages;
-- DROP TRIGGER IF EXISTS trg_plan_usage_updated_at               ON plan_usage;
-- DROP TRIGGER IF EXISTS trg_task_queue_updated_at               ON task_queue;
-- DROP TRIGGER IF EXISTS trg_changelog_updated_at                ON changelog;
-- DROP TRIGGER IF EXISTS trg_buyer_profiles_updated_at           ON buyer_profiles;
-- DROP TRIGGER IF EXISTS trg_feature_flags_updated_at            ON feature_flags;
-- DROP TRIGGER IF EXISTS trg_notion_settings_updated_at          ON notion_settings;
-- DROP TRIGGER IF EXISTS trg_notion_sync_map_updated_at          ON notion_sync_map;
-- DROP TRIGGER IF EXISTS trg_notion_field_mappings_updated_at    ON notion_field_mappings;
-- DROP TRIGGER IF EXISTS trg_google_tokens_updated_at            ON google_tokens;
-- DROP TRIGGER IF EXISTS trg_security_logs_updated_at            ON security_logs;
-- DROP TRIGGER IF EXISTS trg_mfa_events_updated_at               ON mfa_events;
-- DROP TRIGGER IF EXISTS trg_health_checks_updated_at            ON health_checks;
-- DROP FUNCTION IF EXISTS update_timestamp();
