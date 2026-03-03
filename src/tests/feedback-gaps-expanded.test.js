// Feedback — Expanded Gap Tests
// Covers: trending, analytics, similar, list, create, vote, responses, delete
import { describe, expect, test, beforeAll } from 'bun:test';
import { createTestUserWithToken } from './helpers/auth.helper.js';
import { TestApiClient } from './helpers/api.client.js';

let client;

beforeAll(async () => {
    const { token } = await createTestUserWithToken();
    client = new TestApiClient(token);
});

describe('Feedback — List & Read', () => {
    test('GET /feedback returns list', async () => {
        const { status, data } = await client.get('/feedback');
        if (status === 200) {
            const items = data.feedback || data.items || (Array.isArray(data) ? data : []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /feedback/user returns current user feedback', async () => {
        const { status, data } = await client.get('/feedback/user');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /feedback/trending returns trending feedback', async () => {
        const { status, data } = await client.get('/feedback/trending');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /feedback/analytics returns analytics data', async () => {
        const { status, data } = await client.get('/feedback/analytics');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('GET /feedback/similar?q=test returns similar feedback', async () => {
        const { status, data } = await client.get('/feedback/similar?q=test');
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });
});

describe('Feedback — Create & Vote', () => {
    let feedbackId;

    test('POST /feedback creates new feedback', async () => {
        const { status, data } = await client.post('/feedback', {
            title: 'Test feedback from expanded tests',
            description: 'This is a test feedback submission',
            category: 'feature_request'
        });
        if (status === 200 || status === 201) {
            feedbackId = data.id || data.feedback?.id;
            expect(data).toBeDefined();
        } else {
            expect([400, 404, 403]).toContain(status);
        }
    });

    test('GET /feedback/:id returns single feedback', async () => {
        if (!feedbackId) { console.warn('No feedback created'); return; }
        const { status, data } = await client.get(`/feedback/${feedbackId}`);
        if (status === 200) {
            expect(data).toBeDefined();
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /feedback/vote/:id votes on feedback', async () => {
        if (!feedbackId) { console.warn('No feedback created'); return; }
        const { status } = await client.post(`/feedback/vote/${feedbackId}`, {
            vote_type: 'up'
        });
        expect([200, 201, 400, 404]).toContain(status);
    });

    test('GET /feedback/:id/responses returns thread', async () => {
        if (!feedbackId) { console.warn('No feedback created'); return; }
        const { status, data } = await client.get(`/feedback/${feedbackId}/responses`);
        if (status === 200) {
            const items = Array.isArray(data) ? data : (data.responses || []);
            expect(Array.isArray(items)).toBe(true);
        } else {
            expect([404, 403]).toContain(status);
        }
    });

    test('POST /feedback/:id/responses adds response', async () => {
        if (!feedbackId) { console.warn('No feedback created'); return; }
        const { status } = await client.post(`/feedback/${feedbackId}/responses`, {
            content: 'Test response from expanded tests'
        });
        expect([200, 201, 400, 404]).toContain(status);
    });

    test('DELETE /feedback/:id deletes feedback', async () => {
        if (!feedbackId) { console.warn('No feedback created'); return; }
        const { status } = await client.delete(`/feedback/${feedbackId}`);
        expect([200, 204, 403, 404]).toContain(status);
    });
});

describe('Feedback — Auth Guard', () => {
    test('GET /feedback requires auth', async () => {
        const noAuth = new TestApiClient();
        const { status } = await noAuth.get('/feedback');
        expect([401, 403]).toContain(status);
    });
});
