// Security & Governance — GDPR, Privacy, and Compliance
// Audit gaps: H11 (export), H12 (deletion), H13 (consent), H14 (audit log), H15 (legal.js leak), H17 (right-to-be-forgotten)
// Category: Privacy / Compliance / Auditability

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));
const mockTransaction = mock((fn) => fn);

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mockTransaction,
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

const mockEmailSend = mock(() => Promise.resolve());
mock.module('../backend/services/email.js', () => ({
    default: { send: mockEmailSend },
}));

mock.module('../backend/services/websocket.js', () => ({
    websocketService: { sendToUser: mock(), broadcast: mock(), cleanup: mock() },
}));

// ─── Dynamic imports (after mocks) ──────────────────────────────────────────

const { gdprRouter } = await import('../backend/routes/gdpr.js');
const { auditLog, CATEGORIES, SEVERITY } = await import('../backend/services/auditLog.js');
const { auditLogRouter } = await import('../backend/services/auditLog.js');
const { legalRouter } = await import('../backend/routes/legal.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
    return {
        method: 'GET',
        path: '/',
        body: {},
        query: {},
        user: { id: 'user-1', email: 'test@example.com', username: 'testuser', full_name: 'Test User' },
        ...overrides,
    };
}

beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryRun.mockReset();
    mockTransaction.mockReset().mockImplementation((fn) => fn);
    mockEmailSend.mockReset().mockResolvedValue(undefined);
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReturnValue({ changes: 1 });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GDPR Data Export (H11)', () => {
    test('should redact password_hash from exported user data', async () => {
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('FROM users')) {
                return [{ id: 'user-1', email: 'test@example.com', password_hash: 'SHOULD_NOT_APPEAR', mfa_secret: 'SHOULD_NOT_APPEAR' }];
            }
            return [];
        });

        const ctx = makeCtx({ method: 'POST', path: '/export' });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        expect(result.data.requestId).toBeTruthy();

        // Verify the stored export data was redacted — check the run call that stores export_data
        const storeCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('export_data'));
        expect(storeCall).toBeTruthy();
        const storedJson = JSON.parse(storeCall[1][0]);
        if (storedJson.data?.users) {
            for (const row of storedJson.data.users) {
                expect(row.password_hash).toBeUndefined();
                expect(row.mfa_secret).toBeUndefined();
            }
        }
    });

    test('should redact oauth_token and oauth_refresh_token from exported data', async () => {
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('FROM shops')) {
                return [{ id: 'shop-1', user_id: 'user-1', oauth_token: 'REDACT_ME', oauth_refresh_token: 'REDACT_ME', oauth_token_expires_at: '2026-01-01' }];
            }
            return [];
        });

        const ctx = makeCtx({ method: 'POST', path: '/export' });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        const storeCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('export_data'));
        const storedJson = JSON.parse(storeCall[1][0]);
        if (storedJson.data?.shops) {
            for (const row of storedJson.data.shops) {
                expect(row.oauth_token).toBeUndefined();
                expect(row.oauth_refresh_token).toBeUndefined();
                expect(row.oauth_token_expires_at).toBeUndefined();
            }
        }
    });

    test('should include exportDate and userId in export metadata', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({ method: 'POST', path: '/export' });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        const storeCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('export_data'));
        const storedJson = JSON.parse(storeCall[1][0]);
        expect(storedJson.exportDate).toBeTruthy();
        expect(storedJson.userId).toBe('user-1');
    });

    test('should send email notification after export', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({ method: 'POST', path: '/export' });
        await gdprRouter(ctx);

        expect(mockEmailSend).toHaveBeenCalledTimes(1);
        const emailArg = mockEmailSend.mock.calls[0][0];
        expect(emailArg.to).toBe('test@example.com');
        expect(emailArg.template).toBe('data-export-ready');
    });

    test('should require authentication for export', async () => {
        const ctx = makeCtx({ method: 'POST', path: '/export', user: null });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(401);
    });

    test('export download should verify user ownership of export request', async () => {
        mockQueryGet.mockReturnValue(null);
        const ctx = makeCtx({ method: 'GET', path: '/export/req-123/download' });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(404);
    });
});

describe('Account Deletion Lifecycle (H12)', () => {
    test('should schedule deletion with 30-day grace period (no-password user)', async () => {
        // Test with a social login user (no password_hash) to avoid bcrypt module issue
        mockQueryGet.mockImplementation((sql) => {
            if (sql.includes('password_hash')) return { password_hash: null };
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) return null;
            return null;
        });

        const ctx = makeCtx({
            method: 'POST',
            path: '/delete-account',
            body: { reason: 'leaving platform' },
        });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        expect(result.data.deletionDate).toBeTruthy();
        expect(result.data.note).toContain('30 days');

        const insertCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('account_deletion_requests'));
        expect(insertCall).toBeTruthy();

        // Verify user marked as pending deletion
        const userUpdate = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('deletion_scheduled_at') && c[0]?.includes('UPDATE users')
        );
        expect(userUpdate).toBeTruthy();
    });

    test('should send confirmation email on deletion schedule', async () => {
        mockQueryGet.mockImplementation((sql) => {
            if (sql.includes('password_hash')) return { password_hash: null };
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) return null;
            return null;
        });

        const ctx = makeCtx({
            method: 'POST',
            path: '/delete-account',
            body: { reason: 'test' },
        });
        await gdprRouter(ctx);

        expect(mockEmailSend).toHaveBeenCalledTimes(1);
        const emailArg = mockEmailSend.mock.calls[0][0];
        expect(emailArg.template).toBe('account-deletion-scheduled');
    });

    test('should prevent duplicate deletion requests', async () => {
        mockQueryGet.mockImplementation((sql) => {
            if (sql.includes('password_hash')) return { password_hash: null };
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return { id: 'req-1', scheduled_for: '2026-04-12T00:00:00.000Z' };
            }
            return null;
        });

        const ctx = makeCtx({ method: 'POST', path: '/delete-account', body: { reason: 'test' } });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(400);
        expect(result.data.error).toContain('already scheduled');
    });

    test('should cancel deletion and clear scheduled_at', async () => {
        const ctx = makeCtx({ method: 'POST', path: '/cancel-deletion' });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        const cancelCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('account_deletion_requests') && c[0]?.includes("'cancelled'")
        );
        expect(cancelCall).toBeTruthy();

        const userClear = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('deletion_scheduled_at = NULL')
        );
        expect(userClear).toBeTruthy();
    });

    test('deletion status should return scheduled=false when no pending request', async () => {
        mockQueryGet.mockReturnValue(null);
        const ctx = makeCtx({ method: 'GET', path: '/deletion-status' });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.scheduled).toBe(false);
    });
});

describe('Consent Management (H13)', () => {
    test('should return available consent types', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({ method: 'GET', path: '/consents' });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        expect(result.data.availableConsents).toHaveLength(4);
        const types = result.data.availableConsents.map(c => c.type);
        expect(types).toContain('marketing_emails');
        expect(types).toContain('analytics');
        expect(types).toContain('third_party_sharing');
        expect(types).toContain('personalization');
    });

    test('should persist consent updates via upsert', async () => {
        const ctx = makeCtx({
            method: 'PUT',
            path: '/consents',
            body: { consents: { marketing_emails: true, analytics: false } },
        });
        const result = await gdprRouter(ctx);

        expect(result.status).toBe(200);
        const consentCalls = mockQueryRun.mock.calls.filter(c =>
            c[0]?.includes('user_consents')
        );
        expect(consentCalls.length).toBe(2);
    });

    test('should reject invalid consent object', async () => {
        const ctx = makeCtx({ method: 'PUT', path: '/consents', body: { consents: null } });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(400);
    });

    test('should ignore unknown consent types', async () => {
        const ctx = makeCtx({
            method: 'PUT',
            path: '/consents',
            body: { consents: { unknown_type: true, marketing_emails: true } },
        });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(200);
        const consentCalls = mockQueryRun.mock.calls.filter(c =>
            c[0]?.includes('user_consents')
        );
        expect(consentCalls.length).toBe(1);
    });
});

describe('Data Rectification', () => {
    test('should only allow whitelisted fields (full_name, username, timezone, locale)', async () => {
        const ctx = makeCtx({
            method: 'PUT',
            path: '/rectify',
            body: {
                corrections: {
                    full_name: 'New Name',
                    email: 'hacker@evil.com',
                    password_hash: 'injected',
                    subscription_tier: 'enterprise',
                    is_admin: true,
                },
            },
        });
        const result = await gdprRouter(ctx);
        expect(result.status).toBe(200);

        const updateCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('UPDATE users SET')
        );
        expect(updateCall).toBeTruthy();
        expect(updateCall[0]).toContain('full_name');
        expect(updateCall[0]).not.toContain('email');
        expect(updateCall[0]).not.toContain('password_hash');
        expect(updateCall[0]).not.toContain('subscription_tier');
        expect(updateCall[0]).not.toContain('is_admin');
    });
});

describe('Audit Log Service (H14)', () => {
    test('should redact sensitive fields in logged details', () => {
        const testDetails = {
            action: 'login',
            password: 'test-placeholder-value',
            api_key: 'placeholder-value-1234',
            token: 'placeholder-token-value',
            username: 'testuser',
        };

        auditLog.log({
            userId: 'user-1',
            action: 'test_action',
            details: testDetails,
        });

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs')
        );
        expect(insertCall).toBeTruthy();
        const detailsJson = JSON.parse(insertCall[1][7]);
        expect(detailsJson.password).toBe('[REDACTED]');
        expect(detailsJson.api_key).toBe('[REDACTED]');
        expect(detailsJson.token).toBe('[REDACTED]');
        expect(detailsJson.username).toBe('testuser');
    });

    test('should redact nested sensitive fields', () => {
        auditLog.log({
            userId: 'user-1',
            action: 'nested_test',
            details: {
                user: { name: 'test', password_hash: 'abc' },
                refresh_token: 'rt-placeholder',
            },
        });

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs')
        );
        const detailsJson = JSON.parse(insertCall[1][7]);
        expect(detailsJson.user.password_hash).toBe('[REDACTED]');
        expect(detailsJson.refresh_token).toBe('[REDACTED]');
        expect(detailsJson.user.name).toBe('test');
    });

    test('should trigger alertCritical for critical severity events', () => {
        const originalAlert = auditLog.alertCritical.bind(auditLog);
        auditLog.alertCritical = mock(() => {});

        auditLog.log({
            userId: 'user-1',
            action: 'critical_event',
            severity: SEVERITY.CRITICAL,
        });

        expect(auditLog.alertCritical).toHaveBeenCalledTimes(1);
        auditLog.alertCritical = originalAlert;
    });

    test('should NOT trigger alertCritical for non-critical events', () => {
        auditLog.alertCritical = mock(() => {});

        auditLog.log({
            userId: 'user-1',
            action: 'info_event',
            severity: SEVERITY.INFO,
        });

        expect(auditLog.alertCritical).not.toHaveBeenCalled();
    });

    test('logAuth should set category to authentication', () => {
        auditLog.logAuth('user-1', 'login_success', { ip: '1.2.3.4' });

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs')
        );
        expect(insertCall[1][3]).toBe('authentication');
    });

    test('logAuth with "failed" action should set severity to warning', () => {
        auditLog.logAuth('user-1', 'login_failed', { ip: '1.2.3.4' });

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs')
        );
        expect(insertCall[1][4]).toBe('warning');
    });

    test('logAdmin should set category to admin_action and severity to warning', () => {
        auditLog.logAdmin('admin-1', 'delete_user', { targetUser: 'user-2' });

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs')
        );
        expect(insertCall[1][3]).toBe('admin_action');
        expect(insertCall[1][4]).toBe('warning');
    });

    test('logSecurity should set category to security', () => {
        auditLog.logSecurity('user-1', 'suspicious_login', { reason: 'new device' });

        const insertCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs')
        );
        expect(insertCall[1][3]).toBe('security');
    });

    test('query should build parameterized SQL with filters', async () => {
        mockQueryAll.mockReturnValue([{ id: 'log-1' }]);

        await auditLog.query({
            userId: 'user-1',
            category: 'authentication',
            severity: 'warning',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            limit: 50,
            offset: 10,
        });

        const queryCall = mockQueryAll.mock.calls.find(c =>
            c[0]?.includes('SELECT * FROM audit_logs')
        );
        expect(queryCall).toBeTruthy();
        expect(queryCall[0]).toContain('user_id = ?');
        expect(queryCall[0]).toContain('category = ?');
        expect(queryCall[0]).toContain('severity = ?');
        expect(queryCall[0]).toContain('created_at >= ?');
        expect(queryCall[0]).toContain('created_at <= ?');
        expect(queryCall[1]).toContain('user-1');
    });

    test('cleanup should preserve critical/security logs for 730 days', async () => {
        await auditLog.cleanup(90, 730);

        const standardDelete = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('DELETE FROM audit_logs') && c[0]?.includes("NOT IN ('critical')")
        );
        expect(standardDelete).toBeTruthy();

        const criticalDelete = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('DELETE FROM audit_logs') && c[0]?.includes("severity = 'critical'")
        );
        expect(criticalDelete).toBeTruthy();
    });

    test('generateComplianceReport should return structured report', async () => {
        mockQueryAll.mockReturnValue([]);
        mockQueryGet.mockReturnValue({ count: 0 });

        const report = await auditLog.generateComplianceReport('2026-01-01', '2026-12-31');
        expect(report.period.start).toBe('2026-01-01');
        expect(report.period.end).toBe('2026-12-31');
        expect(report.generatedAt).toBeTruthy();
        expect(report.summary).toBeTruthy();
        expect(report.details.authentication).toBeTruthy();
        expect(report.details.security).toBeTruthy();
        expect(report.details.dataAccess).toBeDefined();
        expect(report.details.adminActions).toBeDefined();
    });
});

describe('Legal.js Data Export — Missing Redaction (H5/H15)', () => {
    test('should document that legal.js data export uses SELECT * without redacting sensitive columns', async () => {
        // GAP: legal.js handleDataExport does SELECT * from tables like inventory,
        // listings, sales without stripping sensitive columns like gdpr.js does.
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('FROM users WHERE id')) {
                return [{ id: 'user-1', email: 'test@example.com', name: 'Test' }];
            }
            if (sql.includes('FROM sales')) {
                return [{ id: 'sale-1', user_id: 'user-1', amount: 100 }];
            }
            return [];
        });

        const ctx = makeCtx({ method: 'GET', path: '/privacy/data-export' });
        const result = await legalRouter(ctx);

        expect(result.status).toBe(200);
        expect(result.data.exportDate).toBeTruthy();
    });

    test('legal.js user query selects limited columns for user info', async () => {
        mockQueryAll.mockReturnValue([{ id: 'user-1', email: 'test@example.com', name: 'Test', created_at: '2026-01-01' }]);

        const ctx = makeCtx({ method: 'GET', path: '/privacy/data-export' });
        await legalRouter(ctx);

        // legal.js user query: SELECT id, email, name, created_at FROM users — properly scoped
        const userQuery = mockQueryAll.mock.calls.find(c =>
            c[0]?.includes('FROM users') && c[0]?.includes('SELECT id, email, name, created_at')
        );
        expect(userQuery).toBeTruthy();

        // BUT other tables use SELECT * — those are the gap
        const inventoryQuery = mockQueryAll.mock.calls.find(c =>
            c[0]?.includes('FROM inventory') && c[0]?.includes('SELECT *')
        );
        expect(inventoryQuery).toBeTruthy();
    });
});

describe('Audit Log Router — Admin Gating (H34)', () => {
    test('non-admin user should access own activity via /my-activity', async () => {
        mockQueryAll.mockReturnValue([{ action: 'login', created_at: '2026-01-01' }]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/my-activity',
            query: { days: '7' },
            user: { id: 'user-1', is_admin: false, subscription_tier: 'free' },
        });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(200);
        expect(result.data.activity).toBeDefined();
    });

    test('non-admin user should be rejected from /logs', async () => {
        const ctx = makeCtx({
            method: 'GET',
            path: '/logs',
            query: {},
            user: { id: 'user-1', is_admin: false, subscription_tier: 'free' },
        });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(403);
    });

    test('non-admin user should be rejected from /compliance-report', async () => {
        const ctx = makeCtx({
            method: 'GET',
            path: '/compliance-report',
            query: {},
            user: { id: 'user-1', is_admin: false, subscription_tier: 'free' },
        });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(403);
    });

    test('non-admin user should be rejected from /security-alerts', async () => {
        const ctx = makeCtx({
            method: 'GET',
            path: '/security-alerts',
            query: {},
            user: { id: 'user-1', is_admin: false, subscription_tier: 'free' },
        });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(403);
    });

    test('enterprise user should be treated as admin', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/logs',
            query: {},
            user: { id: 'user-1', is_admin: false, subscription_tier: 'enterprise' },
        });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(200);
    });

    test('admin viewing user audit log should create audit trail (H35)', async () => {
        mockQueryAll.mockReturnValue([]);
        const ctx = makeCtx({
            method: 'GET',
            path: '/user/target-user-123',
            query: { days: '30' },
            user: { id: 'admin-1', is_admin: true, subscription_tier: 'pro' },
        });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(200);

        const auditInsert = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs') && c[1]?.includes('view_user_audit_log')
        );
        expect(auditInsert).toBeTruthy();
    });

    test('unauthenticated user should get 401 on all audit endpoints', async () => {
        const ctx = makeCtx({ method: 'GET', path: '/logs', query: {}, user: null });
        const result = await auditLogRouter(ctx);
        expect(result.status).toBe(401);
    });
});
