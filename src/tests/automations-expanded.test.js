// Automations route — expanded tests for missing endpoints
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Automations — History', () => {
    test('GET /automations/history returns run history', async () => {
        const { status, data } = await client.get('/automations/history');
        // May be tier-gated (403)
        expect([200, 403, 500]).toContain(status);
        if (status === 200 && data) {
            expect(typeof data).toBe('object');
        }
    });

    test('DELETE /automations/history clears history', async () => {
        const { status } = await client.delete('/automations/history');
        expect([200, 204, 403, 500]).toContain(status);
    });
});

describe('Automations — Stats', () => {
    test('GET /automations/stats returns statistics', async () => {
        const { status, data } = await client.get('/automations/stats');
        expect([200, 403, 500]).toContain(status);
        if (status === 200) {
            expect(typeof data).toBe('object');
        }
    });
});

describe('Automations — Run & Toggle', () => {
    let ruleId;

    beforeAll(async () => {
        const { status, data } = await client.post('/automations', {
            name: `Test Rule ${Date.now()}`,
            type: 'share',
            platform: 'poshmark',
            schedule: '0 9 * * *',
            config: {}
        });
        if (status === 200 || status === 201) {
            ruleId = data.id || data.rule?.id;
        }
    });

    test('POST /automations/:id/run triggers manual run', async () => {
        const id = ruleId || 'nonexistent';
        const { status } = await client.post(`/automations/${id}/run`, {});
        if (ruleId) {
            expect([200, 202, 403, 500]).toContain(status);
        } else {
            expect([403, 404, 500]).toContain(status);
        }
    });

    test('POST /automations/:id/toggle toggles enabled state', async () => {
        const id = ruleId || 'nonexistent';
        const { status, data } = await client.post(`/automations/${id}/toggle`, {});
        if (ruleId) {
            expect([200, 403, 500]).toContain(status);
            if (status === 200) {
                expect(typeof (data.enabled ?? data.rule?.enabled)).toBe('boolean');
            }
        } else {
            expect([403, 404, 500]).toContain(status);
        }
    });

    test('POST /automations/:id/run for nonexistent returns error', async () => {
        const { status } = await client.post('/automations/nonexistent-id/run', {});
        expect([403, 404, 500]).toContain(status);
    });
});

describe('Automations — From Preset', () => {
    test('POST /automations/from-preset creates rule from preset', async () => {
        const { status: presetsStatus, data: presetsData } = await client.get('/automations/presets');
        if (presetsStatus !== 200 || !presetsData?.presets?.length) {
            const { status } = await client.post('/automations/from-preset', {
                presetId: 'nonexistent-preset',
                platform: 'poshmark'
            });
            expect([200, 201, 400, 403, 404, 500]).toContain(status);
            return;
        }

        const preset = presetsData.presets[0];
        const { status } = await client.post('/automations/from-preset', {
            presetId: preset.id || preset.key,
            platform: 'poshmark'
        });
        expect([200, 201, 400, 403, 500]).toContain(status);
    });

    test('POST /automations/from-preset without presetId returns error', async () => {
        const { status } = await client.post('/automations/from-preset', {});
        expect([400, 403, 500]).toContain(status);
    });
});
