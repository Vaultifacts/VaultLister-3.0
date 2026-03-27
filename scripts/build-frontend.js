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
const DIST = join(ROOT, 'dist');

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
];

// All source files for hash computation
const allSourceFiles = [
    ...coreFiles,
    ...chunkDefs.flatMap(c => c.files),
];

// ── Compute content hash ──────────────────────────────────────────────────────
const cssPath = join(ROOT, 'src/frontend/styles/main.css');
const hashableFiles = [
    ...allSourceFiles.map(f => join(ROOT, f)),
    ...(existsSync(cssPath) ? [cssPath] : [])
];
const hashInput = hashableFiles.map(f => readFileSync(f, 'utf-8')).join('');
const bundleVersion = createHash('sha256').update(hashInput).digest('hex').slice(0, 8);
console.log(`  bundle version: ${bundleVersion}`);

// ── Sync version into index.html and sw.js ────────────────────────────────────
const indexPath = join(ROOT, 'src/frontend/index.html');
if (existsSync(indexPath)) {
    const original = readFileSync(indexPath, 'utf-8');
    const updated = original.replace(/(\?v=)[a-f0-9]+/g, `$1${bundleVersion}`);
    if (updated !== original) {
        writeFileSync(indexPath, updated);
        console.log(`  index.html ?v= updated to ${bundleVersion}`);
    }
}
const swPath = join(ROOT, 'public/sw.js');
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
function buildBundle(files, outName, versionToInject) {
    const content = files
        .map(f => {
            let src = readFileSync(join(ROOT, f), 'utf-8');
            if (f.endsWith('router.js')) {
                src = src.replace(/\bconst v = '[^']*'/, `const v = '${versionToInject}'`);
            }
            return src;
        })
        .join('\n');

    const tmpName = outName.replace(/\.js$/, '.tmp.js');
    const tmpFile = join(DIST, tmpName);
    writeFileSync(tmpFile, content);

    try {
        const rawBunPath = process.argv[0] || 'bun';
    const bunPath = /^[a-zA-Z0-9/_.-]+$/.test(rawBunPath) ? rawBunPath : 'bun';
        execSync(`${bunPath} build ${tmpFile} --outdir=${DIST} --minify --sourcemap=external`, {
            cwd: ROOT,
            stdio: 'inherit'
        });
        // Bun outputs as {tmpName} — rename to {outName}
        const builtFile = join(DIST, tmpName);
        const targetFile = join(DIST, outName);
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
        console.log(`  ${outName} built (${(statSync(join(DIST, outName)).size / 1024).toFixed(0)} KB)`);
    } catch (e) {
        console.error(`Bun build failed for ${outName}, using unminified output`);
        writeFileSync(join(DIST, outName), content);
    }

    try { unlinkSync(tmpFile); } catch {}
}

// ── Build Phase 1: core bundle (dist/app.js) ─────────────────────────────────
console.log('Building core bundle (dist/app.js)...');
buildBundle(coreFiles, 'app.js', bundleVersion);

// ── Build Phase 2: route-group chunks ────────────────────────────────────────
console.log('Building route-group chunks...');
const manifest = { version: bundleVersion, chunks: {} };

for (const chunk of chunkDefs) {
    const outName = `chunk-${chunk.name}.js`;
    console.log(`  Building ${outName}...`);
    buildBundle(chunk.files, outName, bundleVersion);

    // Compute per-chunk content hash for the manifest
    const chunkContent = chunk.files.map(f => readFileSync(join(ROOT, f), 'utf-8')).join('');
    const chunkHash = createHash('sha256').update(chunkContent).digest('hex').slice(0, 8);
    manifest.chunks[chunk.name] = {
        file: outName,
        hash: chunkHash,
        url: `/chunk-${chunk.name}.js?v=${bundleVersion}`,
    };
}

// Write manifest.json
const manifestPath = join(DIST, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`  manifest.json written`);

// ── PurgeCSS ─────────────────────────────────────────────────────────────────
const cssOutputPath = join(DIST, 'main.css');
if (existsSync(cssPath)) {
    console.log('Purging unused CSS...');
    try {
        const { PurgeCSS } = await import('purgecss');
        const originalSize = readFileSync(cssPath, 'utf-8').length;
        writeFileSync(cssOutputPath, readFileSync(cssPath, 'utf-8'));
        const purged = await new PurgeCSS().purge({
            content: [
                join(ROOT, 'src/frontend/**/*.js'),
                join(ROOT, 'src/frontend/**/*.html'),
                join(ROOT, 'public/**/*.html'),
            ],
            css: [cssOutputPath],
        });
        if (purged[0]) {
            writeFileSync(cssOutputPath, purged[0].css);
            console.log(`CSS purged: ${originalSize} → ${purged[0].css.length} bytes (dist/main.css)`);
        }
    } catch (e) {
        console.warn('PurgeCSS step skipped (purgecss not installed):', e.message);
        writeFileSync(cssOutputPath, readFileSync(cssPath, 'utf-8'));
        console.log('CSS copied to dist/main.css (unpurged)');
    }
}

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\nBuild complete:');
if (existsSync(join(DIST, 'app.js'))) {
    const size = statSync(join(DIST, 'app.js')).size;
    console.log(`  dist/app.js          (${(size / 1024).toFixed(0)} KB)`);
}
for (const chunk of chunkDefs) {
    const p = join(DIST, `chunk-${chunk.name}.js`);
    if (existsSync(p)) {
        console.log(`  dist/chunk-${chunk.name}.js`.padEnd(32) + `(${(statSync(p).size / 1024).toFixed(0)} KB)`);
    }
}
console.log(`  dist/manifest.json`);
