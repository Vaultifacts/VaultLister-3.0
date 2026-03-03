// Price Check Worker — Lifecycle & Status Unit Tests (pure state, no DB needed)
import { describe, expect, test, afterAll } from 'bun:test';
import {
    startPriceCheckWorker,
    stopPriceCheckWorker,
    getPriceCheckWorkerStatus
} from '../backend/workers/priceCheckWorker.js';

// Always clean up after tests
afterAll(() => {
    stopPriceCheckWorker();
});

describe('getPriceCheckWorkerStatus', () => {
    test('returns status object with expected shape', () => {
        const status = getPriceCheckWorkerStatus();
        expect(typeof status).toBe('object');
        expect(status).toHaveProperty('running');
        expect(status).toHaveProperty('interval_ms');
        expect(status).toHaveProperty('interval_minutes');
        expect(status).toHaveProperty('max_items_per_cycle');
    });

    test('running is boolean', () => {
        const status = getPriceCheckWorkerStatus();
        expect(typeof status.running).toBe('boolean');
    });

    test('interval is 30 minutes', () => {
        const status = getPriceCheckWorkerStatus();
        expect(status.interval_ms).toBe(30 * 60 * 1000);
        expect(status.interval_minutes).toBe(30);
    });

    test('max items per cycle is 50', () => {
        const status = getPriceCheckWorkerStatus();
        expect(status.max_items_per_cycle).toBe(50);
    });
});

describe('startPriceCheckWorker / stopPriceCheckWorker', () => {
    test('not running before start', () => {
        stopPriceCheckWorker(); // ensure clean state
        const status = getPriceCheckWorkerStatus();
        expect(status.running).toBe(false);
    });

    test('starting sets running to true', () => {
        startPriceCheckWorker();
        const status = getPriceCheckWorkerStatus();
        expect(status.running).toBe(true);
        stopPriceCheckWorker();
    });

    test('stopping sets running to false', () => {
        startPriceCheckWorker();
        stopPriceCheckWorker();
        const status = getPriceCheckWorkerStatus();
        expect(status.running).toBe(false);
    });

    test('double stop does not throw', () => {
        stopPriceCheckWorker();
        stopPriceCheckWorker();
        expect(getPriceCheckWorkerStatus().running).toBe(false);
    });

    test('start after stop restarts', () => {
        startPriceCheckWorker();
        stopPriceCheckWorker();
        startPriceCheckWorker();
        expect(getPriceCheckWorkerStatus().running).toBe(true);
        stopPriceCheckWorker();
    });

    test('double start is idempotent', () => {
        startPriceCheckWorker();
        startPriceCheckWorker();
        expect(getPriceCheckWorkerStatus().running).toBe(true);
        stopPriceCheckWorker();
    });
});
