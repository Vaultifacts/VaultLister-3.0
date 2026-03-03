// Shared Constants — Unit Tests
import { describe, expect, test } from 'bun:test';
import { PAGINATION, CONTENT_LIMITS, CACHE, TIMEOUTS } from '../backend/shared/constants.js';

describe('PAGINATION', () => {
    test('has DEFAULT_LIMIT of 50', () => {
        expect(PAGINATION.DEFAULT_LIMIT).toBe(50);
    });

    test('has MAX_LIMIT of 200', () => {
        expect(PAGINATION.MAX_LIMIT).toBe(200);
    });

    test('MAX_LIMIT >= DEFAULT_LIMIT', () => {
        expect(PAGINATION.MAX_LIMIT).toBeGreaterThanOrEqual(PAGINATION.DEFAULT_LIMIT);
    });
});

describe('CONTENT_LIMITS', () => {
    test('has TITLE_MAX_LENGTH of 200', () => {
        expect(CONTENT_LIMITS.TITLE_MAX_LENGTH).toBe(200);
    });

    test('has DESCRIPTION_MAX_LENGTH of 5000', () => {
        expect(CONTENT_LIMITS.DESCRIPTION_MAX_LENGTH).toBe(5000);
    });

    test('has TAG limits', () => {
        expect(CONTENT_LIMITS.TAG_MAX_LENGTH).toBe(50);
        expect(CONTENT_LIMITS.TAG_MAX_COUNT).toBe(10);
    });

    test('has URL_MAX_LENGTH of 2048', () => {
        expect(CONTENT_LIMITS.URL_MAX_LENGTH).toBe(2048);
    });

    test('has SQL_MAX_LENGTH of 10000', () => {
        expect(CONTENT_LIMITS.SQL_MAX_LENGTH).toBe(10000);
    });

    test('has JSON_FIELD_MAX of 50000', () => {
        expect(CONTENT_LIMITS.JSON_FIELD_MAX).toBe(50000);
    });

    test('all values are positive numbers', () => {
        for (const val of Object.values(CONTENT_LIMITS)) {
            expect(typeof val).toBe('number');
            expect(val).toBeGreaterThan(0);
        }
    });
});

describe('CACHE', () => {
    test('has DEFAULT_TTL_MS of 5 minutes', () => {
        expect(CACHE.DEFAULT_TTL_MS).toBe(5 * 60 * 1000);
    });

    test('has MAX_ENTRIES of 1000', () => {
        expect(CACHE.MAX_ENTRIES).toBe(1000);
    });
});

describe('TIMEOUTS', () => {
    test('has API_REQUEST_MS of 30 seconds', () => {
        expect(TIMEOUTS.API_REQUEST_MS).toBe(30000);
    });

    test('has WORKER_POLL_MS of 60 seconds', () => {
        expect(TIMEOUTS.WORKER_POLL_MS).toBe(60000);
    });
});
