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

import { encryptToken } from '../backend/utils/encryption.js';

const { syncGrailedShop } = await import('../backend/services/platformSync/grailedSync.js');

const makeShop = () => ({
  id: 'shop-grailed-1', user_id: 'user-1',
  oauth_token: encryptToken('test-grailed-token'),
  platform: 'grailed'
});

describe('grailedSync', () => {
  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    process.env.OAUTH_MODE = 'mock';
  });

  test('syncGrailedShop returns expected result shape', async () => {
    const result = await syncGrailedShop(makeShop());
    expect(result).toHaveProperty('listings');
    expect(result).toHaveProperty('orders');
    expect(result.completedAt).not.toBeNull();
  });

  test('creates 3 new listings in mock mode', async () => {
    const result = await syncGrailedShop(makeShop());
    expect(result.listings.synced).toBe(3);
    expect(result.listings.created).toBe(3);
    expect(result.listings.updated).toBe(0);
  });

  test('updates existing listings when found', async () => {
    mockQueryGet.mockReturnValue({ id: 'existing-1' });
    const result = await syncGrailedShop(makeShop());
    expect(result.listings.updated).toBe(3);
    expect(result.listings.created).toBe(0);
  });

  test('creates 1 new order in mock mode', async () => {
    const result = await syncGrailedShop(makeShop());
    expect(result.orders.synced).toBe(1);
    expect(result.orders.created).toBe(1);
  });

  test('skips existing orders', async () => {
    mockQueryGet.mockReturnValue({ id: 'existing' });
    const result = await syncGrailedShop(makeShop());
    expect(result.orders.created).toBe(0);
  });

  test('updates shop sync time', async () => {
    await syncGrailedShop(makeShop());
    const shopUpdate = mockQueryRun.mock.calls.find(c =>
      c[0] && c[0].includes('UPDATE shops')
    );
    expect(shopUpdate).toBeTruthy();
  });

  test('listing data includes grailed platform and designer info', async () => {
    await syncGrailedShop(makeShop());
    const insertCalls = mockQueryRun.mock.calls.filter(c =>
      c[0] && c[0].includes('INSERT INTO listings')
    );
    expect(insertCalls.length).toBe(3);
    const externalData = JSON.parse(insertCalls[0][1][9]);
    expect(externalData.platform).toBe('grailed');
    expect(externalData.designer).toBeDefined();
  });

  test('order fee calculation uses 9% + $0.30', async () => {
    await syncGrailedShop(makeShop());
    const saleInsert = mockQueryRun.mock.calls.find(c =>
      c[0] && c[0].includes('INSERT INTO sales')
    );
    expect(saleInsert).toBeTruthy();
    // Mock order price is 350, fee = 350 * 0.09 + 0.30 = 31.80
    const platformFee = saleInsert[1][6];
    expect(platformFee).toBeCloseTo(31.80, 1);
  });
});
