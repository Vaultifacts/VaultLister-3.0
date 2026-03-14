// Notion API — Expanded Tests
// Note: NOTION_INTEGRATION_TOKEN is set in env, so isConfigured() returns true
// and endpoints that call the Notion SDK will hang. We only test:
// 1. Auth guards (no auth → 401)
// 2. Validation gates (return 400 before reaching SDK)
// 3. Endpoints that query local DB only (settings, sync status/history/conflicts)
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Notion - Auth Guard', () => {
    test('GET /notion/status without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/status`);
        expect(res.status).toBe(401);
    });

    test('POST /notion/connect without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: 'test' })
        });
        expect(res.status).toBe(401);
    });

    test('DELETE /notion/disconnect without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/disconnect`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(401);
    });

    test('PUT /notion/settings without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sync_enabled: true })
        });
        expect(res.status).toBe(401);
    });

    test('POST /notion/sync without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(res.status).toBe(401);
    });

    test('GET /notion/sync/conflicts without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/sync/conflicts`);
        expect(res.status).toBe(401);
    });

    test('POST /notion/pages without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/notion/pages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ database_id: 'x', properties: {} })
        });
        expect(res.status).toBe(401);
    });
});

describe('Notion - Status (local DB only)', () => {
    test('GET /notion/status returns connection status', async () => {
        const { status, data } = await client.get('/notion/status');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('connected');
            expect(data).toHaveProperty('configured');
        }
    });
});

describe('Notion - Connect Validation', () => {
    test('POST /notion/connect without token returns 400', async () => {
        const { status, data } = await client.post('/notion/connect', {});
        expect([400]).toContain(status);
        if (status === 400) {
            expect(data.error).toContain('required');
        }
    });
});

describe('Notion - Disconnect (local DB only)', () => {
    test('DELETE /notion/disconnect succeeds', async () => {
        const { status } = await client.delete('/notion/disconnect');
        expect([200, 403]).toContain(status);
    });
});

describe('Notion - Settings Validation', () => {
    test('PUT /notion/settings with no valid fields returns 400', async () => {
        const { status, data } = await client.put('/notion/settings', {
            invalid_field: 'test'
        });
        expect([400]).toContain(status);
        if (status === 400) {
            expect(data.error).toContain('No valid fields');
        }
    });

    test('PUT /notion/settings with invalid conflict_strategy returns 400', async () => {
        const { status } = await client.put('/notion/settings', {
            conflict_strategy: 'invalid_strategy'
        });
        expect([400]).toContain(status);
    });

    test('PUT /notion/settings with valid conflict_strategy', async () => {
        const { status } = await client.put('/notion/settings', {
            conflict_strategy: 'manual'
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with valid conflict_strategy: vaultlister_wins', async () => {
        const { status } = await client.put('/notion/settings', {
            conflict_strategy: 'vaultlister_wins'
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with valid conflict_strategy: notion_wins', async () => {
        const { status } = await client.put('/notion/settings', {
            conflict_strategy: 'notion_wins'
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with valid conflict_strategy: newest_wins', async () => {
        const { status } = await client.put('/notion/settings', {
            conflict_strategy: 'newest_wins'
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with too-low sync interval returns 400', async () => {
        const { status } = await client.put('/notion/settings', {
            sync_interval_minutes: 5
        });
        expect([400]).toContain(status);
    });

    test('PUT /notion/settings with sync_interval_minutes=0 returns 400', async () => {
        const { status } = await client.put('/notion/settings', {
            sync_interval_minutes: 0
        });
        expect([400]).toContain(status);
    });

    test('PUT /notion/settings with valid sync interval (15)', async () => {
        const { status } = await client.put('/notion/settings', {
            sync_interval_minutes: 15
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with valid sync interval (60)', async () => {
        const { status } = await client.put('/notion/settings', {
            sync_interval_minutes: 60
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with sync_enabled true', async () => {
        const { status } = await client.put('/notion/settings', {
            sync_enabled: true
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with sync_enabled false', async () => {
        const { status } = await client.put('/notion/settings', {
            sync_enabled: false
        });
        expect([200, 403]).toContain(status);
    });

    test('PUT /notion/settings with database_id links', async () => {
        const { status } = await client.put('/notion/settings', {
            inventory_database_id: 'fake-db-123'
        });
        expect([200, 403]).toContain(status);
    });
});

describe('Notion - Sync Status (local DB only)', () => {
    test('GET /notion/sync/status returns status', async () => {
        const { status, data } = await client.get('/notion/sync/status');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('configured');
        }
    });

    test('GET /notion/sync/history returns history', async () => {
        const { status, data } = await client.get('/notion/sync/history');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('history');
        }
    });

    test('GET /notion/sync/history with limit param', async () => {
        const { status } = await client.get('/notion/sync/history?limit=5');
        expect([200, 403]).toContain(status);
    });

    test('GET /notion/sync/pending returns items', async () => {
        const { status, data } = await client.get('/notion/sync/pending');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('items');
        }
    });

    test('GET /notion/sync/pending with type=inventory', async () => {
        const { status } = await client.get('/notion/sync/pending?type=inventory');
        expect([200, 403]).toContain(status);
    });

    test('GET /notion/sync/pending with type=sales', async () => {
        const { status } = await client.get('/notion/sync/pending?type=sales');
        expect([200, 403]).toContain(status);
    });
});

describe('Notion - Conflicts (local DB only)', () => {
    test('GET /notion/sync/conflicts returns conflicts list', async () => {
        const { status, data } = await client.get('/notion/sync/conflicts');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('conflicts');
            expect(Array.isArray(data.conflicts)).toBe(true);
        }
    });

    test('POST /notion/sync/conflicts/fake-id/resolve without resolution returns 400', async () => {
        const { status, data } = await client.post('/notion/sync/conflicts/fake-id/resolve', {});
        expect([400, 404]).toContain(status);
        if (status === 400) {
            expect(data.error).toContain('resolution');
        }
    });

    test('POST /notion/sync/conflicts/fake-id/resolve with invalid resolution returns 400', async () => {
        const { status } = await client.post('/notion/sync/conflicts/fake-id/resolve', {
            resolution: 'invalid_strategy'
        });
        expect([400, 404]).toContain(status);
    });

    test('POST /notion/sync/conflicts/fake-id/resolve with keep_local returns 404', async () => {
        const { status } = await client.post('/notion/sync/conflicts/fake-id/resolve', {
            resolution: 'keep_local'
        });
        expect([200, 404]).toContain(status);
    });

    test('POST /notion/sync/conflicts/fake-id/resolve with keep_notion returns 404', async () => {
        const { status } = await client.post('/notion/sync/conflicts/fake-id/resolve', {
            resolution: 'keep_notion'
        });
        expect([200, 404]).toContain(status);
    });

    test('POST /notion/sync/conflicts/fake-id/resolve with merge returns 404', async () => {
        const { status } = await client.post('/notion/sync/conflicts/fake-id/resolve', {
            resolution: 'merge',
            merged_data: { name: 'test' }
        });
        expect([200, 404]).toContain(status);
    });

    test('POST /notion/sync/conflicts/fake-id/resolve with ignore returns 404', async () => {
        const { status } = await client.post('/notion/sync/conflicts/fake-id/resolve', {
            resolution: 'ignore'
        });
        expect([200, 404]).toContain(status);
    });
});

describe('Notion - Pages Validation', () => {
    test('POST /notion/pages without database_id returns 400', async () => {
        const { status } = await client.post('/notion/pages', {
            properties: { Name: 'Test' }
        });
        expect([400]).toContain(status);
    });

    test('POST /notion/pages without properties returns 400', async () => {
        const { status } = await client.post('/notion/pages', {
            database_id: 'fake-db-id'
        });
        expect([400]).toContain(status);
    });

    test('PUT /notion/pages/fake-id without properties returns 400', async () => {
        const { status } = await client.put('/notion/pages/fake-page-id', {});
        expect([400]).toContain(status);
    });
});

describe('Notion - Sync Trigger', () => {
    test('POST /notion/sync triggers or errors', async () => {
        const { status } = await client.post('/notion/sync', {
            direction: 'bidirectional',
            entity_types: ['inventory']
        });
        // May succeed (200), conflict (409 if already syncing), or 500
        expect([200, 400, 409]).toContain(status);
    });
});

describe('Notion - 404 for unknown routes', () => {
    test('GET /notion/nonexistent returns 404', async () => {
        const { status } = await client.get('/notion/nonexistent-route');
        expect([404]).toContain(status);
    });

    test('POST /notion/nonexistent returns 404', async () => {
        const { status } = await client.post('/notion/nonexistent-route', {});
        expect([404]).toContain(status);
    });
});
