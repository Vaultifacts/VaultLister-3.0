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

describe('SSE line parsing (api.stream pattern)', () => {
    it('parses delta and done events from SSE lines', () => {
        const parseSSELine = (line) => {
            if (!line.startsWith('data: ')) return null;
            try { return JSON.parse(line.slice(6)); } catch { return null; }
        };

        const sseBody = [
            'data: {"type":"delta","content":"Hello"}',
            'data: {"type":"delta","content":", world"}',
            'data: {"type":"done","messageId":"msg_test","quickActions":[]}',
        ];

        const events = sseBody.map(parseSSELine).filter(Boolean);

        expect(events[0]).toEqual({ type: 'delta', content: 'Hello' });
        expect(events[1]).toEqual({ type: 'delta', content: ', world' });
        expect(events[2]).toEqual({ type: 'done', messageId: 'msg_test', quickActions: [] });
    });

    it('returns null for malformed JSON lines', () => {
        const parseSSELine = (line) => {
            if (!line.startsWith('data: ')) return null;
            try { return JSON.parse(line.slice(6)); } catch { return null; }
        };
        expect(parseSSELine('data: {broken json}')).toBeNull();
        expect(parseSSELine('not a data line')).toBeNull();
        expect(parseSSELine('')).toBeNull();
    });

    it('handles buffer split across multiple read() calls', () => {
        // Simulate SSE splitting across chunk boundaries
        const chunk1 = 'data: {"type":"delta","con';
        const chunk2 = 'tent":"Hello"}\n\ndata: {"type":"done","messageId":"m1","quickActions":[]}\n\n';

        const buffer1 = chunk1 + chunk2;
        const lines = buffer1.split('\n\n');
        const incomplete = lines.pop(); // last element (may be empty or partial)
        const complete = lines.filter(l => l.startsWith('data: '));

        const parseSSELine = (line) => {
            try { return JSON.parse(line.slice(6)); } catch { return null; }
        };
        const events = complete.map(parseSSELine).filter(Boolean);

        expect(events.length).toBe(2);
        expect(events[0].content).toBe('Hello');
        expect(events[1].messageId).toBe('m1');
        expect(incomplete).toBe(''); // buffer remainder should be empty here
    });
});
