#!/usr/bin/env node
// Database Backup Automation Script
// Scheduled backups with compression, retention, and cloud sync

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createGzip } from 'zlib';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || join(ROOT_DIR, 'data');
const BACKUP_DIR = process.env.BACKUP_DIR || join(ROOT_DIR, 'backups');
const DB_FILE = join(DATA_DIR, 'vaultlister.db');

// Configuration
const CONFIG = {
    // Retention settings
    dailyRetention: 7,     // Keep daily backups for 7 days
    weeklyRetention: 4,    // Keep weekly backups for 4 weeks
    monthlyRetention: 12,  // Keep monthly backups for 12 months

    // Compression
    compress: true,

    // Cloud sync (OneDrive/AWS S3)
    cloudSync: {
        enabled: process.env.CLOUD_BACKUP_ENABLED === 'true',
        provider: process.env.CLOUD_BACKUP_PROVIDER || 'onedrive', // 'onedrive' or 's3'
        bucket: process.env.S3_BUCKET,
        onedrivePath: process.env.ONEDRIVE_BACKUP_PATH || '/VaultLister/Backups'
    }
};

// Ensure backup directory exists
function ensureBackupDir() {
    const dirs = [
        BACKUP_DIR,
        join(BACKUP_DIR, 'daily'),
        join(BACKUP_DIR, 'weekly'),
        join(BACKUP_DIR, 'monthly')
    ];

    for (const dir of dirs) {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }
}

// Generate backup filename
function generateFilename(type) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const ext = CONFIG.compress ? '.db.gz' : '.db';
    return `vaultlister-${type}-${timestamp}${ext}`;
}

// Create backup
async function createBackup(type = 'daily') {
    const filename = generateFilename(type);
    const backupPath = join(BACKUP_DIR, type, filename);

    console.log(`Creating ${type} backup: ${filename}`);

    if (!existsSync(DB_FILE)) {
        console.error('Database file not found:', DB_FILE);
        process.exit(1);
    }

    // Use SQLite online backup API (safe for WAL mode — includes uncommitted WAL frames)
    const Database = (await import('bun:sqlite')).default;
    const sourceDb = new Database(DB_FILE, { readonly: true });
    const tempPath = backupPath + '.tmp';

    try {
        sourceDb.exec(`VACUUM INTO '${tempPath.replace(/'/g, "''")}'`);
        sourceDb.close();

        if (CONFIG.compress) {
            await pipeline(
                createReadStream(tempPath),
                createGzip(),
                createWriteStream(backupPath)
            );
            unlinkSync(tempPath);
        } else {
            const { renameSync } = await import('fs');
            renameSync(tempPath, backupPath);
        }
    } catch (err) {
        sourceDb.close();
        try { unlinkSync(tempPath); } catch {}
        throw err;
    }

    const stats = statSync(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Backup created: ${backupPath} (${sizeMB} MB)`);

    return backupPath;
}

// Clean up old backups based on retention policy
function cleanupOldBackups() {
    console.log('Cleaning up old backups...');

    const retentionDays = {
        daily: CONFIG.dailyRetention,
        weekly: CONFIG.weeklyRetention * 7,
        monthly: CONFIG.monthlyRetention * 30
    };

    for (const [type, days] of Object.entries(retentionDays)) {
        const dir = join(BACKUP_DIR, type);
        if (!existsSync(dir)) continue;

        const files = readdirSync(dir);
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        for (const file of files) {
            const filePath = join(dir, file);
            const stats = statSync(filePath);

            if (stats.mtime < cutoffDate) {
                unlinkSync(filePath);
                console.log(`Deleted old backup: ${file}`);
            }
        }
    }
}

// Sync to cloud storage
async function syncToCloud(backupPath) {
    if (!CONFIG.cloudSync.enabled) return;

    console.log(`Syncing to ${CONFIG.cloudSync.provider}...`);

    if (CONFIG.cloudSync.provider === 's3') {
        await syncToS3(backupPath);
    } else if (CONFIG.cloudSync.provider === 'onedrive') {
        await syncToOneDrive(backupPath);
    }
}

// Sync via rclone (supports S3, B2, GCS, OneDrive, and 40+ providers)
async function syncViaRclone(backupPath) {
    try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const remote = process.env.VAULTLISTER_RCLONE_REMOTE || 'vaultlister-backup';
        const remotePath = process.env.VAULTLISTER_REMOTE_PATH || 'VaultLister/Backups';
        const rclone = process.env.RCLONE_PATH || `${process.env.HOME || process.env.USERPROFILE}/.local/bin/rclone`;

        const filename = backupPath.split('/').pop();
        const parentDir = dirname(backupPath);

        await execAsync(`"${rclone}" copy "${parentDir}" "${remote}:${remotePath}" --include "${filename}" --log-level INFO`);
        console.log(`Uploaded to ${remote}:${remotePath}/${filename}`);

        // Update manifest
        try {
            const { addEntry, updateLastSync } = await import('./lib/backup-manifest.js');
            await addEntry({ filename, filePath: backupPath, remote: `${remote}:${remotePath}`, remoteVerified: true });
            updateLastSync(`${remote}:${remotePath}`);
        } catch { /* manifest tracking is optional */ }
    } catch (error) {
        console.error('Cloud sync failed:', error.message);
        console.log('Tip: Run "bash scripts/backup-cloud-sync.sh --status" to check setup');
        console.log('See: docs/CLOUD_BACKUP_SETUP.md for configuration');
    }
}

// Legacy aliases for backward compatibility
async function syncToS3(backupPath) { return syncViaRclone(backupPath); }
async function syncToOneDrive(backupPath) { return syncViaRclone(backupPath); }

// Get backup statistics
function getBackupStats() {
    const stats = {
        daily: { count: 0, totalSize: 0, oldest: null, newest: null },
        weekly: { count: 0, totalSize: 0, oldest: null, newest: null },
        monthly: { count: 0, totalSize: 0, oldest: null, newest: null }
    };

    for (const type of ['daily', 'weekly', 'monthly']) {
        const dir = join(BACKUP_DIR, type);
        if (!existsSync(dir)) continue;

        const files = readdirSync(dir).map(f => ({
            name: f,
            path: join(dir, f),
            ...statSync(join(dir, f))
        })).sort((a, b) => b.mtime - a.mtime);

        stats[type].count = files.length;
        stats[type].totalSize = files.reduce((sum, f) => sum + f.size, 0);
        stats[type].oldest = files[files.length - 1]?.name;
        stats[type].newest = files[0]?.name;
    }

    return stats;
}

// Print backup status
function printStatus() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    BACKUP STATUS');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const stats = getBackupStats();

    for (const [type, data] of Object.entries(stats)) {
        const sizeMB = (data.totalSize / (1024 * 1024)).toFixed(2);
        console.log(`${type.toUpperCase()} Backups:`);
        console.log(`  Count: ${data.count}`);
        console.log(`  Total Size: ${sizeMB} MB`);
        console.log(`  Newest: ${data.newest || 'None'}`);
        console.log(`  Oldest: ${data.oldest || 'None'}`);
        console.log('');
    }

    console.log('Retention Policy:');
    console.log(`  Daily: ${CONFIG.dailyRetention} days`);
    console.log(`  Weekly: ${CONFIG.weeklyRetention} weeks`);
    console.log(`  Monthly: ${CONFIG.monthlyRetention} months`);
    console.log('');
    console.log(`Cloud Sync: ${CONFIG.cloudSync.enabled ? CONFIG.cloudSync.provider : 'Disabled'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
}

// Determine backup type based on day
function determineBackupType() {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const dayOfWeek = now.getDay();

    // Monthly backup on the 1st
    if (dayOfMonth === 1) {
        return 'monthly';
    }

    // Weekly backup on Sundays
    if (dayOfWeek === 0) {
        return 'weekly';
    }

    // Daily backup otherwise
    return 'daily';
}

// Main function
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'backup';

    ensureBackupDir();

    switch (command) {
        case 'backup':
        case 'daily':
        case 'weekly':
        case 'monthly': {
            const type = command === 'backup' ? determineBackupType() : command;
            const backupPath = await createBackup(type);
            await syncToCloud(backupPath);
            cleanupOldBackups();
            break;
        }

        case 'status':
            printStatus();
            break;

        case 'cleanup':
            cleanupOldBackups();
            console.log('Cleanup complete');
            break;

        case 'sync': {
            const latestDaily = join(BACKUP_DIR, 'daily');
            const files = readdirSync(latestDaily).sort().reverse();
            if (files.length > 0) {
                await syncToCloud(join(latestDaily, files[0]));
            } else {
                console.log('No backups to sync');
            }
            break;
        }

        case 'help':
        default:
            console.log(`
VaultLister Backup Automation

Usage:
  bun run scripts/backup-automation.js [command]

Commands:
  backup    - Create backup (auto-determines daily/weekly/monthly)
  daily     - Create daily backup
  weekly    - Create weekly backup
  monthly   - Create monthly backup
  status    - Show backup statistics
  cleanup   - Remove old backups based on retention policy
  sync      - Sync latest backup to cloud
  help      - Show this help message

Environment Variables:
  DATA_DIR                - Database directory (default: ./data)
  BACKUP_DIR              - Backup directory (default: ./backups)
  CLOUD_BACKUP_ENABLED    - Enable cloud sync (true/false)
  CLOUD_BACKUP_PROVIDER   - Cloud provider (onedrive/s3)
  S3_BUCKET               - S3 bucket name
  ONEDRIVE_BACKUP_PATH    - OneDrive backup path

Examples:
  bun run scripts/backup-automation.js backup
  bun run scripts/backup-automation.js status
  CLOUD_BACKUP_ENABLED=true bun run scripts/backup-automation.js backup
            `);
    }
}

main().catch(console.error);
