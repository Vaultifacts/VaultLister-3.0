// Market Intelligence API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testCompetitorId = null;

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
});

describe('Market Intel - Competitors List', () => {
    test('GET /market-intel/competitors - should return competitor list', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/competitors?platform=poshmark - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors?platform=poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/competitors - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors`);

        expect(response.status).toBe(401);
    });
});

describe('Market Intel - Add Competitor', () => {
    test('POST /market-intel/competitors - should add competitor', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'poshmark',
                username: 'test_competitor_' + Date.now(),
                profile_url: 'https://poshmark.com/closet/test_competitor',
                category_focus: 'Clothing',
                notes: 'Test competitor for monitoring'
            })
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.platform).toBe('poshmark');
        testCompetitorId = data.id;
    });

    test('POST /market-intel/competitors - should fail without platform', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                username: 'test_competitor'
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Platform and username are required');
    });

    test('POST /market-intel/competitors - should fail without username', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'poshmark'
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Platform and username are required');
    });
});

describe('Market Intel - Get Competitor Details', () => {
    test('GET /market-intel/competitors/:id - should return competitor details', async () => {
        if (!testCompetitorId) return;

        const response = await fetch(`${BASE_URL}/market-intel/competitors/${testCompetitorId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.id).toBe(testCompetitorId);
        expect(data.listings).toBeDefined();
    });

    test('GET /market-intel/competitors/:id - should return 404 for non-existent competitor', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/competitors/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(404);
    });
});

describe('Market Intel - Competitor Listings', () => {
    test('GET /market-intel/competitors/:id/listings - should return listings', async () => {
        if (!testCompetitorId) return;

        const response = await fetch(`${BASE_URL}/market-intel/competitors/${testCompetitorId}/listings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/competitors/:id/listings?sold=true - should filter sold listings', async () => {
        if (!testCompetitorId) return;

        const response = await fetch(`${BASE_URL}/market-intel/competitors/${testCompetitorId}/listings?sold=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });
});

describe('Market Intel - Refresh Competitor', () => {
    test('POST /market-intel/competitors/:id/refresh - should refresh competitor data', async () => {
        if (!testCompetitorId) return;

        const response = await fetch(`${BASE_URL}/market-intel/competitors/${testCompetitorId}/refresh`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.refreshed).toBe(true);
        expect(data.new_listings).toBeDefined();
    });
});

describe('Market Intel - Insights', () => {
    test('GET /market-intel/insights - should return market insights', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/insights`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/insights?category=Clothing - should filter by category', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/insights?category=Clothing`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/insights?platform=ebay - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/insights?platform=ebay`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('POST /market-intel/insights/:category - should generate insight', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/insights/Shoes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'ebay',
                brand: 'Nike'
            })
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.category).toBe('Shoes');
        expect(data.opportunity_score).toBeDefined();
    });
});

describe('Market Intel - Opportunities', () => {
    test('GET /market-intel/opportunities - should return sourcing opportunities', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/opportunities`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/opportunities?limit=3 - should limit results', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/opportunities?limit=3`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeLessThanOrEqual(3);
    });
});

describe('Market Intel - Compare Price', () => {
    test('POST /market-intel/compare-price - should compare prices', async () => {
        // First get an inventory item
        const invResponse = await fetch(`${BASE_URL}/inventory?limit=1`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const invData = await invResponse.json();

        if (invData.items && invData.items.length > 0) {
            const response = await fetch(`${BASE_URL}/market-intel/compare-price`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    inventory_id: invData.items[0].id,
                    platform: 'ebay'
                })
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data).toBeDefined();
        }
    });

    test('POST /market-intel/compare-price - should require inventory_id', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/compare-price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                platform: 'ebay'
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('inventory_id required');
    });

    test('POST /market-intel/compare-price - should return 404 for non-existent item', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/compare-price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                inventory_id: 'non-existent-id',
                platform: 'ebay'
            })
        });

        expect(response.status).toBe(404);
    });
});

describe('Market Intel - Trending', () => {
    test('GET /market-intel/trending - should return trending categories', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/trending`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });

    test('GET /market-intel/trending?platform=poshmark - should filter by platform', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/trending?platform=poshmark`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
    });
});

describe('Market Intel - Platforms', () => {
    test('GET /market-intel/platforms - should return supported platforms', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/platforms`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0].id).toBeDefined();
        expect(data[0].name).toBeDefined();
        expect(data[0].color).toBeDefined();
    });
});

describe('Market Intel - Stats', () => {
    test('GET /market-intel/stats - should return statistics', async () => {
        const response = await fetch(`${BASE_URL}/market-intel/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.competitors_tracked).toBeDefined();
        expect(data.listings_tracked).toBeDefined();
        expect(data.avg_opportunity_score).toBeDefined();
    });
});

describe('Market Intel - Delete Competitor', () => {
    test('DELETE /market-intel/competitors/:id - should delete competitor', async () => {
        if (!testCompetitorId) return;

        const response = await fetch(`${BASE_URL}/market-intel/competitors/${testCompetitorId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.deleted).toBe(true);
    });
});
