// Database initialisation script — called by `bun run db:reset`
// Drops the existing database file and re-creates it from scratch
// (schema + all migrations + seeds) via initializeDatabase().

import { existsSync, rmSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'vaultlister.db');

// Remove existing database so initializeDatabase() starts fresh
if (existsSync(DB_PATH)) {
    rmSync(DB_PATH);
    console.log(`✓ Removed existing database: ${DB_PATH}`);
}

// Also remove any WAL/SHM sidecar files
for (const ext of ['-wal', '-shm']) {
    const sidecar = DB_PATH + ext;
    if (existsSync(sidecar)) {
        rmSync(sidecar);
    }
}

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
}

// Now run the full init (schema + migrations + seeds)
// Dynamic import so database.js opens its connection AFTER the old DB file is deleted.
const { initializeDatabase } = await import('./database.js');
initializeDatabase();
console.log('✓ Database reset complete');
