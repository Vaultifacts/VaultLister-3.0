// Unit tests for error handler classes and functions
import { describe, expect, test } from 'bun:test';
import {
    AppError, ValidationError, NotFoundError, UnauthorizedError,
    ForbiddenError, ConflictError, RateLimitError,
    formatErrorResponse, catchAsync, assert, assertFound,
    assertAuthorized, assertPermission
} from '../backend/middleware/errorHandler.js';

describe('AppError Classes', () => {
    test('AppError should have correct defaults', () => {
        const err = new AppError('test error');
        expect(err.message).toBe('test error');
        expect(err.statusCode).toBe(500);
        expect(err.isOperational).toBe(true);
        expect(err instanceof Error).toBe(true);
    });

    test('ValidationError should be 400', () => {
        const err = new ValidationError('bad input', 'email');
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.field).toBe('email');
    });

    test('NotFoundError should be 404', () => {
        const err = new NotFoundError('User');
        expect(err.statusCode).toBe(404);
        expect(err.code).toBe('NOT_FOUND');
        expect(err.message).toContain('User');
    });

    test('UnauthorizedError should be 401', () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });

    test('ForbiddenError should be 403', () => {
        const err = new ForbiddenError();
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
    });

    test('ConflictError should be 409', () => {
        const err = new ConflictError('Already exists');
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('CONFLICT');
    });

    test('RateLimitError should be 429 with retryAfter', () => {
        const err = new RateLimitError(120);
        expect(err.statusCode).toBe(429);
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.retryAfter).toBe(120);
    });
});

describe('formatErrorResponse', () => {
    test('should format AppError correctly', () => {
        const err = new ValidationError('Invalid email', 'email');
        const response = formatErrorResponse(err);
        expect(response.success).toBe(false);
        expect(response.error).toBe('Invalid email');
        expect(response.code).toBe('VALIDATION_ERROR');
        expect(response.field).toBe('email');
    });

    test('should format RateLimitError with retryAfter', () => {
        const err = new RateLimitError(60);
        const response = formatErrorResponse(err);
        expect(response.retryAfter).toBe(60);
    });

    test('should include stack trace when requested', () => {
        const err = new AppError('test');
        const response = formatErrorResponse(err, true);
        expect(response.stack).toBeDefined();
    });

    test('should omit stack trace by default', () => {
        const err = new AppError('test');
        const response = formatErrorResponse(err, false);
        expect(response.stack).toBeUndefined();
    });
});

describe('Assert Helpers', () => {
    test('assert should pass on truthy condition', () => {
        expect(() => assert(true, 'should not throw')).not.toThrow();
    });

    test('assert should throw ValidationError on falsy', () => {
        expect(() => assert(false, 'bad value')).toThrow();
        try {
            assert(false, 'bad value');
        } catch (e) {
            expect(e instanceof ValidationError).toBe(true);
            expect(e.message).toBe('bad value');
        }
    });

    test('assertFound should return resource if truthy', () => {
        const resource = { id: 1, name: 'test' };
        const result = assertFound(resource, 'Item');
        expect(result).toBe(resource);
    });

    test('assertFound should throw NotFoundError if falsy', () => {
        expect(() => assertFound(null, 'User')).toThrow();
        try {
            assertFound(null, 'User');
        } catch (e) {
            expect(e instanceof NotFoundError).toBe(true);
        }
    });

    test('assertAuthorized should return user if truthy', () => {
        const user = { id: 'u1' };
        expect(assertAuthorized(user)).toBe(user);
    });

    test('assertAuthorized should throw UnauthorizedError if falsy', () => {
        expect(() => assertAuthorized(null)).toThrow();
    });

    test('assertPermission should pass on true', () => {
        expect(() => assertPermission(true)).not.toThrow();
    });

    test('assertPermission should throw ForbiddenError on false', () => {
        expect(() => assertPermission(false)).toThrow();
    });
});

describe('catchAsync', () => {
    test('should return result for successful async fn', async () => {
        const fn = async () => ({ status: 200, data: { ok: true } });
        const wrapped = catchAsync(fn);
        const result = await wrapped({});
        expect(result.status).toBe(200);
    });

    test('should catch thrown errors and return error response', async () => {
        const fn = async () => { throw new ValidationError('oops'); };
        const wrapped = catchAsync(fn);
        const result = await wrapped({});
        expect(result.status).toBe(400);
    });
});
