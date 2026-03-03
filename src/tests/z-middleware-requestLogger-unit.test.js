// Request Logger Middleware Unit Tests
import { describe, expect, test, mock, beforeEach } from 'bun:test';

const mockPrepare = mock(() => ({
    run: mock(),
    get: mock(() => null),
    all: mock(() => [])
}));
const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mockPrepare,
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
    models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {}
}));

// Mock logger with ALL methods to prevent cross-file mock contamination
const _logFn = () => mock(() => {});
const _mkLogger = () => ({
    info: _logFn(), warn: _logFn(), error: _logFn(), debug: _logFn(),
    request: _logFn(), db: _logFn(), automation: _logFn(),
    bot: _logFn(), security: _logFn(), performance: _logFn(),
});
const mockLoggerInstance = _mkLogger();
mock.module('../backend/shared/logger.js', () => ({
    logger: mockLoggerInstance,
    createLogger: mock(() => _mkLogger()),
    default: _mkLogger(),
}));

const mockNow = mock(() => '2026-03-01T00:00:00Z');
const mockGenerateId = mock(() => 'test-req-id-123');
const mockLogInfo = mock();
const mockLogError = mock();

mock.module('../backend/shared/utils.js', () => ({
    now: mockNow,
    generateId: mockGenerateId,
    logInfo: mockLogInfo,
    logError: mockLogError,
    default: {}
}));

const { createRequestContext, logRequestStart, logRequestComplete, logAuditEvent, createRequestLogger, AuditActions } = await import('../backend/middleware/requestLogger.js');

/**
 * Helper: build a minimal mock Request
 */
function makeRequest(opts = {}) {
    const method = opts.method || 'GET';
    const url = opts.url || 'http://localhost:3000/api/test?q=hello';
    const headers = new Headers(opts.headers || { 'user-agent': 'TestAgent/1.0' });
    return { method, url, headers };
}

describe('requestLogger middleware', () => {

    beforeEach(() => {
        mockQueryRun.mockReset();
        mockQueryRun.mockReturnValue({ changes: 1 });
        mockLogInfo.mockReset();
        mockLogError.mockReset();
        mockNow.mockReset();
        mockNow.mockReturnValue('2026-03-01T00:00:00Z');
        mockGenerateId.mockReset();
        mockGenerateId.mockReturnValue('test-req-id-123');
    });

    // ── createRequestContext ─────────────────────────────────────

    describe('createRequestContext', () => {
        test('extracts method from request', () => {
            const req = makeRequest({ method: 'POST' });
            const ctx = createRequestContext(req);
            expect(ctx.method).toBe('POST');
        });

        test('extracts path from URL', () => {
            const req = makeRequest({ url: 'http://localhost:3000/api/inventory?page=1' });
            const ctx = createRequestContext(req);
            expect(ctx.path).toBe('/api/inventory');
        });

        test('extracts query parameters from URL', () => {
            const req = makeRequest({ url: 'http://localhost:3000/api/test?q=hello&page=2' });
            const ctx = createRequestContext(req);
            expect(ctx.query).toEqual({ q: 'hello', page: '2' });
        });

        test('extracts empty query when no params present', () => {
            const req = makeRequest({ url: 'http://localhost:3000/api/test' });
            const ctx = createRequestContext(req);
            expect(ctx.query).toEqual({});
        });

        test('extracts IP as unknown when TRUST_PROXY is not set', () => {
            const oldTrustProxy = process.env.TRUST_PROXY;
            delete process.env.TRUST_PROXY;
            const req = makeRequest({ headers: { 'user-agent': 'UA', 'x-forwarded-for': '1.2.3.4' } });
            const ctx = createRequestContext(req);
            // Without TRUST_PROXY, should return 'unknown' (proxy headers ignored)
            expect(ctx.ip).toBe('unknown');
            if (oldTrustProxy !== undefined) process.env.TRUST_PROXY = oldTrustProxy;
        });

        test('extracts IP from x-forwarded-for when TRUST_PROXY is set', () => {
            const oldTrustProxy = process.env.TRUST_PROXY;
            process.env.TRUST_PROXY = 'true';
            const req = makeRequest({ headers: { 'user-agent': 'UA', 'x-forwarded-for': '10.20.30.40, 50.60.70.80' } });
            const ctx = createRequestContext(req);
            expect(ctx.ip).toBe('10.20.30.40');
            if (oldTrustProxy !== undefined) process.env.TRUST_PROXY = oldTrustProxy;
            else delete process.env.TRUST_PROXY;
        });

        test('extracts IP from x-real-ip when x-forwarded-for is absent', () => {
            const oldTrustProxy = process.env.TRUST_PROXY;
            process.env.TRUST_PROXY = '1';
            const req = makeRequest({ headers: { 'user-agent': 'UA', 'x-real-ip': '99.88.77.66' } });
            const ctx = createRequestContext(req);
            expect(ctx.ip).toBe('99.88.77.66');
            if (oldTrustProxy !== undefined) process.env.TRUST_PROXY = oldTrustProxy;
            else delete process.env.TRUST_PROXY;
        });

        test('extracts user-agent header', () => {
            const req = makeRequest({ headers: { 'user-agent': 'Mozilla/5.0 TestBot' } });
            const ctx = createRequestContext(req);
            expect(ctx.userAgent).toBe('Mozilla/5.0 TestBot');
        });

        test('defaults user-agent to unknown when missing', () => {
            const req = makeRequest({ headers: {} });
            const ctx = createRequestContext(req);
            expect(ctx.userAgent).toBe('unknown');
        });

        test('extracts referer header', () => {
            const req = makeRequest({ headers: { 'user-agent': 'UA', 'referer': 'http://example.com' } });
            const ctx = createRequestContext(req);
            expect(ctx.referer).toBe('http://example.com');
        });

        test('sets referer to null when missing', () => {
            const req = makeRequest({ headers: { 'user-agent': 'UA' } });
            const ctx = createRequestContext(req);
            expect(ctx.referer).toBeNull();
        });

        test('includes requestId from generateId', () => {
            const req = makeRequest();
            const ctx = createRequestContext(req);
            expect(ctx.requestId).toBe('test-req-id-123');
        });

        test('includes timestamp from now()', () => {
            const req = makeRequest();
            const ctx = createRequestContext(req);
            expect(ctx.timestamp).toBe('2026-03-01T00:00:00Z');
        });

        test('includes startTime as a number', () => {
            const req = makeRequest();
            const ctx = createRequestContext(req);
            expect(typeof ctx.startTime).toBe('number');
        });
    });

    // ── logRequestStart ─────────────────────────────────────────

    describe('logRequestStart', () => {
        test('calls logInfo with request metadata for normal paths', () => {
            const ctx = {
                requestId: 'r1', method: 'GET', path: '/api/inventory',
                ip: '127.0.0.1', userAgent: 'TestAgent'
            };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBeGreaterThanOrEqual(1);
            const call = mockLogInfo.mock.calls[0];
            expect(call[0]).toContain('Request started');
            expect(call[1].requestId).toBe('r1');
            expect(call[1].method).toBe('GET');
        });

        test('skips logging for /api/health path', () => {
            mockLogInfo.mockReset();
            const ctx = { requestId: 'r2', method: 'GET', path: '/api/health', ip: '127.0.0.1', userAgent: 'UA' };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('skips logging for /api/status path', () => {
            mockLogInfo.mockReset();
            const ctx = { requestId: 'r3', method: 'GET', path: '/api/status', ip: '127.0.0.1', userAgent: 'UA' };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('skips logging for favicon.ico', () => {
            mockLogInfo.mockReset();
            const ctx = { requestId: 'r4', method: 'GET', path: '/favicon.ico', ip: '127.0.0.1', userAgent: 'UA' };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('skips logging for static asset paths (.css)', () => {
            mockLogInfo.mockReset();
            const ctx = { requestId: 'r5', method: 'GET', path: '/styles/main.css', ip: '127.0.0.1', userAgent: 'UA' };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('skips logging for static asset paths (.js)', () => {
            mockLogInfo.mockReset();
            const ctx = { requestId: 'r6', method: 'GET', path: '/scripts/app.js', ip: '127.0.0.1', userAgent: 'UA' };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('skips logging for static asset paths (.png)', () => {
            mockLogInfo.mockReset();
            const ctx = { requestId: 'r7', method: 'GET', path: '/images/logo.png', ip: '127.0.0.1', userAgent: 'UA' };
            logRequestStart(ctx);
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });
    });

    // ── logRequestComplete ──────────────────────────────────────

    describe('logRequestComplete', () => {
        test('logs completed request with duration', () => {
            const ctx = {
                requestId: 'r10', method: 'GET', path: '/api/data',
                startTime: performance.now() - 150,
                ip: '10.0.0.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, { status: 200 });
            expect(mockLogInfo.mock.calls.length).toBeGreaterThanOrEqual(1);
            const call = mockLogInfo.mock.calls[0];
            expect(call[0]).toContain('Request completed');
            expect(call[1].status).toBe(200);
            expect(call[1].duration).toMatch(/\d+ms/);
        });

        test('stores request log to database via query.run', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = {
                requestId: 'r11', method: 'POST', path: '/api/items',
                startTime: performance.now() - 50,
                ip: '192.168.1.100', userAgent: 'TestUA',
                timestamp: '2026-03-01T00:00:00Z'
            };
            logRequestComplete(ctx, { status: 201 });
            // storeRequestLog is called async but query.run should be invoked
            // Give micro-task a chance to run
            expect(mockQueryRun.mock.calls.length).toBeGreaterThanOrEqual(1);
        });

        test('logs error path when error is provided', () => {
            const ctx = {
                requestId: 'r12', method: 'GET', path: '/api/fail',
                startTime: performance.now() - 10,
                ip: '1.1.1.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, null, new Error('something broke'));
            expect(mockLogError.mock.calls.length).toBeGreaterThanOrEqual(1);
            const call = mockLogError.mock.calls[0];
            expect(call[0]).toContain('Request failed');
        });

        test('uses status 500 when error is provided and no response', () => {
            const ctx = {
                requestId: 'r13', method: 'GET', path: '/api/crash',
                startTime: performance.now() - 5,
                ip: '1.1.1.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, null, new Error('crash'));
            const errorCall = mockLogError.mock.calls[0];
            expect(errorCall[2].status).toBe(500);
        });

        test('logs 4xx response as completed with error (not logError)', () => {
            mockLogInfo.mockReset();
            mockLogError.mockReset();
            const ctx = {
                requestId: 'r14', method: 'GET', path: '/api/missing',
                startTime: performance.now() - 5,
                ip: '1.1.1.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, { status: 404, data: { error: 'Not found' } });
            // Should call logInfo (not logError) for 4xx
            expect(mockLogInfo.mock.calls.length).toBeGreaterThanOrEqual(1);
            const call = mockLogInfo.mock.calls[0];
            expect(call[0]).toContain('error');
            expect(mockLogError.mock.calls.length).toBe(0);
        });

        test('skips logging for health endpoint', () => {
            mockLogInfo.mockReset();
            mockLogError.mockReset();
            const ctx = {
                requestId: 'r15', method: 'GET', path: '/api/health',
                startTime: performance.now(), ip: '1.1.1.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, { status: 200 });
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('skips logging for static assets (.woff2)', () => {
            mockLogInfo.mockReset();
            const ctx = {
                requestId: 'r16', method: 'GET', path: '/fonts/inter.woff2',
                startTime: performance.now(), ip: '1.1.1.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, { status: 200 });
            expect(mockLogInfo.mock.calls.length).toBe(0);
        });

        test('defaults to status 200 when no response and no error', () => {
            const ctx = {
                requestId: 'r17', method: 'GET', path: '/api/default',
                startTime: performance.now() - 5,
                ip: '1.1.1.1', userAgent: 'UA'
            };
            logRequestComplete(ctx, null);
            const call = mockLogInfo.mock.calls[0];
            expect(call[1].status).toBe(200);
        });
    });

    // ── logAuditEvent ───────────────────────────────────────────

    describe('logAuditEvent', () => {
        test('inserts audit record via query.run', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = {
                user: { id: 'user-1' },
                ip: '10.0.0.1',
                userAgent: 'AuditTestUA'
            };
            logAuditEvent(ctx, 'CREATE', 'inventory', 'item-1', { field: 'value' });
            expect(mockQueryRun.mock.calls.length).toBeGreaterThanOrEqual(1);
            const call = mockQueryRun.mock.calls[0];
            expect(call[0]).toContain('audit_logs');
            const params = call[1];
            expect(params[1]).toBe('user-1');      // user_id
            expect(params[2]).toBe('CREATE');       // action
            expect(params[3]).toBe('inventory');    // resource_type
            expect(params[4]).toBe('item-1');       // resource_id
            expect(params[5]).toContain('field');    // details JSON
        });

        test('handles context without user gracefully', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = { ip: '10.0.0.1', userAgent: 'UA' };
            logAuditEvent(ctx, 'DELETE', 'image', 'img-1');
            const params = mockQueryRun.mock.calls[0][1];
            expect(params[1]).toBeNull(); // user_id should be null
        });

        test('also calls logInfo after inserting audit record', () => {
            mockLogInfo.mockReset();
            const ctx = { user: { id: 'u1' }, ip: '1.1.1.1', userAgent: 'UA' };
            logAuditEvent(ctx, 'UPDATE', 'order', 'ord-1', {});
            expect(mockLogInfo.mock.calls.length).toBeGreaterThanOrEqual(1);
            const call = mockLogInfo.mock.calls[0];
            expect(call[0]).toContain('Audit event');
        });

        test('does not throw when DB insert fails', () => {
            mockQueryRun.mockImplementation(() => { throw new Error('DB error'); });
            const ctx = { user: { id: 'u1' }, ip: '1.1.1.1', userAgent: 'UA' };
            // Should not throw
            expect(() => logAuditEvent(ctx, 'DELETE', 'item', 'x')).not.toThrow();
        });

        test('stores anonymized IP in audit record', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = { user: { id: 'u1' }, ip: '192.168.1.55', userAgent: 'UA' };
            logAuditEvent(ctx, 'LOGIN', 'session', 's-1');
            const params = mockQueryRun.mock.calls[0][1];
            // IP should be anonymized: last octet zeroed
            expect(params[6]).toBe('192.168.1.0');
        });

        test('truncates long user agents', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const longUA = 'A'.repeat(1000);
            const ctx = { user: { id: 'u1' }, ip: '1.1.1.1', userAgent: longUA };
            logAuditEvent(ctx, 'READ', 'report', 'r-1');
            const params = mockQueryRun.mock.calls[0][1];
            expect(params[7].length).toBe(500);
        });
    });

    // ── AuditActions ────────────────────────────────────────────

    describe('AuditActions', () => {
        test('contains all authentication actions', () => {
            expect(AuditActions.LOGIN).toBe('LOGIN');
            expect(AuditActions.LOGOUT).toBe('LOGOUT');
            expect(AuditActions.PASSWORD_CHANGE).toBe('PASSWORD_CHANGE');
            expect(AuditActions.PASSWORD_RESET).toBe('PASSWORD_RESET');
        });

        test('contains all CRUD actions', () => {
            expect(AuditActions.CREATE).toBe('CREATE');
            expect(AuditActions.READ).toBe('READ');
            expect(AuditActions.UPDATE).toBe('UPDATE');
            expect(AuditActions.DELETE).toBe('DELETE');
        });

        test('contains bulk operation actions', () => {
            expect(AuditActions.BULK_CREATE).toBe('BULK_CREATE');
            expect(AuditActions.BULK_UPDATE).toBe('BULK_UPDATE');
            expect(AuditActions.BULK_DELETE).toBe('BULK_DELETE');
        });

        test('contains import/export actions', () => {
            expect(AuditActions.IMPORT).toBe('IMPORT');
            expect(AuditActions.EXPORT).toBe('EXPORT');
        });

        test('contains settings and integration actions', () => {
            expect(AuditActions.SETTINGS_UPDATE).toBe('SETTINGS_UPDATE');
            expect(AuditActions.OAUTH_CONNECT).toBe('OAUTH_CONNECT');
            expect(AuditActions.OAUTH_DISCONNECT).toBe('OAUTH_DISCONNECT');
            expect(AuditActions.WEBHOOK_CREATE).toBe('WEBHOOK_CREATE');
            expect(AuditActions.WEBHOOK_DELETE).toBe('WEBHOOK_DELETE');
        });

        test('contains admin actions', () => {
            expect(AuditActions.ADMIN_ACTION).toBe('ADMIN_ACTION');
            expect(AuditActions.USER_IMPERSONATION).toBe('USER_IMPERSONATION');
        });
    });

    // ── createRequestLogger ─────────────────────────────────────

    describe('createRequestLogger', () => {
        test('returns object with before and after functions', () => {
            const mw = createRequestLogger();
            expect(typeof mw.before).toBe('function');
            expect(typeof mw.after).toBe('function');
        });

        test('before() creates request context and assigns to ctx', () => {
            const mw = createRequestLogger();
            const req = makeRequest({ method: 'PUT', url: 'http://localhost:3000/api/items/1' });
            const ctx = { request: req };
            mw.before(ctx);
            expect(ctx.requestId).toBe('test-req-id-123');
            expect(ctx.method).toBe('PUT');
            expect(ctx.path).toBe('/api/items/1');
        });

        test('after() calls logRequestComplete', () => {
            mockLogInfo.mockReset();
            const mw = createRequestLogger();
            const ctx = {
                requestId: 'mw-r1', method: 'GET', path: '/api/data',
                startTime: performance.now() - 20,
                ip: '1.1.1.1', userAgent: 'UA'
            };
            mw.after(ctx, { status: 200 });
            expect(mockLogInfo.mock.calls.length).toBeGreaterThanOrEqual(1);
        });

        test('after() passes error to logRequestComplete', () => {
            mockLogError.mockReset();
            const mw = createRequestLogger();
            const ctx = {
                requestId: 'mw-r2', method: 'POST', path: '/api/fail',
                startTime: performance.now() - 10,
                ip: '1.1.1.1', userAgent: 'UA'
            };
            mw.after(ctx, null, new Error('handler error'));
            expect(mockLogError.mock.calls.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ── IP anonymization (internal helper tested through public API) ──

    describe('IP anonymization via logAuditEvent', () => {
        test('IPv4 last octet is zeroed', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = { user: { id: 'u1' }, ip: '172.16.254.99', userAgent: 'UA' };
            logAuditEvent(ctx, 'LOGIN', 'session', 's1');
            expect(mockQueryRun.mock.calls[0][1][6]).toBe('172.16.254.0');
        });

        test('IPv6 is anonymized (last groups zeroed)', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = { user: { id: 'u1' }, ip: '2001:db8:85a3:0:0:8a2e:370:7334', userAgent: 'UA' };
            logAuditEvent(ctx, 'LOGIN', 'session', 's2');
            // anonymizeIP for IPv6 keeps first 3 groups + ::0
            expect(mockQueryRun.mock.calls[0][1][6]).toBe('2001:db8:85a3::0');
        });

        test('unknown IP is passed through unchanged', () => {
            mockQueryRun.mockReset();
            mockQueryRun.mockReturnValue({ changes: 1 });
            const ctx = { user: { id: 'u1' }, ip: 'unknown', userAgent: 'UA' };
            logAuditEvent(ctx, 'LOGIN', 'session', 's3');
            expect(mockQueryRun.mock.calls[0][1][6]).toBe('unknown');
        });
    });
});
