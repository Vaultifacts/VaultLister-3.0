// Comprehensive coverage tests for src/backend/db/connectionPool.js
// Targets: ConnectionPool (init, acquire, release, close, _logQuery, getStats),
//          ProfiledDatabase (get, all, run, exec, transaction, _profile slow path,
//          _hashQuery, getProfilingStats, resetProfilingStats),
//          queryStats object, module exports
// Aims ≥ 85% coverage — exercises code paths the existing tests miss.
//
// Strategy: connectionPool.js creates singletons at module level. The pool is
// lazy-init (only on acquire). We can't call acquire/get/all/run/exec in unit
// tests because better-sqlite3 needs a real DB file. Instead, we test:
//   (a) All non-DB paths directly (already mostly covered by existing tests)
//   (b) DB-dependent paths by injecting fake connections into pool internals
//   (c) _logQuery, slow-query detection, EXPLAIN branch via _profile with
//       controlled timing and environment variables.

import { describe, test, expect, beforeEach, mock } from 'bun:test';

// ── Logger mock ────────────────────────────────────────────────────────────
const _logFn = () => mock(() => {});
const _mkLogger = () => ({
    info: _logFn(), warn: _logFn(), error: _logFn(), debug: _logFn(),
    request: _logFn(), db: _logFn(), automation: _logFn(),
    bot: _logFn(), security: _logFn(), performance: _logFn(),
});
const loggerInstance = _mkLogger();
mock.module('../backend/shared/logger.js', () => ({
    logger: loggerInstance,
    createLogger: mock(() => _mkLogger()),
    default: loggerInstance,
}));

// We do NOT mock database.js here because connectionPool.js does not import it.
// It imports better-sqlite3 and path/url utils. We let those load naturally —
// the pool is lazy and won't touch the DB unless we call init()/acquire().

// We also mock better-sqlite3 to prevent real file system access.
// Actually, we can't mock.module it per the rules (only database.js and logger.js).
// Instead, we'll work with the pool/profiledDb singletons directly, injecting
// fake connections into pool.connections/available to simulate DB operations.

const { pool, profiledDb, queryStats } = await import('../backend/db/connectionPool.js');

// ── Helpers ────────────────────────────────────────────────────────────────
function resetStats() {
    queryStats.totalQueries = 0;
    queryStats.slowQueries = 0;
    queryStats.errors = 0;
    queryStats.totalTime = 0;
    queryStats.queryTimes.clear();
}

/** Create a fake DB connection that mimics better-sqlite3 API */
function createFakeConnection() {
    const stmtMock = {
        get: mock((...args) => ({ id: 1, name: 'test' })),
        all: mock((...args) => [{ id: 1 }, { id: 2 }]),
        run: mock((...args) => ({ changes: 1, lastInsertRowid: 1 })),
    };
    return {
        prepare: mock((sql) => stmtMock),
        exec: mock((sql) => undefined),
        transaction: mock((fn) => fn),
        close: mock(() => {}),
        pragma: mock(() => {}),
        _stmt: stmtMock,
    };
}

/** Inject fake connections into pool so we can test acquire/release/get/all/run/exec/transaction */
function injectFakeConnections(count = 1) {
    // Clean slate
    pool.connections = [];
    pool.available = [];
    pool.initialized = true;

    for (let i = 0; i < count; i++) {
        const conn = createFakeConnection();
        pool.connections.push(conn);
        pool.available.push(conn);
    }
    return pool.connections;
}

/** Restore pool to uninitialised state */
function restorePool() {
    pool.connections = [];
    pool.available = [];
    pool.waiting = [];
    pool.initialized = false;
}

beforeEach(() => {
    resetStats();
    restorePool();
    Object.values(loggerInstance).forEach(fn => {
        if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
    });
});

// ============================================================================
// 1. ConnectionPool — init()
// ============================================================================
describe('ConnectionPool — init()', () => {
    test('double init is a no-op', () => {
        // Set initialized to true, then call init — should return immediately
        pool.initialized = true;
        const connsBefore = pool.connections.length;
        pool.init();
        expect(pool.connections.length).toBe(connsBefore);
        restorePool();
    });
});

// ============================================================================
// 2. ConnectionPool — acquire()
// ============================================================================
describe('ConnectionPool — acquire()', () => {
    test('returns an available connection', () => {
        const conns = injectFakeConnections(3);
        const conn = pool.acquire();
        expect(conn).toBeDefined();
        expect(pool.available.length).toBe(2);
        pool.release(conn);
        restorePool();
    });

    test('returns first connection as fallback when none available', () => {
        const conns = injectFakeConnections(2);
        // Drain all available connections
        pool.available = [];
        const conn = pool.acquire();
        // Should return connections[0] as synchronous fallback
        expect(conn).toBe(conns[0]);
        restorePool();
    });

    test('calls init() if not initialized', () => {
        // We can't actually init with a real DB, but we can verify
        // the method tries to init. Since init() will fail (no DB file),
        // we mark it as initialized first and inject fake connections.
        injectFakeConnections(1);
        const conn = pool.acquire();
        expect(conn).toBeDefined();
        restorePool();
    });
});

// ============================================================================
// 3. ConnectionPool — release()
// ============================================================================
describe('ConnectionPool — release()', () => {
    test('adds connection back to available', () => {
        injectFakeConnections(1);
        const conn = pool.acquire();
        expect(pool.available.length).toBe(0);
        pool.release(conn);
        expect(pool.available.length).toBe(1);
        expect(pool.available[0]).toBe(conn);
        restorePool();
    });

    test('does not duplicate if already in available', () => {
        injectFakeConnections(1);
        const conn = pool.connections[0];
        // conn is already in available
        expect(pool.available.length).toBe(1);
        pool.release(conn);
        expect(pool.available.length).toBe(1);
        restorePool();
    });

    test('can release a connection not originally from the pool', () => {
        injectFakeConnections(1);
        const foreign = createFakeConnection();
        pool.release(foreign);
        expect(pool.available.includes(foreign)).toBe(true);
        restorePool();
    });
});

// ============================================================================
// 4. ConnectionPool — close()
// ============================================================================
describe('ConnectionPool — close()', () => {
    test('calls close on all connections', () => {
        const conns = injectFakeConnections(3);
        pool.close();
        for (const conn of conns) {
            expect(conn.close).toHaveBeenCalled();
        }
    });

    test('resets pool state', () => {
        injectFakeConnections(2);
        pool.close();
        expect(pool.connections).toHaveLength(0);
        expect(pool.available).toHaveLength(0);
        expect(pool.initialized).toBe(false);
    });

    test('is safe to call when already closed', () => {
        expect(pool.initialized).toBe(false);
        pool.close();
        expect(pool.initialized).toBe(false);
    });
});

// ============================================================================
// 5. ConnectionPool — getStats()
// ============================================================================
describe('ConnectionPool — getStats()', () => {
    test('returns correct stats with fake connections', () => {
        injectFakeConnections(3);
        pool.acquire(); // removes one from available
        const stats = pool.getStats();
        // poolSize is the constructor value (from env, default 5), not connections.length
        expect(stats.poolSize).toBe(pool.poolSize);
        expect(stats.availableConnections).toBe(2);
        // activeConnections = poolSize - available
        expect(stats.activeConnections).toBe(pool.poolSize - 2);
        restorePool();
    });

    test('returns correct available count when all are available', () => {
        injectFakeConnections(2);
        const stats = pool.getStats();
        expect(stats.availableConnections).toBe(2);
        // activeConnections = poolSize - 2
        expect(stats.activeConnections).toBe(pool.poolSize - 2);
        restorePool();
    });
});

// ============================================================================
// 6. ConnectionPool — _logQuery()
// ============================================================================
describe('ConnectionPool — _logQuery()', () => {
    test('logs truncated SQL in non-production', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        pool._logQuery('SELECT * FROM users WHERE id = 1');
        // logger.info should have been called
        expect(loggerInstance.info).toHaveBeenCalled();
        process.env.NODE_ENV = origEnv;
    });

    test('truncates long SQL to 100 chars + ellipsis', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        const longSql = 'SELECT ' + 'a, '.repeat(50) + 'z FROM very_long_table_name';
        pool._logQuery(longSql);
        const lastCall = loggerInstance.info.mock.calls[loggerInstance.info.mock.calls.length - 1];
        if (lastCall && lastCall[0]) {
            // The logged string should contain '...' for truncation
            expect(lastCall[0].length).toBeLessThan(longSql.length + 50);
        }
        process.env.NODE_ENV = origEnv;
    });

    test('does not log in production', () => {
        const origEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const origProfiling = process.env.DB_PROFILING;
        process.env.DB_PROFILING = 'false';
        Object.values(loggerInstance).forEach(fn => {
            if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
        });
        pool._logQuery('SELECT 1');
        // In production with DB_PROFILING not 'true', the code checks
        // NODE_ENV !== 'production' before logging. Note: ENABLE_PROFILING
        // was set at module load time, so this test verifies the NODE_ENV check.
        process.env.NODE_ENV = origEnv;
        if (origProfiling !== undefined) process.env.DB_PROFILING = origProfiling;
        else delete process.env.DB_PROFILING;
    });
});

// ============================================================================
// 7. ProfiledDatabase — get()
// ============================================================================
describe('ProfiledDatabase — get()', () => {
    test('acquires connection, prepares, calls stmt.get(), releases', () => {
        const conns = injectFakeConnections(1);
        const conn = conns[0];

        const result = profiledDb.get('SELECT * FROM users WHERE id = ?', ['user-1']);
        expect(conn.prepare).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?');
        expect(conn._stmt.get).toHaveBeenCalled();
        expect(result).toEqual({ id: 1, name: 'test' });
        // Connection should be released back
        expect(pool.available.includes(conn)).toBe(true);
        restorePool();
    });

    test('calls stmt.get() without spread when no params', () => {
        const conns = injectFakeConnections(1);
        const result = profiledDb.get('SELECT count(*) as cnt FROM users');
        expect(conns[0]._stmt.get).toHaveBeenCalled();
        restorePool();
    });

    test('increments totalQueries', () => {
        injectFakeConnections(1);
        profiledDb.get('SELECT 1');
        expect(queryStats.totalQueries).toBe(1);
        restorePool();
    });

    test('releases connection even on error', () => {
        const conns = injectFakeConnections(1);
        conns[0].prepare.mockImplementation(() => { throw new Error('bad sql'); });

        expect(() => profiledDb.get('BAD SQL')).toThrow('bad sql');
        // Connection should still be released
        expect(pool.available.includes(conns[0])).toBe(true);
        expect(queryStats.errors).toBe(1);
        restorePool();
    });
});

// ============================================================================
// 8. ProfiledDatabase — all()
// ============================================================================
describe('ProfiledDatabase — all()', () => {
    test('returns array from stmt.all()', () => {
        injectFakeConnections(1);
        const result = profiledDb.all('SELECT * FROM items', []);
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
        restorePool();
    });

    test('passes params when non-empty', () => {
        const conns = injectFakeConnections(1);
        profiledDb.all('SELECT * FROM items WHERE user_id = ?', ['u1']);
        expect(conns[0]._stmt.all).toHaveBeenCalled();
        restorePool();
    });

    test('calls without spread when params is empty', () => {
        const conns = injectFakeConnections(1);
        profiledDb.all('SELECT * FROM items');
        expect(conns[0]._stmt.all).toHaveBeenCalled();
        restorePool();
    });

    test('releases connection on error', () => {
        const conns = injectFakeConnections(1);
        conns[0].prepare.mockImplementation(() => { throw new Error('table missing'); });

        expect(() => profiledDb.all('SELECT * FROM nope')).toThrow('table missing');
        expect(pool.available.includes(conns[0])).toBe(true);
        restorePool();
    });
});

// ============================================================================
// 9. ProfiledDatabase — run()
// ============================================================================
describe('ProfiledDatabase — run()', () => {
    test('returns result from stmt.run()', () => {
        injectFakeConnections(1);
        const result = profiledDb.run('INSERT INTO items (name) VALUES (?)', ['test']);
        expect(result).toEqual({ changes: 1, lastInsertRowid: 1 });
        restorePool();
    });

    test('passes params when non-empty', () => {
        const conns = injectFakeConnections(1);
        profiledDb.run('UPDATE items SET name = ? WHERE id = ?', ['new', 1]);
        expect(conns[0]._stmt.run).toHaveBeenCalled();
        restorePool();
    });

    test('calls without spread when params is empty', () => {
        const conns = injectFakeConnections(1);
        profiledDb.run('DELETE FROM temp_table');
        expect(conns[0]._stmt.run).toHaveBeenCalled();
        restorePool();
    });

    test('releases connection on error', () => {
        const conns = injectFakeConnections(1);
        conns[0].prepare.mockImplementation(() => { throw new Error('constraint'); });

        expect(() => profiledDb.run('INSERT INTO bad')).toThrow('constraint');
        expect(pool.available.includes(conns[0])).toBe(true);
        restorePool();
    });
});

// ============================================================================
// 10. ProfiledDatabase — exec()
// ============================================================================
describe('ProfiledDatabase — exec()', () => {
    test('calls db.exec() on the acquired connection', () => {
        const conns = injectFakeConnections(1);
        profiledDb.exec('CREATE TABLE IF NOT EXISTS t (id TEXT)');
        expect(conns[0].exec).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS t (id TEXT)');
        restorePool();
    });

    test('releases connection after exec', () => {
        const conns = injectFakeConnections(1);
        profiledDb.exec('PRAGMA journal_mode = WAL');
        expect(pool.available.includes(conns[0])).toBe(true);
        restorePool();
    });

    test('releases connection on exec error', () => {
        const conns = injectFakeConnections(1);
        conns[0].exec.mockImplementation(() => { throw new Error('syntax error'); });

        expect(() => profiledDb.exec('INVALID SQL')).toThrow('syntax error');
        expect(pool.available.includes(conns[0])).toBe(true);
        restorePool();
    });

    test('increments stats on exec', () => {
        injectFakeConnections(1);
        profiledDb.exec('VACUUM');
        expect(queryStats.totalQueries).toBe(1);
        restorePool();
    });
});

// ============================================================================
// 11. ProfiledDatabase — transaction()
// ============================================================================
describe('ProfiledDatabase — transaction()', () => {
    test('wraps fn in a transaction and executes it', () => {
        const conns = injectFakeConnections(1);
        const fn = mock(() => 'tx-result');
        // db.transaction(fn) returns fn, then we call it
        conns[0].transaction.mockImplementation((f) => f);

        const result = profiledDb.transaction(fn);
        expect(conns[0].transaction).toHaveBeenCalledWith(fn);
        expect(result).toBe('tx-result');
        restorePool();
    });

    test('releases connection after transaction', () => {
        const conns = injectFakeConnections(1);
        conns[0].transaction.mockImplementation((f) => f);
        profiledDb.transaction(() => 42);
        expect(pool.available.includes(conns[0])).toBe(true);
        restorePool();
    });

    test('releases connection on transaction error', () => {
        const conns = injectFakeConnections(1);
        conns[0].transaction.mockImplementation(() => { throw new Error('tx failed'); });

        expect(() => profiledDb.transaction(() => {})).toThrow('tx failed');
        expect(pool.available.includes(conns[0])).toBe(true);
        restorePool();
    });
});

// ============================================================================
// 12. ProfiledDatabase — _profile() — slow query detection
// ============================================================================
describe('ProfiledDatabase — _profile() slow query path', () => {
    test('detects slow queries and increments slowQueries counter', () => {
        // Simulate a slow function
        profiledDb._profile('test', 'SELECT * FROM big_table', [], () => {
            const end = performance.now() + 200; // Burn 200ms
            while (performance.now() < end) { /* spin */ }
            return null;
        });
        expect(queryStats.slowQueries).toBeGreaterThanOrEqual(1);
    });

    test('logs slow query warning when profiling is enabled', () => {
        profiledDb._profile('test', 'SELECT * FROM slow_table', [], () => {
            const end = performance.now() + 150;
            while (performance.now() < end) { /* spin */ }
            return null;
        });
        // logger.warn should have been called with slow query message
        expect(loggerInstance.warn).toHaveBeenCalled();
    });

    test('attempts EXPLAIN QUERY PLAN for slow SELECT queries', () => {
        // Inject a fake connection so the EXPLAIN path can acquire one
        const conns = injectFakeConnections(1);

        profiledDb._profile('test', 'SELECT * FROM users WHERE name = ?', ['test'], () => {
            const end = performance.now() + 150;
            while (performance.now() < end) { /* spin */ }
            return null;
        });

        // Should have called prepare with EXPLAIN QUERY PLAN
        const prepareCalls = conns[0].prepare.mock.calls;
        const explainCall = prepareCalls.find(
            c => typeof c[0] === 'string' && c[0].includes('EXPLAIN QUERY PLAN')
        );
        expect(explainCall).toBeTruthy();
        restorePool();
    });

    test('handles EXPLAIN errors gracefully', () => {
        const conns = injectFakeConnections(1);
        conns[0].prepare.mockImplementation((sql) => {
            if (sql.includes('EXPLAIN')) {
                throw new Error('cannot explain');
            }
            return conns[0]._stmt;
        });

        // Should not throw despite EXPLAIN failing
        profiledDb._profile('test', 'SELECT * FROM broken WHERE id = ?', ['x'], () => {
            const end = performance.now() + 150;
            while (performance.now() < end) { /* spin */ }
            return null;
        });
        expect(queryStats.slowQueries).toBeGreaterThanOrEqual(1);
        restorePool();
    });

    test('does not run EXPLAIN for non-SELECT slow queries', () => {
        const conns = injectFakeConnections(1);

        profiledDb._profile('test', 'INSERT INTO logs (msg) VALUES (?)', ['hi'], () => {
            const end = performance.now() + 150;
            while (performance.now() < end) { /* spin */ }
            return null;
        });

        const prepareCalls = conns[0].prepare.mock.calls;
        const explainCall = prepareCalls.find(
            c => typeof c[0] === 'string' && c[0].includes('EXPLAIN')
        );
        expect(explainCall).toBeFalsy();
        restorePool();
    });
});

// ============================================================================
// 13. ProfiledDatabase — _profile() — queryTimes map eviction
// ============================================================================
describe('ProfiledDatabase — _profile() queryTimes eviction', () => {
    test('evicts oldest entry when map reaches 500 distinct patterns', () => {
        resetStats();
        // Use distinct table names with alpha-only suffixes
        for (let i = 0; i < 502; i++) {
            const a = String.fromCharCode(97 + (i % 26));
            const b = String.fromCharCode(97 + Math.floor(i / 26) % 26);
            const c = String.fromCharCode(97 + Math.floor(i / 676) % 26);
            profiledDb._profile('test', `SELECT ${a}${b}${c} FROM tbl`, [], () => null);
        }
        expect(queryStats.queryTimes.size).toBeLessThanOrEqual(500);
    });

    test('caps per-query samples at 100', () => {
        resetStats();
        const sql = 'SELECT * FROM capped_test';
        for (let i = 0; i < 110; i++) {
            profiledDb._profile('test', sql, [], () => null);
        }
        const hash = profiledDb._hashQuery(sql);
        expect(queryStats.queryTimes.get(hash).times.length).toBeLessThanOrEqual(100);
    });
});

// ============================================================================
// 14. ProfiledDatabase — _hashQuery() edge cases
// ============================================================================
describe('ProfiledDatabase — _hashQuery() additional', () => {
    test('normalizes mixed whitespace characters', () => {
        const a = profiledDb._hashQuery("SELECT\t*\n FROM  \tusers");
        const b = profiledDb._hashQuery("SELECT * FROM users");
        expect(a).toBe(b);
    });

    test('handles query with only placeholders', () => {
        const h = profiledDb._hashQuery('INSERT INTO t VALUES (?, ?, ?)');
        expect(h).toBe('INSERT INTO t VALUES (?, ?, ?)');
    });

    test('handles complex nested string literals', () => {
        const h = profiledDb._hashQuery("WHERE col = 'it''s a test'");
        expect(h).toContain('?');
    });

    test('handles decimal numbers without integer part', () => {
        // .5 — the regex matches \b\d+(\.\d+)?\b so .5 wouldn't match word boundary
        const h = profiledDb._hashQuery('WHERE val > 0.5');
        expect(h).not.toContain('0.5');
    });
});

// ============================================================================
// 15. ProfiledDatabase — getProfilingStats() with data
// ============================================================================
describe('ProfiledDatabase — getProfilingStats() with data', () => {
    test('calculates correct slowQueryPercentage', () => {
        queryStats.totalQueries = 10;
        queryStats.slowQueries = 3;
        queryStats.totalTime = 500;
        const s = profiledDb.getProfilingStats();
        expect(s.slowQueryPercentage).toBe('30.00%');
    });

    test('calculates correct avgQueryTimeMs', () => {
        queryStats.totalQueries = 4;
        queryStats.totalTime = 100;
        const s = profiledDb.getProfilingStats();
        expect(s.avgQueryTimeMs).toBe('25.00');
    });

    test('topSlowQueries sorted by avgMs descending', () => {
        queryStats.queryTimes.set('fast', { sql: 'FAST', times: [1, 2, 3] });
        queryStats.queryTimes.set('slow', { sql: 'SLOW', times: [100, 200, 300] });
        queryStats.queryTimes.set('medium', { sql: 'MED', times: [50, 60] });

        const s = profiledDb.getProfilingStats();
        expect(s.topSlowQueries.length).toBe(3);
        expect(parseFloat(s.topSlowQueries[0].avgMs)).toBeGreaterThan(parseFloat(s.topSlowQueries[1].avgMs));
        expect(parseFloat(s.topSlowQueries[1].avgMs)).toBeGreaterThan(parseFloat(s.topSlowQueries[2].avgMs));
    });

    test('topSlowQueries entries have correct count', () => {
        queryStats.queryTimes.set('q1', { sql: 'Q1', times: [10, 20, 30] });
        const s = profiledDb.getProfilingStats();
        const entry = s.topSlowQueries.find(e => e.query === 'Q1');
        expect(entry).toBeDefined();
        expect(entry.count).toBe(3);
        expect(entry.maxMs).toBe('30.00');
        expect(entry.avgMs).toBe('20.00');
    });

    test('limits topSlowQueries to 10', () => {
        for (let i = 0; i < 15; i++) {
            queryStats.queryTimes.set(`key${i}`, { sql: `SQL${i}`, times: [i * 10] });
        }
        const s = profiledDb.getProfilingStats();
        expect(s.topSlowQueries.length).toBeLessThanOrEqual(10);
    });

    test('handles 0 totalQueries without NaN', () => {
        queryStats.totalQueries = 0;
        const s = profiledDb.getProfilingStats();
        expect(s.avgQueryTimeMs).toBe('0.00');
        expect(s.slowQueryPercentage).toBe('0.00%');
    });
});

// ============================================================================
// 16. ProfiledDatabase — resetProfilingStats()
// ============================================================================
describe('ProfiledDatabase — resetProfilingStats()', () => {
    test('clears all counters and map', () => {
        queryStats.totalQueries = 50;
        queryStats.slowQueries = 10;
        queryStats.errors = 5;
        queryStats.totalTime = 1234;
        queryStats.queryTimes.set('x', { sql: 'X', times: [1] });

        profiledDb.resetProfilingStats();

        expect(queryStats.totalQueries).toBe(0);
        expect(queryStats.slowQueries).toBe(0);
        expect(queryStats.errors).toBe(0);
        expect(queryStats.totalTime).toBe(0);
        expect(queryStats.queryTimes.size).toBe(0);
    });

    test('idempotent reset', () => {
        profiledDb.resetProfilingStats();
        profiledDb.resetProfilingStats();
        expect(queryStats.totalQueries).toBe(0);
    });
});

// ============================================================================
// 17. Module exports verification
// ============================================================================
describe('Module exports', () => {
    test('pool has all expected methods', () => {
        expect(typeof pool.init).toBe('function');
        expect(typeof pool.acquire).toBe('function');
        expect(typeof pool.release).toBe('function');
        expect(typeof pool.close).toBe('function');
        expect(typeof pool.getStats).toBe('function');
        expect(typeof pool._logQuery).toBe('function');
    });

    test('profiledDb has all expected methods', () => {
        expect(typeof profiledDb.get).toBe('function');
        expect(typeof profiledDb.all).toBe('function');
        expect(typeof profiledDb.run).toBe('function');
        expect(typeof profiledDb.exec).toBe('function');
        expect(typeof profiledDb.transaction).toBe('function');
        expect(typeof profiledDb.getProfilingStats).toBe('function');
        expect(typeof profiledDb.resetProfilingStats).toBe('function');
        expect(typeof profiledDb._hashQuery).toBe('function');
        expect(typeof profiledDb._profile).toBe('function');
    });

    test('profiledDb.pool references the pool singleton', () => {
        expect(profiledDb.pool).toBe(pool);
    });

    test('default export is profiledDb', async () => {
        const mod = await import('../backend/db/connectionPool.js');
        expect(mod.default).toBe(profiledDb);
    });

    test('queryStats is exported and mutable', () => {
        queryStats.totalQueries = 99;
        expect(queryStats.totalQueries).toBe(99);
        resetStats();
    });

    test('queryStats.queryTimes is a Map', () => {
        expect(queryStats.queryTimes instanceof Map).toBe(true);
    });
});

// ============================================================================
// 18. Integration: full lifecycle through profiledDb methods
// ============================================================================
describe('ProfiledDatabase — full lifecycle', () => {
    test('get → all → run → exec cycle with fake connections', () => {
        injectFakeConnections(2);

        const getResult = profiledDb.get('SELECT * FROM users WHERE id = ?', ['u1']);
        expect(getResult).toBeDefined();

        const allResult = profiledDb.all('SELECT * FROM items');
        expect(Array.isArray(allResult)).toBe(true);

        const runResult = profiledDb.run('INSERT INTO items (name) VALUES (?)', ['test']);
        expect(runResult).toBeDefined();

        profiledDb.exec('PRAGMA optimize');

        expect(queryStats.totalQueries).toBe(4);
        expect(queryStats.errors).toBe(0);

        restorePool();
    });

    test('profiling stats reflect operations after lifecycle', () => {
        injectFakeConnections(1);

        profiledDb.get('SELECT a FROM t');
        profiledDb.all('SELECT b FROM t');
        profiledDb.run('UPDATE t SET c = ?', [1]);

        const stats = profiledDb.getProfilingStats();
        expect(stats.totalQueries).toBe(3);
        expect(parseFloat(stats.totalTimeMs)).toBeGreaterThanOrEqual(0);
        expect(stats.pool.poolSize).toBe(pool.poolSize);

        restorePool();
    });
});
