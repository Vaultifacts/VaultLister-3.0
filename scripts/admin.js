#!/usr/bin/env node
'use strict';
// Admin CLI for VaultLister 3.0
// Usage: bun scripts/admin.js <command> [args]

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, statSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || join(ROOT_DIR, 'data', 'vaultlister.db');
const BCRYPT_ROUNDS = 12;

if (!existsSync(DB_PATH)) {
    console.error(`Error: Database not found at ${DB_PATH}`);
    console.error('Set DB_PATH env var or run db:init first.');
    process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const [,, command, ...args] = process.argv;

async function main() {
    try {
        switch (command) {
            case 'reset-password':
                await resetPassword(args[0], args[1]);
                break;
            case 'create-user':
                await createUser(args[0], args[1], args[2]);
                break;
            case 'set-admin':
                setAdmin(args[0], args[1]);
                break;
            case 'list-users':
                listUsers();
                break;
            case 'db-stats':
                dbStats();
                break;
            case 'migrate-status':
                migrateStatus();
                break;
            case 'migrate-run':
                await migrateRun();
                break;
            case 'help':
            case undefined:
                showHelp();
                break;
            default:
                console.error(`Unknown command: ${command}`);
                console.error('Run `bun scripts/admin.js help` for available commands.');
                process.exit(1);
        }
    } finally {
        db.close();
    }
}

async function resetPassword(email, newPassword) {
    if (!email || !newPassword) {
        console.error('Usage: bun scripts/admin.js reset-password <email> <new-password>');
        process.exit(1);
    }
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, user.id);
    console.log(`Password updated for ${email}`);
}

async function createUser(email, password, fullName) {
    if (!email || !password || !fullName) {
        console.error('Usage: bun scripts/admin.js create-user <email> <password> <full_name>');
        process.exit(1);
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        console.error(`User already exists with email: ${email}`);
        process.exit(1);
    }
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30) + '_' + id.slice(0, 6);
    db.prepare(
        'INSERT INTO users (id, email, password_hash, username, full_name, is_active) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(id, email, hash, username, fullName);
    console.log(`User created:`);
    console.log(`  id:       ${id}`);
    console.log(`  email:    ${email}`);
    console.log(`  username: ${username}`);
    console.log(`  name:     ${fullName}`);
}

function setAdmin(email, flag) {
    if (!email) {
        console.error('Usage: bun scripts/admin.js set-admin <email> [true|false]');
        process.exit(1);
    }
    const isAdmin = (flag === undefined || flag === 'true') ? 1 : 0;
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }
    db.prepare('UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isAdmin, user.id);
    console.log(`${email} is_admin set to ${isAdmin === 1 ? 'true' : 'false'}`);
}

function listUsers() {
    const users = db.prepare(
        'SELECT id, email, full_name, is_admin, created_at FROM users ORDER BY created_at ASC'
    ).all();
    if (users.length === 0) {
        console.log('No users found.');
        return;
    }
    const header = 'ID'.padEnd(38) + 'EMAIL'.padEnd(36) + 'FULL NAME'.padEnd(26) + 'ADMIN'.padEnd(8) + 'CREATED AT';
    console.log(header);
    console.log('-'.repeat(header.length + 10));
    for (const u of users) {
        const admin = u.is_admin ? 'yes' : 'no';
        const created = u.created_at ? u.created_at.slice(0, 19) : '--';
        console.log(
            String(u.id).padEnd(38) +
            String(u.email).padEnd(36) +
            String(u.full_name || '--').padEnd(26) +
            admin.padEnd(8) +
            created
        );
    }
    console.log(`\nTotal: ${users.length} user(s)`);
}

function dbStats() {
    const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map(r => r.name);

    console.log('Table Row Counts');
    console.log('----------------');
    for (const table of tables) {
        try {
            const row = db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get();
            console.log(`  ${table.padEnd(40)} ${String(row.count).padStart(8)} rows`);
        } catch {
            console.log(`  ${table.padEnd(40)} (error reading)`);
        }
    }

    if (existsSync(DB_PATH)) {
        const bytes = statSync(DB_PATH).size;
        const size = bytes >= 1048576
            ? (bytes / 1048576).toFixed(2) + ' MB'
            : (bytes / 1024).toFixed(2) + ' KB';
        console.log(`\nDatabase file: ${DB_PATH}`);
        console.log(`File size:     ${size}`);
    }
    console.log(`Tables:        ${tables.length}`);
}

function migrateStatus() {
    // Canonical migration list sourced from database.js
    const migrationFiles = [
        '001_add_deleted_at.sql', '002_add_low_stock_threshold.sql', '003_add_listing_templates.sql',
        '004_add_oauth_fields.sql', '005_add_image_bank.sql', '006_add_chatbot.sql',
        '007_add_community.sql', '008_add_extension_support.sql', '009_add_support_features.sql',
        '010_add_help_votes.sql', '011_roadmap.sql', '012_feedback.sql',
        '013_calendar.sql', '014_inventory_enhancements.sql', '015_changelog.sql',
        '016_add_listing_folders.sql', '017_add_checklists.sql', '018_add_financial_accounting.sql',
        '019_enhance_sales_columns.sql', '020_add_listing_refresh_tracking.sql',
        '021_add_shipping_profiles.sql', '022_add_sku_rules.sql', '023_add_receipt_parsing.sql',
        '024_add_batch_processing.sql', '025_oauth_enhancements.sql', '026_add_orders_table.sql',
        '027_add_email_accounts.sql', '028_add_outlook_support.sql', '029_add_webhooks.sql',
        '030_add_push_subscriptions.sql', '031_add_engagement_tracking.sql',
        '032_add_predictive_analytics.sql', '033_add_supplier_monitoring.sql',
        '034_add_competitor_monitoring.sql', '035_allow_archived_status.sql',
        '036_duplicate_detections.sql', '037_teams.sql', '038_smart_relisting.sql',
        '039_shipping_labels.sql', '040_inventory_import.sql', '041_add_categorization_rules.sql',
        '042_whatnot_live_events.sql', '043_custom_reports.sql', '044_shipping_labels_print.sql',
        '045_add_token_refresh_tracking.sql', '046_add_performance_indexes.sql',
        '047_add_security_features.sql', '048_add_gdpr_tables.sql', '049_add_notion_sync.sql',
        '050_monitoring_tables.sql', '051_performance_indexes.sql', '052_enhanced_features.sql',
        '053_add_bin_location.sql', '054_add_automation_history.sql', '055_add_price_history.sql',
        '056_add_checklist_notes.sql', '057_add_return_fields.sql', '058_add_calendar_dependencies.sql',
        '059_feedback_enhancements.sql', '060_transaction_enhancements.sql',
        '061_analytics_and_checklist_enhancements.sql', '062_calendar_sync_settings.sql',
        '063_fix_missing_schema.sql', '064_new_features_schema.sql', '065_batch3_features.sql',
        '066_push_notifications.sql', '067_add_checklist_indexes.sql',
        '068_fix_checklist_user_id_type.sql', '069_add_team_is_active.sql',
        '070_add_auth_tokens.sql', '071_add_business_tier.sql', '072_fix_affiliate_slug_unique.sql',
        '073_fix_team_members_fk.sql', '074_fix_nullable_user_ids.sql',
        '075_add_listings_compound_index.sql', '076_fix_teams_owner_fk.sql',
        '077_fix_users_old_rename.sql', '078_add_brand_size_guides.sql',
        '079_add_watermark_tables.sql', '080_add_offers_table.sql', '081_add_onboarding_tables.sql',
        '082_add_offline_sync.sql', '083_add_audit_log_table.sql', '084_add_missing_columns.sql',
        '085_add_missing_indexes.sql', '086_rum_metrics.sql', '087_oauth_pkce.sql',
        '088_automation_experiments.sql', '089_automation_templates.sql',
        '090_automation_rule_versions.sql', '091_inventory_categories.sql',
        '092_inventory_cost_tracking.sql', '093_automation_sort_order.sql',
        '094_automation_rule_tags.sql', '095_add_user_preferences.sql',
        '096_add_listings_unique_constraint.sql', '097_fix_fts5_delete_trigger.sql',
        '098_add_is_admin.sql', '099_optimize_query_indexes.sql', '100_add_app_settings.sql'
    ];

    // Check if migrations table exists
    const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
    ).get();
    if (!tableExists) {
        console.error('Error: migrations table does not exist. Run db:init first.');
        process.exit(1);
    }

    const appliedRows = db.prepare('SELECT name, applied_at FROM migrations ORDER BY id ASC').all();
    const appliedMap = new Map(appliedRows.map(r => [r.name, r.applied_at]));

    // Also collect any DB-only rows not in the canonical list
    const canonicalSet = new Set(migrationFiles);
    const extraRows = appliedRows.filter(r => !canonicalSet.has(r.name));

    const allEntries = migrationFiles.map(name => ({
        name,
        applied_at: appliedMap.get(name) || null,
        status: appliedMap.has(name) ? 'applied' : 'pending'
    }));

    for (const r of extraRows) {
        allEntries.push({ name: r.name, applied_at: r.applied_at, status: 'applied (extra)' });
    }

    const appliedCount = allEntries.filter(e => e.status.startsWith('applied')).length;
    const pendingCount = allEntries.filter(e => e.status === 'pending').length;

    const colName = 40;
    const colApplied = 22;
    const colStatus = 16;
    const header = 'MIGRATION'.padEnd(colName) + 'APPLIED AT'.padEnd(colApplied) + 'STATUS';
    console.log(header);
    console.log('-'.repeat(colName + colApplied + colStatus));
    for (const entry of allEntries) {
        const appliedAt = entry.applied_at ? entry.applied_at.slice(0, 19) : '--';
        console.log(
            entry.name.padEnd(colName) +
            appliedAt.padEnd(colApplied) +
            entry.status
        );
    }
    console.log(`\nTotal: ${allEntries.length} | Applied: ${appliedCount} | Pending: ${pendingCount}`);
}

async function migrateRun() {
    const MIGRATIONS_DIR = join(ROOT_DIR, 'src', 'backend', 'db', 'migrations');

    // Reuse migrate-status logic to find pending migrations
    const migrationFiles = [
        '001_add_deleted_at.sql', '002_add_low_stock_threshold.sql', '003_add_listing_templates.sql',
        '004_add_oauth_fields.sql', '005_add_image_bank.sql', '006_add_chatbot.sql',
        '007_add_community.sql', '008_add_extension_support.sql', '009_add_support_features.sql',
        '010_add_help_votes.sql', '011_roadmap.sql', '012_feedback.sql',
        '013_calendar.sql', '014_inventory_enhancements.sql', '015_changelog.sql',
        '016_add_listing_folders.sql', '017_add_checklists.sql', '018_add_financial_accounting.sql',
        '019_enhance_sales_columns.sql', '020_add_listing_refresh_tracking.sql',
        '021_add_shipping_profiles.sql', '022_add_sku_rules.sql', '023_add_receipt_parsing.sql',
        '024_add_batch_processing.sql', '025_oauth_enhancements.sql', '026_add_orders_table.sql',
        '027_add_email_accounts.sql', '028_add_outlook_support.sql', '029_add_webhooks.sql',
        '030_add_push_subscriptions.sql', '031_add_engagement_tracking.sql',
        '032_add_predictive_analytics.sql', '033_add_supplier_monitoring.sql',
        '034_add_competitor_monitoring.sql', '035_allow_archived_status.sql',
        '036_duplicate_detections.sql', '037_teams.sql', '038_smart_relisting.sql',
        '039_shipping_labels.sql', '040_inventory_import.sql', '041_add_categorization_rules.sql',
        '042_whatnot_live_events.sql', '043_custom_reports.sql', '044_shipping_labels_print.sql',
        '045_add_token_refresh_tracking.sql', '046_add_performance_indexes.sql',
        '047_add_security_features.sql', '048_add_gdpr_tables.sql', '049_add_notion_sync.sql',
        '050_monitoring_tables.sql', '051_performance_indexes.sql', '052_enhanced_features.sql',
        '053_add_bin_location.sql', '054_add_automation_history.sql', '055_add_price_history.sql',
        '056_add_checklist_notes.sql', '057_add_return_fields.sql', '058_add_calendar_dependencies.sql',
        '059_feedback_enhancements.sql', '060_transaction_enhancements.sql',
        '061_analytics_and_checklist_enhancements.sql', '062_calendar_sync_settings.sql',
        '063_fix_missing_schema.sql', '064_new_features_schema.sql', '065_batch3_features.sql',
        '066_push_notifications.sql', '067_add_checklist_indexes.sql',
        '068_fix_checklist_user_id_type.sql', '069_add_team_is_active.sql',
        '070_add_auth_tokens.sql', '071_add_business_tier.sql', '072_fix_affiliate_slug_unique.sql',
        '073_fix_team_members_fk.sql', '074_fix_nullable_user_ids.sql',
        '075_add_listings_compound_index.sql', '076_fix_teams_owner_fk.sql',
        '077_fix_users_old_rename.sql', '078_add_brand_size_guides.sql',
        '079_add_watermark_tables.sql', '080_add_offers_table.sql', '081_add_onboarding_tables.sql',
        '082_add_offline_sync.sql', '083_add_audit_log_table.sql', '084_add_missing_columns.sql',
        '085_add_missing_indexes.sql', '086_rum_metrics.sql', '087_oauth_pkce.sql',
        '088_automation_experiments.sql', '089_automation_templates.sql',
        '090_automation_rule_versions.sql', '091_inventory_categories.sql',
        '092_inventory_cost_tracking.sql', '093_automation_sort_order.sql',
        '094_automation_rule_tags.sql', '095_add_user_preferences.sql',
        '096_add_listings_unique_constraint.sql', '097_fix_fts5_delete_trigger.sql',
        '098_add_is_admin.sql', '099_optimize_query_indexes.sql', '100_add_app_settings.sql',
        'add_security_logs.js', 'add_sku_unique_index.js'
    ];

    const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
    ).get();
    if (!tableExists) {
        console.error('Error: migrations table does not exist. Run db:init first.');
        process.exit(1);
    }

    const appliedRows = db.prepare('SELECT name FROM migrations').all();
    const appliedSet = new Set(appliedRows.map(r => r.name));

    const pending = migrationFiles.filter(name => !appliedSet.has(name));

    if (pending.length === 0) {
        console.log('All migrations are already applied. Nothing to run.');
        return;
    }

    console.log(`Found ${pending.length} pending migration(s).\n`);

    const insertMigration = db.prepare(
        'INSERT INTO migrations (name, applied_at) VALUES (?, CURRENT_TIMESTAMP)'
    );

    let succeeded = 0;
    let failed = 0;

    for (const name of pending) {
        const filePath = join(MIGRATIONS_DIR, name);
        if (!existsSync(filePath)) {
            console.log(`  SKIP    ${name} (file not found at ${filePath})`);
            failed++;
            continue;
        }

        const isSql = name.endsWith('.sql');
        const isJs = name.endsWith('.js');

        if (isSql) {
            try {
                const sql = readFileSync(filePath, 'utf8');
                db.exec(sql);
                insertMigration.run(name);
                console.log(`  OK      ${name}`);
                succeeded++;
            } catch (err) {
                console.error(`  FAILED  ${name}: ${err.message}`);
                failed++;
            }
        } else if (isJs) {
            try {
                const mod = await import(pathToFileURL(filePath).href);
                if (typeof mod.default === 'function') {
                    await mod.default(db);
                } else if (typeof mod.up === 'function') {
                    await mod.up(db);
                } else {
                    throw new Error('JS migration must export a default function or named `up` function');
                }
                insertMigration.run(name);
                console.log(`  OK      ${name}`);
                succeeded++;
            } catch (err) {
                console.error(`  FAILED  ${name}: ${err.message}`);
                failed++;
            }
        } else {
            console.log(`  SKIP    ${name} (unsupported extension)`);
            failed++;
        }
    }

    console.log(`\nDone. Succeeded: ${succeeded} | Failed/Skipped: ${failed}`);
}

function showHelp() {
    console.log(`
VaultLister 3.0 Admin CLI
Usage: bun scripts/admin.js <command> [args]

Commands:
  reset-password <email> <new-password>   Hash and update a user's password
  create-user <email> <password> <name>   Create a new user account
  set-admin <email> [true|false]          Toggle is_admin flag (default: true)
  list-users                              Show all users
  db-stats                                Show table row counts and file size
  migrate-status                          Show applied/pending migration status
  migrate-run                             Apply all pending migrations in order
  help                                    Show this help message

Examples:
  bun scripts/admin.js list-users
  bun scripts/admin.js create-user admin@example.com p@ssw0rd "Admin User"
  bun scripts/admin.js set-admin admin@example.com true
  bun scripts/admin.js reset-password user@example.com newpass123
  bun scripts/admin.js db-stats
  bun scripts/admin.js migrate-status
  bun scripts/admin.js migrate-run
`);
}

main();
