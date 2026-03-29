// Issue #288: Unit tests for roadmap route (src/backend/routes/roadmap.js)
// Tests the roadmapRouter function directly with a mocked query object.
// No live server or database required.
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================
// Mocks — must come before imports
// ============================================

const mockQueryAll = mock(() => []);
const mockQueryGet = mock(() => null);
const mockQueryRun = mock(() => ({ changes: 1 }));
const mockTransactionFn = mock((fn) => fn({
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
        transaction: mockTransactionFn,
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

mock.module('../backend/middleware/rateLimiter.js', () => ({
    rateLimiter: mock(() => null),
    applyRateLimit: mock(() => null),
    stopRateLimiter: mock(() => {}),
    default: {}
}));

mock.module('../backend/middleware/cache.js', () => ({
    generateETag: mock(() => '"mock-etag"'),
    etagMatches: mock(() => false),
    cacheFor: mock((secs) => `max-age=${secs}`),
    cacheForUser: mock((secs) => `private, max-age=${secs}`),
    default: {}
}));

mock.module('nanoid', () => ({
    nanoid: mock(() => 'mock-feature-id'),
    customAlphabet: mock(() => () => 'mock-feature-id'),
    default: mock(() => 'mock-feature-id')
}));

// ============================================
// Import router under test
// ============================================

const { roadmapRouter } = await import('../backend/routes/roadmap.js');

// ============================================
// Test helpers
// ============================================

const mockUser = { id: 'user-1', email: 'test@example.com', is_admin: false };
const mockAdmin = { id: 'admin-1', email: 'admin@example.com', is_admin: true };

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

describe('roadmapRouter — GET / (list features)', () => {
    beforeEach(() => {
        mockQueryAll.mockReset();
        mockQueryAll.mockReturnValue([]);
        mockQueryGet.mockReset();
        mockQueryGet.mockReturnValue(null);
    });

    test('should return 200 with empty features array when no features exist', async () => {
        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data).toHaveProperty('features');
        expect(Array.isArray(result.data.features)).toBe(true);
    });

    test('should return features from database when they exist', async () => {
        const fakeFeatures = [
            { id: 'feat-1', title: 'Dark Mode', votes: 42, status: 'planned' },
            { id: 'feat-2', title: 'Mobile App', votes: 18, status: 'in_progress' }
        ];
        mockQueryAll.mockReturnValue(fakeFeatures);

        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await roadmapRouter(ctx);

        expect(result.status).toBe(200);
        expect(result.data.features).toHaveLength(2);
        expect(result.data.features[0].id).toBe('feat-1');
    });

    test('should filter features by status when status param is provided', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/',
            query: { status: 'planned' }
        });
        await roadmapRouter(ctx);

        expect(mockQueryAll).toHaveBeenCalled();
        const [sql, params] = mockQueryAll.mock.calls[0];
        expect(sql).toContain('status = ?');
        expect(params).toContain('planned');
    });

    test('should filter features by category when category param is provided', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/',
            query: { category: 'automation' }
        });
        await roadmapRouter(ctx);

        expect(mockQueryAll).toHaveBeenCalled();
        const [sql, params] = mockQueryAll.mock.calls[0];
        expect(sql).toContain('category = ?');
        expect(params).toContain('automation');
    });

    test('should mark user_voted true for features the user has voted on', async () => {
        const fakeFeatures = [{ id: 'feat-1', title: 'Dark Mode', votes: 5, status: 'planned' }];
        mockQueryAll.mockReturnValue(fakeFeatures);
        // user has voted — query.get returns a vote record
        mockQueryGet.mockReturnValue({ id: 'vote-1' });

        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await roadmapRouter(ctx);

        expect(result.data.features[0].user_voted).toBe(true);
    });

    test('should mark user_voted false when user has not voted', async () => {
        const fakeFeatures = [{ id: 'feat-1', title: 'Dark Mode', votes: 5, status: 'planned' }];
        mockQueryAll.mockReturnValue(fakeFeatures);
        mockQueryGet.mockReturnValue(null);

        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await roadmapRouter(ctx);

        expect(result.data.features[0].user_voted).toBe(false);
    });

    test('should return 500 when database query throws', async () => {
        mockQueryAll.mockImplementation(() => { throw new Error('DB error'); });
        const ctx = makeCtx({ method: 'GET', path: '/' });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(500);
        expect(result.data).toHaveProperty('error');
    });
});

describe('roadmapRouter — GET /:id (single feature)', () => {
    beforeEach(() => {
        mockQueryGet.mockReset();
        mockQueryGet.mockReturnValue(null);
    });

    test('should return 404 when feature does not exist', async () => {
        mockQueryGet.mockReturnValue(null);
        // UUID-style path matching the /^\/[a-f0-9-]+$/ pattern in roadmap.js
        const ctx = makeCtx({ method: 'GET', path: '/abc123de-f012-3456-abcd-ef0123456789' });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(404);
        expect(result.data.error).toBeDefined();
    });

    test('should return 200 with feature when it exists', async () => {
        const featureId = 'abc123de-f012-3456-abcd-ef0123456789';
        const feature = { id: featureId, title: 'Dark Mode', votes: 10, status: 'planned' };
        // First call (feature lookup) returns feature, second (vote lookup) returns null
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return feature;
            return null;
        });

        const ctx = makeCtx({ method: 'GET', path: `/${featureId}` });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.feature.id).toBe(featureId);
    });
});

describe('roadmapRouter — POST / (create feature — admin only)', () => {
    beforeEach(() => {
        mockQueryRun.mockReset();
        mockQueryRun.mockReturnValue({ changes: 1 });
        mockQueryGet.mockReset();
        mockQueryGet.mockReturnValue(null);
    });

    test('should return 403 when non-admin user tries to create a feature', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/',
            user: mockUser,
            body: { title: 'New Feature' }
        });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(403);
        expect(result.data).toHaveProperty('error', 'Admin access required');
    });

    test('should return 403 when unauthenticated user tries to create a feature', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/',
            user: null,
            body: { title: 'New Feature' }
        });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(403);
    });

    test('should return 400 when title is missing', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/',
            user: mockAdmin,
            body: { description: 'No title provided' }
        });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data).toHaveProperty('error', 'Title is required');
    });

    test('should return 201 when admin creates a feature with valid data', async () => {
        const newFeature = { id: 'mock-feature-id', title: 'Dark Mode', status: 'planned', votes: 0 };
        mockQueryGet.mockReturnValue(newFeature);

        const ctx = makeCtx({
            method: 'POST',
            path: '/',
            user: mockAdmin,
            body: { title: 'Dark Mode', description: 'Adds dark theme', category: 'ui', status: 'planned' }
        });
        const result = await roadmapRouter(ctx);
        expect(result.status).toBe(201);
        expect(result.data).toHaveProperty('feature');
    });

    test('should call query.run with INSERT when creating a feature', async () => {
        mockQueryGet.mockReturnValue({ id: 'mock-feature-id', title: 'Dark Mode' });

        const ctx = makeCtx({
            method: 'POST',
            path: '/',
            user: mockAdmin,
            body: { title: 'Dark Mode' }
        });
        await roadmapRouter(ctx);

        expect(mockQueryRun).toHaveBeenCalled();
        const [sql] = mockQueryRun.mock.calls[0];
        expect(sql).toContain('INSERT INTO roadmap_features');
    });
});
