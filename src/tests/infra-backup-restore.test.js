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
        expect(backupSrc).toContain("execFileAsync('gzip'");
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

    test('pg-backup.js enforces local backup retention', () => {
        expect(backupSrc).toContain('cleanupOldBackups');
        expect(backupSrc).toContain('keepCount');
    });

    test('pg-backup.js keeps the seven newest local backups', () => {
        expect(backupSrc).toContain('cleanupOldBackups(backupDir, 7)');
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

// ═══════════════════════════════════════════════════════════════════════════════
// Railway Deploy Verification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Railway deploy verification script', () => {
    const verifierPath = join(ROOT, 'scripts/verify-railway-deploy.mjs');
    const verifierSrc = existsSync(verifierPath) ? readFileSync(verifierPath, 'utf-8') : '';

    test('scripts/verify-railway-deploy.mjs exists', () => {
        expect(existsSync(verifierPath)).toBe(true);
    });

    test('verifier reads Railway status JSON', () => {
        expect(verifierSrc).toContain('railway');
        expect(verifierSrc).toContain('status');
        expect(verifierSrc).toContain('--json');
    });

    test('verifier checks app and worker deployment config', () => {
        expect(verifierSrc).toContain('vaultlister-app');
        expect(verifierSrc).toContain('vaultlister-worker');
        expect(verifierSrc).toContain('/railway.json');
        expect(verifierSrc).toContain('/worker/railway.json');
        expect(verifierSrc).toContain('/api/health/ready');
        expect(verifierSrc).toContain('drainingSeconds');
    });
});
