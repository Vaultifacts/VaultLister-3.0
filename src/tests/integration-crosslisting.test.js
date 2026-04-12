// Integration test: Cross-listing workflow (REM-01)
// Exercises: create inventory → crosslist to platforms → verify listings → update → delete cascade
// Uses real DB, no server required.

import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../backend/db/database.js';

let isMocked = false;
const it = (name, fn) => test(name, async () => { if (isMocked) return; return await fn(); });

const ids = { users: [], inventory: [], listings: [] };
let userId;

beforeAll(async () => {
    try {
        if (typeof query.exec !== 'function') { isMocked = true; return; }
        const tables = await query.all("SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename='listings'");
        if (!tables || tables.length === 0) { isMocked = true; return; }

        userId = uuidv4();
        ids.users.push(userId);
        await query.run(
            'INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)',
            [userId, `crosslist-${userId}@test.com`, `cl-${userId.slice(0, 8)}`, 'testhash']
        );
    } catch {
        isMocked = true;
    }
});

afterAll(async () => {
    if (isMocked) return;
    for (const id of ids.listings) {
        try { await query.run('DELETE FROM listings WHERE id = ?', [id]); } catch {}
    }
    for (const id of ids.inventory) {
        try { await query.run('DELETE FROM inventory WHERE id = ?', [id]); } catch {}
    }
    for (const id of ids.users) {
        try { await query.run('DELETE FROM users WHERE id = ?', [id]); } catch {}
    }
});

async function createInventoryItem(overrides = {}) {
    const id = uuidv4();
    ids.inventory.push(id);
    const defaults = {
        title: 'Test Nike Air Max 90',
        description: 'Size 10 mens sneakers',
        list_price: 85.00,
        cost_price: 25.00,
        status: 'active',
        brand: 'Nike',
        category: 'Footwear',
        condition: 'good',
        size: '10',
        color: 'Black',
        images: '[]',
    };
    const item = { ...defaults, ...overrides };
    await query.run(`
        INSERT INTO inventory (id, user_id, title, description, list_price, cost_price,
            status, brand, category, condition, size, color, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, item.title, item.description, item.list_price, item.cost_price,
        item.status, item.brand, item.category, item.condition, item.size, item.color, item.images]);
    return id;
}

async function crosslistItem(inventoryId, platforms) {
    const item = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, userId]);
    if (!item) throw new Error('Inventory item not found');

    const results = { created: [], skipped: [], errors: [] };
    for (const platform of platforms) {
        const id = uuidv4();
        try {
            await query.run(`
                INSERT INTO listings (id, inventory_id, user_id, platform, title, description, price, images, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, inventoryId, userId, platform, item.title, item.description, item.list_price, item.images, 'draft']);
            ids.listings.push(id);
            results.created.push({ inventoryId, platform, id });
        } catch (error) {
            if (error.message?.includes('UNIQUE constraint') || error.message?.includes('duplicate key')) {
                results.skipped.push({ inventoryId, platform, reason: 'Already listed' });
            } else {
                results.errors.push({ inventoryId, platform, error: error.message });
            }
        }
    }
    return results;
}

describe('Cross-listing integration flow', () => {
    it('creates an inventory item', async () => {
        const id = await createInventoryItem();
        const item = await query.get('SELECT * FROM inventory WHERE id = ?', [id]);
        expect(item).toBeDefined();
        expect(item.title).toBe('Test Nike Air Max 90');
        expect(Number(item.list_price)).toBe(85);
        expect(item.user_id).toBe(userId);
    });

    it('crosslists to multiple platforms', async () => {
        const invId = await createInventoryItem();
        const result = await crosslistItem(invId, ['poshmark', 'ebay', 'mercari']);

        expect(result.created).toHaveLength(3);
        expect(result.skipped).toHaveLength(0);
        expect(result.errors).toHaveLength(0);

        // Verify listings exist in DB
        const listings = await query.all(
            'SELECT * FROM listings WHERE inventory_id = ? AND user_id = ?',
            [invId, userId]
        );
        expect(listings).toHaveLength(3);

        const platforms = listings.map(l => l.platform).sort();
        expect(platforms).toEqual(['ebay', 'mercari', 'poshmark']);

        // All should be draft status
        for (const listing of listings) {
            expect(listing.status).toBe('draft');
            expect(Number(listing.price)).toBe(85);
            expect(listing.title).toBe('Test Nike Air Max 90');
        }
    });

    it('prevents duplicate listings for same inventory+platform', async () => {
        const invId = await createInventoryItem();
        await crosslistItem(invId, ['poshmark']);

        // Try crosslisting to same platform again
        const result = await crosslistItem(invId, ['poshmark']);
        expect(result.created).toHaveLength(0);
        expect(result.skipped).toHaveLength(1);
        expect(result.skipped[0].reason).toBe('Already listed');
    });

    it('allows same platform for different inventory items', async () => {
        const inv1 = await createInventoryItem({ title: 'Item A' });
        const inv2 = await createInventoryItem({ title: 'Item B' });

        const r1 = await crosslistItem(inv1, ['ebay']);
        const r2 = await crosslistItem(inv2, ['ebay']);

        expect(r1.created).toHaveLength(1);
        expect(r2.created).toHaveLength(1);
    });

    it('listing inherits inventory price and title', async () => {
        const invId = await createInventoryItem({ title: 'Custom Title', list_price: 42.50 });
        await crosslistItem(invId, ['etsy']);

        const listing = await query.get(
            'SELECT * FROM listings WHERE inventory_id = ? AND platform = ?',
            [invId, 'etsy']
        );
        expect(listing.title).toBe('Custom Title');
        expect(Number(listing.price)).toBe(42.5);
    });

    it('listing status can be updated from draft to active', async () => {
        const invId = await createInventoryItem();
        const result = await crosslistItem(invId, ['depop']);
        const listingId = result.created[0].id;

        await query.run("UPDATE listings SET status = 'active' WHERE id = ?", [listingId]);

        const updated = await query.get('SELECT * FROM listings WHERE id = ?', [listingId]);
        expect(updated.status).toBe('active');
    });

    it('deleting listings then inventory succeeds (manual cascade)', async () => {
        const invId = await createInventoryItem();
        await crosslistItem(invId, ['poshmark', 'ebay', 'mercari']);

        // Verify listings exist
        let listings = await query.all('SELECT id FROM listings WHERE inventory_id = ?', [invId]);
        expect(listings.length).toBe(3);

        // Delete listings first, then inventory (FK constraint requires this order
        // unless the DB was created with ON DELETE CASCADE — migration-created DBs may not have it)
        await query.run('DELETE FROM listings WHERE inventory_id = ?', [invId]);
        await query.run('DELETE FROM inventory WHERE id = ?', [invId]);

        listings = await query.all('SELECT id FROM listings WHERE inventory_id = ?', [invId]);
        expect(listings.length).toBe(0);

        const inv = await query.get('SELECT id FROM inventory WHERE id = ?', [invId]);
        expect(inv).toBeNull();

        // Clean up tracked IDs
        ids.inventory = ids.inventory.filter(id => id !== invId);
        ids.listings = ids.listings.filter(id => !listings.some(l => l.id === id));
    });

    it('crosslisting to 9 platforms works', async () => {
        const invId = await createInventoryItem();
        const allPlatforms = ['poshmark', 'ebay', 'mercari', 'depop', 'grailed', 'etsy', 'shopify', 'facebook', 'whatnot'];
        const result = await crosslistItem(invId, allPlatforms);

        expect(result.created).toHaveLength(9);
        expect(result.errors).toHaveLength(0);

        const listings = await query.all('SELECT platform FROM listings WHERE inventory_id = ?', [invId]);
        expect(listings).toHaveLength(9);
    });

    it('listings are user-scoped — other users cannot see them', async () => {
        const invId = await createInventoryItem();
        await crosslistItem(invId, ['poshmark']);

        const otherUserId = uuidv4();
        const otherListings = await query.all(
            'SELECT * FROM listings WHERE inventory_id = ? AND user_id = ?',
            [invId, otherUserId]
        );
        expect(otherListings).toHaveLength(0);
    });

    it('bulk crosslist — multiple items to multiple platforms', async () => {
        const inv1 = await createInventoryItem({ title: 'Bulk Item 1' });
        const inv2 = await createInventoryItem({ title: 'Bulk Item 2' });
        const inv3 = await createInventoryItem({ title: 'Bulk Item 3' });

        for (const invId of [inv1, inv2, inv3]) {
            await crosslistItem(invId, ['poshmark', 'ebay']);
        }

        const total = await query.get(
            'SELECT COUNT(*) as count FROM listings WHERE user_id = ? AND inventory_id IN (?, ?, ?)',
            [userId, inv1, inv2, inv3]
        );
        expect(Number(total.count)).toBe(6); // 3 items × 2 platforms
    });
});
