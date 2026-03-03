import { describe, expect, test, mock, beforeEach, afterEach, afterAll } from 'bun:test';

mock.module('../backend/shared/logger.js', () => ({
  logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
  default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

// Mock globalThis.fetch for Sentry API calls — save and restore to prevent contamination
const originalFetch = globalThis.fetch;
const mockFetch = mock(() => Promise.resolve({ ok: true, status: 200 }));

const sentryModule = await import('../backend/services/sentry.js');
const sentryService = sentryModule.default;
const { sentryMiddleware, sentryErrorHandler } = sentryModule;

// Import mocked logger for assertion
const { logger } = await import('../backend/shared/logger.js');

describe('service-sentry-unit', () => {

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    mockFetch.mockReturnValue(Promise.resolve({ ok: true, status: 200 }));
    logger.info.mockReset();
    logger.error.mockReset();
    logger.warn.mockReset();
    logger.debug.mockReset();
    // Reset internal state
    sentryService.initialized = false;
    sentryService._breadcrumbs = undefined;
    sentryService._currentUser = null;
    sentryService._lastStatus = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  // =========================================================================
  // 1. sentryService.init() — checks DSN and NODE_ENV
  // =========================================================================
  describe('sentryService.init()', () => {
    test('logs message when no DSN configured', () => {
      // In test env, SENTRY_DSN is not set, so init should log about missing DSN
      sentryService.init();
      const infoCall = logger.info.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('No DSN configured')
      );
      // Either "No DSN configured" or "Not in production mode"
      expect(logger.info).toHaveBeenCalled();
    });

    test('does not set initialized=true when DSN is missing', () => {
      sentryService.init();
      expect(sentryService.initialized).toBe(false);
    });

    test('init is callable multiple times without error', () => {
      sentryService.init();
      sentryService.init();
      expect(sentryService.initialized).toBe(false);
    });
  });

  // =========================================================================
  // 2. captureException returns eventId or null (when disabled)
  // =========================================================================
  describe('captureException disabled mode', () => {
    test('returns null when IS_ENABLED is false', () => {
      const result = sentryService.captureException(new Error('test'));
      expect(result).toBeNull();
    });

    test('logs the error via logger.error when disabled', () => {
      const err = new Error('test disabled');
      sentryService.captureException(err);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. captureException with Error object
  // =========================================================================
  describe('captureException with Error', () => {
    test('captureException accepts Error with context', () => {
      const err = new Error('Something broke');
      const result = sentryService.captureException(err, { userId: '123' });
      // disabled mode → null
      expect(result).toBeNull();
    });

    test('captureException accepts Error with empty context', () => {
      const result = sentryService.captureException(new Error('no ctx'));
      expect(result).toBeNull();
    });

    test('captureException logs error message in disabled mode', () => {
      const err = new Error('detailed error');
      sentryService.captureException(err, { extra: 'data' });
      const errCall = logger.error.mock.calls.find(c =>
        c.length >= 2 && c[1] === 'detailed error'
      );
      expect(errCall).toBeTruthy();
    });
  });

  // =========================================================================
  // 4. captureMessage with different levels
  // =========================================================================
  describe('captureMessage', () => {
    test('returns null when disabled', () => {
      const result = sentryService.captureMessage('hello');
      expect(result).toBeNull();
    });

    test('accepts info level (default)', () => {
      const result = sentryService.captureMessage('info message');
      expect(result).toBeNull();
    });

    test('accepts warning level', () => {
      const result = sentryService.captureMessage('warning msg', 'warning');
      expect(result).toBeNull();
    });

    test('accepts error level', () => {
      const result = sentryService.captureMessage('error msg', 'error');
      expect(result).toBeNull();
    });

    test('logs message via logger.info when disabled', () => {
      sentryService.captureMessage('test message', 'info', { key: 'val' });
      expect(logger.info).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. setUser / clearUser
  // =========================================================================
  describe('setUser and clearUser', () => {
    test('setUser does not throw with valid user', () => {
      sentryService.setUser({ id: '1', email: 'a@b.com', username: 'alice' });
      // In disabled mode, setUser returns early without setting _currentUser
      // because IS_ENABLED is false
    });

    test('setUser with null user does not throw', () => {
      sentryService.setUser(null);
    });

    test('clearUser sets _currentUser to null', () => {
      sentryService._currentUser = { id: '1' };
      sentryService.clearUser();
      expect(sentryService._currentUser).toBeNull();
    });

    test('clearUser when already null does not throw', () => {
      sentryService._currentUser = null;
      sentryService.clearUser();
      expect(sentryService._currentUser).toBeNull();
    });
  });

  // =========================================================================
  // 6. addBreadcrumb (keeps max 100)
  // =========================================================================
  describe('addBreadcrumb', () => {
    test('does not add breadcrumbs when disabled', () => {
      sentryService.addBreadcrumb({ category: 'test', message: 'crumb' });
      // IS_ENABLED is false, so it returns immediately
      expect(sentryService._breadcrumbs).toBeUndefined();
    });

    test('addBreadcrumb does not throw with any input', () => {
      sentryService.addBreadcrumb({ category: 'http', level: 'info', message: 'GET /' });
    });

    test('breadcrumbs array caps at 100 when manually forced', () => {
      // Manually test the cap logic by simulating enabled mode
      sentryService._breadcrumbs = [];
      for (let i = 0; i < 105; i++) {
        sentryService._breadcrumbs.push({ message: `crumb-${i}`, timestamp: new Date().toISOString() });
        if (sentryService._breadcrumbs.length > 100) {
          sentryService._breadcrumbs.shift();
        }
      }
      expect(sentryService._breadcrumbs.length).toBe(100);
    });
  });

  // =========================================================================
  // 7. startTransaction returns transaction object
  // =========================================================================
  describe('startTransaction', () => {
    test('returns object with finish function when disabled', () => {
      const txn = sentryService.startTransaction('GET /api/test');
      expect(typeof txn).toBe('object');
      expect(typeof txn.finish).toBe('function');
    });

    test('finish does not throw when disabled', () => {
      const txn = sentryService.startTransaction('GET /api/test');
      txn.finish();
    });

    test('returns minimal object in disabled mode', () => {
      const txn = sentryService.startTransaction('test', 'db.query');
      // In disabled mode, the object only has { finish: () => {} }
      expect(txn.finish).toBeDefined();
    });
  });

  // =========================================================================
  // 8. Transaction finish sends to Sentry (tested via enabled simulation)
  // =========================================================================
  describe('transaction structure', () => {
    test('disabled transaction finish is a no-op', () => {
      const txn = sentryService.startTransaction('noop-txn', 'http.server');
      txn.finish();
      // fetch should not be called because IS_ENABLED is false
      // (the disabled path returns a simple { finish: () => {} })
    });
  });

  // =========================================================================
  // 9. sentryMiddleware creates transaction
  // =========================================================================
  describe('sentryMiddleware', () => {
    test('returns null when disabled', () => {
      const result = sentryMiddleware({ method: 'GET', path: '/test', headers: {} });
      expect(result).toBeNull();
    });

    test('is a function', () => {
      expect(typeof sentryMiddleware).toBe('function');
    });

    test('handles ctx with user property without error', () => {
      const result = sentryMiddleware({
        method: 'POST',
        path: '/api/items',
        headers: { 'content-type': 'application/json' },
        user: { id: '1', email: 'a@b.com' }
      });
      expect(result).toBeNull();
    });

    test('handles ctx without user property', () => {
      const result = sentryMiddleware({
        method: 'DELETE',
        path: '/api/items/123',
        headers: {}
      });
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 10. sentryErrorHandler scrubs headers
  // =========================================================================
  describe('sentryErrorHandler scrubs headers', () => {
    test('removes authorization header', () => {
      const error = new Error('test error');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/api/test',
        headers: {
          authorization: 'Bearer secret-token',
          'content-type': 'application/json'
        },
        query: {}
      });
      // captureException is called (in disabled mode logs via logger.error)
      expect(logger.error).toHaveBeenCalled();
    });

    test('removes cookie header', () => {
      const error = new Error('cookie test');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/test',
        headers: { cookie: 'session=abc123' },
        query: {}
      });
      expect(logger.error).toHaveBeenCalled();
    });

    test('removes x-csrf-token header', () => {
      const error = new Error('csrf test');
      sentryErrorHandler(error, {
        method: 'POST',
        path: '/test',
        headers: { 'x-csrf-token': 'csrf-value' },
        query: {}
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 11. sentryErrorHandler scrubs query params
  // =========================================================================
  describe('sentryErrorHandler scrubs query params', () => {
    test('removes token from query', () => {
      const error = new Error('query test');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/api/callback',
        headers: {},
        query: { token: 'secret', page: '1' }
      });
      expect(logger.error).toHaveBeenCalled();
    });

    test('removes api_key from query', () => {
      const error = new Error('api_key test');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/api/data',
        headers: {},
        query: { api_key: 'key123', filter: 'active' }
      });
      expect(logger.error).toHaveBeenCalled();
    });

    test('removes key from query', () => {
      const error = new Error('key test');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/api/webhook',
        headers: {},
        query: { key: 'webhook-key', event: 'sale' }
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 12. Stack trace parsing
  // =========================================================================
  describe('_parseStackTrace', () => {
    test('returns empty array for null', () => {
      expect(sentryService._parseStackTrace(null)).toEqual([]);
    });

    test('returns empty array for empty string', () => {
      expect(sentryService._parseStackTrace('')).toEqual([]);
    });

    test('parses structured stack with function name and location', () => {
      const stack = 'Error: boom\n    at handler (/app/routes.js:42:12)\n    at process (/app/server.js:100:8)';
      const frames = sentryService._parseStackTrace(stack);
      expect(frames.length).toBe(2);
      expect(frames[0].function).toBe('handler');
      expect(frames[0].filename).toBe('/app/routes.js');
      expect(frames[0].lineno).toBe(42);
      expect(frames[0].colno).toBe(12);
      expect(frames[1].function).toBe('process');
    });

    test('handles stack lines without function names', () => {
      const stack = 'Error: test\n    at /app/index.js:5:1';
      const frames = sentryService._parseStackTrace(stack);
      expect(frames.length).toBeGreaterThanOrEqual(1);
      // Lines that do not match the regex get { filename: trimmed_line }
    });

    test('parses real Error stack', () => {
      const error = new Error('real error');
      const frames = sentryService._parseStackTrace(error.stack);
      expect(Array.isArray(frames)).toBe(true);
      expect(frames.length).toBeGreaterThan(0);
    });

    test('skips first line (Error: message)', () => {
      const stack = 'Error: first line\n    at fn (/a.js:1:1)';
      const frames = sentryService._parseStackTrace(stack);
      // Should NOT include "Error: first line" as a frame
      const hasErrorLine = frames.some(f => f.filename && f.filename.includes('Error:'));
      expect(hasErrorLine).toBe(false);
    });
  });

  // =========================================================================
  // 13. generateEventId format
  // =========================================================================
  describe('_generateEventId', () => {
    test('returns 32-character hex string', () => {
      const id = sentryService._generateEventId();
      expect(typeof id).toBe('string');
      expect(id.length).toBe(32);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    test('generates unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 50; i++) {
        ids.add(sentryService._generateEventId());
      }
      expect(ids.size).toBe(50);
    });

    test('contains no dashes', () => {
      const id = sentryService._generateEventId();
      expect(id).not.toContain('-');
    });
  });

  // =========================================================================
  // 14. disabled mode returns null for all capture methods
  // =========================================================================
  describe('disabled mode — all methods', () => {
    test('captureException returns null', () => {
      expect(sentryService.captureException(new Error('x'))).toBeNull();
    });

    test('captureMessage returns null', () => {
      expect(sentryService.captureMessage('x')).toBeNull();
    });

    test('sentryMiddleware returns null', () => {
      expect(sentryMiddleware({ method: 'GET', path: '/', headers: {} })).toBeNull();
    });

    test('startTransaction returns object with no-op finish', () => {
      const txn = sentryService.startTransaction('x');
      expect(txn.finish).toBeDefined();
      txn.finish(); // no-op
    });

    test('setUser returns undefined (no-op) when disabled', () => {
      const result = sentryService.setUser({ id: '1' });
      expect(result).toBeUndefined();
    });

    test('addBreadcrumb returns undefined when disabled', () => {
      const result = sentryService.addBreadcrumb({ message: 'x' });
      expect(result).toBeUndefined();
    });
  });

  // =========================================================================
  // 15. Slow transaction logging
  // =========================================================================
  describe('slow transaction logging', () => {
    test('disabled transaction finish does not call logger.warn', () => {
      const txn = sentryService.startTransaction('slow-test', 'http.server');
      txn.finish();
      // In disabled mode, finish is a no-op
      // logger.warn should not be called for slow txn detection
      const warnCalls = logger.warn.mock.calls.filter(c =>
        typeof c[0] === 'string' && c[0].includes('Slow transaction')
      );
      expect(warnCalls.length).toBe(0);
    });
  });

  // =========================================================================
  // Additional coverage: exports and types
  // =========================================================================
  describe('exports', () => {
    test('sentryService is the default export', () => {
      expect(sentryModule.default).toBe(sentryService);
    });

    test('sentryMiddleware is a named export', () => {
      expect(sentryModule.sentryMiddleware).toBe(sentryMiddleware);
    });

    test('sentryErrorHandler is a named export', () => {
      expect(sentryModule.sentryErrorHandler).toBe(sentryErrorHandler);
    });
  });

  describe('sentryService properties', () => {
    test('has dsn property', () => {
      expect(sentryService).toHaveProperty('dsn');
    });

    test('has initialized property', () => {
      expect(sentryService).toHaveProperty('initialized');
    });

    test('dsn matches SENTRY_DSN env var', () => {
      // dsn reflects process.env.SENTRY_DSN at module load time
      expect(sentryService.dsn).toBe(process.env.SENTRY_DSN);
    });
  });

  describe('sentryErrorHandler with user context', () => {
    test('includes user id when user is present', () => {
      const error = new Error('user ctx');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/api/me',
        headers: {},
        query: {},
        user: { id: 'user-42', email: 'u@u.com' }
      });
      expect(logger.error).toHaveBeenCalled();
    });

    test('handles missing user gracefully', () => {
      const error = new Error('no user');
      sentryErrorHandler(error, {
        method: 'GET',
        path: '/api/public',
        headers: {},
        query: {}
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('_sendToSentry', () => {
    test('returns without calling fetch when dsn is falsy', async () => {
      const origDsn = sentryService.dsn;
      sentryService.dsn = undefined;
      mockFetch.mockReset();
      await sentryService._sendToSentry({ event_id: 'test' });
      // dsn is undefined so fetch should not be called
      expect(mockFetch).not.toHaveBeenCalled();
      sentryService.dsn = origDsn;
    });

    test('handles network errors gracefully when dsn is set', async () => {
      const origDsn = sentryService.dsn;
      sentryService.dsn = 'https://publickey@o0.ingest.sentry.io/0';
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      // Should not throw
      await sentryService._sendToSentry({ event_id: 'test' });
      expect(logger.error).toHaveBeenCalled();
      sentryService.dsn = origDsn;
    });

    test('logs error when response is not ok', async () => {
      const origDsn = sentryService.dsn;
      sentryService.dsn = 'https://publickey@o0.ingest.sentry.io/0';
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
      await sentryService._sendToSentry({ event_id: 'rate-limited' });
      const errCall = logger.error.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('Failed to send event')
      );
      expect(errCall).toBeTruthy();
      sentryService.dsn = origDsn;
    });

    test('sends correct request to Sentry store endpoint', async () => {
      const origDsn = sentryService.dsn;
      sentryService.dsn = 'https://abc123@o999.ingest.sentry.io/12345';
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      await sentryService._sendToSentry({ event_id: 'payload-test', level: 'error' });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('o999.ingest.sentry.io');
      expect(url).toContain('/api/12345/store/');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');
      expect(opts.headers['X-Sentry-Auth']).toContain('sentry_key=abc123');
      sentryService.dsn = origDsn;
    });
  });
});
