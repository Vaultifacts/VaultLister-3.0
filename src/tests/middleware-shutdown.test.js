// Regression test: Q4/Q4b — rateLimiter, CSRF, and GDPR worker stop() clears setInterval
// on graceful shutdown, preventing Node.js/Bun from keeping the process alive.

import { describe, it, expect, beforeEach } from 'bun:test';
import { rateLimiter, stopRateLimiter } from '../backend/middleware/rateLimiter.js';
import { csrfManager, stopCSRF } from '../backend/middleware/csrf.js';
import { startGDPRWorker, stopGDPRWorker, getGDPRWorkerStatus } from '../backend/workers/gdprWorker.js';

describe('middleware shutdown — rateLimiter', () => {
    it('should have an active cleanup interval after module load', () => {
        // The singleton is created at module load time; interval must be set
        expect(rateLimiter._cleanupInterval).not.toBeNull();
    });

    it('stop() clears the cleanup interval', () => {
        stopRateLimiter();
        expect(rateLimiter._cleanupInterval).toBeNull();
    });

    it('stop() is idempotent — calling twice does not throw', () => {
        expect(() => stopRateLimiter()).not.toThrow();
    });
});

describe('middleware shutdown — CSRF', () => {
    it('should have an active cleanup interval after module load', () => {
        expect(csrfManager._cleanupInterval).not.toBeNull();
    });

    it('stop() clears the cleanup interval', () => {
        stopCSRF();
        expect(csrfManager._cleanupInterval).toBeNull();
    });

    it('stop() is idempotent — calling twice does not throw', () => {
        expect(() => stopCSRF()).not.toThrow();
    });
});

describe('worker shutdown — GDPR worker', () => {
    it('should be running after startGDPRWorker()', () => {
        startGDPRWorker();
        expect(getGDPRWorkerStatus().running).toBe(true);
    });

    it('stopGDPRWorker() sets running to false', () => {
        stopGDPRWorker();
        expect(getGDPRWorkerStatus().running).toBe(false);
    });

    it('stopGDPRWorker() is idempotent — calling twice does not throw', () => {
        expect(() => stopGDPRWorker()).not.toThrow();
    });
});
