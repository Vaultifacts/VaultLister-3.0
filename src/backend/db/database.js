// Database connection and utilities for VaultLister
import { Database } from 'bun:sqlite';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { seedHelpContent } from './seeds/helpContent.js';
import { seedDemoData } from './seeds/demoData.js';
import { seedBrandSizeGuides } from '../routes/sizeCharts.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'vaultlister.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// Create and configure database connection (using Bun's built-in SQLite)
const db = new Database(DB_PATH, { create: true });

// Performance optimizations (Bun's SQLite API)
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA synchronous = NORMAL');
db.exec('PRAGMA cache_size = 10000');
db.exec('PRAGMA temp_store = MEMORY');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000'); // Wait up to 5 seconds for database locks
db.exec('PRAGMA mmap_size = 268435456'); // 256 MB memory-mapped I/O
db.exec('PRAGMA analysis_limit = 1000');

// Initialize schema if needed
export function initializeDatabase() {
    try {
        const schema = readFileSync(SCHEMA_PATH, 'utf-8');
        db.exec(schema);
        logger.info('✓ Database schema initialized');

        // Run migrations
        runMigrations();

        // Seed help content
        seedHelpContent();

        // Seed demo data (inventory, orders, listings) — skip in production
        if (process.env.NODE_ENV !== 'production') {
            seedDemoData();
        }

        // Seed brand size guides
        seedBrandSizeGuides();

        logger.info('✓ Database initialized successfully');
        return true;
    } catch (error) {
        logger.error('Database initialization error:', error);
        throw error;
    }
}

// Migration system
function runMigrations() {
    try {
        // Create migrations table if it doesn't exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            '111_add_poshmark_monitoring_log.sql'
        ];

        for (const migrationFile of migrationFiles) {
            // Check if migration has already been applied
            const applied = db.query('SELECT id FROM migrations WHERE name = ?').get(migrationFile);

            if (!applied) {
                const migrationPath = join(MIGRATIONS_DIR, migrationFile);

                if (existsSync(migrationPath)) {
                    try {
                        logger.info(`  Running migration: ${migrationFile}`);
                        const migrationSQL = readFileSync(migrationPath, 'utf-8');

                        // Run migration in transaction
                        db.transaction(() => {
                            db.exec(migrationSQL);
                            db.query('INSERT INTO migrations (name) VALUES (?)').run(migrationFile);
                        })();

                        logger.info(`  ✓ Applied migration: ${migrationFile}`);
                    } catch (migrationError) {
                        // Handle schema mismatch errors gracefully
                        const errorMsg = migrationError.message || '';
                        if (errorMsg.includes('duplicate column') ||
                            errorMsg.includes('already exists') ||
                            errorMsg.includes('UNIQUE constraint failed') ||
                            errorMsg.includes('no such column') ||
                            errorMsg.includes('no such table')) {
                            // Mark as applied — schema differs from what migration expects
                            db.query('INSERT OR IGNORE INTO migrations (name) VALUES (?)').run(migrationFile);
                            logger.info(`  ⚠ Migration ${migrationFile} skipped (schema mismatch: ${errorMsg.slice(0, 60)})`);
                        } else {
                            throw migrationError;
                        }
                    }
                } else {
                    // File not found - mark as applied if it's an old migration
                    db.query('INSERT OR IGNORE INTO migrations (name) VALUES (?)').run(migrationFile);
                    logger.info(`  ⚠ Migration file not found: ${migrationFile} (marked as applied)`);
                }
            }
        }
    } catch (error) {
        logger.error('Migration error:', error);
        throw error;
    }
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

// Generic query helpers with prepared statement caching
const MAX_STATEMENT_CACHE = 1000;
const statementCache = new Map();

function getStatement(sql) {
    if (!statementCache.has(sql)) {
        if (statementCache.size >= MAX_STATEMENT_CACHE) {
            const first = statementCache.keys().next().value;
            statementCache.delete(first);
        }
        statementCache.set(sql, db.query(sql));
    }
    return statementCache.get(sql);
}

export function getStatementCacheStats() {
    return { size: statementCache.size, maxSize: MAX_STATEMENT_CACHE };
}

export const query = {
    // Expose raw db instance for advanced use (e.g. direct transaction API)
    db,

    // Get single row
    get(sql, params = []) {
        try {
            const stmt = getStatement(sql);
            const paramArray = Array.isArray(params) ? params : [params];
            return stmt.get(...paramArray);
        } catch (error) {
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sql : '');
            throw error;
        }
    },

    // Get all rows
    all(sql, params = []) {
        try {
            const stmt = getStatement(sql);
            const paramArray = Array.isArray(params) ? params : [params];
            return stmt.all(...paramArray);
        } catch (error) {
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sql : '');
            throw error;
        }
    },

    // Execute mutation (INSERT, UPDATE, DELETE)
    run(sql, params = []) {
        try {
            const stmt = getStatement(sql);
            const paramArray = Array.isArray(params) ? params : [params];
            return stmt.run(...paramArray);
        } catch (error) {
            logger.error('Query error:', error.message, process.env.NODE_ENV !== 'production' ? sql : '');
            throw error;
        }
    },

    // Execute raw SQL
    exec(sql) {
        try {
            return db.exec(sql);
        } catch (error) {
            logger.error('Exec error:', error.message);
            throw error;
        }
    },

    // Transaction helper
    transaction(fn) {
        const transaction = db.transaction(fn);
        return transaction();
    },

    // Full-text search on inventory
    searchInventory(searchTerm, userId, limit = 50) {
        const sql = `
            SELECT i.* FROM inventory i
            JOIN inventory_fts fts ON i.id = fts.id
            WHERE inventory_fts MATCH ? AND i.user_id = ?
            ORDER BY rank
            LIMIT ?
        `;
        return this.all(sql, [searchTerm, userId, limit]);
    }
};

// Model helpers for common operations
export const models = {
    // Generic CRUD
    create(table, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        return query.run(sql, values);
    },

    findById(table, id) {
        validateIdentifier(table);
        return query.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    },

    findOne(table, conditions) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        const where = keys.map(k => `${k} = ?`).join(' AND ');
        return query.get(`SELECT * FROM ${table} WHERE ${where}`, values);
    },

    findMany(table, conditions = {}, options = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sql = `SELECT * FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map(k => `${k} = ?`).join(' AND ');
            sql += ` WHERE ${where}`;
        }

        if (options.orderBy) {
            // Validate orderBy: allow "column ASC/DESC" patterns
            const orderParts = options.orderBy.split(',').map(s => s.trim());
            for (const part of orderParts) {
                const [col, dir] = part.split(/\s+/);
                validateIdentifier(col);
                if (dir && !['ASC', 'DESC', 'asc', 'desc'].includes(dir)) {
                    throw new Error(`Invalid ORDER BY direction: ${dir}`);
                }
            }
            sql += ` ORDER BY ${options.orderBy}`;
        }

        if (options.limit) {
            sql += ` LIMIT ${parseInt(options.limit, 10)}`;
        }

        if (options.offset) {
            sql += ` OFFSET ${parseInt(options.offset, 10)}`;
        }

        return query.all(sql, values);
    },

    update(table, id, data) {
        validateIdentifier(table);
        const keys = Object.keys(data);
        keys.forEach(validateIdentifier);
        const values = Object.values(data);
        const set = keys.map(k => `${k} = ?`).join(', ');
        const sql = `UPDATE ${table} SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return query.run(sql, [...values, id]);
    },

    delete(table, id) {
        validateIdentifier(table);
        return query.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    },

    count(table, conditions = {}) {
        validateIdentifier(table);
        const keys = Object.keys(conditions);
        keys.forEach(validateIdentifier);
        const values = Object.values(conditions);
        let sql = `SELECT COUNT(*) as count FROM ${table}`;

        if (keys.length > 0) {
            const where = keys.map(k => `${k} = ?`).join(' AND ');
            sql += ` WHERE ${where}`;
        }

        return query.get(sql, values)?.count || 0;
    }
};

// Cleanup expired data (tokens, sessions, etc.)
export function cleanupExpiredData() {
    const tables = [
        { name: 'verification_tokens', condition: "expires_at < datetime('now') OR used_at IS NOT NULL" },
        { name: 'oauth_states', condition: "expires_at < datetime('now')" },
        { name: 'email_oauth_states', condition: "expires_at < datetime('now')" },
        { name: 'sms_codes', condition: "expires_at < datetime('now')" },
        { name: 'sessions', condition: "expires_at < datetime('now')" },
        { name: 'webhook_events', condition: "created_at < datetime('now', '-30 days')" },
        { name: 'automation_logs', condition: "created_at < datetime('now', '-30 days')" },
        { name: 'security_logs', condition: "created_at < datetime('now', '-90 days')" },
        // Sent emails: retain for 30 days; failed emails: retain for only 7 days
        { name: 'email_queue', condition: "(status = 'sent' AND created_at < datetime('now', '-30 days')) OR (status = 'failed' AND created_at < datetime('now', '-7 days'))" },
        { name: 'team_invitations', condition: "status = 'expired' OR expires_at < datetime('now', '-30 days')" },
        { name: 'request_logs', condition: "created_at < datetime('now', '-30 days')" },
        { name: 'audit_logs', condition: "created_at < datetime('now', '-1 year')" },
        { name: 'push_notification_log', condition: "created_at < datetime('now', '-30 days')" }
    ];

    const results = {};
    let totalDeleted = 0;

    for (const table of tables) {
        try {
            // Check if table exists first
            const tableExists = query.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [table.name]
            );

            if (!tableExists) {
                results[table.name] = 0;
                continue;
            }

            const sql = `DELETE FROM ${table.name} WHERE ${table.condition}`;
            const result = query.run(sql);
            const deletedCount = result.changes || 0;
            results[table.name] = deletedCount;
            totalDeleted += deletedCount;
        } catch (error) {
            // Log error but continue with other tables
            logger.error(`Cleanup error for ${table.name}:`, error.message);
            results[table.name] = 0;
        }
    }

    if (totalDeleted > 0) {
        logger.info(`✓ Cleaned up ${totalDeleted} expired records:`, results);
    }

    // Run incremental ANALYZE optimization
    db.exec('PRAGMA optimize');

    return results;
}

// Close database on process exit (server.js handles SIGTERM/SIGINT and calls process.exit)
process.on('exit', () => db.close());

export default db;
