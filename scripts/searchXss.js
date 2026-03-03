// Search for xss in database
import { Database } from 'bun:sqlite';

const db = new Database('./data/vaultlister.db');

console.log('Searching for "xss" in inventory...');
const rows = db.query('SELECT id, title, tags FROM inventory WHERE title LIKE ? OR tags LIKE ? LIMIT 10').all('%xss%', '%xss%');
console.log('Found', rows.length, 'items with "xss"');
rows.forEach(row => {
    console.log('- Title:', row.title);
    console.log('  Tags:', row.tags);
});

console.log('\nTotal inventory count:');
const total = db.query('SELECT COUNT(*) as count, status FROM inventory GROUP BY status').all();
total.forEach(row => {
    console.log(`- ${row.status}: ${row.count} items`);
});

db.close();
