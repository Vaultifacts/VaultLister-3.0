// Request Logger Middleware Unit Tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { createRequestContext, createRequestLogger, AuditActions } from '../backend/middleware/requestLogger.js';

// ============================================================
// AuditActions Constants
// ============================================================
describe('RequestLogger - AuditActions', () => {
    test('LOGIN equals "LOGIN"', () => {
        expect(AuditActions.LOGIN).toBe('LOGIN');
    });

    test('CREATE equals "CREATE"', () => {
        expect(AuditActions.CREATE).toBe('CREATE');
    });

    test('DELETE equals "DELETE"', () => {
        expect(AuditActions.DELETE).toBe('DELETE');
    });

    test('has all expected authentication keys', () => {
        expect(AuditActions.LOGOUT).toBe('LOGOUT');
        expect(AuditActions.PASSWORD_CHANGE).toBe('PASSWORD_CHANGE');
        expect(AuditActions.PASSWORD_RESET).toBe('PASSWORD_RESET');
    });

    test('has all expected CRUD keys', () => {
        expect(AuditActions.READ).toBe('READ');
        expect(AuditActions.UPDATE).toBe('UPDATE');
        expect(AuditActions.BULK_CREATE).toBe('BULK_CREATE');
        expect(AuditActions.BULK_DELETE).toBe('BULK_DELETE');
    });

    test('has integration keys', () => {
        expect(AuditActions.OAUTH_CONNECT).toBe('OAUTH_CONNECT');
        expect(AuditActions.OAUTH_DISCONNECT).toBe('OAUTH_DISCONNECT');
        expect(AuditActions.WEBHOOK_CREATE).toBe('WEBHOOK_CREATE');
    });
});

// ============================================================
// createRequestContext
// ============================================================
describe('RequestLogger - createRequestContext', () => {
    test('returns object with requestId, method, path', () => {
        const req = new Request('http://localhost:3000/api/test', { method: 'GET' });
        const ctx = createRequestContext(req);
        expect(ctx.requestId).toBeDefined();
        expect(ctx.method).toBe('GET');
        expect(ctx.path).toBe('/api/test');
    });

    test('generates unique requestIds', () => {
        const req1 = new Request('http://localhost:3000/api/a', { method: 'GET' });
        const req2 = new Request('http://localhost:3000/api/b', { method: 'GET' });
        const ctx1 = createRequestContext(req1);
        const ctx2 = createRequestContext(req2);
        expect(ctx1.requestId).not.toBe(ctx2.requestId);
    });

    test('extracts query parameters', () => {
        const req = new Request('http://localhost:3000/api/test?page=1&limit=20', { method: 'GET' });
        const ctx = createRequestContext(req);
        expect(ctx.query.page).toBe('1');
        expect(ctx.query.limit).toBe('20');
    });

    test('includes timestamp and startTime', () => {
        const req = new Request('http://localhost:3000/api/test', { method: 'GET' });
        const ctx = createRequestContext(req);
        expect(ctx.timestamp).toBeDefined();
        expect(typeof ctx.startTime).toBe('number');
    });

    test('extracts user-agent header', () => {
        const req = new Request('http://localhost:3000/api/test', {
            method: 'GET',
            headers: { 'user-agent': 'TestAgent/1.0' }
        });
        const ctx = createRequestContext(req);
        expect(ctx.userAgent).toBe('TestAgent/1.0');
    });

    test('defaults userAgent to "unknown" when missing', () => {
        const req = new Request('http://localhost:3000/api/test', { method: 'GET' });
        const ctx = createRequestContext(req);
        expect(ctx.userAgent).toBe('unknown');
    });

    test('extracts referer header', () => {
        const req = new Request('http://localhost:3000/api/test', {
            method: 'GET',
            headers: { 'referer': 'http://example.com' }
        });
        const ctx = createRequestContext(req);
        expect(ctx.referer).toBe('http://example.com');
    });

    test('returns "unknown" IP without TRUST_PROXY', () => {
        const origTrust = process.env.TRUST_PROXY;
        delete process.env.TRUST_PROXY;
        const req = new Request('http://localhost:3000/api/test', {
            method: 'GET',
            headers: { 'x-forwarded-for': '1.2.3.4' }
        });
        const ctx = createRequestContext(req);
        expect(ctx.ip).toBe('unknown');
        if (origTrust !== undefined) process.env.TRUST_PROXY = origTrust;
    });
});

// ============================================================
// createRequestLogger factory
// ============================================================
describe('RequestLogger - createRequestLogger', () => {
    test('returns object with before and after functions', () => {
        const logger = createRequestLogger();
        expect(typeof logger.before).toBe('function');
        expect(typeof logger.after).toBe('function');
    });
});
