// Fix inventory status to make all items active
import { Database } from 'bun:sqlite';

const db = new Database('./data/vaultlister.db');

console.log('Fixing inventory status...');

// Update all items to active status
const result = db.query('UPDATE inventory SET status = ? WHERE status != ?').run('active', 'active');
console.log(`Updated ${result.changes} items to active status`);

// Get counts after
const counts = db.query('SELECT COUNT(*) as count, status FROM inventory GROUP BY status').all();
console.log('\nFinal counts:');
counts.forEach(row => {
    console.log(`- ${row.status}: ${row.count} items`);
});

console.log('\n✅ Status fix complete!');

db.close();
