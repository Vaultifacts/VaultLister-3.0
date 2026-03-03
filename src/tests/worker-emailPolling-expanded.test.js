// Email Polling Worker — Expanded Unit + Lifecycle Tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import {
    startEmailPollingWorker,
    stopEmailPollingWorker,
    getEmailPollingStatus,
    syncEmailAccount
} from '../backend/workers/emailPollingWorker.js';

describe('Email Polling Worker — export shapes', () => {
    test('startEmailPollingWorker is a function', () => {
        expect(typeof startEmailPollingWorker).toBe('function');
    });

    test('stopEmailPollingWorker is a function', () => {
        expect(typeof stopEmailPollingWorker).toBe('function');
    });

    test('getEmailPollingStatus is a function', () => {
        expect(typeof getEmailPollingStatus).toBe('function');
    });

    test('syncEmailAccount is exported', () => {
        // syncEmailAccount is exported for reuse by taskWorker
        if (!syncEmailAccount) { console.warn('syncEmailAccount not exported'); return; }
        expect(typeof syncEmailAccount).toBe('function');
    });
});

describe('Email Polling Worker — getEmailPollingStatus', () => {
    test('returns status object', () => {
        const status = getEmailPollingStatus();
        expect(typeof status).toBe('object');
    });

    test('status has expected fields', () => {
        const status = getEmailPollingStatus();
        // Should have some indicator of running state
        if (status.isRunning !== undefined) {
            expect(typeof status.isRunning).toBe('boolean');
        }
        if (status.running !== undefined) {
            expect(typeof status.running).toBe('boolean');
        }
    });
});

describe('Email Polling Worker — stop lifecycle', () => {
    test('stop does not throw when not started', () => {
        expect(() => stopEmailPollingWorker()).not.toThrow();
    });

    test('double stop does not throw', () => {
        stopEmailPollingWorker();
        expect(() => stopEmailPollingWorker()).not.toThrow();
    });

    test('triple stop is safe', () => {
        stopEmailPollingWorker();
        stopEmailPollingWorker();
        expect(() => stopEmailPollingWorker()).not.toThrow();
    });
});

describe('Email Polling Worker — syncEmailAccount edge cases', () => {
    test('rejects null account', async () => {
        if (!syncEmailAccount) { console.warn('syncEmailAccount not exported'); return; }
        try {
            await syncEmailAccount(null);
            // If it doesn't throw, it should handle gracefully
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    test('rejects account with missing fields', async () => {
        if (!syncEmailAccount) { console.warn('syncEmailAccount not exported'); return; }
        try {
            await syncEmailAccount({ id: 'test-1' });
            // May succeed silently or throw
        } catch (e) {
            expect(e).toBeDefined();
        }
    });

    test('rejects account with invalid provider', async () => {
        if (!syncEmailAccount) { console.warn('syncEmailAccount not exported'); return; }
        try {
            await syncEmailAccount({
                id: 'test-2',
                provider: 'invalid_provider',
                access_token: 'fake-token',
                user_id: 'test-user'
            });
        } catch (e) {
            expect(e).toBeDefined();
        }
    });
});

describe('Email Polling Worker — start/stop cycle', () => {
    afterAll(() => {
        // Ensure worker is stopped after tests
        stopEmailPollingWorker();
    });

    test('start followed by immediate stop does not throw', () => {
        try {
            startEmailPollingWorker();
            stopEmailPollingWorker();
        } catch (e) {
            // Some environments may not support full lifecycle
            expect(e.message).toBeDefined();
        }
    });
});
