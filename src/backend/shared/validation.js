// Shared Validation Functions
// Input validation utilities for VaultLister backend

import { errorResponse, ErrorCodes } from './utils.js';

// ========== Basic Validators ==========

/**
 * Check if value is present (not null, undefined, or empty string)
 */
export function isPresent(value) {
    return value !== null && value !== undefined && value !== '';
}

/**
 * Check if value is a non-empty string
 */
export function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value) {
    if (typeof value === 'number') return !isNaN(value) && isFinite(value);
    if (typeof value === 'string') {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
    }
    return false;
}

/**
 * Check if value is a positive number
 */
export function isPositiveNumber(value) {
    return isValidNumber(value) && parseFloat(value) > 0;
}

/**
 * Check if value is a non-negative number
 */
export function isNonNegativeNumber(value) {
    return isValidNumber(value) && parseFloat(value) >= 0;
}

/**
 * Check if value is a valid integer
 */
export function isValidInteger(value) {
    return Number.isInteger(Number(value));
}

/**
 * Check if value is within range
 */
export function isInRange(value, min, max) {
    const num = parseFloat(value);
    return isValidNumber(value) && num >= min && num <= max;
}

// ========== String Validators ==========

/**
 * Check if string matches minimum length
 */
export function minLength(value, min) {
    return typeof value === 'string' && value.length >= min;
}

/**
 * Check if string matches maximum length
 */
export function maxLength(value, max) {
    return typeof value === 'string' && value.length <= max;
}

/**
 * Check if string is within length range
 */
export function lengthInRange(value, min, max) {
    return minLength(value, min) && maxLength(value, max);
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Validate URL format
 */
export function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate phone number format (flexible)
 */
export function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    // Allow digits, spaces, dashes, parentheses, plus sign
    const phoneRegex = /^[\d\s\-()+ ]{7,20}$/;
    return phoneRegex.test(phone.trim());
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

/**
 * Validate ISO datetime format
 */
export function isValidISODateTime(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate slug format
 */
export function isValidSlug(slug) {
    if (!slug || typeof slug !== 'string') return false;
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    return slugRegex.test(slug);
}

// ========== Enum Validators ==========

/**
 * Check if value is in allowed list
 */
export function isOneOf(value, allowedValues) {
    return allowedValues.includes(value);
}

/**
 * Check if all values in array are in allowed list
 */
export function areAllOneOf(values, allowedValues) {
    if (!Array.isArray(values)) return false;
    return values.every(v => allowedValues.includes(v));
}

// ========== Array Validators ==========

/**
 * Check if value is an array
 */
export function isArray(value) {
    return Array.isArray(value);
}

/**
 * Check if array is non-empty
 */
export function isNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

/**
 * Check if array has minimum length
 */
export function arrayMinLength(value, min) {
    return Array.isArray(value) && value.length >= min;
}

/**
 * Check if array has maximum length
 */
export function arrayMaxLength(value, max) {
    return Array.isArray(value) && value.length <= max;
}

// ========== Object Validators ==========

/**
 * Check if value is a plain object
 */
export function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if object has required keys
 */
export function hasRequiredKeys(obj, keys) {
    if (!isObject(obj)) return false;
    return keys.every(key => key in obj && isPresent(obj[key]));
}

// ========== Business Logic Validators ==========

/**
 * Validate price (positive, 2 decimal places max)
 */
export function isValidPrice(price) {
    if (!isNonNegativeNumber(price)) return false;
    const num = parseFloat(price);
    const decimals = (num.toString().split('.')[1] || '').length;
    return decimals <= 2 && num <= 999999.99;
}

/**
 * Validate quantity (positive integer)
 */
export function isValidQuantity(qty) {
    return isValidInteger(qty) && parseInt(qty) >= 0 && parseInt(qty) <= 999999;
}

/**
 * Validate SKU format
 */
export function isValidSKU(sku) {
    if (!sku || typeof sku !== 'string') return false;
    // Allow alphanumeric, dashes, underscores
    const skuRegex = /^[A-Za-z0-9_-]{1,50}$/;
    return skuRegex.test(sku);
}

/**
 * Validate barcode (UPC/EAN)
 */
export function isValidBarcode(barcode) {
    if (!barcode || typeof barcode !== 'string') return false;
    // UPC-A (12 digits) or EAN-13 (13 digits)
    const barcodeRegex = /^\d{12,13}$/;
    return barcodeRegex.test(barcode);
}

// ========== Validation Schema Builder ==========

/**
 * Create a validation schema
 */
export function createSchema(rules) {
    return {
        rules,
        validate(data) {
            const errors = [];

            for (const [field, fieldRules] of Object.entries(rules)) {
                const value = data[field];

                for (const rule of fieldRules) {
                    const result = rule.validate(value, data);
                    if (!result.valid) {
                        errors.push({
                            field,
                            message: rule.message || result.message,
                            code: rule.code || 'VALIDATION_ERROR'
                        });
                        break; // Stop on first error for this field
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }
    };
}

// ========== Common Rules ==========

export const Rules = {
    required: (message = 'This field is required') => ({
        validate: (value) => ({ valid: isPresent(value) }),
        message,
        code: ErrorCodes.MISSING_FIELD
    }),

    string: (message = 'Must be a string') => ({
        validate: (value) => ({ valid: !isPresent(value) || typeof value === 'string' }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    nonEmptyString: (message = 'Must be a non-empty string') => ({
        validate: (value) => ({ valid: !isPresent(value) || isNonEmptyString(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    email: (message = 'Invalid email format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidEmail(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    url: (message = 'Invalid URL format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidUrl(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    phone: (message = 'Invalid phone number format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidPhone(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    number: (message = 'Must be a valid number') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidNumber(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    positiveNumber: (message = 'Must be a positive number') => ({
        validate: (value) => ({ valid: !isPresent(value) || isPositiveNumber(value) }),
        message,
        code: ErrorCodes.OUT_OF_RANGE
    }),

    nonNegativeNumber: (message = 'Must be zero or greater') => ({
        validate: (value) => ({ valid: !isPresent(value) || isNonNegativeNumber(value) }),
        message,
        code: ErrorCodes.OUT_OF_RANGE
    }),

    integer: (message = 'Must be an integer') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidInteger(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    price: (message = 'Invalid price format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidPrice(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    quantity: (message = 'Invalid quantity') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidQuantity(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    minLength: (min, message) => ({
        validate: (value) => ({ valid: !isPresent(value) || minLength(value, min) }),
        message: message || `Must be at least ${min} characters`,
        code: ErrorCodes.OUT_OF_RANGE
    }),

    maxLength: (max, message) => ({
        validate: (value) => ({ valid: !isPresent(value) || maxLength(value, max) }),
        message: message || `Must be at most ${max} characters`,
        code: ErrorCodes.OUT_OF_RANGE
    }),

    range: (min, max, message) => ({
        validate: (value) => ({ valid: !isPresent(value) || isInRange(value, min, max) }),
        message: message || `Must be between ${min} and ${max}`,
        code: ErrorCodes.OUT_OF_RANGE
    }),

    oneOf: (values, message) => ({
        validate: (value) => ({ valid: !isPresent(value) || isOneOf(value, values) }),
        message: message || `Must be one of: ${values.join(', ')}`,
        code: ErrorCodes.INVALID_INPUT
    }),

    date: (message = 'Invalid date format (YYYY-MM-DD)') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidDateFormat(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    datetime: (message = 'Invalid datetime format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidISODateTime(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    uuid: (message = 'Invalid UUID format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidUUID(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    array: (message = 'Must be an array') => ({
        validate: (value) => ({ valid: !isPresent(value) || isArray(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    nonEmptyArray: (message = 'Must be a non-empty array') => ({
        validate: (value) => ({ valid: !isPresent(value) || isNonEmptyArray(value) }),
        message,
        code: ErrorCodes.INVALID_INPUT
    }),

    object: (message = 'Must be an object') => ({
        validate: (value) => ({ valid: !isPresent(value) || isObject(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    sku: (message = 'Invalid SKU format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidSKU(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    barcode: (message = 'Invalid barcode format') => ({
        validate: (value) => ({ valid: !isPresent(value) || isValidBarcode(value) }),
        message,
        code: ErrorCodes.INVALID_FORMAT
    }),

    custom: (validator, message) => ({
        validate: (value, data) => ({ valid: validator(value, data) }),
        message,
        code: ErrorCodes.VALIDATION_ERROR
    })
};

// ========== Validation Middleware Helper ==========

/**
 * Create validation middleware from schema
 */
export function validateRequest(schema, bodyKey = 'body') {
    return (ctx) => {
        const data = ctx[bodyKey] || {};
        const result = schema.validate(data);

        if (!result.valid) {
            return errorResponse(
                result.errors[0].message,
                400,
                result.errors[0].code,
                result.errors[0].field
            );
        }

        return null; // Validation passed
    };
}

// ========== Common Validation Schemas ==========

export const CommonSchemas = {
    // Inventory item creation/update
    inventoryItem: createSchema({
        title: [Rules.required(), Rules.nonEmptyString(), Rules.maxLength(200)],
        listPrice: [Rules.price()],
        costPrice: [Rules.price()],
        quantity: [Rules.quantity()],
        sku: [Rules.sku()],
        category: [Rules.maxLength(100)],
        brand: [Rules.maxLength(100)],
        condition: [Rules.oneOf(['new', 'like_new', 'good', 'fair', 'poor'])]
    }),

    // User registration
    userRegistration: createSchema({
        email: [Rules.required(), Rules.email()],
        password: [Rules.required(), Rules.minLength(8), Rules.maxLength(128)],
        name: [Rules.nonEmptyString(), Rules.maxLength(100)]
    }),

    // Contact form
    contactForm: createSchema({
        name: [Rules.required(), Rules.nonEmptyString(), Rules.maxLength(100)],
        email: [Rules.required(), Rules.email()],
        message: [Rules.required(), Rules.nonEmptyString(), Rules.maxLength(5000)]
    }),

    // Pagination parameters
    pagination: createSchema({
        limit: [Rules.positiveNumber(), Rules.range(1, 100)],
        offset: [Rules.nonNegativeNumber()],
        page: [Rules.positiveNumber()]
    })
};
