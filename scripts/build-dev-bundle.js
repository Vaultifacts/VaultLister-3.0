#!/usr/bin/env bun
/**
 * VaultLister Dev Bundle Builder
 *
 * Concatenates the 12 Phase 1 (eager) source files into a single
 * core-bundle.js for development. This avoids 12 HTTP requests in dev mode.
 *
 * Also auto-syncs the ?v= cache-bust version across:
 *   - src/frontend/core-bundle.js  (router.js `const v` replaced inline)
 *   - src/frontend/index.html      (asset URL query params)
 *   - public/sw.js                 (PRECACHE_URLS query params)
 *
 * Version is a short SHA-256 hash of all JS source files + main.css,
 * so it only changes when actual source content changes.
 *
 * Usage: bun scripts/build-dev-bundle.js
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { createHash } from 'crypto';

const ROOT = resolve(import.meta.dir, '..');

// Phase 1 source files in load order (must match index.html order)
const sourceFiles = [
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
    'src/frontend/init.js'
];

// ── Compute content hash ──────────────────────────────────────────────────────
// Hash covers all JS source files + lazy chunks + main.css so any change
// (including to deferred pages/handlers) invalidates the chunk cache-bust version.
const cssPath = join(ROOT, 'src/frontend/styles/main.css');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
const chunkFiles = [
    // Route-group chunk source files (must stay in sync with scripts/build-frontend.js chunkDefs)
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
    'src/frontend/pages/pages-deferred.js',
    'src/frontend/handlers/handlers-deferred.js',
    'src/frontend/services/websocketClient.js',
];
const hashableFiles = [
    ...sourceFiles.map(f => join(ROOT, f)),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    ...chunkFiles.map(f => join(ROOT, f)).filter(f => existsSync(f)),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    ...(existsSync(cssPath) ? [cssPath] : [])
];
const hashInput = hashableFiles.map(f => readFileSync(f, 'utf-8')).join('');
const bundleVersion = createHash('sha256').update(hashInput).digest('hex').slice(0, 8);

console.log('Building core-bundle.js...');
console.log(`  bundle version: ${bundleVersion}`);

// ── Build bundle, injecting version into router.js const ──────────────────────
const content = sourceFiles
    .map(f => {
        const full = join(ROOT, f);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        let src = readFileSync(full, 'utf-8');
        // Inject computed version into router.js without modifying the source file
        if (f.endsWith('router.js')) {
            src = src.replace(/\bconst v = '[^']*'/, `const v = '${bundleVersion}'`);
        }
        return `// ──── ${f} ────\n` + src;
    })
    .join('\n\n');

const outPath = join(ROOT, 'src/frontend/core-bundle.js');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
writeFileSync(outPath, content);

const sizeKB = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(0);
console.log(`  core-bundle.js written (${sizeKB} KB, ${sourceFiles.length} files)`);

// ── Sync version into index.html ──────────────────────────────────────────────
const indexPath = join(ROOT, 'src/frontend/index.html');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
if (existsSync(indexPath)) {
    const original = readFileSync(indexPath, 'utf-8');
    const updated = original.replace(/(\?v=)[a-f0-9]+/g, `$1${bundleVersion}`);
    if (updated !== original) {
        writeFileSync(indexPath, updated);
        console.log(`  index.html ?v= updated to ${bundleVersion}`);
    }
}

// ── Sync version into sw.js PRECACHE_URLS ─────────────────────────────────────
const swPath = join(ROOT, 'public/sw.js');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
if (existsSync(swPath)) {
    const original = readFileSync(swPath, 'utf-8');
    const updated = original.replace(/(\?v=)[a-f0-9]+/g, `$1${bundleVersion}`);
    if (updated !== original) {
        writeFileSync(swPath, updated);
        console.log(`  public/sw.js PRECACHE_URLS ?v= updated to ${bundleVersion}`);
    }
}
