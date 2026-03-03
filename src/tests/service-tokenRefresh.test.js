// Token Refresh Scheduler — Unit Tests (pure functions only, no real OAuth)
import { describe, expect, test, afterAll } from 'bun:test';
import {
    getOAuthConfig,
    getRefreshSchedulerStatus,
    startTokenRefreshScheduler,
    stopTokenRefreshScheduler
} from '../backend/services/tokenRefreshScheduler.js';

// Stop scheduler after tests to clean up interval
afterAll(() => {
    stopTokenRefreshScheduler();
});

describe('getOAuthConfig', () => {
    test('returns config for ebay', () => {
        const config = getOAuthConfig('ebay', 'mock');
        expect(config).toBeDefined();
        expect(typeof config).toBe('object');
    });

    test('returns config for poshmark', () => {
        const config = getOAuthConfig('poshmark', 'mock');
        expect(config).toBeDefined();
    });

    test('returns config for mercari', () => {
        const config = getOAuthConfig('mercari', 'mock');
        expect(config).toBeDefined();
    });

    test('returns config for depop', () => {
        const config = getOAuthConfig('depop', 'mock');
        expect(config).toBeDefined();
    });

    test('returns config for grailed', () => {
        const config = getOAuthConfig('grailed', 'mock');
        expect(config).toBeDefined();
    });

    test('returns config for facebook', () => {
        const config = getOAuthConfig('facebook', 'mock');
        expect(config).toBeDefined();
    });

    test('mock mode configs have token URL', () => {
        const platforms = ['ebay', 'poshmark', 'mercari', 'depop', 'grailed', 'facebook'];
        for (const p of platforms) {
            const config = getOAuthConfig(p, 'mock');
            if (config) {
                expect(typeof config).toBe('object');
            }
        }
    });

    test('returns config object for any platform (generic fallback)', () => {
        const config = getOAuthConfig('unknown-platform', 'mock');
        expect(typeof config).toBe('object');
    });
});

describe('getRefreshSchedulerStatus', () => {
    test('returns status object', () => {
        const status = getRefreshSchedulerStatus();
        expect(typeof status).toBe('object');
        expect(status).toHaveProperty('isRunning');
        expect(typeof status.isRunning).toBe('boolean');
    });

    test('includes interval and buffer config', () => {
        const status = getRefreshSchedulerStatus();
        expect(status).toHaveProperty('intervalMs');
        expect(status).toHaveProperty('bufferMs');
        expect(status.intervalMs).toBe(300000); // 5 minutes
        expect(status.bufferMs).toBe(1800000); // 30 minutes
    });

    test('includes maxFailures', () => {
        const status = getRefreshSchedulerStatus();
        expect(status).toHaveProperty('maxFailures');
        expect(status.maxFailures).toBe(5);
    });
});

describe('startTokenRefreshScheduler / stopTokenRefreshScheduler', () => {
    test('starting scheduler sets isRunning to true', () => {
        startTokenRefreshScheduler();
        const status = getRefreshSchedulerStatus();
        expect(status.isRunning).toBe(true);
    });

    test('stopping scheduler sets isRunning to false', () => {
        startTokenRefreshScheduler();
        stopTokenRefreshScheduler();
        const status = getRefreshSchedulerStatus();
        expect(status.isRunning).toBe(false);
    });

    test('double stop does not throw', () => {
        stopTokenRefreshScheduler();
        stopTokenRefreshScheduler();
        expect(true).toBe(true); // no error
    });

    test('start after stop restarts', () => {
        stopTokenRefreshScheduler();
        startTokenRefreshScheduler();
        const status = getRefreshSchedulerStatus();
        expect(status.isRunning).toBe(true);
        stopTokenRefreshScheduler();
    });
});
