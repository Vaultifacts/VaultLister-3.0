// Shared Utility Functions
// Common utilities used across the VaultLister backend

import { v4 as uuidv4 } from 'uuid';

// ========== ID Generation ==========

/**
 * Generate a UUID v4
 */
export function generateId() {
    return uuidv4();
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId() {
    return uuidv4().replace(/-/g, '').substring(0, 8);
}

/**
 * Generate a prefixed ID (e.g., INV-12345678)
 */
export function generatePrefixedId(prefix) {
    return `${prefix}-${generateShortId().toUpperCase()}`;
}

// ========== Date/Time Utilities ==========

/**
 * Get current ISO timestamp
 */
export function now() {
    return new Date().toISOString();
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function today() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get date N days ago in YYYY-MM-DD format
 */
export function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
}

/**
 * Get date N days from now in YYYY-MM-DD format
 */
export function daysFromNow(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

/**
 * Format date for display
 * @param {string} dateString
 * @param {object} [options] - Intl.DateTimeFormat options
 * @param {string} [locale='en-US'] - BCP 47 locale tag
 */
export function formatDate(dateString, options = {}, locale = 'en-US') {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    });
}

/**
 * Format date and time for display
 * @param {string} dateString
 * @param {object} [options] - Intl.DateTimeFormat options
 * @param {string} [locale='en-US'] - BCP 47 locale tag
 */
export function formatDateTime(dateString, options = {}, locale = 'en-US') {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
    });
}

// ========== Price/Currency Utilities ==========

/**
 * Format price for display
 * @param {number} amount
 * @param {string} [currency='USD']
 * @param {string} [locale='en-US'] - BCP 47 locale tag
 */
export function formatPrice(amount, currency = 'USD', locale = 'en-US') {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
}

/**
 * Parse price string to number
 */
export function parsePrice(priceString) {
    if (typeof priceString === 'number') return priceString;
    if (!priceString) return 0;
    return parseFloat(priceString.toString().replace(/[^0-9.-]/g, '')) || 0;
}

/**
 * Round to 2 decimal places
 */
export function roundCurrency(amount) {
    return Math.round((amount || 0) * 100) / 100;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value, total) {
    if (!total || total === 0) return 0;
    return roundCurrency((value / total) * 100);
}

// ========== HTML Utilities ==========

export function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ========== String Utilities ==========

/**
 * Truncate string with ellipsis
 */
export function truncate(str, maxLength = 50) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert to title case
 */
export function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, txt =>
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
    );
}

/**
 * Convert to slug (URL-friendly)
 */
export function toSlug(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Generate SKU from string
 */
export function generateSKU(str, prefix = '') {
    if (!str) return prefix + generateShortId().toUpperCase();
    const base = str
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 8);
    const suffix = generateShortId().substring(0, 4).toUpperCase();
    return prefix ? `${prefix}-${base}-${suffix}` : `${base}-${suffix}`;
}

// ========== JSON Utilities ==========

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse(str, fallback = null) {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

/**
 * Safely stringify JSON
 */
export function safeJsonStringify(obj, fallback = '{}') {
    if (!obj) return fallback;
    try {
        return JSON.stringify(obj);
    } catch {
        return fallback;
    }
}

// ========== Array/Object Utilities ==========

/**
 * Remove duplicates from array
 */
export function unique(arr) {
    return [...new Set(arr)];
}

/**
 * Group array by key
 */
export function groupBy(arr, key) {
    return arr.reduce((groups, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        (groups[value] = groups[value] || []).push(item);
        return groups;
    }, {});
}

/**
 * Sort array by key
 */
export function sortBy(arr, key, order = 'asc') {
    const sorted = [...arr].sort((a, b) => {
        const valA = typeof key === 'function' ? key(a) : a[key];
        const valB = typeof key === 'function' ? key(b) : b[key];
        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
    });
    return order === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Pick specific keys from object
 */
export function pick(obj, keys) {
    return keys.reduce((result, key) => {
        if (key in obj) result[key] = obj[key];
        return result;
    }, {});
}

/**
 * Omit specific keys from object
 */
export function omit(obj, keys) {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
}

/**
 * Deep merge objects
 */
export function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        for (const key of Object.keys(source)) {
            // Skip dangerous keys and properties not owned by source
            if (dangerousKeys.includes(key)) continue;
            if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

// ========== Pagination Utilities ==========

/**
 * Parse pagination parameters from query
 */
export function parsePagination(query, defaults = {}) {
    const limit = Math.min(
        Math.max(parseInt(query.limit) || defaults.limit || 50, 1),
        defaults.maxLimit || 100
    );
    const offset = Math.max(parseInt(query.offset) || 0, 0);
    const page = Math.max(parseInt(query.page) || 1, 1);

    return {
        limit,
        offset: query.page ? (page - 1) * limit : offset,
        page
    };
}

/**
 * Build pagination response metadata
 */
export function buildPaginationMeta(total, limit, offset) {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    return {
        total,
        limit,
        offset,
        totalPages,
        currentPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
    };
}

// ========== Response Builders ==========

/**
 * Build success response
 */
export function successResponse(data, status = 200, meta = {}) {
    return {
        status,
        data: {
            success: true,
            ...data,
            ...meta
        }
    };
}

/**
 * Build error response
 */
export function errorResponse(message, status = 400, code = null, field = null) {
    const response = {
        status,
        data: {
            success: false,
            error: message
        }
    };

    if (code) response.data.code = code;
    if (field) response.data.field = field;

    return response;
}

/**
 * Build paginated response
 */
export function paginatedResponse(items, total, limit, offset) {
    return {
        status: 200,
        data: {
            items,
            ...buildPaginationMeta(total, limit, offset)
        }
    };
}

// ========== Error Codes ==========

export const ErrorCodes = {
    // Validation errors (400)
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    MISSING_FIELD: 'MISSING_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    OUT_OF_RANGE: 'OUT_OF_RANGE',

    // Authentication errors (401)
    UNAUTHORIZED: 'UNAUTHORIZED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',

    // Authorization errors (403)
    FORBIDDEN: 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Not found errors (404)
    NOT_FOUND: 'NOT_FOUND',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

    // Conflict errors (409)
    CONFLICT: 'CONFLICT',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    ALREADY_EXISTS: 'ALREADY_EXISTS',

    // Rate limit errors (429)
    RATE_LIMITED: 'RATE_LIMITED',

    // Server errors (500)
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR'
};

// ========== Logging Utilities ==========

/**
 * Create a structured log entry
 */
export function createLogEntry(level, message, context = {}) {
    return {
        timestamp: now(),
        level,
        message,
        ...context
    };
}

/**
 * Log info message
 */
export function logInfo(message, context = {}) {
    console.log(JSON.stringify(createLogEntry('INFO', message, context)));
}

/**
 * Log warning message
 */
export function logWarn(message, context = {}) {
    console.warn(JSON.stringify(createLogEntry('WARN', message, context)));
}

/**
 * Log error message
 */
export function logError(message, error = null, context = {}) {
    const entry = createLogEntry('ERROR', message, context);
    if (error) {
        entry.error = {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
    }
    console.error(JSON.stringify(entry));
}
