import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { seedHelpContent } from './seeds/helpContent.js';
import { seedDemoData } from './seeds/demoData.js';
import { seedBrandSizeGuides } from '../routes/sizeCharts.js';
import { logger } from '../shared/logger.js';
import { query } from './query.js';
import sql from './query.js';
import { _startPoolMonitor } from './query.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Migration system — PostgreSQL consolidated schema + incremental pg/ migrations
async function runMigrations() {
    try {
        // Create migrations table if it doesn't exist
        await query.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Step 1: Apply consolidated pg-schema.sql as migration 001
        const schemaName = '001_pg_schema.sql';
        const schemaApplied = await query.get('SELECT id FROM migrations WHERE name = ?', [schemaName]);

        if (!schemaApplied) {
            const schemaPath = join(__dirname, 'pg-schema.sql');
            if (!existsSync(schemaPath)) {
                throw new Error('pg-schema.sql not found — cannot initialize database');
            }

            logger.info('  Applying consolidated PostgreSQL schema (pg-schema.sql)...');
            const schemaSQL = readFileSync(schemaPath, 'utf-8');

            await query.exec(schemaSQL);
            await query.run('INSERT INTO migrations (name) VALUES (?)', [schemaName]);

            logger.info('  Applied consolidated PostgreSQL schema');
        }

        // Step 2: Apply incremental migrations from migrations/pg/ directory
        const pgMigrationsDir = join(__dirname, 'migrations', 'pg');
        if (existsSync(pgMigrationsDir)) {
            const pgFiles = readdirSync(pgMigrationsDir)
                .filter((f) => f.endsWith('.sql'))
                .sort();

            for (const migrationFile of pgFiles) {
                const applied = await query.get('SELECT id FROM migrations WHERE name = ?', [migrationFile]);

                if (!applied) {
                    const migrationPath = join(pgMigrationsDir, migrationFile);
                    try {
                        logger.info(`  Running migration: ${migrationFile}`);
                        const migrationSQL = readFileSync(migrationPath, 'utf-8');

                        await query.transaction(async (tx) => {
                            await tx.exec(migrationSQL);
                            await tx.run('INSERT INTO migrations (name) VALUES (?)', [migrationFile]);
                        });

                        logger.info(`  Applied migration: ${migrationFile}`);
                    } catch (migrationError) {
                        const errorMsg = migrationError.message || '';
                        if (
                            errorMsg.includes('already exists') ||
                            errorMsg.includes('duplicate column') ||
                            errorMsg.includes('unique constraint')
                        ) {
                            await query.run('INSERT INTO migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [
                                migrationFile,
                            ]);
                            logger.info(
                                `  Migration ${migrationFile} skipped (schema mismatch: ${errorMsg.slice(0, 60)})`,
                            );
                        } else {
                            throw migrationError;
                        }
                    }
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

        // Start pool utilization monitor
        _startPoolMonitor();

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
        { name: 'verification_tokens', condition: 'expires_at < NOW() OR used_at IS NOT NULL' },
        { name: 'oauth_states', condition: 'expires_at < NOW()' },
        { name: 'email_oauth_states', condition: 'expires_at < NOW()' },
        { name: 'sms_codes', condition: 'expires_at < NOW()' },
        { name: 'sessions', condition: 'expires_at < NOW()' },
        { name: 'webhook_events', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'automation_logs', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'security_logs', condition: "created_at < NOW() - INTERVAL '90 days'" },
        {
            name: 'email_queue',
            condition:
                "(status = 'sent' AND created_at < NOW() - INTERVAL '30 days') OR (status = 'failed' AND created_at < NOW() - INTERVAL '7 days')",
        },
        { name: 'team_invitations', condition: "status = 'expired' OR expires_at < NOW() - INTERVAL '30 days'" },
        { name: 'request_logs', condition: "created_at < NOW() - INTERVAL '30 days'" },
        { name: 'audit_logs', condition: "created_at < NOW() - INTERVAL '1 year'" },
        { name: 'push_notification_log', condition: "created_at < NOW() - INTERVAL '30 days'" },
        // Status-page retention (audit #36): keep resolved incidents 1 year, uptime samples 90 days
        {
            name: 'platform_incidents',
            condition: "resolved_at IS NOT NULL AND resolved_at < NOW() - INTERVAL '1 year'",
        },
        { name: 'platform_uptime_samples', condition: "sampled_at < NOW() - INTERVAL '90 days'" },
    ];

    const results = {};
    let totalDeleted = 0;

    for (const table of tables) {
        try {
            // Check if table exists (PostgreSQL equivalent of information_schema.tables)
            const tableExists = await query.get(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ?",
                [table.name],
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
