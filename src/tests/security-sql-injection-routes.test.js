// Fix #32 — SQL injection tests for multiple routes
// Verifies that search/filter params on key routes use parameterized queries.
// All DB calls are mocked — no live server or database required.
// The mock captures the SQL and params passed to query.all/query.get so we can
// assert that user input is never interpolated directly into the SQL string.

import { describe, test, expect, mock, beforeEach } from 'bun:test';

import { securityPayloads } from './helpers/fixtures.js';

// ============================================
// Mocks — must come before imports
// ============================================

const capturedCalls = [];

const mockQueryAll = mock((...args) => {
    capturedCalls.push({ fn: 'all', sql: args[0], params: args[1] });
    return Promise.resolve([]);
});
const mockQueryGet = mock((...args) => {
    capturedCalls.push({ fn: 'get', sql: args[0], params: args[1] });
    return Promise.resolve(null);
});
const mockQueryRun = mock(() => Promise.resolve({ changes: 1, lastInsertRowid: 'mock-id' }));

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

mock.module('../backend/middleware/rateLimiter.js', () => ({
    rateLimiter: mock(() => null),
    applyRateLimit: mock(() => Promise.resolve(null)),
    createRateLimiter: mock(() => async () => ({ allowed: true })),
    stopRateLimiter: mock(() => {}),
    default: {},
}));

mock.module('../backend/middleware/csrf.js', () => ({
    validateCSRF: mock(() => null),
    applyCSRFProtection: mock(() => null),
    addCSRFToken: mock(() => {}),
    csrfManager: { _cleanupInterval: null },
    stopCSRF: mock(() => {}),
    default: {},
}));

mock.module('../backend/middleware/cache.js', () => ({
    generateETag: mock(() => '"mock-etag"'),
    etagMatches: mock(() => false),
    cacheFor: mock((secs) => `max-age=${secs}`),
    cacheForUser: mock((secs) => `private, max-age=${secs}`),
    default: {},
}));

mock.module('nanoid', () => ({
    nanoid: mock(() => 'mock-id'),
    customAlphabet: mock(() => () => 'mock-id'),
    default: mock(() => 'mock-id'),
}));

mock.module('../backend/services/redis.js', () => ({
    default: {
        get: mock(() => Promise.resolve(null)),
        set: mock(() => Promise.resolve('OK')),
        del: mock(() => Promise.resolve(1)),
        incr: mock(() => Promise.resolve(1)),
        expire: mock(() => Promise.resolve(1)),
        flushAll: mock(() => {}),
    },
}));

// Import routers under test after mocks are installed
const { inventoryRouter } = await import('../backend/routes/inventory.js');
const { listingsRouter } = await import('../backend/routes/listings.js');
const { salesRouter } = await import('../backend/routes/sales.js');
const { analyticsRouter } = await import('../backend/routes/analytics.js');
const { offersRouter } = await import('../backend/routes/offers.js');

// ============================================
// Helpers
// ============================================

const mockUser = { id: 'user-safe-1', email: 'test@example.com', tier: 'pro' };

function makeCtx(method, path, query = {}, overrides = {}) {
    return {
        method,
        path,
        query,
        queryParams: query,
        body: {},
        user: mockUser,
        ip: '127.0.0.1',
        headers: {},
        rateLimitHeaders: {},
        ...overrides,
    };
}

/**
 * Assert that none of the SQL strings captured during a router call contain
 * the raw injection payload — i.e., the payload was passed as a bound parameter,
 * not interpolated directly into the SQL.
 */
function assertNoRawInjection(callsBefore, payload) {
    const newCalls = capturedCalls.slice(callsBefore);
    for (const call of newCalls) {
        expect(call.sql).not.toContain(payload);
    }
}

// ============================================
// Tests
// ============================================

describe('SQL injection: GET /api/inventory?search', () => {
    beforeEach(() => {
        capturedCalls.length = 0;
        mockQueryAll.mockClear();
        mockQueryGet.mockClear();
    });

    test("should not interpolate '; DROP TABLE-- into SQL when used as search param", async () => {
        const payload = "'; DROP TABLE--";
        const before = capturedCalls.length;
        const ctx = makeCtx('GET', '/', { search: payload });
        const result = await inventoryRouter(ctx);
        expect([200, 400, 403, 404]).toContain(result.status);
        assertNoRawInjection(before, payload);
    });

    test("should not interpolate '1 OR 1=1 into SQL when used as search param", async () => {
        const payload = "1 OR 1=1";
        const before = capturedCalls.length;
        const ctx = makeCtx('GET', '/', { search: payload });
        const result = await inventoryRouter(ctx);
        expect([200, 400, 403, 404]).toContain(result.status);
        assertNoRawInjection(before, payload);
    });

    test('should not interpolate any securityPayloads.sqlInjection entries into SQL', async () => {
        for (const payload of securityPayloads.sqlInjection) {
            const before = capturedCalls.length;
            const ctx = makeCtx('GET', '/', { search: payload });
            await inventoryRouter(ctx);
            assertNoRawInjection(before, payload);
        }
    });
});

describe('SQL injection: GET /api/listings?search', () => {
    beforeEach(() => {
        capturedCalls.length = 0;
        mockQueryAll.mockClear();
        mockQueryGet.mockClear();
    });

    test("should not interpolate '1 OR 1=1 into SQL when used as listings search param", async () => {
        const payload = "1 OR 1=1";
        const before = capturedCalls.length;
        const ctx = makeCtx('GET', '/', { search: payload });
        const result = await listingsRouter(ctx);
        expect([200, 400, 403, 404]).toContain(result.status);
        assertNoRawInjection(before, payload);
    });

    test('should not interpolate any sqlInjection payloads into listings SQL', async () => {
        for (const payload of securityPayloads.sqlInjection) {
            const before = capturedCalls.length;
            await listingsRouter(makeCtx('GET', '/', { search: payload }));
            assertNoRawInjection(before, payload);
        }
    });
});

describe('SQL injection: GET /api/sales?search', () => {
    beforeEach(() => {
        capturedCalls.length = 0;
        mockQueryAll.mockClear();
        mockQueryGet.mockClear();
    });

    test("should not interpolate 'UNION SELECT into SQL via sales search param", async () => {
        const payload = "UNION SELECT";
        const before = capturedCalls.length;
        const ctx = makeCtx('GET', '/', { search: payload });
        const result = await salesRouter(ctx);
        expect([200, 400, 403, 404]).toContain(result.status);
        assertNoRawInjection(before, payload);
    });

    test('should not interpolate any sqlInjection payloads into sales SQL', async () => {
        for (const payload of securityPayloads.sqlInjection) {
            const before = capturedCalls.length;
            await salesRouter(makeCtx('GET', '/', { search: payload }));
            assertNoRawInjection(before, payload);
        }
    });
});

describe('SQL injection: GET /api/analytics?period', () => {
    beforeEach(() => {
        capturedCalls.length = 0;
        mockQueryAll.mockClear();
        mockQueryGet.mockClear();
    });

    test("should not interpolate '; DROP TABLE-- into SQL via analytics period param", async () => {
        const payload = "'; DROP TABLE--";
        const before = capturedCalls.length;
        const ctx = makeCtx('GET', '/', { period: payload });
        const result = await analyticsRouter(ctx);
        expect([200, 400, 403, 404]).toContain(result.status);
        assertNoRawInjection(before, payload);
    });

    test('should not interpolate any sqlInjection payloads into analytics SQL via period param', async () => {
        for (const payload of securityPayloads.sqlInjection) {
            const before = capturedCalls.length;
            await analyticsRouter(makeCtx('GET', '/', { period: payload }));
            assertNoRawInjection(before, payload);
        }
    });
});

describe('SQL injection: GET /api/offers?search', () => {
    beforeEach(() => {
        capturedCalls.length = 0;
        mockQueryAll.mockClear();
        mockQueryGet.mockClear();
    });

    test("should not interpolate '1; DELETE FROM into SQL via offers search param", async () => {
        const payload = "1; DELETE FROM";
        const before = capturedCalls.length;
        const ctx = makeCtx('GET', '/', { search: payload });
        const result = await offersRouter(ctx);
        expect([200, 400, 403, 404]).toContain(result.status);
        assertNoRawInjection(before, payload);
    });

    test('should not interpolate any sqlInjection payloads into offers SQL', async () => {
        for (const payload of securityPayloads.sqlInjection) {
            const before = capturedCalls.length;
            await offersRouter(makeCtx('GET', '/', { search: payload }));
            assertNoRawInjection(before, payload);
        }
    });
});
