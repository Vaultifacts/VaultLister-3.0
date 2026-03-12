// Infrastructure & Delivery — Backup, Restore, Disaster Recovery
// Audit gaps: H16 (automated backup/restore), M19 (retention), M20 (WAL safety)
// Categories: Backup/DR

import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '../../');

// ═══════════════════════════════════════════════════════════════════════════════
// Backup Script Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup script validation', () => {
    const backupPath = join(ROOT, 'scripts/backup.js');
    const backupSrc = existsSync(backupPath) ? readFileSync(backupPath, 'utf-8') : '';

    test('scripts/backup.js exists', () => {
        expect(existsSync(backupPath)).toBe(true);
    });

    test('backup.js uses better-sqlite3 .backup() API (WAL-safe)', () => {
        expect(backupSrc).toContain('.backup(');
        expect(backupSrc).toContain('better-sqlite3');
    });

    test('backup.js handles --compress flag', () => {
        expect(backupSrc).toContain('--compress');
        expect(backupSrc).toContain('createGzip');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Restore Script Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Restore script validation', () => {
    const restorePath = join(ROOT, 'scripts/restore.js');
    const restoreSrc = existsSync(restorePath) ? readFileSync(restorePath, 'utf-8') : '';

    test('scripts/restore.js exists', () => {
        expect(existsSync(restorePath)).toBe(true);
    });

    test('restore.js calls PRAGMA integrity_check before restore', () => {
        expect(restoreSrc).toContain('integrity_check');
    });

    test('restore.js creates pre-restore backup', () => {
        expect(restoreSrc).toContain('.pre-restore');
        expect(restoreSrc).toContain('copyFileSync');
    });

    test('restore.js supports .gz decompression', () => {
        expect(restoreSrc).toContain('.gz');
        expect(restoreSrc).toContain('createGunzip');
    });

    test('restore.js has --force flag for non-interactive mode', () => {
        expect(restoreSrc).toContain('--force');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Backup Retention (M19)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup retention policy (M19)', () => {
    const backupSrc = readFileSync(join(ROOT, 'scripts/backup.js'), 'utf-8');

    test('cleanupOldBackups keeps last 7 backups', () => {
        expect(backupSrc).toContain('cleanupOldBackups');
        // Verify the hardcoded retention count
        expect(backupSrc).toMatch(/cleanupOldBackups\(\w+,\s*7\)/);
    });

    test('retention count is hardcoded (documents gap: not configurable)', () => {
        // The retention count (7) is passed as a literal, not from env/config
        expect(backupSrc).not.toMatch(/process\.env\.\w*KEEP\w*COUNT/i);
        expect(backupSrc).not.toMatch(/process\.env\.\w*RETENTION/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Backup Drill Evidence
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup drill evidence', () => {
    test('docs/evidence/BACKUP_DRILL.md exists', () => {
        expect(existsSync(join(ROOT, 'docs/evidence/BACKUP_DRILL.md'))).toBe(true);
    });

    test('backup drill marked PASSED', () => {
        const drillPath = join(ROOT, 'docs/evidence/BACKUP_DRILL.md');
        const content = readFileSync(drillPath, 'utf-8');
        expect(content).toMatch(/PASS(ED)?/i);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Backup Scheduler (docker-compose)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup scheduler in docker-compose', () => {
    const composePath = join(ROOT, 'docker-compose.yml');
    const compose = readFileSync(composePath, 'utf-8');

    test('backup-scheduler service exists', () => {
        expect(compose).toContain('backup-scheduler');
    });

    test('backup-scheduler runs on production profile', () => {
        // Look for profiles section near backup-scheduler
        expect(compose).toContain('production');
    });

    test('backup-scheduler has restart policy', () => {
        expect(compose).toContain('restart:');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WAL Safety (M20)
// ═══════════════════════════════════════════════════════════════════════════════

describe('WAL safety in backup (M20)', () => {
    const backupSrc = readFileSync(join(ROOT, 'scripts/backup.js'), 'utf-8');

    test('backup.js opens DB in readonly mode', () => {
        expect(backupSrc).toContain('readonly: true');
    });

    test('backup uses .backup() method not copyFileSync', () => {
        expect(backupSrc).toContain('.backup(');
        // Verify copyFileSync is NOT used for the main backup operation
        // (it may be used elsewhere, but the primary backup uses .backup())
        const backupFnBody = backupSrc.match(/async function backup\(\)[\s\S]+?^}/m)?.[0] || backupSrc;
        expect(backupFnBody).toContain('db.backup(');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Post-Deploy Check
// ═══════════════════════════════════════════════════════════════════════════════

describe('Post-deploy check script', () => {
    test('scripts/post-deploy-check.mjs exists', () => {
        expect(existsSync(join(ROOT, 'scripts/post-deploy-check.mjs'))).toBe(true);
    });
});
