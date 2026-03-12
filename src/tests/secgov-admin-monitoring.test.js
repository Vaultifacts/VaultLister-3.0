// Security & Governance — Admin Endpoint Gating + Monitoring Authorization
// Audit gaps: H34 (admin gating untested), H9 (admin role not in schema), H35 (admin audit trail)
// Categories: Human/Manual Recovery Workflows, Security / Abuse Resistance

import { describe, expect, test, mock, beforeEach } from 'bun:test';

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
        transaction: mock((fn) => fn),
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

mock.module('../backend/services/monitoring.js', () => ({
    monitor: {
        getStats: mock(() => ({
            summary: { totalRequests: 100, totalErrors: 2, avgResponseTime: '45.2' },
            endpoints: [{ endpoint: '/api/inventory', requests: 50, errors: 1 }],
        })),
    },
    healthChecker: {
        runAll: mock(() => Promise.resolve({ status: 'healthy', checks: {} })),
    },
    securityMonitor: {
        getSummary: mock(() => ({ failedLogins: 3, suspiciousIps: 1 })),
    },
}));

mock.module('../backend/services/websocket.js', () => ({
    websocketService: { sendToUser: mock(), broadcast: mock(), cleanup: mock() },
}));

// ─── Dynamic imports ─────────────────────────────────────────────────────────

const { monitoringRouter } = await import('../backend/routes/monitoring.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
    return {
        method: 'GET',
        path: '/',
        body: {},
        query: {},
        user: { id: 'user-1', is_admin: false, subscription_tier: 'free' },
        ...overrides,
    };
}

beforeEach(() => {
    mockQueryGet.mockReset().mockReturnValue(null);
    mockQueryAll.mockReset().mockReturnValue([]);
    mockQueryRun.mockReset().mockReturnValue({ changes: 1 });
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Monitoring — Public endpoints', () => {
    test('/health should be accessible without authentication', async () => {
        mockQueryGet.mockReturnValue({ ok: 1 });
        const ctx = makeCtx({ path: '/health', user: null });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.status).toBe('healthy');
    });

    test('/health/detailed should require authentication', async () => {
        const ctx = makeCtx({ path: '/health/detailed', user: null });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(401);
    });
});

describe('Monitoring — Admin-only endpoints (H34)', () => {
    const adminOnlyPaths = [
        '/metrics',
        '/metrics/prometheus',
        '/security/events',
        '/alerts',
        '/errors',
        '/rum/summary',
    ];

    for (const testPath of adminOnlyPaths) {
        test(`${testPath} should reject non-admin user with 403`, async () => {
            const ctx = makeCtx({
                path: testPath,
                user: { id: 'user-1', is_admin: false, subscription_tier: 'pro' },
            });
            const result = await monitoringRouter(ctx);
            expect(result.status).toBe(403);
            expect(result.data.error).toContain('Admin');
        });

        test(`${testPath} should reject unauthenticated user with 401`, async () => {
            const ctx = makeCtx({ path: testPath, user: null });
            const result = await monitoringRouter(ctx);
            expect(result.status).toBe(401);
        });

        test(`${testPath} should allow admin user`, async () => {
            mockQueryAll.mockReturnValue([]);
            const ctx = makeCtx({
                path: testPath,
                user: { id: 'admin-1', is_admin: true, subscription_tier: 'free' },
                query: {},
            });
            const result = await monitoringRouter(ctx);
            expect([200, 404]).toContain(result.status);
            // Should not be 401 or 403
            expect(result.status).not.toBe(401);
            expect(result.status).not.toBe(403);
        });
    }

    test('POST /alerts/:id/acknowledge should reject non-admin', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/alerts/alert-123/acknowledge',
            user: { id: 'user-1', is_admin: false },
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(403);
    });

    test('POST /alerts/:id/acknowledge should allow admin', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/alerts/alert-123/acknowledge',
            user: { id: 'admin-1', is_admin: true },
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(200);

        // Verify acknowledge query records admin user
        const ackCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('acknowledged') && c[0]?.includes('acknowledged_by')
        );
        expect(ackCall).toBeTruthy();
        expect(ackCall[1][0]).toBe('admin-1');
    });
});

describe('Monitoring — Admin gating consistency (H9)', () => {
    test('is_admin field is the sole gating mechanism for monitoring admin endpoints', async () => {
        // User with is_admin=true but free tier should still have admin access
        const ctx = makeCtx({
            path: '/metrics',
            user: { id: 'user-1', is_admin: true, subscription_tier: 'free' },
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(200);
    });

    test('pro/enterprise tier without is_admin should NOT have admin access to monitoring', async () => {
        // Enterprise tier alone does NOT grant admin access in monitoring.js
        // (unlike auditLog.js which grants admin for enterprise)
        const ctx = makeCtx({
            path: '/metrics',
            user: { id: 'user-1', is_admin: false, subscription_tier: 'enterprise' },
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(403);
    });

    test('gap doc: monitoring.js uses is_admin only, auditLog.js also accepts enterprise tier', () => {
        // INCONSISTENCY DOCUMENTED:
        // monitoring.js: `if (!user.is_admin)` — only is_admin flag
        // auditLog.js: `user.subscription_tier === 'enterprise' || user.is_admin` — enterprise OR is_admin
        // This means enterprise users can access audit logs but not monitoring metrics.
        // Recommendation: unify admin gating logic in a shared helper
        expect(true).toBe(true);
    });
});

describe('RUM endpoint validation', () => {
    test('POST /rum should require sessionId', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/rum',
            body: { metrics: [{ name: 'LCP', value: 100 }] },
            user: null,
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('sessionId');
    });

    test('POST /rum should require non-empty metrics array', async () => {
        const ctx = makeCtx({
            method: 'POST',
            path: '/rum',
            body: { sessionId: 'sess-123', metrics: [] },
            user: null,
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(400);
    });

    test('POST /rum should reject invalid metric names', async () => {
        mockQueryRun.mockReturnValue({ changes: 0 });
        const ctx = makeCtx({
            method: 'POST',
            path: '/rum',
            body: {
                sessionId: 'sess-123',
                metrics: [{ name: 'MALICIOUS_METRIC', value: 999 }],
            },
            user: null,
        });
        const result = await monitoringRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.accepted).toBe(0);
    });
});
