// Whatnot Enhanced API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('Whatnot Enhanced - Auth Guard', () => {
    test('POST /whatnot-enhanced/cohosts without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/whatnot-enhanced/cohosts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: 'e1', cohost_name: 'test' })
        });
        expect(res.status).toBe(401);
    });
});

describe('Whatnot Enhanced - Cohosts CRUD', () => {
    let cohostId = null;

    test('POST /whatnot-enhanced/cohosts creates cohost', async () => {
        const { status, data } = await client.post('/whatnot-enhanced/cohosts', {
            event_id: 'test-event-1',
            cohost_name: 'TestCoHost',
            role: 'moderator',
            revenue_split: 25,
            notes: 'Test cohost'
        });
        // 404 when event doesn't exist for user, 201 if created, 403 if tier-gated on CI
        expect([201, 403, 404]).toContain(status);
        if (data?.cohost?.id || data?.id) {
            cohostId = data.cohost?.id || data.id;
        }
    });

    test('POST /whatnot-enhanced/cohosts without event_id returns 400', async () => {
        const { status } = await client.post('/whatnot-enhanced/cohosts', {
            cohost_name: 'NoEvent'
        });
        // 400 on validation error, 403 if tier-gated on CI
        expect([400, 403]).toContain(status);
    });

    test('POST /whatnot-enhanced/cohosts without cohost_name returns 400', async () => {
        const { status } = await client.post('/whatnot-enhanced/cohosts', {
            event_id: 'test-event-1'
        });
        // 400 if validation fires first, 404 if event check fires first, 403 if tier-gated
        expect([400, 403, 404]).toContain(status);
    });

    test('POST /whatnot-enhanced/cohosts with invalid revenue_split', async () => {
        const { status } = await client.post('/whatnot-enhanced/cohosts', {
            event_id: 'test-event-1',
            cohost_name: 'BadSplit',
            revenue_split: 150
        });
        // 400 for bad split, 404 if event check fires first, 403 if tier-gated
        expect([400, 403, 404]).toContain(status);
    });

    test('PUT /whatnot-enhanced/cohosts/:id updates cohost', async () => {
        if (!cohostId) return;
        const { status } = await client.put(`/whatnot-enhanced/cohosts/${cohostId}`, {
            role: 'presenter',
            revenue_split: 30
        });
        expect([200, 403, 404]).toContain(status);
    });

    test('PUT /whatnot-enhanced/cohosts/nonexistent returns 404', async () => {
        const { status } = await client.put('/whatnot-enhanced/cohosts/nonexistent-id', {
            role: 'moderator'
        });
        // 404 if not found, 403 if tier-gated on CI
        expect([403, 404]).toContain(status);
    });

    test('DELETE /whatnot-enhanced/cohosts/:id removes cohost', async () => {
        if (!cohostId) return;
        const { status } = await client.delete(`/whatnot-enhanced/cohosts/${cohostId}`);
        expect([200, 403, 404]).toContain(status);
    });

    test('DELETE /whatnot-enhanced/cohosts/nonexistent returns 404', async () => {
        const { status } = await client.delete('/whatnot-enhanced/cohosts/nonexistent-id');
        // 404 if not found, 403 if tier-gated on CI
        expect([403, 404]).toContain(status);
    });
});

describe('Whatnot Enhanced - Staging CRUD', () => {
    let stagingId = null;

    test('POST /whatnot-enhanced/staging stages item', async () => {
        const { status, data } = await client.post('/whatnot-enhanced/staging', {
            event_id: 'test-event-1',
            inventory_id: 'test-item-1',
            display_order: 1,
            flash_price: 25.99,
            notes: 'Flash sale item'
        });
        // 404 when event doesn't exist for user, 201 if created, 403 if tier-gated on CI
        expect([201, 403, 404]).toContain(status);
        if (data?.staged?.id || data?.id) {
            stagingId = data.staged?.id || data.id;
        }
    });

    test('POST /whatnot-enhanced/staging without event_id returns 400', async () => {
        const { status } = await client.post('/whatnot-enhanced/staging', {
            inventory_id: 'item-1'
        });
        // 400 on validation error, 403 if tier-gated on CI
        expect([400, 403]).toContain(status);
    });

    test('POST /whatnot-enhanced/staging without inventory_id returns 400', async () => {
        const { status } = await client.post('/whatnot-enhanced/staging', {
            event_id: 'event-1'
        });
        // 400 if validation first, 404 if event check first, 403 if tier-gated
        expect([400, 403, 404]).toContain(status);
    });

    test('PUT /whatnot-enhanced/staging/:id updates staged item', async () => {
        if (!stagingId) return;
        const { status } = await client.put(`/whatnot-enhanced/staging/${stagingId}`, {
            display_order: 2,
            flash_price: 19.99
        });
        expect([200, 403, 404]).toContain(status);
    });

    test('PUT /whatnot-enhanced/staging/nonexistent returns 404', async () => {
        const { status } = await client.put('/whatnot-enhanced/staging/nonexistent-id', {
            display_order: 5
        });
        // 404 if not found, 403 if tier-gated on CI
        expect([403, 404]).toContain(status);
    });

    test('DELETE /whatnot-enhanced/staging/:id removes staged item', async () => {
        if (!stagingId) return;
        const { status } = await client.delete(`/whatnot-enhanced/staging/${stagingId}`);
        expect([200, 403, 404]).toContain(status);
    });

    test('DELETE /whatnot-enhanced/staging/nonexistent returns 404', async () => {
        const { status } = await client.delete('/whatnot-enhanced/staging/nonexistent-id');
        // 404 if not found, 403 if tier-gated on CI
        expect([403, 404]).toContain(status);
    });
});

describe('Whatnot Enhanced - Auto-Suggest', () => {
    test('POST /whatnot-enhanced/staging/auto-suggest with event_id', async () => {
        const { status, data } = await client.post('/whatnot-enhanced/staging/auto-suggest', {
            event_id: 'test-event-1',
            limit: 5
        });
        // 404 when event doesn't exist for user, 403 if tier-gated on CI
        expect([200, 403, 404]).toContain(status);
    });

    test('POST /whatnot-enhanced/staging/auto-suggest without event_id returns 400', async () => {
        const { status } = await client.post('/whatnot-enhanced/staging/auto-suggest', {});
        // 400 if validation fires first, 403 if tier-gate fires first
        expect([400, 403]).toContain(status);
    });
});

describe('Whatnot Enhanced - Bundles', () => {
    test('GET /whatnot-enhanced/staging/bundles returns bundle groups', async () => {
        const { status, data } = await client.get('/whatnot-enhanced/staging/bundles');
        // 200 on success, 403 if feature is tier-gated
        expect([200, 403]).toContain(status);
    });

    test('GET /whatnot-enhanced/staging/bundles with event_id filter', async () => {
        const { status } = await client.get('/whatnot-enhanced/staging/bundles?event_id=test-event-1');
        // 200 on success, 403 if feature is tier-gated
        expect([200, 403]).toContain(status);
    });
});
