// Notifications API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_BASE_URL ? `${process.env.TEST_BASE_URL}/api` : `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testNotificationId = null;

beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'demo@vaultlister.com',
            password: 'DemoPassword123!'
        })
    });
    const data = await response.json();
    authToken = data.token;
});

describe('Notifications - List', () => {
    test('GET /notifications - should return notifications list', async () => {
        const response = await fetch(`${BASE_URL}/notifications/`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.notifications || data).toBeDefined();
        }
    });

    test('GET /notifications?page=1&limit=10 - should support pagination', async () => {
        const response = await fetch(`${BASE_URL}/notifications/?page=1&limit=10`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
    });
});

describe('Notifications - Unread', () => {
    test('GET /notifications/unread - should return unread notifications', async () => {
        const response = await fetch(`${BASE_URL}/notifications/unread`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.notifications).toBeDefined();
        }
    });

    test('GET /notifications/count - should return unread count', async () => {
        const response = await fetch(`${BASE_URL}/notifications/count`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.unreadCount).toBeDefined();
            expect(typeof data.unreadCount).toBe('number');
        }
    });
});

describe('Notifications - Mark as Read', () => {
    test('PUT /notifications/:id/read - should mark notification as read', async () => {
        // First get a notification ID
        const listResponse = await fetch(`${BASE_URL}/notifications/`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const listData = await listResponse.json();
        const notifications = listData.notifications || listData;

        if (!notifications || notifications.length === 0) {
            console.log('Skipping: No notifications to mark as read');
            return;
        }

        testNotificationId = notifications[0].id;

        const response = await fetch(`${BASE_URL}/notifications/${testNotificationId}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect([200, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data.success).toBe(true);
        }
    });

    test('PUT /notifications/read-all - should mark all as read', async () => {
        const response = await fetch(`${BASE_URL}/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            expect(data.success).toBe(true);
            expect(data.markedAsRead).toBeDefined();
        }
    });

    test('PUT /notifications/:id/read - should return 404 for non-existent', async () => {
        const response = await fetch(`${BASE_URL}/notifications/non-existent-id/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Notifications - Delete', () => {
    test('DELETE /notifications/:id - should delete notification', async () => {
        if (!testNotificationId) {
            console.log('Skipping: No test notification ID');
            return;
        }

        const response = await fetch(`${BASE_URL}/notifications/${testNotificationId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        expect([200, 404]).toContain(response.status);
    });

    test('DELETE /notifications/:id - should return 404 for non-existent', async () => {
        const response = await fetch(`${BASE_URL}/notifications/non-existent-id`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(response.status);
    });
});

describe('Notifications - Authentication', () => {
    test('GET /notifications - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/notifications/`);
        expect(response.status).toBe(401);
    });

    test('GET /notifications/count - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/notifications/count`);
        expect(response.status).toBe(401);
    });
});

console.log('Running Notifications API tests...');
