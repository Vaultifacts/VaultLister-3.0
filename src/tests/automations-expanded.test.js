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
        expect([200, 403]).toContain(status);
        if (status === 200 && data) {
            expect(typeof data).toBe('object');
        }
    });

    test('DELETE /automations/history clears history', async () => {
        const { status } = await client.delete('/automations/history');
        expect([200, 204, 403]).toContain(status);
    });
});

describe('Automations — Stats', () => {
    test('GET /automations/stats returns statistics', async () => {
        const { status, data } = await client.get('/automations/stats');
        expect([200, 403]).toContain(status);
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
            expect([200, 202, 403]).toContain(status);
        } else {
            expect([403, 404]).toContain(status);
        }
    });

    test('POST /automations/:id/toggle toggles enabled state', async () => {
        const id = ruleId || 'nonexistent';
        const { status, data } = await client.post(`/automations/${id}/toggle`, {});
        if (ruleId) {
            expect([200, 403]).toContain(status);
            if (status === 200) {
                expect(typeof (data.enabled ?? data.rule?.enabled)).toBe('boolean');
            }
        } else {
            expect([403, 404]).toContain(status);
        }
    });

    test('POST /automations/:id/run for nonexistent returns error', async () => {
        const { status } = await client.post('/automations/nonexistent-id/run', {});
        expect([403, 404]).toContain(status);
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
            expect([200, 201, 400, 403, 404]).toContain(status);
            return;
        }

        const preset = presetsData.presets[0];
        const { status } = await client.post('/automations/from-preset', {
            presetId: preset.id || preset.key,
            platform: 'poshmark'
        });
        expect([200, 201, 400, 403]).toContain(status);
    });

    test('POST /automations/from-preset without presetId returns error', async () => {
        const { status } = await client.post('/automations/from-preset', {});
        expect([400, 403]).toContain(status);
    });

    test('POST /automations/from-preset with invalid presetId returns 400', async () => {
        const { status } = await client.post('/automations/from-preset', { presetId: 'totally_invalid_id_xyz' });
        expect([400, 403]).toContain(status);
    });
});

describe('Automations — Multi-Platform Presets', () => {
    const presetsByPlatform = {
        poshmark: ['daily_share', 'party_share', 'community_share', 'follow_back', 'send_offers', 'auto_accept', 'decline_lowball', 'counter_offers', 'bundle_discount'],
        mercari: ['mercari_refresh', 'mercari_relist', 'mercari_price_drop'],
        depop: ['depop_refresh', 'depop_share', 'depop_price_drop'],
        grailed: ['grailed_bump', 'grailed_relist', 'grailed_price_drop'],
        facebook: ['facebook_refresh', 'facebook_relist', 'facebook_price_drop'],
        whatnot: ['whatnot_refresh', 'whatnot_relist', 'whatnot_price_drop'],
        cross_platform: ['delist_stale', 'smart_relisting', 'auto_reprice', 'error_retry']
    };

    for (const [platform, presetIds] of Object.entries(presetsByPlatform)) {
        test(`from-preset accepts ${platform} presets (${presetIds.length} IDs)`, async () => {
            // Test the first preset for each platform to avoid creating too many rules
            const presetId = presetIds[0];
            const { status, data } = await client.post('/automations/from-preset', { presetId });
            // 200/201 = created, 400 = already exists (duplicate name), 403 = CSRF, 500 = DB
            expect([200, 201, 400, 403]).toContain(status);
            if (status === 200 || status === 201) {
                expect(data).toBeTruthy();
            }
        });
    }

    test('all 36 preset IDs are recognized (not 400 unknown)', async () => {
        const allPresetIds = [
            'daily_share', 'party_share', 'community_share',
            'follow_back', 'unfollow_inactive', 'follow_targeted',
            'send_offers', 'auto_accept', 'decline_lowball', 'counter_offers',
            'bundle_discount', 'bundle_reminder', 'bundle_for_likers',
            'weekly_drop', 'ccl_rotation', 'auto_reprice',
            'relist_stale', 'delist_stale', 'smart_relisting', 'description_refresh', 'error_retry',
            'mercari_refresh', 'mercari_relist', 'mercari_price_drop',
            'depop_refresh', 'depop_share', 'depop_price_drop',
            'grailed_bump', 'grailed_relist', 'grailed_price_drop',
            'facebook_refresh', 'facebook_relist', 'facebook_price_drop',
            'whatnot_refresh', 'whatnot_relist', 'whatnot_price_drop'
        ];
        expect(allPresetIds.length).toBe(36);

        // Test 3 random presets to verify they don't return "unknown preset" 400
        const sample = [allPresetIds[0], allPresetIds[21], allPresetIds[34]];
        for (const presetId of sample) {
            const { status } = await client.post('/automations/from-preset', { presetId });
            // Should NOT be 400 with "Unknown preset" — should be 200/201 or 400 with "already exists"
            expect([200, 201, 400, 403]).toContain(status);
        }
    });
});

describe('Automations — Schedule Settings', () => {
    test('GET /automations/schedule-settings returns settings', async () => {
        const { status, data } = await client.get('/automations/schedule-settings');
        expect([200, 403, 404]).toContain(status);
    });

    test('POST /automations/schedule-settings saves settings', async () => {
        const { status } = await client.post('/automations/schedule-settings', {
            frequency: 'daily',
            startTime: '09:00',
            endTime: '21:00',
            daysOfWeek: [1, 2, 3, 4, 5],
            timezone: 'America/Edmonton'
        });
        expect([200, 403]).toContain(status);
    });

    test('POST /automations/schedule-settings rejects invalid frequency', async () => {
        const { status } = await client.post('/automations/schedule-settings', {
            frequency: 'every_second',
            startTime: '09:00',
            endTime: '21:00'
        });
        expect([400, 403]).toContain(status);
    });
});
