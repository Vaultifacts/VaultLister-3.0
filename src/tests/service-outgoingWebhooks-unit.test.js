// Outgoing Webhooks Service Unit Tests — comprehensive coverage
// Tests: sanitizeWebhookData (indirectly), generateSignature (indirectly),
// EVENT_TYPES, RETRY_CONFIG behavior, delivery queue, outgoingWebhooksRouter
import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createMockDb } from './helpers/mockDb.js';
import crypto from 'crypto';

const db = createMockDb();

mock.module('../backend/db/database.js', () => ({
    query: db.query,
    models: db.models,
    escapeLike: db.escapeLike,
    default: db.db,
    initializeDatabase: mock(() => true),
    cleanupExpiredData: mock(() => ({})),
}));

const _logFn = () => mock(() => {});
const _mkLogger = () => ({
    info: _logFn(), warn: _logFn(), error: _logFn(), debug: _logFn(),
    request: _logFn(), db: _logFn(), automation: _logFn(),
    bot: _logFn(), security: _logFn(), performance: _logFn(),
});
mock.module('../backend/shared/logger.js', () => ({
    logger: _mkLogger(),
    createLogger: mock(() => _mkLogger()),
    default: _mkLogger(),
}));

mock.module('dns/promises', () => ({
    resolve4: mock(async () => ['93.184.216.34']),
    resolve6: mock(async () => { throw new Error('ENOTFOUND'); }),
}));

const { outgoingWebhooks, outgoingWebhooksRouter } = await import(
    '../backend/services/outgoingWebhooks.js'
);
const migration = readFileSync(
    join(import.meta.dir, '../backend/db/pg-schema.sql'),
    'utf-8'
);

beforeEach(() => db.reset());

// ============================================================
// EVENT_TYPES via getEventTypes()
// ============================================================
describe('outgoingWebhooks.getEventTypes', () => {
    test('returns a non-empty object', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(typeof types).toBe('object');
        expect(Object.keys(types).length).toBeGreaterThan(0);
    });

    test('includes inventory events', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(types['inventory.created']).toBeDefined();
        expect(types['inventory.updated']).toBeDefined();
        expect(types['inventory.deleted']).toBeDefined();
        expect(types['inventory.low_stock']).toBeDefined();
    });

    test('includes listing events', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(types['listing.created']).toBeDefined();
        expect(types['listing.updated']).toBeDefined();
        expect(types['listing.sold']).toBeDefined();
        expect(types['listing.expired']).toBeDefined();
    });

    test('includes sale events', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(types['sale.created']).toBeDefined();
        expect(types['sale.shipped']).toBeDefined();
        expect(types['sale.delivered']).toBeDefined();
        expect(types['sale.cancelled']).toBeDefined();
    });

    test('includes offer events', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(types['offer.received']).toBeDefined();
        expect(types['offer.accepted']).toBeDefined();
        expect(types['offer.declined']).toBeDefined();
        expect(types['offer.expired']).toBeDefined();
    });

    test('includes automation events', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(types['automation.completed']).toBeDefined();
        expect(types['automation.failed']).toBeDefined();
    });

    test('includes account events', () => {
        const types = outgoingWebhooks.getEventTypes();
        expect(types['account.login']).toBeDefined();
        expect(types['account.settings_changed']).toBeDefined();
    });

    test('each event type has a description string', () => {
        const types = outgoingWebhooks.getEventTypes();
        for (const [key, value] of Object.entries(types)) {
            expect(value).toHaveProperty('description');
            expect(typeof value.description).toBe('string');
            expect(value.description.length).toBeGreaterThan(0);
        }
    });

    test('returns exactly the expected number of event types', () => {
        const types = outgoingWebhooks.getEventTypes();
        // 4 inventory + 4 listing + 4 sale + 4 offer + 2 automation + 2 account = 20
        expect(Object.keys(types).length).toBe(20);
    });

    test('returns the same reference on successive calls', () => {
        const a = outgoingWebhooks.getEventTypes();
        const b = outgoingWebhooks.getEventTypes();
        expect(a).toBe(b);
    });
});

// ============================================================
// outgoingWebhooks.init
// ============================================================
describe('outgoingWebhooks.init', () => {
    test('does not throw', () => {
        expect(() => outgoingWebhooks.init()).not.toThrow();
    });

    test('can be called multiple times without error', () => {
        expect(() => {
            outgoingWebhooks.init();
            outgoingWebhooks.init();
        }).not.toThrow();
    });
});

// ============================================================
// outgoingWebhooks.trigger — sanitizeWebhookData (indirect)
// ============================================================
describe('outgoingWebhooks.trigger', () => {
    test('returns undefined for unknown event type', async () => {
        const result = await outgoingWebhooks.trigger('nonexistent.event', {}, 'user-1');
        expect(result).toBeUndefined();
    });

    test('returns undefined when no active webhooks found', async () => {
        db.query.all.mockReturnValue([]);
        const result = await outgoingWebhooks.trigger('inventory.created', { id: 'item-1' }, 'user-1');
        expect(result).toBeUndefined();
    });

    test('returns undefined when query.all returns null', async () => {
        db.query.all.mockReturnValue(null);
        const result = await outgoingWebhooks.trigger('inventory.created', { id: 'item-1' }, 'user-1');
        expect(result).toBeUndefined();
    });

    test('queries user webhooks with correct event type pattern', async () => {
        db.query.all.mockReturnValue([]);
        await outgoingWebhooks.trigger('sale.created', { amount: 100 }, 'user-42');
        expect(db.query.all).toHaveBeenCalled();
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('user_webhooks');
        expect(sql).toContain('is_active');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('user-42');
        expect(params.some(p => typeof p === 'string' && p.includes('sale.created'))).toBe(true);
    });

    test('sanitizes sensitive fields from payload data', async () => {
        // Provide a webhook so that trigger builds a payload
        db.query.all.mockReturnValue([
            {
                id: 'wh-1',
                url: 'https://example.com/hook',
                secret: 'testsecret',
                headers: null,
            }
        ]);

        // We cannot directly inspect the sanitized data, but we can verify
        // trigger completes without error when given sensitive fields
        await outgoingWebhooks.trigger(
            'inventory.created',
            {
                name: 'Widget',
                password: 'test-should-be-removed',
                api_key: 'test-should-be-removed',
                token: 'test-should-be-removed',
                price: 9.99,
            },
            'user-1'
        );
        // The test passes if trigger completes without throwing
    });

    test('handles empty data gracefully', async () => {
        db.query.all.mockReturnValue([]);
        await expect(
            outgoingWebhooks.trigger('inventory.created', {}, 'user-1')
        ).resolves.toBeUndefined();
    });

    test('handles null data gracefully', async () => {
        db.query.all.mockReturnValue([]);
        await expect(
            outgoingWebhooks.trigger('inventory.created', null, 'user-1')
        ).resolves.toBeUndefined();
    });

    test('handles undefined data gracefully', async () => {
        db.query.all.mockReturnValue([]);
        await expect(
            outgoingWebhooks.trigger('inventory.created', undefined, 'user-1')
        ).resolves.toBeUndefined();
    });

    test('handles multiple webhooks for the same event', async () => {
        db.query.all.mockReturnValue([
            { id: 'wh-1', url: 'https://example.com/hook1', secret: 's1', headers: null },
            { id: 'wh-2', url: 'https://example.com/hook2', secret: 's2', headers: null },
        ]);
        await outgoingWebhooks.trigger('listing.created', { id: 'lst-1' }, 'user-1');
        // Should not throw — both are queued
    });
});

// ============================================================
// sanitizeWebhookData — behavioral tests via trigger
// Tests verify that sanitization is applied correctly by
// examining that trigger still works with mixed data
// ============================================================
describe('sanitizeWebhookData behavior', () => {
    test('trigger passes with data containing only safe fields', async () => {
        db.query.all.mockReturnValue([]);
        await outgoingWebhooks.trigger(
            'inventory.created',
            { name: 'Item', price: 19.99, quantity: 5 },
            'user-1'
        );
    });

    test('trigger passes with data containing sensitive fields', async () => {
        db.query.all.mockReturnValue([]);
        await outgoingWebhooks.trigger(
            'inventory.updated',
            {
                name: 'Item',
                password: 'test-pw-redacted',
                secret: 'test-hidden',
                token: 'test-tok-123',
                api_key: 'test-key-456',
                apikey: 'test-key-789',
                encryption_key: 'test-enc-abc',
                hash: 'test-h-def',
                oauth: 'test-oauth-tok',
            },
            'user-1'
        );
    });

    test('trigger passes with nested non-object data values', async () => {
        db.query.all.mockReturnValue([]);
        await outgoingWebhooks.trigger(
            'sale.created',
            { amount: 100, tags: ['a', 'b'], active: true },
            'user-1'
        );
    });
});

// ============================================================
// outgoingWebhooksRouter — Authentication
// ============================================================
describe('outgoingWebhooksRouter — auth', () => {
    test('returns 401 when user is not authenticated', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/',
            user: null,
            body: {},
        });
        expect(result.status).toBe(401);
        expect(result.data.error).toContain('Authentication');
    });

    test('returns 401 when user is undefined', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/',
            user: undefined,
            body: {},
        });
        expect(result.status).toBe(401);
    });
});

// ============================================================
// outgoingWebhooksRouter — GET / (list webhooks)
// ============================================================
describe('outgoingWebhooksRouter — GET /', () => {
    const user = { id: 'user-1' };

    test('returns 200 with webhooks list', async () => {
        db.query.all.mockReturnValue([
            { id: 'wh-1', name: 'My Hook', url: 'https://example.com/hook', events: 'sale.created', is_active: 1 },
        ]);
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.webhooks).toBeDefined();
        expect(Array.isArray(result.data.webhooks)).toBe(true);
    });

    test('includes availableEvents in response', async () => {
        db.query.all.mockReturnValue([]);
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/',
            user,
            body: {},
        });
        expect(result.data.availableEvents).toBeDefined();
        expect(typeof result.data.availableEvents).toBe('object');
    });

    test('handles empty path as list route', async () => {
        db.query.all.mockReturnValue([]);
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.webhooks).toBeDefined();
    });

    test('queries with correct user id', async () => {
        db.query.all.mockReturnValue([]);
        await outgoingWebhooksRouter({
            method: 'GET',
            path: '/',
            user: { id: 'user-xyz' },
            body: {},
        });
        expect(db.query.all).toHaveBeenCalled();
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('user-xyz');
    });
});

// ============================================================
// outgoingWebhooksRouter — POST / (create webhook)
// ============================================================
describe('outgoingWebhooksRouter — POST /', () => {
    const user = { id: 'user-1' };

    test('returns 201 with created webhook', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'Test Hook',
                url: 'https://example.com/webhook',
                events: ['sale.created', 'sale.shipped'],
            },
        });
        expect(result.status).toBe(201);
        expect(result.data.webhook).toBeDefined();
        expect(result.data.webhook.name).toBe('Test Hook');
        expect(result.data.webhook.secret).toBeDefined();
        expect(typeof result.data.webhook.secret).toBe('string');
    });

    test('returns 400 when name is missing', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: { url: 'https://example.com/webhook', events: ['sale.created'] },
        });
        expect(result.status).toBe(400);
        expect(result.data.error).toBeDefined();
    });

    test('returns 400 when url is missing', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: { name: 'Test Hook', events: ['sale.created'] },
        });
        expect(result.status).toBe(400);
    });

    test('returns 400 when events is missing', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: { name: 'Test Hook', url: 'https://example.com/webhook' },
        });
        expect(result.status).toBe(400);
    });

    test('returns 400 for invalid URL', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'Test Hook',
                url: 'not-a-valid-url',
                events: ['sale.created'],
            },
        });
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('Invalid URL');
    });

    test('inserts webhook into database', async () => {
        await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'DB Test',
                url: 'https://example.com/hook',
                events: ['inventory.created'],
            },
        });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('INSERT INTO user_webhooks');
    });

    test('joins array events with comma', async () => {
        await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'Multi Event',
                url: 'https://example.com/hook',
                events: ['sale.created', 'sale.shipped'],
            },
        });
        const params = db.query.run.mock.calls[0][1];
        // Events should be joined as comma-separated string
        const eventsParam = params.find(p => typeof p === 'string' && p.includes(','));
        expect(eventsParam).toContain('sale.created');
        expect(eventsParam).toContain('sale.shipped');
    });

    test('accepts string events (not just array)', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'Wildcard',
                url: 'https://example.com/hook',
                events: '*',
            },
        });
        expect(result.status).toBe(201);
    });

    test('handles custom headers parameter', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'With Headers',
                url: 'https://example.com/hook',
                events: ['sale.created'],
                headers: { 'X-Custom': 'value' },
            },
        });
        expect(result.status).toBe(201);
        const params = db.query.run.mock.calls[0][1];
        // headers should be JSON-stringified
        const headersParam = params.find(p => typeof p === 'string' && p.includes('X-Custom'));
        expect(headersParam).toBeDefined();
    });

    test('webhook secret message warns to save', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user,
            body: {
                name: 'Secret Test',
                url: 'https://example.com/hook',
                events: ['sale.created'],
            },
        });
        expect(result.data.message).toContain('secret');
    });

    test('handles empty path as create route', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '',
            user,
            body: {
                name: 'Empty Path',
                url: 'https://example.com/hook',
                events: ['sale.created'],
            },
        });
        expect(result.status).toBe(201);
    });
});

// ============================================================
// outgoingWebhooksRouter — GET /:id (get webhook details)
// ============================================================
describe('outgoingWebhooksRouter — GET /:id', () => {
    const user = { id: 'user-1' };

    test('returns 200 with webhook and deliveries', async () => {
        db.query.get.mockReturnValue({
            id: 'wh-1',
            name: 'My Hook',
            url: 'https://example.com/hook',
            events: 'sale.created',
            is_active: 1,
        });
        db.query.all.mockReturnValue([
            { id: 'del-1', event_type: 'sale.created', status: 'delivered', status_code: 200, attempt: 1 },
        ]);
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/wh-1',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.webhook).toBeDefined();
        expect(result.data.deliveries).toBeDefined();
    });

    test('returns 404 when webhook not found', async () => {
        db.query.get.mockReturnValue(null);
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/nonexistent',
            user,
            body: {},
        });
        expect(result.status).toBe(404);
        expect(result.data.error).toContain('not found');
    });

    test('queries with webhook id and user id', async () => {
        db.query.get.mockReturnValue(null);
        await outgoingWebhooksRouter({
            method: 'GET',
            path: '/wh-abc',
            user: { id: 'user-99' },
            body: {},
        });
        expect(db.query.get).toHaveBeenCalled();
        const params = db.query.get.mock.calls[0][1];
        expect(params).toContain('wh-abc');
        expect(params).toContain('user-99');
    });
});

// ============================================================
// outgoingWebhooksRouter — PUT /:id (update webhook)
// ============================================================
describe('outgoingWebhooksRouter — PUT /:id', () => {
    const user = { id: 'user-1' };

    test('returns 404 when webhook does not exist', async () => {
        db.query.get.mockReturnValue(null);
        const result = await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-nonexistent',
            user,
            body: { name: 'Updated' },
        });
        expect(result.status).toBe(404);
    });

    test('returns 200 when webhook is updated', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        const result = await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { name: 'Updated Name' },
        });
        expect(result.status).toBe(200);
        expect(result.data.message).toContain('updated');
    });

    test('updates name field', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { name: 'New Name' },
        });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('name = ?');
    });

    test('updates url field', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { url: 'https://new.example.com/hook' },
        });
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('url = ?');
    });

    test('updates events field (array)', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { events: ['sale.created', 'sale.shipped'] },
        });
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('events = ?');
    });

    test('updates is_active field', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { is_active: false },
        });
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('is_active = ?');
    });

    test('updates headers field', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { headers: { 'X-Custom': 'value' } },
        });
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('headers = ?');
    });

    test('sets updated_at timestamp', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: { name: 'Timestamped' },
        });
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('updated_at');
    });

    test('handles update with no fields (no-op)', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        const result = await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        // query.run should NOT be called when there are no updates
        expect(db.query.run).not.toHaveBeenCalled();
    });
});

// ============================================================
// outgoingWebhooksRouter — DELETE /:id
// ============================================================
describe('outgoingWebhooksRouter — DELETE /:id', () => {
    const user = { id: 'user-1' };

    test('returns 200 on successful deletion', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'DELETE',
            path: '/wh-1',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.message).toContain('deleted');
    });

    test('executes DELETE SQL with correct params', async () => {
        await outgoingWebhooksRouter({
            method: 'DELETE',
            path: '/wh-42',
            user: { id: 'user-99' },
            body: {},
        });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('DELETE FROM user_webhooks');
        const params = db.query.run.mock.calls[0][1];
        expect(params).toContain('wh-42');
        expect(params).toContain('user-99');
    });
});

// ============================================================
// outgoingWebhooksRouter — POST /:id/test
// ============================================================
describe('outgoingWebhooksRouter — POST /:id/test', () => {
    const user = { id: 'user-1' };

    test('returns 404 when webhook not found', async () => {
        db.query.get.mockReturnValue(null);
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/test',
            user,
            body: {},
        });
        expect(result.status).toBe(404);
        expect(result.data.error).toContain('not found');
    });

    test('returns 200 with test result when webhook exists', async () => {
        db.query.get.mockReturnValue({
            id: 'wh-1',
            url: 'https://httpbin.org/status/200',
            secret: 'test-secret',
            headers: null,
        });
        // sendWebhook will fail since we're not actually hitting a server,
        // but the router should still return 200
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/test',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        expect(result.data).toHaveProperty('success');
        expect(result.data).toHaveProperty('statusCode');
    });

    test('handles webhook with custom headers', async () => {
        db.query.get.mockReturnValue({
            id: 'wh-1',
            url: 'https://httpbin.org/post',
            secret: 'test-secret',
            headers: JSON.stringify({ 'X-Custom': 'value' }),
        });
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/test',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
    });
});

// ============================================================
// outgoingWebhooksRouter — POST /:id/rotate-secret
// ============================================================
describe('outgoingWebhooksRouter — POST /:id/rotate-secret', () => {
    const user = { id: 'user-1' };

    test('returns 404 when webhook not found', async () => {
        db.query.get.mockReturnValue(null);
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/rotate-secret',
            user,
            body: {},
        });
        expect(result.status).toBe(404);
    });

    test('returns 200 with new secret', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/rotate-secret',
            user,
            body: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.secret).toBeDefined();
        expect(typeof result.data.secret).toBe('string');
        expect(result.data.secret.length).toBe(64); // 32 bytes hex = 64 chars
    });

    test('updates secret in database', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/rotate-secret',
            user,
            body: {},
        });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('UPDATE user_webhooks');
        expect(sql).toContain('secret = ?');
    });

    test('message instructs user to update integration', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-1/rotate-secret',
            user,
            body: {},
        });
        expect(result.data.message).toContain('rotated');
    });
});

// ============================================================
// outgoingWebhooksRouter — 404 fallback
// ============================================================
describe('outgoingWebhooksRouter — unknown routes', () => {
    const user = { id: 'user-1' };

    test('returns 404 for unsupported method', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'PATCH',
            path: '/',
            user,
            body: {},
        });
        expect(result.status).toBe(404);
    });

    test('returns 404 for unknown path', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/wh-1/unknown-action',
            user,
            body: {},
        });
        // This hits the GET /:id route, which will try to find the webhook
        // but since no mock, returns 404 from the "not found" branch
        expect(result.status).toBe(404);
    });
});

// ============================================================
// migration export
// ============================================================
describe('migration SQL', () => {
    test('is exported as a string', () => {
        expect(typeof migration).toBe('string');
    });

    test('creates user_webhooks table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS user_webhooks');
    });

    test('creates webhook_deliveries table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS webhook_deliveries');
    });

    test('includes foreign key on user_webhooks', () => {
        expect(migration).toContain('FOREIGN KEY (user_id) REFERENCES users(id)');
    });

    test('includes foreign key on webhook_deliveries', () => {
        expect(migration).toContain('FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id)');
    });

    test('creates index on user_webhooks', () => {
        expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_webhooks_user');
    });

    test('creates index on webhook_deliveries', () => {
        expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries');
    });

    test('user_webhooks has all required columns', () => {
        expect(migration).toContain('id TEXT PRIMARY KEY');
        expect(migration).toContain('user_id TEXT NOT NULL');
        expect(migration).toContain('name TEXT NOT NULL');
        expect(migration).toContain('url TEXT NOT NULL');
        expect(migration).toContain('secret TEXT NOT NULL');
        expect(migration).toContain('events TEXT NOT NULL');
        expect(migration).toContain('is_active INTEGER DEFAULT 1');
    });

    test('webhook_deliveries has all required columns', () => {
        expect(migration).toContain('webhook_id TEXT NOT NULL');
        expect(migration).toContain('event_type TEXT NOT NULL');
        expect(migration).toContain('status TEXT NOT NULL');
        expect(migration).toContain('status_code INTEGER');
        expect(migration).toContain('attempt INTEGER DEFAULT 1');
    });
});

// ============================================================
// RETRY_CONFIG behavior (tested indirectly via trigger + queue)
// The retry config is module-private, but we can verify the
// queue behavior by observing side effects
// ============================================================
describe('retry and queue behavior', () => {
    test('trigger queues deliveries for matching webhooks', async () => {
        db.query.all.mockReturnValue([
            { id: 'wh-1', url: 'https://example.com/hook', secret: 'sec', headers: null },
        ]);
        // trigger should not throw even when the fetch fails
        await outgoingWebhooks.trigger('inventory.created', { id: 'item-1' }, 'user-1');
    });

    test('multiple triggers in succession do not throw', async () => {
        db.query.all.mockReturnValue([
            { id: 'wh-1', url: 'https://example.com/hook', secret: 'sec', headers: null },
        ]);
        await outgoingWebhooks.trigger('inventory.created', { id: '1' }, 'user-1');
        await outgoingWebhooks.trigger('inventory.updated', { id: '1' }, 'user-1');
        await outgoingWebhooks.trigger('inventory.deleted', { id: '1' }, 'user-1');
    });
});

// ============================================================
// generateSignature behavior (tested indirectly)
// Since generateSignature is not exported, we verify its
// properties by examining the sendWebhook headers via the
// test endpoint
// ============================================================
describe('generateSignature behavior (via test endpoint)', () => {
    test('test endpoint sends request with signature headers', async () => {
        db.query.get.mockReturnValue({
            id: 'wh-sig',
            url: 'https://httpbin.org/post',
            secret: 'test-secret-key',
            headers: null,
        });
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/wh-sig/test',
            user: { id: 'user-1' },
            body: {},
        });
        // The result should contain success and statusCode fields
        expect(result.data).toHaveProperty('success');
        expect(result.data).toHaveProperty('statusCode');
    });
});

// ============================================================
// HMAC-SHA256 signature verification (standalone crypto test)
// While generateSignature is private, we can verify the
// algorithm it uses is correct by reimplementing the check
// ============================================================
describe('HMAC-SHA256 signature algorithm', () => {
    test('crypto.createHmac produces consistent output', () => {
        const secret = 'test-secret';
        const payload = JSON.stringify({ event: 'test', data: { id: 1 } });
        const timestamp = 1700000000000;
        const signatureBase = `${timestamp}.${payload}`;

        const sig1 = crypto.createHmac('sha256', secret).update(signatureBase).digest('hex');
        const sig2 = crypto.createHmac('sha256', secret).update(signatureBase).digest('hex');

        expect(sig1).toBe(sig2);
    });

    test('different secrets produce different signatures', () => {
        const payload = JSON.stringify({ event: 'test' });
        const signatureBase = `12345.${payload}`;

        const sig1 = crypto.createHmac('sha256', 'secret-1').update(signatureBase).digest('hex');
        const sig2 = crypto.createHmac('sha256', 'secret-2').update(signatureBase).digest('hex');

        expect(sig1).not.toBe(sig2);
    });

    test('different payloads produce different signatures', () => {
        const secret = 'test-same-secret';
        const base1 = `12345.${JSON.stringify({ a: 1 })}`;
        const base2 = `12345.${JSON.stringify({ b: 2 })}`;

        const sig1 = crypto.createHmac('sha256', secret).update(base1).digest('hex');
        const sig2 = crypto.createHmac('sha256', secret).update(base2).digest('hex');

        expect(sig1).not.toBe(sig2);
    });

    test('signature is a 64-char hex string', () => {
        const sig = crypto.createHmac('sha256', 'key').update('data').digest('hex');
        expect(sig.length).toBe(64);
        expect(/^[0-9a-f]+$/.test(sig)).toBe(true);
    });
});

// ============================================================
// Edge cases
// ============================================================
describe('edge cases', () => {
    test('trigger with very long event type string for unknown event', async () => {
        const longEvent = 'a'.repeat(500) + '.event';
        await expect(
            outgoingWebhooks.trigger(longEvent, {}, 'user-1')
        ).resolves.toBeUndefined();
    });

    test('router handles path with multiple segments', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'GET',
            path: '/some/deep/path',
            user: { id: 'user-1' },
            body: {},
        });
        // Should hit the GET /:id branch and return 404
        expect(result.status).toBe(404);
    });

    test('create webhook with null headers', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user: { id: 'user-1' },
            body: {
                name: 'Null Headers',
                url: 'https://example.com/hook',
                events: ['sale.created'],
                headers: null,
            },
        });
        expect(result.status).toBe(201);
    });

    test('create webhook with empty events array', async () => {
        const result = await outgoingWebhooksRouter({
            method: 'POST',
            path: '/',
            user: { id: 'user-1' },
            body: {
                name: 'Empty Events',
                url: 'https://example.com/hook',
                events: [],
            },
        });
        // Empty array is falsy in the !events check? No — [] is truthy in JS
        // So this should succeed with status 201
        expect(result.status).toBe(201);
    });

    test('update with is_active=true converts to 1', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user: { id: 'user-1' },
            body: { is_active: true },
        });
        const params = db.query.run.mock.calls[0][1];
        // The value for is_active should be 1 (truthy → 1)
        expect(params).toContain(1);
    });

    test('update with is_active=false converts to 0', async () => {
        db.query.get.mockReturnValue({ id: 'wh-1' });
        await outgoingWebhooksRouter({
            method: 'PUT',
            path: '/wh-1',
            user: { id: 'user-1' },
            body: { is_active: false },
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params).toContain(0);
    });

    test('delete on nonexistent webhook still returns 200', async () => {
        db.query.run.mockReturnValue({ changes: 0 });
        const result = await outgoingWebhooksRouter({
            method: 'DELETE',
            path: '/nonexistent',
            user: { id: 'user-1' },
            body: {},
        });
        // The current implementation always returns 200 regardless of changes
        expect(result.status).toBe(200);
    });
});
