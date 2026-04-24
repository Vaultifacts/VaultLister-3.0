import { describe, expect, test } from 'bun:test';
import { isOpenPlatformIncident, shouldShowAutoProbeIssue } from '../backend/utils/platformHealthIssues.js';

describe('isOpenPlatformIncident', () => {
    test('keeps unresolved incidents current', () => {
        expect(isOpenPlatformIncident({
            status: 'investigating',
            resolved_at: null
        })).toBe(true);
    });

    test('excludes resolved incidents with resolved_at', () => {
        expect(isOpenPlatformIncident({
            status: 'resolved',
            resolved_at: '2026-04-24T17:08:09.443Z'
        })).toBe(false);
    });

    test('excludes resolved incidents with camelCase resolvedAt', () => {
        expect(isOpenPlatformIncident({
            status: 'monitoring',
            resolvedAt: '2026-04-24T17:08:09.443Z'
        })).toBe(false);
    });
});

describe('shouldShowAutoProbeIssue', () => {
    test('suppresses stale auto issues after current recovery', () => {
        expect(shouldShowAutoProbeIssue({ state: 'operational' })).toBe(false);
    });

    test('suppresses auto issues when state is unavailable', () => {
        expect(shouldShowAutoProbeIssue(null)).toBe(false);
        expect(shouldShowAutoProbeIssue({})).toBe(false);
    });

    test('keeps auto issues when current state is degraded or outage', () => {
        expect(shouldShowAutoProbeIssue({ state: 'degraded' })).toBe(true);
        expect(shouldShowAutoProbeIssue({ state: 'outage' })).toBe(true);
    });
});
