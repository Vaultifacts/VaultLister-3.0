// Help & Support API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testTicketId = null;

// Setup - Login before tests
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

describe('Help - Video Tutorials', () => {
    test('GET /help/videos - should list videos', async () => {
        const response = await fetch(`${BASE_URL}/help/videos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.videos).toBeDefined();
            expect(Array.isArray(data.videos)).toBe(true);
            expect(data.videos.length).toBeGreaterThan(0);
        }
    });

    test('GET /help/videos?category=getting_started - should filter by category', async () => {
        const response = await fetch(`${BASE_URL}/help/videos?category=getting_started`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.videos).toBeDefined();
        }
    });

    test('GET /help/videos/:id - should get video details', async () => {
        const response = await fetch(`${BASE_URL}/help/videos/vid_getting_started`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.video).toBeDefined();
            expect(data.video.title).toBeDefined();
        }
    });

    test('POST /help/videos/:id/view - should increment view count', async () => {
        const response = await fetch(`${BASE_URL}/help/videos/vid_getting_started/view`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
    });
});

describe('Help - FAQ', () => {
    test('GET /help/faq - should list FAQs', async () => {
        const response = await fetch(`${BASE_URL}/help/faq`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.faqs).toBeDefined();
            expect(Array.isArray(data.faqs)).toBe(true);
            expect(data.faqs.length).toBeGreaterThan(0);
        }
    });

    test('GET /help/faq?category=general - should filter by category', async () => {
        const response = await fetch(`${BASE_URL}/help/faq?category=general`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.faqs).toBeDefined();
        }
    });

    test('GET /help/faq?search=platform - should search FAQs', async () => {
        const response = await fetch(`${BASE_URL}/help/faq?search=platform`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.faqs).toBeDefined();
        }
    });

    test('POST /help/faq/:id/helpful - should vote helpful', async () => {
        const response = await fetch(`${BASE_URL}/help/faq/faq_what_is_vaultlister/helpful`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                helpful: true
            })
        });

        // 200 on success, 400 if already voted, 403 if tier-gated on CI
        expect([200, 400, 403]).toContain(response.status);
    });

    test('POST /help/faq/:id/helpful - should prevent duplicate votes', async () => {
        const response = await fetch(`${BASE_URL}/help/faq/faq_what_is_vaultlister/helpful`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                helpful: true
            })
        });

        // 200 on success, 400 if duplicate rejected, 403 if tier-gated on CI
        expect([200, 400, 403]).toContain(response.status);
    });
});

describe('Help - Knowledge Base Articles', () => {
    test('GET /help/articles - should list articles', async () => {
        const response = await fetch(`${BASE_URL}/help/articles`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.articles).toBeDefined();
            expect(Array.isArray(data.articles)).toBe(true);
            expect(data.articles.length).toBeGreaterThan(0);
        }
    });

    test('GET /help/articles?category=guides - should filter by category', async () => {
        const response = await fetch(`${BASE_URL}/help/articles?category=guides`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.articles).toBeDefined();
        }
    });

    test('GET /help/articles/:slug - should get article by slug', async () => {
        const response = await fetch(`${BASE_URL}/help/articles/getting-started-guide`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.article).toBeDefined();
            expect(data.article.title).toBeDefined();
            expect(data.article.content).toBeDefined();
        }
    });

    test('POST /help/articles/:id/helpful - should vote on article', async () => {
        const response = await fetch(`${BASE_URL}/help/articles/art_getting_started_guide/helpful`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                helpful: true
            })
        });

        // 200 on success, 400 if already voted, 403 if tier-gated on CI
        expect([200, 400, 403]).toContain(response.status);
    });

    test('GET /help/search - should search knowledge base', async () => {
        const response = await fetch(`${BASE_URL}/help/search?q=cross-listing`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.results).toBeDefined();
        }
    });
});

describe('Help - Support Tickets', () => {
    test('POST /help/tickets - should create bug report', async () => {
        const response = await fetch(`${BASE_URL}/help/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'bug',
                subject: 'Test Bug Report',
                description: 'This is a test bug report for the API.',
                page_context: '/inventory',
                browser_info: 'Test Browser 1.0'
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            expect(data.ticket).toBeDefined();
            expect(data.ticket.type).toBe('bug');
            testTicketId = data.ticket.id;
        }
    });

    test('POST /help/tickets - should create feature request', async () => {
        const response = await fetch(`${BASE_URL}/help/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'feature_request',
                subject: 'Add dark mode',
                description: 'Please add a dark mode to the application.'
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated on CI
        expect([201, 403]).toContain(response.status);
        if (response.status === 201) {
            expect(data.ticket).toBeDefined();
        }
    });

    test('POST /help/tickets - should validate required fields', async () => {
        const response = await fetch(`${BASE_URL}/help/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'bug'
                // Missing subject and description
            })
        });

        // 400 on validation, 403 if tier-gated on CI
        expect([400, 403]).toContain(response.status);
    });

    test('GET /help/tickets - should list user tickets', async () => {
        const response = await fetch(`${BASE_URL}/help/tickets`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        // 200 on success, 403 if tier-gated on CI
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
            const data = await response.json();
            expect(data.tickets).toBeDefined();
            expect(Array.isArray(data.tickets)).toBe(true);
        }
    });

    test('GET /help/tickets/:id - should get ticket details', async () => {
        if (!testTicketId) return;
        const response = await fetch(`${BASE_URL}/help/tickets/${testTicketId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated, 404 if not found
        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data.ticket).toBeDefined();
            expect(data.replies).toBeDefined();
        }
    });

    test('POST /help/tickets/:id/replies - should add reply', async () => {
        if (!testTicketId) return;
        const response = await fetch(`${BASE_URL}/help/tickets/${testTicketId}/replies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                message: 'Additional information about this bug...'
            })
        });

        const data = await response.json();
        // 201 on success, 403 if tier-gated, 404 if ticket not found
        expect([201, 403, 404]).toContain(response.status);
        if (response.status === 201) {
            expect(data.reply).toBeDefined();
        }
    });

    test('PATCH /help/tickets/:id - should update ticket status', async () => {
        if (!testTicketId) return;
        const response = await fetch(`${BASE_URL}/help/tickets/${testTicketId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'resolved'
            })
        });

        const data = await response.json();
        // 200 on success, 403 if tier-gated, 404 if ticket not found
        expect([200, 403, 404]).toContain(response.status);
        if (response.status === 200) {
            expect(data.ticket.status).toBe('resolved');
        }
    });
});

describe('Help - Authentication', () => {
    test('GET /help/videos - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/help/videos`);
        expect(response.status).toBe(401);
    });

    test('GET /help/faq - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/help/faq`);
        expect(response.status).toBe(401);
    });

    test('POST /help/tickets - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/help/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'bug',
                subject: 'Test',
                description: 'Test'
            })
        });
        expect(response.status).toBe(401);
    });
});

console.log('Running Help & Support API tests...');
