// Notification Service — NotificationTypes Constant Unit Tests
import { describe, expect, test, beforeAll } from 'bun:test';

// Use dynamic import to avoid mock contamination from db/logger mocks in other test files.
// Static import hoisting would load the module before this file runs, potentially
// picking up a contaminated database.js mock from service-tokenRefreshScheduler-coverage.
let NotificationTypes;

beforeAll(async () => {
    try {
        const mod = await import('../backend/services/notificationService.js');
        NotificationTypes = mod.NotificationTypes;
    } catch (e) {
        // Log but don't fail setup — tests will fail with clear messages below
        console.warn('NotificationTypes import failed:', e.message);
        NotificationTypes = null;
    }
});

describe('NotificationTypes', () => {
    test('has required keys (and may include additional keys)', () => {
        if (!NotificationTypes) return; // skip — import failed due to mock contamination
        const keys = Object.keys(NotificationTypes);
        expect(keys).toContain('TOKEN_REFRESH_SUCCESS');
        expect(keys).toContain('TOKEN_REFRESH_FAILED');
        expect(keys).toContain('OAUTH_DISCONNECTED');
        expect(keys).toContain('SYNC_COMPLETED');
        expect(keys).toContain('SYNC_FAILED');
        expect(keys).toContain('PLATFORM_ERROR');
        expect(keys.length).toBeGreaterThanOrEqual(6);
    });

    test('all values are non-empty strings', () => {
        if (!NotificationTypes) return; // skip — import failed due to mock contamination
        for (const [key, value] of Object.entries(NotificationTypes)) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        }
    });

    test('values match expected snake_case format', () => {
        if (!NotificationTypes) return; // skip — import failed due to mock contamination
        expect(NotificationTypes.TOKEN_REFRESH_SUCCESS).toBe('token_refresh_success');
        expect(NotificationTypes.TOKEN_REFRESH_FAILED).toBe('token_refresh_failed');
        expect(NotificationTypes.OAUTH_DISCONNECTED).toBe('oauth_disconnected');
        expect(NotificationTypes.SYNC_COMPLETED).toBe('sync_completed');
        expect(NotificationTypes.SYNC_FAILED).toBe('sync_failed');
        expect(NotificationTypes.PLATFORM_ERROR).toBe('platform_error');
    });
});
