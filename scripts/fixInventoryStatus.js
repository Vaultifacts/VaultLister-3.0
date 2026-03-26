#!/usr/bin/env bun
// Fix inventory status to make all items active
import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

await initializeDatabase();
console.log('Fixing inventory status...');

const result = await query.run('UPDATE inventory SET status = ? WHERE status != ?', ['active', 'active']);
console.log(`Updated ${result.changes} items to active status`);

const counts = await query.all('SELECT COUNT(*) as count, status FROM inventory GROUP BY status', []);
console.log('\nFinal counts:');
counts.forEach(row => console.log(`- ${row.status}: ${row.count} items`));
console.log('\n✅ Status fix complete!');
await closeDatabase();
