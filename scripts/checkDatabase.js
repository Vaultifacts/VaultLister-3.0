#!/usr/bin/env bun
import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

await initializeDatabase();

console.log('\n=== Database Integrity Check ===\n');

const tables = [
    { name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
    { name: 'inventory', query: 'SELECT COUNT(*) as count FROM inventory' },
    { name: 'automation_rules', query: 'SELECT COUNT(*) as count FROM automation_rules' },
    { name: 'shops', query: 'SELECT COUNT(*) as count FROM shops' },
    { name: 'listings', query: 'SELECT COUNT(*) as count FROM listings' },
    { name: 'sales', query: 'SELECT COUNT(*) as count FROM sales' },
    { name: 'analytics_snapshots', query: 'SELECT COUNT(*) as count FROM analytics_snapshots' }
];

for (const table of tables) {
    try {
        const result = await query.get(table.query, []);
        console.log(`✓ ${table.name.padEnd(20)} ${result.count} records`);
    } catch (error) {
        console.log(`✗ ${table.name.padEnd(20)} ERROR: ${error.message}`);
    }
}

console.log('\n=== Demo User Check ===\n');
const demoUser = await query.get('SELECT email, subscription_tier FROM users WHERE email = ?', ['demo@vaultlister.com']);
if (demoUser) {
    console.log(`✓ Demo user exists: ${demoUser.email} (${demoUser.subscription_tier} tier)`);
} else {
    console.log('✗ Demo user NOT found');
}

console.log('\n=== Inventory Stats ===\n');
const inventoryStats = await query.all(`
    SELECT status, COUNT(*) as count,
        ROUND(AVG(list_price)::numeric, 2) as avg_price,
        SUM(list_price) as total_value
    FROM inventory GROUP BY status
`, []);
inventoryStats.forEach(stat => {
    console.log(`${stat.status.padEnd(10)} ${stat.count} items | Avg: $${stat.avg_price} | Total: $${stat.total_value}`);
});

console.log('\n=== Data Integrity Checks ===\n');
const orphanedInventory = await query.get(`SELECT COUNT(*) as count FROM inventory WHERE user_id NOT IN (SELECT id FROM users)`, []);
console.log(`${orphanedInventory.count == 0 ? '✓' : '✗'} Orphaned inventory items: ${orphanedInventory.count}`);

const orphanedAutomations = await query.get(`SELECT COUNT(*) as count FROM automation_rules WHERE user_id NOT IN (SELECT id FROM users)`, []);
console.log(`${orphanedAutomations.count == 0 ? '✓' : '✗'} Orphaned automations: ${orphanedAutomations.count}`);

console.log('\n=== Full-Text Search Index ===\n');
try {
    const invCount = await query.get(`SELECT COUNT(*) as count FROM inventory WHERE search_vector IS NOT NULL`, []);
    const total = await query.get(`SELECT COUNT(*) as count FROM inventory`, []);
    console.log(`${invCount.count == total.count ? '✓' : '⚠'} tsvector indexed: ${invCount.count}/${total.count} inventory rows`);
} catch (error) {
    console.log(`✗ tsvector check ERROR: ${error.message}`);
}

await closeDatabase();
console.log('\n=== Check Complete ===\n');
