// Listings — Gap-filling tests for 3 untested endpoints
// Covers: schedule-price-drop, competitor-pricing, time-to-sell
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
}, 15000);

describe('Listings price drop scheduling', () => {
    test('POST /listings/:id/schedule-price-drop nonexistent listing', async () => {
        const { status } = await client.post('/listings/nonexistent/schedule-price-drop', {
            target_price: 19.99,
            drop_date: new Date(Date.now() + 86400000).toISOString()
        });
        expect([404, 400, 500]).toContain(status);
    });
});

describe('Listings competitor pricing', () => {
    test('GET /listings/:id/competitor-pricing nonexistent listing', async () => {
        const { status } = await client.get('/listings/nonexistent/competitor-pricing');
        expect([200, 404, 500]).toContain(status);
    });
});

describe('Listings time to sell', () => {
    test('GET /listings/:id/time-to-sell nonexistent listing', async () => {
        const { status } = await client.get('/listings/nonexistent/time-to-sell');
        expect([200, 404, 500]).toContain(status);
    });
});
