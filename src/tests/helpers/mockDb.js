// Mock Database Helper
// Provides a factory for mock query/models objects compatible with bun:mock
// Usage:
//   import { createMockDb, installDbMock } from './helpers/mockDb.js';
//   const db = createMockDb();
//   installDbMock(db);
//   const { someFunction } = await import('../backend/services/someService.js');

import { mock } from 'bun:test';

/**
 * Create a fresh set of mock database functions.
 * Each call returns independent mocks — safe for parallel test files.
 */
export function createMockDb() {
    const mockGet = mock(() => null);
    const mockAll = mock(() => []);
    const mockRun = mock(() => ({ changes: 1, lastInsertRowid: 1 }));
    const mockExec = mock(() => undefined);
    const mockTransaction = mock((fn) => fn());
    const mockSearchInventory = mock(() => []);

    const query = {
        get: mockGet,
        all: mockAll,
        run: mockRun,
        exec: mockExec,
        transaction: mockTransaction,
        searchInventory: mockSearchInventory,
    };

    const models = {
        create: mock(() => ({ changes: 1, lastInsertRowid: 1 })),
        findById: mock(() => null),
        findOne: mock(() => null),
        findMany: mock(() => []),
        update: mock(() => ({ changes: 1 })),
        delete: mock(() => ({ changes: 1 })),
        count: mock(() => 0),
    };

    const db = {
        close: mock(() => {}),
        exec: mock(() => {}),
        query: mock(() => ({ get: mock(() => null), all: mock(() => []), run: mock(() => {}) })),
    };

    function escapeLike(str) {
        return String(str).replace(/[%_\\]/g, '\\$&');
    }

    function reset() {
        mockGet.mockClear();
        mockAll.mockClear();
        mockRun.mockClear();
        mockExec.mockClear();
        mockTransaction.mockClear();
        mockSearchInventory.mockClear();
        Object.values(models).forEach(fn => fn.mockClear());
        // Reset return values to defaults
        mockGet.mockReturnValue(null);
        mockAll.mockReturnValue([]);
        mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    }

    return { query, models, db, escapeLike, reset };
}

/**
 * Install a mock.module() override for the database module.
 * MUST be called before importing the module under test.
 */
export function installDbMock(mockDb) {
    mock.module('../backend/db/database.js', () => ({
        query: mockDb.query,
        models: mockDb.models,
        escapeLike: mockDb.escapeLike,
        default: mockDb.db,
        initializeDatabase: mock(() => true),
        cleanupExpiredData: mock(() => ({})),
    }));

    // Also mock the relative path that services use
    mock.module('../../src/backend/db/database.js', () => ({
        query: mockDb.query,
        models: mockDb.models,
        escapeLike: mockDb.escapeLike,
        default: mockDb.db,
        initializeDatabase: mock(() => true),
        cleanupExpiredData: mock(() => ({})),
    }));
}
