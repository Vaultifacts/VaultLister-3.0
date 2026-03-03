// Shared Logger — Unit Tests
import { describe, expect, test } from 'bun:test';
import { logger, createLogger } from '../backend/shared/logger.js';

describe('logger object shape', () => {
    test('has debug method', () => {
        expect(typeof logger.debug).toBe('function');
    });

    test('has info method', () => {
        expect(typeof logger.info).toBe('function');
    });

    test('has warn method', () => {
        expect(typeof logger.warn).toBe('function');
    });

    test('has error method', () => {
        expect(typeof logger.error).toBe('function');
    });

    test('has request method', () => {
        expect(typeof logger.request).toBe('function');
    });

    test('has db method', () => {
        expect(typeof logger.db).toBe('function');
    });

    test('has automation method', () => {
        expect(typeof logger.automation).toBe('function');
    });

    test('has bot method', () => {
        expect(typeof logger.bot).toBe('function');
    });

    test('has security method', () => {
        expect(typeof logger.security).toBe('function');
    });

    test('has performance method', () => {
        expect(typeof logger.performance).toBe('function');
    });
});

describe('logger core methods do not throw', () => {
    test('debug with message', () => {
        expect(() => logger.debug('test debug')).not.toThrow();
    });

    test('debug with meta object', () => {
        expect(() => logger.debug('test', { key: 'value' })).not.toThrow();
    });

    test('debug with non-object meta', () => {
        expect(() => logger.debug('test', 'string meta')).not.toThrow();
    });

    test('info with message', () => {
        expect(() => logger.info('test info')).not.toThrow();
    });

    test('warn with message', () => {
        expect(() => logger.warn('test warn')).not.toThrow();
    });

    test('error with message only', () => {
        expect(() => logger.error('test error')).not.toThrow();
    });

    test('error with Error object', () => {
        expect(() => logger.error('test', new Error('sample'))).not.toThrow();
    });

    test('error with string as second arg', () => {
        expect(() => logger.error('test', 'extra info')).not.toThrow();
    });

    test('error with Error and meta', () => {
        expect(() => logger.error('test', new Error('e'), { userId: '1' })).not.toThrow();
    });
});

describe('logger specialized methods do not throw', () => {
    test('request logs HTTP request', () => {
        expect(() => logger.request('GET', '/api/test', 200, 50)).not.toThrow();
    });

    test('db logs database operation', () => {
        expect(() => logger.db('SELECT', 'users')).not.toThrow();
    });

    test('automation logs automation action', () => {
        expect(() => logger.automation('sync', 'ebay')).not.toThrow();
    });

    test('bot logs bot action', () => {
        expect(() => logger.bot('discord', 'connected')).not.toThrow();
    });

    test('security logs security event', () => {
        expect(() => logger.security('failed_login', { ip: '1.2.3.4' })).not.toThrow();
    });

    test('performance logs slow operation (>1s triggers warn)', () => {
        expect(() => logger.performance('db_query', 2000)).not.toThrow();
    });

    test('performance logs fast operation (<1s triggers debug)', () => {
        expect(() => logger.performance('db_query', 50)).not.toThrow();
    });
});

describe('createLogger factory', () => {
    test('returns object with debug/info/warn/error', () => {
        const child = createLogger({ module: 'test' });
        expect(typeof child.debug).toBe('function');
        expect(typeof child.info).toBe('function');
        expect(typeof child.warn).toBe('function');
        expect(typeof child.error).toBe('function');
    });

    test('child logger methods do not throw', () => {
        const child = createLogger({ module: 'test' });
        expect(() => child.debug('msg')).not.toThrow();
        expect(() => child.info('msg')).not.toThrow();
        expect(() => child.warn('msg')).not.toThrow();
        expect(() => child.error('msg', new Error('e'))).not.toThrow();
    });

    test('creates independent loggers', () => {
        const loggerA = createLogger({ module: 'a' });
        const loggerB = createLogger({ module: 'b' });
        expect(loggerA).not.toBe(loggerB);
    });

    test('works with empty context', () => {
        const child = createLogger();
        expect(() => child.info('no context')).not.toThrow();
    });
});
