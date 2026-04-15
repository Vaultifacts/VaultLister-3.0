// src/tests/chatbot-streaming.test.js
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// We test the generator in isolation by mocking the Anthropic SDK and fetch.
// The generator is not exported yet — tests will fail until Task 2.

describe('streamResponse generator', () => {
    it('yields delta chunks and a done event from mock mode', async () => {
        // Force mock mode by not setting env vars
        const origAnthropic = process.env.ANTHROPIC_API_KEY;
        const origXai = process.env.XAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.XAI_API_KEY;
        process.env.CHATBOT_MODE = 'mock';

        // Dynamic import so env vars take effect
        const { streamResponse } = await import('../backend/services/grokService.js');

        const messages = [{ role: 'user', content: 'hello' }];
        const chunks = [];
        let doneEvent = null;

        for await (const chunk of streamResponse(messages, { userId: 'test-user' })) {
            if (chunk.type === 'delta') chunks.push(chunk.content);
            else if (chunk.type === 'done') doneEvent = chunk;
        }

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('')).toBeTruthy();
        expect(doneEvent).not.toBeNull();
        expect(doneEvent.source).toBe('mock');
        expect(Array.isArray(doneEvent.quickActions)).toBe(true);

        // Restore
        if (origAnthropic) process.env.ANTHROPIC_API_KEY = origAnthropic;
        if (origXai) process.env.XAI_API_KEY = origXai;
        delete process.env.CHATBOT_MODE;
    });

    it('accumulates full content across delta chunks', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.XAI_API_KEY;
        process.env.CHATBOT_MODE = 'mock';

        const { streamResponse } = await import('../backend/services/grokService.js');

        const messages = [{ role: 'user', content: 'help with inventory' }];
        let accumulated = '';
        let doneEvent = null;

        for await (const chunk of streamResponse(messages, {})) {
            if (chunk.type === 'delta') accumulated += chunk.content;
            if (chunk.type === 'done') doneEvent = chunk;
        }

        // The done event should contain quick actions (inventory-related message triggers them)
        expect(accumulated.length).toBeGreaterThan(0);
        expect(doneEvent.quickActions.length).toBeGreaterThan(0);

        delete process.env.CHATBOT_MODE;
    });
});
