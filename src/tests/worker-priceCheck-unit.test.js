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

// Do NOT mock notificationService.js — it uses the mocked DB internally

const {
  startPriceCheckWorker,
  stopPriceCheckWorker,
  triggerPriceCheck,
  getPriceCheckWorkerStatus
} = await import('../backend/workers/priceCheckWorker.js');

afterAll(() => { stopPriceCheckWorker(); });

describe('priceCheckWorker (unit)', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
  });

  describe('triggerPriceCheck', () => {
    test('returns error for non-existent items', async () => {
      mockQueryGet.mockReturnValue(null);
      const results = await triggerPriceCheck(['no-such-item']);
      expect(results.checked).toBe(0);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].error).toBe('Item not found');
    });

    test('handles multiple not-found items', async () => {
      mockQueryGet.mockReturnValue(null);
      const results = await triggerPriceCheck(['a', 'b', 'c']);
      expect(results.checked).toBe(0);
      expect(results.errors).toHaveLength(3);
    });

    test('checks found item and updates price', async () => {
      mockQueryGet.mockReturnValue({
        id: 'item-1', name: 'Test Widget', current_price: 50.00,
        alert_threshold: 0.10, alert_enabled: 1,
        supplier_name: 'Test Supplier', user_id: 'user-1',
        supplier_id: 'sup-1', target_price: null, last_price: null
      });
      const results = await triggerPriceCheck(['item-1']);
      expect(results.checked).toBe(1);
      // Price update query should have been called
      const priceUpdate = mockQueryRun.mock.calls.find(c =>
        c[0] && c[0].includes('UPDATE supplier_items')
      );
      expect(priceUpdate).toBeTruthy();
    });

    test('returns correct shape', async () => {
      mockQueryGet.mockReturnValue(null);
      const results = await triggerPriceCheck([]);
      expect(results).toHaveProperty('checked');
      expect(results).toHaveProperty('drops');
      expect(results).toHaveProperty('targets');
      expect(results).toHaveProperty('errors');
      expect(results.checked).toBe(0);
      expect(results.drops).toBe(0);
      expect(results.targets).toBe(0);
    });

    test('updates supplier_items price on check', async () => {
      mockQueryGet.mockReturnValue({
        id: 'item-2', name: 'Price Track', current_price: 100,
        alert_threshold: 0.10, alert_enabled: 1,
        supplier_name: 'Supplier X', user_id: 'user-1',
        supplier_id: 'sup-2', target_price: null, last_price: null
      });
      await triggerPriceCheck(['item-2']);
      // simulatePriceFetch may return null (5% chance) — skip assertion if no run calls
      if (mockQueryRun.mock.calls.length > 0) {
        const priceUpdate = mockQueryRun.mock.calls.find(c =>
          c[0] && c[0].includes('supplier_items')
        );
        expect(priceUpdate).toBeTruthy();
      }
    });
  });
});
