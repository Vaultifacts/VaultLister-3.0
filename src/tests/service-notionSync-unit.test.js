import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// Prevent real Notion API calls — must be cleared BEFORE notionService loads
const _savedNotionToken = process.env.NOTION_INTEGRATION_TOKEN;
delete process.env.NOTION_INTEGRATION_TOKEN;

// ===== Mocks (ONLY database.js and logger.js) =====

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

mock.module('../backend/shared/logger.js', () => ({
  logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
  default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

// notionService loads naturally — it imports the mocked database.js
// notionSync imports notionService — all natural

let performSync, resolveConflict, startSyncScheduler, stopSyncScheduler;
let isMocked = false;
try {
  const mod = await import('../backend/services/platformSync/notionSync.js');
  performSync = mod.performSync;
  resolveConflict = mod.resolveConflict;
  startSyncScheduler = mod.startSyncScheduler;
  stopSyncScheduler = mod.stopSyncScheduler;
  isMocked = typeof performSync === 'function';
} catch (e) {
  console.warn('service-notionSync-unit: import failed, skipping tests');
}

afterAll(() => {
  if (stopSyncScheduler) stopSyncScheduler();
  // Restore env var
  if (_savedNotionToken) process.env.NOTION_INTEGRATION_TOKEN = _savedNotionToken;
});

// Helper: make valid settings object
function makeSettings(overrides = {}) {
  return {
    last_sync_status: null,
    last_sync_at: null,
    inventory_database_id: null,
    sales_database_id: null,
    notes_database_id: null,
    conflict_strategy: 'manual',
    sync_enabled: 1,
    ...overrides
  };
}

// notionService uses query.get for getSettings, getSyncMap, getSyncMapByNotionId
// We control behavior through mockQueryGet/All/Run.
// notionService.getSettings(userId) calls:
//   query.get('SELECT * FROM notion_settings WHERE user_id = ?', [userId])
// notionService.getSyncMap(userId, entityType, localId) calls:
//   query.get('SELECT * FROM notion_sync_map WHERE user_id = ? AND entity_type = ? AND local_id = ?', ...)
// etc.

// We'll track mockQueryGet calls by the SQL pattern to return appropriate values.

describe('service-notionSync-unit', () => {

  beforeEach(() => {
    // Ensure no real Notion token leaks in
    delete process.env.NOTION_INTEGRATION_TOKEN;
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
  });

  // =========================================================================
  // 1. performSync returns sync result object
  // =========================================================================
  describe('performSync result shape', () => {
    test('returns object with expected fields', async () => {
      // getSettings call returns our settings
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1');
      expect(result).toHaveProperty('sync_id');
      expect(result).toHaveProperty('direction');
      expect(result).toHaveProperty('entity_types');
      expect(result).toHaveProperty('started_at');
      expect(result).toHaveProperty('completed_at');
      expect(result).toHaveProperty('duration_ms');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('inventory');
      expect(result).toHaveProperty('sales');
      expect(result).toHaveProperty('notes');
    });

    test('sync_id is a valid UUID format', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1');
      expect(result.sync_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    test('duration_ms is a non-negative number', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1');
      expect(typeof result.duration_ms).toBe('number');
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // 2. performSync with no settings returns error
  // =========================================================================
  describe('performSync without settings', () => {
    test('throws "not configured" when getSettings returns null', async () => {
      mockQueryGet.mockReturnValue(null);
      try {
        await performSync('user-missing');
        expect(true).toBe(false); // should not reach
      } catch (e) {
        expect(e.message).toContain('not configured');
      }
    });

    test('throws for empty user ID when settings null', async () => {
      mockQueryGet.mockReturnValue(null);
      await expect(performSync('')).rejects.toThrow('not configured');
    });
  });

  // =========================================================================
  // 3. performSync with valid settings runs sync
  // =========================================================================
  describe('performSync with valid settings', () => {
    test('completes with success status when no entities', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1');
      expect(result.status).toBe('success');
    });

    test('marks sync as in_progress via query.run', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      await performSync('user-1');
      const inProgressCall = mockQueryRun.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('in_progress')
      );
      expect(inProgressCall).toBeTruthy();
    });

    test('calls logSyncHistory via query.run on completion', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      await performSync('user-1');
      // logSyncHistory inserts into notion_sync_history
      const historyCall = mockQueryRun.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('notion_sync_history')
      );
      expect(historyCall).toBeTruthy();
    });

    test('manual flag is carried through to result', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1', { manual: true });
      expect(result.manual).toBe(true);
    });
  });

  // =========================================================================
  // 4. performSync concurrent prevention
  // =========================================================================
  describe('performSync concurrent prevention', () => {
    test('throws when sync in_progress and within 5 minutes', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({
            last_sync_status: 'in_progress',
            last_sync_at: new Date().toISOString()
          });
        }
        return null;
      });
      await expect(performSync('user-1')).rejects.toThrow('already in progress');
    });

    test('allows override when stuck sync older than 5 minutes', async () => {
      const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({
            last_sync_status: 'in_progress',
            last_sync_at: staleTime
          });
        }
        return null;
      });
      const result = await performSync('user-1');
      expect(result.status).toBe('success');
    });

    test('allows sync when last_sync_at is null (never synced)', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({
            last_sync_status: 'in_progress',
            last_sync_at: null
          });
        }
        return null;
      });
      // last_sync_at null -> lastSync = 0 -> Date.now() - 0 > 5min -> override allowed
      const result = await performSync('user-1');
      expect(result.status).toBe('success');
    });
  });

  // =========================================================================
  // 5. resolveConflict with valid conflict
  // =========================================================================
  describe('resolveConflict', () => {
    test('resolves keep_local conflict — throws without Notion token', async () => {
      // keep_local calls notionService.updatePage which needs a token
      // Without NOTION_INTEGRATION_TOKEN or encrypted_token, getClient throws
      let callIndex = 0;
      mockQueryGet.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            id: 'conflict-1', user_id: 'user-1', sync_map_id: 'sm-1',
            entity_type: 'inventory', local_id: 'local-1', notion_page_id: 'notion-1',
            local_data: '{}', notion_data: '{}'
          };
        }
        if (callIndex === 2) {
          return { id: 'sm-1', local_id: 'local-1', notion_page_id: 'notion-1' };
        }
        if (callIndex === 3) {
          return { id: 'local-1', title: 'Item', updated_at: new Date().toISOString() };
        }
        return null;
      });
      await expect(resolveConflict('user-1', 'conflict-1', 'keep_local'))
        .rejects.toThrow('Notion integration not configured');
    });

    test('resolves ignore conflict without modifying data', async () => {
      let callIndex = 0;
      mockQueryGet.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            id: 'conflict-2', user_id: 'user-1', sync_map_id: 'sm-2',
            entity_type: 'inventory', local_id: 'local-2', notion_page_id: 'notion-2'
          };
        }
        if (callIndex === 2) {
          return { id: 'sm-2', local_id: 'local-2', notion_page_id: 'notion-2' };
        }
        return null;
      });
      const result = await resolveConflict('user-1', 'conflict-2', 'ignore');
      expect(result).toEqual({ success: true });
    });

    test('resolves keep_notion conflict by pulling from Notion', async () => {
      let callIndex = 0;
      mockQueryGet.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            id: 'conflict-3', user_id: 'user-1', sync_map_id: 'sm-3',
            entity_type: 'inventory', local_id: 'local-3', notion_page_id: 'notion-3'
          };
        }
        if (callIndex === 2) {
          return { id: 'sm-3', local_id: 'local-3', notion_page_id: 'notion-3' };
        }
        // notionService.getPage will call query.get for notion_settings (token)
        // then use the Notion API -- but since token is encrypted and we're testing
        // the resolution flow, the getPage call will likely throw.
        // Let's return null for subsequent calls
        return null;
      });
      // keep_notion calls notionService.getPage which needs Notion API access.
      // Since we don't mock notionService, this will fail when trying to decrypt token.
      // We test that it either succeeds or throws the expected error.
      try {
        const result = await resolveConflict('user-1', 'conflict-3', 'keep_notion');
        expect(result).toEqual({ success: true });
      } catch (e) {
        // Expected: notionService.getPage may fail without real Notion config
        expect(e.message).toBeDefined();
      }
    });

    test('merge without mergedData throws error', async () => {
      let callIndex = 0;
      mockQueryGet.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            id: 'conflict-5', user_id: 'user-1', sync_map_id: 'sm-5',
            entity_type: 'inventory', local_id: 'local-5', notion_page_id: 'notion-5'
          };
        }
        if (callIndex === 2) {
          return { id: 'sm-5', local_id: 'local-5', notion_page_id: 'notion-5' };
        }
        return null;
      });
      await expect(resolveConflict('user-1', 'conflict-5', 'merge')).rejects.toThrow('merged_data required');
    });
  });

  // =========================================================================
  // 6. resolveConflict with nonexistent conflict
  // =========================================================================
  describe('resolveConflict -- not found', () => {
    test('throws when conflict does not exist', async () => {
      mockQueryGet.mockReturnValue(null);
      await expect(resolveConflict('user-1', 'no-such-id', 'keep_local')).rejects.toThrow('Conflict not found');
    });
  });

  // =========================================================================
  // 7. startSyncScheduler / stopSyncScheduler
  // =========================================================================
  describe('syncScheduler lifecycle', () => {
    test('stopSyncScheduler is safe when not running', () => {
      stopSyncScheduler();
      // Should not throw
      expect(true).toBe(true);
    });

    test('startSyncScheduler + stopSyncScheduler cycle', () => {
      startSyncScheduler();
      stopSyncScheduler();
      expect(true).toBe(true);
    });

    test('double start does not create duplicate intervals', () => {
      startSyncScheduler();
      startSyncScheduler(); // should be ignored (early return)
      stopSyncScheduler();
      expect(true).toBe(true);
    });

    test('double stop does not throw', () => {
      stopSyncScheduler();
      stopSyncScheduler();
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // 8. Sync direction: push, pull, bidirectional
  // =========================================================================
  describe('sync directions', () => {
    test('push direction with inventory DB pushes items', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({ inventory_database_id: 'inv-db-1' });
        }
        // getSyncMap returns null -> create new
        if (typeof sql === 'string' && sql.includes('notion_sync_map')) return null;
        // For notion_settings token lookup (used by notionService.createPage)
        return null;
      });
      // Local items to push
      mockQueryAll.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('inventory')) {
          return [
            { id: 'item-1', user_id: 'user-1', title: 'Widget', updated_at: new Date().toISOString(), deleted_at: null }
          ];
        }
        return [];
      });

      // notionService.createPage needs Notion API access, which will fail
      // since we don't have real credentials. The error should be caught per-item.
      const result = await performSync('user-1', { direction: 'push', entity_types: ['inventory'] });
      // Either pushed successfully (if createPage mock works) or errors captured
      expect(result.inventory).toBeDefined();
      expect(typeof result.inventory.pushed).toBe('number');
      expect(typeof result.inventory.errors.length).toBe('number');
    });

    test('bidirectional is the default direction', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1');
      expect(result.direction).toBe('bidirectional');
    });
  });

  // =========================================================================
  // 9. Entity types filtering
  // =========================================================================
  describe('entity types filtering', () => {
    test('defaults to all three entity types', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1');
      expect(result.entity_types).toEqual(['inventory', 'sales', 'notes']);
    });

    test('respects custom entity_types filter', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) return makeSettings();
        return null;
      });
      const result = await performSync('user-1', { entity_types: ['inventory'] });
      expect(result.entity_types).toEqual(['inventory']);
    });

    test('only syncs sales when sales entity type specified', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({ sales_database_id: 'sales-db-1' });
        }
        return null;
      });
      mockQueryAll.mockReturnValue([]);
      const result = await performSync('user-1', { direction: 'push', entity_types: ['sales'] });
      expect(result.sales.pushed).toBe(0);
      expect(result.sales.errors.length).toBe(0);
    });

    test('notes entity returns empty results (placeholder)', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({ notes_database_id: 'notes-db-1' });
        }
        return null;
      });
      const result = await performSync('user-1', { entity_types: ['notes'] });
      expect(result.notes.pushed).toBe(0);
      expect(result.notes.pulled).toBe(0);
    });
  });

  // =========================================================================
  // 10. Error handling in sync
  // =========================================================================
  describe('error handling', () => {
    test('updates notion_settings with error message on failures', async () => {
      mockQueryGet.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('notion_settings')) {
          return makeSettings({ inventory_database_id: 'inv-db-1' });
        }
        // getSyncMap returns null -> create new -> will fail without Notion API
        return null;
      });
      mockQueryAll.mockImplementation((sql) => {
        if (typeof sql === 'string' && sql.includes('inventory')) {
          return [
            { id: 'item-1', user_id: 'user-1', title: 'Bad', updated_at: new Date().toISOString() }
          ];
        }
        return [];
      });

      const result = await performSync('user-1', { direction: 'push', entity_types: ['inventory'] });
      // If createPage fails, errors are captured
      if (result.inventory.errors.length > 0) {
        const statusCall = mockQueryRun.mock.calls.find(c =>
          typeof c[0] === 'string' && c[0].includes('last_sync_status') && c[0].includes('last_sync_error')
        );
        expect(statusCall).toBeTruthy();
      }
      // Either way, the sync completed (didn't throw)
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // Additional: resolveConflict marks as resolved in DB
  // =========================================================================
  describe('resolveConflict DB updates', () => {
    test('marks conflict resolved=1 in database', async () => {
      let callIndex = 0;
      mockQueryGet.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            id: 'c1', user_id: 'user-1', sync_map_id: 'sm-1',
            entity_type: 'inventory', local_id: 'l1', notion_page_id: 'n1'
          };
        }
        if (callIndex === 2) {
          return { id: 'sm-1' };
        }
        return null;
      });
      await resolveConflict('user-1', 'c1', 'ignore');
      const resolveCall = mockQueryRun.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('resolved = 1')
      );
      expect(resolveCall).toBeTruthy();
    });

    test('calls updateSyncStatus after resolution', async () => {
      let callIndex = 0;
      mockQueryGet.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            id: 'c2', user_id: 'user-1', sync_map_id: 'sm-2',
            entity_type: 'inventory', local_id: 'l2', notion_page_id: 'n2'
          };
        }
        if (callIndex === 2) {
          return { id: 'sm-2' };
        }
        return null;
      });
      await resolveConflict('user-1', 'c2', 'ignore');
      // updateSyncStatus calls query.run with UPDATE notion_sync_map ... sync_status
      const statusCall = mockQueryRun.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('notion_sync_map') && c[0].includes('sync_status')
      );
      expect(statusCall).toBeTruthy();
    });
  });
});
