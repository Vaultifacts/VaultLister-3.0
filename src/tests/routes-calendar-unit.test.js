// Issue #288: Unit tests for calendar route (src/backend/routes/calendar.js)
// Tests the calendarRouter function directly with a mocked query object.
// No live server or database required.
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================
// Mocks — must come before imports
// ============================================

const mockQueryAll = mock(() => []);
const mockQueryGet = mock(() => null);
const mockQueryRun = mock(() => ({ changes: 1 }));
const mockTransaction = mock((fn) => fn({
    get: mockQueryGet,
    all: mockQueryAll,
    run: mockQueryRun
}));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mockTransaction,
    },
    models: {
        create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []),
        update: mock(), delete: mock(), count: mock(() => 0)
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => Promise.resolve()),
    closeDatabase: mock(() => Promise.resolve()),
    default: {}
}));

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
    default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

mock.module('../backend/services/googleOAuth.js', () => ({
    isGoogleConfigured: mock(() => false),
    buildGoogleAuthUrl: mock(() => 'https://accounts.google.com/o/oauth2/auth'),
    getAccessToken: mock(() => Promise.resolve({ access_token: 'mock-token' })),
    revokeGoogleToken: mock(() => Promise.resolve()),
    getConnectionStatus: mock(() => ({ connected: false })),
    default: {}
}));

mock.module('../backend/middleware/csrf.js', () => ({
    validateCSRF: mock(() => null),
    applyCSRFProtection: mock((req) => null),
    addCSRFToken: mock(() => {}),
    csrfManager: { _cleanupInterval: null },
    stopCSRF: mock(() => {}),
    default: {}
}));

mock.module('nanoid', () => ({
    nanoid: mock(() => 'mock-nanoid-id'),
    customAlphabet: mock(() => () => 'mock-nanoid-id'),
    default: mock(() => 'mock-nanoid-id')
}));

// ============================================
// Import router under test
// ============================================

const { calendarRouter } = await import('../backend/routes/calendar.js');

// ============================================
// Test helpers
// ============================================

const mockUser = { id: 'user-1', email: 'test@example.com', is_admin: false };

function makeCtx(overrides = {}) {
    return {
        method: 'GET',
        path: '/',
        body: {},
        query: {},
        user: mockUser,
        ...overrides
    };
}

// ============================================
// Tests
// ============================================

describe('calendarRouter — authentication', () => {
    test('should return 401 when user is not authenticated', async () => {
        const ctx = makeCtx({ user: null });
        const result = await calendarRouter(ctx);
        expect(result.status).toBe(401);
        expect(result.data).toHaveProperty('error', 'Authentication required');
    });
});

describe('calendarRouter — GET / (list events)', () => {
    beforeEach(() => {
        mockQueryAll.mockReset();
        mockQueryAll.mockReturnValue([]);
    });

    test('should return 200 with empty events array when no events exist', async () => {
        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await calendarRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data).toHaveProperty('events');
        expect(Array.isArray(result.data.events)).toBe(true);
    });

    test('should return events from database when they exist', async () => {
        const fakeEvents = [
            { id: 'evt-1', user_id: 'user-1', title: 'Test Event', date: '2026-04-01', type: 'custom' },
            { id: 'evt-2', user_id: 'user-1', title: 'Listing Ends', date: '2026-04-15', type: 'listing_end' }
        ];
        mockQueryAll.mockReturnValue(fakeEvents);

        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await calendarRouter(ctx);

        expect(result.status).toBe(200);
        expect(result.data.events).toHaveLength(2);
        expect(result.data.events[0].id).toBe('evt-1');
    });

    test('should pass start_date and end_date filter params to query', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/',
            query: { start_date: '2026-04-01', end_date: '2026-04-30' }
        });

        await calendarRouter(ctx);

        expect(mockQueryAll).toHaveBeenCalled();
        const [sql, params] = mockQueryAll.mock.calls[0];
        expect(sql).toContain('date >= ?');
        expect(sql).toContain('date <= ?');
        expect(params).toContain('2026-04-01');
        expect(params).toContain('2026-04-30');
    });

    test('should pass type filter to query when provided', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/',
            query: { type: 'sale' }
        });

        await calendarRouter(ctx);

        expect(mockQueryAll).toHaveBeenCalled();
        const [sql, params] = mockQueryAll.mock.calls[0];
        expect(sql).toContain('type = ?');
        expect(params).toContain('sale');
    });

    test('should return 500 when database query throws', async () => {
        mockQueryAll.mockImplementation(() => { throw new Error('DB connection lost'); });
        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await calendarRouter(ctx);
        expect(result.status).toBe(500);
        expect(result.data).toHaveProperty('error');
    });
});

describe('calendarRouter — GET /:year/:month (month events)', () => {
    beforeEach(() => {
        mockQueryAll.mockReset();
        mockQueryAll.mockReturnValue([]);
    });

    test('should return 200 with events for a valid month', async () => {
        const ctx = makeCtx({ method: 'GET', path: '/2026/4' });
        const result = await calendarRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data).toHaveProperty('events');
        expect(result.data).toHaveProperty('year', 2026);
        expect(result.data).toHaveProperty('month', 4);
    });

    test('should return 400 for invalid year (out of range)', async () => {
        const ctx = makeCtx({ method: 'GET', path: '/1800/1' });
        const result = await calendarRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('Invalid year');
    });

    test('should return 400 for invalid month (out of range)', async () => {
        const ctx = makeCtx({ method: 'GET', path: '/2026/13' });
        const result = await calendarRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('Invalid month');
    });

    test('should query correct date range for April 2026', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({ method: 'GET', path: '/2026/4' });
        await calendarRouter(ctx);

        expect(mockQueryAll).toHaveBeenCalled();
        const [sql, params] = mockQueryAll.mock.calls[0];
        expect(params).toContain('2026-04-01');
        expect(params).toContain('2026-04-30');
    });
});
