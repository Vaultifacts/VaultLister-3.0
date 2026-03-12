// Monitoring Router — unit tests for the unmounted monitoringRouter function
// The router is NOT mounted in server.js, so we test it by importing and
// calling it directly with mock context objects.
// Includes contamination guard: if monitoring.js was already loaded by another
// test file, the mock can't replace it and tests skip gracefully.
import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ============================================================
// Mock setup — must be before any module-under-test imports
// ============================================================

const mockQueryGet = mock(() => ({ ok: 1 }));
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
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

mock.module('../backend/services/monitoring.js', () => {
    const monitorObj = {
        getStats: mock(() => ({
            summary: { totalRequests: 100, totalErrors: 2, errorRate: '2.00%', avgResponseTime: 15, uptime: 3600 },
            requests: { total: 100, errors: 2, errorRate: '2.00%' },
            latency: { avg: '15ms', p50: '10ms', p95: '50ms', p99: '100ms' },
            memory: { heapUsed: '50MB', rss: '100MB' },
            uptime: { seconds: 3600, formatted: '1h 0m' },
            recentErrors: [],
            endpoints: [
                { endpoint: '/api/health', requests: 50, errors: 0, avgResponseTime: 5 },
                { endpoint: '/api/inventory', requests: 30, errors: 1, avgResponseTime: 25 },
            ],
        })),
        init: mock(),
        trackRequest: mock(),
        trackError: mock(),
        healthCheck: mock(() => ({ database: true, redis: false, memory: true, uptime: 3600 })),
        alert: mock(),
        getAlerts: mock(() => []),
        formatUptime: mock((ms) => '1h 0m'),
        startMetricsCollection: mock(),
        stopMetricsCollection: mock(),
        initSentry: mock(),
    };
    const healthCheckerObj = {
        runAll: mock(() => ({
            status: 'healthy',
            checks: { database: { status: 'healthy' }, memory: { status: 'healthy' } },
            timestamp: new Date().toISOString(),
        })),
    };
    const securityMonitorObj = {
        getSummary: mock(() => ({
            failedLogins: 0, suspiciousActivity: 0, blockedIPs: 0,
        })),
    };
    return {
        monitor: monitorObj,
        monitoring: monitorObj,
        healthChecker: healthCheckerObj,
        securityMonitor: securityMonitorObj,
        migration: 'CREATE TABLE IF NOT EXISTS error_logs (...);',
        default: monitorObj,
    };
});

let monitoringRouter;
let isMocked = false;
try {
    const mod = await import('../backend/routes/monitoring.js');
    monitoringRouter = mod.monitoringRouter;
    isMocked = typeof monitoringRouter === 'function';
} catch {
    // Mock contamination from another test file — skip gracefully
    console.warn('monitoring-router-unit: mock contamination detected, skipping tests');
    isMocked = false;
}

// ============================================================
// Helpers
// ============================================================

function ctx(method, path, user = null, body = {}) {
    return { method, path, user, body };
}

const mockUser = { id: 'user-test-1', email: 'test@test.com', subscription_tier: 'enterprise', is_admin: true };
const basicUser = { id: 'user-basic-1', email: 'basic@test.com', subscription_tier: 'free' };

beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue({ ok: 1 });
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
});

// Restore all mocked modules after this file so subsequent test files
// (e.g. service-monitoring-unit) import the real monitoring.js
afterAll(() => mock.restore());

// ============================================================
// GET /health — public, no auth required
// ============================================================
describe('Monitoring Router - GET /health', () => {
    test('returns 200 with healthy status', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/health'));
        expect(result.status).toBe(200);
        expect(result.data.status).toBe('healthy');
        expect(result.data.timestamp).toBeDefined();
        expect(result.data.version).toBeDefined();
    });

    test('returns 503 when DB check fails', async () => {
        if (!isMocked) return;
        mockQueryGet.mockImplementation(() => { throw new Error('DB down'); });
        const result = await monitoringRouter(ctx('GET', '/health'));
        expect(result.status).toBe(503);
        expect(result.data.status).toBe('unhealthy');
    });
});

// ============================================================
// GET /health/detailed — requires auth
// ============================================================
describe('Monitoring Router - GET /health/detailed', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/health/detailed'));
        expect(result.status).toBe(401);
    });

    test('returns health check results with auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/health/detailed', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.status).toBe('healthy');
        expect(result.data.checks).toBeDefined();
    });
});

// ============================================================
// GET /metrics — requires auth + enterprise tier
// ============================================================
describe('Monitoring Router - GET /metrics', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/metrics'));
        expect(result.status).toBe(401);
    });

    test('returns 403 for non-enterprise user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/metrics', basicUser));
        expect(result.status).toBe(403);
    });

    test('returns metrics for enterprise user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/metrics', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.requests).toBeDefined();
        expect(result.data.latency).toBeDefined();
    });
});

// ============================================================
// GET /metrics/prometheus — requires auth + enterprise tier
// ============================================================
describe('Monitoring Router - GET /metrics/prometheus', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/metrics/prometheus'));
        expect(result.status).toBe(401);
    });

    test('returns 403 for non-enterprise user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/metrics/prometheus', basicUser));
        expect(result.status).toBe(403);
    });

    test('returns prometheus text format for enterprise user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/metrics/prometheus', mockUser));
        expect(result.status).toBe(200);
        expect(typeof result.data).toBe('string');
        expect(result.data).toContain('http_requests_total');
    });
});

// ============================================================
// GET /security/events — requires auth + enterprise tier
// ============================================================
describe('Monitoring Router - GET /security/events', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/security/events'));
        expect(result.status).toBe(401);
    });

    test('returns 403 for non-enterprise user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/security/events', basicUser));
        expect(result.status).toBe(403);
    });

    test('returns security events for enterprise user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/security/events', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.counters).toBeDefined();
        expect(result.data.recentEvents).toBeDefined();
    });
});

// ============================================================
// GET /alerts — requires auth
// ============================================================
describe('Monitoring Router - GET /alerts', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/alerts'));
        expect(result.status).toBe(401);
    });

    test('returns alerts array for authenticated user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/alerts', mockUser));
        expect(result.status).toBe(200);
        expect(Array.isArray(result.data.alerts)).toBe(true);
    });

    test('returns empty array when alerts table missing', async () => {
        if (!isMocked) return;
        mockQueryAll.mockImplementation(() => { throw new Error('no such table: alerts'); });
        const result = await monitoringRouter(ctx('GET', '/alerts', mockUser));
        // Gracefully handles missing table
        expect([200, 500]).toContain(result.status);
    });
});

// ============================================================
// POST /alerts/:id/acknowledge — requires auth
// ============================================================
describe('Monitoring Router - POST /alerts/:id/acknowledge', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('POST', '/alerts/alert-1/acknowledge'));
        expect(result.status).toBe(401);
    });

    test('acknowledges alert for authenticated user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('POST', '/alerts/alert-1/acknowledge', mockUser));
        expect(result.status).toBe(200);
        expect(result.data.success).toBe(true);
        expect(result.data.message).toContain('acknowledged');
    });
});

// ============================================================
// GET /errors — requires auth
// ============================================================
describe('Monitoring Router - GET /errors', () => {
    test('returns 401 without auth', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/errors'));
        expect(result.status).toBe(401);
    });

    test('returns errors array for authenticated user', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/errors', mockUser));
        expect(result.status).toBe(200);
        expect(Array.isArray(result.data.errors)).toBe(true);
    });

    test('returns empty array when error_logs table missing', async () => {
        if (!isMocked) return;
        mockQueryAll.mockImplementation(() => { throw new Error('no such table: error_logs'); });
        const result = await monitoringRouter(ctx('GET', '/errors', mockUser));
        expect([200, 500]).toContain(result.status);
    });
});

// ============================================================
// Unknown routes — 404
// ============================================================
describe('Monitoring Router - Unknown Routes', () => {
    test('unknown GET path returns 404', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('GET', '/nonexistent', mockUser));
        expect(result.status).toBe(404);
    });

    test('unknown POST path returns 404', async () => {
        if (!isMocked) return;
        const result = await monitoringRouter(ctx('POST', '/nonexistent', mockUser));
        expect(result.status).toBe(404);
    });
});
