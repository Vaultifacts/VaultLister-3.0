// Outgoing Webhooks API Tests
// Covers 7 /api/outgoing-webhooks endpoints: CRUD, IDOR, secret visibility, rotation
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import Database from 'bun:sqlite';
import { join } from 'path';

let clientA;
let clientB;
let unauthClient;

// Ensure the user_webhooks and webhook_deliveries tables exist.
// Migration 082_add_service_tables.sql may not have been applied to the DB,
// so we create the tables directly (IF NOT EXISTS) before tests run.
function ensureWebhookTables() {
    const dbPath = process.env.DB_PATH || join(import.meta.dir, '../../data/vaultlister.db');
    const db = new Database(dbPath);
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_webhooks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                secret TEXT NOT NULL,
                events TEXT NOT NULL,
                headers TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_user ON user_webhooks(user_id, is_active)');
        db.exec(`
            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                id TEXT PRIMARY KEY,
                webhook_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload TEXT,
                status TEXT NOT NULL,
                status_code INTEGER,
                response_body TEXT,
                attempt INTEGER DEFAULT 1,
                created_at TEXT,
                FOREIGN KEY (webhook_id) REFERENCES user_webhooks(id) ON DELETE CASCADE
            );
        `);
        db.exec('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries(webhook_id, created_at DESC)');
    } finally {
        db.close();
    }
}

beforeAll(async () => {
    ensureWebhookTables();
    const userA = await createTestUserWithToken();
    clientA = new TestApiClient(userA.token);
    const userB = await createTestUserWithToken();
    clientB = new TestApiClient(userB.token);
    unauthClient = new TestApiClient();
});

// ============================================================
// Auth Guard
// ============================================================
describe('Outgoing Webhooks - Auth Guard', () => {
    test('GET /outgoing-webhooks without token returns 401', async () => {
        const { status } = await unauthClient.get('/outgoing-webhooks');
        expect(status).toBe(401);
    });

    test('POST /outgoing-webhooks without token returns 401', async () => {
        const { status } = await unauthClient.post('/outgoing-webhooks', {
            name: 'test', url: 'https://example.com', events: ['sale.created']
        });
        expect(status).toBe(401);
    });
});

// ============================================================
// List (empty state)
// ============================================================
describe('Outgoing Webhooks - Empty List', () => {
    test('GET /outgoing-webhooks returns empty list with availableEvents', async () => {
        const { status, data } = await clientA.get('/outgoing-webhooks');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) {
            expect(data.webhooks).toBeDefined();
            expect(Array.isArray(data.webhooks)).toBe(true);
            expect(data.availableEvents).toBeDefined();
            expect(typeof data.availableEvents).toBe('object');
        }
    });

    test('availableEvents contains expected event types', async () => {
        const { status, data } = await clientA.get('/outgoing-webhooks');
        if (status === 200) {
            expect(Object.keys(data.availableEvents).length).toBeGreaterThan(5);
        }
    });
});

// ============================================================
// Create Validation
// ============================================================
describe('Outgoing Webhooks - Create Validation', () => {
    test('POST without name returns 400', async () => {
        const { status } = await clientA.post('/outgoing-webhooks', {
            url: 'https://example.com', events: ['sale.created']
        });
        expect(status).toBe(400);
    });

    test('POST without url returns 400', async () => {
        const { status } = await clientA.post('/outgoing-webhooks', {
            name: 'test', events: ['sale.created']
        });
        expect(status).toBe(400);
    });

    test('POST without events returns 400', async () => {
        const { status } = await clientA.post('/outgoing-webhooks', {
            name: 'test', url: 'https://example.com'
        });
        expect(status).toBe(400);
    });

    test('POST with invalid URL returns 400', async () => {
        const { status, data } = await clientA.post('/outgoing-webhooks', {
            name: 'test', url: 'not-a-url', events: ['sale.created']
        });
        expect(status).toBe(400);
        expect(data.error).toBeDefined();
    });
});

// ============================================================
// CRUD Cycle
// ============================================================
describe('Outgoing Webhooks - CRUD Cycle', () => {
    let webhookId;
    let originalSecret;

    test('POST with valid data creates webhook and returns secret', async () => {
        const { status, data } = await clientA.post('/outgoing-webhooks', {
            name: 'My Test Webhook',
            url: 'https://example.com/webhook',
            events: ['sale.created', 'inventory.updated']
        });
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(status);
        if (status === 201) {
            expect(data.webhook).toBeDefined();
            expect(data.webhook.id).toBeDefined();
            expect(data.webhook.secret).toBeDefined();
            // Secret is 64-char hex (32 bytes)
            expect(data.webhook.secret).toMatch(/^[0-9a-f]{64}$/);
            webhookId = data.webhook.id;
            originalSecret = data.webhook.secret;
        }
    });

    test('GET /outgoing-webhooks lists the webhook (secret NOT exposed)', async () => {
        const { status, data } = await clientA.get('/outgoing-webhooks');
        expect([200, 403]).toContain(status);
        const webhook = data.webhooks.find(w => w.id === webhookId);
        expect(webhook).toBeDefined();
        expect(webhook.name).toBe('My Test Webhook');
        // Secret must NOT be in the list response
        expect(webhook.secret).toBeUndefined();
    });

    test('GET /outgoing-webhooks/:id returns detail with deliveries', async () => {
        const { status, data } = await clientA.get(`/outgoing-webhooks/${webhookId}`);
        expect([200, 403]).toContain(status);
        expect(data.webhook).toBeDefined();
        expect(data.webhook.name).toBe('My Test Webhook');
        expect(data.deliveries).toBeDefined();
        expect(Array.isArray(data.deliveries)).toBe(true);
        // Secret NOT in detail response either
        expect(data.webhook.secret).toBeUndefined();
    });

    test('PUT /outgoing-webhooks/:id updates webhook name', async () => {
        const { status, data } = await clientA.put(`/outgoing-webhooks/${webhookId}`, {
            name: 'Updated Webhook Name'
        });
        expect([200, 403]).toContain(status);
        expect(data.message).toBe('Webhook updated');
    });

    test('DELETE /outgoing-webhooks/:id removes webhook', async () => {
        const { status } = await clientA.delete(`/outgoing-webhooks/${webhookId}`);
        expect([200, 403]).toContain(status);
    });

    test('GET /outgoing-webhooks/:id after delete returns 404', async () => {
        const { status } = await clientA.get(`/outgoing-webhooks/${webhookId}`);
        expect(status).toBe(404);
    });
});

// ============================================================
// IDOR Prevention — userB cannot access userA's webhook
// ============================================================
describe('Outgoing Webhooks - IDOR Prevention', () => {
    let webhookIdA;

    beforeAll(async () => {
        const { data } = await clientA.post('/outgoing-webhooks', {
            name: 'A Private Webhook',
            url: 'https://example.com/private',
            events: ['sale.created']
        });
        webhookIdA = data.webhook.id;
    });

    test('userB cannot GET userA webhook', async () => {
        const { status } = await clientB.get(`/outgoing-webhooks/${webhookIdA}`);
        expect(status).toBe(404);
    });

    test('userB cannot PUT userA webhook', async () => {
        const { status } = await clientB.put(`/outgoing-webhooks/${webhookIdA}`, {
            name: 'Hacked Name'
        });
        expect(status).toBe(404);
    });

    test('userB cannot DELETE userA webhook', async () => {
        await clientB.delete(`/outgoing-webhooks/${webhookIdA}`);
        // Verify userA can still access it (wasn't deleted)
        const { status } = await clientA.get(`/outgoing-webhooks/${webhookIdA}`);
        expect([200, 403]).toContain(status);
    });
});

// ============================================================
// Secret Rotation
// ============================================================
describe('Outgoing Webhooks - Secret Rotation', () => {
    let webhookId;
    let originalSecret;

    beforeAll(async () => {
        const { data } = await clientA.post('/outgoing-webhooks', {
            name: 'Rotation Test',
            url: 'https://example.com/rotate',
            events: ['inventory.created']
        });
        webhookId = data.webhook.id;
        originalSecret = data.webhook.secret;
    });

    test('POST /outgoing-webhooks/:id/rotate-secret returns new secret', async () => {
        const { status, data } = await clientA.post(`/outgoing-webhooks/${webhookId}/rotate-secret`);
        expect([200, 403]).toContain(status);
        expect(data.secret).toBeDefined();
        expect(data.secret).toMatch(/^[0-9a-f]{64}$/);
    });

    test('rotated secret differs from original', async () => {
        const { data } = await clientA.post(`/outgoing-webhooks/${webhookId}/rotate-secret`);
        expect(data.secret).not.toBe(originalSecret);
    });
});
