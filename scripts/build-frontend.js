#!/usr/bin/env bun
/**
 * VaultLister Production Build Script
 * Concatenates split source files and minifies via Bun.
 *
 * Usage: bun scripts/build-frontend.js
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync, statSync, renameSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');

// Source files in load order (production build concatenates everything)
const sourceFiles = [
    // Phase 1: Core bundle
    'src/frontend/core/utils.js',
    'src/frontend/core/store.js',
    'src/frontend/core/api.js',
    'src/frontend/core/toast.js',
    'src/frontend/ui/widgets.js',
    'src/frontend/core/router.js',
    'src/frontend/ui/components.js',
    'src/frontend/pages/pages-core.js',
    'src/frontend/core/auth.js',
    'src/frontend/ui/modals.js',
    'src/frontend/handlers/handlers-core.js',

    // Phase 2: Route-group chunks (all included in production build)
    'src/frontend/pages/pages-inventory-catalog.js',
    'src/frontend/handlers/handlers-inventory-catalog.js',
    'src/frontend/pages/pages-sales-orders.js',
    'src/frontend/handlers/handlers-sales-orders.js',
    'src/frontend/pages/pages-tools-tasks.js',
    'src/frontend/handlers/handlers-tools-tasks.js',
    'src/frontend/pages/pages-intelligence.js',
    'src/frontend/handlers/handlers-intelligence.js',
    'src/frontend/pages/pages-settings-account.js',
    'src/frontend/handlers/handlers-settings-account.js',
    'src/frontend/pages/pages-community-help.js',
    'src/frontend/handlers/handlers-community-help.js',

    // Init (must be last)
    'src/frontend/init.js'
];

// Ensure dist directory
mkdirSync(DIST, { recursive: true });

// Concatenate all source files
console.log('Concatenating source files...');
const allContent = sourceFiles
    .map(f => readFileSync(join(ROOT, f), 'utf-8'))
    .join('\n');

const tmpFile = join(DIST, 'app.tmp.js');
writeFileSync(tmpFile, allContent);

// Minify with Bun
console.log('Minifying...');
try {
    const bunPath = process.argv[0] || 'bun';
    execSync(`${bunPath} build ${tmpFile} --outdir=${DIST} --minify --sourcemap=external`, {
        cwd: ROOT,
        stdio: 'inherit'
    });
    // Bun outputs as app.tmp.js — rename to app.js
    const builtFile = join(DIST, 'app.tmp.js');
    const targetFile = join(DIST, 'app.js');
    if (existsSync(builtFile)) {
        if (existsSync(targetFile)) unlinkSync(targetFile);
        renameSync(builtFile, targetFile);
        // Also rename sourcemap
        const mapSrc = builtFile + '.map';
        const mapDst = targetFile + '.map';
        if (existsSync(mapSrc)) {
            if (existsSync(mapDst)) unlinkSync(mapDst);
            renameSync(mapSrc, mapDst);
        }
    }
} catch (e) {
    console.error('Bun build failed, using unminified output');
    writeFileSync(join(DIST, 'app.js'), allContent);
}

// Cleanup
try { unlinkSync(tmpFile); } catch {}

// Report
if (existsSync(join(DIST, 'app.js'))) {
    const size = statSync(join(DIST, 'app.js')).size;
    console.log(`\nBuild complete: dist/app.js (${(size / 1024).toFixed(0)} KB)`);
}
