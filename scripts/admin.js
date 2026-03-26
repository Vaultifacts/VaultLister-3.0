#!/usr/bin/env node
'use strict';
// Admin CLI for VaultLister 3.0
// Usage: bun scripts/admin.js <command> [args]

import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const BCRYPT_ROUNDS = 12;

const [,, command, ...args] = process.argv;

async function main() {
    await initializeDatabase();
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
            case 'migrate-rollback':
                await migrateRollback(args[0] ? parseInt(args[0], 10) : 1);
                break;
            case 'env-check':
                envCheck();
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
        await closeDatabase();
    }
}

async function resetPassword(email, newPassword) {
    if (!email || !newPassword) {
        console.error('Usage: bun scripts/admin.js reset-password <email> <new-password>');
        process.exit(1);
    }
    const user = await query.get('SELECT id, email FROM users WHERE email = ?', [email]);
    if (!user) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await query.run('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, user.id]);
    console.log(`Password updated for ${email}`);
}

async function createUser(email, password, fullName) {
    if (!email || !password || !fullName) {
        console.error('Usage: bun scripts/admin.js create-user <email> <password> <full_name>');
        process.exit(1);
    }
    const existing = await query.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
        console.error(`User already exists with email: ${email}`);
        process.exit(1);
    }
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = uuidv4();
    const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30) + '_' + id.slice(0, 6);
    await query.run(
        'INSERT INTO users (id, email, password_hash, username, full_name, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [id, email, hash, username, fullName]
    );
    console.log(`User created:`);
    console.log(`  id:       ${id}`);
    console.log(`  email:    ${email}`);
    console.log(`  username: ${username}`);
    console.log(`  name:     ${fullName}`);
}

async function setAdmin(email, flag) {
    if (!email) {
        console.error('Usage: bun scripts/admin.js set-admin <email> [true|false]');
        process.exit(1);
    }
    const isAdmin = (flag === undefined || flag === 'true') ? 1 : 0;
    const user = await query.get('SELECT id, email FROM users WHERE email = ?', [email]);
    if (!user) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }
    await query.run('UPDATE users SET is_admin = ?, updated_at = NOW() WHERE id = ?', [isAdmin, user.id]);
    console.log(`${email} is_admin set to ${isAdmin === 1 ? 'true' : 'false'}`);
}

async function listUsers() {
    const users = await query.all(
        'SELECT id, email, full_name, is_admin, created_at FROM users ORDER BY created_at ASC',
        []
    );
    if (users.length === 0) {
        console.log('No users found.');
        return;
    }
    const header = 'ID'.padEnd(38) + 'EMAIL'.padEnd(36) + 'FULL NAME'.padEnd(26) + 'ADMIN'.padEnd(8) + 'CREATED AT';
    console.log(header);
    console.log('-'.repeat(header.length + 10));
    for (const u of users) {
        const admin = u.is_admin ? 'yes' : 'no';
        const created = u.created_at ? String(u.created_at).slice(0, 19) : '--';
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

async function dbStats() {
    const tables = (await query.all(
        "SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
        []
    )).map(r => r.name);

    console.log('Table Row Counts');
    console.log('----------------');
    for (const table of tables) {
        try {
            const row = await query.get(`SELECT COUNT(*) as count FROM "${table}"`, []);
            console.log(`  ${table.padEnd(40)} ${String(row.count).padStart(8)} rows`);
        } catch {
            console.log(`  ${table.padEnd(40)} (error reading)`);
        }
    }

    const sizeRow = await query.get("SELECT pg_size_pretty(pg_database_size(current_database())) as size", []);
    console.log(`\nDatabase size: ${sizeRow?.size || '--'}`);
    console.log(`Tables:        ${tables.length}`);
}

async function migrateStatus() {
    const MIGRATIONS_DIR = join(ROOT_DIR, 'src', 'backend', 'db', 'migrations');

    const tableExists = await query.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations'",
        []
    );
    if (!tableExists) {
        console.error('Error: migrations table does not exist. Run db:init first.');
        process.exit(1);
    }

    const appliedRows = await query.all('SELECT name, applied_at FROM migrations ORDER BY id ASC', []);
    const appliedMap = new Map(appliedRows.map(r => [r.name, r.applied_at]));

    let migrationFiles = [];
    try {
        migrationFiles = readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
            .sort();
    } catch { /* dir may not exist yet */ }

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
        const appliedAt = entry.applied_at ? String(entry.applied_at).slice(0, 19) : '--';
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

    const tableExists = await query.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations'",
        []
    );
    if (!tableExists) {
        console.error('Error: migrations table does not exist. Run db:init first.');
        process.exit(1);
    }

    let migrationFiles = [];
    try {
        migrationFiles = readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
            .sort();
    } catch {
        console.log('No migrations directory found. Nothing to run.');
        return;
    }

    const appliedRows = await query.all('SELECT name FROM migrations', []);
    const appliedSet = new Set(appliedRows.map(r => r.name));
    const pending = migrationFiles.filter(name => !appliedSet.has(name));

    if (pending.length === 0) {
        console.log('All migrations are already applied. Nothing to run.');
        return;
    }

    console.log(`Found ${pending.length} pending migration(s).\n`);

    let succeeded = 0;
    let failed = 0;

    for (const name of pending) {
        const filePath = join(MIGRATIONS_DIR, name);
        if (!existsSync(filePath)) {
            console.log(`  SKIP    ${name} (file not found at ${filePath})`);
            failed++;
            continue;
        }

        if (name.endsWith('.sql')) {
            try {
                const sqlText = readFileSync(filePath, 'utf8');
                await query.exec(sqlText);
                await query.run('INSERT INTO migrations (name, applied_at) VALUES (?, NOW())', [name]);
                console.log(`  OK      ${name}`);
                succeeded++;
            } catch (err) {
                console.error(`  FAILED  ${name}: ${err.message}`);
                failed++;
            }
        } else if (name.endsWith('.js')) {
            try {
                const mod = await import(pathToFileURL(filePath).href);
                if (typeof mod.default === 'function') {
                    await mod.default(query);
                } else if (typeof mod.up === 'function') {
                    await mod.up(query);
                } else {
                    throw new Error('JS migration must export a default function or named `up` function');
                }
                await query.run('INSERT INTO migrations (name, applied_at) VALUES (?, NOW())', [name]);
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

async function migrateRollback(count) {
    const MIGRATIONS_DIR = join(ROOT_DIR, 'src', 'backend', 'db', 'migrations');

    if (!Number.isInteger(count) || count < 1) {
        console.error('Error: count must be a positive integer.');
        process.exit(1);
    }

    const tableExists = await query.get(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migrations'",
        []
    );
    if (!tableExists) {
        console.error('Error: migrations table does not exist. Run db:init first.');
        process.exit(1);
    }

    const applied = await query.all(
        'SELECT name FROM migrations ORDER BY id DESC LIMIT ?',
        [count]
    );

    if (applied.length === 0) {
        console.log('No applied migrations found. Nothing to roll back.');
        return;
    }

    console.log(`WARNING: migrate-rollback only removes the migration record from the migrations table.`);
    console.log(`         It does NOT reverse schema changes (ALTER TABLE, CREATE TABLE, etc.).\n`);
    console.log(`Rolling back ${applied.length} migration(s):\n`);

    for (const row of applied) {
        const name = row.name;
        const filePath = join(MIGRATIONS_DIR, name);
        const isJs = name.endsWith('.js');

        if (isJs && existsSync(filePath)) {
            try {
                const mod = await import(pathToFileURL(filePath).href);
                if (typeof mod.down === 'function') {
                    await mod.down(query);
                    await query.run('DELETE FROM migrations WHERE name = ?', [name]);
                    console.log(`  ROLLED BACK (down)  ${name}`);
                } else {
                    await query.run('DELETE FROM migrations WHERE name = ?', [name]);
                    console.log(`  RECORD REMOVED      ${name} (no down() export — record only)`);
                }
            } catch (err) {
                console.error(`  FAILED              ${name}: ${err.message}`);
            }
        } else {
            await query.run('DELETE FROM migrations WHERE name = ?', [name]);
            console.log(`  RECORD REMOVED      ${name} (SQL — record only, schema unchanged)`);
        }
    }

    console.log(`\nDone. ${applied.length} migration record(s) removed.`);
    console.log('Re-run `migrate-run` to re-apply them.');
}

function envCheck() {
    const examplePath = join(ROOT_DIR, '.env.example');
    const envPath = join(ROOT_DIR, '.env');

    if (!existsSync(examplePath)) {
        console.error('Error: .env.example not found at', examplePath);
        process.exit(1);
    }

    function parseEnvKeys(filePath) {
        if (!existsSync(filePath)) return new Set();
        const lines = readFileSync(filePath, 'utf8').split('\n');
        const keys = new Set();
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const match = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s*=/);
            if (match) keys.add(match[1]);
        }
        return keys;
    }

    const exampleKeys = parseEnvKeys(examplePath);
    const envKeys = parseEnvKeys(envPath);

    const missing = [...exampleKeys].filter(k => !envKeys.has(k));
    const extra = [...envKeys].filter(k => !exampleKeys.has(k));

    console.log('Environment Check');
    console.log('-----------------');
    if (missing.length === 0) {
        console.log('All .env.example variables are present in .env.');
    } else {
        console.log(`\nMissing from .env (${missing.length}):`);
        for (const k of missing) console.log(`  - ${k}`);
    }

    if (extra.length > 0) {
        console.log(`\nCustom additions in .env not in .env.example (${extra.length}):`);
        for (const k of extra) console.log(`  + ${k}`);
    }

    console.log(`\nTotal in .env.example: ${exampleKeys.size} | Total in .env: ${envKeys.size}`);
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
  db-stats                                Show table row counts and DB size
  migrate-status                          Show applied/pending migration status
  migrate-run                             Apply all pending migrations in order
  migrate-rollback [count]                Roll back last N migrations (default: 1)
  env-check                               Compare .env.example with .env (missing/extra vars)
  help                                    Show this help message

Examples:
  bun scripts/admin.js list-users
  bun scripts/admin.js create-user admin@example.com p@ssw0rd "Admin User"
  bun scripts/admin.js set-admin admin@example.com true
  bun scripts/admin.js reset-password user@example.com newpass123
  bun scripts/admin.js db-stats
  bun scripts/admin.js migrate-status
  bun scripts/admin.js migrate-run
  bun scripts/admin.js migrate-rollback
  bun scripts/admin.js migrate-rollback 3
  bun scripts/admin.js env-check
`);
}

main();
