// Feature Flags — Unit tests with DB mock
// Tests: loadFlags, isEnabled, setFlag, trackUsage, getUsageStats, A/B testing
import { mock, describe, test, expect, beforeEach } from 'bun:test';
import { createMockDb } from './helpers/mockDb.js';

const db = createMockDb();

mock.module('../backend/db/database.js', () => ({
    query: db.query,
    models: db.models,
    escapeLike: db.escapeLike,
    default: db.db,
    initializeDatabase: mock(() => true),
    cleanupExpiredData: mock(() => ({})),
}));

const { featureFlags, abTesting } = await import('../backend/services/featureFlags.js');

beforeEach(() => db.reset());

// ============================================================
// featureFlags.loadFlags
// ============================================================
describe('featureFlags.loadFlags', () => {
    test('loads flags from DB into cache', async () => {
        db.query.all.mockReturnValue([
            { name: 'test.flag', enabled: 1, rollout_percentage: 100, is_active: 1 }
        ]);
        await featureFlags.loadFlags();
        expect(db.query.all).toHaveBeenCalled();
        const sql = db.query.all.mock.calls[0][0];
        expect(sql).toContain('feature_flags');
    });

    test('handles DB error gracefully (uses defaults)', async () => {
        db.query.all.mockImplementation(() => { throw new Error('no such table'); });
        await featureFlags.loadFlags(); // should not throw
    });

    test('parses target_users and target_tiers JSON', async () => {
        db.query.all.mockReturnValue([{
            name: 'beta.vip',
            enabled: 1,
            rollout_percentage: 100,
            target_users: JSON.stringify(['user-1', 'user-2']),
            target_tiers: JSON.stringify(['pro']),
            is_active: 1,
        }]);
        await featureFlags.loadFlags();
        const enabled = await featureFlags.isEnabled('beta.vip', { id: 'user-1', subscription_tier: 'free' });
        expect(enabled).toBe(true);
    });
});

// ============================================================
// featureFlags.isEnabled
// ============================================================
describe('featureFlags.isEnabled', () => {
    test('returns false for unknown flag', async () => {
        db.query.all.mockReturnValue([]);
        const result = await featureFlags.isEnabled('nonexistent.flag');
        expect(result).toBe(false);
    });

    test('returns true for enabled default flag', async () => {
        db.query.all.mockReturnValue([]);
        // 'ui.darkMode' is enabled by default with 100% rollout
        const result = await featureFlags.isEnabled('ui.darkMode');
        expect(result).toBe(true);
    });

    test('returns false for disabled default flag', async () => {
        db.query.all.mockReturnValue([]);
        // 'ui.newDashboard' is disabled by default
        const result = await featureFlags.isEnabled('ui.newDashboard');
        expect(result).toBe(false);
    });

    test('respects user targeting (targeted user gets true)', async () => {
        db.query.all.mockReturnValue([{
            name: 'beta.exclusive',
            enabled: 1,
            rollout_percentage: 100,
            target_users: JSON.stringify(['user-vip']),
            target_tiers: null,
            is_active: 1,
        }]);
        await featureFlags.loadFlags();

        const vipResult = await featureFlags.isEnabled('beta.exclusive', { id: 'user-vip' });
        expect(vipResult).toBe(true);
    });

    test('respects tier targeting (matched tier gets true)', async () => {
        db.query.all.mockReturnValue([{
            name: 'pro.feature',
            enabled: 1,
            rollout_percentage: 100,
            target_users: null,
            target_tiers: JSON.stringify(['pro', 'enterprise']),
            is_active: 1,
        }]);
        await featureFlags.loadFlags();

        expect(await featureFlags.isEnabled('pro.feature', { id: 'u1', subscription_tier: 'pro' })).toBe(true);
        expect(await featureFlags.isEnabled('pro.feature', { id: 'u2', subscription_tier: 'enterprise' })).toBe(true);
    });

    test('disabled flag returns false regardless of targeting', async () => {
        db.query.all.mockReturnValue([{
            name: 'disabled.flag',
            enabled: 0,
            rollout_percentage: 100,
            target_users: JSON.stringify(['user-1']),
            target_tiers: null,
            is_active: 1,
        }]);
        await featureFlags.loadFlags();

        expect(await featureFlags.isEnabled('disabled.flag', { id: 'user-1' })).toBe(false);
    });
});

// ============================================================
// featureFlags.hashUserId
// ============================================================
describe('featureFlags.hashUserId', () => {
    test('returns a number', () => {
        expect(typeof featureFlags.hashUserId('test-user')).toBe('number');
    });

    test('returns same hash for same input (deterministic)', () => {
        expect(featureFlags.hashUserId('user-123')).toBe(featureFlags.hashUserId('user-123'));
    });

    test('returns different hashes for different inputs', () => {
        expect(featureFlags.hashUserId('user-a')).not.toBe(featureFlags.hashUserId('user-b'));
    });

    test('returns non-negative value', () => {
        expect(featureFlags.hashUserId('negative-test')).toBeGreaterThanOrEqual(0);
    });
});

// ============================================================
// featureFlags.setFlag
// ============================================================
describe('featureFlags.setFlag', () => {
    test('persists flag to database via query.run', () => {
        featureFlags.setFlag('test.newFlag', { enabled: true, rolloutPercentage: 50 });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('INSERT INTO feature_flags');
        expect(sql).toContain('ON CONFLICT');
    });

    test('handles DB error gracefully', () => {
        db.query.run.mockImplementation(() => { throw new Error('DB down'); });
        expect(() => featureFlags.setFlag('test.flag', { enabled: true })).not.toThrow();
    });
});

// ============================================================
// featureFlags.trackUsage
// ============================================================
describe('featureFlags.trackUsage', () => {
    test('inserts usage record via query.run', () => {
        featureFlags.trackUsage('ui.darkMode', { id: 'user-1' });
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('feature_flag_usage');
    });

    test('handles DB error silently', () => {
        db.query.run.mockImplementation(() => { throw new Error('DB error'); });
        expect(() => featureFlags.trackUsage('test.flag')).not.toThrow();
    });
});

// ============================================================
// featureFlags.getUsageStats
// ============================================================
describe('featureFlags.getUsageStats', () => {
    test('queries usage stats from DB', () => {
        db.query.all.mockReturnValue([
            { flag_name: 'ui.darkMode', total_uses: 100, unique_users: 50, date: '2026-02-25' }
        ]);
        const result = featureFlags.getUsageStats('ui.darkMode');
        expect(result.length).toBe(1);
        expect(result[0].total_uses).toBe(100);
    });

    test('returns empty array on DB error', () => {
        db.query.all.mockImplementation(() => { throw new Error('DB error'); });
        expect(featureFlags.getUsageStats('test')).toEqual([]);
    });
});

// ============================================================
// featureFlags.getAllFlags
// ============================================================
describe('featureFlags.getAllFlags', () => {
    test('returns a copy of the flags cache', () => {
        const flags = featureFlags.getAllFlags();
        expect(typeof flags).toBe('object');
        expect(flags['ui.darkMode']).toBeDefined();
    });
});

// ============================================================
// A/B Testing
// ============================================================
describe('abTesting.getVariant', () => {
    test('returns a variant from the list', () => {
        const variant = abTesting.getVariant('test-exp', ['A', 'B'], { id: 'user-1' });
        expect(['A', 'B']).toContain(variant);
    });

    test('returns consistent variant for same user', () => {
        const v1 = abTesting.getVariant('exp1', ['A', 'B'], { id: 'user-1' });
        const v2 = abTesting.getVariant('exp1', ['A', 'B'], { id: 'user-1' });
        expect(v1).toBe(v2);
    });

    test('supports more than 2 variants', () => {
        const variant = abTesting.getVariant('multi', ['A', 'B', 'C', 'D'], { id: 'user-1' });
        expect(['A', 'B', 'C', 'D']).toContain(variant);
    });
});

describe('abTesting.trackConversion', () => {
    test('inserts conversion record via query.run', () => {
        abTesting.trackConversion('exp1', 'A', { id: 'user-1' }, 1);
        expect(db.query.run).toHaveBeenCalled();
        const sql = db.query.run.mock.calls[0][0];
        expect(sql).toContain('ab_test_conversions');
    });

    test('handles DB error silently', () => {
        db.query.run.mockImplementation(() => { throw new Error('fail'); });
        expect(() => abTesting.trackConversion('exp', 'A')).not.toThrow();
    });
});

describe('abTesting.getResults', () => {
    test('queries experiment results from DB', () => {
        db.query.all.mockReturnValue([
            { variant: 'A', conversions: 50, total_value: 50, unique_users: 40 },
            { variant: 'B', conversions: 60, total_value: 60, unique_users: 45 }
        ]);
        const results = abTesting.getResults('exp1');
        expect(results.length).toBe(2);
        expect(results[0].variant).toBe('A');
    });

    test('returns empty array on DB error', () => {
        db.query.all.mockImplementation(() => { throw new Error('fail'); });
        expect(abTesting.getResults('exp')).toEqual([]);
    });
});
