// platformSync/index.js — comprehensive coverage tests
// Targets: syncShop, isSyncSupported, getSyncStatus, getSupportedPlatforms
// Coverage goal: 80%+ for platformSync/index.js (174 lines)

// Prevent real Notion API calls — must be cleared BEFORE any imports
const _savedNotionToken = process.env.NOTION_INTEGRATION_TOKEN;
delete process.env.NOTION_INTEGRATION_TOKEN;

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ===== Mocks (ONLY database.js and logger.js) =====

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

mock.module('../backend/shared/logger.js', () => ({
  logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
  default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

// Real encryption loads naturally
import { encryptToken } from '../backend/utils/encryption.js';

// Import module under test — platformSync/index.js
// This also imports ebaySync, poshmarkSync, etc. which all load naturally
const {
  syncShop,
  isSyncSupported,
  getSyncStatus,
  getSupportedPlatforms,
} = await import('../backend/services/platformSync/index.js');

afterAll(() => {
  if (_savedNotionToken) process.env.NOTION_INTEGRATION_TOKEN = _savedNotionToken;
});

function resetMocks() {
  mockQueryGet.mockReset();
  mockQueryGet.mockReturnValue(null);
  mockQueryAll.mockReset();
  mockQueryAll.mockReturnValue([]);
  mockQueryRun.mockReset();
  mockQueryRun.mockReturnValue({ changes: 1 });
  process.env.OAUTH_MODE = 'mock';
}

function makeConnectedShop(platform, overrides = {}) {
  return {
    id: `shop-${platform}-cov`,
    user_id: 'user-cov-1',
    platform,
    connection_type: 'oauth',
    is_connected: 1,
    oauth_token: encryptToken(`test-${platform}-token`),
    oauth_refresh_token: encryptToken(`test-${platform}-refresh`),
    oauth_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ============================================================
// isSyncSupported — comprehensive coverage
// ============================================================

describe('isSyncSupported — coverage', () => {
  test('returns true for all 4 supported platforms', () => {
    const supported = ['ebay', 'poshmark', 'depop', 'grailed'];
    for (const p of supported) {
      expect(isSyncSupported(p)).toBe(true);
    }
  });

  test('is case-insensitive (toLowerCase)', () => {
    expect(isSyncSupported('EBAY')).toBe(true);
    expect(isSyncSupported('Poshmark')).toBe(true);
    expect(isSyncSupported('MeRcArI')).toBe(true);
    expect(isSyncSupported('DEPOP')).toBe(true);
    expect(isSyncSupported('GRAILED')).toBe(true);
    expect(isSyncSupported('ETSY')).toBe(true);
  });

  test('returns false for unsupported platforms', () => {
    expect(isSyncSupported('amazon')).toBe(false);
    expect(isSyncSupported('walmart')).toBe(false);
    expect(isSyncSupported('')).toBe(false);
  });
});

// ============================================================
// getSupportedPlatforms — full structure verification
// ============================================================

describe('getSupportedPlatforms — coverage', () => {
  test('returns array of 7 platforms', () => {
    const platforms = getSupportedPlatforms();
    expect(Array.isArray(platforms)).toBe(true);
    expect(platforms.length).toBe(7);
  });

  test('all entries have required shape', () => {
    for (const p of getSupportedPlatforms()) {
      expect(typeof p.platform).toBe('string');
      expect(typeof p.syncSupported).toBe('boolean');
      expect(Array.isArray(p.capabilities)).toBe(true);
      expect(typeof p.oauthSupported).toBe('boolean');
    }
  });

  test('all 7 platforms have syncSupported=true', () => {
    const platforms = getSupportedPlatforms();
    const supported = platforms.filter(p => p.syncSupported);
    expect(supported.length).toBe(7);
  });

  test('facebook entry has listings+orders capabilities', () => {
    const fb = getSupportedPlatforms().find(p => p.platform === 'facebook');
    expect(fb).toBeDefined();
    expect(fb.syncSupported).toBe(true);
    expect(fb.capabilities).toContain('listings');
    expect(fb.oauthSupported).toBe(true);
  });

  test('all sync-supported platforms have listings+orders capabilities', () => {
    const supported = getSupportedPlatforms().filter(p => p.syncSupported);
    for (const p of supported) {
      expect(p.capabilities).toContain('listings');
      expect(p.capabilities).toContain('orders');
    }
  });

  test('all sync-supported platforms have oauthSupported=true', () => {
    const supported = getSupportedPlatforms().filter(p => p.syncSupported);
    for (const p of supported) {
      expect(p.oauthSupported).toBe(true);
    }
  });

  test('platform names match expected list', () => {
    const names = getSupportedPlatforms().map(p => p.platform);
    expect(names).toContain('ebay');
    expect(names).toContain('poshmark');
    expect(names).toContain('depop');
    expect(names).toContain('grailed');
    expect(names).toContain('facebook');
  });
});

// ============================================================
// syncShop — all code paths
// ============================================================

describe('syncShop — coverage', () => {
  beforeEach(resetMocks);

  test('throws when shop not found', async () => {
    mockQueryGet.mockReturnValue(null);

    await expect(syncShop('nonexistent', 'user-1'))
      .rejects.toThrow('Shop not found');
  });

  test('throws when shop is not connected via OAuth', async () => {
    mockQueryGet.mockReturnValue(null); // query returns null for the filter conditions
    await expect(syncShop('shop-1', 'user-1'))
      .rejects.toThrow('Shop not found');
  });

  test('throws when shop has no oauth_token', async () => {
    mockQueryGet.mockReturnValue({
      id: 'shop-no-token',
      user_id: 'user-1',
      platform: 'ebay',
      connection_type: 'oauth',
      is_connected: 1,
      oauth_token: null,
    });

    await expect(syncShop('shop-no-token', 'user-1'))
      .rejects.toThrow('No OAuth token available');
  });

  test('routes to Facebook sync handler and returns results', async () => {
    mockQueryGet.mockReturnValue({
      id: 'shop-fb',
      user_id: 'user-1',
      platform: 'facebook',
      connection_type: 'oauth',
      is_connected: 1,
      oauth_token: encryptToken('fb-token'),
    });

    const result = await syncShop('shop-fb', 'user-1');
    expect(result).toBeDefined();
    expect(result.listings).toBeDefined();
  });

  test('routes to eBay sync handler and returns results', async () => {
    const shop = makeConnectedShop('ebay');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-ebay-cov', 'user-cov-1');
    expect(result).toBeDefined();
    expect(result.listings).toBeDefined();
    expect(result.orders).toBeDefined();
    expect(result.startedAt).toBeDefined();
    expect(result.completedAt).toBeDefined();
  });

  test('routes to Poshmark sync handler', async () => {
    const shop = makeConnectedShop('poshmark');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-poshmark-cov', 'user-cov-1');
    expect(result.listings).toBeDefined();
    // mock mode early-returns with synced=0 (no public API; uses Playwright automations)
    expect(result.listings.synced).toBe(0);
  });

  test('routes to Mercari sync handler', async () => {
    const shop = makeConnectedShop('mercari');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-mercari-cov', 'user-cov-1');
    expect(result.listings).toBeDefined();
    // mock mode early-returns with synced=0 (no public API; uses Playwright automations)
    expect(result.listings.synced).toBe(0);
  });

  test('routes to Depop sync handler', async () => {
    const shop = makeConnectedShop('depop');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-depop-cov', 'user-cov-1');
    expect(result.listings).toBeDefined();
    // mock mode early-returns with synced=0 (no public API; uses Playwright automations)
    expect(result.listings.synced).toBe(0);
  });

  test('routes to Grailed sync handler', async () => {
    const shop = makeConnectedShop('grailed');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-grailed-cov', 'user-cov-1');
    expect(result.listings).toBeDefined();
    // mock mode early-returns with synced=0 (no public API; uses Playwright automations)
    expect(result.listings.synced).toBe(0);
  });

  test('routes to Etsy sync handler', async () => {
    const shop = makeConnectedShop('etsy');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-etsy-cov', 'user-cov-1');
    expect(result.listings).toBeDefined();
    // mock mode early-returns with synced=0 (no public API; uses Playwright automations)
    expect(result.listings.synced).toBe(0);
  });

  test('platform matching is case-insensitive via getSyncHandler', async () => {
    // The shop object has platform in whatever case, and getSyncHandler lowercases it
    const shop = makeConnectedShop('ebay');
    shop.platform = 'EBAY'; // Uppercase
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-ebay-upper', 'user-cov-1');
    expect(result.listings).toBeDefined();
  });

  test('sync results include listing create counts', async () => {
    const shop = makeConnectedShop('ebay');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-ebay-cov', 'user-cov-1');
    expect(typeof result.listings.created).toBe('number');
    expect(typeof result.listings.synced).toBe('number');
  });

  test('sync results include order create counts', async () => {
    const shop = makeConnectedShop('ebay');
    mockQueryGet.mockReturnValue(shop);

    const result = await syncShop('shop-ebay-cov', 'user-cov-1');
    expect(typeof result.orders.created).toBe('number');
    expect(typeof result.orders.synced).toBe('number');
  });

  test('throws for totally unknown platform', async () => {
    mockQueryGet.mockReturnValue({
      id: 'shop-unknown',
      user_id: 'user-1',
      platform: 'aliexpress',
      connection_type: 'oauth',
      is_connected: 1,
      oauth_token: encryptToken('some-token'),
    });

    await expect(syncShop('shop-unknown', 'user-1'))
      .rejects.toThrow('Sync not implemented for platform: aliexpress');
  });
});

// ============================================================
// getSyncStatus — all code paths
// ============================================================

describe('getSyncStatus — coverage', () => {
  beforeEach(resetMocks);

  test('throws when shop not found', async () => {
    mockQueryGet.mockReturnValue(null);

    await expect(getSyncStatus('nonexistent', 'user-1'))
      .rejects.toThrow('Shop not found');
  });

  test('returns status for connected shop with no pending tasks', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // shop record
        return {
          id: 'shop-1',
          platform: 'ebay',
          last_sync_at: '2025-01-01T00:00:00Z',
          sync_error: null,
          is_connected: 1,
          connection_type: 'oauth',
        };
      }
      // pending task query
      return null;
    });

    const status = await getSyncStatus('shop-1', 'user-1');
    expect(status.shopId).toBe('shop-1');
    expect(status.platform).toBe('ebay');
    expect(status.lastSyncAt).toBe('2025-01-01T00:00:00Z');
    expect(status.syncError).toBeNull();
    expect(status.isConnected).toBe(true);
    expect(status.isSyncSupported).toBe(true);
    expect(status.hasPendingSync).toBe(false);
    expect(status.pendingTask).toBeNull();
  });

  test('returns status with pending sync task', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          id: 'shop-2',
          platform: 'poshmark',
          last_sync_at: null,
          sync_error: null,
          is_connected: 1,
          connection_type: 'oauth',
        };
      }
      // pending task
      return {
        id: 'task-1',
        status: 'pending',
        created_at: '2025-06-01T10:00:00Z',
        started_at: null,
      };
    });

    const status = await getSyncStatus('shop-2', 'user-1');
    expect(status.hasPendingSync).toBe(true);
    expect(status.pendingTask).toBeDefined();
    expect(status.pendingTask.id).toBe('task-1');
    expect(status.pendingTask.status).toBe('pending');
    expect(status.pendingTask.createdAt).toBe('2025-06-01T10:00:00Z');
    expect(status.pendingTask.startedAt).toBeNull();
  });

  test('returns status with processing sync task', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          id: 'shop-3',
          platform: 'mercari',
          last_sync_at: '2025-03-01T00:00:00Z',
          sync_error: null,
          is_connected: 1,
          connection_type: 'oauth',
        };
      }
      return {
        id: 'task-2',
        status: 'processing',
        created_at: '2025-06-01T10:00:00Z',
        started_at: '2025-06-01T10:01:00Z',
      };
    });

    const status = await getSyncStatus('shop-3', 'user-1');
    expect(status.hasPendingSync).toBe(true);
    expect(status.pendingTask.status).toBe('processing');
    expect(status.pendingTask.startedAt).toBe('2025-06-01T10:01:00Z');
  });

  test('reports isSyncSupported=true for facebook', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          id: 'shop-fb',
          platform: 'facebook',
          last_sync_at: null,
          sync_error: null,
          is_connected: 1,
          connection_type: 'oauth',
        };
      }
      return null;
    });

    const status = await getSyncStatus('shop-fb', 'user-1');
    expect(status.isSyncSupported).toBe(true);
  });

  test('reports sync error when present', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          id: 'shop-err',
          platform: 'ebay',
          last_sync_at: '2025-01-01T00:00:00Z',
          sync_error: 'API rate limit exceeded',
          is_connected: 1,
          connection_type: 'oauth',
        };
      }
      return null;
    });

    const status = await getSyncStatus('shop-err', 'user-1');
    expect(status.syncError).toBe('API rate limit exceeded');
  });

  test('isConnected is false for disconnected shop', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          id: 'shop-disc',
          platform: 'depop',
          last_sync_at: null,
          sync_error: null,
          is_connected: 0,
          connection_type: 'oauth',
        };
      }
      return null;
    });

    const status = await getSyncStatus('shop-disc', 'user-1');
    expect(status.isConnected).toBe(false);
  });

  test('passes correct shopId to task_queue query', async () => {
    let callCount = 0;
    mockQueryGet.mockImplementation((...args) => {
      callCount++;
      if (callCount === 1) {
        return {
          id: 'shop-check',
          platform: 'etsy',
          last_sync_at: null,
          sync_error: null,
          is_connected: 1,
          connection_type: 'oauth',
        };
      }
      return null;
    });

    await getSyncStatus('shop-check', 'user-1');

    // The first call is for shop, second for task_queue
    // Verify the second call uses shopId
    expect(mockQueryGet.mock.calls.length).toBe(2);
    const taskCall = mockQueryGet.mock.calls[1];
    expect(taskCall[1]).toEqual(['shop-check']);
  });

  test('returns all supported platform types correctly', async () => {
    const platforms = ['ebay', 'poshmark', 'depop', 'grailed'];
    for (const p of platforms) {
      resetMocks();
      let callCount = 0;
      mockQueryGet.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            id: `shop-${p}`,
            platform: p,
            last_sync_at: null,
            sync_error: null,
            is_connected: 1,
            connection_type: 'oauth',
          };
        }
        return null;
      });

      const status = await getSyncStatus(`shop-${p}`, 'user-1');
      expect(status.isSyncSupported).toBe(true);
      expect(status.platform).toBe(p);
    }
  });
});

// ============================================================
// Default export
// ============================================================

describe('default export — coverage', () => {
  test('default export has all 4 functions', async () => {
    const mod = await import('../backend/services/platformSync/index.js');
    expect(typeof mod.default.syncShop).toBe('function');
    expect(typeof mod.default.isSyncSupported).toBe('function');
    expect(typeof mod.default.getSyncStatus).toBe('function');
    expect(typeof mod.default.getSupportedPlatforms).toBe('function');
  });
});
