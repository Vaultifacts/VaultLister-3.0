// Common Helper Functions for Routes
// Reusable validation and transformation utilities

/**
 * Parse boolean from query string (case-insensitive)
 */
export function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null) return defaultValue;
    const str = String(value).toLowerCase();
    if (str === 'true' || str === '1' || str === 'yes') return true;
    if (str === 'false' || str === '0' || str === 'no') return false;
    return defaultValue;
}

/**
 * Parse integer with bounds checking
 */
export function parseIntBounded(value, min, max, defaultValue) {
    const num = parseInt(value);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
}

/**
 * Parse pagination parameters
 */
export function parsePagination(query, defaults = {}) {
    const limit = parseIntBounded(query.limit, 1, defaults.maxLimit || 100, defaults.limit || 50);
    const offset = Math.max(parseInt(query.offset) || 0, 0);
    const page = Math.max(parseInt(query.page) || 1, 1);

    return {
        limit,
        offset: query.page ? (page - 1) * limit : offset,
        page
    };
}

/**
 * Build pagination metadata for response
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
 * Validate required fields
 */
export function validateRequired(body, fields) {
    const missing = fields.filter(field => {
        const value = body[field];
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Validate string length
 */
export function validateLength(value, fieldName, min = 0, max = Infinity) {
    if (!value && min === 0) return { valid: true };
    if (!value) return { valid: false, error: `${fieldName} is required` };

    const len = String(value).length;
    if (len < min) return { valid: false, error: `${fieldName} must be at least ${min} characters` };
    if (len > max) return { valid: false, error: `${fieldName} must be ${max} characters or less` };

    return { valid: true };
}

/**
 * Validate numeric range
 */
export function validateRange(value, fieldName, min = -Infinity, max = Infinity) {
    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: `${fieldName} must be a number` };
    if (num < min) return { valid: false, error: `${fieldName} must be at least ${min}` };
    if (num > max) return { valid: false, error: `${fieldName} must be at most ${max}` };

    return { valid: true };
}

/**
 * Validate enum value
 */
export function validateEnum(value, fieldName, allowedValues) {
    if (!allowedValues.includes(value)) {
        return {
            valid: false,
            error: `${fieldName} must be one of: ${allowedValues.join(', ')}`
        };
    }
    return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') return { valid: false, error: 'Email is required' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url, fieldName = 'URL') {
    if (!url) return { valid: true };
    try {
        new URL(url);
        return { valid: true };
    } catch {
        return { valid: false, error: `Invalid ${fieldName} format` };
    }
}

/**
 * Validate hex color
 */
export function validateHexColor(color, fieldName = 'Color') {
    if (!color) return { valid: true };
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return { valid: false, error: `${fieldName} must be a valid hex color (e.g., #FF5733)` };
    }
    return { valid: true };
}

/**
 * Validate price (positive number with max 2 decimal places)
 */
export function validatePrice(value, fieldName = 'Price') {
    if (value === undefined || value === null) return { valid: true };

    const num = parseFloat(value);
    if (isNaN(num)) return { valid: false, error: `${fieldName} must be a number` };
    if (num < 0) return { valid: false, error: `${fieldName} must be non-negative` };
    if (num > 999999.99) return { valid: false, error: `${fieldName} exceeds maximum value` };

    // Check decimal places
    const parts = String(value).split('.');
    if (parts[1] && parts[1].length > 2) {
        return { valid: false, error: `${fieldName} can have at most 2 decimal places` };
    }

    return { valid: true };
}

/**
 * Sanitize string for database (trim whitespace)
 */
export function sanitizeString(value, maxLength = null) {
    if (!value) return value;
    let str = String(value).trim();
    if (maxLength && str.length > maxLength) {
        str = str.substring(0, maxLength);
    }
    return str;
}

/**
 * Build success response
 */
export function successResponse(data, status = 200) {
    return { status, data: { success: true, ...data } };
}

/**
 * Build error response
 */
export function errorResponse(message, status = 400, code = null) {
    const response = { status, data: { success: false, error: message } };
    if (code) response.data.code = code;
    return response;
}

/**
 * Build paginated response
 */
export function paginatedResponse(items, total, limit, offset) {
    return {
        status: 200,
        data: {
            success: true,
            items,
            ...buildPaginationMeta(total, limit, offset)
        }
    };
}

/**
 * Standard platform validation
 */
export const VALID_PLATFORMS = [
    'poshmark', 'ebay', 'mercari', 'depop', 'grailed',
    'facebook', 'etsy', 'shopify', 'whatnot', 'amazon', 'other'
];

export function validatePlatform(platform, required = false) {
    if (!platform && !required) return { valid: true };
    if (!platform && required) return { valid: false, error: 'Platform is required' };
    if (!VALID_PLATFORMS.includes(platform)) {
        return { valid: false, error: `Platform must be one of: ${VALID_PLATFORMS.join(', ')}` };
    }
    return { valid: true };
}

/**
 * Standard condition validation
 */
export const VALID_CONDITIONS = ['new', 'like_new', 'good', 'fair', 'poor'];

export function validateCondition(condition, required = false) {
    if (!condition && !required) return { valid: true };
    if (!condition && required) return { valid: false, error: 'Condition is required' };
    if (!VALID_CONDITIONS.includes(condition)) {
        return { valid: false, error: `Condition must be one of: ${VALID_CONDITIONS.join(', ')}` };
    }
    return { valid: true };
}

/**
 * Standard status validation for inventory
 */
export const VALID_INVENTORY_STATUSES = ['draft', 'active', 'sold', 'archived', 'deleted'];

export function validateInventoryStatus(status, required = false) {
    if (!status && !required) return { valid: true };
    if (!status && required) return { valid: false, error: 'Status is required' };
    if (!VALID_INVENTORY_STATUSES.includes(status)) {
        return { valid: false, error: `Status must be one of: ${VALID_INVENTORY_STATUSES.join(', ')}` };
    }
    return { valid: true };
}

/**
 * Standard order status validation
 */
export const VALID_ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'];

export function validateOrderStatus(status, required = false) {
    if (!status && !required) return { valid: true };
    if (!status && required) return { valid: false, error: 'Status is required' };
    if (!VALID_ORDER_STATUSES.includes(status)) {
        return { valid: false, error: `Status must be one of: ${VALID_ORDER_STATUSES.join(', ')}` };
    }
    return { valid: true };
}
