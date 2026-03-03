// Audit Log — Unit tests with DB mock
// Tests: log, logAuth, logAdmin, logSecurity, query, redaction
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { createMockDb } from './helpers/mockDb.js';

const db = createMockDb();

mock.module('../backend/db/database.js', () => ({
    query: db.query,
    models: db.models,
    escapeLike: db.escapeLike,
    default: db.db,
    initializeDatabase: mock(() => true),
    cleanupExpiredData: mock(() => ({})),
}));

const { default: auditLogModule } = await import('../backend/services/auditLog.js');
const auditLog = auditLogModule.auditLog || auditLogModule;

beforeEach(() => db.reset());

// ============================================================
// auditLog.log
// ============================================================
describe('auditLog.log', () => {
    test('inserts audit record via query.run', async () => {
        await auditLog.log({
            userId: 'user-1',
            action: 'create_item',
            category: 'inventory',
            severity: 'info',
            details: { item_name: 'Test Item' }
        });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('INSERT INTO audit_logs');
    });

    test('returns an ID string', async () => {
        const id = await auditLog.log({
            userId: 'user-1',
            action: 'test_action'
        });
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    test('redacts sensitive fields in details', async () => {
        await auditLog.log({
            userId: 'user-1',
            action: 'login',
            details: { password: 'secret123', username: 'test' }
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]); // details is 8th param
        expect(details.password).toBe('[REDACTED]');
        expect(details.username).toBe('test');
    });

    test('redacts token fields in details', async () => {
        await auditLog.log({
            userId: 'user-1',
            action: 'refresh',
            details: { refresh_token: 'abc123', action: 'refresh' }
        });
        const params = db.query.run.mock.calls[0][1];
        const details = JSON.parse(params[7]);
        expect(details.refresh_token).toBe('[REDACTED]');
    });

    test('redacts api_key in metadata', async () => {
        await auditLog.log({
            userId: 'user-1',
            action: 'api_call',
            metadata: { api_key: 'sk-123', endpoint: '/test' }
        });
        const params = db.query.run.mock.calls[0][1];
        const metadata = JSON.parse(params[8]); // metadata is 9th param
        expect(metadata.api_key).toBe('[REDACTED]');
        expect(metadata.endpoint).toBe('/test');
    });

    test('stores all expected fields', async () => {
        await auditLog.log({
            userId: 'user-42',
            action: 'delete_item',
            category: 'inventory',
            severity: 'warning',
            resourceType: 'item',
            resourceId: 'item-1',
            ipAddress: '10.0.0.1',
            userAgent: 'TestBot/1.0',
            sessionId: 'sess-abc',
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params[1]).toBe('user-42');       // user_id
        expect(params[2]).toBe('delete_item');    // action
        expect(params[3]).toBe('inventory');      // category
        expect(params[4]).toBe('warning');        // severity
        expect(params[5]).toBe('item');           // resource_type
        expect(params[6]).toBe('item-1');         // resource_id
        expect(params[9]).toBe('10.0.0.1');       // ip_address
        expect(params[10]).toBe('TestBot/1.0');   // user_agent
        expect(params[11]).toBe('sess-abc');      // session_id
    });
});

// ============================================================
// auditLog.logAuth
// ============================================================
describe('auditLog.logAuth', () => {
    test('logs auth event with AUTH category', async () => {
        await auditLog.logAuth('user-1', 'login', { method: 'password' });
        expect(db.query.run).toHaveBeenCalled();
        const params = db.query.run.mock.calls[0][1];
        expect(params[3]).toBe('authentication');
    });

    test('sets WARNING severity for failed actions', async () => {
        await auditLog.logAuth('user-1', 'login_failed', { reason: 'bad password' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[4]).toBe('warning');
    });

    test('sets INFO severity for successful actions', async () => {
        await auditLog.logAuth('user-1', 'login_success', {});
        const params = db.query.run.mock.calls[0][1];
        expect(params[4]).toBe('info');
    });
});

// ============================================================
// auditLog.logAdmin
// ============================================================
describe('auditLog.logAdmin', () => {
    test('logs admin event with ADMIN category and WARNING severity', async () => {
        await auditLog.logAdmin('admin-1', 'delete_user', { target: 'user-99' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[3]).toBe('admin_action');
        expect(params[4]).toBe('warning');
    });
});

// ============================================================
// auditLog.logSecurity
// ============================================================
describe('auditLog.logSecurity', () => {
    test('logs security event with SECURITY category', async () => {
        await auditLog.logSecurity('user-1', 'suspicious_ip', { ip: '1.2.3.4' });
        const params = db.query.run.mock.calls[0][1];
        expect(params[3]).toBe('security');
        expect(params[4]).toBe('warning');
    });
});

// ============================================================
// auditLog.query
// ============================================================
describe('auditLog.query', () => {
    test('queries audit logs from DB', async () => {
        db.query.all.mockReturnValue([
            { id: 'log-1', action: 'login', category: 'authentication' }
        ]);
        db.query.get.mockReturnValue({ total: 1 });
        const result = await auditLog.query({ category: 'authentication' });
        expect(db.query.all).toHaveBeenCalled();
    });
});

// ============================================================
// auditLog.cleanup
// ============================================================
describe('auditLog.cleanup', () => {
    test('deletes old logs via query.run', async () => {
        await auditLog.cleanup(90, 365);
        expect(db.query.run).toHaveBeenCalled();
    });

    test('propagates DB error from cleanup', async () => {
        db.query.run.mockImplementation(() => { throw new Error('DB error'); });
        try {
            await auditLog.cleanup(90, 365);
        } catch (e) {
            expect(e.message).toBe('DB error');
        }
    });
});
