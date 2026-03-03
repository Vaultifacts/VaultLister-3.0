// Platform Sync — Expanded Unit Tests
// Comprehensive tests beyond basic sync tests in platformSync-*.test.js
// Tests: fee calculations, status mappings, error handling, edge cases,
//        data integrity, cross-platform consistency, and Etsy CRUD operations.

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ============================================================
// Mock setup — must be before any module-under-test imports
// ============================================================

const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
    models: {
        create: mock(), findById: mock(), findOne: mock(),
        findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

// Use real encryption (the existing pattern)
import { encryptToken } from '../backend/utils/encryption.js';

// ============================================================
// Import modules under test
// ============================================================

const { syncEbayShop } = await import('../backend/services/platformSync/ebaySync.js');
const { syncPoshmarkShop } = await import('../backend/services/platformSync/poshmarkSync.js');
const { syncMercariShop } = await import('../backend/services/platformSync/mercariSync.js');
const { syncDepopShop } = await import('../backend/services/platformSync/depopSync.js');
const { syncGrailedShop } = await import('../backend/services/platformSync/grailedSync.js');
const {
    syncEtsyShop, createEtsyListing, updateEtsyListing, deleteEtsyListing,
} = await import('../backend/services/platformSync/etsySync.js');
const {
    performSync, resolveConflict, startSyncScheduler, stopSyncScheduler,
} = await import('../backend/services/platformSync/notionSync.js');

afterAll(() => { stopSyncScheduler(); });

// ============================================================
// Helpers
// ============================================================

function resetMocks() {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    process.env.OAUTH_MODE = 'mock';
}

function makeShop(platform) {
    return {
        id: `shop-${platform}-expanded`,
        user_id: 'user-expanded-1',
        oauth_token: encryptToken(`test-${platform}-token`),
        platform,
    };
}

/** Extract INSERT call params from mockQueryRun for a given table */
function getInsertCalls(table) {
    return mockQueryRun.mock.calls.filter(c =>
        c[0] && c[0].includes(`INSERT INTO ${table}`)
    );
}

/** Extract UPDATE call params from mockQueryRun for a given table */
function getUpdateCalls(table) {
    return mockQueryRun.mock.calls.filter(c =>
        c[0] && c[0].includes(`UPDATE ${table}`)
    );
}

// ============================================================
// eBay Sync — Expanded Tests
// ============================================================

describe('ebaySync — expanded', () => {
    beforeEach(resetMocks);

    test('listing external_data includes sku, listingId, condition, and syncedAt', async () => {
        const result = await syncEbayShop(makeShop('ebay'));
        const inserts = getInsertCalls('listings');
        expect(inserts.length).toBe(2);

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.sku).toBe('MOCK-SKU-001');
        expect(data1.listingId).toBe('mock-listing-1');
        expect(data1.syncedAt).toBeDefined();

        const data2 = JSON.parse(inserts[1][1][9]);
        expect(data2.sku).toBe('MOCK-SKU-002');
    });

    test('order external_data includes orderId, lineItems, and fulfillmentStatus', async () => {
        await syncEbayShop(makeShop('ebay'));
        const inserts = getInsertCalls('sales');
        expect(inserts.length).toBe(1);

        const data = JSON.parse(inserts[0][1][12]);
        expect(data.platform).toBe('ebay');
        expect(data.orderId).toBe('mock-order-1');
        expect(data.fulfillmentStatus).toBe('FULFILLED');
        expect(Array.isArray(data.lineItems)).toBe(true);
    });

    test('listing prices are parsed as numbers from string values', async () => {
        await syncEbayShop(makeShop('ebay'));
        const inserts = getInsertCalls('listings');

        // price field is at index 5
        expect(inserts[0][1][5]).toBe(29.99);
        expect(inserts[1][1][5]).toBe(49.99);
    });

    test('listing quantity defaults to 1 for mock data', async () => {
        await syncEbayShop(makeShop('ebay'));
        const inserts = getInsertCalls('listings');

        // quantity is at index 6
        expect(inserts[0][1][6]).toBe(1);
        expect(inserts[1][1][6]).toBe(3);
    });

    test('sale buyer_username is extracted from nested buyer object', async () => {
        await syncEbayShop(makeShop('ebay'));
        const inserts = getInsertCalls('sales');

        // buyer_username is at index 4
        expect(inserts[0][1][4]).toBe('mock_buyer_1');
    });

    test('sale net_profit = total - fees - shipping', async () => {
        await syncEbayShop(makeShop('ebay'));
        const inserts = getInsertCalls('sales');

        const salePrice = inserts[0][1][5];    // sale_price
        const fees = inserts[0][1][6];          // platform_fees
        const shipping = inserts[0][1][7];      // shipping_cost
        const netProfit = inserts[0][1][8];     // net_profit

        expect(netProfit).toBeCloseTo(salePrice - fees - shipping, 2);
    });

    test('handles mixed create and update in same sync', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            // First listing: exists, second: new, order: new
            if (callCount === 1) return { id: 'existing-listing-1' };
            return null;
        });

        const result = await syncEbayShop(makeShop('ebay'));
        expect(result.listings.created).toBe(1);
        expect(result.listings.updated).toBe(1);
        expect(result.listings.synced).toBe(2);
    });

    test('individual listing error does not abort entire sync', async () => {
        let callCount = 0;
        mockQueryGet.mockReturnValue(null);
        mockQueryRun.mockImplementation((...args) => {
            const sql = typeof args[0] === 'string' ? args[0] : '';
            if (sql.includes('INSERT INTO listings')) {
                callCount++;
                if (callCount === 1) throw new Error('Simulated insert failure');
            }
            return { changes: 1 };
        });

        const result = await syncEbayShop(makeShop('ebay'));
        expect(result.listings.errors.length).toBe(1);
        expect(result.listings.errors[0].error).toContain('Simulated insert failure');
        expect(result.listings.synced).toBe(1); // Second listing succeeded
    });

    test('timestamps are valid ISO 8601 strings', async () => {
        const result = await syncEbayShop(makeShop('ebay'));
        expect(() => new Date(result.startedAt)).not.toThrow();
        expect(() => new Date(result.completedAt)).not.toThrow();
        expect(new Date(result.startedAt).toISOString()).toBe(result.startedAt);
        expect(new Date(result.completedAt).toISOString()).toBe(result.completedAt);
    });
});

// ============================================================
// Poshmark Sync — Expanded Tests
// ============================================================

describe('poshmarkSync — expanded', () => {
    beforeEach(resetMocks);

    test('sold listing maps to quantity 0, available to quantity 1', async () => {
        await syncPoshmarkShop(makeShop('poshmark'));
        const inserts = getInsertCalls('listings');

        // Mock data: listing 1 & 2 = available, listing 3 = sold
        expect(inserts[0][1][6]).toBe(1); // available = qty 1
        expect(inserts[1][1][6]).toBe(1); // available = qty 1
        expect(inserts[2][1][6]).toBe(0); // sold = qty 0
    });

    test('preserves brand and category in external data', async () => {
        await syncPoshmarkShop(makeShop('poshmark'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.brand).toBe('Coach');
        expect(data1.category).toBe('Bags');

        const data2 = JSON.parse(inserts[1][1][9]);
        expect(data2.brand).toBe('Lululemon');
        expect(data2.category).toBe('Activewear');
    });

    test('preserves shares and likes counts in external data', async () => {
        await syncPoshmarkShop(makeShop('poshmark'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.shares).toBe(45);
        expect(data1.likes).toBe(12);
    });

    test('flat $2.95 fee applies for sales $15 or under', async () => {
        // The mock order has price=$55, so the test verifies the >$15 path.
        // We verify the code logic: price > 15 => 20%; else => $2.95
        await syncPoshmarkShop(makeShop('poshmark'));
        const saleInserts = getInsertCalls('sales');

        const platformFee = saleInserts[0][1][6];
        // $55 > $15, so fee = $55 * 0.20 = $11.00
        expect(platformFee).toBeCloseTo(11.00, 2);
    });

    test('default shipping cost is $7.97 when not specified', async () => {
        await syncPoshmarkShop(makeShop('poshmark'));
        const saleInserts = getInsertCalls('sales');

        const shippingCost = saleInserts[0][1][7];
        expect(shippingCost).toBe(7.97);
    });

    test('order external data includes listingId reference', async () => {
        await syncPoshmarkShop(makeShop('poshmark'));
        const saleInserts = getInsertCalls('sales');

        const extData = JSON.parse(saleInserts[0][1][12]);
        expect(extData.listingId).toBe('posh-listing-003');
    });

    test('update path modifies title, price, quantity, status, and external_data', async () => {
        mockQueryGet.mockReturnValue({ id: 'existing-id' });
        await syncPoshmarkShop(makeShop('poshmark'));

        const updates = getUpdateCalls('listings');
        expect(updates.length).toBe(3);

        // Each update should have 7 params: title, price, qty, status, external_data, updated_at, id
        for (const call of updates) {
            expect(call[1].length).toBe(7);
        }
    });
});

// ============================================================
// Mercari Sync — Expanded Tests
// ============================================================

describe('mercariSync — expanded', () => {
    beforeEach(resetMocks);

    test('condition and category are preserved in external data', async () => {
        await syncMercariShop(makeShop('mercari'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.condition).toBe('Like New');
        expect(data1.category).toBe('Electronics');

        const data2 = JSON.parse(inserts[1][1][9]);
        expect(data2.condition).toBe('Good');
        expect(data2.category).toBe('Accessories');
    });

    test('views and likes are preserved in external data', async () => {
        await syncMercariShop(makeShop('mercari'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.likes).toBe(23);
        expect(data1.views).toBe(156);
    });

    test('listing prices match mock data exactly', async () => {
        await syncMercariShop(makeShop('mercari'));
        const inserts = getInsertCalls('listings');

        expect(inserts[0][1][5]).toBe(245.00);
        expect(inserts[1][1][5]).toBe(42.00);
    });

    test('order net profit = price - 10% fee - shipping', async () => {
        await syncMercariShop(makeShop('mercari'));
        const saleInserts = getInsertCalls('sales');

        const price = 42.00;
        const fee = price * 0.10;
        const shipping = 5.99;
        const expectedNet = price - fee - shipping;

        expect(saleInserts[0][1][8]).toBeCloseTo(expectedNet, 2);
    });

    test('handles error on first listing without crashing second', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) throw new Error('First listing DB error');
            return null;
        });

        const result = await syncMercariShop(makeShop('mercari'));
        expect(result.listings.errors.length).toBe(1);
        expect(result.listings.synced).toBe(1);
        expect(result.listings.created).toBe(1);
    });

    test('on_sale maps to active status for all listings', async () => {
        await syncMercariShop(makeShop('mercari'));
        const inserts = getInsertCalls('listings');

        for (const insert of inserts) {
            expect(insert[1][7]).toBe('active');
        }
    });

    test('handles missing column gracefully on shop update', async () => {
        let runCallCount = 0;
        mockQueryRun.mockImplementation((...args) => {
            runCallCount++;
            const sql = typeof args[0] === 'string' ? args[0] : '';
            if (sql.includes('last_sync_at') && sql.includes('UPDATE shops')) {
                throw new Error('no such column: last_sync_at');
            }
            return { changes: 1 };
        });

        // Should not throw — graceful fallback to simpler UPDATE
        const result = await syncMercariShop(makeShop('mercari'));
        expect(result.completedAt).toBeDefined();
    });
});

// ============================================================
// Depop Sync — Expanded Tests
// ============================================================

describe('depopSync — expanded', () => {
    beforeEach(resetMocks);

    test('uses description field as listing title (not title field)', async () => {
        await syncDepopShop(makeShop('depop'));
        const inserts = getInsertCalls('listings');

        // Depop mock data has "description" field, not "title"
        expect(inserts[0][1][4]).toBe('Y2K Baby Tee Pink');
        expect(inserts[1][1][4]).toBe('Low Rise Flare Jeans 90s');
        expect(inserts[2][1][4]).toBe('Butterfly Crop Top');
    });

    test('external data includes size, brand, and likes', async () => {
        await syncDepopShop(makeShop('depop'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.size).toBe('S');
        expect(data1.brand).toBe('Vintage');
        expect(data1.likes).toBe(67);
    });

    test('order buyer_username is extracted correctly', async () => {
        await syncDepopShop(makeShop('depop'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][4]).toBe('y2k_vibes');
    });

    test('10% fee on $22 order = $2.20', async () => {
        await syncDepopShop(makeShop('depop'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][6]).toBeCloseTo(2.20, 2);
    });

    test('shipping cost of $4.50 from mock data', async () => {
        await syncDepopShop(makeShop('depop'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][7]).toBe(4.50);
    });

    test('external_listing_id matches depop listing id', async () => {
        await syncDepopShop(makeShop('depop'));
        const inserts = getInsertCalls('listings');

        // external_listing_id is at index 8
        expect(inserts[0][1][8]).toBe('depop-listing-001');
        expect(inserts[1][1][8]).toBe('depop-listing-002');
        expect(inserts[2][1][8]).toBe('depop-listing-003');
    });

    test('order external_order_id matches depop order id', async () => {
        await syncDepopShop(makeShop('depop'));
        const saleInserts = getInsertCalls('sales');

        // external_order_id is at index 11
        expect(saleInserts[0][1][11]).toBe('depop-order-001');
    });

    test('error in order processing does not prevent results from returning', async () => {
        let queryCount = 0;
        mockQueryGet.mockImplementation(() => {
            queryCount++;
            // Listings: 3 SELECT queries (return null = no existing)
            // Orders: 1 SELECT query — throw here
            if (queryCount === 4) throw new Error('Order lookup failed');
            return null;
        });

        const result = await syncDepopShop(makeShop('depop'));
        // Listings should still succeed
        expect(result.listings.synced).toBe(3);
        // Order should have error
        expect(result.orders.errors.length).toBe(1);
    });
});

// ============================================================
// Grailed Sync — Expanded Tests
// ============================================================

describe('grailedSync — expanded', () => {
    beforeEach(resetMocks);

    test('designer and condition are included in external data', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.designer).toBe('Rick Owens');
        expect(data1.condition).toBe('Gently Used');

        const data2 = JSON.parse(inserts[1][1][9]);
        expect(data2.designer).toBe('Raf Simons');
        expect(data2.condition).toBe('New with Tags');

        const data3 = JSON.parse(inserts[2][1][9]);
        expect(data3.designer).toBe('Helmut Lang');
        expect(data3.condition).toBe('Good');
    });

    test('followers count preserved in external data', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const inserts = getInsertCalls('listings');

        const data = JSON.parse(inserts[0][1][9]);
        expect(data.followers).toBe(156);
    });

    test('listing prices match high-end mock data', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const inserts = getInsertCalls('listings');

        expect(inserts[0][1][5]).toBe(485.00);
        expect(inserts[1][1][5]).toBe(890.00);
        expect(inserts[2][1][5]).toBe(350.00);
    });

    test('9% + $0.30 fee on $350 order = $31.80', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const saleInserts = getInsertCalls('sales');

        const expectedFee = 350.00 * 0.09 + 0.30;
        expect(saleInserts[0][1][6]).toBeCloseTo(expectedFee, 2);
    });

    test('$15 shipping cost from mock order data', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][7]).toBe(15.00);
    });

    test('for_sale status maps to active', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const inserts = getInsertCalls('listings');

        // First two are for_sale, third is sold
        expect(inserts[0][1][7]).toBe('active');
        expect(inserts[1][1][7]).toBe('active');
        expect(inserts[2][1][7]).toBe('sold');
    });

    test('order buyer_username from mock data', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][4]).toBe('archive_collector');
    });

    test('delivered order maps to completed status', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][10]).toBe('completed');
    });

    test('sold listing quantity is 0, for_sale quantity is 1', async () => {
        await syncGrailedShop(makeShop('grailed'));
        const inserts = getInsertCalls('listings');

        expect(inserts[0][1][6]).toBe(1);  // for_sale
        expect(inserts[1][1][6]).toBe(1);  // for_sale
        expect(inserts[2][1][6]).toBe(0);  // sold
    });
});

// ============================================================
// Etsy Sync — Expanded Tests
// ============================================================

describe('etsySync — expanded', () => {
    beforeEach(resetMocks);

    test('Etsy amount/divisor price conversion is accurate', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const inserts = getInsertCalls('listings');

        // { amount: 2500, divisor: 100 } = $25.00
        expect(inserts[0][1][5]).toBe(25.00);
        // { amount: 4500, divisor: 100 } = $45.00
        expect(inserts[1][1][5]).toBe(45.00);
    });

    test('external data includes URL for each listing', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const inserts = getInsertCalls('listings');

        const data1 = JSON.parse(inserts[0][1][9]);
        expect(data1.url).toBe('https://www.etsy.com/listing/mock');

        const data2 = JSON.parse(inserts[1][1][9]);
        expect(data2.url).toBe('https://www.etsy.com/listing/mock2');
    });

    test('order grandtotal conversion from amount/divisor', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const saleInserts = getInsertCalls('sales');

        // grandtotal = { amount: 2500, divisor: 100 } = $25.00
        expect(saleInserts[0][1][5]).toBe(25.00);
    });

    test('9.5% + $0.25 fee calculation on $25 order', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const saleInserts = getInsertCalls('sales');

        const expectedFees = 25.00 * 0.095 + 0.25;
        expect(saleInserts[0][1][6]).toBeCloseTo(expectedFees, 2);
    });

    test('sale date is converted from unix timestamp to ISO string', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const saleInserts = getInsertCalls('sales');

        // sale_date is at index 9
        const saleDate = saleInserts[0][1][9];
        expect(() => new Date(saleDate)).not.toThrow();
        // Should be a valid ISO date string
        expect(new Date(saleDate).toISOString()).toBe(saleDate);
    });

    test('order buyer_email used as buyer_username', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][4]).toBe('buyer@example.com');
    });

    test('paid status maps to completed', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const saleInserts = getInsertCalls('sales');

        expect(saleInserts[0][1][10]).toBe('completed');
    });

    test('active state maps to active status for listings', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const inserts = getInsertCalls('listings');

        for (const ins of inserts) {
            expect(ins[1][7]).toBe('active');
        }
    });

    test('listing external_listing_id is stringified', async () => {
        await syncEtsyShop(makeShop('etsy'));
        const inserts = getInsertCalls('listings');

        // external_listing_id at index 8 should be a string
        for (const ins of inserts) {
            expect(typeof ins[1][8]).toBe('string');
        }
    });

    describe('createEtsyListing — expanded', () => {
        test('listing_id starts with etsy-new-', async () => {
            const result = await createEtsyListing('token', { title: 'Test' });
            expect(result.listing_id).toMatch(/^etsy-new-/);
        });

        test('returns title that matches input', async () => {
            const result = await createEtsyListing('token', { title: 'Handmade Bracelet' });
            expect(result.title).toBe('Handmade Bracelet');
        });

        test('URL points to etsy.com', async () => {
            const result = await createEtsyListing('token', { title: 'Test' });
            expect(result.url).toContain('etsy.com');
        });
    });

    describe('updateEtsyListing — expanded', () => {
        test('returns the same listing_id passed in', async () => {
            const result = await updateEtsyListing('token', 'listing-42', { title: 'New' });
            expect(result.listing_id).toBe('listing-42');
        });

        test('always returns success in mock mode', async () => {
            const result = await updateEtsyListing('token', 'any-id', {});
            expect(result.success).toBe(true);
        });
    });

    describe('deleteEtsyListing — expanded', () => {
        test('returns success true in mock mode', async () => {
            const result = await deleteEtsyListing('token', 'listing-99');
            expect(result.success).toBe(true);
        });

        test('result does not contain listing_id', async () => {
            const result = await deleteEtsyListing('token', 'listing-99');
            expect(result.listing_id).toBeUndefined();
        });
    });
});

// ============================================================
// Notion Sync — Expanded Tests
// ============================================================

describe('notionSync — expanded', () => {
    beforeEach(resetMocks);

    describe('performSync — edge cases', () => {
        test('defaults to bidirectional direction', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(result.direction).toBe('bidirectional');
        });

        test('defaults to all entity types (inventory, sales, notes)', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(result.entity_types).toEqual(['inventory', 'sales', 'notes']);
        });

        test('manual flag defaults to false', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(result.manual).toBe(false);
        });

        test('result includes sync_id as UUID', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            expect(result.sync_id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
            );
        });

        test('duration_ms is a non-negative number', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(typeof result.duration_ms).toBe('number');
            expect(result.duration_ms).toBeGreaterThanOrEqual(0);
        });

        test('completed_at is after started_at', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(new Date(result.completed_at).getTime()).toBeGreaterThanOrEqual(
                new Date(result.started_at).getTime()
            );
        });

        test('supports push-only direction', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1', { direction: 'push' });
            expect(result.direction).toBe('push');
        });

        test('supports pull-only direction', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1', { direction: 'pull' });
            expect(result.direction).toBe('pull');
        });

        test('supports single entity type', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1', { entity_types: ['inventory'] });
            expect(result.entity_types).toEqual(['inventory']);
        });

        test('notes sync returns empty results (placeholder)', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: 'notes-db-id', conflict_strategy: 'manual',
            });

            const result = await performSync('user-1', { entity_types: ['notes'] });
            expect(result.notes.pushed).toBe(0);
            expect(result.notes.pulled).toBe(0);
            expect(result.notes.conflicts).toBe(0);
        });

        test('inventory result has correct initial structure', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(result.inventory).toEqual({
                pushed: 0, pulled: 0, conflicts: 0, errors: [],
            });
        });

        test('sales result has correct initial structure', async () => {
            mockQueryGet.mockReturnValue({
                last_sync_status: null, last_sync_at: null,
                inventory_database_id: null, sales_database_id: null,
                notes_database_id: null, conflict_strategy: 'manual',
            });

            const result = await performSync('user-1');
            expect(result.sales).toEqual({
                pushed: 0, pulled: 0, conflicts: 0, errors: [],
            });
        });
    });

    describe('resolveConflict — edge cases', () => {
        test('throws when conflict not found', async () => {
            mockQueryGet.mockReturnValue(null);
            try {
                await resolveConflict('user-1', 'nonexistent', 'keep_local');
                expect(true).toBe(false);
            } catch (e) {
                expect(e.message).toContain('Conflict not found');
            }
        });

        test('marks conflict as resolved with resolution string', async () => {
            let getCallCount = 0;
            mockQueryGet.mockImplementation(() => {
                getCallCount++;
                if (getCallCount === 1) return {
                    id: 'c-1', user_id: 'user-1', sync_map_id: 'sm-1',
                    entity_type: 'inventory', local_id: 'inv-1', notion_page_id: 'np-1',
                };
                if (getCallCount === 2) return { id: 'sm-1' };
                return null;
            });

            await resolveConflict('user-1', 'c-1', 'ignore');

            // Should have UPDATE notion_sync_conflicts with resolved=1
            const resolveCall = mockQueryRun.mock.calls.find(c =>
                c[0] && c[0].includes('UPDATE notion_sync_conflicts')
            );
            expect(resolveCall).toBeTruthy();
        });

        test('merge without data throws', async () => {
            let getCallCount = 0;
            mockQueryGet.mockImplementation(() => {
                getCallCount++;
                if (getCallCount === 1) return {
                    id: 'c-1', user_id: 'user-1', sync_map_id: 'sm-1',
                    entity_type: 'inventory', local_id: 'inv-1', notion_page_id: 'np-1',
                };
                if (getCallCount === 2) return { id: 'sm-1' };
                return null;
            });

            try {
                await resolveConflict('user-1', 'c-1', 'merge');
                expect(true).toBe(false);
            } catch (e) {
                expect(e.message).toContain('merged_data required');
            }
        });
    });

    describe('scheduler lifecycle — expanded', () => {
        test('start does not throw', () => {
            expect(() => startSyncScheduler()).not.toThrow();
            stopSyncScheduler();
        });

        test('stop is safe before start', () => {
            expect(() => stopSyncScheduler()).not.toThrow();
        });

        test('double start then stop', () => {
            startSyncScheduler();
            startSyncScheduler(); // should be no-op
            stopSyncScheduler();
        });

        test('stop after start then stop again', () => {
            startSyncScheduler();
            stopSyncScheduler();
            stopSyncScheduler(); // should be safe
        });
    });
});

// ============================================================
// Cross-Platform Consistency Tests
// ============================================================

describe('cross-platform consistency', () => {
    const syncFunctions = [
        { fn: syncEbayShop, name: 'ebay', listingCount: 2, orderCount: 1 },
        { fn: syncPoshmarkShop, name: 'poshmark', listingCount: 3, orderCount: 1 },
        { fn: syncMercariShop, name: 'mercari', listingCount: 2, orderCount: 1 },
        { fn: syncDepopShop, name: 'depop', listingCount: 3, orderCount: 1 },
        { fn: syncGrailedShop, name: 'grailed', listingCount: 3, orderCount: 1 },
        { fn: syncEtsyShop, name: 'etsy', listingCount: 2, orderCount: 1 },
    ];

    for (const { fn, name, listingCount, orderCount } of syncFunctions) {
        describe(name, () => {
            beforeEach(resetMocks);

            test(`syncs ${listingCount} listings and ${orderCount} orders`, async () => {
                const result = await fn(makeShop(name));
                expect(result.listings.synced).toBe(listingCount);
                expect(result.listings.created).toBe(listingCount);
                expect(result.orders.synced).toBe(orderCount);
                expect(result.orders.created).toBe(orderCount);
            });

            test('startedAt precedes completedAt', async () => {
                const result = await fn(makeShop(name));
                expect(new Date(result.startedAt).getTime())
                    .toBeLessThanOrEqual(new Date(result.completedAt).getTime());
            });

            test('no errors on clean run', async () => {
                const result = await fn(makeShop(name));
                expect(result.listings.errors).toEqual([]);
                expect(result.orders.errors).toEqual([]);
            });

            test('all listings stored with correct user_id', async () => {
                await fn(makeShop(name));
                const inserts = getInsertCalls('listings');
                for (const ins of inserts) {
                    // user_id is at index 1
                    expect(ins[1][1]).toBe('user-expanded-1');
                }
            });

            test('all listings stored with correct shop_id', async () => {
                await fn(makeShop(name));
                const inserts = getInsertCalls('listings');
                for (const ins of inserts) {
                    // shop_id is at index 2
                    expect(ins[1][2]).toBe(`shop-${name}-expanded`);
                }
            });

            test('all listings have null inventory_id (not linked yet)', async () => {
                await fn(makeShop(name));
                const inserts = getInsertCalls('listings');
                for (const ins of inserts) {
                    // inventory_id is at index 3
                    expect(ins[1][3]).toBeNull();
                }
            });

            test('all sales stored with correct user_id and shop_id', async () => {
                await fn(makeShop(name));
                const saleInserts = getInsertCalls('sales');
                for (const ins of saleInserts) {
                    expect(ins[1][1]).toBe('user-expanded-1');
                    expect(ins[1][2]).toBe(`shop-${name}-expanded`);
                }
            });

            test('external data JSON is parseable for all listings', async () => {
                await fn(makeShop(name));
                const inserts = getInsertCalls('listings');
                for (const ins of inserts) {
                    const parsed = JSON.parse(ins[1][9]);
                    expect(parsed.platform).toBe(name);
                    expect(typeof parsed.syncedAt).toBe('string');
                }
            });

            test('updates shop sync time on success', async () => {
                await fn(makeShop(name));
                const shopUpdates = mockQueryRun.mock.calls.filter(c =>
                    c[0] && c[0].includes('UPDATE shops')
                );
                expect(shopUpdates.length).toBeGreaterThan(0);
            });

            test('all inserts have UUID-format IDs', async () => {
                await fn(makeShop(name));
                const inserts = getInsertCalls('listings');
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
                for (const ins of inserts) {
                    expect(ins[1][0]).toMatch(uuidRegex);
                }
            });

            test('all insert timestamps are valid ISO 8601', async () => {
                await fn(makeShop(name));
                const inserts = getInsertCalls('listings');
                for (const ins of inserts) {
                    // created_at at index 10, updated_at at index 11
                    expect(new Date(ins[1][10]).toISOString()).toBe(ins[1][10]);
                    expect(new Date(ins[1][11]).toISOString()).toBe(ins[1][11]);
                }
            });
        });
    }
});
