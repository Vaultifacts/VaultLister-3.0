#!/usr/bin/env bun
// Database Migration Runner (PostgreSQL)
// Migrations are applied automatically on server startup.
// Run this script to apply migrations manually without starting the full server.

import { initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

console.log('VaultLister PostgreSQL Migration Runner');
console.log('========================================\n');

try {
    await initializeDatabase();
    console.log('\nMigrations applied successfully.');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
} finally {
    await closeDatabase();
}
