#!/usr/bin/env bun
// VaultLister Database Restore Script
// Usage: bun run scripts/restore.js <backup-file> [--force]

import { existsSync, copyFileSync, statSync, unlinkSync, createReadStream, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';
import * as readline from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'vaultlister.db');

// Parse command line arguments
const args = process.argv.slice(2);
const force = args.includes('--force');
const backupFile = args.find(a => !a.startsWith('--'));

async function restore() {
    console.log('VaultLister Database Restore');
    console.log('============================\n');

    // Validate arguments
    if (!backupFile) {
        console.log('Usage: bun run scripts/restore.js <backup-file> [--force]');
        console.log('\nOptions:');
        console.log('  --force    Skip confirmation prompt');
        console.log('\nExamples:');
        console.log('  bun run scripts/restore.js backups/vaultlister-2026-02-02.db');
        console.log('  bun run scripts/restore.js backups/vaultlister-2026-02-02.db.gz --force');
        process.exit(1);
    }

    // Check if backup file exists
    if (!existsSync(backupFile)) {
        console.error('Error: Backup file not found:', backupFile);
        process.exit(1);
    }

    const backupSize = statSync(backupFile).size;
    console.log('Backup file:', backupFile);
    console.log('Backup size:', formatBytes(backupSize));

    // Check if it's compressed
    const isCompressed = backupFile.endsWith('.gz');
    let restoreFile = backupFile;

    if (isCompressed) {
        console.log('Backup is compressed, will decompress during restore.');
    }

    // Show current database info if it exists
    if (existsSync(DB_PATH)) {
        const currentSize = statSync(DB_PATH).size;
        console.log('\nCurrent database:', DB_PATH);
        console.log('Current size:', formatBytes(currentSize));
    }

    // Confirm unless --force is specified
    if (!force) {
        console.log('\nWARNING: This will replace your current database!');
        console.log('All current data will be lost unless you have a backup.\n');

        const confirmed = await confirm('Are you sure you want to restore from this backup?');
        if (!confirmed) {
            console.log('Restore cancelled.');
            process.exit(0);
        }
    }

    try {
        // Create backup of current database before restore
        if (existsSync(DB_PATH)) {
            const preRestoreBackup = DB_PATH + '.pre-restore';
            console.log('\nBacking up current database to:', preRestoreBackup);
            copyFileSync(DB_PATH, preRestoreBackup);
        }

        // Decompress if needed
        if (isCompressed) {
            console.log('Decompressing backup...');
            const tempFile = backupFile.replace('.gz', '.temp');
            await pipeline(
                createReadStream(backupFile),
                createGunzip(),
                createWriteStream(tempFile)
            );
            restoreFile = tempFile;
        }

        // Validate backup is a valid SQLite database using better-sqlite3
        console.log('Validating backup integrity...');
        try {
            const testDb = new Database(restoreFile, { readonly: true });
            const result = testDb.pragma('integrity_check');
            testDb.close();
            if (result[0].integrity_check !== 'ok') {
                throw new Error('Integrity check failed: ' + result[0].integrity_check);
            }
        } catch (error) {
            console.error('Error: Backup file is not a valid SQLite database');
            console.error('  ' + error.message);
            if (isCompressed && restoreFile !== backupFile) {
                unlinkSync(restoreFile);
            }
            process.exit(1);
        }

        // Perform restore
        console.log('Restoring database...');
        copyFileSync(restoreFile, DB_PATH);

        // Clean up temp file if we decompressed
        if (isCompressed && restoreFile !== backupFile) {
            unlinkSync(restoreFile);
        }

        // Verify restored database
        const restoredSize = statSync(DB_PATH).size;
        console.log('\nDatabase restored successfully!');
        console.log('Restored size:', formatBytes(restoredSize));

        // Show table counts using better-sqlite3
        console.log('\nVerifying data...');
        const db = new Database(DB_PATH, { readonly: true });
        const tables = ['users', 'inventory', 'listings', 'sales', 'shops'];
        for (const table of tables) {
            try {
                const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
                console.log(`  ${table}: ${row.count} records`);
            } catch (e) {
                console.log(`  ${table}: (table not found)`);
            }
        }
        db.close();

        console.log('\nRestore complete!');
        console.log('\nNote: You may need to restart the server to pick up the changes.');

    } catch (error) {
        console.error('\nRestore failed:', error.message);

        // Offer to restore pre-restore backup
        const preRestoreBackup = DB_PATH + '.pre-restore';
        if (existsSync(preRestoreBackup)) {
            console.log('\nA backup of your previous database was saved.');
            const rollback = await confirm('Would you like to roll back to your previous database?');
            if (rollback) {
                copyFileSync(preRestoreBackup, DB_PATH);
                console.log('Rolled back to previous database.');
            }
        }

        process.exit(1);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function confirm(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${question} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

// Run restore
restore();
