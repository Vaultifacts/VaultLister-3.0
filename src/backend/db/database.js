// Database connection and utilities for VaultLister — PostgreSQL adapter (Phase 1)
import postgres from 'postgres';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { seedHelpContent } from './seeds/helpContent.js';
import { seedDemoData } from './seeds/demoData.js';
import { seedBrandSizeGuides } from '../routes/sizeCharts.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = postgres(process.env.DATABASE_URL || 'postgresql://vaultlister:localdev@localhost:5432/vaultlister_dev', {
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 25,
    idle_timeout: 20,
    connect_timeout: 10,
});

// Convert ? positional params to $1, $2, ... for postgres.js
// Skips ? inside single-quoted string literals
function convertPlaceholders(sqlStr) {
    let index = 0;
    let result = '';
    let inString = false;
    for (let i = 0; i < sqlStr.length; i++) {
        const ch = sqlStr[i];
        if (ch === "'" && !inString) { inString = true; result += ch; }
        else if (ch === "'" && inString) { inString = false; result += ch; }
        else if (ch === '?' && !inString) { result += '$' + (++index); }
        else { result += ch; }
    }
    return result;
}

// SQL identifier validation — prevents injection via dynamic column/table names
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function validateIdentifier(name) {
    if (!VALID_IDENTIFIER.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
    return name;
}

// Escape LIKE wildcards for safe use in LIKE clauses (use with ESCAPE '\\')
export function escapeLike(str) {
    return String(str).replace(/[%_\\]/g, '\\$&');
}

export function getStatementCacheStats() {
    return { poolSize: sql.options.max, idleConnections: sql.options.idle_timeout };
}

export const query = {
    // Get single row
    async get(sqlStr, params = []) {
        try {
            const converted = convertPlaceholders(sqlStr);
            const paramArray = Array.isArray(params) ? params : [params];
            const rows = await sql.unsafe(converted, paramArray);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sqlStr : '');
            throw error;
        }
    },

    // Get all rows
    async all(sqlStr, params = []) {
        try {
            const converted = convertPlaceholders(sqlStr);
            const paramArray = Array.isArray(params) ? params : [params];
            return await sql.unsafe(converted, paramArray);
        } catch (error) {
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sqlStr : '');
            throw error;
        }
    },

    // Execute mutation (INSERT, UPDATE, DELETE)
    async run(sqlStr, params = []) {
        try {
            const converted = convertPlaceholders(sqlStr);
            const paramArray = Array.isArray(params) ? params : [params];
            const result = await sql.unsafe(converted, paramArray);
            return { changes: result.count, lastInsertRowid: 0 };
        } catch (error) {
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sqlStr : '');
            throw error;
        }
    },

    // Execute raw SQL (DDL, no params)
    async exec(sqlStr) {
        try {
            await sql.unsafe(sqlStr);
        } catch (error) {
            logger.error('Exec error:', error.message);
            throw error;
        }
    },

    // Transaction helper — returns a promise (callers: await query.transaction(fn))
    async transaction(fn) {
        return await sql.begin(async (tx) => {
            const txQuery = {
                async get(s, p = []) {
                    const paramArray = Array.isArray(p) ? p : [p];
                    const r = await tx.unsafe(convertPlaceholders(s), paramArray);
                    return r.length > 0 ? r[0] : null;
                },
                async all(s, p = []) {
                    const paramArray = Array.isArray(p) ? p : [p];
                    return await tx.unsafe(convertPlaceholders(s), paramArray);
                },
                async run(s, p = []) {
                    const paramArray = Array.isArray(p) ? p : [p];
                    const r = await tx.unsafe(convertPlaceholders(s), paramArray);
                    return { changes: r.count, lastInsertRowid: 0 };
                },
                async exec(s) {
                    await tx.unsafe(s);
                },
            };
            return await fn(txQuery);
        });
    },

    // Full-text search on inventory — Phase 1 stub (ILIKE fallback; FTS5->tsvector in Phase 3)
    async searchInventory(searchTerm, userId, limit = 50) {
        // TODO Phase 3: implement tsvector full-text search
        const term = `%${searchTerm}%`;
        const rows = await sql.unsafe(
            `SELECT * FROM inventory WHERE user_id = $1 AND (title ILIKE $2 OR description ILIKE $2) LIMIT $3`,
            [userId, term, limit]
        );
        return rows;
    }
};

// Model helpers for common operations
export const models = {
    async create(table, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sqlStr = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        return await query.run(sqlStr, values);
    },

    async findById(table, id) {
        validateIdentifier(table);
        return await query.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    },

    async findOne(table, conditions) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
        return await query.get(`SELECT * FROM ${table} WHERE ${where}`, values);
    },

    async findMany(table, conditions = {}, options = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sqlStr = `SELECT * FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            sqlStr += ` WHERE ${where}`;
        }

        if (options.orderBy) {
            const orderParts = options.orderBy.split(',').map(s => s.trim());
            for (const part of orderParts) {
                const [col, dir] = part.split(/\s+/);
                validateIdentifier(col);
                if (dir && !['ASC', 'DESC', 'asc', 'desc'].includes(dir)) {
                    throw new Error(`Invalid ORDER BY direction: ${dir}`);
                }
            }
            sqlStr += ` ORDER BY ${options.orderBy}`;
        }

        if (options.limit) {
            sqlStr += ` LIMIT ${parseInt(options.limit, 10)}`;
        }

        if (options.offset) {
            sqlStr += ` OFFSET ${parseInt(options.offset, 10)}`;
        }

        return await query.all(sqlStr, values);
    },

    async update(table, id, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const sqlStr = `UPDATE ${table} SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1}`;
        return await query.run(sqlStr, [...values, id]);
    },

    async delete(table, id) {
        validateIdentifier(table);
        return await query.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },

    async count(table, conditions = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sqlStr = `SELECT COUNT(*) as count FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ');
            sqlStr += ` WHERE ${where}`;
        }

        const row = await query.get(sqlStr, values);
        return row?.count || 0;
    }
};

// Migration system
async function runMigrations() {
    try {
        // Create migrations table if it doesn't exist
        await query.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const MIGRATIONS_DIR = join(__dirname, 'migrations');

        // List of migration files in order
        const migrationFiles = [
            '001_add_deleted_at.sql',
            '002_add_low_stock_threshold.sql',
            '003_add_listing_templates.sql',
            '004_add_oauth_fields.sql',
            '005_add_image_bank.sql',
            '006_add_chatbot.sql',
            '007_add_community.sql',
            '008_add_extension_support.sql',
            '009_add_support_features.sql',
            '010_add_help_votes.sql',
            '011_roadmap.sql',
            '012_feedback.sql',
            '013_calendar.sql',
            '014_inventory_enhancements.sql',
            '015_changelog.sql',
            '016_add_listing_folders.sql',
            '017_add_checklists.sql',
            '018_add_financial_accounting.sql',
            '019_enhance_sales_columns.sql',
            '020_add_listing_refresh_tracking.sql',
            '021_add_shipping_profiles.sql',
            '022_add_sku_rules.sql',
            '023_add_receipt_parsing.sql',
            '024_add_batch_processing.sql',
            '025_oauth_enhancements.sql',
            '026_add_orders_table.sql',
            '027_add_email_accounts.sql',
            '028_add_outlook_support.sql',
            '029_add_webhooks.sql',
            '030_add_push_subscriptions.sql',
            '031_add_engagement_tracking.sql',
            '032_add_predictive_analytics.sql',
            '033_add_supplier_monitoring.sql',
            '034_add_competitor_monitoring.sql',
            '035_allow_archived_status.sql',
            '036_duplicate_detections.sql',
            '037_teams.sql',
            '038_smart_relisting.sql',
            '039_shipping_labels.sql',
            '040_inventory_import.sql',
            '041_add_categorization_rules.sql',
            '042_whatnot_live_events.sql',
            '043_custom_reports.sql',
            '044_shipping_labels_print.sql',
            '045_add_token_refresh_tracking.sql',
            '046_add_performance_indexes.sql',
            '047_add_security_features.sql',
            '048_add_gdpr_tables.sql',
            '049_add_notion_sync.sql',
            '050_monitoring_tables.sql',
            '051_performance_indexes.sql',
            '052_enhanced_features.sql',
            '053_add_bin_location.sql',
            '054_add_automation_history.sql',
            '055_add_price_history.sql',
            '056_add_checklist_notes.sql',
            '057_add_return_fields.sql',
            '058_add_calendar_dependencies.sql',
            '059_feedback_enhancements.sql',
            '060_transaction_enhancements.sql',
            '061_analytics_and_checklist_enhancements.sql',
            '062_calendar_sync_settings.sql',
            '063_fix_missing_schema.sql',
            '064_new_features_schema.sql',
            '065_batch3_features.sql',
            '066_push_notifications.sql',
            '067_add_checklist_indexes.sql',
            '068_fix_checklist_user_id_type.sql',
            '069_add_team_is_active.sql',
            '070_add_auth_tokens.sql',
            '071_add_business_tier.sql',
            '072_fix_affiliate_slug_unique.sql',
            '073_fix_team_members_fk.sql',
            '074_fix_nullable_user_ids.sql',
            '075_add_listings_compound_index.sql',
            '076_fix_teams_owner_fk.sql',
            '077_fix_users_old_rename.sql',
            '078_add_brand_size_guides.sql',
            '079_add_engagement_heatmap_index.sql',
            '080_add_offers_table.sql',
            '081_add_enhanced_mfa_tables.sql',
            '082_add_service_tables.sql',
            '083_add_audit_log_table.sql',
            '084_add_missing_columns.sql',
            '085_add_missing_indexes.sql',
            '086_rum_metrics.sql',
            '087_oauth_pkce.sql',
            '088_automation_experiments.sql',
            '089_automation_templates.sql',
            '090_automation_rule_versions.sql',
            '091_inventory_categories.sql',
            '092_inventory_cost_tracking.sql',
            '093_automation_sort_order.sql',
            '094_automation_rule_tags.sql',
            '095_add_user_preferences.sql',
            '096_add_listings_unique_constraint.sql',
            '097_fix_fts5_delete_trigger.sql',
            '098_add_is_admin.sql',
            '099_optimize_query_indexes.sql',
            '100_add_app_settings.sql',
            '101_add_auto_sync.sql',
            '102_add_stripe_columns.sql',
            '103_add_google_integrations.sql',
            '104_fix_listings_folders_user_id.sql',
            '105_add_composite_indexes.sql',
            '106_fix_purchase_number_unique.sql',
            '107_document_security_logs_id_design.sql',
            '108_add_offers_soft_delete.sql',
            '109_document_mfa_events_id_design.sql',
            '110_add_sync_error_to_shops.sql',
            '111_add_poshmark_monitoring_log.sql',
            '112_add_csrf_tokens_table.sql'
        ];

        for (const migrationFile of migrationFiles) {
            // Check if migration has already been applied
            const applied = await query.get('SELECT id FROM migrations WHERE name = ?', [migrationFile]);

            if (!applied) {
                const migrationPath = join(MIGRATIONS_DIR, migrationFile);

                if (existsSync(migrationPath)) {
                    try {
                        logger.info(`  Running migration: ${migrationFile}`);
                        const migrationSQL = readFileSync(migrationPath, 'utf-8');

                        // Run migration in transaction
                        await query.transaction(async (tx) => {
                            await tx.exec(migrationSQL);
                            await tx.run('INSERT INTO migrations (name) VALUES (?)', [migrationFile]);
                        });

                        logger.info(`  ✓ Applied migration: ${migrationFile}`);
                    } catch (migrationError) {
                        const errorMsg = migrationError.message || '';
                        if (errorMsg.includes('duplicate column') ||
                            errorMsg.includes('already exists') ||
                            errorMsg.includes('unique constraint') ||
                            errorMsg.includes('does not exist')) {
                            // Mark as applied — schema differs from what migration expects
                            await query.run('INSERT INTO migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [migrationFile]);
                            logger.info(`  ⚠ Migration ${migrationFile} skipped (schema mismatch: ${errorMsg.slice(0, 60)})`);
                        } else {
                            throw migrationError;
                        }
                    }
                } else {
                    // File not found - mark as applied if it's an old migration
                    await query.run('INSERT INTO migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [migrationFile]);
                    logger.info(`  ⚠ Migration file not found: ${migrationFile} (marked as applied)`);
                }
            }
        }
    } catch (error) {
        logger.error('Migration error:', error);
        throw error;
    }
}

// Initialize schema if needed
export async function initializeDatabase() {
    try {
        // Test connection
        await sql.unsafe('SELECT 1');
        logger.info('✓ PostgreSQL connection established');

        // Run migrations
        await runMigrations();

        // Seed help content
        await seedHelpContent();

        // Seed demo data (inventory, orders, listings) — skip in production
        if (process.env.NODE_ENV !== 'production') {
            await seedDemoData();
        }

        // Seed brand size guides
        await seedBrandSizeGuides();

        logger.info('✓ Database initialized successfully');
        return true;
    } catch (error) {
        logger.error('Database initialization error:', error);
        throw error;
    }
}

// Cleanup expired data (tokens, sessions, etc.)
export async function cleanupExpiredData() {
    const tables = [
        { name: 'verification_tokens', condition: "expires_at < NOW() OR used_at IS NOT NULL" },
        { name: 'oauth_states', condition: "expires_at < NOW()" },
        { name: 'email_oauth_states', condition: "expires_at < NOW()" },
        { name: 'sms_codes', condition: "expires_at < NOW()" },
        { name: 'sessions', condition: "expires_at < NOW()" },
        { name: 'webhook_events', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'automation_logs', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'security_logs', condition: "created_at < NOW() - INTERVAL '90 days'" },
        { name: 'email_queue', condition: "(status = 'sent' AND created_at < NOW() - INTERVAL '30 days') OR (status = 'failed' AND created_at < NOW() - INTERVAL '7 days')" },
        { name: 'team_invitations', condition: "status = 'expired' OR expires_at < NOW() - INTERVAL '30 days'" },
        { name: 'request_logs', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'audit_logs', condition: "created_at < NOW() - INTERVAL '1 year'" },
        { name: 'push_notification_log', condition: "created_at < NOW() - INTERVAL '30 days'" }
    ];

    const results = {};
    let totalDeleted = 0;

    for (const table of tables) {
        try {
            // Check if table exists (PostgreSQL equivalent of sqlite_master)
            const tableExists = await query.get(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?",
                [table.name]
            );

            if (!tableExists) {
                results[table.name] = 0;
                continue;
            }

            const sqlStr = `DELETE FROM ${table.name} WHERE ${table.condition}`;
            const result = await query.run(sqlStr);
            const deletedCount = result.changes || 0;
            results[table.name] = deletedCount;
            totalDeleted += deletedCount;
        } catch (error) {
            logger.error(`Cleanup error for ${table.name}:`, error.message);
            results[table.name] = 0;
        }
    }

    if (totalDeleted > 0) {
        logger.info(`✓ Cleaned up ${totalDeleted} expired records:`, results);
    }

    // Refresh statistics (PostgreSQL equivalent of PRAGMA optimize)
    await query.exec('ANALYZE');

    return results;
}

// Close database connection pool
export async function closeDatabase() {
    await sql.end();
}

// Close database on process exit
process.on('exit', () => {
    // sql.end() is async but process exit is synchronous — best effort
    sql.end({ timeout: 0 });
});

export default sql;
