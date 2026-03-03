// Email Marketing API Tests
// Covers /api/email-marketing: public unsubscribe + enterprise-only stats
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken, loginUser } from './helpers/auth.helper.js';
import { demoUser } from './helpers/fixtures.js';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let regularClient;
let demoClient;
let unauthClient;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    regularClient = new TestApiClient(token);

    const { data } = await loginUser(demoUser.email, demoUser.password);
    demoClient = new TestApiClient(data.token);

    unauthClient = new TestApiClient();
});

// ============================================================
// Unsubscribe — requires auth (server-level protectedPrefixes)
// ============================================================
describe('Email Marketing - Unsubscribe', () => {
    test('GET /email-marketing/unsubscribe without auth returns 401', async () => {
        const response = await fetch(`${BASE_URL}/email-marketing/unsubscribe`);
        expect(response.status).toBe(401);
    });

    test('GET /email-marketing/unsubscribe without params returns error', async () => {
        const { status } = await regularClient.get('/email-marketing/unsubscribe');
        // Missing userId/email/token params — service should return 400 or 500
        expect([400, 500]).toContain(status);
    });

    test('GET /email-marketing/unsubscribe with invalid token returns error', async () => {
        const { status } = await regularClient.get(
            '/email-marketing/unsubscribe?userId=fake-id&email=test@test.com&token=invalid-token-value'
        );
        // Invalid token — service should return 400 or 500
        expect([400, 500]).toContain(status);
    });

    test('GET /email-marketing/unsubscribe with missing token param returns error', async () => {
        const { status } = await regularClient.get(
            '/email-marketing/unsubscribe?userId=test&email=test@test.com'
        );
        expect([400, 500]).toContain(status);
    });
});

// ============================================================
// Stats — Enterprise/Admin only
// ============================================================
describe('Email Marketing - Stats (Admin/Enterprise Only)', () => {
    test('GET /email-marketing/stats without auth returns 401', async () => {
        const { status } = await unauthClient.get('/email-marketing/stats');
        expect(status).toBe(401);
    });

    test('GET /email-marketing/stats as regular user returns 403', async () => {
        const { status, data } = await regularClient.get('/email-marketing/stats');
        expect(status).toBe(403);
        expect(data.error).toBeDefined();
    });

    test('GET /email-marketing/stats as demo user returns 200 or 403', async () => {
        const { status, data } = await demoClient.get('/email-marketing/stats');
        expect([200, 403]).toContain(status);
        if (status === 200) {
            // Verify stats shape
            expect(data.stats).toBeDefined();
            expect(data.stats).toHaveProperty('total_sent');
            expect(data.queueStats).toBeDefined();
            expect(data.queueStats).toHaveProperty('pending');
            expect(data.queueStats).toHaveProperty('sent');
            expect(data.queueStats).toHaveProperty('failed');
        }
    });
});

// ============================================================
// Unknown Routes
// ============================================================
describe('Email Marketing - Unknown Routes', () => {
    test('GET /email-marketing/nonexistent returns 404', async () => {
        const { status } = await regularClient.get('/email-marketing/nonexistent');
        expect(status).toBe(404);
    });
});
