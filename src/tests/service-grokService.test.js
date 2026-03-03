// Grok Service — Unit Tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import {
    getGrokResponse,
    isGrokConfigured,
    getChatbotMode
} from '../backend/services/grokService.js';

// Save and clear env vars for predictable tests
const originalApiKey = process.env.XAI_API_KEY;
const originalMode = process.env.CHATBOT_MODE;

beforeAll(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.CHATBOT_MODE;
});

afterAll(() => {
    if (originalApiKey) process.env.XAI_API_KEY = originalApiKey;
    else delete process.env.XAI_API_KEY;
    if (originalMode) process.env.CHATBOT_MODE = originalMode;
    else delete process.env.CHATBOT_MODE;
});

describe('isGrokConfigured', () => {
    test('returns false when no API key', () => {
        expect(isGrokConfigured()).toBe(false);
    });

    test('returns false when mode is not api', () => {
        process.env.XAI_API_KEY = 'test-key';
        process.env.CHATBOT_MODE = 'mock';
        expect(isGrokConfigured()).toBe(false);
        delete process.env.XAI_API_KEY;
        delete process.env.CHATBOT_MODE;
    });

    test('returns true when key and mode=api', () => {
        process.env.XAI_API_KEY = 'test-key';
        process.env.CHATBOT_MODE = 'api';
        expect(isGrokConfigured()).toBe(true);
        delete process.env.XAI_API_KEY;
        delete process.env.CHATBOT_MODE;
    });
});

describe('getChatbotMode', () => {
    test('defaults to mock when no env var', () => {
        expect(getChatbotMode()).toBe('mock');
    });

    test('returns env var value when set', () => {
        process.env.CHATBOT_MODE = 'api';
        expect(getChatbotMode()).toBe('api');
        delete process.env.CHATBOT_MODE;
    });
});

describe('getGrokResponse (mock mode)', () => {
    test('returns greeting for hello', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'hello' }]);
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('quickActions');
        expect(result).toHaveProperty('source', 'mock');
        expect(result.category).toBe('greeting');
        expect(result.content.length).toBeGreaterThan(0);
    });

    test('returns cross-listing help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'how to cross-list items' }]);
        expect(result.source).toBe('mock');
        expect(result.category).toBe('crosslist');
    });

    test('returns image bank help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'tell me about the image bank' }]);
        expect(result.category).toBe('imageBank');
    });

    test('returns template help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'how do I use a template' }]);
        expect(result.category).toBe('templates');
    });

    test('returns AI generation help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'ai generate listing' }]);
        expect(result.category).toBe('aiGenerate');
    });

    test('returns automation help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'how to automate sharing' }]);
        expect(result.category).toBe('automation');
    });

    test('returns analytics help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'show me analytics and stats' }]);
        expect(result.category).toBe('analytics');
    });

    test('returns inventory help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'how to manage inventory' }]);
        expect(result.category).toBe('inventory');
    });

    test('returns platform help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'connect platform account' }]);
        expect(result.category).toBe('platforms');
    });

    test('returns pricing help', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'pricing tips' }]);
        expect(result.category).toBe('pricing');
    });

    test('returns help for support queries', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'I need help' }]);
        expect(result.category).toBe('help');
    });

    test('returns default for unrecognized queries', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'xyzzy gobbledygook' }]);
        expect(result.category).toBe('default');
        expect(result.source).toBe('mock');
    });

    test('quickActions is always an array', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'hello' }]);
        expect(Array.isArray(result.quickActions)).toBe(true);
    });

    test('quickActions have label and route/action', async () => {
        const result = await getGrokResponse([{ role: 'user', content: 'hello' }]);
        for (const action of result.quickActions) {
            expect(action).toHaveProperty('label');
            expect(action.route || action.action).toBeDefined();
        }
    });

    test('uses last message in array', async () => {
        const result = await getGrokResponse([
            { role: 'user', content: 'hello' },
            { role: 'assistant', content: 'Hi!' },
            { role: 'user', content: 'tell me about analytics' }
        ]);
        expect(result.category).toBe('analytics');
    });
});
