#!/usr/bin/env bun
// Run database migrations (PostgreSQL)
// Alias for run-migrations.js — migrations applied via initializeDatabase().

import { initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

try {
    await initializeDatabase();
    console.log('Migrations complete.');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
} finally {
    await closeDatabase();
}
