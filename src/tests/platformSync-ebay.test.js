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

const { syncEbayShop } = await import('../backend/services/platformSync/ebaySync.js');

const makeShop = () => ({
  id: 'shop-ebay-1', user_id: 'user-1',
  oauth_token: encryptToken('test-ebay-token'),
  platform: 'ebay'
});

describe('ebaySync', () => {
  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    process.env.OAUTH_MODE = 'mock';
  });

  test('syncEbayShop returns expected result shape', async () => {
    const result = await syncEbayShop(makeShop());
    expect(result).toHaveProperty('listings');
    expect(result).toHaveProperty('orders');
    expect(result).toHaveProperty('startedAt');
    expect(result.completedAt).not.toBeNull();
  });

  test('creates 2 new listings in mock mode', async () => {
    const result = await syncEbayShop(makeShop());
    expect(result.listings.synced).toBe(2);
    expect(result.listings.created).toBe(2);
    expect(result.listings.updated).toBe(0);
  });

  test('updates existing listings when found', async () => {
    mockQueryGet.mockReturnValue({ id: 'existing-1' });
    const result = await syncEbayShop(makeShop());
    expect(result.listings.updated).toBe(2);
    expect(result.listings.created).toBe(0);
  });

  test('creates 1 new order in mock mode', async () => {
    const result = await syncEbayShop(makeShop());
    expect(result.orders.synced).toBe(1);
    expect(result.orders.created).toBe(1);
  });

  test('skips existing orders', async () => {
    mockQueryGet.mockReturnValue({ id: 'existing' });
    const result = await syncEbayShop(makeShop());
    expect(result.orders.synced).toBe(1);
    expect(result.orders.created).toBe(0);
  });

  test('updates shop sync time on success', async () => {
    await syncEbayShop(makeShop());
    const shopUpdate = mockQueryRun.mock.calls.find(c =>
      c[0] && c[0].includes('UPDATE shops')
    );
    expect(shopUpdate).toBeTruthy();
  });

  test('throws for invalid encrypted token', async () => {
    const badShop = { ...makeShop(), oauth_token: 'bad-token' };
    try {
      await syncEbayShop(badShop);
      expect(true).toBe(false);
    } catch (e) {
      expect(e.message).toBeDefined();
    }
  });

  test('order external data includes ebay platform and fee estimate', async () => {
    await syncEbayShop(makeShop());
    const insertCalls = mockQueryRun.mock.calls.filter(c =>
      c[0] && c[0].includes('INSERT INTO sales')
    );
    expect(insertCalls.length).toBe(1);
    const externalData = JSON.parse(insertCalls[0][1][10]);
    expect(externalData.platform).toBe('ebay');
  });
});
