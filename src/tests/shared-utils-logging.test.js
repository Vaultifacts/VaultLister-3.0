// Shared Utils Logging — Gap-filling tests for logInfo, logWarn, logError
// These functions are exported from utils.js but not covered by shared-utils.test.js
import { describe, expect, test } from 'bun:test';
import { logInfo, logWarn, logError } from '../backend/shared/utils.js';

describe('logInfo', () => {
    test('does not throw with message', () => {
        expect(() => logInfo('test info message')).not.toThrow();
    });

    test('accepts context object', () => {
        expect(() => logInfo('test info', { userId: '123', action: 'login' })).not.toThrow();
    });

    test('works with empty context', () => {
        expect(() => logInfo('test info', {})).not.toThrow();
    });
});

describe('logWarn', () => {
    test('does not throw with message', () => {
        expect(() => logWarn('test warning')).not.toThrow();
    });

    test('accepts context object', () => {
        expect(() => logWarn('test warning', { detail: 'something', severity: 'medium' })).not.toThrow();
    });

    test('works with empty context', () => {
        expect(() => logWarn('test warning', {})).not.toThrow();
    });
});

describe('logError', () => {
    test('does not throw with message only', () => {
        expect(() => logError('test error')).not.toThrow();
    });

    test('accepts Error object', () => {
        expect(() => logError('test error', new Error('sample error'))).not.toThrow();
    });

    test('accepts null error with context', () => {
        expect(() => logError('test error', null, { code: 'ERR_123' })).not.toThrow();
    });

    test('accepts Error and context', () => {
        expect(() => logError('test', new Error('e'), { route: '/api/test' })).not.toThrow();
    });
});
