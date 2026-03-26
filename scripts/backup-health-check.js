#!/usr/bin/env node
// Backup Health Check Script
// Validates backup age, file integrity, retention counts, and disk space

import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const BACKUP_DIR = process.env.BACKUP_DIR || join(ROOT_DIR, 'backups');

// Retention policy — must match backup-automation.js CONFIG
const RETENTION = {
    daily:   7,
    weekly:  4,
    monthly: 12
};

// Age thresholds in milliseconds
const WARN_AGE_MS     = 25 * 60 * 60 * 1000;  // 25 hours
const CRITICAL_AGE_MS = 49 * 60 * 60 * 1000;  // 49 hours

// pg_dump custom format magic bytes: "PGDMP" (5 bytes)
const PGDUMP_MAGIC = Buffer.from([0x50, 0x47, 0x44, 0x4D, 0x50]);

// Gzip magic bytes: 0x1f 0x8b
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFileHeader(filePath, length) {
    const buf = Buffer.alloc(length);
    const fd = openSync(filePath, 'r');
    try {
        readSync(fd, buf, 0, length, 0);
    } finally {
        closeSync(fd);
    }
    return buf;
}

function isValidPgDumpFile(filePath) {
    try {
        const header = readFileHeader(filePath, 5);
        return header.equals(PGDUMP_MAGIC);
    } catch {
        return false;
    }
}

function isValidGzipFile(filePath) {
    try {
        const header = readFileHeader(filePath, 2);
        return header[0] === GZIP_MAGIC[0] && header[1] === GZIP_MAGIC[1];
    } catch {
        return false;
    }
}

function getBackupFiles(type) {
    const dir = join(BACKUP_DIR, type);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter(f => f.endsWith('.dump') || f.endsWith('.dump.gz'))
        .map(f => {
            const filePath = join(dir, f);
            const stats = statSync(filePath);
            return { name: f, path: filePath, mtime: stats.mtime, size: stats.size };
        })
        .sort((a, b) => b.mtime - a.mtime);
}

async function getDiskUsage(dirPath) {
    if (!existsSync(dirPath)) return { available: null, used: 0 };

    let used = 0;
    for (const type of ['daily', 'weekly', 'monthly']) {
        const subDir = join(dirPath, type);
        if (!existsSync(subDir)) continue;
        for (const f of readdirSync(subDir)) {
            try {
                used += statSync(join(subDir, f)).size;
            } catch { /* skip unreadable files */ }
        }
    }

    // Attempt to read available space via statvfs (Bun exposes this on Linux/macOS)
    // Falls back to null on Windows where statvfs is unavailable
    let available = null;
    try {
        const os = await import('os');
        // Use df-style check only if running on a POSIX system
        if (process.platform !== 'win32') {
            const { execSync } = await import('child_process');
            const output = execSync(`df -k "${dirPath}" 2>/dev/null | tail -1`).toString();
            const parts = output.trim().split(/\s+/);
            if (parts.length >= 4) {
                available = parseInt(parts[3], 10) * 1024;
            }
        }
    } catch { /* disk space is advisory — failure is non-fatal */ }

    return { available, used };
}

// ── Check functions ───────────────────────────────────────────────────────────

function checkBackupAge() {
    const allFiles = [
        ...getBackupFiles('daily'),
        ...getBackupFiles('weekly'),
        ...getBackupFiles('monthly')
    ].sort((a, b) => b.mtime - a.mtime);

    if (allFiles.length === 0) {
        return {
            name: 'backup_age',
            status: 'critical',
            message: 'No backup files found in any backup directory',
            detail: null
        };
    }

    const newest = allFiles[0];
    const ageMs = Date.now() - newest.mtime.getTime();
    const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);

    if (ageMs >= CRITICAL_AGE_MS) {
        return {
            name: 'backup_age',
            status: 'critical',
            message: `Most recent backup is ${ageHours}h old (critical threshold: 49h)`,
            detail: { newestFile: newest.name, ageHours: parseFloat(ageHours) }
        };
    }

    if (ageMs >= WARN_AGE_MS) {
        return {
            name: 'backup_age',
            status: 'warning',
            message: `Most recent backup is ${ageHours}h old (warn threshold: 25h)`,
            detail: { newestFile: newest.name, ageHours: parseFloat(ageHours) }
        };
    }

    return {
        name: 'backup_age',
        status: 'healthy',
        message: `Most recent backup is ${ageHours}h old`,
        detail: { newestFile: newest.name, ageHours: parseFloat(ageHours) }
    };
}

function checkFileIntegrity() {
    const failures = [];
    let checked = 0;

    // Only verify the most recent file per tier to keep the check fast
    for (const type of ['daily', 'weekly', 'monthly']) {
        const files = getBackupFiles(type);
        if (files.length === 0) continue;

        const newest = files[0];
        checked++;

        const isGzip = newest.name.endsWith('.gz');
        const valid = isGzip
            ? isValidGzipFile(newest.path)
            : isValidPgDumpFile(newest.path);

        if (!valid) {
            failures.push({ tier: type, file: newest.name, compressed: isGzip });
        }
    }

    if (checked === 0) {
        return {
            name: 'file_integrity',
            status: 'warning',
            message: 'No backup files available to verify',
            detail: { checked: 0, failures: [] }
        };
    }

    if (failures.length > 0) {
        return {
            name: 'file_integrity',
            status: 'critical',
            message: `${failures.length} of ${checked} checked backup(s) failed header validation`,
            detail: { checked, failures }
        };
    }

    return {
        name: 'file_integrity',
        status: 'healthy',
        message: `All ${checked} sampled backup header(s) are valid`,
        detail: { checked, failures: [] }
    };
}

function checkRetentionCounts() {
    const expected = {
        daily:   RETENTION.daily,
        weekly:  RETENTION.weekly,
        monthly: RETENTION.monthly
    };

    const results = {};
    let worstStatus = 'healthy';

    for (const [type, minCount] of Object.entries(expected)) {
        const files = getBackupFiles(type);
        const count = files.length;

        let status = 'healthy';
        if (count === 0) {
            status = 'critical';
        } else if (count < Math.ceil(minCount / 2)) {
            // Fewer than half the expected count is a warning
            status = 'warning';
        }

        if (status === 'critical') worstStatus = 'critical';
        else if (status === 'warning' && worstStatus !== 'critical') worstStatus = 'warning';

        results[type] = { count, expected: minCount, status };
    }

    const summary = Object.entries(results)
        .map(([t, r]) => `${t}: ${r.count}/${r.expected}`)
        .join(', ');

    return {
        name: 'retention_counts',
        status: worstStatus,
        message: worstStatus === 'healthy'
            ? `Retention counts within policy (${summary})`
            : `Retention counts below policy (${summary})`,
        detail: results
    };
}

async function checkDiskSpace() {
    let diskInfo;
    try {
        diskInfo = await (async () => {
            let available = null;
            let used = 0;

            for (const type of ['daily', 'weekly', 'monthly']) {
                const subDir = join(BACKUP_DIR, type);
                if (!existsSync(subDir)) continue;
                for (const f of readdirSync(subDir)) {
                    try { used += statSync(join(subDir, f)).size; } catch { /* skip */ }
                }
            }

            if (process.platform !== 'win32') {
                try {
                    const { execSync } = await import('child_process');
                    const output = execSync(`df -k "${BACKUP_DIR}" 2>/dev/null | tail -1`).toString();
                    const parts = output.trim().split(/\s+/);
                    if (parts.length >= 4) available = parseInt(parts[3], 10) * 1024;
                } catch { /* non-fatal */ }
            }

            return { available, used };
        })();
    } catch {
        diskInfo = { available: null, used: 0 };
    }

    const usedMB = (diskInfo.used / (1024 * 1024)).toFixed(1);

    if (diskInfo.available === null) {
        return {
            name: 'disk_space',
            status: 'healthy',
            message: `Backup storage using ${usedMB} MB (available space unknown on this platform)`,
            detail: { usedBytes: diskInfo.used, availableBytes: null }
        };
    }

    const availableMB = (diskInfo.available / (1024 * 1024)).toFixed(1);
    const availableGB = diskInfo.available / (1024 * 1024 * 1024);

    let status = 'healthy';
    let message = `Backup storage using ${usedMB} MB, ${availableMB} MB available`;

    if (availableGB < 0.5) {
        status = 'critical';
        message = `Critically low disk space: only ${availableMB} MB available in backup directory`;
    } else if (availableGB < 2) {
        status = 'warning';
        message = `Low disk space: only ${availableMB} MB available in backup directory`;
    }

    return {
        name: 'disk_space',
        status,
        message,
        detail: { usedBytes: diskInfo.used, availableBytes: diskInfo.available }
    };
}

// ── Output ────────────────────────────────────────────────────────────────────

function aggregateStatus(checks) {
    if (checks.some(c => c.status === 'critical')) return 'critical';
    if (checks.some(c => c.status === 'warning'))  return 'warning';
    return 'healthy';
}

function printHuman(result) {
    const icons = { healthy: '[OK]', warning: '[WARN]', critical: '[CRIT]' };
    const bar = '─'.repeat(62);

    console.log(`\n${bar}`);
    console.log('  BACKUP HEALTH CHECK');
    console.log(`${bar}\n`);
    console.log(`  Overall status : ${result.status.toUpperCase()}`);
    console.log(`  Timestamp      : ${result.timestamp}\n`);
    console.log(bar);

    for (const check of result.checks) {
        const icon = icons[check.status] || '[?]';
        console.log(`  ${icon.padEnd(7)} ${check.name.padEnd(20)} ${check.message}`);
    }

    console.log(`${bar}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const checks = [
        checkBackupAge(),
        checkFileIntegrity(),
        checkRetentionCounts(),
        await checkDiskSpace()
    ];

    const result = {
        status: aggregateStatus(checks),
        checks,
        timestamp: new Date().toISOString()
    };

    if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        printHuman(result);
    }

    if (result.status === 'critical') process.exit(2);
    if (result.status === 'warning')  process.exit(1);
    process.exit(0);
}

main().catch(err => {
    const result = {
        status: 'critical',
        checks: [{
            name: 'script_error',
            status: 'critical',
            message: err.message,
            detail: null
        }],
        timestamp: new Date().toISOString()
    };

    if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error('[CRIT] Health check script failed:', err.message);
    }
    process.exit(2);
});
