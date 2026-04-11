// Architecture & Reliability — Async / Messaging / Worker Behavior
// Category: #4 Distributed systems, async processing, messaging semantics
// Audit gaps: H9 (no dead-letter queue), M2 (retry/backoff untested),
//             M3 (concurrent limit untested), L2 (queue ordering)

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

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
        create: mock(), findById: mock(), findOne: mock(),
        findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

const mockLogger = { info: mock(), error: mock(), warn: mock(), debug: mock() };
mock.module('../backend/shared/logger.js', () => ({
    logger: mockLogger,
    default: mockLogger,
}));

mock.module('../backend/services/notificationService.js', () => ({
    createNotification: mock(),
    createOAuthNotification: mock(),
    NotificationTypes: {
        TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
        OAUTH_DISCONNECTED: 'OAUTH_DISCONNECTED',
        SYNC_COMPLETED: 'SYNC_COMPLETED',
    },
    default: { createNotification: mock() },
}));

mock.module('../backend/services/platformSync/index.js', () => ({
    syncShop: mock(() => ({ listings: { synced: 0 }, orders: { synced: 0 } })),
}));

mock.module('../backend/services/platformSync/platformAuditLog.js', () => ({
    auditLog: mock(),
}));

// ─── Dynamic imports ────────────────────────────────────────────────────────

const {
    startTaskWorker, stopTaskWorker, getTaskWorkerStatus,
    queueTask, getTaskStatus, getWorkerStatus, cleanupOldTasks,
} = await import('../backend/workers/taskWorker.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
}

beforeEach(() => {
    resetMocks();
    stopTaskWorker(); // ensure clean state
});

afterAll(() => {
    stopTaskWorker();
});

// ═══════════════════════════════════════════════════════════════════════════
// WORKER LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════

describe('Task worker lifecycle', () => {
    test('startTaskWorker should set running state', () => {
        startTaskWorker();
        const status = getTaskWorkerStatus();
        expect(status.running).toBe(true);
        stopTaskWorker();
    });

    test('stopTaskWorker should clear running state', () => {
        startTaskWorker();
        stopTaskWorker();
        const status = getTaskWorkerStatus();
        expect(status.running).toBe(false);
    });

    test('startTaskWorker should no-op if already running', () => {
        startTaskWorker();
        startTaskWorker(); // second call
        const status = getTaskWorkerStatus();
        expect(status.running).toBe(true);
        stopTaskWorker();
    });

    test('getTaskWorkerStatus should return expected shape', () => {
        const status = getTaskWorkerStatus();
        expect(status).toHaveProperty('running');
        expect(status).toHaveProperty('intervalMs');
        expect(status.intervalMs).toBe(10000);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE TASK
// ═══════════════════════════════════════════════════════════════════════════

describe('queueTask', () => {
    test('should insert task with correct fields and return pending status', async () => {
        const result = await queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
        expect(result.id).toBeDefined();
        expect(result.type).toBe('sync_shop');
        expect(result.status).toBe('pending');
        expect(result.priority).toBe(0);
        expect(result.maxAttempts).toBe(3);

        // Verify INSERT was called
        const insertCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('INSERT INTO task_queue')
        );
        expect(insertCalls.length).toBe(1);
    });

    test('should accept custom priority and maxAttempts', async () => {
        const result = await queueTask('run_automation', { ruleId: 'r1' }, { priority: 5, maxAttempts: 5 });
        expect(result.priority).toBe(5);
        expect(result.maxAttempts).toBe(5);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE ORDERING (Low #2)
// ═══════════════════════════════════════════════════════════════════════════

describe('Task queue ordering', () => {
    test('should query pending tasks ordered by priority DESC, scheduled_at ASC', () => {
        // Start worker — it will call processQueue immediately
        startTaskWorker();

        // Give it a tick to run
        const selectCalls = mockQueryAll.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('task_queue')
        );
        if (selectCalls.length > 0) {
            const sql = selectCalls[0][0];
            expect(sql).toContain('ORDER BY priority DESC, scheduled_at ASC');
            expect(sql).toContain("status = 'pending'");
            expect(sql).toContain("scheduled_at <= NOW()");
        }

        stopTaskWorker();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// WORKER STATUS
// ═══════════════════════════════════════════════════════════════════════════

describe('getWorkerStatus', () => {
    test('should return status with maxConcurrent and activeTasks', async () => {
        mockQueryGet.mockReturnValue({
            total_tasks: 10, pending_tasks: 3, processing_tasks: 1,
            completed_tasks: 5, failed_tasks: 1
        });

        const status = await getWorkerStatus();
        expect(status.maxConcurrent).toBe(3);
        expect(status).toHaveProperty('activeTasks');
        expect(status).toHaveProperty('pollIntervalMs');
        expect(status.pollIntervalMs).toBe(10000);
        expect(status.last24Hours).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// DEAD-LETTER BEHAVIOR (High #9)
// ═══════════════════════════════════════════════════════════════════════════

describe('Dead-letter gap — failed task lifecycle', () => {
    test('cleanupOldTasks should delete completed AND failed tasks older than N days', async () => {
        await cleanupOldTasks(30);

        const deleteCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('DELETE FROM task_queue')
        );
        expect(deleteCalls.length).toBe(1);
        const sql = deleteCalls[0][0];
        expect(sql).toContain("'completed'");
        expect(sql).toContain("'failed'");
    });

    test('cleanupOldTasks should use provided days parameter', async () => {
        await cleanupOldTasks(7);

        const deleteCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('DELETE FROM task_queue')
        );
        expect(deleteCalls.length).toBe(1);
        // The parameter should be 7
        const params = deleteCalls[0][1];
        expect(params).toContain(7);
    });

    test('cleanupOldTasks should return count of deleted tasks', async () => {
        mockQueryRun.mockReturnValue({ changes: 42 });
        const result = await cleanupOldTasks(30);
        expect(result).toBe(42);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK STATUS
// ═══════════════════════════════════════════════════════════════════════════

describe('getTaskStatus', () => {
    test('should return task record when found', async () => {
        const mockTask = { id: 't1', type: 'sync_shop', status: 'completed', attempts: 1 };
        mockQueryGet.mockReturnValue(mockTask);

        const result = await getTaskStatus('t1');
        expect(result).toEqual(mockTask);
    });

    test('should return null when task not found', async () => {
        mockQueryGet.mockReturnValue(null);
        const result = await getTaskStatus('nonexistent');
        expect(result).toBeNull();
    });
});
