import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// --- Database mocks (ONLY allowed mock.module #1) ---
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

// --- Logger mock (ONLY allowed mock.module #2) ---
mock.module('../backend/shared/logger.js', () => ({
  logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
  default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

// --- Import module under test ---
// taskWorker.js imports platformSync, notificationService, uuid at the top level.
// They will resolve naturally. Since database.js is mocked, they won't hit a real DB.
const {
  startTaskWorker,
  stopTaskWorker,
  queueTask,
  getTaskStatus,
  getWorkerStatus,
  cleanupOldTasks
} = await import('../backend/workers/taskWorker.js');

afterAll(() => {
  stopTaskWorker();
});

describe('taskWorker (unit)', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
  });

  // =================================================================
  // 1. queueTask()
  // =================================================================
  describe('queueTask', () => {
    test('returns a task object with correct fields', () => {
      const result = queueTask('sync_shop', { shopId: 'shop-1', userId: 'user-1' });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('type', 'sync_shop');
      expect(result).toHaveProperty('payload');
      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('priority');
      expect(result).toHaveProperty('maxAttempts');
      expect(result).toHaveProperty('scheduledAt');
    });

    test('calls query.run with INSERT statement and correct values', () => {
      const payload = { shopId: 'shop-1', userId: 'user-1' };
      queueTask('sync_shop', payload);
      expect(mockQueryRun).toHaveBeenCalled();
      const callArgs = mockQueryRun.mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO task_queue');
      const params = callArgs[1];
      expect(params[1]).toBe('sync_shop');
      expect(params[2]).toBe(JSON.stringify(payload));
    });

    test('uses default priority of 0', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
      expect(result.priority).toBe(0);
    });

    test('uses default maxAttempts of 3', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
      expect(result.maxAttempts).toBe(3);
    });

    test('accepts custom priority option', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' }, { priority: 10 });
      expect(result.priority).toBe(10);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[3]).toBe(10);
    });

    test('accepts custom maxAttempts option', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' }, { maxAttempts: 5 });
      expect(result.maxAttempts).toBe(5);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[4]).toBe(5);
    });

    test('accepts custom scheduledAt option', () => {
      const scheduledAt = '2026-03-01 12:00:00';
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' }, { scheduledAt });
      expect(result.scheduledAt).toBe(scheduledAt);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[5]).toBe(scheduledAt);
    });

    test('generates a non-empty string ID (real UUID)', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    test('serializes payload to JSON in the INSERT', () => {
      const payload = { shopId: 'shop-99', userId: 'user-42', extra: [1, 2, 3] };
      queueTask('sync_shop', payload);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[2]).toBe(JSON.stringify(payload));
    });

    test('returns the payload object (not serialized)', () => {
      const payload = { shopId: 'shop-99', userId: 'user-42' };
      const result = queueTask('sync_shop', payload);
      expect(result.payload).toEqual(payload);
    });

    test('works with different task types', () => {
      const types = ['sync_shop', 'refresh_token', 'cleanup_notifications', 'sync_email_account', 'process_webhook', 'run_automation'];
      for (const type of types) {
        mockQueryRun.mockClear();
        const result = queueTask(type, { userId: 'u1' });
        expect(result.type).toBe(type);
        expect(mockQueryRun).toHaveBeenCalledTimes(1);
      }
    });

    test('scheduledAt defaults to a SQLite datetime format (no T or Z)', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
      expect(result.scheduledAt).not.toContain('T');
      expect(result.scheduledAt).not.toContain('Z');
      expect(result.scheduledAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('multiple queueTask calls generate unique IDs', () => {
      const r1 = queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
      const r2 = queueTask('sync_shop', { shopId: 's2', userId: 'u2' });
      expect(r1.id).not.toBe(r2.id);
    });
  });

  // =================================================================
  // 2. getTaskStatus()
  // =================================================================
  describe('getTaskStatus', () => {
    test('returns the task record from the database', () => {
      const taskRecord = {
        id: 'task-abc',
        type: 'sync_shop',
        status: 'completed',
        attempts: 1,
        max_attempts: 3,
        last_error: null,
        created_at: '2026-03-01 10:00:00',
        started_at: '2026-03-01 10:00:01',
        completed_at: '2026-03-01 10:00:05'
      };
      mockQueryGet.mockReturnValue(taskRecord);
      const result = getTaskStatus('task-abc');
      expect(result).toEqual(taskRecord);
    });

    test('calls query.get with the correct SQL and task ID', () => {
      mockQueryGet.mockReturnValue(null);
      getTaskStatus('task-xyz');
      expect(mockQueryGet).toHaveBeenCalledTimes(1);
      const callArgs = mockQueryGet.mock.calls[0];
      expect(callArgs[0]).toContain('SELECT');
      expect(callArgs[0]).toContain('FROM task_queue');
      expect(callArgs[0]).toContain('WHERE id = ?');
      expect(callArgs[1]).toEqual(['task-xyz']);
    });

    test('returns null when task is not found', () => {
      mockQueryGet.mockReturnValue(null);
      const result = getTaskStatus('nonexistent-id');
      expect(result).toBeNull();
    });

    test('returns undefined when query.get returns undefined', () => {
      mockQueryGet.mockReturnValue(undefined);
      const result = getTaskStatus('no-task');
      expect(result).toBeUndefined();
    });

    test('returns a pending task', () => {
      const pendingTask = {
        id: 'pending-1', type: 'refresh_token', status: 'pending',
        attempts: 0, max_attempts: 3, last_error: null,
        created_at: '2026-03-01 09:00:00', started_at: null, completed_at: null
      };
      mockQueryGet.mockReturnValue(pendingTask);
      const result = getTaskStatus('pending-1');
      expect(result.status).toBe('pending');
      expect(result.started_at).toBeNull();
    });

    test('returns a failed task with error info', () => {
      const failedTask = {
        id: 'failed-1', type: 'sync_shop', status: 'failed',
        attempts: 3, max_attempts: 3, last_error: 'Connection refused',
        created_at: '2026-03-01 08:00:00', started_at: '2026-03-01 08:00:01', completed_at: '2026-03-01 08:01:00'
      };
      mockQueryGet.mockReturnValue(failedTask);
      const result = getTaskStatus('failed-1');
      expect(result.status).toBe('failed');
      expect(result.last_error).toBe('Connection refused');
      expect(result.attempts).toBe(3);
    });

    test('selects specific columns', () => {
      mockQueryGet.mockReturnValue(null);
      getTaskStatus('x');
      const sql = mockQueryGet.mock.calls[0][0];
      expect(sql).toContain('id');
      expect(sql).toContain('type');
      expect(sql).toContain('status');
      expect(sql).toContain('attempts');
      expect(sql).toContain('max_attempts');
      expect(sql).toContain('last_error');
      expect(sql).toContain('created_at');
      expect(sql).toContain('started_at');
      expect(sql).toContain('completed_at');
    });
  });

  // =================================================================
  // 3. getWorkerStatus()
  // =================================================================
  describe('getWorkerStatus', () => {
    test('returns expected shape with all properties', () => {
      mockQueryGet.mockReturnValue({
        total_tasks: 10, pending_tasks: 3, processing_tasks: 1,
        completed_tasks: 5, failed_tasks: 1
      });
      const status = getWorkerStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('activeTasks');
      expect(status).toHaveProperty('maxConcurrent');
      expect(status).toHaveProperty('pollIntervalMs');
      expect(status).toHaveProperty('last24Hours');
    });

    test('maxConcurrent is 3', () => {
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.maxConcurrent).toBe(3);
    });

    test('pollIntervalMs is 10000 (10 seconds)', () => {
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.pollIntervalMs).toBe(10000);
    });

    test('isRunning is false when worker is stopped', () => {
      stopTaskWorker();
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.isRunning).toBe(false);
    });

    test('last24Hours contains the stats from the database', () => {
      const dbStats = {
        total_tasks: 42, pending_tasks: 5, processing_tasks: 2,
        completed_tasks: 30, failed_tasks: 5
      };
      mockQueryGet.mockReturnValue(dbStats);
      const status = getWorkerStatus();
      expect(status.last24Hours).toEqual(dbStats);
    });

    test('activeTasks is a number', () => {
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(typeof status.activeTasks).toBe('number');
    });

    test('query uses 24 hour window', () => {
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      getWorkerStatus();
      const sql = mockQueryGet.mock.calls[0][0];
      expect(sql).toContain('-24 hours');
    });

    test('query counts tasks by status', () => {
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      getWorkerStatus();
      const sql = mockQueryGet.mock.calls[0][0];
      expect(sql).toContain('pending');
      expect(sql).toContain('processing');
      expect(sql).toContain('completed');
      expect(sql).toContain('failed');
      expect(sql).toContain('COUNT(*)');
    });
  });

  // =================================================================
  // 4. cleanupOldTasks()
  // =================================================================
  describe('cleanupOldTasks', () => {
    test('returns the number of deleted tasks', () => {
      mockQueryRun.mockReturnValue({ changes: 15 });
      const result = cleanupOldTasks(7);
      expect(result).toBe(15);
    });

    test('defaults to 7 days when no argument is provided', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      cleanupOldTasks();
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[0]).toBe(7);
    });

    test('passes custom daysOld to the query', () => {
      mockQueryRun.mockReturnValue({ changes: 3 });
      cleanupOldTasks(30);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[0]).toBe(30);
    });

    test('deletes only completed and failed tasks', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      cleanupOldTasks(7);
      const sql = mockQueryRun.mock.calls[0][0];
      expect(sql).toContain("'completed'");
      expect(sql).toContain("'failed'");
    });

    test('uses DELETE FROM task_queue', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      cleanupOldTasks(14);
      const sql = mockQueryRun.mock.calls[0][0];
      expect(sql).toContain('DELETE FROM task_queue');
    });

    test('returns 0 when no tasks are old enough', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      const result = cleanupOldTasks(365);
      expect(result).toBe(0);
    });

    test('uses completed_at for age comparison', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      cleanupOldTasks(7);
      const sql = mockQueryRun.mock.calls[0][0];
      expect(sql).toContain('completed_at');
    });

    test('with daysOld of 1 works correctly', () => {
      mockQueryRun.mockReturnValue({ changes: 100 });
      const result = cleanupOldTasks(1);
      expect(result).toBe(100);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[0]).toBe(1);
    });
  });

  // =================================================================
  // 5. startTaskWorker / stopTaskWorker
  // =================================================================
  describe('startTaskWorker / stopTaskWorker', () => {
    test('stopTaskWorker does not throw when worker is not running', () => {
      stopTaskWorker();
      expect(() => stopTaskWorker()).not.toThrow();
    });

    test('startTaskWorker starts the worker (isRunning becomes true)', () => {
      stopTaskWorker();
      startTaskWorker();
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.isRunning).toBe(true);
      stopTaskWorker();
    });

    test('stopTaskWorker stops the worker (isRunning becomes false)', () => {
      startTaskWorker();
      stopTaskWorker();
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.isRunning).toBe(false);
    });

    test('calling startTaskWorker twice does not create duplicate intervals', () => {
      stopTaskWorker();
      startTaskWorker();
      startTaskWorker(); // second call should be a no-op
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.isRunning).toBe(true);
      stopTaskWorker();
    });

    test('start then stop then start cycle works correctly', () => {
      stopTaskWorker();
      startTaskWorker();
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      expect(getWorkerStatus().isRunning).toBe(true);
      stopTaskWorker();
      expect(getWorkerStatus().isRunning).toBe(false);
      startTaskWorker();
      expect(getWorkerStatus().isRunning).toBe(true);
      stopTaskWorker();
    });
  });

  // =================================================================
  // 6. Edge cases and additional coverage
  // =================================================================
  describe('edge cases', () => {
    test('queueTask with empty payload object', () => {
      const result = queueTask('cleanup_notifications', {});
      expect(result.payload).toEqual({});
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[2]).toBe('{}');
    });

    test('queueTask with nested payload data', () => {
      const payload = { userId: 'u1', config: { deep: { nested: true } }, tags: ['a', 'b'] };
      const result = queueTask('run_automation', payload);
      expect(result.payload).toEqual(payload);
      const params = mockQueryRun.mock.calls[0][1];
      expect(JSON.parse(params[2])).toEqual(payload);
    });

    test('queueTask with priority 0 is stored correctly', () => {
      const result = queueTask('process_webhook', { eventId: 'e1' }, { priority: 0 });
      expect(result.priority).toBe(0);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[3]).toBe(0);
    });

    test('queueTask with negative priority is stored', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' }, { priority: -5 });
      expect(result.priority).toBe(-5);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[3]).toBe(-5);
    });

    test('queueTask with maxAttempts of 1 means single try only', () => {
      const result = queueTask('refresh_token', { shopId: 's1', userId: 'u1' }, { maxAttempts: 1 });
      expect(result.maxAttempts).toBe(1);
    });

    test('queueTask ID is a valid UUID v4 format', () => {
      const result = queueTask('sync_shop', { shopId: 's1', userId: 'u1' });
      // Real UUID v4: 8-4-4-4-12 hex pattern
      expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    test('queueTask INSERT params order matches VALUES placeholders', () => {
      const payload = { shopId: 's1', userId: 'u1' };
      queueTask('sync_shop', payload, { priority: 5, maxAttempts: 2, scheduledAt: '2026-06-01 00:00:00' });
      const params = mockQueryRun.mock.calls[0][1];
      // Params: [id, type, payload_json, priority, maxAttempts, scheduledAt]
      expect(typeof params[0]).toBe('string');      // id
      expect(params[1]).toBe('sync_shop');           // type
      expect(params[2]).toBe(JSON.stringify(payload)); // payload
      expect(params[3]).toBe(5);                     // priority
      expect(params[4]).toBe(2);                     // maxAttempts
      expect(params[5]).toBe('2026-06-01 00:00:00'); // scheduledAt
    });

    test('getWorkerStatus activeTasks starts at 0', () => {
      stopTaskWorker();
      mockQueryGet.mockReturnValue({ total_tasks: 0 });
      const status = getWorkerStatus();
      expect(status.activeTasks).toBe(0);
    });

    test('cleanupOldTasks with large daysOld still works', () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      const result = cleanupOldTasks(9999);
      expect(result).toBe(0);
      const params = mockQueryRun.mock.calls[0][1];
      expect(params[0]).toBe(9999);
    });
  });
});
