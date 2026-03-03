import { describe, expect, test } from 'bun:test';
import { pool, profiledDb, queryStats } from '../backend/db/connectionPool.js';

describe('ConnectionPool', () => {

  describe('getStats', () => {
    test('returns pool statistics shape', () => {
      const stats = pool.getStats();
      expect(stats).toHaveProperty('poolSize');
      expect(stats).toHaveProperty('availableConnections');
      expect(stats).toHaveProperty('activeConnections');
    });

    test('poolSize matches configured value', () => {
      const stats = pool.getStats();
      expect(stats.poolSize).toBeGreaterThan(0);
    });
  });
});

describe('ProfiledDatabase', () => {

  describe('_hashQuery', () => {
    test('normalizes whitespace', () => {
      const a = profiledDb._hashQuery('SELECT  *  FROM   users');
      const b = profiledDb._hashQuery('SELECT * FROM users');
      expect(a).toBe(b);
    });

    test('replaces string literals with ?', () => {
      const hash = profiledDb._hashQuery("SELECT * FROM users WHERE name = 'Alice'");
      expect(hash).not.toContain('Alice');
      expect(hash).toContain('?');
    });

    test('replaces numeric literals with ?', () => {
      const hash = profiledDb._hashQuery('SELECT * FROM items WHERE price > 99.50');
      expect(hash).not.toContain('99');
      expect(hash).toContain('?');
    });

    test('normalizes different UUIDs to same hash', () => {
      const a = profiledDb._hashQuery("SELECT * FROM users WHERE id = 'abc-123'");
      const b = profiledDb._hashQuery("SELECT * FROM users WHERE id = 'def-456'");
      expect(a).toBe(b);
    });

    test('distinguishes different query structures', () => {
      const a = profiledDb._hashQuery('SELECT * FROM users WHERE id = ?');
      const b = profiledDb._hashQuery('SELECT * FROM items WHERE id = ?');
      expect(a).not.toBe(b);
    });

    test('truncates to 120 characters', () => {
      const longQuery = 'SELECT ' + 'a, '.repeat(100) + 'z FROM very_long_table';
      const hash = profiledDb._hashQuery(longQuery);
      expect(hash.length).toBeLessThanOrEqual(120);
    });

    test('replaces hex literals with ?', () => {
      const hash = profiledDb._hashQuery('SELECT * FROM logs WHERE hash = 0xDEADBEEF');
      expect(hash).not.toContain('DEADBEEF');
      expect(hash).toContain('?');
    });
  });

  describe('getProfilingStats', () => {
    test('returns profiling statistics shape', () => {
      const stats = profiledDb.getProfilingStats();
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('slowQueries');
      expect(stats).toHaveProperty('slowQueryPercentage');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('avgQueryTimeMs');
      expect(stats).toHaveProperty('totalTimeMs');
      expect(stats).toHaveProperty('topSlowQueries');
      expect(stats).toHaveProperty('pool');
    });

    test('topSlowQueries is an array', () => {
      expect(Array.isArray(profiledDb.getProfilingStats().topSlowQueries)).toBe(true);
    });

    test('pool stats nested inside profiling stats', () => {
      const stats = profiledDb.getProfilingStats();
      expect(stats.pool).toHaveProperty('poolSize');
    });
  });

  describe('resetProfilingStats', () => {
    test('resets all counters to zero', () => {
      profiledDb.resetProfilingStats();
      expect(queryStats.totalQueries).toBe(0);
      expect(queryStats.slowQueries).toBe(0);
      expect(queryStats.errors).toBe(0);
      expect(queryStats.totalTime).toBe(0);
      expect(queryStats.queryTimes.size).toBe(0);
    });

    test('profiling stats reflect reset', () => {
      profiledDb.resetProfilingStats();
      const stats = profiledDb.getProfilingStats();
      expect(stats.totalQueries).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.topSlowQueries).toHaveLength(0);
    });
  });
});
