#!/usr/bin/env bun
/**
 * VaultLister Dev Bundle Builder
 *
 * Concatenates the 12 Phase 1 (eager) source files into a single
 * core-bundle.js for development. This avoids 12 HTTP requests in dev mode.
 *
 * Usage: bun scripts/build-dev-bundle.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';

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

console.log('Building core-bundle.js...');

const content = sourceFiles
    .map(f => {
        const full = join(ROOT, f);
        return `// ──── ${f} ────\n` + readFileSync(full, 'utf-8');
    })
    .join('\n\n');

const outPath = join(ROOT, 'src/frontend/core-bundle.js');
writeFileSync(outPath, content);

const sizeKB = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(0);
console.log(`  core-bundle.js written (${sizeKB} KB, ${sourceFiles.length} files)`);
