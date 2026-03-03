import Database from 'bun:sqlite';

const db = new Database('./data/vaultlister.db');

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

tables.forEach(table => {
    try {
        const result = db.prepare(table.query).get();
        console.log(`✓ ${table.name.padEnd(20)} ${result.count} records`);
    } catch (error) {
        console.log(`✗ ${table.name.padEnd(20)} ERROR: ${error.message}`);
    }
});

// Check for demo user
console.log('\n=== Demo User Check ===\n');
const demoUser = db.prepare('SELECT email, subscription_tier FROM users WHERE email = ?').get('demo@vaultlister.com');
if (demoUser) {
    console.log(`✓ Demo user exists: ${demoUser.email} (${demoUser.subscription_tier} tier)`);
} else {
    console.log('✗ Demo user NOT found');
}

// Check inventory stats
console.log('\n=== Inventory Stats ===\n');
const inventoryStats = db.prepare(`
    SELECT
        status,
        COUNT(*) as count,
        ROUND(AVG(list_price), 2) as avg_price,
        SUM(list_price) as total_value
    FROM inventory
    GROUP BY status
`).all();

inventoryStats.forEach(stat => {
    console.log(`${stat.status.padEnd(10)} ${stat.count} items | Avg: $${stat.avg_price} | Total: $${stat.total_value}`);
});

// Check for orphaned records
console.log('\n=== Data Integrity Checks ===\n');

const orphanedInventory = db.prepare(`
    SELECT COUNT(*) as count
    FROM inventory
    WHERE user_id NOT IN (SELECT id FROM users)
`).get();
console.log(`${orphanedInventory.count === 0 ? '✓' : '✗'} Orphaned inventory items: ${orphanedInventory.count}`);

const orphanedAutomations = db.prepare(`
    SELECT COUNT(*) as count
    FROM automation_rules
    WHERE user_id NOT IN (SELECT id FROM users)
`).get();
console.log(`${orphanedAutomations.count === 0 ? '✓' : '✗'} Orphaned automations: ${orphanedAutomations.count}`);

// Check FTS5 table
console.log('\n=== Full-Text Search Index ===\n');
try {
    const ftsCount = db.prepare('SELECT COUNT(*) as count FROM inventory_fts').get();
    const invCount = db.prepare('SELECT COUNT(*) as count FROM inventory').get();
    console.log(`${ftsCount.count === invCount.count ? '✓' : '✗'} FTS index: ${ftsCount.count} entries (inventory: ${invCount.count})`);
} catch (error) {
    console.log(`✗ FTS index ERROR: ${error.message}`);
}

db.close();
console.log('\n=== Check Complete ===\n');
