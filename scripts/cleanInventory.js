#!/usr/bin/env bun
// Clean up extra inventory items, keeping only the original 10
import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

await initializeDatabase();
console.log('Cleaning up inventory...');

const beforeCounts = await query.all('SELECT COUNT(*) as count, status FROM inventory GROUP BY status', []);
console.log('\nBefore cleanup:');
beforeCounts.forEach(row => console.log(`- ${row.status}: ${row.count} items`));

const originalItems = await query.all(
    'SELECT id FROM inventory WHERE sku IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ['VL-001', 'VL-002', 'VL-003', 'VL-004', 'VL-005', 'VL-006', 'VL-007', 'VL-008', 'VL-009', 'VL-010']
);
console.log(`\nFound ${originalItems.length} original seed items`);

if (originalItems.length > 0) {
    const placeholders = originalItems.map(() => '?').join(',');
    const result = await query.run(`DELETE FROM inventory WHERE id NOT IN (${placeholders})`, originalItems.map(i => i.id));
    console.log(`Deleted ${result.changes} extra items`);
}

const afterCounts = await query.all('SELECT COUNT(*) as count, status FROM inventory GROUP BY status', []);
console.log('\nAfter cleanup:');
afterCounts.forEach(row => console.log(`- ${row.status}: ${row.count} items`));
console.log('\n✅ Cleanup complete!');
await closeDatabase();
