// Notification Service — NotificationTypes Constant Unit Tests
import { describe, expect, test } from 'bun:test';
import { NotificationTypes } from '../backend/services/notificationService.js';

describe('NotificationTypes', () => {
    test('has required keys (and may include additional keys)', () => {
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
        for (const [key, value] of Object.entries(NotificationTypes)) {
            expect(typeof value).toBe('string');
            expect(value.length).toBeGreaterThan(0);
        }
    });

    test('values match expected snake_case format', () => {
        expect(NotificationTypes.TOKEN_REFRESH_SUCCESS).toBe('token_refresh_success');
        expect(NotificationTypes.TOKEN_REFRESH_FAILED).toBe('token_refresh_failed');
        expect(NotificationTypes.OAUTH_DISCONNECTED).toBe('oauth_disconnected');
        expect(NotificationTypes.SYNC_COMPLETED).toBe('sync_completed');
        expect(NotificationTypes.SYNC_FAILED).toBe('sync_failed');
        expect(NotificationTypes.PLATFORM_ERROR).toBe('platform_error');
    });
});
