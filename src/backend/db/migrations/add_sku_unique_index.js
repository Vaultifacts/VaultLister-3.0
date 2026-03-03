// Migration: Add unique index on inventory(user_id, sku)
import { query } from '../database.js';

export function up() {
    console.log('Running migration: add_sku_unique_index');

    query.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_user_sku
        ON inventory(user_id, sku) WHERE sku IS NOT NULL
    `);

    console.log('✓ Unique index on inventory(user_id, sku) created');
}

export function down() {
    query.run('DROP INDEX IF EXISTS idx_inventory_user_sku');
    console.log('✓ idx_inventory_user_sku index dropped');
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    up();
}
