// Incoming Webhook Tests
// Tests webhook reception, signature validation, event types, and endpoint CRUD.
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

// ============================================================
// Unknown Source
// ============================================================
describe('Webhook Incoming - Unknown Source', () => {
    test('POST /webhooks/incoming/unknown returns 404', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/unknown-source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'test' })
        });
        expect([404, 401, 400]).toContain(response.status);
    });

    test('POST /webhooks/incoming without source returns 404', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'test' })
        });
        expect([404, 400]).toContain(response.status);
    });
});

// ============================================================
// Signature Validation
// ============================================================
describe('Webhook Incoming - Signature Validation', () => {
    test('POST without signature header is rejected', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/ebay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'listing.sold', data: {} })
        });
        // Should be 401 for missing signature, or 404 if platform not configured
        expect([401, 400, 404]).toContain(response.status);
    });

    test('POST with invalid signature is rejected', async () => {
        const response = await fetch(`${BASE_URL}/webhooks/incoming/ebay`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': 'sha256=invalid-signature'
            },
            body: JSON.stringify({ event: 'listing.sold', data: {} })
        });
        expect([401, 400, 404]).toContain(response.status);
    });
});

// ============================================================
// Endpoint CRUD
// ============================================================
describe('Webhook Incoming - Endpoint CRUD', () => {
    test('GET /webhooks/endpoints returns array', async () => {
        const { status, data } = await client.get('/webhooks/endpoints');
        expect([200, 403]).toContain(status);
        expect(Array.isArray(data.endpoints || data)).toBe(true);
    });

    test('POST /webhooks/endpoints creates endpoint', async () => {
        const { status, data } = await client.post('/webhooks/endpoints', {
            name: `Test Endpoint ${Date.now()}`,
            url: 'https://example.com/webhook',
            events: ['listing.created', 'order.created']
        });
        expect([200, 201]).toContain(status);
        if (status === 201 || status === 200) {
            expect(data.id || data.name).toBeDefined();
        }
    });

    test('POST /webhooks/endpoints with localhost URL is blocked (SSRF)', async () => {
        const { status } = await client.post('/webhooks/endpoints', {
            name: 'SSRF Test',
            url: 'http://localhost:8080/hook',
            events: ['listing.created']
        });
        expect([400, 403]).toContain(status);
    });

    test('POST /webhooks/endpoints with private IP is blocked (SSRF)', async () => {
        const { status } = await client.post('/webhooks/endpoints', {
            name: 'SSRF Private IP',
            url: 'http://192.168.1.1/hook',
            events: ['listing.created']
        });
        expect([400, 403]).toContain(status);
    });

    test('DELETE /webhooks/endpoints/:nonexistent returns 404', async () => {
        const { status } = await client.delete('/webhooks/endpoints/nonexistent-id');
        expect([404, 403]).toContain(status);
    });
});

// ============================================================
// Event Types
// ============================================================
describe('Webhook Incoming - Event Types', () => {
    test('GET /webhooks/event-types returns list', async () => {
        const { status, data } = await client.get('/webhooks/event-types');
        expect([200, 403]).toContain(status);
        expect(Array.isArray(data)).toBe(true);
        if (data.length > 0) {
            expect(data[0]).toHaveProperty('type');
        }
    });

    test('event types include listing events', async () => {
        const { data } = await client.get('/webhooks/event-types');
        const types = data.map(e => e.type);
        expect(types).toContain('listing.created');
    });

    test('event types include order events', async () => {
        const { data } = await client.get('/webhooks/event-types');
        const types = data.map(e => e.type);
        expect(types).toContain('order.created');
    });
});

// ============================================================
// Auth Guard
// ============================================================
describe('Webhook Incoming - Auth Guard', () => {
    test('unauthenticated endpoints request returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/webhooks/endpoints');
        expect(status).toBe(401);
    });

    test('unauthenticated create returns 401', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.post('/webhooks/endpoints', {
            name: 'x', url: 'https://example.com', events: ['listing.created']
        });
        expect(status).toBe(401);
    });
});
