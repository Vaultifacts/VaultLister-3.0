// Error Handling Middleware
// Centralized error handling for consistent responses

import crypto from 'crypto';
import { ErrorCodes, logError, now } from '../shared/utils.js';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

/**
 * Custom application error class
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, field = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.field = field;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400, ErrorCodes.VALIDATION_ERROR, field);
    }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, ErrorCodes.NOT_FOUND);
    }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication required') {
        super(message, 401, ErrorCodes.UNAUTHORIZED);
    }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, ErrorCodes.FORBIDDEN);
    }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409, ErrorCodes.CONFLICT);
    }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
    constructor(retryAfter = 60) {
        super('Too many requests, please try again later', 429, ErrorCodes.RATE_LIMITED);
        this.retryAfter = retryAfter;
    }
}

/**
 * Format error response consistently
 */
export function formatErrorResponse(error, includeStack = false) {
    const response = {
        success: false,
        error: error.message || 'An unexpected error occurred',
        code: error.code || ErrorCodes.INTERNAL_ERROR
    };

    if (error.field) {
        response.field = error.field;
    }

    if (error.retryAfter) {
        response.retryAfter = error.retryAfter;
    }

    if (includeStack && error.stack) {
        response.stack = error.stack;
    }

    return response;
}

/**
 * Log error to database
 */
function logErrorToDb(error, context = {}) {
    try {
        const { method = 'UNKNOWN', path = 'UNKNOWN', userId = null, ip = 'UNKNOWN' } = context;

        query.run(`
            INSERT INTO error_logs (
                id, error_type, message, stack_trace, method, path,
                user_id, ip_address, context, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            crypto.randomUUID(),
            error.code || error.name || 'UnknownError',
            error.message,
            error.stack || null,
            method,
            path,
            userId,
            ip,
            JSON.stringify(context),
            now()
        ]);
    } catch (dbError) {
        // Silently fail - don't let logging errors break the app
        logger.error('[ErrorHandler] Failed to log error to database', null, { detail: dbError.message });
    }
}

/**
 * Global error handler
 */
export function handleError(error, ctx = {}) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Default to 500 for unexpected errors
    const statusCode = error.statusCode || error.status || 500;

    // Build context for logging
    const context = {
        method: ctx.method,
        path: ctx.path,
        userId: ctx.user?.id,
        ip: ctx.ip,
        requestId: ctx.requestId
    };

    // Log error
    logError(error.message, error, context);

    // Log to database for non-operational errors
    if (!error.isOperational || statusCode >= 500) {
        logErrorToDb(error, context);
    }

    // Format response
    const response = formatErrorResponse(error, isDevelopment);

    // For 500 errors in production, don't expose details
    if (statusCode >= 500 && !isDevelopment) {
        response.error = 'An unexpected error occurred. Please try again later.';
        delete response.stack;
    }

    return {
        status: statusCode,
        data: response
    };
}

/**
 * Async route handler wrapper
 * Catches errors and passes them to error handler
 */
export function catchAsync(fn) {
    return async (ctx) => {
        try {
            return await fn(ctx);
        } catch (error) {
            return handleError(error, ctx);
        }
    };
}

/**
 * Wrap all routes in a router object with error handling
 */
export function wrapRouterWithErrorHandling(routerFn) {
    return async (ctx) => {
        try {
            const result = await routerFn(ctx);
            return result;
        } catch (error) {
            return handleError(error, ctx);
        }
    };
}

/**
 * Common error messages
 */
export const ErrorMessages = {
    // Validation
    REQUIRED_FIELD: (field) => `${field} is required`,
    INVALID_FORMAT: (field) => `Invalid ${field} format`,
    MIN_LENGTH: (field, min) => `${field} must be at least ${min} characters`,
    MAX_LENGTH: (field, max) => `${field} must be at most ${max} characters`,
    OUT_OF_RANGE: (field, min, max) => `${field} must be between ${min} and ${max}`,
    INVALID_ENUM: (field, values) => `${field} must be one of: ${values.join(', ')}`,

    // Auth
    INVALID_CREDENTIALS: 'Invalid email or password',
    TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
    UNAUTHORIZED: 'You must be logged in to access this resource',

    // Resources
    NOT_FOUND: (resource) => `${resource} not found`,
    ALREADY_EXISTS: (resource) => `${resource} already exists`,
    CANNOT_DELETE: (resource, reason) => `Cannot delete ${resource}: ${reason}`,

    // Operations
    OPERATION_FAILED: (operation) => `Failed to ${operation}. Please try again.`,
    EXTERNAL_SERVICE_ERROR: 'An external service is temporarily unavailable',

    // Rate limiting
    RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
    BLOCKED: 'Your access has been temporarily restricted'
};

/**
 * Assert condition or throw error
 */
export function assert(condition, message, ErrorClass = ValidationError) {
    if (!condition) {
        throw new ErrorClass(message);
    }
}

/**
 * Assert resource exists or throw NotFoundError
 */
export function assertFound(resource, resourceName = 'Resource') {
    if (!resource) {
        throw new NotFoundError(resourceName);
    }
    return resource;
}

/**
 * Assert user is authorized or throw UnauthorizedError
 */
export function assertAuthorized(user, message = 'Authentication required') {
    if (!user) {
        throw new UnauthorizedError(message);
    }
    return user;
}

/**
 * Assert user has permission or throw ForbiddenError
 */
export function assertPermission(hasPermission, message = 'Access denied') {
    if (!hasPermission) {
        throw new ForbiddenError(message);
    }
}
