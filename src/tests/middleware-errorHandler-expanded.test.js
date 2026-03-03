// Error Handler Middleware — Expanded Pure Function Tests
import { describe, expect, test } from 'bun:test';
import {
    ErrorMessages,
    formatErrorResponse,
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError,
    RateLimitError
} from '../backend/middleware/errorHandler.js';

describe('ErrorMessages', () => {
    test('REQUIRED_FIELD returns formatted message', () => {
        expect(ErrorMessages.REQUIRED_FIELD('email')).toBe('email is required');
    });

    test('INVALID_FORMAT returns formatted message', () => {
        expect(ErrorMessages.INVALID_FORMAT('date')).toBe('Invalid date format');
    });

    test('MIN_LENGTH returns formatted message', () => {
        expect(ErrorMessages.MIN_LENGTH('password', 8)).toBe('password must be at least 8 characters');
    });

    test('MAX_LENGTH returns formatted message', () => {
        expect(ErrorMessages.MAX_LENGTH('name', 100)).toBe('name must be at most 100 characters');
    });

    test('OUT_OF_RANGE returns formatted message', () => {
        expect(ErrorMessages.OUT_OF_RANGE('quantity', 1, 100)).toBe('quantity must be between 1 and 100');
    });

    test('INVALID_ENUM returns formatted message with values', () => {
        const msg = ErrorMessages.INVALID_ENUM('status', ['active', 'inactive']);
        expect(msg).toBe('status must be one of: active, inactive');
    });

    test('INVALID_CREDENTIALS is a string constant', () => {
        expect(typeof ErrorMessages.INVALID_CREDENTIALS).toBe('string');
        expect(ErrorMessages.INVALID_CREDENTIALS).toContain('Invalid');
    });

    test('TOKEN_EXPIRED is a string constant', () => {
        expect(typeof ErrorMessages.TOKEN_EXPIRED).toBe('string');
    });

    test('NOT_FOUND returns resource-specific message', () => {
        expect(ErrorMessages.NOT_FOUND('User')).toBe('User not found');
    });

    test('ALREADY_EXISTS returns resource-specific message', () => {
        expect(ErrorMessages.ALREADY_EXISTS('Item')).toBe('Item already exists');
    });

    test('OPERATION_FAILED returns operation-specific message', () => {
        expect(ErrorMessages.OPERATION_FAILED('save')).toContain('save');
    });
});

describe('formatErrorResponse edge cases', () => {
    test('formats AppError with all fields', () => {
        const error = new AppError('test error', 422, 'CUSTOM_CODE', 'myField');
        const response = formatErrorResponse(error);
        expect(response.error).toBe('test error');
        expect(response.code).toBe('CUSTOM_CODE');
        expect(response.field).toBe('myField');
    });

    test('formats plain Error without code or field', () => {
        const response = formatErrorResponse(new Error('plain error'));
        expect(response.error).toBeDefined();
    });

    test('includes stack trace when includeStack is true', () => {
        const response = formatErrorResponse(new Error('test'), true);
        expect(response.stack).toBeDefined();
    });

    test('excludes stack trace when includeStack is false', () => {
        const response = formatErrorResponse(new Error('test'), false);
        expect(response.stack).toBeUndefined();
    });
});

describe('Error class hierarchy', () => {
    test('ValidationError has statusCode 400', () => {
        const err = new ValidationError('bad input', 'name');
        expect(err.statusCode).toBe(400);
        expect(err.field).toBe('name');
        expect(err.isOperational).toBe(true);
    });

    test('NotFoundError has statusCode 404', () => {
        const err = new NotFoundError('Widget');
        expect(err.statusCode).toBe(404);
        expect(err.message).toContain('Widget');
    });

    test('UnauthorizedError has statusCode 401', () => {
        const err = new UnauthorizedError();
        expect(err.statusCode).toBe(401);
    });

    test('ForbiddenError has statusCode 403', () => {
        const err = new ForbiddenError();
        expect(err.statusCode).toBe(403);
    });

    test('ConflictError has statusCode 409', () => {
        const err = new ConflictError('Duplicate email');
        expect(err.statusCode).toBe(409);
        expect(err.message).toContain('Duplicate email');
    });

    test('RateLimitError has statusCode 429', () => {
        const err = new RateLimitError(120);
        expect(err.statusCode).toBe(429);
    });

    test('all error types are instances of AppError', () => {
        expect(new ValidationError('x') instanceof AppError).toBe(true);
        expect(new NotFoundError() instanceof AppError).toBe(true);
        expect(new UnauthorizedError() instanceof AppError).toBe(true);
        expect(new ForbiddenError() instanceof AppError).toBe(true);
        expect(new ConflictError() instanceof AppError).toBe(true);
        expect(new RateLimitError() instanceof AppError).toBe(true);
    });
});
