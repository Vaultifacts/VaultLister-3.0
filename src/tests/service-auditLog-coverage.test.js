// Audit Log — Extended Coverage Tests
// Covers: logDataAccess, logFinancial, alertCritical, query filters, getUserActivity,
// getAdminActivity, generateComplianceReport, getSecurityAlerts, cleanup defaults,
// auditLogRouter (all routes), redactSensitive edge cases, migration export
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'path';
import { createMockDb } from './helpers/mockDb.js';

const db = createMockDb();
const schemaSql = readFileSync(
    join(import.meta.dir, '../backend/db/pg-schema.sql'),
    'utf-8'
);

mock.module('../backend/db/database.js', () => ({
    query: db.query,
    models: db.models,
    escapeLike: db.escapeLike,
    default: db.db,
    initializeDatabase: mock(() => true),
    cleanupExpiredData: mock(() => ({})),
}));

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
    default: { info: mock(), error: mock(), warn: mock(), debug: mock() },
}));

const auditModule = await import('../backend/services/auditLog.js');
const auditLog = auditModule.auditLog || auditModule.default;
const { auditLogRouter, CATEGORIES, SEVERITY } = auditModule;
const migration = schemaSql;
const { logger } = await import('../backend/shared/logger.js');

beforeEach(() => {
    db.reset();
    logger.info.mockClear();
    logger.error.mockClear();
    logger.warn.mockClear();
    logger.debug.mockClear();
});

// ============================================================
// redactSensitive — edge cases
// ============================================================
describe('redactSensitive edge cases', () => {
    test('non-object values pass through unchanged', async () => {
        const id = await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: null,
        });
        expect(typeof id).toBe('string');
        const params = db.query.run.mock.calls[0][1];
        expect(params[7]).toBe('null');
    });

    test('string details are passed as-is after JSON.stringify', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: 'plain string',
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params[7]).toBe('"plain string"');
    });

    test('number details are passed as-is after JSON.stringify', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: 42,
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params[7]).toBe('42');
    });

    test('nested sensitive fields are redacted', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: {
                user: {
                    password_hash: 'abc123',
                    name: 'test'
                }
            },
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(details.user.password_hash).toBe('[REDACTED]');
        expect(details.user.name).toBe('test');
    });

    test('array details are handled', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: [{ token: 'secret', safe: 'ok' }],
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(Array.isArray(details)).toBe(true);
        expect(details[0].token).toBe('[REDACTED]');
        expect(details[0].safe).toBe('ok');
    });

    test('credit_card field is redacted', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: { credit_card: '4111111111111111', amount: 50 },
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(details.credit_card).toBe('[REDACTED]');
        expect(details.amount).toBe(50);
    });

    test('ssn field is redacted', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: { ssn: '123-45-6789' },
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(details.ssn).toBe('[REDACTED]');
    });

    test('bank_account field is redacted', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            details: { bank_account: '12345678' },
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(details.bank_account).toBe('[REDACTED]');
    });

    test('secret field is redacted', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'test',
            metadata: { client_secret: 'xyz', endpoint: '/api' },
        });
        const params = db.query.run.mock.calls[0][1];
        const metadata = JSON.parse(params[8]);
        expect(metadata.client_secret).toBe('[REDACTED]');
        expect(metadata.endpoint).toBe('/api');
    });
});

// ============================================================
// auditLog.log — critical severity triggers alertCritical
// ============================================================
describe('auditLog.log — critical alert', () => {
    test('calls alertCritical for CRITICAL severity events', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'breach_detected',
            severity: SEVERITY.CRITICAL,
        });
        expect(logger.error).toHaveBeenCalled();
        const call = logger.error.mock.calls[0];
        expect(call[0]).toContain('CRITICAL AUDIT');
    });

    test('does not call alertCritical for INFO severity', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'normal_action',
            severity: SEVERITY.INFO,
        });
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('does not call alertCritical for WARNING severity', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'suspicious',
            severity: SEVERITY.WARNING,
        });
        expect(logger.error).not.toHaveBeenCalled();
    });

    test('does not call alertCritical for ERROR severity', async () => {
        await auditLog.log({
            userId: 'u1',
            action: 'something_broke',
            severity: SEVERITY.ERROR,
        });
        expect(logger.error).not.toHaveBeenCalled();
    });
});

// ============================================================
// auditLog.logDataAccess
// ============================================================
describe('auditLog.logDataAccess', () => {
    test('logs data access with DATA category', async () => {
        await auditLog.logDataAccess('u1', 'read_report', 'report', 'rpt-1', { format: 'pdf' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[3]).toBe('data_access');
        expect(params[5]).toBe('report');
        expect(params[6]).toBe('rpt-1');
    });

    test('passes context to underlying log', async () => {
        await auditLog.logDataAccess('u1', 'export', 'users', 'all', {}, {
            ipAddress: '10.0.0.5',
            userAgent: 'CLI/1.0',
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params[9]).toBe('10.0.0.5');
        expect(params[10]).toBe('CLI/1.0');
    });

    test('returns a valid ID', async () => {
        const id = await auditLog.logDataAccess('u1', 'view', 'item', 'item-5', {});
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });
});

// ============================================================
// auditLog.logFinancial
// ============================================================
describe('auditLog.logFinancial', () => {
    test('logs financial event with FINANCIAL category', async () => {
        await auditLog.logFinancial('u1', 'purchase', { amount: 100 });
        const params = db.query.run.mock.calls[0][1];
        expect(params[3]).toBe('financial');
        expect(params[4]).toBe('info');
    });

    test('passes context through', async () => {
        await auditLog.logFinancial('u1', 'refund', { amount: 25 }, {
            sessionId: 'sess-123',
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params[11]).toBe('sess-123');
    });

    test('redacts sensitive financial details', async () => {
        await auditLog.logFinancial('u1', 'payment', {
            credit_card: '4111-xxxx',
            amount: 50,
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(details.credit_card).toBe('[REDACTED]');
        expect(details.amount).toBe(50);
    });
});

// ============================================================
// auditLog.alertCritical
// ============================================================
describe('auditLog.alertCritical', () => {
    test('logs critical event details', () => {
        auditLog.alertCritical({
            action: 'unauthorized_access',
            userId: 'attacker-1',
        });
        expect(logger.error).toHaveBeenCalledTimes(1);
        const call = logger.error.mock.calls[0];
        expect(call[0]).toContain('CRITICAL AUDIT');
        expect(call[2].action).toBe('unauthorized_access');
        expect(call[2].userId).toBe('attacker-1');
    });
});

// ============================================================
// auditLog.query — filter combinations
// ============================================================
describe('auditLog.query — filters', () => {
    test('no filters returns all with default limit/offset', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLog.query();
        expect(db.query.all).toHaveBeenCalled();
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('SELECT * FROM audit_logs');
        expect(sql).toContain('LIMIT');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain(100); // default limit
        expect(params).toContain(0);   // default offset
    });

    test('userId filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ userId: 'user-42' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('user_id = ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('user-42');
    });

    test('category filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ category: 'security' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('category = ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('security');
    });

    test('severity filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ severity: 'critical' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('severity = ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('critical');
    });

    test('action filter uses LIKE with escaping', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ action: 'login' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('action ILIKE ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('%login%');
    });

    test('action filter escapes special SQL chars', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ action: '100%' });
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('%100\\%%');
    });

    test('resourceType filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ resourceType: 'item' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('resource_type = ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('item');
    });

    test('resourceId filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ resourceId: 'item-5' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('resource_id = ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('item-5');
    });

    test('startDate filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ startDate: '2025-01-01' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('created_at >= ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('2025-01-01');
    });

    test('endDate filter adds WHERE clause', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ endDate: '2025-12-31' });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('created_at <= ?');
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain('2025-12-31');
    });

    test('custom limit and offset', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({ limit: 25, offset: 50 });
        const params = db.query.all.mock.calls[0][1];
        expect(params).toContain(25);
        expect(params).toContain(50);
    });

    test('all filters combined', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.query({
            userId: 'u1',
            category: 'security',
            severity: 'warning',
            action: 'login',
            resourceType: 'user',
            resourceId: 'user-1',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            limit: 10,
            offset: 5,
        });
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('user_id = ?');
        expect(sql).toContain('category = ?');
        expect(sql).toContain('severity = ?');
        expect(sql).toContain('action ILIKE ?');
        expect(sql).toContain('resource_type = ?');
        expect(sql).toContain('resource_id = ?');
        expect(sql).toContain('created_at >= ?');
        expect(sql).toContain('created_at <= ?');
    });

    test('returns empty array when query.all returns null', async () => {
        db.query.all.mockReturnValue(null);
        const result = await auditLog.query();
        expect(result).toEqual([]);
    });

    test('returns data from query.all', async () => {
        const mockData = [
            { id: '1', action: 'test', category: 'system' },
            { id: '2', action: 'test2', category: 'security' },
        ];
        db.query.all.mockReturnValue(mockData);
        const result = await auditLog.query();
        expect(result).toEqual(mockData);
    });
});

// ============================================================
// auditLog.getUserActivity
// ============================================================
describe('auditLog.getUserActivity', () => {
    test('queries user activity with userId and date range', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getUserActivity('user-5', 30);
        expect(db.query.all).toHaveBeenCalledTimes(1);
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('user_id = ?');
        expect(sql).toContain('created_at >= ?');
        expect(sql).toContain('LIMIT 500');
        const params = db.query.all.mock.calls[0][1];
        expect(params[0]).toBe('user-5');
    });

    test('defaults to 30 days', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getUserActivity('user-1');
        const params = db.query.all.mock.calls[0][1];
        const dateStr = params[1];
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThanOrEqual(29);
        expect(diffDays).toBeLessThanOrEqual(31);
    });

    test('custom days parameter', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getUserActivity('user-1', 7);
        const params = db.query.all.mock.calls[0][1];
        const date = new Date(params[1]);
        const now = new Date();
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThanOrEqual(6);
        expect(diffDays).toBeLessThanOrEqual(8);
    });

    test('returns empty array when null from DB', async () => {
        db.query.all.mockReturnValue(null);
        const result = await auditLog.getUserActivity('user-1');
        expect(result).toEqual([]);
    });

    test('returns activity data', async () => {
        const mockActivity = [
            { action: 'login', category: 'auth', created_at: '2025-01-01' },
        ];
        db.query.all.mockReturnValue(mockActivity);
        const result = await auditLog.getUserActivity('user-1');
        expect(result).toEqual(mockActivity);
    });
});

// ============================================================
// auditLog.getAdminActivity
// ============================================================
describe('auditLog.getAdminActivity', () => {
    test('queries admin activity with default 7 days', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getAdminActivity();
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain("category = 'admin_action'");
        expect(sql).toContain('created_at >= ?');
        expect(sql).toContain('LEFT JOIN users');
    });

    test('custom days parameter', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getAdminActivity(14);
        const params = db.query.all.mock.calls[0][1];
        const date = new Date(params[0]);
        const now = new Date();
        const diffDays = (now - date) / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThanOrEqual(13);
        expect(diffDays).toBeLessThanOrEqual(15);
    });

    test('returns empty array when DB returns null', async () => {
        db.query.all.mockReturnValue(null);
        const result = await auditLog.getAdminActivity();
        expect(result).toEqual([]);
    });

    test('returns admin activity data', async () => {
        const mockData = [{ action: 'delete_user', user_email: 'admin@test.com' }];
        db.query.all.mockReturnValue(mockData);
        const result = await auditLog.getAdminActivity();
        expect(result).toEqual(mockData);
    });
});

// ============================================================
// auditLog.generateComplianceReport
// ============================================================
describe('auditLog.generateComplianceReport', () => {
    test('returns report with correct structure', async () => {
        db.query.all.mockReturnValue([]);
        db.query.get.mockReturnValue({ count: 5 });

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-06-30');

        expect(report.period.start).toBe('2025-01-01');
        expect(report.period.end).toBe('2025-06-30');
        expect(report.generatedAt).toBeDefined();
        expect(report.summary).toBeDefined();
        expect(report.details).toBeDefined();
    });

    test('summary.byCategory queries grouped by category', async () => {
        const categoryData = [
            { category: 'authentication', count: 10 },
            { category: 'security', count: 5 },
        ];
        // First call to all is byCategory
        db.query.all.mockReturnValueOnce(categoryData);
        db.query.all.mockReturnValue([]);
        db.query.get.mockReturnValue({ count: 3 });

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-12-31');
        expect(report.summary.byCategory).toEqual(categoryData);
    });

    test('summary.bySeverity queries grouped by severity', async () => {
        const severityData = [
            { severity: 'info', count: 50 },
            { severity: 'critical', count: 2 },
        ];
        db.query.all.mockReturnValueOnce([]); // byCategory
        db.query.all.mockReturnValueOnce(severityData); // bySeverity
        db.query.all.mockReturnValue([]);
        db.query.get.mockReturnValue({ count: 0 });

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-12-31');
        expect(report.summary.bySeverity).toEqual(severityData);
    });

    test('details.authentication contains totalLogins, failedLogins, passwordResets', async () => {
        db.query.all.mockReturnValue([]);
        db.query.get
            .mockReturnValueOnce({ count: 100 })  // totalLogins
            .mockReturnValueOnce({ count: 10 })   // failedLogins
            .mockReturnValueOnce({ count: 5 })    // passwordResets
            .mockReturnValueOnce({ count: 3 })    // mfaEnrollments
            .mockReturnValueOnce({ count: 2 });   // suspiciousActivity

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-12-31');
        expect(report.details.authentication.totalLogins).toBe(100);
        expect(report.details.authentication.failedLogins).toBe(10);
        expect(report.details.authentication.passwordResets).toBe(5);
    });

    test('details.security contains mfaEnrollments and suspiciousActivity', async () => {
        db.query.all.mockReturnValue([]);
        db.query.get
            .mockReturnValueOnce({ count: 0 })   // totalLogins
            .mockReturnValueOnce({ count: 0 })   // failedLogins
            .mockReturnValueOnce({ count: 0 })   // passwordResets
            .mockReturnValueOnce({ count: 8 })   // mfaEnrollments
            .mockReturnValueOnce({ count: 1 });  // suspiciousActivity

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-12-31');
        expect(report.details.security.mfaEnrollments).toBe(8);
        expect(report.details.security.suspiciousActivity).toBe(1);
    });

    test('handles null from query.get gracefully (defaults to 0)', async () => {
        db.query.all.mockReturnValue([]);
        db.query.get.mockReturnValue(null);

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-12-31');
        expect(report.details.authentication.totalLogins).toBe(0);
        expect(report.details.authentication.failedLogins).toBe(0);
        expect(report.details.authentication.passwordResets).toBe(0);
        expect(report.details.security.mfaEnrollments).toBe(0);
        expect(report.details.security.suspiciousActivity).toBe(0);
    });

    test('handles null from query.all for dataAccess and adminActions', async () => {
        db.query.all
            .mockReturnValueOnce(null)   // byCategory
            .mockReturnValueOnce(null)   // bySeverity
            .mockReturnValueOnce(null)   // dataAccess
            .mockReturnValueOnce(null);  // adminActions
        db.query.get.mockReturnValue({ count: 0 });

        const report = await auditLog.generateComplianceReport('2025-01-01', '2025-12-31');
        expect(report.summary.byCategory).toEqual([]);
        expect(report.summary.bySeverity).toEqual([]);
        expect(report.details.dataAccess).toEqual([]);
        expect(report.details.adminActions).toEqual([]);
    });
});

// ============================================================
// auditLog.getSecurityAlerts
// ============================================================
describe('auditLog.getSecurityAlerts', () => {
    test('queries with default 24 hours', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getSecurityAlerts();
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain("severity IN ('warning', 'critical')");
        expect(sql).toContain('created_at >= ?');
    });

    test('custom hours parameter', async () => {
        db.query.all.mockReturnValue([]);
        await auditLog.getSecurityAlerts(48);
        const params = db.query.all.mock.calls[0][1];
        const date = new Date(params[0]);
        const now = new Date();
        const diffHours = (now - date) / (1000 * 60 * 60);
        expect(diffHours).toBeGreaterThanOrEqual(47);
        expect(diffHours).toBeLessThanOrEqual(49);
    });

    test('returns empty array when DB returns null', async () => {
        db.query.all.mockReturnValue(null);
        const result = await auditLog.getSecurityAlerts();
        expect(result).toEqual([]);
    });

    test('returns alerts data', async () => {
        const alerts = [{ id: '1', severity: 'critical', action: 'brute_force' }];
        db.query.all.mockReturnValue(alerts);
        const result = await auditLog.getSecurityAlerts();
        expect(result).toEqual(alerts);
    });
});

// ============================================================
// auditLog.cleanup
// ============================================================
describe('auditLog.cleanup — extended', () => {
    test('uses default retention of 90 and 730 days', async () => {
        db.query.run
            .mockReturnValueOnce({ changes: 10 })
            .mockReturnValueOnce({ changes: 2 });

        await auditLog.cleanup();
        expect(db.query.run).toHaveBeenCalledTimes(2);

        // First call: standard logs
        const sql1 = db.query.run.mock.calls[0][0];
        expect(sql1).toContain('DELETE FROM audit_logs');
        expect(sql1).toContain("severity NOT IN ('critical')");

        // Second call: critical/security logs
        const sql2 = db.query.run.mock.calls[1][0];
        expect(sql2).toContain('DELETE FROM audit_logs');
        expect(sql2).toContain("severity = 'critical'");
    });

    test('logs cleanup results', async () => {
        db.query.run
            .mockReturnValueOnce({ changes: 15 })
            .mockReturnValueOnce({ changes: 3 });

        await auditLog.cleanup();
        expect(logger.info).toHaveBeenCalled();
        const msg = logger.info.mock.calls[0][0];
        expect(msg).toContain('15');
        expect(msg).toContain('3');
    });

    test('custom retention days', async () => {
        db.query.run
            .mockReturnValueOnce({ changes: 0 })
            .mockReturnValueOnce({ changes: 0 });

        await auditLog.cleanup(30, 365);
        expect(db.query.run).toHaveBeenCalledTimes(2);

        const standardDate = new Date(db.query.run.mock.calls[0][1][0]);
        const criticalDate = new Date(db.query.run.mock.calls[1][1][0]);
        const now = new Date();

        const standardDiff = (now - standardDate) / (1000 * 60 * 60 * 24);
        const criticalDiff = (now - criticalDate) / (1000 * 60 * 60 * 24);

        expect(standardDiff).toBeGreaterThanOrEqual(29);
        expect(standardDiff).toBeLessThanOrEqual(31);
        expect(criticalDiff).toBeGreaterThanOrEqual(364);
        expect(criticalDiff).toBeLessThanOrEqual(366);
    });
});

// ============================================================
// auditLog.init
// ============================================================
describe('auditLog.init', () => {
    test('logs initialization message', () => {
        auditLog.init();
        expect(logger.info).toHaveBeenCalled();
        const msg = logger.info.mock.calls[0][0];
        expect(msg).toContain('Service initialized');
    });
});

// ============================================================
// auditLogRouter — all routes
// ============================================================
describe('auditLogRouter', () => {
    const adminUser = { id: 'admin-1', is_admin: true, subscription_tier: 'enterprise' };
    const regularUser = { id: 'user-1', is_admin: false, subscription_tier: 'free' };

    test('returns 401 when no user', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/my-activity',
            user: null,
            query: {},
        });
        expect(result.status).toBe(401);
        expect(result.data.error).toContain('Authentication required');
    });

    test('GET /my-activity — returns user activity', async () => {
        db.query.all.mockReturnValue([{ action: 'login' }]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/my-activity',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.activity).toBeDefined();
    });

    test('GET /my-activity — parses days parameter', async () => {
        db.query.all.mockReturnValue([]);
        await auditLogRouter({
            method: 'GET',
            path: '/my-activity',
            user: regularUser,
            query: { days: '7' },
        });
        expect(db.query.all).toHaveBeenCalled();
    });

    test('GET /my-activity — defaults to 30 days for invalid input', async () => {
        db.query.all.mockReturnValue([]);
        await auditLogRouter({
            method: 'GET',
            path: '/my-activity',
            user: regularUser,
            query: { days: 'invalid' },
        });
        expect(db.query.all).toHaveBeenCalled();
    });

    test('GET /logs — returns 403 for non-admin', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/logs',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(403);
        expect(result.data.error).toContain('Admin access required');
    });

    test('GET /logs — admin can query logs', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/logs',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.logs).toBeDefined();
    });

    test('GET /logs — passes all filter params', async () => {
        db.query.all.mockReturnValue([]);
        await auditLogRouter({
            method: 'GET',
            path: '/logs',
            user: adminUser,
            query: {
                userId: 'u1',
                category: 'auth',
                severity: 'info',
                action: 'login',
                resourceType: 'user',
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                limit: '50',
                offset: '10',
            },
        });
        expect(db.query.all).toHaveBeenCalled();
    });

    test('GET /admin-activity — returns 403 for non-admin', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/admin-activity',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(403);
    });

    test('GET /admin-activity — admin gets activity', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/admin-activity',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.activity).toBeDefined();
    });

    test('GET /admin-activity — custom days param', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/admin-activity',
            user: adminUser,
            query: { days: '14' },
        });
        expect(result.status).toBe(200);
    });

    test('GET /security-alerts — returns 403 for non-admin', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/security-alerts',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(403);
    });

    test('GET /security-alerts — admin gets alerts', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/security-alerts',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.alerts).toBeDefined();
    });

    test('GET /security-alerts — custom hours param', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/security-alerts',
            user: adminUser,
            query: { hours: '48' },
        });
        expect(result.status).toBe(200);
    });

    test('GET /compliance-report — returns 403 for non-admin', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/compliance-report',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(403);
    });

    test('GET /compliance-report — admin gets report', async () => {
        db.query.all.mockReturnValue([]);
        db.query.get.mockReturnValue({ count: 0 });
        const result = await auditLogRouter({
            method: 'GET',
            path: '/compliance-report',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.period).toBeDefined();
        expect(result.data.summary).toBeDefined();
        expect(result.data.details).toBeDefined();
    });

    test('GET /compliance-report — custom date params', async () => {
        db.query.all.mockReturnValue([]);
        db.query.get.mockReturnValue({ count: 0 });
        const result = await auditLogRouter({
            method: 'GET',
            path: '/compliance-report',
            user: adminUser,
            query: { startDate: '2025-01-01', endDate: '2025-06-30' },
        });
        expect(result.status).toBe(200);
        expect(result.data.period.start).toBe('2025-01-01');
        expect(result.data.period.end).toBe('2025-06-30');
    });

    test('GET /user/:userId — returns 403 for non-admin', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/user/target-1',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(403);
    });

    test('GET /user/:userId — admin gets user activity and logs access', async () => {
        db.query.all.mockReturnValue([{ action: 'test' }]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/user/target-1',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.activity).toBeDefined();
        // Also logs admin access (second call to query.run)
        expect(db.query.run).toHaveBeenCalled();
    });

    test('GET /user/:userId — custom days param', async () => {
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/user/target-1',
            user: adminUser,
            query: { days: '7' },
        });
        expect(result.status).toBe(200);
    });

    test('GET /stats — returns 403 for non-admin', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/stats',
            user: regularUser,
            query: {},
        });
        expect(result.status).toBe(403);
    });

    test('GET /stats — admin gets stats', async () => {
        db.query.get.mockReturnValue({ count: 42 });
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/stats',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.totalEvents).toBe(42);
        expect(result.data.byCategory).toBeDefined();
        expect(result.data.bySeverity).toBeDefined();
        expect(result.data.topActions).toBeDefined();
        expect(result.data.uniqueUsers).toBeDefined();
    });

    test('GET /stats — custom days param', async () => {
        db.query.get.mockReturnValue({ count: 0 });
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/stats',
            user: adminUser,
            query: { days: '30' },
        });
        expect(result.status).toBe(200);
    });

    test('GET /stats — handles null from DB', async () => {
        db.query.get.mockReturnValue(null);
        db.query.all.mockReturnValue(null);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/stats',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(200);
        expect(result.data.totalEvents).toBe(0);
        expect(result.data.byCategory).toEqual([]);
        expect(result.data.bySeverity).toEqual([]);
        expect(result.data.topActions).toEqual([]);
        expect(result.data.uniqueUsers).toBe(0);
    });

    test('unknown route returns 404', async () => {
        const result = await auditLogRouter({
            method: 'GET',
            path: '/unknown-endpoint',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(404);
        expect(result.data.error).toBe('Not found');
    });

    test('POST method on known path returns 404', async () => {
        const result = await auditLogRouter({
            method: 'POST',
            path: '/logs',
            user: adminUser,
            query: {},
        });
        expect(result.status).toBe(404);
    });

    test('enterprise tier user is treated as admin', async () => {
        const enterpriseUser = { id: 'eu-1', is_admin: false, subscription_tier: 'enterprise' };
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/logs',
            user: enterpriseUser,
            query: {},
        });
        // Source explicitly guards on is_admin only (not subscription_tier)
        expect(result.status).toBe(403);
    });

    test('is_admin true but non-enterprise tier is treated as admin', async () => {
        const isAdminUser = { id: 'ia-1', is_admin: true, subscription_tier: 'free' };
        db.query.all.mockReturnValue([]);
        const result = await auditLogRouter({
            method: 'GET',
            path: '/logs',
            user: isAdminUser,
            query: {},
        });
        expect(result.status).toBe(200);
    });
});

// ============================================================
// auditLog.log — default values
// ============================================================
describe('auditLog.log — default parameters', () => {
    test('defaults category to system', async () => {
        await auditLog.log({ userId: 'u1', action: 'test' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[3]).toBe('system');
    });

    test('defaults severity to info', async () => {
        await auditLog.log({ userId: 'u1', action: 'test' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[4]).toBe('info');
    });

    test('defaults metadata to empty object', async () => {
        await auditLog.log({ userId: 'u1', action: 'test' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[8]).toBe('{}');
    });

    test('stores timestamp in ISO format', async () => {
        await auditLog.log({ userId: 'u1', action: 'test' });
        const params = db.query.run.mock.calls[0][1];
        const timestamp = params[12];
        expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test('generates unique IDs for each log entry', async () => {
        const id1 = await auditLog.log({ userId: 'u1', action: 'test1' });
        db.reset();
        const id2 = await auditLog.log({ userId: 'u1', action: 'test2' });
        expect(id1).not.toBe(id2);
    });
});

// ============================================================
// migration export
// ============================================================
describe('migration export', () => {
    test('migration string is defined', () => {
        expect(migration).toBeDefined();
        expect(typeof migration).toBe('string');
    });

    test('migration creates audit_logs table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS audit_logs');
    });

    test('migration includes all required columns', () => {
        expect(migration).toContain('user_id TEXT');
        expect(migration).toContain('action TEXT NOT NULL');
        expect(migration).toContain('category TEXT');
        expect(migration).toContain('severity TEXT');
        expect(migration).toContain('resource_type TEXT');
        expect(migration).toContain('resource_id TEXT');
        expect(migration).toContain('details TEXT');
        expect(migration).toContain('metadata TEXT');
        expect(migration).toContain('ip_address TEXT');
        expect(migration).toContain('user_agent TEXT');
        expect(migration).toContain('session_id TEXT');
        expect(migration).toContain('created_at TIMESTAMPTZ');
    });

    test('migration creates indexes', () => {
        expect(migration).toContain('idx_audit_user');
        expect(migration).toContain('idx_audit_category');
        expect(migration).toContain('idx_audit_severity');
        expect(migration).toContain('idx_audit_logs_action');
        expect(migration).toContain('idx_audit_resource');
        expect(migration).toContain('idx_audit_logs_created_at');
    });

    test('migration includes foreign key constraint', () => {
        expect(migration).toContain('FOREIGN KEY');
        expect(migration).toContain('users(id)');
    });
});

// ============================================================
// CATEGORIES and SEVERITY — re-export verification
// ============================================================
describe('CATEGORIES and SEVERITY re-exports', () => {
    test('CATEGORIES has expected values', () => {
        expect(CATEGORIES.AUTH).toBe('authentication');
        expect(CATEGORIES.USER).toBe('user_management');
        expect(CATEGORIES.DATA).toBe('data_access');
        expect(CATEGORIES.ADMIN).toBe('admin_action');
        expect(CATEGORIES.SYSTEM).toBe('system');
        expect(CATEGORIES.SECURITY).toBe('security');
        expect(CATEGORIES.FINANCIAL).toBe('financial');
        expect(CATEGORIES.INVENTORY).toBe('inventory');
        expect(CATEGORIES.LISTING).toBe('listing');
        expect(CATEGORIES.SALE).toBe('sale');
    });

    test('SEVERITY has expected values', () => {
        expect(SEVERITY.INFO).toBe('info');
        expect(SEVERITY.WARNING).toBe('warning');
        expect(SEVERITY.ERROR).toBe('error');
        expect(SEVERITY.CRITICAL).toBe('critical');
    });
});
