// Database — Query metrics unit tests
// Tests the in-memory query metrics store added in database.js:
//   getQueryMetrics(), _resetQueryMetrics(), slow-query warn, requestId correlation.
// Uses mock.module to bypass the postgres connection entirely so tests run offline.

import { describe, test, expect, mock, beforeEach, afterAll } from 'bun:test';

// ─── Mocks (must precede module imports) ────────────────────────────────────

// Minimal postgres mock — returns an async function that resolves to an empty array.
// The tagged-template interface is not exercised here; only .unsafe() is called.
const mockUnsafe = mock(async () => []);
mock.module('postgres', () => {
    const fn = mock(() => ({
        unsafe: mockUnsafe,
        begin: mock(async (cb) => cb({ unsafe: mock(async () => []) })),
        end: mock(() => Promise.resolve()),
        options: { max: 25, idle_timeout: 20 },
    }));
    return fn;
});

const mockLogger = {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
    request: mock(),
    db: mock(),
    performance: mock(),
    security: mock(),
    automation: mock(),
    bot: mock(),
};
mock.module('../backend/shared/logger.js', () => ({
    logger: mockLogger,
    createLogger: mock(() => mockLogger),
    default: mockLogger,
}));

mock.module('../backend/db/seeds/helpContent.js', () => ({ seedHelpContent: mock(() => Promise.resolve()) }));
mock.module('../backend/db/seeds/demoData.js', () => ({ seedDemoData: mock(() => Promise.resolve()) }));
mock.module('../backend/routes/sizeCharts.js', () => ({ seedBrandSizeGuides: mock(() => Promise.resolve()) }));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

const { query, getQueryMetrics, _resetQueryMetrics } = await import('../backend/db/database.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
    _resetQueryMetrics();
    mockLogger.warn.mockReset();
    mockLogger.debug.mockReset();
    mockLogger.error.mockReset();
    mockUnsafe.mockReset().mockResolvedValue([]);
});

afterAll(() => mock.restore());

// ─── getQueryMetrics — shape when empty ──────────────────────────────────────

describe('getQueryMetrics — empty store', () => {
    test('returns correct structure with zero queries', () => {
        const m = getQueryMetrics();
        expect(Array.isArray(m.slowest)).toBe(true);
        expect(Array.isArray(m.avgByPattern)).toBe(true);
        expect(typeof m.byTable).toBe('object');
        expect(m.totalQueries).toBe(0);
        expect(m.period).toBe('1h');
    });

    test('slowest is empty array when no queries recorded', () => {
        expect(getQueryMetrics().slowest).toHaveLength(0);
    });

    test('byTable is empty object when no queries recorded', () => {
        expect(Object.keys(getQueryMetrics().byTable)).toHaveLength(0);
    });
});

// ─── getQueryMetrics — accumulation after real query calls ───────────────────

describe('getQueryMetrics — accumulation', () => {
    test('records a query after query.get', async () => {
        mockUnsafe.mockResolvedValue([{ id: 1 }]);
        await query.get('SELECT * FROM users WHERE id = ?', ['u1']);
        const m = getQueryMetrics();
        expect(m.totalQueries).toBe(1);
    });

    test('records a query after query.all', async () => {
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u1']);
        const m = getQueryMetrics();
        expect(m.totalQueries).toBe(1);
    });

    test('records a query after query.run', async () => {
        mockUnsafe.mockResolvedValue({ count: 1 });
        await query.run('INSERT INTO sessions (id) VALUES (?)', ['s1']);
        const m = getQueryMetrics();
        expect(m.totalQueries).toBe(1);
    });

    test('accumulates multiple queries', async () => {
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u1']);
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u2']);
        await query.get('SELECT * FROM users WHERE id = ?', ['u3']);
        expect(getQueryMetrics().totalQueries).toBe(3);
    });

    test('resets cleanly between tests via _resetQueryMetrics', () => {
        expect(getQueryMetrics().totalQueries).toBe(0);
    });
});

// ─── operation and table extraction ─────────────────────────────────────────

describe('getQueryMetrics — operation and table detection', () => {
    test('detects SELECT operation and FROM table', async () => {
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u1']);
        const m = getQueryMetrics();
        expect(m.slowest[0]?.operation ?? m.avgByPattern[0]?.operation).toBe('SELECT');
        expect(m.byTable.inventory).toBe(1);
    });

    test('detects INSERT operation and INTO table', async () => {
        mockUnsafe.mockResolvedValue({ count: 1 });
        await query.run('INSERT INTO sessions (id) VALUES (?)', ['s1']);
        const m = getQueryMetrics();
        expect(m.byTable.sessions).toBe(1);
    });

    test('detects UPDATE operation', async () => {
        mockUnsafe.mockResolvedValue({ count: 1 });
        await query.run('UPDATE users SET name = ? WHERE id = ?', ['Alice', 'u1']);
        const m = getQueryMetrics();
        expect(m.byTable.users).toBe(1);
    });

    test('detects DELETE operation', async () => {
        mockUnsafe.mockResolvedValue({ count: 1 });
        await query.run('DELETE FROM sessions WHERE id = ?', ['s1']);
        const m = getQueryMetrics();
        expect(m.byTable.sessions).toBe(1);
    });
});

// ─── requestId correlation ───────────────────────────────────────────────────

describe('getQueryMetrics — requestId correlation', () => {
    test('records requestId passed to query.get', async () => {
        mockUnsafe.mockResolvedValue([{ id: 1 }]);
        await query.get('SELECT * FROM users WHERE id = ?', ['u1'], 'req-abc-123');
        const m = getQueryMetrics();
        const entry = m.slowest[0] ?? m.avgByPattern[0];
        expect(entry?.requestId).toBe('req-abc-123');
    });

    test('records requestId passed to query.all', async () => {
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u1'], 'req-xyz-456');
        const m = getQueryMetrics();
        const entry = m.slowest[0] ?? m.avgByPattern[0];
        expect(entry?.requestId).toBe('req-xyz-456');
    });

    test('records requestId passed to query.run', async () => {
        mockUnsafe.mockResolvedValue({ count: 1 });
        await query.run('INSERT INTO sessions (id) VALUES (?)', ['s1'], 'req-run-789');
        const m = getQueryMetrics();
        const entry = m.slowest[0] ?? m.avgByPattern[0];
        expect(entry?.requestId).toBe('req-run-789');
    });

    test('requestId defaults to null when not provided', async () => {
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u1']);
        const m = getQueryMetrics();
        const entry = m.slowest[0] ?? m.avgByPattern[0];
        expect(entry?.requestId).toBeNull();
    });
});

// ─── slow query warning ──────────────────────────────────────────────────────

describe('slow query logging', () => {
    test('does not warn for fast queries', async () => {
        await query.get('SELECT * FROM users WHERE id = ?', ['u1']);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('warns when duration exceeds 1s threshold', async () => {
        // Delay the mock to exceed the 1000ms threshold
        mockUnsafe.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([{ id: 1 }]), 1050)));
        await query.get('SELECT * FROM users WHERE id = ?', ['u1']);
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'Slow query detected',
            expect.objectContaining({ sql: expect.any(String), duration: expect.any(Number) })
        );
    }, 5000);
});

// ─── avgByPattern aggregation ────────────────────────────────────────────────

describe('getQueryMetrics — avgByPattern', () => {
    test('groups repeated identical queries and averages duration', async () => {
        const SQL = 'SELECT * FROM inventory WHERE user_id = ?';
        await query.all(SQL, ['u1']);
        await query.all(SQL, ['u2']);
        const m = getQueryMetrics();
        expect(m.avgByPattern).toHaveLength(1);
        expect(m.avgByPattern[0].count).toBe(2);
        expect(typeof m.avgByPattern[0].avgDuration).toBe('number');
    });

    test('returns at most 10 patterns', async () => {
        for (let i = 0; i < 15; i++) {
            await query.all(`SELECT * FROM table_${i} WHERE id = ?`, [i]);
        }
        expect(getQueryMetrics().avgByPattern.length).toBeLessThanOrEqual(10);
    });

    test('returns at most 10 slowest entries', async () => {
        for (let i = 0; i < 15; i++) {
            await query.all(`SELECT * FROM tbl WHERE col${i} = ?`, [i]);
        }
        expect(getQueryMetrics().slowest.length).toBeLessThanOrEqual(10);
    });
});

// ─── structured debug logging ────────────────────────────────────────────────

describe('structured query logging', () => {
    test('calls logger.debug with type, operation, table, and duration', async () => {
        await query.all('SELECT * FROM inventory WHERE user_id = ?', ['u1']);
        expect(mockLogger.debug).toHaveBeenCalledWith(
            'DB query',
            expect.objectContaining({
                type: 'db_query',
                operation: 'SELECT',
                table: 'inventory',
                duration: expect.any(Number),
            })
        );
    });
});
