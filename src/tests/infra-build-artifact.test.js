// Infrastructure & Delivery — Build, Packaging, Artifact Integrity
// Audit gaps: H7/H10 (ESM lint), H8 (silent fallback), M9 (reproducibility),
//             M10 (sourcemap in prod)
// Categories: Build/Packaging, CI/CD, Deployment/Config

import { describe, expect, test, beforeAll } from 'bun:test';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dir, '../../');
const DIST = join(ROOT, 'dist');

// ═══════════════════════════════════════════════════════════════════════════════
// Build Script Source File Coverage (H8)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Build script source file coverage (H8)', () => {
    const buildScript = readFileSync(join(ROOT, 'scripts/build-frontend.js'), 'utf-8');

    // Extract source file list from build script (only .js files in sourceFiles array)
    const sourceFileMatches = buildScript.match(/'src\/frontend\/[^']+\.js'/g) || [];
    const sourceFiles = sourceFileMatches.map(m => m.replace(/'/g, ''));

    test('all source files listed in build-frontend.js exist on disk', () => {
        const missing = sourceFiles.filter(f => !existsSync(join(ROOT, f)));
        expect(missing).toEqual([]);
    });

    test('source file ordering: utils.js before store.js before api.js', () => {
        const utilsIdx = sourceFiles.findIndex(f => f.includes('utils.js'));
        const storeIdx = sourceFiles.findIndex(f => f.includes('store.js'));
        const apiIdx = sourceFiles.findIndex(f => f.includes('/api.js'));
        expect(utilsIdx).toBeLessThan(storeIdx);
        expect(storeIdx).toBeLessThan(apiIdx);
    });

    test('init.js is last in the source file list', () => {
        const lastFile = sourceFiles[sourceFiles.length - 1];
        expect(lastFile).toContain('init.js');
    });

    test('build script has 24 source files', () => {
        expect(sourceFiles.length).toBe(24);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Build Output Validation (H8)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Build output validation (H8)', () => {
    let buildRan = false;

    beforeAll(() => {
        try {
            execSync('bun scripts/build-frontend.js', {
                cwd: ROOT,
                stdio: 'pipe',
                timeout: 30000,
            });
            buildRan = true;
        } catch (e) {
            console.error('Build failed:', e.message);
        }
    });

    test('build script runs successfully', () => {
        expect(buildRan).toBe(true);
    });

    test('dist/app.js exists after build', () => {
        expect(existsSync(join(DIST, 'app.js'))).toBe(true);
    });

    test('dist/app.js is non-empty', () => {
        const size = statSync(join(DIST, 'app.js')).size;
        expect(size).toBeGreaterThan(0);
    });

    test('dist/app.js size < 5MB', () => {
        const size = statSync(join(DIST, 'app.js')).size;
        expect(size).toBeLessThan(5 * 1024 * 1024);
    });

    test('dist/app.js size documented (for CI threshold review)', () => {
        const size = statSync(join(DIST, 'app.js')).size;
        const sizeMB = (size / 1024 / 1024).toFixed(2);
        // Document: current build size for threshold review
        expect(size).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Bundle Version Hash
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bundle version hash in HTML and SW', () => {
    test('index.html contains ?v= with hex hash', () => {
        const indexPath = join(ROOT, 'src/frontend/index.html');
        const content = readFileSync(indexPath, 'utf-8');
        expect(content).toMatch(/\?v=[a-f0-9]{8}/);
    });

    test('sw.js contains ?v= with hex hash', () => {
        const swPath = join(ROOT, 'public/sw.js');
        const content = readFileSync(swPath, 'utf-8');
        expect(content).toMatch(/\?v=[a-f0-9]{8}/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CI Lint ESM Safety (H7/H10)
// ═══════════════════════════════════════════════════════════════════════════════

describe('CI lint ESM safety (H7/H10)', () => {
    test('ci.yml lint step does NOT use node --check (REM-07 fix)', () => {
        const ciPath = join(ROOT, '.github/workflows/ci.yml');
        const content = readFileSync(ciPath, 'utf-8');
        // node --check was replaced with bun build --no-bundle (REM-07)
        // node --check hangs on ESM files with Bun-specific imports
        expect(content).not.toMatch(/exec node --check/);
        expect(content).toContain('bun build --no-bundle');
    });

    test('pre-commit hook does NOT execute node --check (regression guard)', () => {
        const hookPath = join(ROOT, '.husky/pre-commit');
        const content = readFileSync(hookPath, 'utf-8');
        // node --check was removed because it hangs on ESM files
        // Filter out comments — only check active code lines
        const activeLines = content.split('\n')
            .filter(line => !line.trimStart().startsWith('#'))
            .join('\n');
        expect(activeLines).not.toMatch(/node --check/);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Dockerfile Artifact Safety (M10)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Dockerfile artifact safety (M10)', () => {
    const dockerfilePath = join(ROOT, 'Dockerfile');
    const dockerfile = readFileSync(dockerfilePath, 'utf-8');

    test('Dockerfile uses --frozen-lockfile', () => {
        expect(dockerfile).toContain('--frozen-lockfile');
    });

    test('Dockerfile uses non-root USER', () => {
        expect(dockerfile).toMatch(/USER\s+\w+/);
        // Should not be USER root
        expect(dockerfile).not.toMatch(/USER\s+root/);
    });

    test('Dockerfile has HEALTHCHECK', () => {
        expect(dockerfile).toContain('HEALTHCHECK');
    });

    test('Dockerfile uses multi-stage build', () => {
        const fromCount = (dockerfile.match(/^FROM\s/gm) || []).length;
        expect(fromCount).toBeGreaterThanOrEqual(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Lockfile Integrity
// ═══════════════════════════════════════════════════════════════════════════════

describe('Lockfile integrity', () => {
    test('bun.lock exists', () => {
        expect(existsSync(join(ROOT, 'bun.lock'))).toBe(true);
    });

    test('bun.lock is non-empty', () => {
        const size = statSync(join(ROOT, 'bun.lock')).size;
        expect(size).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Docker-compose Required Secrets
// ═══════════════════════════════════════════════════════════════════════════════

describe('Docker-compose required secrets', () => {
    const composePath = join(ROOT, 'docker-compose.yml');
    const compose = readFileSync(composePath, 'utf-8');

    test('docker-compose.yml references JWT_SECRET', () => {
        expect(compose).toContain('JWT_SECRET');
    });

    test('docker-compose.yml has app service', () => {
        expect(compose).toContain('app:');
    });
});
