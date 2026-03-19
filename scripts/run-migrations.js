#!/usr/bin/env node
// Database Migration Runner
// Runs all pending migrations in order

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'bun:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || join(ROOT_DIR, 'data');
const DB_FILE = join(DATA_DIR, 'vaultlister.db');
const MIGRATIONS_DIR = join(ROOT_DIR, 'src/backend/db/migrations');

console.log('VaultLister Database Migration Runner');
console.log('=====================================\n');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    console.log(`Creating data directory: ${DATA_DIR}`);
    const { mkdirSync } = await import('fs');
    mkdirSync(DATA_DIR, { recursive: true });
}

// Connect to database
const db = new Database(DB_FILE);

// Create migrations tracking table if not exists
db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT (datetime('now'))
    )
`);

// Add checksum column if it doesn't exist (for older databases)
try {
    db.run('ALTER TABLE migrations ADD COLUMN checksum TEXT');
} catch (e) {
    // Column already exists
}

// Get list of applied migrations
function getAppliedMigrations() {
    const rows = db.query('SELECT name FROM migrations ORDER BY name').all();
    return new Set(rows.map(r => r.name));
}

// Get list of migration files
function getMigrationFiles() {
    if (!existsSync(MIGRATIONS_DIR)) {
        console.log('No migrations directory found');
        return [];
    }

    return readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
}

// Calculate checksum of migration content
function checksum(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

// Run a single migration
function runMigration(filename, content) {
    console.log(`  Running: ${filename}`);

    // Split by semicolons but handle edge cases
    const statements = content
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
        try {
            db.run(statement);
            successCount++;
        } catch (error) {
            // Some errors are expected (table already exists, etc.)
            if (error.message.includes('already exists') ||
                error.message.includes('duplicate column') ||
                error.message.includes('no such column')) {
                // Skip silently - these are common in idempotent migrations
            } else {
                console.log(`    Warning: ${error.message.substring(0, 100)}`);
                errorCount++;
            }
        }
    }

    console.log(`    Executed ${successCount} statements${errorCount > 0 ? `, ${errorCount} warnings` : ''}`);
    return true;
}

// Run inline migrations from service files
function runInlineMigrations() {
    console.log('\nRunning inline migrations from services...\n');

    // Push notifications tables
    const pushNotificationsMigration = `
        CREATE TABLE IF NOT EXISTS push_devices (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_token TEXT NOT NULL UNIQUE,
            platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
            device_name TEXT,
            app_version TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            last_used_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notification_preferences (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            sales_alerts INTEGER DEFAULT 1,
            price_drops INTEGER DEFAULT 1,
            low_stock_alerts INTEGER DEFAULT 1,
            order_updates INTEGER DEFAULT 1,
            marketing INTEGER DEFAULT 0,
            weekly_digest INTEGER DEFAULT 1,
            quiet_hours_start TEXT,
            quiet_hours_end TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);
        CREATE INDEX IF NOT EXISTS idx_push_devices_token ON push_devices(device_token);
    `;

    // Monitoring tables
    const monitoringMigration = `
        CREATE TABLE IF NOT EXISTS error_logs (
            id TEXT PRIMARY KEY,
            error_type TEXT NOT NULL,
            message TEXT NOT NULL,
            stack TEXT,
            user_id TEXT,
            request_path TEXT,
            request_method TEXT,
            user_agent TEXT,
            ip_address TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
            message TEXT NOT NULL,
            metadata TEXT,
            acknowledged INTEGER DEFAULT 0,
            acknowledged_by TEXT,
            acknowledged_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
        CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
        CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);
    `;

    // GDPR tables
    const gdprMigration = `
        CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
            scheduled_for TEXT NOT NULL,
            reason TEXT,
            requested_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT,
            cancelled_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS data_export_requests (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
            file_path TEXT,
            expires_at TEXT,
            requested_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_user ON gdpr_deletion_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_gdpr_deletion_status ON gdpr_deletion_requests(status);
        CREATE INDEX IF NOT EXISTS idx_data_export_user ON data_export_requests(user_id);
    `;

    const inlineMigrations = [
        { name: 'inline_push_notifications', sql: pushNotificationsMigration },
        { name: 'inline_monitoring', sql: monitoringMigration },
        { name: 'inline_gdpr', sql: gdprMigration }
    ];

    const applied = getAppliedMigrations();

    for (const migration of inlineMigrations) {
        if (!applied.has(migration.name)) {
            if (runMigration(migration.name, migration.sql)) {
                db.run(
                    'INSERT INTO migrations (name, checksum) VALUES (?, ?)',
                    [migration.name, checksum(migration.sql)]
                );
            }
        } else {
            console.log(`  Skipping: ${migration.name} (already applied)`);
        }
    }
}

// Main migration runner
async function main() {
    const applied = getAppliedMigrations();
    const files = getMigrationFiles();

    console.log(`Database: ${DB_FILE}`);
    console.log(`Applied migrations: ${applied.size}`);
    console.log(`Available migrations: ${files.length}\n`);

    // S-06: Detect duplicate migration names (conflict prevention)
    const seenNames = new Set();
    const duplicates = [];
    for (const file of files) {
        if (seenNames.has(file)) {
            duplicates.push(file);
        }
        seenNames.add(file);
    }
    
    if (duplicates.length > 0) {
        console.error("ERROR: Duplicate migration file names detected:");
        for (const dup of duplicates) {
            console.error(`  - ${dup}`);
        }
        console.error("Please rename migration files to have unique names.");
        process.exit(1);
    }

    // Run SQL file migrations
    let newMigrations = 0;

    if (files.length > 0) {
        console.log('Running SQL file migrations...\n');

        for (const file of files) {
            if (!applied.has(file)) {
                const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

                if (runMigration(file, content)) {
                    db.run(
                        'INSERT INTO migrations (name, checksum) VALUES (?, ?)',
                        [file, checksum(content)]
                    );
                    newMigrations++;
                }
            } else {
                console.log(`  Skipping: ${file} (already applied)`);
            }
        }
    }

    // Run inline migrations
    runInlineMigrations();

    // Summary
    console.log('\n=====================================');
    console.log('Migration Summary');
    console.log('=====================================');

    const finalApplied = getAppliedMigrations();
    console.log(`Total applied: ${finalApplied.size}`);
    console.log(`New this run: ${newMigrations}`);

    // List all applied migrations
    const allMigrations = db.query('SELECT name, applied_at FROM migrations ORDER BY applied_at').all();
    console.log('\nApplied migrations:');
    for (const m of allMigrations.slice(-10)) {
        console.log(`  - ${m.name} (${m.applied_at})`);
    }
    if (allMigrations.length > 10) {
        console.log(`  ... and ${allMigrations.length - 10} more`);
    }

    console.log('\nMigration complete!');
}

main().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
