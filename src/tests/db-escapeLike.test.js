// Database — escapeLike Unit Tests (pure string function)
import { describe, expect, test } from 'bun:test';
import { escapeLike } from '../backend/db/database.js';

describe('escapeLike', () => {
    test('escapes % wildcard', () => {
        expect(escapeLike('100%')).toBe('100\\%');
    });

    test('escapes _ wildcard', () => {
        expect(escapeLike('user_name')).toBe('user\\_name');
    });

    test('escapes backslash', () => {
        expect(escapeLike('path\\file')).toBe('path\\\\file');
    });

    test('passes through normal string unchanged', () => {
        expect(escapeLike('hello world')).toBe('hello world');
    });

    test('handles empty string', () => {
        expect(escapeLike('')).toBe('');
    });

    test('escapes multiple special characters in one string', () => {
        expect(escapeLike('50%_off\\sale')).toBe('50\\%\\_off\\\\sale');
    });

    test('coerces number to string', () => {
        expect(escapeLike(42)).toBe('42');
    });
});
