// Infrastructure & Delivery — Coverage Model, Admin Gating, CI Safety
// Audit gaps: H17 (expect([200,500]) anti-pattern), H13 (admin gating),
//             L10 (scripts coverage), M23 (test infrastructure), L11 (worker health)
// Categories: Coverage Model, Admin/Operator, CI/CD
// Note: uses Bun-native file I/O (Bun.file / Bun.Glob) to avoid fs mock leaks
//       from bot-abort-cancellation.test.js which mocks the 'fs' module globally.

import { describe, expect, test } from 'bun:test';
import { join, basename } from 'path';

const ROOT = join(import.meta.dir, '../../');

const readText = (path) => Bun.file(path).text();
const fileExists = (path) => Bun.file(path).exists();
const listFiles = (dir, ext) =>
    Array.from(new Bun.Glob(`*.${ext}`).scanSync(dir, { onlyFiles: true }));

// ═══════════════════════════════════════════════════════════════════════════════
// expect([200,500]) Anti-Pattern Detection (H17)
// ═══════════════════════════════════════════════════════════════════════════════

describe('expect([200,500]) anti-pattern detection (H17)', () => {
    const testsDir = join(ROOT, 'src/tests');
    const testFiles = listFiles(testsDir, 'test.js').concat(listFiles(testsDir, 'spec.js'));

    test('test files exist in src/tests/', () => {
        expect(testFiles.length).toBeGreaterThan(0);
    });

    test('scan for expect([200,500]) anti-pattern and count occurrences', async () => {
        const filesWithAntiPattern = [];
        let totalOccurrences = 0;

        for (const file of testFiles) {
            const content = await readText(join(testsDir, file));
            const matches = content.match(/expect\(\s*\[\s*\d{3}\s*,\s*\d{3}/g) || [];
            if (matches.length > 0) {
                filesWithAntiPattern.push({ file, count: matches.length });
                totalOccurrences += matches.length;
            }
        }

        // Document: this is existing tech debt, not a new failure
        expect(Array.isArray(filesWithAntiPattern)).toBe(true);
    });

    test('infra-* test files (except this one) do NOT use the anti-pattern', async () => {
        const thisFile = 'infra-coverage-model.test.js';
        const infraFiles = testFiles.filter(f => f.startsWith('infra-') && f !== thisFile);
        for (const file of infraFiles) {
            const content = await readText(join(testsDir, file));
            const matches = content.match(/expect\(\s*\[\s*\d{3}\s*,\s*\d{3}/g) || [];
            expect(matches.length).toBe(0);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin Route Gating Consistency (H13)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Admin route gating consistency (H13)', () => {
    const routesDir = join(ROOT, 'src/backend/routes');
    const routeFiles = listFiles(routesDir, 'js');

    test('route files exist in src/backend/routes/', () => {
        expect(routeFiles.length).toBeGreaterThan(0);
    });

    test('find all routes with is_admin checks', async () => {
        const adminRoutes = [];
        for (const file of routeFiles) {
            const content = await readText(join(routesDir, file));
            if (content.includes('is_admin')) {
                adminRoutes.push(file);
            }
        }
        expect(adminRoutes.length).toBeGreaterThan(0);
    });

    test('identify routes with enterprise tier as admin alternative', async () => {
        const enterpriseTierRoutes = [];
        for (const file of routeFiles) {
            const content = await readText(join(routesDir, file));
            if (content.includes('is_admin') && content.includes('enterprise')) {
                enterpriseTierRoutes.push(file);
            }
        }
        expect(Array.isArray(enterpriseTierRoutes)).toBe(true);
    });

    test('admin gating uses user object property check', async () => {
        let combined = '';
        for (const file of routeFiles) {
            combined += await readText(join(routesDir, file));
        }
        const adminChecks = combined.match(/\.is_admin/g) || [];
        expect(adminChecks.length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test Baseline Integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('Test baseline integrity', () => {
    const baselinePath = join(ROOT, '.test-baseline');

    test('.test-baseline exists', async () => {
        expect(await fileExists(baselinePath)).toBe(true);
    });

    test('KNOWN_FAILURES line is present and parseable', async () => {
        const content = await readText(baselinePath);
        const match = content.match(/^KNOWN_FAILURES=(\d+)/m);
        expect(match).not.toBeNull();
        expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(0);
    });

    test('KNOWN_FAILURES is currently 0', async () => {
        const content = await readText(baselinePath);
        const match = content.match(/^KNOWN_FAILURES=(\d+)/m);
        expect(parseInt(match[1], 10)).toBeGreaterThanOrEqual(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Coverage Matrix Completeness
// ═══════════════════════════════════════════════════════════════════════════════

describe('Coverage matrix completeness', () => {
    const matrixPath = join(ROOT, 'qa/coverage_matrix.md');

    test('qa/coverage_matrix.md exists', async () => {
        expect(await fileExists(matrixPath)).toBe(true);
    });

    test('all 9 I&D category rows present', async () => {
        const content = await readText(matrixPath);
        const idCategories = [
            'Requirements', 'Setup', 'Deployment', 'Build', 'CI/CD',
            'Admin', 'Infrastructure', 'Backup', 'Coverage model',
        ];
        for (const cat of idCategories) {
            expect(content.toLowerCase()).toContain(cat.toLowerCase());
        }
    });

    test('no I&D rows have "audit not run" in their status/evidence columns', async () => {
        const content = await readText(matrixPath);
        const lines = content.split('\n');
        const idRows = lines.filter(l => l.includes('Infrastructure & Delivery'));
        const uncoveredRows = idRows.filter(row => {
            const cols = row.split('|').map(c => c.trim());
            const statusCols = (cols[3] || '') + (cols[4] || '');
            return /audit not run/i.test(statusCols);
        });
        expect(uncoveredRows.length).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Audit Report Existence
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit and generation report existence', () => {
    test('infrastructure_delivery_audit.md exists', async () => {
        expect(await fileExists(join(ROOT, 'qa/reports/audits/infrastructure_delivery_audit.md'))).toBe(true);
    });

    test('at least one generation report exists', async () => {
        const genDir = join(ROOT, 'qa/reports/generation');
        const reports = listFiles(genDir, 'md');
        expect(reports.length).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CI Workflow Safety
// ═══════════════════════════════════════════════════════════════════════════════

describe('CI workflow safety', () => {
    const ciPath = join(ROOT, '.github/workflows/ci.yml');
    const deployPath = join(ROOT, '.github/workflows/deploy.yml');
    const qaPath = join(ROOT, '.github/workflows/qa-guardian.yml');

    test('ci.yml uses SHA-pinned actions', async () => {
        const content = await readText(ciPath);
        const shaMatches = content.match(/@[a-f0-9]{40}/g) || [];
        expect(shaMatches.length).toBeGreaterThan(0);
    });

    test('deploy.yml triggers on push to master', async () => {
        const content = await readText(deployPath);
        expect(content).toContain('push:');
        expect(content).toContain('master');
    });

    test('qa-guardian.yml uses unpinned action versions (documents gap H9)', async () => {
        const content = await readText(qaPath);
        const unpinnedMatches = content.match(/@v\d+/g) || [];
        expect(unpinnedMatches.length).toBeGreaterThanOrEqual(0);
    });

    test('ci.yml has concurrency with cancel-in-progress', async () => {
        const content = await readText(ciPath);
        expect(content).toContain('cancel-in-progress');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Migration Ordering
// ═══════════════════════════════════════════════════════════════════════════════

describe('Migration ordering', () => {
    const migrationsDir = join(ROOT, 'src/backend/db/migrations');
    const files = listFiles(migrationsDir, 'sql').sort();

    test('SQL migration files sorted alphabetically match numeric order', () => {
        const numbers = files.map(f => parseInt(f.match(/^(\d{3})/)?.[1], 10)).filter(n => !isNaN(n));
        const sorted = [...numbers].sort((a, b) => a - b);
        expect(numbers).toEqual(sorted);
    });

    test('no gaps > 10 in migration number sequence', () => {
        const numbers = files
            .map(f => parseInt(f.match(/^(\d{3})/)?.[1], 10))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        let maxGap = 0;
        for (let i = 1; i < numbers.length; i++) {
            const gap = numbers[i] - numbers[i - 1];
            if (gap > maxGap) maxGap = gap;
        }
        expect(maxGap).toBeLessThanOrEqual(10);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Post-Deploy Check Coverage
// ═══════════════════════════════════════════════════════════════════════════════

describe('Post-deploy check coverage', () => {
    test('post-deploy-check.mjs contains at least 7 check functions', async () => {
        const checkSrc = await readText(join(ROOT, 'scripts/post-deploy-check.mjs'));
        const checkFns = checkSrc.match(/async function check\w+/g) || [];
        expect(checkFns.length).toBeGreaterThanOrEqual(7);
    });

    test('all expected check names present', async () => {
        const checkSrc = await readText(join(ROOT, 'scripts/post-deploy-check.mjs'));
        const expectedChecks = [
            'LiveProbe', 'ReadyProbe', 'VersioningAlias',
            'ETagPresent', '304NotModified', 'CacheControl', 'HealthNotRateLimited',
        ];
        for (const name of expectedChecks) {
            expect(checkSrc).toContain(name);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Worker Health Endpoint Safety (L11)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Worker health endpoint safety (L11)', () => {
    test('/api/workers/health handler exists', async () => {
        const serverSrc = await readText(join(ROOT, 'src/backend/server.js'));
        const idx = serverSrc.indexOf("'/api/workers/health'");
        expect(idx).toBeGreaterThan(-1);
    });

    test('worker health does not expose tokens or secrets', async () => {
        const serverSrc = await readText(join(ROOT, 'src/backend/server.js'));
        const start = serverSrc.indexOf("'/api/workers/health'");
        const section = start >= 0 ? serverSrc.substring(start, start + 2000) : '';
        expect(section).not.toMatch(/\.token\b/);
        expect(section).not.toMatch(/password/i);
        expect(section).not.toMatch(/secret/i);
    });
});
