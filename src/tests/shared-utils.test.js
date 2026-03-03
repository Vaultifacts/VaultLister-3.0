// Shared Utils — Unit Tests
import { describe, expect, test } from 'bun:test';
import {
    generateId,
    generateShortId,
    generatePrefixedId,
    now,
    today,
    daysAgo,
    daysFromNow,
    formatDate,
    formatDateTime,
    formatPrice,
    parsePrice,
    roundCurrency,
    calculatePercentage,
    truncate,
    capitalize,
    toTitleCase,
    toSlug,
    generateSKU,
    safeJsonParse,
    safeJsonStringify,
    unique,
    groupBy,
    sortBy,
    pick,
    omit,
    deepMerge,
    parsePagination,
    buildPaginationMeta,
    successResponse,
    errorResponse,
    paginatedResponse,
    ErrorCodes,
    createLogEntry
} from '../backend/shared/utils.js';

// ========== ID Generation ==========

describe('generateId', () => {
    test('returns a UUID v4 string', () => {
        const id = generateId();
        expect(typeof id).toBe('string');
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()));
        expect(ids.size).toBe(100);
    });
});

describe('generateShortId', () => {
    test('returns 8-character string', () => {
        const id = generateShortId();
        expect(id.length).toBe(8);
        expect(id).toMatch(/^[0-9a-f]{8}$/);
    });
});

describe('generatePrefixedId', () => {
    test('returns prefix-SHORTID format', () => {
        const id = generatePrefixedId('INV');
        expect(id).toMatch(/^INV-[0-9A-F]{8}$/);
    });

    test('works with different prefixes', () => {
        expect(generatePrefixedId('ORD').startsWith('ORD-')).toBe(true);
        expect(generatePrefixedId('SKU').startsWith('SKU-')).toBe(true);
    });
});

// ========== Date/Time Utilities ==========

describe('now', () => {
    test('returns ISO timestamp', () => {
        const result = now();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(new Date(result).getTime()).not.toBeNaN();
    });
});

describe('today', () => {
    test('returns YYYY-MM-DD format', () => {
        const result = today();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('daysAgo', () => {
    test('returns date in the past', () => {
        const result = daysAgo(7);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const diff = new Date(today()) - new Date(result);
        const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBe(7);
    });

    test('0 days ago is today', () => {
        expect(daysAgo(0)).toBe(today());
    });
});

describe('daysFromNow', () => {
    test('returns date in the future', () => {
        const result = daysFromNow(7);
        const diff = new Date(result) - new Date(today());
        const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBe(7);
    });
});

describe('formatDate', () => {
    test('formats date string', () => {
        const result = formatDate('2025-06-15');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('returns empty for falsy input', () => {
        expect(formatDate(null)).toBe('');
        expect(formatDate('')).toBe('');
    });
});

describe('formatDateTime', () => {
    test('formats date and time', () => {
        const result = formatDateTime('2025-06-15T14:30:00Z');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('returns empty for falsy input', () => {
        expect(formatDateTime(null)).toBe('');
    });
});

// ========== Price/Currency Utilities ==========

describe('formatPrice', () => {
    test('formats number as USD currency', () => {
        const result = formatPrice(9.99);
        expect(result).toContain('9.99');
        expect(result).toContain('$');
    });

    test('formats zero', () => {
        expect(formatPrice(0)).toContain('0.00');
    });

    test('handles null/undefined', () => {
        expect(formatPrice(null)).toContain('0.00');
        expect(formatPrice(undefined)).toContain('0.00');
    });
});

describe('parsePrice', () => {
    test('parses dollar string', () => {
        expect(parsePrice('$9.99')).toBe(9.99);
    });

    test('returns number as-is', () => {
        expect(parsePrice(25.50)).toBe(25.50);
    });

    test('parses string with commas', () => {
        expect(parsePrice('1,234.56')).toBe(1234.56);
    });

    test('returns 0 for falsy input', () => {
        expect(parsePrice(null)).toBe(0);
        expect(parsePrice('')).toBe(0);
    });
});

describe('roundCurrency', () => {
    test('rounds to 2 decimal places', () => {
        expect(roundCurrency(1.234)).toBe(1.23);
        expect(roundCurrency(1.235)).toBe(1.24);
        expect(roundCurrency(1.999)).toBe(2.00);
    });

    test('handles zero/null', () => {
        expect(roundCurrency(0)).toBe(0);
        expect(roundCurrency(null)).toBe(0);
    });
});

describe('calculatePercentage', () => {
    test('calculates percentage', () => {
        expect(calculatePercentage(25, 100)).toBe(25);
        expect(calculatePercentage(1, 3)).toBeCloseTo(33.33, 1);
    });

    test('returns 0 for zero total', () => {
        expect(calculatePercentage(5, 0)).toBe(0);
    });
});

// ========== String Utilities ==========

describe('truncate', () => {
    test('truncates long strings', () => {
        expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    test('does not truncate short strings', () => {
        expect(truncate('Hi', 50)).toBe('Hi');
    });

    test('handles falsy input', () => {
        expect(truncate(null)).toBe('');
        expect(truncate('')).toBe('');
    });
});

describe('capitalize', () => {
    test('capitalizes first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
    });

    test('handles single character', () => {
        expect(capitalize('a')).toBe('A');
    });

    test('handles falsy input', () => {
        expect(capitalize(null)).toBe('');
        expect(capitalize('')).toBe('');
    });
});

describe('toTitleCase', () => {
    test('converts to title case', () => {
        expect(toTitleCase('hello world')).toBe('Hello World');
    });

    test('lowercases subsequent characters', () => {
        expect(toTitleCase('hELLO wORLD')).toBe('Hello World');
    });

    test('handles falsy input', () => {
        expect(toTitleCase('')).toBe('');
    });
});

describe('toSlug', () => {
    test('converts string to slug', () => {
        expect(toSlug('Hello World!')).toBe('hello-world');
    });

    test('handles multiple spaces/dashes', () => {
        expect(toSlug('  foo   bar  ')).toBe('foo-bar');
    });

    test('removes special characters', () => {
        expect(toSlug('Hello@World#2024')).toBe('helloworld2024');
    });

    test('handles falsy input', () => {
        expect(toSlug('')).toBe('');
    });
});

describe('generateSKU', () => {
    test('generates SKU from string', () => {
        const sku = generateSKU('Nike Air Max');
        expect(sku).toMatch(/^NIKEAIRM-[A-Z0-9]{4}$/);
    });

    test('includes prefix when provided', () => {
        const sku = generateSKU('Shoes', 'SH');
        expect(sku.startsWith('SH-')).toBe(true);
    });

    test('generates random SKU for empty string', () => {
        const sku = generateSKU('');
        expect(typeof sku).toBe('string');
        expect(sku.length).toBeGreaterThan(0);
    });
});

// ========== JSON Utilities ==========

describe('safeJsonParse', () => {
    test('parses valid JSON', () => {
        expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    test('returns fallback for invalid', () => {
        expect(safeJsonParse('bad', [])).toEqual([]);
    });

    test('returns object as-is', () => {
        const obj = { x: 1 };
        expect(safeJsonParse(obj)).toBe(obj);
    });

    test('returns fallback for falsy', () => {
        expect(safeJsonParse(null)).toBeNull();
    });
});

describe('safeJsonStringify', () => {
    test('stringifies object', () => {
        expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
    });

    test('returns fallback for falsy input', () => {
        expect(safeJsonStringify(null)).toBe('{}');
        expect(safeJsonStringify(null, '[]')).toBe('[]');
    });
});

// ========== Array/Object Utilities ==========

describe('unique', () => {
    test('removes duplicates', () => {
        expect(unique([1, 2, 2, 3, 3])).toEqual([1, 2, 3]);
    });

    test('handles strings', () => {
        expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    test('handles empty array', () => {
        expect(unique([])).toEqual([]);
    });
});

describe('groupBy', () => {
    test('groups by string key', () => {
        const items = [
            { type: 'a', v: 1 },
            { type: 'b', v: 2 },
            { type: 'a', v: 3 }
        ];
        const result = groupBy(items, 'type');
        expect(result.a.length).toBe(2);
        expect(result.b.length).toBe(1);
    });

    test('groups by function key', () => {
        const result = groupBy([1, 2, 3, 4], n => n % 2 === 0 ? 'even' : 'odd');
        expect(result.even).toEqual([2, 4]);
        expect(result.odd).toEqual([1, 3]);
    });
});

describe('sortBy', () => {
    test('sorts ascending by key', () => {
        const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
        const result = sortBy(items, 'n');
        expect(result.map(i => i.n)).toEqual([1, 2, 3]);
    });

    test('sorts descending', () => {
        const items = [{ n: 1 }, { n: 3 }, { n: 2 }];
        const result = sortBy(items, 'n', 'desc');
        expect(result.map(i => i.n)).toEqual([3, 2, 1]);
    });

    test('does not mutate original', () => {
        const items = [{ n: 3 }, { n: 1 }];
        sortBy(items, 'n');
        expect(items[0].n).toBe(3);
    });

    test('sorts by function key', () => {
        const items = ['banana', 'apple', 'cherry'];
        const result = sortBy(items, s => s.length);
        expect(result).toEqual(['apple', 'banana', 'cherry']);
    });
});

describe('pick', () => {
    test('picks specified keys', () => {
        expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    test('ignores missing keys', () => {
        expect(pick({ a: 1 }, ['a', 'b'])).toEqual({ a: 1 });
    });
});

describe('omit', () => {
    test('omits specified keys', () => {
        expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
    });

    test('returns copy without mutation', () => {
        const original = { a: 1, b: 2 };
        omit(original, ['b']);
        expect(original.b).toBe(2);
    });
});

describe('deepMerge', () => {
    test('merges nested objects', () => {
        const target = { a: { x: 1 } };
        const source = { a: { y: 2 }, b: 3 };
        const result = deepMerge(target, source);
        expect(result.a.x).toBe(1);
        expect(result.a.y).toBe(2);
        expect(result.b).toBe(3);
    });

    test('overwrites non-object values', () => {
        const result = deepMerge({ a: 1 }, { a: 2 });
        expect(result.a).toBe(2);
    });

    test('merges multiple sources', () => {
        const result = deepMerge({}, { a: 1 }, { b: 2 }, { c: 3 });
        expect(result).toEqual({ a: 1, b: 2, c: 3 });
    });

    test('skips __proto__ for safety', () => {
        const target = {};
        const source = JSON.parse('{"__proto__": {"polluted": true}}');
        deepMerge(target, source);
        expect(({}).polluted).toBeUndefined();
    });
});

// ========== Pagination Utilities ==========

describe('parsePagination (utils)', () => {
    test('returns defaults for empty query', () => {
        const result = parsePagination({});
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(0);
        expect(result.page).toBe(1);
    });

    test('computes offset from page', () => {
        const result = parsePagination({ page: '2', limit: '10' });
        expect(result.offset).toBe(10);
    });

    test('clamps limit to max', () => {
        const result = parsePagination({ limit: '500' }, { maxLimit: 100 });
        expect(result.limit).toBe(100);
    });

    test('limit 0 falls back to default', () => {
        const result = parsePagination({ limit: '0' });
        // parseInt('0') is 0 which is falsy, so || default kicks in
        expect(result.limit).toBe(50);
    });
});

describe('buildPaginationMeta (utils)', () => {
    test('calculates correct meta', () => {
        const meta = buildPaginationMeta(50, 10, 20);
        expect(meta.total).toBe(50);
        expect(meta.totalPages).toBe(5);
        expect(meta.currentPage).toBe(3);
        expect(meta.hasNextPage).toBe(true);
        expect(meta.hasPrevPage).toBe(true);
    });
});

// ========== Response Builders ==========

describe('successResponse (utils)', () => {
    test('builds with default status 200', () => {
        const res = successResponse({ items: [] });
        expect(res.status).toBe(200);
        expect(res.data.success).toBe(true);
    });

    test('includes meta', () => {
        const res = successResponse({ items: [] }, 200, { total: 5 });
        expect(res.data.total).toBe(5);
    });
});

describe('errorResponse (utils)', () => {
    test('builds error with code and field', () => {
        const res = errorResponse('Invalid', 400, 'VALIDATION_ERROR', 'email');
        expect(res.status).toBe(400);
        expect(res.data.code).toBe('VALIDATION_ERROR');
        expect(res.data.field).toBe('email');
    });
});

describe('paginatedResponse (utils)', () => {
    test('builds paginated data', () => {
        const res = paginatedResponse([1, 2], 20, 10, 0);
        expect(res.data.items).toEqual([1, 2]);
        expect(res.data.total).toBe(20);
        expect(res.data.totalPages).toBe(2);
    });
});

// ========== Error Codes ==========

describe('ErrorCodes', () => {
    test('contains validation errors', () => {
        expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
        expect(ErrorCodes.MISSING_FIELD).toBe('MISSING_FIELD');
    });

    test('contains auth errors', () => {
        expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
        expect(ErrorCodes.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
    });

    test('contains server errors', () => {
        expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
        expect(ErrorCodes.DATABASE_ERROR).toBe('DATABASE_ERROR');
    });

    test('contains all expected categories', () => {
        expect(ErrorCodes.FORBIDDEN).toBeDefined();
        expect(ErrorCodes.NOT_FOUND).toBeDefined();
        expect(ErrorCodes.CONFLICT).toBeDefined();
        expect(ErrorCodes.RATE_LIMITED).toBeDefined();
    });
});

// ========== Logging ==========

describe('createLogEntry', () => {
    test('creates structured log entry', () => {
        const entry = createLogEntry('INFO', 'test message', { userId: '123' });
        expect(entry.level).toBe('INFO');
        expect(entry.message).toBe('test message');
        expect(entry.userId).toBe('123');
        expect(entry.timestamp).toBeDefined();
    });

    test('works without context', () => {
        const entry = createLogEntry('ERROR', 'oops');
        expect(entry.level).toBe('ERROR');
        expect(entry.message).toBe('oops');
    });
});
