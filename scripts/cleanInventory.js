// Clean up extra inventory items, keeping only the original 10
import { Database } from 'bun:sqlite';

const db = new Database('./data/vaultlister.db');

console.log('Cleaning up inventory...');

// Get counts before
const beforeCounts = db.query('SELECT COUNT(*) as count, status FROM inventory GROUP BY status').all();
console.log('\nBefore cleanup:');
beforeCounts.forEach(row => {
    console.log(`- ${row.status}: ${row.count} items`);
});

// Get the 10 original seed items (VL-001 through VL-010)
const originalItems = db.query('SELECT id FROM inventory WHERE sku IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').all(
    'VL-001', 'VL-002', 'VL-003', 'VL-004', 'VL-005',
    'VL-006', 'VL-007', 'VL-008', 'VL-009', 'VL-010'
);

console.log(`\nFound ${originalItems.length} original seed items`);

// Delete all items except the original 10
const originalIds = originalItems.map(item => item.id);
if (originalIds.length > 0) {
    const placeholders = originalIds.map(() => '?').join(',');
    const result = db.query(`DELETE FROM inventory WHERE id NOT IN (${placeholders})`).run(...originalIds);
    console.log(`Deleted ${result.changes} extra items`);
}

// Get counts after
const afterCounts = db.query('SELECT COUNT(*) as count, status FROM inventory GROUP BY status').all();
console.log('\nAfter cleanup:');
afterCounts.forEach(row => {
    console.log(`- ${row.status}: ${row.count} items`);
});

console.log('\n✅ Cleanup complete!');

db.close();
