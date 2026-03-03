// Shared Helpers — Unit Tests
import { describe, expect, test } from 'bun:test';
import {
    parseBoolean,
    parseIntBounded,
    parsePagination,
    buildPaginationMeta,
    safeJsonParse,
    validateRequired,
    validateLength,
    validateRange,
    validateEnum,
    validateEmail,
    validateUrl,
    validateHexColor,
    validatePrice,
    sanitizeString,
    successResponse,
    errorResponse,
    paginatedResponse,
    VALID_PLATFORMS,
    validatePlatform,
    VALID_CONDITIONS,
    validateCondition,
    VALID_INVENTORY_STATUSES,
    validateInventoryStatus,
    VALID_ORDER_STATUSES,
    validateOrderStatus
} from '../backend/shared/helpers.js';

describe('parseBoolean', () => {
    test('returns true for truthy strings', () => {
        expect(parseBoolean('true')).toBe(true);
        expect(parseBoolean('1')).toBe(true);
        expect(parseBoolean('yes')).toBe(true);
        expect(parseBoolean('TRUE')).toBe(true);
        expect(parseBoolean('Yes')).toBe(true);
    });

    test('returns false for falsy strings', () => {
        expect(parseBoolean('false')).toBe(false);
        expect(parseBoolean('0')).toBe(false);
        expect(parseBoolean('no')).toBe(false);
    });

    test('returns defaultValue for null/undefined', () => {
        expect(parseBoolean(null)).toBe(false);
        expect(parseBoolean(undefined)).toBe(false);
        expect(parseBoolean(null, true)).toBe(true);
        expect(parseBoolean(undefined, true)).toBe(true);
    });

    test('returns defaultValue for unrecognized strings', () => {
        expect(parseBoolean('maybe')).toBe(false);
        expect(parseBoolean('maybe', true)).toBe(true);
    });
});

describe('parseIntBounded', () => {
    test('parses valid integer within bounds', () => {
        expect(parseIntBounded('50', 1, 100, 10)).toBe(50);
    });

    test('clamps to min', () => {
        expect(parseIntBounded('-5', 0, 100, 10)).toBe(0);
    });

    test('clamps to max', () => {
        expect(parseIntBounded('200', 0, 100, 10)).toBe(100);
    });

    test('returns default for NaN', () => {
        expect(parseIntBounded('abc', 0, 100, 10)).toBe(10);
        expect(parseIntBounded(undefined, 0, 100, 25)).toBe(25);
    });
});

describe('parsePagination', () => {
    test('returns defaults for empty query', () => {
        const result = parsePagination({});
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(0);
        expect(result.page).toBe(1);
    });

    test('respects custom limit', () => {
        const result = parsePagination({ limit: '25' });
        expect(result.limit).toBe(25);
    });

    test('clamps limit to maxLimit', () => {
        const result = parsePagination({ limit: '500' }, { maxLimit: 100 });
        expect(result.limit).toBe(100);
    });

    test('computes offset from page', () => {
        const result = parsePagination({ page: '3', limit: '20' });
        expect(result.offset).toBe(40);
    });

    test('uses offset when no page given', () => {
        const result = parsePagination({ offset: '30' });
        expect(result.offset).toBe(30);
    });
});

describe('buildPaginationMeta', () => {
    test('builds correct metadata', () => {
        const meta = buildPaginationMeta(100, 10, 0);
        expect(meta.total).toBe(100);
        expect(meta.totalPages).toBe(10);
        expect(meta.currentPage).toBe(1);
        expect(meta.hasNextPage).toBe(true);
        expect(meta.hasPrevPage).toBe(false);
    });

    test('last page has no next', () => {
        const meta = buildPaginationMeta(100, 10, 90);
        expect(meta.currentPage).toBe(10);
        expect(meta.hasNextPage).toBe(false);
        expect(meta.hasPrevPage).toBe(true);
    });

    test('single page', () => {
        const meta = buildPaginationMeta(5, 50, 0);
        expect(meta.totalPages).toBe(1);
        expect(meta.hasNextPage).toBe(false);
        expect(meta.hasPrevPage).toBe(false);
    });
});

describe('safeJsonParse', () => {
    test('parses valid JSON', () => {
        expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    test('returns fallback for invalid JSON', () => {
        expect(safeJsonParse('not json')).toBeNull();
        expect(safeJsonParse('not json', [])).toEqual([]);
    });

    test('returns fallback for falsy input', () => {
        expect(safeJsonParse(null)).toBeNull();
        expect(safeJsonParse('', 'default')).toBe('default');
    });

    test('returns object as-is if already object', () => {
        const obj = { x: 1 };
        expect(safeJsonParse(obj)).toBe(obj);
    });
});

describe('validateRequired', () => {
    test('returns valid when all fields present', () => {
        expect(validateRequired({ a: 1, b: 'x' }, ['a', 'b'])).toEqual({ valid: true });
    });

    test('returns invalid with missing fields', () => {
        const result = validateRequired({ a: 1 }, ['a', 'b']);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('b');
    });

    test('treats empty string as missing', () => {
        const result = validateRequired({ a: '' }, ['a']);
        expect(result.valid).toBe(false);
    });

    test('treats null as missing', () => {
        const result = validateRequired({ a: null }, ['a']);
        expect(result.valid).toBe(false);
    });
});

describe('validateLength', () => {
    test('valid when within bounds', () => {
        expect(validateLength('hello', 'Name', 1, 10)).toEqual({ valid: true });
    });

    test('invalid when too short', () => {
        const result = validateLength('a', 'Name', 3);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 3');
    });

    test('invalid when too long', () => {
        const result = validateLength('toolongstring', 'Name', 0, 5);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('5 characters or less');
    });

    test('valid for empty when min is 0', () => {
        expect(validateLength('', 'Name', 0, 10)).toEqual({ valid: true });
    });

    test('invalid for empty when min > 0', () => {
        const result = validateLength('', 'Name', 1);
        expect(result.valid).toBe(false);
    });
});

describe('validateRange', () => {
    test('valid within range', () => {
        expect(validateRange(5, 'Age', 0, 100)).toEqual({ valid: true });
    });

    test('invalid below min', () => {
        const result = validateRange(-1, 'Age', 0, 100);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 0');
    });

    test('invalid above max', () => {
        const result = validateRange(101, 'Age', 0, 100);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at most 100');
    });

    test('invalid for non-number', () => {
        const result = validateRange('abc', 'Age', 0, 100);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('must be a number');
    });
});

describe('validateEnum', () => {
    test('valid for allowed value', () => {
        expect(validateEnum('red', 'Color', ['red', 'blue'])).toEqual({ valid: true });
    });

    test('invalid for disallowed value', () => {
        const result = validateEnum('green', 'Color', ['red', 'blue']);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('must be one of');
    });
});

describe('validateEmail', () => {
    test('valid email', () => {
        expect(validateEmail('test@example.com')).toEqual({ valid: true });
    });

    test('invalid email', () => {
        expect(validateEmail('not-an-email').valid).toBe(false);
        expect(validateEmail('@missing.com').valid).toBe(false);
    });

    test('null/empty returns invalid', () => {
        expect(validateEmail(null).valid).toBe(false);
        expect(validateEmail('').valid).toBe(false);
    });
});

describe('validateUrl', () => {
    test('valid URL', () => {
        expect(validateUrl('https://example.com')).toEqual({ valid: true });
    });

    test('invalid URL', () => {
        expect(validateUrl('not a url').valid).toBe(false);
    });

    test('null/empty is valid (optional)', () => {
        expect(validateUrl(null)).toEqual({ valid: true });
        expect(validateUrl('')).toEqual({ valid: true });
    });
});

describe('validateHexColor', () => {
    test('valid hex color', () => {
        expect(validateHexColor('#FF5733')).toEqual({ valid: true });
        expect(validateHexColor('#aabbcc')).toEqual({ valid: true });
    });

    test('invalid hex color', () => {
        expect(validateHexColor('red').valid).toBe(false);
        expect(validateHexColor('#FFF').valid).toBe(false);
        expect(validateHexColor('#GGGGGG').valid).toBe(false);
    });

    test('null/empty is valid (optional)', () => {
        expect(validateHexColor(null)).toEqual({ valid: true });
        expect(validateHexColor('')).toEqual({ valid: true });
    });
});

describe('validatePrice', () => {
    test('valid price', () => {
        expect(validatePrice(9.99)).toEqual({ valid: true });
        expect(validatePrice(0)).toEqual({ valid: true });
        expect(validatePrice('25.50')).toEqual({ valid: true });
    });

    test('negative price invalid', () => {
        expect(validatePrice(-1).valid).toBe(false);
    });

    test('exceeds max invalid', () => {
        expect(validatePrice(1000000).valid).toBe(false);
    });

    test('too many decimals invalid', () => {
        expect(validatePrice('9.999').valid).toBe(false);
    });

    test('non-number invalid', () => {
        expect(validatePrice('abc').valid).toBe(false);
    });

    test('null/undefined is valid (optional)', () => {
        expect(validatePrice(null)).toEqual({ valid: true });
        expect(validatePrice(undefined)).toEqual({ valid: true });
    });
});

describe('sanitizeString', () => {
    test('trims whitespace', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
    });

    test('truncates to maxLength', () => {
        expect(sanitizeString('abcdefghij', 5)).toBe('abcde');
    });

    test('returns falsy values as-is', () => {
        expect(sanitizeString(null)).toBeNull();
        expect(sanitizeString('')).toBe('');
    });
});

describe('successResponse', () => {
    test('builds success response with default status', () => {
        const res = successResponse({ items: [] });
        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.items).toEqual([]);
    });

    test('accepts custom status', () => {
        const res = successResponse({ id: 1 }, 201);
        expect(res.status).toBe(201);
    });
});

describe('errorResponse', () => {
    test('builds error response', () => {
        const res = errorResponse('Not found', 404);
        expect(res.status).toBe(404);
        expect(res.data.success).toBe(false);
        expect(res.data.error).toBe('Not found');
    });

    test('includes error code when provided', () => {
        const res = errorResponse('Bad input', 400, 'VALIDATION_ERROR');
        expect(res.data.code).toBe('VALIDATION_ERROR');
    });

    test('default status is 400', () => {
        const res = errorResponse('Oops');
        expect(res.status).toBe(400);
    });
});

describe('paginatedResponse', () => {
    test('builds paginated response', () => {
        const res = paginatedResponse(['a', 'b'], 10, 2, 0);
        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
        expect(res.data.items).toEqual(['a', 'b']);
        expect(res.data.total).toBe(10);
        expect(res.data.totalPages).toBe(5);
    });
});

describe('Constants', () => {
    test('VALID_PLATFORMS contains expected platforms', () => {
        expect(VALID_PLATFORMS).toContain('poshmark');
        expect(VALID_PLATFORMS).toContain('ebay');
        expect(VALID_PLATFORMS).toContain('mercari');
        expect(VALID_PLATFORMS).toContain('depop');
        expect(VALID_PLATFORMS.length).toBeGreaterThanOrEqual(10);
    });

    test('VALID_CONDITIONS contains expected values', () => {
        expect(VALID_CONDITIONS).toContain('new');
        expect(VALID_CONDITIONS).toContain('like_new');
        expect(VALID_CONDITIONS).toContain('good');
    });

    test('VALID_INVENTORY_STATUSES contains expected values', () => {
        expect(VALID_INVENTORY_STATUSES).toContain('draft');
        expect(VALID_INVENTORY_STATUSES).toContain('active');
        expect(VALID_INVENTORY_STATUSES).toContain('sold');
    });

    test('VALID_ORDER_STATUSES contains expected values', () => {
        expect(VALID_ORDER_STATUSES).toContain('pending');
        expect(VALID_ORDER_STATUSES).toContain('shipped');
        expect(VALID_ORDER_STATUSES).toContain('delivered');
    });
});

describe('validatePlatform', () => {
    test('valid platform', () => {
        expect(validatePlatform('ebay')).toEqual({ valid: true });
    });

    test('invalid platform', () => {
        expect(validatePlatform('unknown_platform').valid).toBe(false);
    });

    test('optional when not required', () => {
        expect(validatePlatform(null)).toEqual({ valid: true });
        expect(validatePlatform('')).toEqual({ valid: true });
    });

    test('required when flagged', () => {
        expect(validatePlatform(null, true).valid).toBe(false);
        expect(validatePlatform('', true).valid).toBe(false);
    });
});

describe('validateCondition', () => {
    test('valid condition', () => {
        expect(validateCondition('new')).toEqual({ valid: true });
    });

    test('invalid condition', () => {
        expect(validateCondition('broken').valid).toBe(false);
    });

    test('optional when not required', () => {
        expect(validateCondition(null)).toEqual({ valid: true });
    });

    test('required when flagged', () => {
        expect(validateCondition(null, true).valid).toBe(false);
    });
});

describe('validateInventoryStatus', () => {
    test('valid status', () => {
        expect(validateInventoryStatus('active')).toEqual({ valid: true });
    });

    test('invalid status', () => {
        expect(validateInventoryStatus('unknown').valid).toBe(false);
    });

    test('optional when not required', () => {
        expect(validateInventoryStatus(null)).toEqual({ valid: true });
    });

    test('required when flagged', () => {
        expect(validateInventoryStatus(null, true).valid).toBe(false);
    });
});

describe('validateOrderStatus', () => {
    test('valid status', () => {
        expect(validateOrderStatus('shipped')).toEqual({ valid: true });
    });

    test('invalid status', () => {
        expect(validateOrderStatus('lost').valid).toBe(false);
    });

    test('optional when not required', () => {
        expect(validateOrderStatus(null)).toEqual({ valid: true });
    });

    test('required when flagged', () => {
        expect(validateOrderStatus(null, true).valid).toBe(false);
    });
});
