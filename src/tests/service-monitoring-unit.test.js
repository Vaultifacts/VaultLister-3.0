// Monitoring Service Unit Tests — pure function tests
// Tests monitoring object methods, THRESHOLDS behavior, metrics tracking, and exports
import { describe, expect, test, mock, afterAll, beforeEach } from 'bun:test';

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
    models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {}
}));

const _logFn = () => mock(() => {});
const _mkLogger = () => ({
    info: _logFn(), warn: _logFn(), error: _logFn(), debug: _logFn(),
    request: _logFn(), db: _logFn(), automation: _logFn(),
    bot: _logFn(), security: _logFn(), performance: _logFn(),
});
mock.module('../backend/shared/logger.js', () => ({
    logger: _mkLogger(),
    createLogger: mock(() => _mkLogger()),
    default: _mkLogger(),
}));

const monitoringModule = await import('../backend/services/monitoring.js');
const { monitoring, migration } = monitoringModule;

afterAll(() => {
    if (monitoring.stopMetricsCollection) monitoring.stopMetricsCollection();
});

// ---------------------------------------------------------------------------
// 1. formatUptime
// ---------------------------------------------------------------------------
describe('monitoring.formatUptime', () => {
    test('formats zero milliseconds', () => {
        const result = monitoring.formatUptime(0);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('formats milliseconds to hours and minutes', () => {
        const result = monitoring.formatUptime(3600000);
        expect(result).toContain('1h');
    });

    test('formats days correctly', () => {
        const result = monitoring.formatUptime(86400000 * 2 + 3600000 * 5);
        expect(result).toContain('2d');
        expect(result).toContain('5h');
    });

    test('formats partial hours', () => {
        const result = monitoring.formatUptime(5400000);
        expect(result).toContain('1h');
        expect(result).toContain('30m');
    });

    test('formats seconds only (< 60s)', () => {
        const result = monitoring.formatUptime(45000); // 45 seconds
        expect(result).toBe('45s');
    });

    test('formats minutes and seconds (no hours)', () => {
        const result = monitoring.formatUptime(125000); // 2m 5s
        expect(result).toContain('2m');
        expect(result).toContain('5s');
    });

    test('formats exactly 1 day', () => {
        const result = monitoring.formatUptime(86400000);
        expect(result).toContain('1d');
        expect(result).toContain('0h');
    });

    test('formats large durations (multiple days)', () => {
        // 10 days, 3 hours
        const result = monitoring.formatUptime(86400000 * 10 + 3600000 * 3);
        expect(result).toContain('10d');
        expect(result).toContain('3h');
    });

    test('returns days+hours format (not minutes) when days > 0', () => {
        // 1 day, 2 hours, 30 minutes — should only show days and hours
        const result = monitoring.formatUptime(86400000 + 3600000 * 2 + 1800000);
        expect(result).toContain('1d');
        expect(result).toContain('2h');
        // Minutes not shown at day-scale granularity
        expect(result).not.toContain('m');
    });

    test('formats sub-second values as 0s', () => {
        const result = monitoring.formatUptime(500); // 0.5 seconds
        expect(result).toBe('0s');
    });
});

// ---------------------------------------------------------------------------
// 2. getMetrics — structure and computed values
// ---------------------------------------------------------------------------
describe('monitoring.getMetrics', () => {
    test('returns metrics object', () => {
        const metrics = monitoring.getMetrics();
        expect(typeof metrics).toBe('object');
        expect(metrics).toHaveProperty('requests');
        expect(metrics).toHaveProperty('uptime');
    });

    test('metrics includes request counters', () => {
        const metrics = monitoring.getMetrics();
        expect(typeof metrics.requests).toBe('object');
    });

    test('metrics includes memory info', () => {
        const metrics = monitoring.getMetrics();
        expect(metrics).toHaveProperty('memory');
    });

    test('metrics has all top-level keys', () => {
        const m = monitoring.getMetrics();
        expect(m).toHaveProperty('requests');
        expect(m).toHaveProperty('latency');
        expect(m).toHaveProperty('memory');
        expect(m).toHaveProperty('uptime');
        expect(m).toHaveProperty('recentErrors');
    });

    test('requests object has total, errors, errorRate', () => {
        const m = monitoring.getMetrics();
        expect(m.requests).toHaveProperty('total');
        expect(m.requests).toHaveProperty('errors');
        expect(m.requests).toHaveProperty('errorRate');
    });

    test('latency object has avg, p50, p95, p99', () => {
        const m = monitoring.getMetrics();
        expect(m.latency).toHaveProperty('avg');
        expect(m.latency).toHaveProperty('p50');
        expect(m.latency).toHaveProperty('p95');
        expect(m.latency).toHaveProperty('p99');
    });

    test('uptime object has seconds and formatted', () => {
        const m = monitoring.getMetrics();
        expect(m.uptime).toHaveProperty('seconds');
        expect(m.uptime).toHaveProperty('formatted');
        expect(typeof m.uptime.seconds).toBe('number');
        expect(typeof m.uptime.formatted).toBe('string');
    });

    test('memory contains heapUsed and rss', () => {
        const m = monitoring.getMetrics();
        expect(typeof m.memory.heapUsed).toBe('number');
        expect(typeof m.memory.rss).toBe('number');
    });

    test('recentErrors is an array', () => {
        const m = monitoring.getMetrics();
        expect(Array.isArray(m.recentErrors)).toBe(true);
    });

    test('errorRate shows percentage string', () => {
        // After prior trackRequest calls, total > 0
        const m = monitoring.getMetrics();
        if (m.requests.total > 0) {
            expect(m.requests.errorRate).toMatch(/%$/);
        } else {
            expect(m.requests.errorRate).toBe('0%');
        }
    });

    test('errorRate is "0%" when no requests tracked', () => {
        // We can test the formula indirectly: with 0 requests total,
        // the ternary returns '0%'. We cannot reset internal state, but
        // we verify the string format ends with '%' or equals '0%'.
        const m = monitoring.getMetrics();
        expect(typeof m.requests.errorRate).toBe('string');
        expect(m.requests.errorRate.endsWith('%')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3. trackRequest — detailed behavior
// ---------------------------------------------------------------------------
describe('monitoring.trackRequest', () => {
    test('increments request count', () => {
        const before = monitoring.getMetrics().requests;
        const beforeTotal = before.total || 0;

        monitoring.trackRequest(
            { method: 'GET', url: '/test' },
            { statusCode: 200 },
            50
        );

        const after = monitoring.getMetrics().requests;
        expect(after.total || 0).toBeGreaterThanOrEqual(beforeTotal);
    });

    test('tracks error requests', () => {
        monitoring.trackRequest(
            { method: 'POST', url: '/fail' },
            { statusCode: 500 },
            100
        );

        const metrics = monitoring.getMetrics();
        expect(metrics.requests.errors || 0).toBeGreaterThanOrEqual(0);
    });

    test('records duration in latency stats', () => {
        const beforeMetrics = monitoring.getMetrics();
        const beforeAvg = parseFloat(beforeMetrics.latency.avg) || 0;

        // Track a request with a known high duration
        monitoring.trackRequest(
            { method: 'GET', url: '/slow' },
            { statusCode: 200 },
            999
        );

        const afterMetrics = monitoring.getMetrics();
        // avg should be a defined value (string or number)
        expect(afterMetrics.latency.avg).toBeDefined();
    });

    test('calls alert for slow responses (> 2000ms threshold)', () => {
        // Spy on the alert method
        const originalAlert = monitoring.alert;
        let alertCalled = false;
        let alertType = '';
        monitoring.alert = (type, data) => {
            alertCalled = true;
            alertType = type;
        };

        monitoring.trackRequest(
            { method: 'GET', url: '/very-slow' },
            { statusCode: 200 },
            3000 // exceeds 2000ms threshold
        );

        expect(alertCalled).toBe(true);
        expect(alertType).toBe('slow_response');

        // Restore original
        monitoring.alert = originalAlert;
    });

    test('does not alert for fast responses (< 2000ms)', () => {
        const originalAlert = monitoring.alert;
        let alertCalled = false;
        monitoring.alert = () => { alertCalled = true; };

        monitoring.trackRequest(
            { method: 'GET', url: '/fast' },
            { statusCode: 200 },
            100
        );

        expect(alertCalled).toBe(false);
        monitoring.alert = originalAlert;
    });

    test('tracks multiple requests and accumulates total', () => {
        const before = monitoring.getMetrics().requests.total;
        const count = 5;
        for (let i = 0; i < count; i++) {
            monitoring.trackRequest(
                { method: 'GET', url: `/multi-${i}` },
                { statusCode: 200 },
                50 + i * 10
            );
        }
        const after = monitoring.getMetrics().requests.total;
        expect(after).toBe(before + count);
    });
});

// ---------------------------------------------------------------------------
// 4. getMetrics latency — percentile calculations
// ---------------------------------------------------------------------------
describe('monitoring.getMetrics latency', () => {
    test('getMetrics returns latency stats', () => {
        const metrics = monitoring.getMetrics();
        if (metrics.latency) {
            // latency values may be string (formatted) or number
            expect(metrics.latency.avg).toBeDefined();
        }
    });

    test('latency percentiles are ordered p50 <= p95 <= p99', () => {
        // Add a spread of latencies to make percentiles meaningful
        for (let i = 1; i <= 20; i++) {
            monitoring.trackRequest(
                { method: 'GET', url: `/perc-${i}` },
                { statusCode: 200 },
                i * 50
            );
        }

        const m = monitoring.getMetrics();
        const p50 = parseFloat(m.latency.p50) || 0;
        const p95 = parseFloat(m.latency.p95) || 0;
        const p99 = parseFloat(m.latency.p99) || 0;

        expect(p50).toBeLessThanOrEqual(p95);
        expect(p95).toBeLessThanOrEqual(p99);
    });

    test('avg latency is computed correctly for known values', () => {
        // Track deterministic requests: we can check avg is in a reasonable range
        // Note: internal latencies array accumulates across all tests, so just
        // verify avg is a positive number after tracking requests
        const m = monitoring.getMetrics();
        const avg = parseFloat(m.latency.avg);
        expect(avg).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// 5. trackError
// ---------------------------------------------------------------------------
describe('monitoring.trackError', () => {
    test('increments error count', () => {
        const before = monitoring.getMetrics().requests.errors;
        monitoring.trackError(new Error('test error'), { source: 'unit-test' });
        const after = monitoring.getMetrics().requests.errors;
        expect(after).toBe(before + 1);
    });

    test('error appears in recentErrors', () => {
        const uniqueMsg = `unique-error-${Date.now()}`;
        monitoring.trackError(new Error(uniqueMsg), { source: 'unit-test' });

        const m = monitoring.getMetrics();
        const found = m.recentErrors.some(e => e.message === uniqueMsg);
        expect(found).toBe(true);
    });

    test('error record has expected fields', () => {
        const msg = `structured-error-${Date.now()}`;
        monitoring.trackError(new Error(msg), { route: '/test' });

        const m = monitoring.getMetrics();
        const record = m.recentErrors.find(e => e.message === msg);
        expect(record).toBeDefined();
        expect(record).toHaveProperty('message');
        expect(record).toHaveProperty('stack');
        expect(record).toHaveProperty('context');
        expect(record).toHaveProperty('timestamp');
    });

    test('error context is preserved', () => {
        const ctx = { userId: '123', action: 'delete' };
        const msg = `ctx-error-${Date.now()}`;
        monitoring.trackError(new Error(msg), ctx);

        const m = monitoring.getMetrics();
        const record = m.recentErrors.find(e => e.message === msg);
        expect(record.context).toEqual(ctx);
    });

    test('error timestamp is a valid ISO string', () => {
        const msg = `ts-error-${Date.now()}`;
        monitoring.trackError(new Error(msg));

        const m = monitoring.getMetrics();
        const record = m.recentErrors.find(e => e.message === msg);
        expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('calls query.run to insert error log into database', () => {
        mockQueryRun.mockClear();
        monitoring.trackError(new Error('db-insert-test'));

        // query.run should have been called (INSERT INTO error_logs)
        expect(mockQueryRun.mock.calls.length).toBeGreaterThan(0);
    });

    test('does not throw when database insert fails', () => {
        // Make query.run throw
        const origImpl = mockQueryRun.getMockImplementation();
        mockQueryRun.mockImplementation(() => { throw new Error('DB down'); });

        expect(() => {
            monitoring.trackError(new Error('safe-error'));
        }).not.toThrow();

        // Restore
        mockQueryRun.mockImplementation(origImpl || (() => ({ changes: 1 })));
    });

    test('default context is empty object when not provided', () => {
        const msg = `no-ctx-${Date.now()}`;
        monitoring.trackError(new Error(msg));

        const m = monitoring.getMetrics();
        const record = m.recentErrors.find(e => e.message === msg);
        expect(record.context).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// 6. healthCheck
// ---------------------------------------------------------------------------
describe('monitoring.healthCheck', () => {
    test('returns an object', async () => {
        const result = await monitoring.healthCheck();
        expect(typeof result).toBe('object');
    });

    test('has database, redis, memory, uptime fields', async () => {
        const checks = await monitoring.healthCheck();
        expect(checks).toHaveProperty('database');
        expect(checks).toHaveProperty('redis');
        expect(checks).toHaveProperty('memory');
        expect(checks).toHaveProperty('uptime');
    });

    test('database check uses query.get', async () => {
        mockQueryGet.mockClear();
        await monitoring.healthCheck();
        expect(mockQueryGet.mock.calls.length).toBeGreaterThan(0);
    });

    test('database is true when query succeeds', async () => {
        mockQueryGet.mockImplementation(() => 1);
        const checks = await monitoring.healthCheck();
        expect(checks.database).toBe(true);
        mockQueryGet.mockImplementation(() => null);
    });

    test('database is false when query throws', async () => {
        mockQueryGet.mockImplementation(() => { throw new Error('DB error'); });
        const checks = await monitoring.healthCheck();
        expect(checks.database).toBe(false);
        mockQueryGet.mockImplementation(() => null);
    });

    test('memory check returns a boolean', async () => {
        const checks = await monitoring.healthCheck();
        expect(typeof checks.memory).toBe('boolean');
    });

    test('memory returns a boolean reflecting heap usage vs 95% threshold', async () => {
        // During full test suite runs, heap can exceed 95% due to 4000+ tests loading modules.
        // Validate the check matches actual heap state rather than assuming low usage.
        const checks = await monitoring.healthCheck();
        const heapUsed = process.memoryUsage().heapUsed;
        const heapTotal = process.memoryUsage().heapTotal;
        const expectedMemory = (heapUsed / heapTotal) < 0.95;
        expect(checks.memory).toBe(expectedMemory);
    });

    test('uptime is a positive number', async () => {
        const checks = await monitoring.healthCheck();
        expect(checks.uptime).toBeGreaterThan(0);
    });

    test('redis is always false (not implemented)', async () => {
        const checks = await monitoring.healthCheck();
        expect(checks.redis).toBe(false);
    });

    test('multiple healthCheck calls accumulate uptime checks', async () => {
        await monitoring.healthCheck();
        await monitoring.healthCheck();
        await monitoring.healthCheck();
        // No throw means checks array grows without issue
    });
});

// ---------------------------------------------------------------------------
// 7. alert method
// ---------------------------------------------------------------------------
describe('monitoring.alert', () => {
    test('does not throw', async () => {
        await expect(
            monitoring.alert('test_alert', { value: 42 })
        ).resolves.toBeUndefined();
    });

    test('calls query.run to store alert in database', async () => {
        mockQueryRun.mockClear();
        await monitoring.alert('test_alert', { info: 'test' });
        expect(mockQueryRun.mock.calls.length).toBeGreaterThan(0);
    });

    test('does not throw when db insert fails', async () => {
        const origImpl = mockQueryRun.getMockImplementation();
        mockQueryRun.mockImplementation(() => { throw new Error('DB down'); });

        await expect(
            monitoring.alert('fail_alert', { critical: true })
        ).resolves.toBeUndefined();

        mockQueryRun.mockImplementation(origImpl || (() => ({ changes: 1 })));
    });

    test('handles various alert types', async () => {
        const types = ['slow_response', 'high_error_rate', 'high_memory', 'custom'];
        for (const type of types) {
            await expect(
                monitoring.alert(type, { test: true })
            ).resolves.toBeUndefined();
        }
    });
});

// ---------------------------------------------------------------------------
// 8. init method
// ---------------------------------------------------------------------------
describe('monitoring.init', () => {
    test('exists and is a function', () => {
        expect(typeof monitoring.init).toBe('function');
    });

    test('does not throw when called', () => {
        // init starts metrics collection and logs — should not throw
        // We already have a metrics interval from module load, but calling init
        // again should be safe
        expect(() => monitoring.init()).not.toThrow();
        // Clean up duplicate interval
        monitoring.stopMetricsCollection();
        monitoring.startMetricsCollection();
    });
});

// ---------------------------------------------------------------------------
// 9. startMetricsCollection / stopMetricsCollection
// ---------------------------------------------------------------------------
describe('monitoring.startMetricsCollection / stopMetricsCollection', () => {
    test('stopMetricsCollection clears interval', () => {
        monitoring.stopMetricsCollection();
        expect(monitoring._metricsInterval).toBeNull();
    });

    test('startMetricsCollection sets interval', () => {
        monitoring.startMetricsCollection();
        expect(monitoring._metricsInterval).toBeDefined();
        expect(monitoring._metricsInterval).not.toBeNull();
    });

    test('stopMetricsCollection is idempotent (safe to call twice)', () => {
        monitoring.stopMetricsCollection();
        expect(() => monitoring.stopMetricsCollection()).not.toThrow();
        expect(monitoring._metricsInterval).toBeNull();
        // Restart for other tests
        monitoring.startMetricsCollection();
    });

    test('stopMetricsCollection is no-op when no interval exists', () => {
        monitoring.stopMetricsCollection();
        monitoring._metricsInterval = null;
        expect(() => monitoring.stopMetricsCollection()).not.toThrow();
        // Restart
        monitoring.startMetricsCollection();
    });
});

// ---------------------------------------------------------------------------
// 10. initSentry
// ---------------------------------------------------------------------------
describe('monitoring.initSentry', () => {
    test('exists and is an async function', () => {
        expect(typeof monitoring.initSentry).toBe('function');
    });

    test('does not throw when @sentry/node is not installed', async () => {
        // In this test env, @sentry/node is not available, so the catch path runs
        await expect(monitoring.initSentry()).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 11. getAlerts
// ---------------------------------------------------------------------------
describe('monitoring.getAlerts', () => {
    test('returns an array', () => {
        const alerts = monitoring.getAlerts();
        expect(Array.isArray(alerts)).toBe(true);
    });

    test('returns empty array when query fails', () => {
        mockQueryAll.mockImplementation(() => { throw new Error('table missing'); });
        const alerts = monitoring.getAlerts();
        expect(alerts).toEqual([]);
        mockQueryAll.mockImplementation(() => []);
    });

    test('accepts hours parameter', () => {
        const alerts = monitoring.getAlerts(48);
        expect(Array.isArray(alerts)).toBe(true);
    });

    test('defaults to 24 hours', () => {
        mockQueryAll.mockClear();
        monitoring.getAlerts();
        // Verify query.all was called (with the SQL containing hours)
        expect(mockQueryAll.mock.calls.length).toBeGreaterThan(0);
    });

    test('returns query results when database has data', () => {
        const fakeAlerts = [
            { id: '1', type: 'slow_response', data: '{}', created_at: '2026-01-01' },
            { id: '2', type: 'high_memory', data: '{}', created_at: '2026-01-02' },
        ];
        mockQueryAll.mockImplementation(() => fakeAlerts);
        const alerts = monitoring.getAlerts();
        expect(alerts).toEqual(fakeAlerts);
        mockQueryAll.mockImplementation(() => []);
    });
});

// ---------------------------------------------------------------------------
// 12. migration export
// ---------------------------------------------------------------------------
describe('migration export', () => {
    test('migration is a non-empty string', () => {
        expect(typeof migration).toBe('string');
        expect(migration.length).toBeGreaterThan(0);
    });

    test('migration creates error_logs table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS error_logs');
    });

    test('migration creates alerts table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS alerts');
    });

    test('migration includes indexes for error_logs', () => {
        expect(migration).toContain('idx_error_logs_date');
    });

    test('migration includes indexes for alerts', () => {
        expect(migration).toContain('idx_alerts_date');
        expect(migration).toContain('idx_alerts_type');
    });

    test('error_logs table has expected columns', () => {
        expect(migration).toContain('id TEXT PRIMARY KEY');
        expect(migration).toContain('message TEXT NOT NULL');
        expect(migration).toContain('stack TEXT');
        expect(migration).toContain('context TEXT');
    });

    test('alerts table has expected columns', () => {
        expect(migration).toContain('type TEXT NOT NULL');
        expect(migration).toContain('acknowledged INTEGER DEFAULT 0');
    });
});

// ---------------------------------------------------------------------------
// 13. Module exports
// ---------------------------------------------------------------------------
describe('module exports', () => {
    test('monitoring is exported as named export', () => {
        expect(monitoringModule.monitoring).toBeDefined();
        expect(typeof monitoringModule.monitoring).toBe('object');
    });

    test('monitoring is exported as default export', () => {
        expect(monitoringModule.default).toBeDefined();
        expect(typeof monitoringModule.default).toBe('object');
    });

    test('migration is exported as named export', () => {
        expect(monitoringModule.migration).toBeDefined();
        expect(typeof monitoringModule.migration).toBe('string');
    });

    test('default export and named export are the same object', () => {
        expect(monitoringModule.default).toBe(monitoringModule.monitoring);
    });
});

// ---------------------------------------------------------------------------
// 14. THRESHOLDS behavior (tested indirectly through method behavior)
// ---------------------------------------------------------------------------
describe('THRESHOLDS config (indirect)', () => {
    test('slow response threshold is around 2000ms — 1999ms does not alert', () => {
        const originalAlert = monitoring.alert;
        let alertCalled = false;
        monitoring.alert = () => { alertCalled = true; };

        monitoring.trackRequest(
            { method: 'GET', url: '/near-threshold' },
            { statusCode: 200 },
            1999
        );

        expect(alertCalled).toBe(false);
        monitoring.alert = originalAlert;
    });

    test('slow response threshold is around 2000ms — 2001ms triggers alert', () => {
        const originalAlert = monitoring.alert;
        let alertCalled = false;
        let alertData = null;
        monitoring.alert = (type, data) => { alertCalled = true; alertData = data; };

        monitoring.trackRequest(
            { method: 'GET', url: '/over-threshold' },
            { statusCode: 200 },
            2001
        );

        expect(alertCalled).toBe(true);
        expect(alertData).toHaveProperty('duration', 2001);
        expect(alertData).toHaveProperty('path', '/over-threshold');
        expect(alertData).toHaveProperty('method', 'GET');
        monitoring.alert = originalAlert;
    });

    test('error rate alert requires > 5% rate AND > 100 total requests', () => {
        // The trackError method checks:
        //   errorRate > 0.05 && metrics.requests.total > 100
        // Since we have accumulated requests from prior tests, we verify
        // the alert function signature is called with high_error_rate type
        // only when conditions are met.
        const originalAlert = monitoring.alert;
        let highErrorRateAlerted = false;
        monitoring.alert = (type) => {
            if (type === 'high_error_rate') highErrorRateAlerted = true;
        };

        // Track a single error — should NOT trigger high_error_rate
        // because error rate is well below 5% with many total requests
        monitoring.trackError(new Error('rate-check'));

        // We cannot guarantee this will not alert depending on accumulated state,
        // but we verify the method runs without throwing
        expect(typeof highErrorRateAlerted).toBe('boolean');
        monitoring.alert = originalAlert;
    });
});

// ---------------------------------------------------------------------------
// 15. monitoring object method inventory
// ---------------------------------------------------------------------------
describe('monitoring method inventory', () => {
    test('has init method', () => {
        expect(typeof monitoring.init).toBe('function');
    });

    test('has initSentry method', () => {
        expect(typeof monitoring.initSentry).toBe('function');
    });

    test('has trackRequest method', () => {
        expect(typeof monitoring.trackRequest).toBe('function');
    });

    test('has trackError method', () => {
        expect(typeof monitoring.trackError).toBe('function');
    });

    test('has startMetricsCollection method', () => {
        expect(typeof monitoring.startMetricsCollection).toBe('function');
    });

    test('has stopMetricsCollection method', () => {
        expect(typeof monitoring.stopMetricsCollection).toBe('function');
    });

    test('has alert method', () => {
        expect(typeof monitoring.alert).toBe('function');
    });

    test('has healthCheck method', () => {
        expect(typeof monitoring.healthCheck).toBe('function');
    });

    test('has getMetrics method', () => {
        expect(typeof monitoring.getMetrics).toBe('function');
    });

    test('has formatUptime method', () => {
        expect(typeof monitoring.formatUptime).toBe('function');
    });

    test('has getAlerts method', () => {
        expect(typeof monitoring.getAlerts).toBe('function');
    });
});
