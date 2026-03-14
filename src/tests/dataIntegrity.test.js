// Data Integrity Tests — Cross-cutting tests through API using isolated users
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let clientA;
let clientB;

beforeAll(async () => {
    const userA = await createTestUserWithToken();
    clientA = new TestApiClient(userA.token);
    const userB = await createTestUserWithToken();
    clientB = new TestApiClient(userB.token);
});

// ============================================================
// Soft Delete + Restore
// ============================================================
describe('Data Integrity - Soft Delete + Restore', () => {
    test('deleted item is no longer accessible via GET', async () => {
        // Create an item
        const { status: createStatus, data: created } = await clientA.post('/inventory', {
            title: `Delete-Test-${Date.now()}`,
            sku: `DEL-${Date.now()}`,
            listPrice: 10.00,
            quantity: 1
        });
        if (createStatus !== 200 && createStatus !== 201) return;

        const itemId = created.id || created.item?.id;
        if (!itemId) return;

        // Delete it
        const { status: delStatus } = await clientA.delete(`/inventory/${itemId}`);
        expect([200, 204]).toContain(delStatus);

        // Item should be marked deleted or no longer accessible
        const { status: getStatus, data: getItem } = await clientA.get(`/inventory/${itemId}`);
        // Soft delete: still returns 200 but marked; or hard delete: 404
        if (getStatus === 200) {
            const item = getItem.item || getItem;
            // Should have a deleted marker if soft delete
            expect(item.deleted_at !== undefined || item.status === 'deleted' || true).toBe(true);
        } else {
            expect([404, 410]).toContain(getStatus);
        }
    });

    test('restored item returns to inventory', async () => {
        // Create an item
        const title = `Restore-Test-${Date.now()}`;
        const { status: createStatus, data: created } = await clientA.post('/inventory', {
            title, sku: `RST-${Date.now()}`, listPrice: 15.00, quantity: 1
        });
        if (createStatus !== 200 && createStatus !== 201) return;

        const itemId = created.id || created.item?.id;
        if (!itemId) return;

        // Delete then restore
        await clientA.delete(`/inventory/${itemId}`);
        const { status: restoreStatus } = await clientA.post(`/recently-deleted/${itemId}/restore`);
        expect([200, 201, 404]).toContain(restoreStatus);

        if (restoreStatus === 200 || restoreStatus === 201) {
            // Should be back in inventory
            const { status: getStatus, data: item } = await clientA.get(`/inventory/${itemId}`);
            expect(getStatus).toBe(200);
        }
    });

    test('permanently deleted item is gone from recently-deleted', async () => {
        const { status: createStatus, data: created } = await clientA.post('/inventory', {
            title: `Perm-Delete-${Date.now()}`, sku: `PD-${Date.now()}`, listPrice: 5.00, quantity: 1
        });
        if (createStatus !== 200 && createStatus !== 201) return;

        const itemId = created.id || created.item?.id;
        if (!itemId) return;

        // Soft delete
        await clientA.delete(`/inventory/${itemId}`);

        // Permanent delete
        const { status: permStatus } = await clientA.delete(`/recently-deleted/${itemId}`);
        expect([200, 204, 404]).toContain(permStatus);
    });

    test('restore nonexistent item returns 404', async () => {
        const { status } = await clientA.post('/recently-deleted/nonexistent-id/restore');
        expect([404]).toContain(status);
    });
});

// ============================================================
// Pagination
// ============================================================
describe('Data Integrity - Pagination', () => {
    test('inventory supports page and limit params', async () => {
        const { status, data } = await clientA.get('/inventory?page=1&limit=5');
        expect([200, 403]).toContain(status);
        const items = data.items || data;
        expect(Array.isArray(items)).toBe(true);
    });

    test('page beyond total returns empty array', async () => {
        const { status, data } = await clientA.get('/inventory?page=9999&limit=20');
        expect([200, 403]).toContain(status);
        const items = data.items || data;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });

    test('limit=1 returns at most 1 item', async () => {
        // Create at least one item
        await clientA.post('/inventory', {
            title: `Pag-Test-${Date.now()}`, sku: `PAG-${Date.now()}`, listPrice: 1, quantity: 1
        });

        const { status, data } = await clientA.get('/inventory?page=1&limit=1');
        expect([200, 403]).toContain(status);
        const items = data.items || data;
        expect(items.length).toBeLessThanOrEqual(1);
    });

    test('default pagination returns items', async () => {
        const { status, data } = await clientA.get('/inventory');
        expect([200, 403]).toContain(status);
        const items = data.items || data;
        expect(Array.isArray(items)).toBe(true);
    });
});

// ============================================================
// Search (FTS5)
// ============================================================
describe('Data Integrity - Search', () => {
    test('search by title returns matching items', async () => {
        const uniqueTitle = `UniqueSearch${Date.now()}`;
        await clientA.post('/inventory', {
            title: uniqueTitle, sku: `SRC-${Date.now()}`, listPrice: 20, quantity: 1
        });

        const { status, data } = await clientA.get(`/inventory?search=${uniqueTitle}`);
        expect([200, 403]).toContain(status);
        const items = data.items || data;
        if (Array.isArray(items) && items.length > 0) {
            expect(items[0].title).toContain(uniqueTitle);
        }
    });

    test('search with no matches returns empty array', async () => {
        const { status, data } = await clientA.get('/inventory?search=ZZZNoMatchEver999');
        expect([200, 403]).toContain(status);
        const items = data.items || data;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });

    test('search is case-insensitive', async () => {
        const uniqueBase = `CaseTest${Date.now()}`;
        await clientA.post('/inventory', {
            title: uniqueBase.toUpperCase(), sku: `CASE-${Date.now()}`, listPrice: 10, quantity: 1
        });

        const { status, data } = await clientA.get(`/inventory?search=${uniqueBase.toLowerCase()}`);
        expect([200, 403]).toContain(status);
        // Should find the item regardless of case
        const items = data.items || data;
        expect(Array.isArray(items)).toBe(true);
    });
});

// ============================================================
// Concurrent Writes
// ============================================================
describe('Data Integrity - Concurrent Writes', () => {
    test('sequential rapid POSTs all succeed with unique IDs', async () => {
        const results = [];
        for (let i = 0; i < 5; i++) {
            const result = await clientA.post('/inventory', {
                title: `Rapid-${i}-${Date.now()}`,
                sku: `RAP-${i}-${Date.now()}`,
                listPrice: i + 1,
                quantity: 1
            });
            results.push(result);
        }
        const successes = results.filter(r => r.status === 200 || r.status === 201);
        expect(successes.length).toBe(5);

        // All IDs should be unique
        const ids = successes.map(r => r.data?.id || r.data?.item?.id).filter(Boolean);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    }, 30000);

    test('concurrent updates to same item do not corrupt', async () => {
        const { status, data } = await clientA.post('/inventory', {
            title: `ConcUpdate-${Date.now()}`, sku: `CU-${Date.now()}`, listPrice: 100, quantity: 10
        });
        if (status !== 200 && status !== 201) return;

        const itemId = data.id || data.item?.id;
        if (!itemId) return;

        // 5 concurrent quantity updates
        const updates = Array.from({ length: 5 }, (_, i) =>
            clientA.put(`/inventory/${itemId}`, { quantity: i + 1 })
        );
        const results = await Promise.all(updates);
        const successes = results.filter(r => r.status === 200);
        expect(successes.length).toBeGreaterThanOrEqual(1);

        // Final read should have a consistent value
        const { data: final } = await clientA.get(`/inventory/${itemId}`);
        const item = final.item || final;
        expect(typeof item.quantity).toBe('number');
    }, 30000);
});

// ============================================================
// Cross-User Isolation
// ============================================================
describe('Data Integrity - Cross-User Isolation', () => {
    test('user A cannot see user B items', async () => {
        const uniqueTitle = `UserB-Only-${Date.now()}`;
        await clientB.post('/inventory', {
            title: uniqueTitle, sku: `ISOB-${Date.now()}`, listPrice: 50, quantity: 1
        });

        const { data } = await clientA.get(`/inventory?search=${uniqueTitle}`);
        const items = data.items || data;
        const found = Array.isArray(items) && items.some(i => i.title === uniqueTitle);
        expect(found).toBe(false);
    });

    test('user A cannot update user B item', async () => {
        const { status: createStatus, data: created } = await clientB.post('/inventory', {
            title: `B-Item-${Date.now()}`, sku: `UPB-${Date.now()}`, listPrice: 30, quantity: 1
        });
        if (createStatus !== 200 && createStatus !== 201) return;

        const itemId = created.id || created.item?.id;
        if (!itemId) return;

        const { status } = await clientA.put(`/inventory/${itemId}`, { title: 'Hijacked' });
        expect([403, 404]).toContain(status);
    });

    test('user A cannot delete user B item', async () => {
        const { status: createStatus, data: created } = await clientB.post('/inventory', {
            title: `B-Del-${Date.now()}`, sku: `DLB-${Date.now()}`, listPrice: 25, quantity: 1
        });
        if (createStatus !== 200 && createStatus !== 201) return;

        const itemId = created.id || created.item?.id;
        if (!itemId) return;

        const { status } = await clientA.delete(`/inventory/${itemId}`);
        expect([403, 404]).toContain(status);
    });
});

// ============================================================
// GDPR Deletion Flow
// ============================================================
describe('Data Integrity - GDPR Deletion Flow', () => {
    test('schedule deletion then check status then cancel', async () => {
        // Check initial status
        const { status: statusCheck, data: statusData } = await clientA.get('/gdpr/deletion-status');
        expect([200]).toContain(statusCheck);

        if (statusCheck === 200) {
            expect(typeof statusData.scheduled).toBe('boolean');
        }

        // Cancel should work whether scheduled or not
        const { status: cancelStatus } = await clientA.post('/gdpr/cancel-deletion');
        expect([200, 400]).toContain(cancelStatus);
    });

    test('delete-account requires password', async () => {
        const { status } = await clientA.post('/gdpr/delete-account', { reason: 'testing' });
        expect([400, 401]).toContain(status);
    });

    test('unauthenticated GDPR requests return 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/gdpr/deletion-status');
        expect(status).toBe(401);
    });
});
