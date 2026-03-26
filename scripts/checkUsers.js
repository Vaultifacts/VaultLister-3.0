#!/usr/bin/env bun
import { query, initializeDatabase, closeDatabase } from '../src/backend/db/database.js';

await initializeDatabase();
console.log('\n=== All Users ===\n');

const users = await query.all(`
    SELECT id, email, username, subscription_tier, created_at
    FROM users ORDER BY created_at DESC
`, []);

for (const [index, user] of users.entries()) {
    console.log(`${index + 1}. ${user.email.padEnd(30)} | ${(user.username || '').padEnd(15)} | ${user.subscription_tier.padEnd(8)} | Created: ${user.created_at}`);
    const itemCount = await query.get('SELECT COUNT(*) as count FROM inventory WHERE user_id = ?', [user.id]);
    const automationCount = await query.get('SELECT COUNT(*) as count FROM automation_rules WHERE user_id = ?', [user.id]);
    const shopCount = await query.get('SELECT COUNT(*) as count FROM shops WHERE user_id = ?', [user.id]);
    console.log(`   └─ Items: ${itemCount.count} | Automations: ${automationCount.count} | Shops: ${shopCount.count}\n`);
}

await closeDatabase();
