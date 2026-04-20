import { describe, test, expect, beforeEach } from 'bun:test';
import { recordTransaction, recordCancellation, getCancellationRate, canAcceptOffer } from '../backend/services/platformSync/cancellationTracker.js';
import fs from 'fs';
import path from 'path';

const TRACKER_PATH = path.join(process.cwd(), 'data', '.cancellation-tracker.json');

describe('Cancellation Tracker', () => {
    beforeEach(() => {
        try { fs.unlinkSync(TRACKER_PATH); } catch {}
    });

    test('should return OK rate with no history', () => {
        const result = getCancellationRate('mercari', 'acct-1');
        expect(result.rate).toBe(0);
        expect(result.status).toBe('OK');
        expect(result.transactions).toBe(0);
        expect(result.cancellations).toBe(0);
    });

    test('should track transactions', () => {
        recordTransaction('mercari', 'acct-1');
        recordTransaction('mercari', 'acct-1');
        recordTransaction('mercari', 'acct-1');
        const result = getCancellationRate('mercari', 'acct-1');
        expect(result.transactions).toBe(3);
        expect(result.cancellations).toBe(0);
        expect(result.rate).toBe(0);
        expect(result.status).toBe('OK');
    });

    test('should compute cancellation rate correctly', () => {
        for (let i = 0; i < 9; i++) recordTransaction('mercari', 'acct-1');
        recordCancellation('mercari', 'acct-1', 'item sold on eBay');
        const result = getCancellationRate('mercari', 'acct-1');
        expect(result.transactions).toBe(9);
        expect(result.cancellations).toBe(1);
        expect(result.rate).toBe(0.1); // 1/10 = 10%
        expect(result.status).toBe('WARNING');
    });

    test('should BLOCK at high cancellation rate', () => {
        for (let i = 0; i < 5; i++) recordTransaction('mercari', 'acct-1');
        for (let i = 0; i < 3; i++) recordCancellation('mercari', 'acct-1');
        const result = getCancellationRate('mercari', 'acct-1');
        // 3/(5+3) = 37.5%
        expect(result.status).toBe('BLOCKED');
    });

    test('canAcceptOffer should return true when OK', () => {
        recordTransaction('mercari', 'acct-1');
        recordTransaction('mercari', 'acct-1');
        expect(canAcceptOffer('mercari', 'acct-1')).toBe(true);
    });

    test('canAcceptOffer should return false when BLOCKED', () => {
        recordCancellation('mercari', 'acct-1');
        recordCancellation('mercari', 'acct-1');
        // 2/2 = 100% cancellation
        expect(canAcceptOffer('mercari', 'acct-1')).toBe(false);
    });

    test('should track platforms independently', () => {
        recordTransaction('mercari', 'acct-1');
        recordCancellation('poshmark', 'acct-1');
        const mercari = getCancellationRate('mercari', 'acct-1');
        const poshmark = getCancellationRate('poshmark', 'acct-1');
        expect(mercari.rate).toBe(0);
        expect(poshmark.rate).toBe(1);
    });

    test('should track accounts independently', () => {
        recordTransaction('mercari', 'acct-1');
        recordCancellation('mercari', 'acct-2');
        expect(getCancellationRate('mercari', 'acct-1').rate).toBe(0);
        expect(getCancellationRate('mercari', 'acct-2').rate).toBe(1);
    });
});
