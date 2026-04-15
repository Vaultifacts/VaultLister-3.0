// src/tests/chatbot-streaming.test.js
import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock database.js before any imports that pull it in transitively.
// grokService.js → tokenBudget.js → database.js (postgres connection at load time).
// Without this mock, importing grokService triggers a 10s DB connect timeout.
mock.module('../backend/db/database.js', () => ({
    query: {
        get: async () => null,
        all: async () => [],
        run: async () => ({})
    },
    initializeDatabase: async () => {}
}));

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
        const parseSSELine = (line) => {
            if (!line.startsWith('data: ')) return null;
            try { return JSON.parse(line.slice(6)); } catch { return null; }
        };

        // Simulate SSE frame split mid-way through: first read ends before the \n\n separator
        const chunk1 = 'data: {"type":"delta","content":"He'; // incomplete frame
        const chunk2 = 'llo"}\n\ndata: {"type":"done","messageId":"msg_1","quickActions":[]}\n\n';

        let buffer = '';

        // First read call — incomplete frame, nothing complete yet
        buffer += chunk1;
        let lines = buffer.split('\n\n');
        buffer = lines.pop();
        const eventsFromChunk1 = lines.filter(l => l.startsWith('data: ')).map(parseSSELine).filter(Boolean);
        expect(eventsFromChunk1.length).toBe(0);

        // Second read call — completes first frame + second frame
        buffer += chunk2;
        lines = buffer.split('\n\n');
        buffer = lines.pop();
        const eventsFromChunk2 = lines.filter(l => l.startsWith('data: ')).map(parseSSELine).filter(Boolean);
        expect(eventsFromChunk2.length).toBe(2);
        expect(eventsFromChunk2[0]).toEqual({ type: 'delta', content: 'Hello' });
        expect(eventsFromChunk2[1]).toEqual({ type: 'done', messageId: 'msg_1', quickActions: [] });

        // Buffer should be empty after processing
        expect(buffer).toBe('');
    });
});
