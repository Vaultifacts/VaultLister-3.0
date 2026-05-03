// Fix #34 — Unit tests for POST /api/contact
// Tests the contactRouter function directly with mocked DB and rate limiter.
// No live server required.

import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================
// Mocks — must come before imports
// ============================================

const mockQueryGet = mock(() => Promise.resolve({ cnt: '0' }));
const mockQueryRun = mock(() => Promise.resolve({ changes: 1, lastInsertRowid: 'mock-id' }));
const mockQueryAll = mock(() => Promise.resolve([]));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        exec: mock(() => Promise.resolve()),
        transaction: mock((fn) => fn({ get: mockQueryGet, all: mockQueryAll, run: mockQueryRun })),
    },
    models: {
        create: mock(() => Promise.resolve({ changes: 1, lastInsertRowid: 'mock-id' })),
        findById: mock(() => Promise.resolve(null)),
        findOne: mock(() => Promise.resolve(null)),
        findMany: mock(() => Promise.resolve([])),
        update: mock(() => Promise.resolve({ changes: 1 })),
        delete: mock(() => Promise.resolve({ changes: 1 })),
        count: mock(() => Promise.resolve(0)),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    initializeDatabase: mock(() => Promise.resolve(true)),
    cleanupExpiredData: mock(() => Promise.resolve({})),
    default: {},
}));

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
    default: { info: mock(), error: mock(), warn: mock(), debug: mock() },
}));

// applyRateLimit returns null = allowed; override per-test to return 429 for rate-limit tests
let applyRateLimitImpl = mock(() => Promise.resolve(null));

mock.module('../backend/middleware/rateLimiter.js', () => ({
    rateLimiter: mock(() => null),
    applyRateLimit: (...args) => applyRateLimitImpl(...args),
    createRateLimiter: mock(() => async () => ({ allowed: true })),
    stopRateLimiter: mock(() => {}),
    default: {},
}));

mock.module('nanoid', () => ({
    nanoid: mock(() => 'mock-contact-id'),
    customAlphabet: mock(() => () => 'mock-contact-id'),
    default: mock(() => 'mock-contact-id'),
}));

const { contactRouter } = await import('../backend/routes/contact.js');

// ============================================
// Helpers
// ============================================

function makeCtx(body, overrides = {}) {
    return {
        method: 'POST',
        path: '/',
        body,
        ip: '127.0.0.1',
        user: null,
        headers: {},
        rateLimitHeaders: {},
        ...overrides,
    };
}

// ============================================
// Tests
// ============================================

describe('POST /api/contact — valid submission', () => {
    beforeEach(() => {
        mockQueryGet.mockImplementation(() => Promise.resolve({ cnt: '0' }));
        mockQueryRun.mockImplementation(() => Promise.resolve({ changes: 1, lastInsertRowid: 'mock-id' }));
        applyRateLimitImpl = mock(() => Promise.resolve(null));
    });

    test('should return 200 when name, email, and message are all provided', async () => {
        const ctx = makeCtx({ name: 'Alice', email: 'alice@gmail.com', message: 'Hello there' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.message).toBeDefined();
    });
});

describe('POST /api/contact — validation errors', () => {
    beforeEach(() => {
        mockQueryGet.mockImplementation(() => Promise.resolve({ cnt: '0' }));
        applyRateLimitImpl = mock(() => Promise.resolve(null));
    });

    test('should return 400 when name is missing', async () => {
        const ctx = makeCtx({ email: 'alice@gmail.com', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/name/i);
    });

    test('should return 400 when name is an empty string', async () => {
        const ctx = makeCtx({ name: '   ', email: 'alice@gmail.com', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/name/i);
    });

    test('should return 400 when email is missing', async () => {
        const ctx = makeCtx({ name: 'Alice', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/email/i);
    });

    test('should return 400 when email is an empty string', async () => {
        const ctx = makeCtx({ name: 'Alice', email: '   ', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/email/i);
    });

    test('should return 400 when email format is invalid', async () => {
        const ctx = makeCtx({ name: 'Alice', email: 'not-an-email', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/email/i);
    });

    test('should return 400 when message is missing', async () => {
        const ctx = makeCtx({ name: 'Alice', email: 'alice@gmail.com' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/message/i);
    });

    test('should return 400 when message is an empty string', async () => {
        const ctx = makeCtx({ name: 'Alice', email: 'alice@gmail.com', message: '   ' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toMatch(/message/i);
    });
});

describe('POST /api/contact — rate limiting (3 per hour)', () => {
    test('should return 429 when the DB count shows 3 or more submissions in the past hour', async () => {
        // applyRateLimit still passes (mutation tier OK), but the DB-level 3/hour cap fires.
        applyRateLimitImpl = mock(() => Promise.resolve(null));
        mockQueryGet.mockImplementation(() => Promise.resolve({ cnt: '3' }));

        const ctx = makeCtx({ name: 'Alice', email: 'alice@gmail.com', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(429);
        expect(result.data.error).toBeDefined();
    });

    test('should return 429 when applyRateLimit itself returns a 429 response', async () => {
        applyRateLimitImpl = mock(() => Promise.resolve({
            status: 429,
            data: { error: 'Too many requests, please try again later' },
        }));

        const ctx = makeCtx({ name: 'Alice', email: 'alice@gmail.com', message: 'Hello' });
        const result = await contactRouter(ctx);
        expect(result.status).toBe(429);
    });
});

describe('POST /api/contact — non-matching routes', () => {
    test('should return 404 for GET /api/contact', async () => {
        const ctx = { method: 'GET', path: '/', body: {}, ip: '127.0.0.1', headers: {}, rateLimitHeaders: {} };
        const result = await contactRouter(ctx);
        expect(result.status).toBe(404);
    });
});
