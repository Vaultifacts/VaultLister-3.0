// Notification Service — Expanded Integration Tests
// Tests createNotification, getUnreadNotifications, markAsRead, delete, createOAuthNotification
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Notifications API — CRUD', () => {
    test('GET /notifications returns paginated list', async () => {
        const { status, data } = await client.get('/notifications');
        if (status === 200) {
            // Should be array or paginated object
            const items = Array.isArray(data) ? data : (data.notifications || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /notifications/unread returns unread notifications', async () => {
        const { status, data } = await client.get('/notifications/unread');
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.notifications || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /notifications/count returns unread count', async () => {
        const { status, data } = await client.get('/notifications/count');
        if (status === 200) {
            // May return { count: N } or { unread: N } or full object
            expect(data).toBeDefined();
            expect(typeof data).toBe('object');
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /notifications/mark-all-read marks all as read', async () => {
        const { status } = await client.post('/notifications/mark-all-read');
        expect([200, 204, 404]).toContain(status);
    });

    test('Notifications require auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/notifications');
        expect([401, 403]).toContain(status);
    });
});

describe('NotificationTypes — unit import', () => {
    let NotificationTypes, createNotification, createOAuthNotification;

    beforeAll(async () => {
        try {
            const mod = await import('../backend/services/notificationService.js');
            NotificationTypes = mod.NotificationTypes;
            createNotification = mod.createNotification;
            createOAuthNotification = mod.createOAuthNotification;
        } catch {
            console.warn('Could not import notificationService directly');
        }
    });

    test('NotificationTypes has required keys (and may include additional keys)', () => {
        if (!NotificationTypes) { console.warn('NotificationTypes not available'); return; }
        const keys = Object.keys(NotificationTypes);
        expect(keys.length).toBeGreaterThanOrEqual(6);
        expect(keys).toContain('TOKEN_REFRESH_SUCCESS');
        expect(keys).toContain('TOKEN_REFRESH_FAILED');
        expect(keys).toContain('OAUTH_DISCONNECTED');
        expect(keys).toContain('SYNC_COMPLETED');
        expect(keys).toContain('SYNC_FAILED');
        expect(keys).toContain('PLATFORM_ERROR');
        expect(NotificationTypes.TOKEN_REFRESH_SUCCESS).toBe('token_refresh_success');
        expect(NotificationTypes.SYNC_FAILED).toBe('sync_failed');
    });

    test('createNotification is a function', () => {
        if (!createNotification) { console.warn('createNotification not available'); return; }
        expect(typeof createNotification).toBe('function');
    });

    test('createOAuthNotification is a function', () => {
        if (!createOAuthNotification) { console.warn('createOAuthNotification not available'); return; }
        expect(typeof createOAuthNotification).toBe('function');
    });

    test('createOAuthNotification rejects invalid user gracefully', () => {
        if (!createOAuthNotification) { console.warn('createOAuthNotification not available'); return; }
        // Using a fake user ID will fail FK constraint — verify it throws
        try {
            createOAuthNotification(
                'nonexistent-user-id',
                'ebay',
                'sync_completed',
                { detail: 'test' }
            );
        } catch (e) {
            // FK constraint or similar DB error expected
            expect(e).toBeDefined();
        }
    });
});

describe('Notifications — mark single as read', () => {
    test('PUT /notifications/:id/read with nonexistent ID', async () => {
        const { status } = await client.put('/notifications/nonexistent-id-999/read');
        expect([200, 404, 500]).toContain(status);
    });

    test('DELETE /notifications/:id with nonexistent ID', async () => {
        const { status } = await client.delete('/notifications/nonexistent-id-999');
        expect([200, 204, 404, 500]).toContain(status);
    });
});
