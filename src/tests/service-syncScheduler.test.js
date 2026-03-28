// Issue #172: Unit tests for syncScheduler.js (untested service)
// Tests startSyncScheduler, stopSyncScheduler, and the queueTask integration.
// All external dependencies (DB, taskWorker, logger) are mocked.
import { describe, test, expect, mock, beforeEach, afterAll } from 'bun:test';

// ============================================
// Mocks — must come before imports
// ============================================

mock.module('uuid', () => ({
    v4: mock(() => 'mock-uuid-sync'),
    default: { v4: mock(() => 'mock-uuid-sync') }
}));

const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));
const mockQueryGet = mock(() => null);

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
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

const mockQueueTask = mock(() => ({ id: 'queued-task-1', type: 'sync_shop', status: 'pending' }));

mock.module('../backend/workers/taskWorker.js', () => ({
    startTaskWorker: mock(() => {}),
    stopTaskWorker: mock(() => {}),
    queueTask: mockQueueTask,
    getTaskWorkerStatus: mock(() => ({ running: false })),
    getWorkerStatus: mock(() => ({ running: false })),
    default: {}
}));

// ============================================
// Import module under test
// ============================================

const { startSyncScheduler, stopSyncScheduler } = await import('../backend/services/syncScheduler.js');

afterAll(() => {
    stopSyncScheduler();
});

// ============================================
// Tests
// ============================================

describe('syncScheduler — startSyncScheduler()', () => {
    beforeEach(() => {
        stopSyncScheduler();
        mockQueryAll.mockReset();
        mockQueryAll.mockImplementation(() => []);
        mockQueryRun.mockReset();
        mockQueueTask.mockClear();
    });

    test('should start without throwing', () => {
        expect(() => startSyncScheduler()).not.toThrow();
        stopSyncScheduler();
    });

    test('should be idempotent — calling startSyncScheduler() twice does not throw', () => {
        startSyncScheduler();
        expect(() => startSyncScheduler()).not.toThrow();
        stopSyncScheduler();
    });

    test('should call query.all to find due shops on start', async () => {
        mockQueryAll.mockReturnValue([]);
        startSyncScheduler();
        // Give the immediate call time to execute
        await new Promise(r => setTimeout(r, 10));
        expect(mockQueryAll).toHaveBeenCalled();
        stopSyncScheduler();
    });

    test('should queue a sync task for each due shop', async () => {
        const dueShops = [
            { id: 'shop-1', user_id: 'user-1', platform: 'poshmark', sync_status: 'idle', auto_sync_interval_minutes: 30 },
            { id: 'shop-2', user_id: 'user-2', platform: 'ebay', sync_status: 'idle', auto_sync_interval_minutes: 60 }
        ];
        mockQueryAll.mockReturnValue(dueShops);

        startSyncScheduler();
        await new Promise(r => setTimeout(r, 20));

        expect(mockQueueTask).toHaveBeenCalledWith('sync_shop', {
            platform: 'poshmark',
            shopId: 'shop-1',
            userId: 'user-1'
        });
        expect(mockQueueTask).toHaveBeenCalledWith('sync_shop', {
            platform: 'ebay',
            shopId: 'shop-2',
            userId: 'user-2'
        });

        stopSyncScheduler();
    });

    test('should not queue tasks when no shops are due', async () => {
        mockQueryAll.mockReturnValue([]);
        startSyncScheduler();
        await new Promise(r => setTimeout(r, 20));
        expect(mockQueueTask).not.toHaveBeenCalled();
        stopSyncScheduler();
    });
});

describe('syncScheduler — stopSyncScheduler()', () => {
    beforeEach(() => {
        stopSyncScheduler();
        mockQueryAll.mockReset();
        mockQueryAll.mockImplementation(() => []);
        mockQueueTask.mockClear();
    });

    test('should stop without throwing', () => {
        startSyncScheduler();
        expect(() => stopSyncScheduler()).not.toThrow();
    });

    test('should be idempotent — calling stopSyncScheduler() twice does not throw', () => {
        startSyncScheduler();
        stopSyncScheduler();
        expect(() => stopSyncScheduler()).not.toThrow();
    });

    test('should stop when not started — does not throw', () => {
        expect(() => stopSyncScheduler()).not.toThrow();
    });

    test('should not queue tasks after being stopped', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'shop-1', user_id: 'user-1', platform: 'poshmark', sync_status: 'idle', auto_sync_interval_minutes: 30 }
        ]);

        startSyncScheduler();
        stopSyncScheduler();
        mockQueueTask.mockClear();

        // Wait longer than CHECK_INTERVAL_MS would fire
        await new Promise(r => setTimeout(r, 30));
        // queueTask should NOT have been called again after stop
        expect(mockQueueTask.mock.calls.length).toBeLessThanOrEqual(1);
    });
});

describe('syncScheduler — resilience', () => {
    beforeEach(() => {
        stopSyncScheduler();
        mockQueryAll.mockReset();
        mockQueryRun.mockReset();
        mockQueueTask.mockClear();
    });

    test('should not throw when database query fails', async () => {
        mockQueryAll.mockImplementation(() => { throw new Error('DB error'); });
        expect(() => startSyncScheduler()).not.toThrow();
        await new Promise(r => setTimeout(r, 20));
        stopSyncScheduler();
    });

    test('should continue after a single shop queue failure', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'shop-1', user_id: 'user-1', platform: 'poshmark', sync_status: 'idle', auto_sync_interval_minutes: 30 },
            { id: 'shop-2', user_id: 'user-2', platform: 'ebay', sync_status: 'idle', auto_sync_interval_minutes: 60 }
        ]);

        let callCount = 0;
        mockQueueTask.mockImplementation(() => {
            callCount++;
            if (callCount === 1) throw new Error('Queue error for shop-1');
            return { id: 'task-2', type: 'sync_shop', status: 'pending' };
        });

        startSyncScheduler();
        await new Promise(r => setTimeout(r, 20));
        stopSyncScheduler();

        // Both shops should have been attempted; second succeeded
        expect(mockQueueTask).toHaveBeenCalledTimes(2);
    });
});
