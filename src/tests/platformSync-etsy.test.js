import { describe, expect, test, mock, beforeEach } from 'bun:test';

const mockQueryGet = mock(() => null);
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

// Do NOT mock encryption.js
import { encryptToken } from '../backend/utils/encryption.js';

const {
  syncEtsyShop,
  createEtsyListing,
  updateEtsyListing,
  deleteEtsyListing
} = await import('../backend/services/platformSync/etsySync.js');

const makeShop = () => ({
  id: 'shop-etsy-1', user_id: 'user-1',
  oauth_token: encryptToken('test-etsy-token'),
  platform: 'etsy'
});

describe('etsySync', () => {
  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    process.env.OAUTH_MODE = 'mock';
  });

  describe('syncEtsyShop', () => {
    test('returns expected result shape', async () => {
      const result = await syncEtsyShop(makeShop());
      expect(result).toHaveProperty('listings');
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('startedAt');
      expect(result.completedAt).not.toBeNull();
    });

    test('should return 0 synced listings when mock mode returns empty data', async () => {
      const result = await syncEtsyShop(makeShop());
      expect(result.listings.synced).toBe(0);
      expect(result.listings.created).toBe(0);
      expect(result.listings.updated).toBe(0);
    });

    test('should return 0 updated listings when mock mode returns empty data', async () => {
      mockQueryGet.mockReturnValue({ id: 'existing-1' });
      const result = await syncEtsyShop(makeShop());
      expect(result.listings.updated).toBe(0);
      expect(result.listings.created).toBe(0);
    });

    test('should return 0 synced orders when mock mode returns empty data', async () => {
      const result = await syncEtsyShop(makeShop());
      expect(result.orders.synced).toBe(0);
      expect(result.orders.created).toBe(0);
    });

    test('should return 0 created orders when existing order found in mock mode', async () => {
      mockQueryGet.mockReturnValue({ id: 'existing' });
      const result = await syncEtsyShop(makeShop());
      expect(result.orders.synced).toBe(0);
      expect(result.orders.created).toBe(0);
    });

    test('should not update shop sync time when mock mode returns early', async () => {
      await syncEtsyShop(makeShop());
      const shopUpdate = mockQueryRun.mock.calls.find(c =>
        c[0] && c[0].includes('UPDATE shops')
      );
      expect(shopUpdate).toBeUndefined();
    });

    test('throws for invalid encrypted token', async () => {
      const badShop = { ...makeShop(), oauth_token: 'bad-token' };
      try {
        await syncEtsyShop(badShop);
        expect(true).toBe(false);
      } catch (e) {
        expect(e.message).toBeDefined();
      }
    });
  });

  describe('createEtsyListing (mock mode)', () => {
    test('should return success=false in mock mode', async () => {
      const result = await createEtsyListing('token', { title: 'Test Item', price: 25 });
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('updateEtsyListing (mock mode)', () => {
    test('should return success=false in mock mode', async () => {
      const result = await updateEtsyListing('token', 'listing-1', { title: 'Updated' });
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('deleteEtsyListing (mock mode)', () => {
    test('should return success=false in mock mode', async () => {
      const result = await deleteEtsyListing('token', 'listing-1');
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });
});
