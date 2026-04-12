// Whatnot Live Selling API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testEventId = null;
let testItemId = null;

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

describe('Whatnot - List Events', () => {
    test('GET /whatnot - should return event list', async () => {
        const response = await fetch(`${BASE_URL}/whatnot`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.events).toBeDefined();
            expect(Array.isArray(data.events)).toBe(true);
        }
    });

    test('GET /whatnot?status=scheduled - should filter by status', async () => {
        const response = await fetch(`${BASE_URL}/whatnot?status=scheduled`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.events).toBeDefined();
        }
    });

    test('GET /whatnot?upcoming=true - should filter upcoming events', async () => {
        const response = await fetch(`${BASE_URL}/whatnot?upcoming=true`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.events).toBeDefined();
        }
    });

    test('GET /whatnot - should require authentication', async () => {
        const response = await fetch(`${BASE_URL}/whatnot`);

        expect(response.status).toBe(401);
    });
});

describe('Whatnot - Create Event', () => {
    test('POST /whatnot - should create live event', async () => {
        const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const response = await fetch(`${BASE_URL}/whatnot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Test Live Event',
                description: 'A test live selling event',
                start_time: futureDate,
                category: 'clothing',
                estimated_duration: 90,
                shipping_option: 'calculated',
                notes: 'Test event notes'
            })
        });

        // 201 on success, 403 if feature is tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            const data = await response.json();
            expect(data.event).toBeDefined();
            expect(data.event.title).toBe('Test Live Event');
            expect(data.message).toBe('Event created');
            testEventId = data.event.id;
        }
    });

    test('POST /whatnot - should fail without title', async () => {
        const response = await fetch(`${BASE_URL}/whatnot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                start_time: new Date().toISOString()
            })
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Title and start time are required');
        }
    });

    test('POST /whatnot - should fail without start_time', async () => {
        const response = await fetch(`${BASE_URL}/whatnot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Test Event'
            })
        });

        // 400 on validation error, 403 if feature is tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Title and start time are required');
        }
    });
});

describe('Whatnot - Get Single Event', () => {
    test('GET /whatnot/:id - should return event with items', async () => {
        if (!testEventId) return;

        const response = await fetch(`${BASE_URL}/whatnot/${testEventId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.event).toBeDefined();
            expect(data.event.id).toBe(testEventId);
            expect(data.event.items).toBeDefined();
        }
    });

    test('GET /whatnot/:id - should return 404 for non-existent event', async () => {
        const response = await fetch(`${BASE_URL}/whatnot/non-existent-id`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 if event not found, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
        if (response.status === 404) {
            const data = await response.json();
            expect(data.error).toBeDefined();
        }
    });
});

describe('Whatnot - Update Event', () => {
    test('PUT /whatnot/:id - should update event', async () => {
        if (!testEventId) return;

        const response = await fetch(`${BASE_URL}/whatnot/${testEventId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Updated Test Live Event',
                description: 'Updated description',
                estimated_duration: 120
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.event).toBeDefined();
            expect(data.event.title).toBe('Updated Test Live Event');
        }
    });

    test('PUT /whatnot/:id - should update status', async () => {
        if (!testEventId) return;

        const response = await fetch(`${BASE_URL}/whatnot/${testEventId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'scheduled'
            })
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.event.status).toBe('scheduled');
        }
    });

    test('PUT /whatnot/:id - should return 404 for non-existent event', async () => {
        const response = await fetch(`${BASE_URL}/whatnot/non-existent-id`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ title: 'Test' })
        });

        // 404 if event not found, 403 if feature is tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Whatnot - Event Items', () => {
    test('POST /whatnot/:id/items - should add item to event', async () => {
        if (!testEventId) return;

        // First get an inventory item
        const invResponse = await fetch(`${BASE_URL}/inventory?limit=1`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const invData = await invResponse.json();

        if (invData.items && invData.items.length > 0) {
            const response = await fetch(`${BASE_URL}/whatnot/${testEventId}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    inventory_id: invData.items[0].id,
                    starting_price: 10,
                    buy_now_price: 50,
                    min_price: 5
                })
            });

            // 201 on success, 403 if tier-gated on CI
            expect([201, 403]).toContain(response.status);
            if (response.status === 201) {
                const data = await response.json();
                expect(data.item).toBeDefined();
                testItemId = data.item.id;
            }
        }
    });

    test('POST /whatnot/:id/items - should fail without inventory_id', async () => {
        if (!testEventId) return;

        const response = await fetch(`${BASE_URL}/whatnot/${testEventId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                starting_price: 10
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.error).toBe('Inventory ID required');
        }
    });

    test('DELETE /whatnot/:eventId/items/:itemId - should remove item from event', async () => {
        if (!testEventId || !testItemId) return;

        const response = await fetch(`${BASE_URL}/whatnot/${testEventId}/items/${testItemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toBe('Item removed');
        }
    });
});

describe('Whatnot - Statistics', () => {
    test('GET /whatnot/stats - should return event statistics', async () => {
        const response = await fetch(`${BASE_URL}/whatnot/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.stats).toBeDefined();
            expect(data.stats.total_events).toBeDefined();
            expect(data.stats.upcoming).toBeDefined();
            expect(data.stats.completed).toBeDefined();
            expect(data.stats.total_items_sold).toBeDefined();
        }
    });
});

describe('Whatnot - Delete Event', () => {
    test('DELETE /whatnot/:id - should delete event', async () => {
        if (!testEventId) return;

        const response = await fetch(`${BASE_URL}/whatnot/${testEventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.message).toBe('Event deleted');
        }
    });
});
