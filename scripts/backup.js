#!/usr/bin/env bun
// VaultLister Database Backup Script
// Usage: bun run scripts/backup.js [--output <path>] [--compress]

import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync, createReadStream, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'vaultlister.db');
const DEFAULT_BACKUP_DIR = join(ROOT_DIR, 'backups');

// Parse command line arguments
const args = process.argv.slice(2);
const compress = args.includes('--compress');
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

async function backup() {
    console.log('VaultLister Database Backup');
    console.log('===========================\n');

    // Check if database exists
    if (!existsSync(DB_PATH)) {
        console.error('Error: Database not found at', DB_PATH);
        process.exit(1);
    }

    // Determine backup directory
    const backupDir = outputPath ? dirname(outputPath) : DEFAULT_BACKUP_DIR;

    // Create backup directory if it doesn't exist
    if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
        console.log('Created backup directory:', backupDir);
    }

    // Generate backup filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = outputPath || join(backupDir, `vaultlister-${timestamp}.db`);

    try {
        // Create backup using better-sqlite3's backup API (safe for WAL mode)
        console.log('Creating backup...');
        console.log('  Source:', DB_PATH);
        console.log('  Destination:', backupName);

        const db = new Database(DB_PATH, { readonly: true });
        await db.backup(backupName);
        db.close();

        // Verify backup
        const originalSize = statSync(DB_PATH).size;
        const backupSize = statSync(backupName).size;

        console.log('\nBackup created successfully!');
        console.log('  Original size:', formatBytes(originalSize));
        console.log('  Backup size:', formatBytes(backupSize));

        // Compress if requested
        if (compress) {
            console.log('\nCompressing backup...');
            const compressedPath = backupName + '.gz';
            await pipeline(
                createReadStream(backupName),
                createGzip(),
                createWriteStream(compressedPath)
            );
            const compressedSize = statSync(compressedPath).size;
            unlinkSync(backupName); // Remove uncompressed after successful compression
            console.log('  Compressed size:', formatBytes(compressedSize));
            console.log('  Compression ratio:', ((1 - compressedSize / backupSize) * 100).toFixed(1) + '%');
            console.log('\nBackup saved to:', compressedPath);
        } else {
            console.log('\nBackup saved to:', backupName);
        }

        // Clean up old backups (keep last 7)
        cleanupOldBackups(backupDir, 7);

        console.log('\nBackup complete!');

    } catch (error) {
        console.error('Backup failed:', error.message);
        process.exit(1);
    }
}

function cleanupOldBackups(dir, keepCount) {
    try {
        const files = readdirSync(dir)
            .filter(f => f.startsWith('vaultlister-') && (f.endsWith('.db') || f.endsWith('.db.gz')))
            .map(f => ({
                name: f,
                path: join(dir, f),
                mtime: statSync(join(dir, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length > keepCount) {
            console.log(`\nCleaning up old backups (keeping ${keepCount} most recent)...`);
            const toDelete = files.slice(keepCount);
            for (const file of toDelete) {
                unlinkSync(file.path);
                console.log('  Deleted:', file.name);
            }
        }
    } catch (error) {
        console.warn('Warning: Failed to cleanup old backups:', error.message);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run backup
backup();
