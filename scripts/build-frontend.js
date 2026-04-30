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
import { createHash } from 'crypto';

const ROOT = resolve(import.meta.dir, '..');
const DIST = join(ROOT, 'dist');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

// Phase 1: Core bundle files (critical-path, always eager-loaded)
const coreFiles = [
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

    // Init (must be last in core bundle)
    'src/frontend/init.js'
];

// Phase 2: Route-group chunks — each built as a separate dist/chunk-{name}.js
const chunkDefs = [
    {
        name: 'inventory',
        files: [
            'src/frontend/pages/pages-inventory-catalog.js',
            'src/frontend/handlers/handlers-inventory-catalog.js',
        ]
    },
    {
        name: 'sales',
        files: [
            'src/frontend/pages/pages-sales-orders.js',
            'src/frontend/handlers/handlers-sales-orders.js',
        ]
    },
    {
        name: 'tools',
        files: [
            'src/frontend/pages/pages-tools-tasks.js',
            'src/frontend/handlers/handlers-tools-tasks.js',
        ]
    },
    {
        name: 'intelligence',
        files: [
            'src/frontend/pages/pages-intelligence.js',
            'src/frontend/handlers/handlers-intelligence.js',
        ]
    },
    {
        name: 'settings',
        files: [
            'src/frontend/pages/pages-settings-account.js',
            'src/frontend/handlers/handlers-settings-account.js',
        ]
    },
    {
        name: 'community',
        files: [
            'src/frontend/pages/pages-community-help.js',
            'src/frontend/handlers/handlers-community-help.js',
        ]
    },
    {
        name: 'admin',
        files: [
            'src/frontend/pages/pages-admin.js',
            'src/frontend/handlers/handlers-admin.js',
        ]
    },
    {
        name: 'deferred',
        files: [
            'src/frontend/pages/pages-deferred.js',
            'src/frontend/handlers/handlers-deferred.js',
        ]
    },
];

// All source files for hash computation
const allSourceFiles = [
    ...coreFiles,
    ...chunkDefs.flatMap(c => c.files),
    'src/frontend/services/websocketClient.js',
];

// ── Compute content hash ──────────────────────────────────────────────────────
const cssFileList = [  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    'src/frontend/styles/variables.css',
    'src/frontend/styles/base.css',
    'src/frontend/styles/features.css',
    'src/frontend/styles/pages/dashboard.css',
    'src/frontend/styles/pages/inventory.css',
    'src/frontend/styles/pages/listings.css',
    'src/frontend/styles/pages/sales-orders.css',
    'src/frontend/styles/pages/offers.css',
    'src/frontend/styles/pages/cross-page.css',
    'src/frontend/styles/pages/tools-tasks.css',
    'src/frontend/styles/pages/analytics.css',
    'src/frontend/styles/pages/intelligence.css',
    'src/frontend/styles/pages/community-help.css',
    'src/frontend/styles/pages/company.css',
    'src/frontend/styles/pages/page-heroes.css',
    'src/frontend/styles/pages/login.css',
    'src/frontend/styles/components-library.css',
    'src/frontend/styles/widgets.css',
    'src/frontend/styles/mobile.css',
];
const hashableFiles = [
    ...allSourceFiles.map(f => join(ROOT, f)),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    ...cssFileList.map(f => join(ROOT, f)).filter(f => existsSync(f)),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
];
const hashInput = hashableFiles.map(f => readFileSync(f, 'utf-8')).join('');
const bundleVersion = createHash('sha256').update(hashInput).digest('hex').slice(0, 8);
console.log(`  bundle version: ${bundleVersion}`);

// ── Sync version into index.html and sw.js ────────────────────────────────────
const indexPath = join(ROOT, 'src/frontend/index.html');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
if (existsSync(indexPath)) {
    const original = readFileSync(indexPath, 'utf-8');
    const updated = original.replace(/(\?v=)[a-f0-9]+/g, `$1${bundleVersion}`);
    if (updated !== original) {
        writeFileSync(indexPath, updated);
        console.log(`  index.html ?v= updated to ${bundleVersion}`);
    }
}
const swPath = join(ROOT, 'public/sw.js');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
if (existsSync(swPath)) {
    const original = readFileSync(swPath, 'utf-8');
    const updated = original.replace(/(\?v=)[a-f0-9]+/g, `$1${bundleVersion}`);
    if (updated !== original) {
        writeFileSync(swPath, updated);
        console.log(`  public/sw.js ?v= updated to ${bundleVersion}`);
    }
}

// Ensure dist directory
mkdirSync(DIST, { recursive: true });

// ── Helper: concatenate files, minify, rename ─────────────────────────────────
function buildBundle(files, outName, versionToInject, isChunk = false) {
    const content = files
        .map(f => {
            let src = readFileSync(join(ROOT, f), 'utf-8');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            if (f.endsWith('router.js')) {
                src = src.replace(/\bconst v = '[^']*'/, `const v = '${versionToInject}'`);
            }
            return src;
        })
        .join('\n');

    const tmpName = outName.replace(/\.js$/, '.tmp.js');
    const tmpFile = join(DIST, tmpName);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    // Wrap chunks in IIFE to prevent top-level var declarations (from Bun's ESM shim
    // and module-level consts like PLATFORM_DISPLAY_NAMES) from polluting global scope
    // and overwriting same-letter variables in the core bundle.
    writeFileSync(tmpFile, isChunk ? `(function(){\n${content}\n})();` : content);

    try {
        const rawBunPath = process.argv[0] || 'bun';
    const bunPath = /^[a-zA-Z0-9/_.-]+$/.test(rawBunPath) ? rawBunPath : 'bun';
        execSync(`${bunPath} build ${tmpFile} --outdir=${DIST} --minify --sourcemap=external`, {  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process  // nosemgrep: js/shell-command-injection-from-environment
            cwd: ROOT,
            stdio: 'inherit'
        });
        // Bun outputs as {tmpName} — rename to {outName}
        const builtFile = join(DIST, tmpName);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const targetFile = join(DIST, outName);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (existsSync(builtFile)) {
            if (existsSync(targetFile)) unlinkSync(targetFile);
            renameSync(builtFile, targetFile);
            const mapSrc = builtFile + '.map';
            const mapDst = targetFile + '.map';
            if (existsSync(mapSrc)) {
                if (existsSync(mapDst)) unlinkSync(mapDst);
                renameSync(mapSrc, mapDst);
            }
        }
        console.log(`  ${outName} built (${(statSync(join(DIST, outName)).size / 1024).toFixed(0)} KB)`);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    } catch (e) {
        console.error(`Bun build failed for ${outName}, using unminified output`);
        writeFileSync(join(DIST, outName), content);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    }

    try { unlinkSync(tmpFile); } catch {}
}

// ── Build Phase 1: core bundle (dist/core-bundle.js) ─────────────────────────
console.log('Building core bundle (dist/core-bundle.js)...');
buildBundle(coreFiles, 'core-bundle.js', bundleVersion);

// ── Build Phase 2: route-group chunks ────────────────────────────────────────
console.log('Building route-group chunks...');
const manifest = { version: bundleVersion, chunks: {} };

for (const chunk of chunkDefs) {
    const outName = `chunk-${chunk.name}.js`;
    console.log(`  Building ${outName}...`);
    buildBundle(chunk.files, outName, bundleVersion, true);

    // Compute per-chunk content hash for the manifest
    const chunkContent = chunk.files.map(f => readFileSync(join(ROOT, f), 'utf-8')).join('');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const chunkHash = createHash('sha256').update(chunkContent).digest('hex').slice(0, 8);
    manifest.chunks[chunk.name] = {
        file: outName,
        hash: chunkHash,
        url: `/chunk-${chunk.name}.js?v=${bundleVersion}`,
    };
}

// Write manifest.json
const manifestPath = join(DIST, 'manifest.json');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`  manifest.json written`);

// ── PurgeCSS ─────────────────────────────────────────────────────────────────
const cssOutputPath = join(DIST, 'main.css');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
if (cssFileList.some(f => existsSync(join(ROOT, f)))) {
    console.log('Purging unused CSS...');
    const combinedCSS = cssFileList.map(f => {  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const full = join(ROOT, f);
        return existsSync(full) ? readFileSync(full, 'utf-8') : '';
    }).join('\n');
    const originalSize = combinedCSS.length;
    writeFileSync(cssOutputPath, combinedCSS);
    try {
        const { PurgeCSS } = await import('purgecss');
        const purged = await new PurgeCSS().purge({
            content: [
                join(ROOT, 'src/frontend/**/*.js'),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                join(ROOT, 'src/frontend/**/*.html'),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                join(ROOT, 'public/**/*.html'),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            ],
            css: [cssOutputPath],
            safelist: [/^auth-/],  // Always keep auth page styles (login/register)
        });
        if (purged[0]) {
            writeFileSync(cssOutputPath, purged[0].css);
            console.log(`CSS purged: ${originalSize} → ${purged[0].css.length} bytes (dist/main.css)`);
        }
    } catch (e) {
        console.warn('PurgeCSS step skipped (purgecss not installed):', e.message);
        console.log('CSS copied to dist/main.css (unpurged)');
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\nBuild complete:');
if (existsSync(join(DIST, 'core-bundle.js'))) {  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const size = statSync(join(DIST, 'core-bundle.js')).size;  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    console.log(`  dist/core-bundle.js  (${(size / 1024).toFixed(0)} KB)`);
}
for (const chunk of chunkDefs) {
    const p = join(DIST, `chunk-${chunk.name}.js`);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (existsSync(p)) {
        console.log(`  dist/chunk-${chunk.name}.js`.padEnd(32) + `(${(statSync(p).size / 1024).toFixed(0)} KB)`);
    }
}
console.log(`  dist/manifest.json`);
