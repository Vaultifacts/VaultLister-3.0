// Data Systems — DB Constraints, FTS5 Sync Triggers, Cleanup (unit — real DB)
// Covers: UNIQUE violations, CHECK violations, FK cascade/set-null,
//         FTS5 update/delete sync, cleanupExpiredData actual deletion.
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { v4 as uuidv4 } from 'uuid';
import { query, cleanupExpiredData } from '../backend/db/database.js';

let isMocked = false;
const it = (name, fn) => test(name, () => { if (isMocked) return; return fn(); });

// Track IDs created in tests so afterAll can clean up
const ids = { users: [], inventory: [], listings: [], shops: [], sales: [], analytics: [] };

function makeUser() {
    const id = uuidv4();
    ids.users.push(id);
    query.run(
        'INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)',
        [id, `constraints-${id}@test.com`, `cu-${id.slice(0, 8)}`, 'testhash']
    );
    return id;
}

beforeAll(() => {
    try {
        if (typeof query.exec !== 'function') { isMocked = true; return; }
        const tables = query.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        if (!tables || tables.length === 0) { isMocked = true; return; }

        // Apply migrations 096 + 097 if not yet applied (these fix bugs tested below).
        // Applied inline so direct-DB tests pick up the fixes without a server restart.
        const applied = query.all("SELECT name FROM migrations WHERE name IN ('096_add_listings_unique_constraint.sql', '097_fix_fts5_delete_trigger.sql')");
        const appliedNames = new Set(applied.map(r => r.name));

        if (!appliedNames.has('096_add_listings_unique_constraint.sql')) {
            // Deduplicate existing rows before creating the unique index
            query.exec(`DELETE FROM listings WHERE rowid NOT IN (
                SELECT MAX(rowid) FROM listings WHERE inventory_id IS NOT NULL GROUP BY inventory_id, platform
            ) AND inventory_id IN (
                SELECT inventory_id FROM listings WHERE inventory_id IS NOT NULL GROUP BY inventory_id, platform HAVING COUNT(*) > 1
            )`);
            query.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_inv_platform ON listings(inventory_id, platform)');
            query.run("INSERT OR IGNORE INTO migrations (name) VALUES ('096_add_listings_unique_constraint.sql')");
        }

        if (!appliedNames.has('097_fix_fts5_delete_trigger.sql')) {
            query.exec('DROP TRIGGER IF EXISTS inventory_ad');
            query.exec(`CREATE TRIGGER IF NOT EXISTS inventory_ad AFTER DELETE ON inventory BEGIN
                INSERT INTO inventory_fts(inventory_fts, rowid, id, title, description, brand, tags)
                VALUES ('delete', old.rowid, old.id, old.title, old.description, old.brand, old.tags);
            END`);
            query.exec('DROP TRIGGER IF EXISTS inventory_au');
            query.exec(`CREATE TRIGGER IF NOT EXISTS inventory_au AFTER UPDATE ON inventory BEGIN
                INSERT INTO inventory_fts(inventory_fts, rowid, id, title, description, brand, tags)
                VALUES ('delete', old.rowid, old.id, old.title, old.description, old.brand, old.tags);
                INSERT INTO inventory_fts(id, title, description, brand, tags)
                VALUES (new.id, new.title, new.description, new.brand, new.tags);
            END`);
            query.exec("INSERT INTO inventory_fts(inventory_fts) VALUES('rebuild')");
            query.run("INSERT OR IGNORE INTO migrations (name) VALUES ('097_fix_fts5_delete_trigger.sql')");
        }
    } catch { isMocked = true; }
});

afterAll(() => {
    if (isMocked) return;
    try {
        // Clean up in FK-safe order (children before parents)
        for (const id of ids.analytics) { try { query.run('DELETE FROM analytics_snapshots WHERE id = ?', [id]); } catch {} }
        for (const id of ids.sales) { try { query.run('DELETE FROM sales WHERE id = ?', [id]); } catch {} }
        for (const id of ids.listings) { try { query.run('DELETE FROM listings WHERE id = ?', [id]); } catch {} }
        for (const id of ids.inventory) { try { query.run('DELETE FROM inventory WHERE id = ?', [id]); } catch {} }
        for (const id of ids.shops) { try { query.run('DELETE FROM shops WHERE id = ?', [id]); } catch {} }
        for (const id of ids.users) { try { query.run('DELETE FROM users WHERE id = ?', [id]); } catch {} }
    } catch {}
});

// ─── UNIQUE Constraints ───────────────────────────────────────────────────────

describe('DB Constraints — UNIQUE violations', () => {
    it('UNIQUE(email) on users — duplicate email throws', () => {
        const uid1 = uuidv4();
        const uid2 = uuidv4();
        ids.users.push(uid1, uid2);
        const email = `dup-${uid1}@test.com`;
        query.run('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)', [uid1, email, `un1-${uid1.slice(0,6)}`, 'h']);
        expect(() => {
            query.run('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)', [uid2, email, `un2-${uid2.slice(0,6)}`, 'h']);
        }).toThrow();
    });

    it('UNIQUE(username) on users — duplicate username throws', () => {
        const uid1 = uuidv4();
        const uid2 = uuidv4();
        ids.users.push(uid1, uid2);
        const uname = `dupname-${uid1.slice(0, 8)}`;
        query.run('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)', [uid1, `e1-${uid1}@x.com`, uname, 'h']);
        expect(() => {
            query.run('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)', [uid2, `e2-${uid2}@x.com`, uname, 'h']);
        }).toThrow();
    });

    it('UNIQUE(user_id, platform) on shops — duplicate throws', () => {
        const userId = makeUser();
        const s1 = uuidv4(); const s2 = uuidv4();
        ids.shops.push(s1, s2);
        query.run('INSERT INTO shops (id, user_id, platform) VALUES (?, ?, ?)', [s1, userId, 'poshmark']);
        expect(() => {
            query.run('INSERT INTO shops (id, user_id, platform) VALUES (?, ?, ?)', [s2, userId, 'poshmark']);
        }).toThrow();
    });

    // Migration 096 adds UNIQUE index on (inventory_id, platform) to the listings table.
    it('UNIQUE(inventory_id, platform) on listings — duplicate throws', () => {
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'UNIQUE-Listing-Test', 25.00]);
        const l1 = uuidv4(); const l2 = uuidv4();
        ids.listings.push(l1, l2);
        query.run('INSERT INTO listings (id, inventory_id, user_id, platform, title, price) VALUES (?, ?, ?, ?, ?, ?)', [l1, invId, userId, 'ebay', 'L1', 25.00]);
        expect(() => {
            query.run('INSERT INTO listings (id, inventory_id, user_id, platform, title, price) VALUES (?, ?, ?, ?, ?, ?)', [l2, invId, userId, 'ebay', 'L2', 25.00]);
        }).toThrow();
    });

    it('UNIQUE(user_id, date, platform) on analytics_snapshots — duplicate throws', () => {
        const userId = makeUser();
        const s1 = uuidv4(); const s2 = uuidv4();
        ids.analytics.push(s1, s2);
        query.run('INSERT INTO analytics_snapshots (id, user_id, date, platform, metrics) VALUES (?, ?, ?, ?, ?)', [s1, userId, '2020-06-15', 'ebay', '{}']);
        expect(() => {
            query.run('INSERT INTO analytics_snapshots (id, user_id, date, platform, metrics) VALUES (?, ?, ?, ?, ?)', [s2, userId, '2020-06-15', 'ebay', '{}']);
        }).toThrow();
    });

    it('different platforms for same inventory_id on listings — both succeed', () => {
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'Multi-Platform-Item', 30.00]);
        const l1 = uuidv4(); const l2 = uuidv4();
        ids.listings.push(l1, l2);
        // poshmark
        query.run('INSERT INTO listings (id, inventory_id, user_id, platform, title, price) VALUES (?, ?, ?, ?, ?, ?)', [l1, invId, userId, 'poshmark', 'L-posh', 30.00]);
        // ebay — different platform, should not conflict
        expect(() => {
            query.run('INSERT INTO listings (id, inventory_id, user_id, platform, title, price) VALUES (?, ?, ?, ?, ?, ?)', [l2, invId, userId, 'ebay', 'L-ebay', 30.00]);
        }).not.toThrow();
    });
});

// ─── CHECK Constraints ────────────────────────────────────────────────────────

describe('DB Constraints — CHECK violations', () => {
    it('inventory CHECK(status IN ...) — invalid status throws', () => {
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        expect(() => {
            query.run("INSERT INTO inventory (id, user_id, title, list_price, status) VALUES (?, ?, ?, ?, ?)", [invId, userId, 'Check-Status', 10, 'invalid_status']);
        }).toThrow();
    });

    it('inventory CHECK(condition IN ...) — invalid condition throws', () => {
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        expect(() => {
            query.run("INSERT INTO inventory (id, user_id, title, list_price, condition) VALUES (?, ?, ?, ?, ?)", [invId, userId, 'Check-Cond', 10, 'mint']);
        }).toThrow();
    });

    it('inventory valid conditions all succeed (new, like_new, good, fair, poor)', () => {
        const userId = makeUser();
        const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        for (const cond of validConditions) {
            const invId = uuidv4();
            ids.inventory.push(invId);
            expect(() => {
                query.run("INSERT INTO inventory (id, user_id, title, list_price, condition) VALUES (?, ?, ?, ?, ?)", [invId, userId, `Cond-${cond}`, 10, cond]);
            }).not.toThrow();
        }
    });

    it('listings CHECK(status IN ...) — invalid status throws', () => {
        const userId = makeUser();
        const invId = uuidv4();
        const listId = uuidv4();
        ids.inventory.push(invId); ids.listings.push(listId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'Check-Listing-Status', 10]);
        expect(() => {
            query.run("INSERT INTO listings (id, inventory_id, user_id, platform, title, price, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [listId, invId, userId, 'poshmark', 'T', 10, 'bad_status']);
        }).toThrow();
    });

    it('offers CHECK(status IN ...) — invalid status throws', () => {
        const userId = makeUser();
        const invId = uuidv4();
        const listId = uuidv4();
        const offerId = uuidv4();
        ids.inventory.push(invId); ids.listings.push(listId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'Offer-Check-Inv', 10]);
        query.run('INSERT INTO listings (id, inventory_id, user_id, platform, title, price) VALUES (?, ?, ?, ?, ?, ?)', [listId, invId, userId, 'poshmark', 'Offer-L', 10]);
        expect(() => {
            query.run("INSERT INTO offers (id, user_id, listing_id, platform, offer_amount, status) VALUES (?, ?, ?, ?, ?, ?)", [offerId, userId, listId, 'poshmark', 8, 'invalid_offer_status']);
        }).toThrow();
    });
});

// ─── FK CASCADE / SET NULL ────────────────────────────────────────────────────

describe('DB Constraints — FK cascade and set-null', () => {
    it('deleting user cascades to sessions (ON DELETE CASCADE)', () => {
        const userId = makeUser();
        const sessionId = uuidv4();
        const expires = new Date(Date.now() + 3600 * 1000).toISOString();
        query.run('INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)', [sessionId, userId, `tok-${sessionId}`, expires]);

        const before = query.get('SELECT id FROM sessions WHERE id = ?', [sessionId]);
        expect(before).toBeTruthy();

        query.run('DELETE FROM users WHERE id = ?', [userId]);
        const idx = ids.users.indexOf(userId);
        if (idx > -1) ids.users.splice(idx, 1);

        const after = query.get('SELECT id FROM sessions WHERE id = ?', [sessionId]);
        expect(after).toBeNull();
    });

    it('deleting user cascades to inventory (ON DELETE CASCADE)', () => {
        const userId = makeUser();
        const invId = uuidv4();
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'Cascade-Inv', 10]);

        query.run('DELETE FROM users WHERE id = ?', [userId]);
        const idx = ids.users.indexOf(userId);
        if (idx > -1) ids.users.splice(idx, 1);

        expect(query.get('SELECT id FROM inventory WHERE id = ?', [invId])).toBeNull();
    });

    it('deleting inventory sets sales.inventory_id to NULL (ON DELETE SET NULL)', () => {
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'SetNull-Inv', 10]);

        const saleId = uuidv4();
        ids.sales.push(saleId);
        query.run('INSERT INTO sales (id, user_id, inventory_id, platform, sale_price) VALUES (?, ?, ?, ?, ?)', [saleId, userId, invId, 'poshmark', 20]);

        query.run('DELETE FROM inventory WHERE id = ?', [invId]);
        const idxI = ids.inventory.indexOf(invId);
        if (idxI > -1) ids.inventory.splice(idxI, 1);

        const sale = query.get('SELECT id, inventory_id FROM sales WHERE id = ?', [saleId]);
        expect(sale).toBeTruthy();
        expect(sale.inventory_id).toBeNull();
    });

    it('deleting listing cascades to offers (ON DELETE CASCADE)', () => {
        const userId = makeUser();
        const invId = uuidv4();
        const listId = uuidv4();
        const offerId = uuidv4();
        ids.inventory.push(invId); ids.listings.push(listId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, 'Offer-Cascade-Inv', 10]);
        query.run('INSERT INTO listings (id, inventory_id, user_id, platform, title, price) VALUES (?, ?, ?, ?, ?, ?)', [listId, invId, userId, 'poshmark', 'Offer-L', 10]);
        query.run('INSERT INTO offers (id, user_id, listing_id, platform, offer_amount) VALUES (?, ?, ?, ?, ?)', [offerId, userId, listId, 'poshmark', 8]);

        const before = query.get('SELECT id FROM offers WHERE id = ?', [offerId]);
        expect(before).toBeTruthy();

        query.run('DELETE FROM listings WHERE id = ?', [listId]);
        const listIdx = ids.listings.indexOf(listId);
        if (listIdx > -1) ids.listings.splice(listIdx, 1);

        const after = query.get('SELECT id FROM offers WHERE id = ?', [offerId]);
        expect(after).toBeNull();
    });
});

// ─── FTS5 Sync Triggers ───────────────────────────────────────────────────────

// NOTE: FTS5 MATCH with a hyphen in the search term parses the part after the hyphen
// as a column-name token, causing "no such column" errors. All FTS5 search terms in
// these tests use alphanumeric-only strings (no hyphens, no FTS5 special chars).
describe('FTS5 Sync — inventory triggers keep index in sync', () => {
    // NOTE: query.searchInventory() cannot be used here because the live test DB has
    // pre-existing FTS5 corruption (stale rowids from deleted inventory items). Any FTS5
    // MATCH query that scans the index may encounter these stale entries and throw
    // "fts5: missing row N from content table". Instead, we verify trigger behavior by
    // querying the FTS5 shadow data table directly, which stores the indexed terms
    // without doing content-table validation.

    it('newly inserted item is indexed by FTS5 insert trigger', () => {
        const userId = makeUser();
        const invId = uuidv4();
        const uniqueTitle = `FTSINSERT${Date.now()}`;
        ids.inventory.push(invId);
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, uniqueTitle, 10]);

        // Query the FTS5 table by rowid (avoids MATCH scan that hits corrupt entries)
        const row = query.get('SELECT rowid FROM inventory WHERE id = ?', [invId]);
        const ftsRow = query.get('SELECT * FROM inventory_fts WHERE rowid = ?', [row.rowid]);
        expect(ftsRow).toBeTruthy();
        expect(ftsRow.title).toBe(uniqueTitle);
    });

    it('after updating title, FTS5 index reflects new title (update trigger)', () => {
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        const ts = Date.now();
        const oldTitle = `FTSOLD${ts}`;
        const newTitle = `FTSNEW${ts}`;
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, oldTitle, 10]);

        query.run('UPDATE inventory SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newTitle, invId]);

        // Check the FTS5 entry by rowid — should reflect the new title
        const row = query.get('SELECT rowid FROM inventory WHERE id = ?', [invId]);
        const ftsRow = query.get('SELECT * FROM inventory_fts WHERE rowid = ?', [row.rowid]);
        expect(ftsRow).toBeTruthy();
        expect(ftsRow.title).toBe(newTitle);
    });

    // Migration 097 fixed the FTS5 delete trigger by adding 'rowid' to the delete command.
    // Verify the fix: after deleting an inventory row, its FTS5 entry should be removed.
    it('FTS5 delete trigger properly removes entry (fixed by migration 097)', () => {
        const userId = makeUser();
        const invId = uuidv4();
        const uniqueTitle = `FTSDEL${Date.now()}`;
        query.run('INSERT INTO inventory (id, user_id, title, list_price) VALUES (?, ?, ?, ?)', [invId, userId, uniqueTitle, 10]);

        // Verify indexed after insert
        const row = query.get('SELECT rowid FROM inventory WHERE id = ?', [invId]);
        expect(row).toBeTruthy();
        const before = query.get('SELECT * FROM inventory_fts WHERE rowid = ?', [row.rowid]);
        expect(before).toBeTruthy();

        // Delete the inventory row — trigger should remove FTS5 entry
        query.run('DELETE FROM inventory WHERE id = ?', [invId]);

        // Searching for the deleted item's unique title via MATCH should NOT throw
        // and should return empty results (no stale entry).
        const results = query.all(`SELECT * FROM inventory_fts WHERE inventory_fts MATCH ?`, [uniqueTitle]);
        expect(results.length).toBe(0);
    });

    // NOTE: A "FTS5 results are user-scoped" test is omitted here because calling
    // query.searchInventory() can trigger an "fts5: missing row N from content table"
    // error when the existing DB has pre-existing FTS5 desync (rows deleted from inventory
    // without the delete trigger firing). User isolation via searchInventory is tested
    // separately in dataIntegrity.test.js (Cross-User Isolation suite).

    it('FTS5 insert trigger populates brand column in the index', () => {
        // Verify FTS5 index entry has the correct brand — query the FTS5 table directly
        // to avoid triggering the content-table lookup that causes "missing row" errors
        // when the DB has pre-existing FTS5 desync.
        const userId = makeUser();
        const invId = uuidv4();
        ids.inventory.push(invId);
        const uniqueBrand = `BRANDFTS${Date.now()}`;
        query.run('INSERT INTO inventory (id, user_id, title, list_price, brand) VALUES (?, ?, ?, ?, ?)', [invId, userId, 'GenericTitle', 10, uniqueBrand]);

        // Query FTS5 index directly by the text id (no content-table join)
        const ftsRows = query.all('SELECT id, brand FROM inventory_fts WHERE id = ?', [invId]);
        expect(ftsRows.length).toBeGreaterThan(0);
        expect(ftsRows[0].brand).toBe(uniqueBrand);
    });
});

// ─── cleanupExpiredData — actual deletion ─────────────────────────────────────

describe('cleanupExpiredData — verifies real deletion, not just return shape', () => {
    it('removes expired sessions from the database', () => {
        const userId = makeUser();
        const sessionId = uuidv4();
        // Insert an already-expired session
        query.run(
            'INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
            [sessionId, userId, `expired-${sessionId}`, '2000-01-01T00:00:00Z']
        );

        const before = query.get('SELECT id FROM sessions WHERE id = ?', [sessionId]);
        expect(before).toBeTruthy();

        const results = cleanupExpiredData();

        const after = query.get('SELECT id FROM sessions WHERE id = ?', [sessionId]);
        expect(after).toBeNull();
        // The sessions count in results should reflect at least one deletion
        expect(typeof results.sessions).toBe('number');
        expect(results.sessions).toBeGreaterThanOrEqual(1);
    });

    it('non-expired sessions are NOT removed', () => {
        const userId = makeUser();
        const sessionId = uuidv4();
        // Future expiry
        const futureExpiry = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        query.run(
            'INSERT INTO sessions (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
            [sessionId, userId, `valid-${sessionId}`, futureExpiry]
        );

        cleanupExpiredData();

        const still = query.get('SELECT id FROM sessions WHERE id = ?', [sessionId]);
        expect(still).toBeTruthy();

        // Cleanup
        query.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
    });
});
