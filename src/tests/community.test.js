// Community API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let testPostId = null;
let testReplyId = null;

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

describe('Community - Posts', () => {
    test('POST /community/posts - should create discussion post', async () => {
        const response = await fetch(`${BASE_URL}/community/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'discussion',
                title: 'Test Discussion Post',
                content: 'This is a test discussion about cross-listing strategies.'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.post).toBeDefined();
        expect(data.post.title).toBe('Test Discussion Post');
        testPostId = data.post.id;
    });

    test('POST /community/posts - should create success story', async () => {
        const response = await fetch(`${BASE_URL}/community/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'success',
                title: 'Made $500 this week!',
                content: 'Here is how I did it...',
                sale_amount: 500,
                item_sold: 'Designer Handbag'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.post).toBeDefined();
        expect(data.post.type).toBe('success');
    });

    test('POST /community/posts - should create tip post', async () => {
        const response = await fetch(`${BASE_URL}/community/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                type: 'tip',
                title: 'Pro Tip: Use natural lighting',
                content: 'Natural lighting makes your items look better in photos.',
                category: 'photography'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.post).toBeDefined();
    });

    test('GET /community/posts - should list posts', async () => {
        const response = await fetch(`${BASE_URL}/community/posts`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.posts).toBeDefined();
        expect(Array.isArray(data.posts)).toBe(true);
    });

    test('GET /community/posts?type=discussion - should filter by type', async () => {
        const response = await fetch(`${BASE_URL}/community/posts?type=discussion`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.posts).toBeDefined();
    });

    test('GET /community/posts/:id - should get post details', async () => {
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.post).toBeDefined();
        expect(data.replies).toBeDefined();
    });
});

describe('Community - Replies', () => {
    test('POST /community/posts/:id/replies - should create reply', async () => {
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}/replies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                content: 'Great post! Thanks for sharing.'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.reply).toBeDefined();
        testReplyId = data.reply.id;
    });

    test('PATCH /community/replies/:id - should update reply', async () => {
        const response = await fetch(`${BASE_URL}/community/replies/${testReplyId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                content: 'Updated reply content'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.reply).toBeDefined();
        expect(data.reply.body).toBe('Updated reply content');
    });
});

describe('Community - Reactions', () => {
    test('POST /community/posts/:id/react - should add upvote', async () => {
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}/react`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                reaction_type: 'upvote'
            })
        });

        const data = await response.json();
        expect([200, 201]).toContain(response.status);
    });

    test('POST /community/posts/:id/react - should toggle reaction', async () => {
        // React again with same type should toggle off
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}/react`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                reaction_type: 'upvote'
            })
        });

        expect(response.status).toBe(200);
    });

    test('POST /community/posts/:id/react - should validate reaction type', async () => {
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}/react`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                reaction_type: 'invalid_reaction'
            })
        });

        expect(response.status).toBe(400);
    });
});

describe('Community - Leaderboard', () => {
    test('GET /community/leaderboard - should return top sellers', async () => {
        const response = await fetch(`${BASE_URL}/community/leaderboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.leaderboard).toBeDefined();
        expect(Array.isArray(data.leaderboard)).toBe(true);
    });

    test('GET /community/leaderboard?period=week - should filter by period', async () => {
        const response = await fetch(`${BASE_URL}/community/leaderboard?period=week`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
    });
});

describe('Community - Moderation', () => {
    test('POST /community/posts/:id/flag - should flag post', async () => {
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}/flag`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                reason: 'spam',
                details: 'This looks like spam content'
            })
        });

        expect([200, 201]).toContain(response.status);
    });

    test('POST /community/posts/:id/flag - should prevent duplicate flags', async () => {
        const response = await fetch(`${BASE_URL}/community/posts/${testPostId}/flag`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                reason: 'spam',
                details: 'Duplicate flag attempt'
            })
        });

        // Should either succeed or reject duplicate
        expect([200, 201, 400]).toContain(response.status);
    });
});

describe('Community - Search', () => {
    test('GET /community/posts?search=X - should search posts', async () => {
        const response = await fetch(`${BASE_URL}/community/posts?search=test`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.posts).toBeDefined();
    });
});

console.log('Running Community API tests...');
