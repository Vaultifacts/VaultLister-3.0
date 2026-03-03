// Audit Log Constants — Pure Unit Tests
import { describe, expect, test } from 'bun:test';
import { CATEGORIES, SEVERITY } from '../backend/services/auditLog.js';

describe('CATEGORIES', () => {
    test('has all 10 expected keys', () => {
        const expectedKeys = ['AUTH', 'USER', 'DATA', 'ADMIN', 'SYSTEM', 'SECURITY', 'FINANCIAL', 'INVENTORY', 'LISTING', 'SALE'];
        for (const key of expectedKeys) {
            expect(CATEGORIES).toHaveProperty(key);
        }
    });

    test('all values are lowercase strings', () => {
        for (const value of Object.values(CATEGORIES)) {
            expect(typeof value).toBe('string');
            expect(value).toBe(value.toLowerCase());
        }
    });

    test('AUTH maps to authentication', () => {
        expect(CATEGORIES.AUTH).toBe('authentication');
    });

    test('SECURITY maps to security', () => {
        expect(CATEGORIES.SECURITY).toBe('security');
    });
});

describe('SEVERITY', () => {
    test('has 4 severity levels', () => {
        expect(Object.keys(SEVERITY).length).toBe(4);
    });

    test('has INFO, WARNING, ERROR, CRITICAL', () => {
        expect(SEVERITY.INFO).toBe('info');
        expect(SEVERITY.WARNING).toBe('warning');
        expect(SEVERITY.ERROR).toBe('error');
        expect(SEVERITY.CRITICAL).toBe('critical');
    });

    test('all values are lowercase strings', () => {
        for (const value of Object.values(SEVERITY)) {
            expect(typeof value).toBe('string');
            expect(value).toBe(value.toLowerCase());
        }
    });
});
