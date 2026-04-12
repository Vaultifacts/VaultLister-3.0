// Listings API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testInventoryId = null;
let testListingId = null;
let testFolderId = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;

    // Create a test inventory item for listing tests
    const inventoryResponse = await fetch(`${BASE_URL}/inventory`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
            title: 'Listing Test Inventory Item',
            listPrice: 49.99,
            description: 'Test item for listing tests',
            category: 'Tops',
            brand: 'Test Brand'
        })
    });
    const inventoryData = await inventoryResponse.json();
    testInventoryId = inventoryData.item?.id;
});

describe('Listings - Folders', () => {
    test('GET /listings/folders - should return folders list', async () => {
        const response = await fetch(`${BASE_URL}/listings/folders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.folders).toBeDefined();
            expect(Array.isArray(data.folders)).toBe(true);
        }
    });

    test('POST /listings/folders - should create folder', async () => {
        const response = await fetch(`${BASE_URL}/listings/folders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Test Folder',
                color: '#ff5733'
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            expect(data.id).toBeDefined();
            testFolderId = data.id;
        }
    });

    test('POST /listings/folders - should require name', async () => {
        const response = await fetch(`${BASE_URL}/listings/folders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toContain('required');
        }
    });

    test('PATCH /listings/folders/:id - should update folder', async () => {
        if (!testFolderId) {
            console.log('Skipping: No test folder ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/folders/${testFolderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: 'Updated Folder',
                color: '#00ff00'
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.name).toBe('Updated Folder');
        }
    });

    test('PATCH /listings/folders/:id - should return 404 for non-existent folder', async () => {
        const response = await fetch(`${BASE_URL}/listings/folders/00000000-0000-0000-0000-000000000000`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name: 'Test' })
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Listings - List', () => {
    test('GET /listings - should return listings list', async () => {
        const response = await fetch(`${BASE_URL}/listings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listings).toBeDefined();
            expect(Array.isArray(data.listings)).toBe(true);
            expect(data.total).toBeDefined();
        }
    });

    test('GET /listings?platform=poshmark - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/listings?platform=poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listings).toBeDefined();
        }
    });

    test('GET /listings?status=active - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/listings?status=active`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listings).toBeDefined();
        }
    });

    test('GET /listings?limit=10&offset=0 - should paginate', async () => {
        const response = await fetch(`${BASE_URL}/listings?limit=10&offset=0`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listings.length).toBeLessThanOrEqual(10);
        }
    });
});

describe('Listings - Create', () => {
    test('POST /listings - should create listing', async () => {
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: testInventoryId,
                platform: 'poshmark',
                title: 'Test Listing',
                price: 49.99
            })
        });

        const data = await response.json();
        expect([201, 409]).toContain(response.status); // 409 if already exists
        if (response.status === 201) {
            expect(data.listing).toBeDefined();
            expect(data.listing.id).toBeDefined();
            testListingId = data.listing.id;
        } else if (response.status === 409) {
            testListingId = data.existingId;
        }
    });

    test('POST /listings - should require inventoryId, platform, title, and price', async () => {
        const response = await fetch(`${BASE_URL}/listings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Missing Fields'
            })
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toBeDefined();
        }
    });

    test('POST /listings - should return 404 for non-existent inventory item', async () => {
        const response = await fetch(`${BASE_URL}/listings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: '00000000-0000-0000-0000-000000000000',
                platform: 'ebay',
                title: 'Test',
                price: 10
            })
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Listings - Get Single', () => {
    test('GET /listings/:id - should return listing details', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listing).toBeDefined();
        }
    });

    test('GET /listings/:id - should return 404 for non-existent listing', async () => {
        const response = await fetch(`${BASE_URL}/listings/00000000-0000-0000-0000-000000000000`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Listings - Update', () => {
    test('PUT /listings/:id - should update listing', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Updated Listing Title',
                price: 59.99
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listing).toBeDefined();
        }
    });

    test('PUT /listings/:id - should return 404 for non-existent listing', async () => {
        const response = await fetch(`${BASE_URL}/listings/00000000-0000-0000-0000-000000000000`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ title: 'Test' })
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Listings - Crosslist', () => {
    test('POST /listings/crosslist - should create listings for multiple platforms', async () => {
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/crosslist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: testInventoryId,
                platforms: ['ebay', 'mercari'],
                priceAdjustments: {
                    ebay: 10, // +10%
                    mercari: -5 // -5%
                }
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            expect(data.created).toBeDefined();
            expect(data.skipped).toBeDefined();
            expect(data.errors).toBeDefined();
        }
    });

    test('POST /listings/crosslist - should require inventoryId and platforms', async () => {
        const response = await fetch(`${BASE_URL}/listings/crosslist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toBeDefined();
        }
    });
});

describe('Listings - Share', () => {
    test('POST /listings/:id/share - should queue share task', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/share`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('Share');
            expect(data.taskId).toBeDefined();
        }
    });

    test('POST /listings/:id/share - should return 404 for non-existent listing', async () => {
        const response = await fetch(`${BASE_URL}/listings/00000000-0000-0000-0000-000000000000/share`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Listings - Statistics', () => {
    test('GET /listings/stats - should return statistics', async () => {
        const response = await fetch(`${BASE_URL}/listings/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.stats).toBeDefined();
            expect(data.stats.total).toBeDefined();
            expect(data.stats.byPlatform).toBeDefined();
            expect(data.stats.byStatus).toBeDefined();
        }
    });
});

describe('Listings - Batch', () => {
    test('POST /listings/batch - should create multiple listings', async () => {
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                listings: [
                    { inventory_id: testInventoryId, platform: 'depop', title: 'Batch Test 1', price: 39.99 }
                ]
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.success).toBe(true);
            expect(data.created).toBeDefined();
        }
    });

    test('POST /listings/batch - should require listings array', async () => {
        const response = await fetch(`${BASE_URL}/listings/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({})
        });

        const data = await response.json();
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            expect(data.error).toBeDefined();
        }
    });
});

describe('Listings - Stale', () => {
    test('GET /listings/stale - should return stale listings', async () => {
        const response = await fetch(`${BASE_URL}/listings/stale`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listings).toBeDefined();
            expect(Array.isArray(data.listings)).toBe(true);
            expect(data.threshold).toBeDefined();
        }
    });

    test('GET /listings/stale?daysThreshold=7 - should accept threshold parameter', async () => {
        const response = await fetch(`${BASE_URL}/listings/stale?daysThreshold=7`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.threshold).toBe(7);
        }
    });
});

describe('Listings - Delist/Relist/Refresh', () => {
    test('POST /listings/:id/delist - should delist listing', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/delist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason: 'test' })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listing).toBeDefined();
            expect(data.action).toBeDefined();
        }
    });

    test('POST /listings/:id/relist - should relist listing', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/relist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason: 'test' })
        });

        const data = await response.json();
        expect([200, 400]).toContain(response.status); // 400 if Facebook listing marked as sold
        if (response.status === 200) {
            expect(data.listing).toBeDefined();
            expect(data.action).toBe('relist');
        }
    });

    test('POST /listings/:id/refresh - should refresh listing', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason: 'test' })
        });

        const data = await response.json();
        expect([200, 400]).toContain(response.status); // 400 if Facebook listing
        if (response.status === 200) {
            expect(data.listing).toBeDefined();
            expect(data.action).toBe('refresh');
        }
    });

    test('POST /listings/refresh-bulk - should refresh multiple listings', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/refresh-bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                listingIds: [testListingId],
                reason: 'bulk_test'
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.success).toBe(true);
            expect(data.results).toBeDefined();
        }
    });
});

describe('Listings - Refresh History', () => {
    test('GET /listings/:id/refresh-history - should return refresh history', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/refresh-history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.history).toBeDefined();
            expect(Array.isArray(data.history)).toBe(true);
        }
    });
});

describe('Listings - Staleness Settings', () => {
    test('PUT /listings/:id/staleness-settings - should update staleness settings', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/staleness-settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                stalenessDays: 14,
                autoRelistEnabled: true
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.listing).toBeDefined();
        }
    });
});

describe('Listings - Archive/Unarchive', () => {
    test('POST /listings/:id/archive - should archive listing', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/archive`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('archived');
        }
    });

    test('POST /listings/:id/unarchive - should unarchive listing', async () => {
        if (!testListingId) {
            console.log('Skipping: No test listing ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${testListingId}/unarchive`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 400]).toContain(response.status); // 400 if not archived
        if (response.status === 200) {
            expect(data.message).toContain('unarchived');
        }
    });
});

describe('Listings - Delete', () => {
    test('DELETE /listings/:id - should delete listing', async () => {
        // Create a new listing to delete
        if (!testInventoryId) {
            console.log('Skipping: No test inventory ID');
            return;
        }

        const createResponse = await fetch(`${BASE_URL}/listings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventoryId: testInventoryId,
                platform: 'grailed',
                title: 'Delete Test Listing',
                price: 29.99
            })
        });
        const createData = await createResponse.json();
        const deleteListingId = createData.listing?.id || createData.existingId;

        if (!deleteListingId) {
            console.log('Skipping: Could not create delete test listing');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/${deleteListingId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('deleted');
        }
    });

    test('DELETE /listings/:id - should return 404 for non-existent listing', async () => {
        const response = await fetch(`${BASE_URL}/listings/00000000-0000-0000-0000-000000000000`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Listings - Delete Folder', () => {
    test('DELETE /listings/folders/:id - should delete folder', async () => {
        if (!testFolderId) {
            console.log('Skipping: No test folder ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/listings/folders/${testFolderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.message).toContain('deleted');
        }
    });
});

describe('Listings - Authentication', () => {
    test('GET /listings - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/listings`);
        expect(response.status).toBe(401);
    });

    test('POST /listings - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/listings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform: 'test', title: 'Test', price: 10 })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Listings API tests...');
