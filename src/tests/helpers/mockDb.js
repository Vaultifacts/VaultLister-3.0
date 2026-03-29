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
    const mockGet = mock(() => Promise.resolve(null));
    const mockAll = mock(() => Promise.resolve([]));
    const mockRun = mock(() => Promise.resolve({ changes: 1, lastInsertRowid: 1 }));
    const mockExec = mock(() => Promise.resolve(undefined));
    const mockTransaction = mock((fn) => fn({
        get: mock(() => Promise.resolve(null)),
        all: mock(() => Promise.resolve([])),
        run: mock(() => Promise.resolve({ changes: 1, lastInsertRowid: 1 })),
        exec: mock(() => Promise.resolve(undefined)),
    }));
    const mockSearchInventory = mock(() => Promise.resolve([]));

    const query = {
        get: mockGet,
        all: mockAll,
        run: mockRun,
        exec: mockExec,
        transaction: mockTransaction,
        searchInventory: mockSearchInventory,
    };

    const models = {
        create: mock(() => Promise.resolve({ changes: 1, lastInsertRowid: 1 })),
        findById: mock(() => Promise.resolve(null)),
        findOne: mock(() => Promise.resolve(null)),
        findMany: mock(() => Promise.resolve([])),
        update: mock(() => Promise.resolve({ changes: 1 })),
        delete: mock(() => Promise.resolve({ changes: 1 })),
        count: mock(() => Promise.resolve(0)),
    };

    const db = {
        close: mock(() => Promise.resolve()),
        exec: mock(() => Promise.resolve()),
        query: mock(() => ({
            get: mock(() => Promise.resolve(null)),
            all: mock(() => Promise.resolve([])),
            run: mock(() => Promise.resolve({})),
        })),
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
        // Reset return values to async defaults
        mockGet.mockImplementation(() => Promise.resolve(null));
        mockAll.mockImplementation(() => Promise.resolve([]));
        mockRun.mockImplementation(() => Promise.resolve({ changes: 1, lastInsertRowid: 1 }));
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
        initializeDatabase: mock(() => Promise.resolve(true)),
        cleanupExpiredData: mock(() => Promise.resolve({})),
    }));

    // Also mock the relative path that services use
    mock.module('../../src/backend/db/database.js', () => ({
        query: mockDb.query,
        models: mockDb.models,
        escapeLike: mockDb.escapeLike,
        default: mockDb.db,
        initializeDatabase: mock(() => Promise.resolve(true)),
        cleanupExpiredData: mock(() => Promise.resolve({})),
    }));
}
