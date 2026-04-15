import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock(() => []);
const mockQueryRun = mock();

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  default: {}
}));

// Do NOT mock encryption.js — contaminates other test files in full suite

const {
  getOAuthConfig,
  stopTokenRefreshScheduler,
  getRefreshSchedulerStatus,
  refreshExpiringTokens
} = await import('../backend/services/tokenRefreshScheduler.js');

afterAll(() => { stopTokenRefreshScheduler(); });

describe('tokenRefreshScheduler', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
  });

  describe('getOAuthConfig', () => {
    test('mock mode returns local URLs for ebay', () => {
      const config = getOAuthConfig('ebay', 'mock');
      expect(config.tokenUrl).toContain('mock-oauth/ebay/token');
      expect(config.authorizationUrl).toContain('mock-oauth/ebay/authorize');
      expect(config.userInfoUrl).toContain('mock-oauth/ebay/user');
      expect(config.revokeUrl).toContain('mock-oauth/ebay/revoke');
    });

    test('mock mode returns local URLs for poshmark', () => {
      expect(getOAuthConfig('poshmark', 'mock').tokenUrl).toContain('mock-oauth/poshmark/token');
    });

    test('mock mode includes clientId and scopes', () => {
      const config = getOAuthConfig('ebay', 'mock');
      expect(config.clientId).toBe('mock-ebay-client-id');
      expect(config.clientSecret).toBe('mock-ebay-client-secret');
      expect(config.scopes).toEqual(['read', 'write', 'listings']);
    });

    test('mock mode includes redirectUri', () => {
      expect(getOAuthConfig('ebay', 'mock').redirectUri).toBeTruthy();
    });

    test('real mode returns eBay production URLs by default', () => {
      const config = getOAuthConfig('ebay', 'real');
      expect(config.authorizationUrl).toContain('auth.ebay.com');
      expect(config.tokenUrl).toContain('api.ebay.com');
    });

    test('real mode returns eBay sandbox URLs when EBAY_ENVIRONMENT=sandbox', () => {
      const originalEnvironment = process.env.EBAY_ENVIRONMENT;
      process.env.EBAY_ENVIRONMENT = 'sandbox';
      const config = getOAuthConfig('ebay', 'real');
      expect(config.authorizationUrl).toContain('sandbox.ebay.com');
      expect(config.tokenUrl).toContain('sandbox.ebay.com');
      if (originalEnvironment === undefined) {
        delete process.env.EBAY_ENVIRONMENT;
      } else {
        process.env.EBAY_ENVIRONMENT = originalEnvironment;
      }
    });

    test('real mode returns platform-specific config for poshmark', () => {
      expect(getOAuthConfig('poshmark', 'real').tokenUrl).toContain('poshmark');
    });

    test('falls back to ebay for unknown platform', () => {
      expect(getOAuthConfig('unknown', 'real').tokenUrl).toContain('ebay');
    });

    // Facebook OAuth removed — uses Chrome extension, no token refresh needed
    test.skip('returns Facebook config with graph API URLs', () => {
      const config = getOAuthConfig('facebook', 'real');
      expect(config.authorizationUrl).toContain('facebook.com');
      expect(config.tokenUrl).toContain('graph.facebook.com');
    });
  });

  describe('scheduler lifecycle', () => {
    test('stopTokenRefreshScheduler is safe when not running', () => {
      stopTokenRefreshScheduler();
      expect(true).toBe(true);
    });

    test('refreshExpiringTokens handles no expiring tokens', async () => {
      mockQueryAll.mockReturnValue([]);
      await refreshExpiringTokens();
      // completes without error
    });
  });

  describe('getRefreshSchedulerStatus', () => {
    test('returns status with expected shape', async () => {
      stopTokenRefreshScheduler();
      mockQueryGet.mockReturnValue({
        total_oauth_shops: 2, connected_shops: 1,
        shops_with_errors: 0, expiring_soon: 0
      });
      const status = await getRefreshSchedulerStatus();
      expect(status.running).toBe(false);
      expect(status).toHaveProperty('intervalMs');
      expect(status).toHaveProperty('lastRun');
    });

    test('handles missing DB columns with fallback', async () => {
      stopTokenRefreshScheduler();
      mockQueryGet
        .mockImplementationOnce(() => { throw new Error('no such column: consecutive_refresh_failures'); })
        .mockReturnValueOnce({ total_oauth_shops: 2, connected_shops: 1, shops_with_errors: 0, expiring_soon: 0 });
      const status = await getRefreshSchedulerStatus();
      expect(status.running).toBe(false);
      expect(status.total_oauth_shops).toBe(2);
    });
  });
});
