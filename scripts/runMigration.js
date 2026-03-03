#!/usr/bin/env bun
// Run database migrations

import Database from 'bun:sqlite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const dbPath = resolve(import.meta.dir, '../data/vaultlister.db');
const db = new Database(dbPath);

// Run the migration
const migrationPath = resolve(import.meta.dir, '../src/backend/db/migrations/001_add_deleted_at.sql');
const migrationSQL = readFileSync(migrationPath, 'utf-8');

try {
    console.log('Running migration: 001_add_deleted_at.sql');

    // Execute the migration
    db.exec(migrationSQL);

    console.log('✓ Migration completed successfully');

    // Verify the column was added
    const result = db.query(`PRAGMA table_info(inventory)`).all();
    const deletedAtColumn = result.find(col => col.name === 'deleted_at');

    if (deletedAtColumn) {
        console.log('✓ deleted_at column confirmed in inventory table');
    } else {
        console.error('✗ deleted_at column not found - migration may have failed');
    }

} catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
}

db.close();
