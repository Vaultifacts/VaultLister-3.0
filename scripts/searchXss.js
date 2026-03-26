#!/usr/bin/env bun
// Search for XSS patterns in database
import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

await initializeDatabase();
console.log('Searching for "xss" in inventory...');
const rows = await query.all('SELECT id, title, tags FROM inventory WHERE title ILIKE ? OR tags ILIKE ? LIMIT 10', ['%xss%', '%xss%']);
console.log('Found', rows.length, 'items with "xss"');
rows.forEach(row => { console.log('- Title:', row.title); console.log('  Tags:', row.tags); });

console.log('\nTotal inventory count:');
const total = await query.all('SELECT COUNT(*) as count, status FROM inventory GROUP BY status', []);
total.forEach(row => console.log(`- ${row.status}: ${row.count} items`));
await closeDatabase();
