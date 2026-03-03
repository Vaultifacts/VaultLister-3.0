import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 0 }));

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

// Mock email service (no other test file imports this directly — safe)
const mockEmailSend = mock(() => Promise.resolve());
mock.module('../backend/services/email.js', () => ({
  default: { send: mockEmailSend }
}));

const {
  startGDPRWorker,
  stopGDPRWorker
} = await import('../backend/workers/gdprWorker.js');

afterAll(() => { stopGDPRWorker(); });

describe('gdprWorker (unit)', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 0 });
    mockEmailSend.mockReset();
    mockEmailSend.mockReturnValue(Promise.resolve());
  });

  describe('stopGDPRWorker', () => {
    test('is safe when not running', () => {
      stopGDPRWorker();
      expect(true).toBe(true);
    });

    test('can be called multiple times', () => {
      stopGDPRWorker();
      stopGDPRWorker();
      stopGDPRWorker();
      expect(true).toBe(true);
    });
  });

  describe('startGDPRWorker + stopGDPRWorker lifecycle', () => {
    test('starts without error when no pending deletions', () => {
      mockQueryAll.mockReturnValue([]);
      startGDPRWorker();
      stopGDPRWorker();
      expect(true).toBe(true);
    });

    test('queries pending deletions on start', async () => {
      mockQueryAll.mockReturnValue([]);
      startGDPRWorker();
      // Give async tasks a moment to fire
      await new Promise(r => setTimeout(r, 50));
      stopGDPRWorker();
      // processAccountDeletions queries account_deletion_requests
      const allCalls = mockQueryAll.mock.calls;
      expect(allCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('processes deletion when pending record exists', async () => {
      mockQueryAll
        .mockReturnValueOnce([{
          id: 'del-1', user_id: 'user-1', email: 'test@example.com',
          full_name: 'Test User', username: 'testuser',
          status: 'pending', scheduled_for: new Date(Date.now() - 86400000).toISOString()
        }])
        .mockReturnValueOnce([]) // sendDeletionReminders
        .mockReturnValue([]);

      startGDPRWorker();
      await new Promise(r => setTimeout(r, 100));
      stopGDPRWorker();

      // Should have run DELETE queries for user data tables
      const runCalls = mockQueryRun.mock.calls;
      expect(runCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('runs cleanupExportRequests on start', async () => {
      mockQueryAll.mockReturnValue([]);
      startGDPRWorker();
      await new Promise(r => setTimeout(r, 50));
      stopGDPRWorker();

      // cleanupExportRequests calls query.run with UPDATE data_export_requests
      const exportCleanup = mockQueryRun.mock.calls.find(
        c => c[0] && c[0].includes('data_export_requests')
      );
      expect(exportCleanup).toBeTruthy();
    });
  });
});
