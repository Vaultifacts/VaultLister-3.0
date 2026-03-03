// Error Handler — Unit tests for handleError, logErrorToDb, catchAsync, wrapRouterWithErrorHandling
// Uses DB mock to intercept query.run() calls from logErrorToDb
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

const {
    handleError,
    catchAsync,
    wrapRouterWithErrorHandling,
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
} = await import('../backend/middleware/errorHandler.js');

beforeEach(() => db.reset());

// ============================================================
// handleError
// ============================================================
describe('handleError', () => {
    test('returns 500 for generic Error', () => {
        const result = handleError(new Error('boom'), { method: 'GET', path: '/test' });
        expect(result.status).toBe(500);
        expect(result.data.success).toBe(false);
    });

    test('returns the statusCode from AppError', () => {
        const result = handleError(new NotFoundError('Item'), {});
        expect(result.status).toBe(404);
        expect(result.data.error).toContain('not found');
    });

    test('returns 401 for UnauthorizedError', () => {
        const result = handleError(new UnauthorizedError(), {});
        expect(result.status).toBe(401);
    });

    test('returns 403 for ForbiddenError', () => {
        const result = handleError(new ForbiddenError(), {});
        expect(result.status).toBe(403);
    });

    test('returns 400 for ValidationError', () => {
        const result = handleError(new ValidationError('bad input', 'email'), {});
        expect(result.status).toBe(400);
    });

    test('logs 500 errors to database via query.run', () => {
        handleError(new Error('server crash'), { method: 'POST', path: '/api/test', user: { id: 'u1' } });
        expect(db.query.run).toHaveBeenCalled();
        const callArgs = db.query.run.mock.calls[0];
        expect(callArgs[0]).toContain('INSERT INTO error_logs');
    });

    test('logs non-operational errors to database', () => {
        const err = new Error('unexpected');
        handleError(err, { method: 'GET', path: '/api/items' });
        expect(db.query.run).toHaveBeenCalled();
    });

    test('does NOT log operational 4xx errors to database', () => {
        handleError(new NotFoundError('Item'), { method: 'GET', path: '/api/items/1' });
        expect(db.query.run).not.toHaveBeenCalled();
    });

    test('does NOT log ValidationError to database', () => {
        handleError(new ValidationError('bad'), {});
        expect(db.query.run).not.toHaveBeenCalled();
    });

    test('does NOT log UnauthorizedError to database', () => {
        handleError(new UnauthorizedError(), {});
        expect(db.query.run).not.toHaveBeenCalled();
    });

    test('survives if DB write fails (silent failure)', () => {
        db.query.run.mockImplementation(() => { throw new Error('DB down'); });
        const result = handleError(new Error('crash'), {});
        expect(result.status).toBe(500);
        expect(result.data.success).toBe(false);
    });

    test('includes error context in DB insert', () => {
        handleError(new Error('fail'), {
            method: 'DELETE',
            path: '/api/items/123',
            user: { id: 'user-42' },
            ip: '10.0.0.1',
            requestId: 'req-abc'
        });
        const params = db.query.run.mock.calls[0][1];
        expect(params[4]).toBe('DELETE');
        expect(params[5]).toBe('/api/items/123');
        expect(params[6]).toBe('user-42');
        expect(params[7]).toBe('10.0.0.1');
    });

    test('hides details in production for 500 errors', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            const result = handleError(new Error('secret internal details'), {});
            expect(result.data.error).not.toContain('secret internal details');
            expect(result.data.stack).toBeUndefined();
        } finally {
            process.env.NODE_ENV = origEnv;
        }
    });
});

// ============================================================
// catchAsync
// ============================================================
describe('catchAsync', () => {
    test('returns result from successful handler', async () => {
        const handler = catchAsync(async () => ({ status: 200, data: { ok: true } }));
        const result = await handler({});
        expect(result.status).toBe(200);
    });

    test('catches thrown error and returns handleError result', async () => {
        const handler = catchAsync(async () => { throw new NotFoundError('Widget'); });
        const result = await handler({ method: 'GET', path: '/test' });
        expect(result.status).toBe(404);
        expect(result.data.success).toBe(false);
    });

    test('catches generic error and returns 500', async () => {
        const handler = catchAsync(async () => { throw new Error('boom'); });
        const result = await handler({});
        expect(result.status).toBe(500);
    });
});

// ============================================================
// wrapRouterWithErrorHandling
// ============================================================
describe('wrapRouterWithErrorHandling', () => {
    test('passes through successful router result', async () => {
        const router = async () => ({ status: 200, data: { items: [] } });
        const wrapped = wrapRouterWithErrorHandling(router);
        const result = await wrapped({ method: 'GET', path: '/test' });
        expect(result.status).toBe(200);
    });

    test('catches router errors and returns handleError result', async () => {
        const router = async () => { throw new ValidationError('invalid'); };
        const wrapped = wrapRouterWithErrorHandling(router);
        const result = await wrapped({});
        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
    });

    test('handles unexpected errors from router', async () => {
        const router = async () => { throw new Error('crash'); };
        const wrapped = wrapRouterWithErrorHandling(router);
        const result = await wrapped({});
        expect(result.status).toBe(500);
    });
});
