import Database from 'bun:sqlite';

const db = new Database('./data/vaultlister.db');

console.log('\n=== All Users ===\n');

const users = db.prepare(`
    SELECT id, email, username, subscription_tier, created_at
    FROM users
    ORDER BY created_at DESC
`).all();

users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email.padEnd(30)} | ${user.username.padEnd(15)} | ${user.subscription_tier.padEnd(8)} | Created: ${user.created_at}`);

    // Count user's items
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM inventory WHERE user_id = ?').get(user.id);
    const automationCount = db.prepare('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ?').get(user.id);
    const shopCount = db.prepare('SELECT COUNT(*) as count FROM shops WHERE user_id = ?').get(user.id);

    console.log(`   └─ Items: ${itemCount.count} | Automations: ${automationCount.count} | Shops: ${shopCount.count}\n`);
});

db.close();
