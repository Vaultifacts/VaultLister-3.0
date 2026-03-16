#!/usr/bin/env node
'use strict';
// Admin CLI for VaultLister 3.0
// Usage: bun scripts/admin.js <command> [args]

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  help                                    Show this help message

Examples:
  bun scripts/admin.js list-users
  bun scripts/admin.js create-user admin@example.com p@ssw0rd "Admin User"
  bun scripts/admin.js set-admin admin@example.com true
  bun scripts/admin.js reset-password user@example.com newpass123
  bun scripts/admin.js db-stats
`);
}

main();
