import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
  escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
  cleanupExpiredData: mock(() => ({})),
  initializeDatabase: mock(() => true),
  default: {}
}));

// Do NOT mock notionService.js — it uses the mocked DB internally
// Do NOT mock encryption.js — contamination risk

const {
  performSync,
  resolveConflict,
  startSyncScheduler,
  stopSyncScheduler
} = await import('../backend/services/platformSync/notionSync.js');

afterAll(() => { stopSyncScheduler(); });

describe('notionSync', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
  });

  describe('performSync', () => {
    test('throws when Notion not configured', async () => {
      mockQueryGet.mockReturnValue(null); // getSettings returns null
      try {
        await performSync('user-1');
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toContain('not configured');
      }
    });

    test('throws when sync already in progress (recent)', async () => {
      mockQueryGet.mockReturnValue({
        last_sync_status: 'in_progress',
        last_sync_at: new Date().toISOString(), // Just now — within 5min window
        sync_enabled: 1
      });
      try {
        await performSync('user-1');
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toContain('already in progress');
      }
    });

    test('allows override if stuck sync is older than 5 minutes', async () => {
      const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      mockQueryGet.mockReturnValue({
        last_sync_status: 'in_progress',
        last_sync_at: staleTime,
        inventory_database_id: null,
        sales_database_id: null,
        notes_database_id: null,
        conflict_strategy: 'manual',
        sync_enabled: 1
      });
      const result = await performSync('user-1');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('success');
    });

    test('completes with zero items when no database IDs configured', async () => {
      mockQueryGet.mockReturnValue({
        last_sync_status: 'success',
        last_sync_at: null,
        inventory_database_id: null,
        sales_database_id: null,
        notes_database_id: null,
        conflict_strategy: 'manual',
        sync_enabled: 1
      });
      const result = await performSync('user-1');
      expect(result.status).toBe('success');
      expect(result.inventory.pushed).toBe(0);
      expect(result.inventory.pulled).toBe(0);
      expect(result.sales.pushed).toBe(0);
      expect(result.notes.pushed).toBe(0);
    });

    test('returns expected result shape', async () => {
      mockQueryGet.mockReturnValue({
        last_sync_status: null, last_sync_at: null,
        inventory_database_id: null, sales_database_id: null,
        notes_database_id: null, conflict_strategy: 'manual'
      });
      const result = await performSync('user-1', { manual: true });
      expect(result).toHaveProperty('sync_id');
      expect(result).toHaveProperty('direction');
      expect(result).toHaveProperty('entity_types');
      expect(result).toHaveProperty('started_at');
      expect(result).toHaveProperty('completed_at');
      expect(result).toHaveProperty('duration_ms');
      expect(result.manual).toBe(true);
    });

    test('marks sync as in_progress then updates status', async () => {
      mockQueryGet.mockReturnValue({
        last_sync_status: null, last_sync_at: null,
        inventory_database_id: null, sales_database_id: null,
        notes_database_id: null, conflict_strategy: 'manual'
      });
      await performSync('user-1');
      const inProgressCall = mockQueryRun.mock.calls.find(c =>
        c[0] && c[0].includes('in_progress')
      );
      expect(inProgressCall).toBeTruthy();
    });
  });

  describe('resolveConflict', () => {
    test('throws when conflict not found', async () => {
      mockQueryGet.mockReturnValue(null);
      try {
        await resolveConflict('user-1', 'conflict-1', 'keep_local');
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toContain('Conflict not found');
      }
    });
  });

  describe('syncScheduler lifecycle', () => {
    test('stopSyncScheduler is safe when not running', () => {
      stopSyncScheduler();
      expect(true).toBe(true);
    });

    test('startSyncScheduler + stopSyncScheduler cycle', () => {
      mockQueryAll.mockReturnValue([]); // No due users
      startSyncScheduler();
      stopSyncScheduler();
      expect(true).toBe(true);
    });

    test('double stop does not throw', () => {
      stopSyncScheduler();
      stopSyncScheduler();
      expect(true).toBe(true);
    });
  });
});
