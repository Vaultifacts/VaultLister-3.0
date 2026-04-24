import { describe, expect, test } from 'bun:test';
import { deriveRecentHealthState } from '../backend/utils/platformHealthState.js';

describe('deriveRecentHealthState', () => {
    test('latest passing sample clears previous failures', () => {
        const state = deriveRecentHealthState([
            { isUp: true, sampledAt: '2026-04-24T17:08:09.443Z' },
            { isUp: false, sampledAt: '2026-04-24T16:35:21.780Z' },
            { isUp: false, sampledAt: '2026-04-24T16:30:47.838Z' },
            { isUp: false, sampledAt: '2026-04-24T16:22:21.743Z' }
        ]);

        expect(state).toBe('operational');
    });

    test('latest failing sample uses recent failure thresholds', () => {
        const state = deriveRecentHealthState([
            { isUp: false, sampledAt: '2026-04-24T17:08:09.443Z' },
            { isUp: false, sampledAt: '2026-04-24T16:35:21.780Z' },
            { isUp: false, sampledAt: '2026-04-24T16:30:47.838Z' },
            { isUp: true, sampledAt: '2026-04-24T16:22:21.743Z' }
        ]);

        expect(state).toBe('outage');
    });

    test('single latest failing sample is degraded', () => {
        const state = deriveRecentHealthState([
            { isUp: false, sampledAt: '2026-04-24T17:08:09.443Z' },
            { isUp: true, sampledAt: '2026-04-24T16:35:21.780Z' }
        ]);

        expect(state).toBe('degraded');
    });
});
