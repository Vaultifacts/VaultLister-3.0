// Chatbot API Tests
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE_URL = `http://localhost:${process.env.PORT || 3000}/api`;
let authToken = null;
let conversationId = null;

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

describe('Chatbot - Conversations', () => {
    test('POST /chatbot/conversations - should create conversation', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                title: 'Test Conversation'
            })
        });

        const data = await response.json();
        expect(response.status).toBe(201);
        expect(data.conversation).toBeDefined();
        expect(data.conversation.id).toBeDefined();
        conversationId = data.conversation.id;
    });

    test('GET /chatbot/conversations - should list conversations', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/conversations`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.conversations).toBeDefined();
        expect(Array.isArray(data.conversations)).toBe(true);
    });

    test('GET /chatbot/conversations/:id - should get conversation details', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/conversations/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.conversation).toBeDefined();
        expect(data.messages).toBeDefined();
    });
});

describe('Chatbot - Messages', () => {
    test('POST /chatbot/message - should send message and get response', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`${BASE_URL}/chatbot/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    conversation_id: conversationId,
                    message: 'How do I cross-list items?'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await response.json();
            expect([200]).toContain(response.status);
            if (response.status === 200) {
                expect(data.success).toBe(true);
                expect(data.message).toBeDefined();
                expect(data.message.content).toBeDefined();
                expect(typeof data.message.content).toBe('string');
                expect(data.message.content.length).toBeGreaterThan(0);
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') return; // AI API unavailable — skip
            throw e;
        }
    }, 25000);

    test('POST /chatbot/message - should handle follow-up message', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(`${BASE_URL}/chatbot/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    conversation_id: conversationId,
                    message: 'What about pricing?'
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const data = await response.json();
            expect([200]).toContain(response.status);
            if (response.status === 200) {
                expect(data.success).toBe(true);
                expect(data.message).toBeDefined();
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === 'AbortError') return; // AI API unavailable — skip
            throw e;
        }
    }, 25000);

    test('POST /chatbot/message - should reject missing message', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                conversation_id: conversationId
            })
        });

        expect(response.status).toBe(400);
    });
});

describe('Chatbot - Rating', () => {
    test('POST /chatbot/rate - should rate message helpfulness', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                message_id: 'msg_test',
                rating: 5
            })
        });

        // Should either succeed or return 404 if message doesn't exist
        expect([200, 404]).toContain(response.status);
    });

    test('POST /chatbot/rate - should validate rating value', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                message_id: 'msg_test',
                rating: 10
            })
        });

        // Rating must be 1-5, so should return 400
        expect(response.status).toBe(400);
    });
});

describe('Chatbot - Authentication', () => {
    test('POST /chatbot/conversations - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test' })
        });

        expect(response.status).toBe(401);
    });

    test('POST /chatbot/message - should require auth', async () => {
        const response = await fetch(`${BASE_URL}/chatbot/message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Hello' })
        });

        expect(response.status).toBe(401);
    });
});

console.log('Running Chatbot API tests...');
