// Email Polling Worker — Export Shape & Stop Lifecycle Tests
import { describe, expect, test } from 'bun:test';
import {
    startEmailPollingWorker,
    stopEmailPollingWorker,
    getEmailPollingStatus
} from '../backend/workers/emailPollingWorker.js';

describe('emailPollingWorker exports', () => {
    test('startEmailPollingWorker is a function', () => {
        expect(typeof startEmailPollingWorker).toBe('function');
    });

    test('stopEmailPollingWorker is a function', () => {
        expect(typeof stopEmailPollingWorker).toBe('function');
    });

    test('getEmailPollingStatus is a function', () => {
        expect(typeof getEmailPollingStatus).toBe('function');
    });
});

describe('stopEmailPollingWorker', () => {
    test('does not throw when worker is not started', () => {
        stopEmailPollingWorker();
        // No error = success
    });

    test('double stop does not throw', () => {
        stopEmailPollingWorker();
        stopEmailPollingWorker();
    });
});
