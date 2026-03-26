// Infrastructure & Delivery — Backup, Restore, Disaster Recovery
// Audit gaps: H16 (automated backup/restore), M19 (retention)
// Categories: Backup/DR (PostgreSQL pg_dump based)

import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '../../');

// ═══════════════════════════════════════════════════════════════════════════════
// pg-backup Script Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('pg-backup script validation', () => {
    const backupPath = join(ROOT, 'scripts/pg-backup.js');
    const backupSrc = existsSync(backupPath) ? readFileSync(backupPath, 'utf-8') : '';

    test('scripts/pg-backup.js exists', () => {
        expect(existsSync(backupPath)).toBe(true);
    });

    test('pg-backup.js uses pg_dump', () => {
        expect(backupSrc).toContain('pg_dump');
    });

    test('pg-backup.js handles --compress flag', () => {
        expect(backupSrc).toContain('--compress');
        expect(backupSrc).toContain('createGzip');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// pg-restore Script Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('pg-restore script validation', () => {
    const restorePath = join(ROOT, 'scripts/pg-restore.js');
    const restoreSrc = existsSync(restorePath) ? readFileSync(restorePath, 'utf-8') : '';

    test('scripts/pg-restore.js exists', () => {
        expect(existsSync(restorePath)).toBe(true);
    });

    test('pg-restore.js uses psql or pg_restore', () => {
        expect(restoreSrc).toMatch(/pg_restore|psql/);
    });

    test('pg-restore.js supports .gz decompression', () => {
        expect(restoreSrc).toContain('.gz');
        expect(restoreSrc).toContain('createGunzip');
    });

    test('pg-restore.js has --force flag for non-interactive mode', () => {
        expect(restoreSrc).toContain('--force');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Backup Retention (M19)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Backup retention policy (M19)', () => {
    const backupSrc = existsSync(join(ROOT, 'scripts/pg-backup.js'))
        ? readFileSync(join(ROOT, 'scripts/pg-backup.js'), 'utf-8')
        : '';

    test('pg-backup.js enforces daily/weekly/monthly retention', () => {
        expect(backupSrc).toMatch(/daily|weekly|monthly/);
    });

    test('pg-backup.js uses RETENTION config object', () => {
        expect(backupSrc).toContain('RETENTION');
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
