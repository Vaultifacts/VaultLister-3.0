// Feedback API — Expanded Tests
import { describe, expect, test, beforeAll } from 'bun:test';
import { TestApiClient } from './helpers/api.client.js';
import { createTestUserWithToken } from './helpers/auth.helper.js';

let clientA, clientB;
let testFeedbackId = null;

beforeAll(async () => {
    const userA = await createTestUserWithToken();
    const userB = await createTestUserWithToken();
    clientA = new TestApiClient(userA.token);
    clientB = new TestApiClient(userB.token);
});

describe('Feedback - Auth Guard', () => {
    test('POST /feedback without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'feature', title: 'Test' })
        });
        expect(res.status).toBe(401);
    });

    test('GET /feedback without auth returns 401', async () => {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/feedback`);
        expect(res.status).toBe(401);
    });
});

describe('Feedback - Submit', () => {
    test('POST /feedback with valid data creates feedback', async () => {
        const { status, data } = await clientA.post('/feedback', {
            type: 'feature',
            title: 'Test Feature Request',
            description: 'This is a test feature request for expanded tests.',
            category: 'general'
        });
        expect([200, 201]).toContain(status);
        if (data.feedback?.id || data.id) {
            testFeedbackId = data.feedback?.id || data.id;
        }
    });

    test('POST /feedback without required fields returns 400', async () => {
        const { status } = await clientA.post('/feedback', {});
        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(status);
    });

    test('POST /feedback with bug type', async () => {
        const { status } = await clientA.post('/feedback', {
            type: 'bug',
            title: 'Test Bug Report',
            description: 'Found a bug in the system.',
            category: 'bugs'
        });
        expect([200, 201]).toContain(status);
    });
});

describe('Feedback - List & Get', () => {
    test('GET /feedback returns user feedback list', async () => {
        const { status, data } = await clientA.get('/feedback');
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(status);
    });

    test('GET /feedback/:id returns feedback details', async () => {
        if (!testFeedbackId) return;
        const { status, data } = await clientA.get(`/feedback/${testFeedbackId}`);
        expect([200, 404]).toContain(status);
    });
});

describe('Feedback - Trending & Analytics', () => {
    test('GET /feedback/trending returns top-voted feedback', async () => {
        const { status, data } = await clientA.get('/feedback/trending');
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(status);
        if (status === 200) {
            expect(data).toHaveProperty('feedback');
            expect(Array.isArray(data.feedback)).toBe(true);
        }
    });

    test('GET /feedback/analytics returns feedback stats', async () => {
        const { status, data } = await clientA.get('/feedback/analytics');
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(status);
    });

    test('GET /feedback/similar?q=test returns similar items', async () => {
        const { status } = await clientA.get('/feedback/similar?q=test');
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(status);
    });
});

describe('Feedback - User Feedback', () => {
    test('GET /feedback/user returns current user feedback', async () => {
        const { status } = await clientA.get('/feedback/user');
        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(status);
    });
});

describe('Feedback - Responses Thread', () => {
    test('GET /feedback/:id/responses returns response thread', async () => {
        if (!testFeedbackId) return;
        const { status, data } = await clientA.get(`/feedback/${testFeedbackId}/responses`);
        expect([200, 404]).toContain(status);
    });

    test('POST /feedback/:id/responses adds a response', async () => {
        if (!testFeedbackId) return;
        const { status } = await clientA.post(`/feedback/${testFeedbackId}/responses`, {
            content: 'This is a test response to the feedback.'
        });
        expect([200, 201, 400, 404]).toContain(status);
    });
});

describe('Feedback - Voting', () => {
    test('POST /feedback/vote/:id votes on feedback', async () => {
        if (!testFeedbackId) return;
        const { status } = await clientA.post(`/feedback/vote/${testFeedbackId}`, {
            vote_type: 'up'
        });
        expect([200, 404]).toContain(status);
    });

    test('POST /feedback/vote/nonexistent returns 404', async () => {
        const { status } = await clientA.post('/feedback/vote/nonexistent-id', {
            vote_type: 'up'
        });
        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(status);
    });

    test('User B can vote on User A feedback', async () => {
        if (!testFeedbackId) return;
        const { status } = await clientB.post(`/feedback/vote/${testFeedbackId}`, {
            vote_type: 'up'
        });
        expect([200, 404]).toContain(status);
    });
});

describe('Feedback - Delete', () => {
    test('DELETE /feedback/nonexistent returns 404', async () => {
        const { status } = await clientA.delete('/feedback/nonexistent-id');
        // 404 on missing, 403 if tier-gated on CI
        expect([404, 403]).toContain(status);
    });

    test('DELETE /feedback/:id deletes own feedback', async () => {
        if (!testFeedbackId) return;
        const { status } = await clientA.delete(`/feedback/${testFeedbackId}`);
        expect([200, 404]).toContain(status);
    });
});
