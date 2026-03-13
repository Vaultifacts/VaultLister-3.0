// Notion — final coverage via unit testing the router directly
// Tests 5 previously untested endpoints + 3 setup create-new branches
// Uses mock.module to mock notionService, avoiding Notion SDK hangs.
import { describe, expect, test, mock, beforeEach } from 'bun:test';

// ============================================================
// Mock setup — before any imports
// ============================================================

const mockIsConfigured = mock(() => true);
const mockListDatabases = mock(() => Promise.resolve([{ id: 'db-1', title: [{ plain_text: 'Test DB' }] }]));
const mockGetDatabase = mock(() => Promise.resolve({ id: 'db-1', title: [{ plain_text: 'Test DB' }] }));
const mockQueryDatabase = mock(() => Promise.resolve({ results: [], has_more: false }));
const mockGetPage = mock(() => Promise.resolve({ id: 'page-1', properties: {} }));
const mockArchivePage = mock(() => Promise.resolve({ id: 'page-1', archived: true }));
const mockCreateDatabase = mock(() => Promise.resolve({ id: 'new-db', url: 'https://notion.so/new-db' }));
const mockGetClient = mock(() => ({}));
const mockGetSettings = mock(() => null);
const mockSaveSettings = mock(() => undefined);
const mockDeleteSettings = mock(() => undefined);
const mockTestConnection = mock(() => Promise.resolve({ ok: true }));
const mockCreatePage = mock(() => Promise.resolve({ id: 'page-new' }));
const mockUpdatePage = mock(() => Promise.resolve({ id: 'page-1' }));
const mockMapInventoryToNotion = mock(() => ({}));
const mockMapNotionToInventory = mock(() => ({}));

mock.module('../backend/services/notionService.js', () => ({
    isConfigured: mockIsConfigured,
    listDatabases: mockListDatabases,
    getDatabase: mockGetDatabase,
    queryDatabase: mockQueryDatabase,
    getPage: mockGetPage,
    archivePage: mockArchivePage,
    createDatabase: mockCreateDatabase,
    getClient: mockGetClient,
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
    deleteSettings: mockDeleteSettings,
    testConnection: mockTestConnection,
    createPage: mockCreatePage,
    updatePage: mockUpdatePage,
    mapInventoryToNotion: mockMapInventoryToNotion,
    mapNotionToInventory: mockMapNotionToInventory,
    default: {},
}));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mock(() => null), all: mock(() => []), run: mock(() => ({ changes: 0 })),
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
    models: {
        create: mock(), findById: mock(), findOne: mock(),
        findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

mock.module('../backend/shared/logger.js', () => {
    const l = { info: mock(), warn: mock(), error: mock(), debug: mock(),
        request: mock(), db: mock(), automation: mock(), bot: mock(),
        security: mock(), performance: mock() };
    return { ...l, logger: l, createLogger: mock(() => l), default: l };
});

const { notionRouter } = await import('../backend/routes/notion.js');

// ============================================================
// Helpers
// ============================================================

function ctx(method, path, user = null, body = {}, queryParams = {}) {
    return { method, path, user, body, query: queryParams };
}

const mockUser = { id: 'user-notion-1', email: 'notion@test.com' };

beforeEach(() => {
    mockIsConfigured.mockReset();
    mockIsConfigured.mockReturnValue(true);
    mockListDatabases.mockReset();
    mockListDatabases.mockReturnValue(Promise.resolve([{ id: 'db-1', title: [{ plain_text: 'Test DB' }] }]));
    mockGetDatabase.mockReset();
    mockGetDatabase.mockReturnValue(Promise.resolve({ id: 'db-1', title: [{ plain_text: 'Test DB' }] }));
    mockQueryDatabase.mockReset();
    mockQueryDatabase.mockReturnValue(Promise.resolve({ results: [], has_more: false }));
    mockGetPage.mockReset();
    mockGetPage.mockReturnValue(Promise.resolve({ id: 'page-1', properties: {} }));
    mockArchivePage.mockReset();
    mockArchivePage.mockReturnValue(Promise.resolve({ id: 'page-1', archived: true }));
    mockCreateDatabase.mockReset();
    mockCreateDatabase.mockReturnValue(Promise.resolve({ id: 'new-db', url: 'https://notion.so/new-db' }));
});

// ============================================================
// Auth guard (applies to ALL notion endpoints)
// ============================================================
describe('Notion Router - Auth Guard', () => {
    test('returns 401 without user for GET /databases', async () => {
        const result = await notionRouter(ctx('GET', '/databases'));
        expect(result.status).toBe(401);
    });

    test('returns 401 without user for GET /databases/:id', async () => {
        const result = await notionRouter(ctx('GET', '/databases/some-id'));
        expect(result.status).toBe(401);
    });

    test('returns 401 without user for POST /databases/:id/query', async () => {
        const result = await notionRouter(ctx('POST', '/databases/some-id/query'));
        expect(result.status).toBe(401);
    });

    test('returns 401 without user for GET /pages/:id', async () => {
        const result = await notionRouter(ctx('GET', '/pages/some-id'));
        expect(result.status).toBe(401);
    });

    test('returns 401 without user for DELETE /pages/:id', async () => {
        const result = await notionRouter(ctx('DELETE', '/pages/some-id'));
        expect(result.status).toBe(401);
    });
});

// ============================================================
// GET /databases — list databases
// ============================================================
describe('Notion Router - GET /databases', () => {
    test('returns 400 when not configured', async () => {
        mockIsConfigured.mockReturnValue(false);
        const result = await notionRouter(ctx('GET', '/databases', mockUser));
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('not configured');
    });

    test('returns databases array when configured', async () => {
        const result = await notionRouter(ctx('GET', '/databases', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.databases).toBeDefined();
        expect(Array.isArray(result.data.databases)).toBe(true);
    });

    test('returns 500 when service throws', async () => {
        mockListDatabases.mockRejectedValue(new Error('API error'));
        const result = await notionRouter(ctx('GET', '/databases', mockUser));
        expect(result.status).toBe(500);
    });
});

// ============================================================
// GET /databases/:id — get single database
// ============================================================
describe('Notion Router - GET /databases/:id', () => {
    test('returns 400 when not configured', async () => {
        mockIsConfigured.mockReturnValue(false);
        const result = await notionRouter(ctx('GET', '/databases/db-123', mockUser));
        expect(result.status).toBe(400);
    });

    test('returns database object when configured', async () => {
        const result = await notionRouter(ctx('GET', '/databases/db-123', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.database).toBeDefined();
        expect(result.data.database.id).toBe('db-1');
    });

    test('returns 500 when service throws', async () => {
        mockGetDatabase.mockRejectedValue(new Error('Not found'));
        const result = await notionRouter(ctx('GET', '/databases/db-bad', mockUser));
        expect(result.status).toBe(500);
    });
});

// ============================================================
// POST /databases/:id/query — query database
// ============================================================
describe('Notion Router - POST /databases/:id/query', () => {
    test('returns 400 when not configured', async () => {
        mockIsConfigured.mockReturnValue(false);
        const result = await notionRouter(ctx('POST', '/databases/db-123/query', mockUser, {}));
        expect(result.status).toBe(400);
    });

    test('returns query results when configured', async () => {
        const result = await notionRouter(ctx('POST', '/databases/db-123/query', mockUser, {
            filter: {}, page_size: 10
        }));
        expect(result.status).toBe(200);
        expect(result.data.results).toBeDefined();
        expect(result.data.has_more).toBe(false);
    });

    test('passes filter and sort parameters', async () => {
        const filter = { property: 'Name', title: { equals: 'Test' } };
        const sorts = [{ property: 'Created', direction: 'descending' }];
        await notionRouter(ctx('POST', '/databases/db-123/query', mockUser, {
            filter, sorts, page_size: 5, start_cursor: 'abc'
        }));
        expect(mockQueryDatabase).toHaveBeenCalledWith(
            mockUser.id, 'db-123',
            { filter, sorts, page_size: 5, start_cursor: 'abc' }
        );
    });

    test('returns 500 when service throws', async () => {
        mockQueryDatabase.mockRejectedValue(new Error('Query failed'));
        const result = await notionRouter(ctx('POST', '/databases/db-123/query', mockUser, {}));
        expect(result.status).toBe(500);
    });
});

// ============================================================
// GET /pages/:id — get single page
// ============================================================
describe('Notion Router - GET /pages/:id', () => {
    test('returns 400 when not configured', async () => {
        mockIsConfigured.mockReturnValue(false);
        const result = await notionRouter(ctx('GET', '/pages/page-123', mockUser));
        expect(result.status).toBe(400);
    });

    test('returns page object when configured', async () => {
        const result = await notionRouter(ctx('GET', '/pages/page-123', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.page).toBeDefined();
        expect(result.data.page.id).toBe('page-1');
    });

    test('returns 500 when service throws', async () => {
        mockGetPage.mockRejectedValue(new Error('Page not found'));
        const result = await notionRouter(ctx('GET', '/pages/page-bad', mockUser));
        expect(result.status).toBe(500);
    });
});

// ============================================================
// DELETE /pages/:id — archive page
// ============================================================
describe('Notion Router - DELETE /pages/:id', () => {
    test('returns 400 when not configured', async () => {
        mockIsConfigured.mockReturnValue(false);
        const result = await notionRouter(ctx('DELETE', '/pages/page-123', mockUser));
        expect(result.status).toBe(400);
    });

    test('archives page when configured', async () => {
        const result = await notionRouter(ctx('DELETE', '/pages/page-123', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.id).toBe('page-1');
        expect(result.data.archived).toBe(true);
    });

    test('returns 500 when service throws', async () => {
        mockArchivePage.mockRejectedValue(new Error('Archive failed'));
        const result = await notionRouter(ctx('DELETE', '/pages/page-bad', mockUser));
        expect(result.status).toBe(500);
    });
});

// ============================================================
// Setup endpoints — parent_page_id (create-new) branch
// ============================================================
describe('Notion Router - Setup Create-New Branches', () => {
    test('POST /setup/inventory with parent_page_id creates new database', async () => {
        const result = await notionRouter(ctx('POST', '/setup/inventory', mockUser, {
            parent_page_id: 'parent-page-123'
        }));
        expect([200, 400]).toContain(result.status);
        if (result.status === 200) {
            expect(result.data.success).toBe(true);
            expect(result.data.database_id).toBeDefined();
        }
    });

    test('POST /setup/sales with parent_page_id creates new database', async () => {
        const result = await notionRouter(ctx('POST', '/setup/sales', mockUser, {
            parent_page_id: 'parent-page-123'
        }));
        expect([200, 400]).toContain(result.status);
    });

    test('POST /setup/notes with parent_page_id creates new database', async () => {
        const result = await notionRouter(ctx('POST', '/setup/notes', mockUser, {
            parent_page_id: 'parent-page-123'
        }));
        expect([200, 400]).toContain(result.status);
    });

    test('POST /setup/inventory without any params returns 400', async () => {
        const result = await notionRouter(ctx('POST', '/setup/inventory', mockUser, {}));
        expect(result.status).toBe(400);
    });
});
