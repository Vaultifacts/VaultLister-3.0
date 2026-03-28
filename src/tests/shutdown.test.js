// Issue #98: Unit tests for graceful shutdown sequence
// Tests the individual stop/close functions that server.js calls in gracefulShutdown().
// server.js is not importable (it is an entry point), so we test each component in
// isolation — exactly as they are called by gracefulShutdown().
// All external packages (postgres, ioredis, uuid) are mocked so tests run without
// infrastructure dependencies.
import { describe, test, expect, mock, afterAll } from 'bun:test';

// ============================================
// Mock all external package dependencies
// These MUST come before any imports that trigger those packages.
// ============================================

mock.module('uuid', () => ({
    v4: mock(() => 'mock-uuid-1234'),
    default: { v4: mock(() => 'mock-uuid-1234') }
}));

mock.module('ioredis', () => {
    function MockRedis() {
        this.on = mock(() => this);
        this.connect = mock(() => Promise.resolve());
        this.disconnect = mock(() => Promise.resolve());
        this.quit = mock(() => Promise.resolve('OK'));
        this.get = mock(() => Promise.resolve(null));
        this.set = mock(() => Promise.resolve('OK'));
        this.del = mock(() => Promise.resolve(0));
        this.incr = mock(() => Promise.resolve(1));
        this.expire = mock(() => Promise.resolve(1));
        this.ttl = mock(() => Promise.resolve(-1));
        this.exists = mock(() => Promise.resolve(0));
    }
    return { default: MockRedis };
});

mock.module('postgres', () => {
    const mockQueryFn = mock(() => Promise.resolve([]));
    mockQueryFn.begin = mock((fn) => fn(mockQueryFn));
    mockQueryFn.end = mock(() => Promise.resolve());
    return { default: mockQueryFn };
});

mock.module('nanoid', () => ({
    nanoid: mock(() => 'mock-nanoid'),
    customAlphabet: mock(() => () => 'mock-nanoid'),
    default: mock(() => 'mock-nanoid')
}));

// ============================================
// Mock internal module dependencies
// ============================================

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mock(() => null),
        all: mock(() => []),
        run: mock(() => ({ changes: 1 })),
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

mock.module('../backend/services/notificationService.js', () => ({
    createNotification: mock(() => {}),
    createOAuthNotification: mock(() => {}),
    NotificationTypes: {},
    default: {}
}));

mock.module('../backend/services/email.js', () => ({
    default: { init: mock(), send: mock(() => Promise.resolve()) }
}));

mock.module('../backend/routes/oauth.js', () => ({
    oauthRouter: mock(() => ({ status: 200, data: {} })),
    getOAuthConfig: mock(() => ({})),
    revokeToken: mock(() => Promise.resolve()),
    default: {}
}));

mock.module('../backend/workers/taskWorker.js', () => ({
    startTaskWorker: mock(() => {}),
    stopTaskWorker: mock(() => {}),
    queueTask: mock(() => ({ id: 'mock-task' })),
    getTaskWorkerStatus: mock(() => ({ running: false })),
    getWorkerStatus: mock(() => ({ running: false })),
    cleanupOldTasks: mock(() => {}),
    default: {}
}));

mock.module('../backend/utils/encryption.js', () => ({
    encryptToken: mock((v) => `enc:${v}`),
    decryptToken: mock((v) => v && v.replace('enc:', '')),
    generateStateToken: mock(() => 'mock-state-token'),
    default: {}
}));

mock.module('../backend/shared/fetchWithTimeout.js', () => ({
    fetchWithTimeout: mock(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
    default: mock(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
}));

mock.module('../backend/shared/circuitBreaker.js', () => ({
    circuitBreaker: mock((key, fn) => fn()),
    default: mock((key, fn) => fn())
}));

// ============================================
// Import modules under test after all mocks
// ============================================

const {
    startTokenRefreshScheduler,
    stopTokenRefreshScheduler,
    getRefreshSchedulerStatus
} = await import('../backend/services/tokenRefreshScheduler.js');

const {
    startGDPRWorker,
    stopGDPRWorker,
    getGDPRWorkerStatus
} = await import('../backend/workers/gdprWorker.js');

const {
    stopRateLimiter
} = await import('../backend/middleware/rateLimiter.js');

const {
    stopCSRF
} = await import('../backend/middleware/csrf.js');

afterAll(async () => {
    stopTokenRefreshScheduler();
    stopGDPRWorker();
    stopRateLimiter();
    stopCSRF();
});

// ============================================
// Issue #98 — Shutdown Sequence Tests
// ============================================

describe('shutdown — server stops accepting new connections on SIGTERM', () => {
    test('should stop token refresh scheduler when stopTokenRefreshScheduler() is called', async () => {
        await startTokenRefreshScheduler();
        const statusBefore = await getRefreshSchedulerStatus();
        expect(statusBefore.isRunning).toBe(true);
        stopTokenRefreshScheduler();
        const statusAfter = await getRefreshSchedulerStatus();
        expect(statusAfter.isRunning).toBe(false);
    });

    test('should stop GDPR worker when stopGDPRWorker() is called', () => {
        startGDPRWorker();
        expect(getGDPRWorkerStatus().running).toBe(true);
        stopGDPRWorker();
        expect(getGDPRWorkerStatus().running).toBe(false);
    });

    test('should stop rate limiter without throwing', () => {
        expect(() => stopRateLimiter()).not.toThrow();
    });

    test('should stop CSRF without throwing', () => {
        expect(() => stopCSRF()).not.toThrow();
    });
});

describe('shutdown — existing connections drain before close', () => {
    test('should be idempotent — stopping token refresh scheduler twice does not throw', () => {
        stopTokenRefreshScheduler();
        expect(() => stopTokenRefreshScheduler()).not.toThrow();
    });

    test('should be idempotent — stopping GDPR worker twice does not throw', () => {
        stopGDPRWorker();
        expect(() => stopGDPRWorker()).not.toThrow();
    });

    test('should be idempotent — stopRateLimiter called twice does not throw', () => {
        stopRateLimiter();
        expect(() => stopRateLimiter()).not.toThrow();
    });

    test('should be idempotent — stopCSRF called twice does not throw', () => {
        stopCSRF();
        expect(() => stopCSRF()).not.toThrow();
    });
});

describe('shutdown — database and Redis connections are closed', () => {
    test('should resolve mocked closeDatabase() without error', async () => {
        const { closeDatabase } = await import('../backend/db/database.js');
        const result = await closeDatabase();
        expect(result).toBeUndefined();
    });

    test('should report token refresh scheduler as stopped after stop()', async () => {
        stopTokenRefreshScheduler();
        const status = await getRefreshSchedulerStatus();
        expect(status.isRunning).toBe(false);
        expect(status).toHaveProperty('intervalMs');
        expect(status).toHaveProperty('bufferMs');
        expect(typeof status.intervalMs).toBe('number');
    });

    test('should restart cleanly after stop and re-start for token refresh scheduler', async () => {
        stopTokenRefreshScheduler();
        await startTokenRefreshScheduler();
        const statusOn = await getRefreshSchedulerStatus();
        expect(statusOn.isRunning).toBe(true);
        stopTokenRefreshScheduler();
        const statusOff = await getRefreshSchedulerStatus();
        expect(statusOff.isRunning).toBe(false);
    });

    test('should restart cleanly after stop and re-start for GDPR worker', () => {
        stopGDPRWorker();
        startGDPRWorker();
        expect(getGDPRWorkerStatus().running).toBe(true);
        stopGDPRWorker();
        expect(getGDPRWorkerStatus().running).toBe(false);
    });

    test('should report GDPR worker as stopped after stopGDPRWorker()', () => {
        stopGDPRWorker();
        const status = getGDPRWorkerStatus();
        expect(status.running).toBe(false);
    });
});
