#!/usr/bin/env bun
// VaultLister PostgreSQL Restore Script
// Usage: bun scripts/pg-restore.js <backup-file> [--force]
//
// Restores a pg_dump custom-format archive (.dump or .dump.gz).
// WARNING: This drops and recreates the public schema — all data will be replaced.

import { existsSync, statSync, unlinkSync, createReadStream, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const force = args.includes('--force');
const backupFile = args.find(a => !a.startsWith('--'));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required.');
    process.exit(1);
}

async function restore() {
    console.log('VaultLister PostgreSQL Restore');
    console.log('==============================\n');

    if (!backupFile) {
        console.log('Usage: bun scripts/pg-restore.js <backup-file> [--force]');
        console.log('\nOptions:');
        console.log('  --force    Skip confirmation prompt');
        console.log('\nExamples:');
        console.log('  bun scripts/pg-restore.js backups/vaultlister-2026-03-25.dump');
        console.log('  bun scripts/pg-restore.js backups/vaultlister-2026-03-25.dump.gz --force');
        process.exit(1);
    }

    if (!existsSync(backupFile)) {
        console.error('Error: Backup file not found:', backupFile);
        process.exit(1);
    }

    const backupSize = statSync(backupFile).size;
    console.log('Backup file:', backupFile);
    console.log('Backup size:', formatBytes(backupSize));
    console.log('Target:     ', DATABASE_URL.replace(/:([^:@]+)@/, ':***@'));

    const isCompressed = backupFile.endsWith('.gz');
    let restoreFile = backupFile;

    if (!force) {
        console.log('\nWARNING: This will drop and recreate the public schema!');
        console.log('All current data will be permanently replaced.\n');
        const confirmed = await confirm('Are you sure you want to restore from this backup?');
        if (!confirmed) {
            console.log('Restore cancelled.');
            process.exit(0);
        }
    }

    try {
        if (isCompressed) {
            console.log('Decompressing backup...');
            restoreFile = backupFile.replace(/\.gz$/, '.tmp');
            await pipeline(
                createReadStream(backupFile),
                createGunzip(),
                createWriteStream(restoreFile)
            );
        }

        console.log('Restoring database...');
        await execFileAsync('pg_restore', [
            '--clean',
            '--if-exists',
            '--no-password',
            '--verbose',
            '--dbname', DATABASE_URL,
            restoreFile,
        ]);

        if (isCompressed) unlinkSync(restoreFile);

        console.log('\nDatabase restored successfully!');
        console.log('Note: Restart the server to pick up the changes.');

    } catch (error) {
        if (isCompressed && restoreFile !== backupFile && existsSync(restoreFile)) {
            unlinkSync(restoreFile);
        }
        console.error('\nRestore failed:', error.message);
        if (error.stderr) console.error(error.stderr);
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
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(`${question} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

restore();
