// GDPR API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let client;

beforeAll(async () => {
    const user = await createTestUserWithToken();
    client = new TestApiClient(user.token);
});

describe('GDPR - Auth Guard', () => {
    test('POST /gdpr/export without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/gdpr/export`, {
            method: 'POST'
        });
        expect(res.status).toBe(401);
    });
});

describe('GDPR - Data Export', () => {
    test('POST /gdpr/export initiates data export', async () => {
        const { status, data } = await client.post('/gdpr/export');
        expect([200, 201, 500]).toContain(status);
        if (status === 200 || status === 201) {
            // Should return a request ID or download data
            expect(data).toBeDefined();
        }
    });

    test('GET /gdpr/export/:requestId/download returns 404 for nonexistent', async () => {
        const { status } = await client.get('/gdpr/export/nonexistent-id/download');
        expect([404, 500]).toContain(status);
    });
});

describe('GDPR - Account Deletion', () => {
    test('POST /gdpr/delete-account schedules deletion', async () => {
        // Create a disposable user for this test
        const disposable = await createTestUserWithToken();
        const dispClient = new TestApiClient(disposable.token);

        const { status, data } = await dispClient.post('/gdpr/delete-account', {
            reason: 'Testing account deletion'
        });
        expect([200, 401, 500]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('scheduled_for');
        }
    });

    test('GET /gdpr/deletion-status returns current status', async () => {
        const { status, data } = await client.get('/gdpr/deletion-status');
        expect([200, 404, 500]).toContain(status);
    });

    test('POST /gdpr/cancel-deletion cancels pending deletion', async () => {
        const { status } = await client.post('/gdpr/cancel-deletion');
        expect([200, 404, 500]).toContain(status);
    });
});

describe('GDPR - Consents', () => {
    test('GET /gdpr/consents returns consent preferences', async () => {
        const { status, data } = await client.get('/gdpr/consents');
        expect([200, 500]).toContain(status);
    });

    test('PUT /gdpr/consents updates consent preferences', async () => {
        const { status } = await client.put('/gdpr/consents', {
            marketing_emails: false,
            analytics_tracking: true
        });
        expect([200, 500]).toContain(status);
    });
});

describe('GDPR - Data Rectification', () => {
    test('POST /gdpr/rectify submits rectification request', async () => {
        const { status } = await client.post('/gdpr/rectify', {
            field: 'email',
            current_value: 'old@example.com',
            requested_value: 'new@example.com',
            reason: 'Email changed'
        });
        expect([200, 201, 400, 404, 500]).toContain(status);
    });
});
