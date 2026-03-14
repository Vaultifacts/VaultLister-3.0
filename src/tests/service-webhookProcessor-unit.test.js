import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';
import crypto from 'crypto';

// ===== Mocks (database.js, logger.js, AND notificationService.js) =====
// notificationService.js is mocked explicitly here to prevent contamination from
// arch-reliability-failure-modes.test.js and arch-async-task-worker.test.js, which
// both mock notificationService with a no-op stub. On Linux Bun 1.3.9, mock.module
// is global — if their stub wins the race, createNotification never calls query.run,
// breaking the tests that verify INSERT INTO notifications was called.
// By re-declaring the mock here, this file owns the notificationService behavior.

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

// notificationService stub — createNotification must call mockQueryRun with
// INSERT INTO notifications so the test assertions (which check mockQueryRun.mock.calls)
// remain valid even when this file runs alongside files that mock notificationService
// with a different (no-op) stub.
const { v4: _uuidv4Notif } = await import('uuid');
mock.module('../backend/services/notificationService.js', () => ({
  createNotification: (userId, { type, title, message, data = null }) => {
    const id = _uuidv4Notif();
    mockQueryRun(
      'INSERT INTO notifications (id, user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, type, title, message, data ? JSON.stringify(data) : null]
    );
    return { id, user_id: userId, type, title, message, data, is_read: false, created_at: new Date().toISOString() };
  },
  createOAuthNotification: mock(() => undefined),
  NotificationTypes: {
    TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
    OAUTH_DISCONNECTED: 'OAUTH_DISCONNECTED',
    SYNC_COMPLETED: 'SYNC_COMPLETED',
  },
  default: {}
}));

// ===== Import module under test =====

const { processWebhookEvent, dispatchToUserEndpoints, verifySignature } = await import('../backend/services/webhookProcessor.js');

// ===== Fetch mock =====

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockQueryGet.mockReset();
  mockQueryAll.mockReset();
  mockQueryAll.mockImplementation(() => []);
  mockQueryRun.mockReset();
  mockQueryRun.mockImplementation(() => ({ changes: 1 }));
  globalThis.fetch = mock(() => Promise.resolve({ ok: true, status: 200 }));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

// ===== Helper: build a valid HMAC signature =====

function buildSignature(payload, secret) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadStr);
  return `sha256=${hmac.digest('hex')}`;
}

// =============================================================================
// 1. processWebhookEvent — various event types
// =============================================================================

describe('processWebhookEvent', () => {
  test('listing.created sends notification and returns success', async () => {
    const event = { id: 'evt-1', event_type: 'listing.created', user_id: 'user-1', payload: { title: 'Vintage Lamp', platform: 'eBay' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
    // createNotification calls query.run internally to INSERT into notifications
    // We verify it was called (the real createNotification uses the mocked query.run)
    const insertCall = mockQueryRun.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeTruthy();
  });

  test('listing.updated syncs local listing data', async () => {
    const event = { id: 'evt-2', event_type: 'listing.updated', user_id: 'user-2', payload: { listingId: 'ext-1', price: 29.99, title: 'Updated Lamp' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'listing_updated' });
    // Should call query.run to UPDATE listings
    expect(mockQueryRun).toHaveBeenCalled();
  });

  test('listing.sold sends important notification and dispatches to user endpoints', async () => {
    const event = { id: 'evt-3', event_type: 'listing.sold', user_id: 'user-3', payload: { title: 'Rare Book', price: 50, platform: 'Mercari' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'sale_notification_sent' });
    // createNotification inserts into notifications table
    const insertCall = mockQueryRun.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeTruthy();
  });

  test('listing.ended sends notification', async () => {
    const event = { id: 'evt-4', event_type: 'listing.ended', user_id: 'user-4', payload: { title: 'Old Shirt', platform: 'Poshmark' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  test('listing.views tracks engagement', async () => {
    const event = { id: 'evt-5', event_type: 'listing.views', user_id: 'user-5', payload: { listingId: 'l-100', platform: 'eBay' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'engagement_tracked' });
  });

  test('order.created sends important notification', async () => {
    const event = { id: 'evt-6', event_type: 'order.created', user_id: 'user-6', payload: { itemTitle: 'Widget', buyerUsername: 'buyer1' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'order_notification_sent' });
    const insertCall = mockQueryRun.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeTruthy();
  });

  test('order.shipped sends notification', async () => {
    const event = { id: 'evt-7', event_type: 'order.shipped', user_id: 'user-7', payload: { itemTitle: 'Widget' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  test('order.delivered sends notification', async () => {
    const event = { id: 'evt-8', event_type: 'order.delivered', user_id: 'user-8', payload: { itemTitle: 'Widget' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  test('order.cancelled sends important notification', async () => {
    const event = { id: 'evt-9', event_type: 'order.cancelled', user_id: 'user-9', payload: { itemTitle: 'Widget' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
    const insertCall = mockQueryRun.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeTruthy();
  });

  test('offer.received sends important notification and dispatches', async () => {
    const event = { id: 'evt-10', event_type: 'offer.received', user_id: 'user-10', payload: { amount: 25, itemTitle: 'Jacket', buyerUsername: 'buyer2' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'offer_notification_sent' });
    const insertCall = mockQueryRun.mock.calls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeTruthy();
  });

  test('offer.accepted returns logged action', async () => {
    const event = { id: 'evt-11', event_type: 'offer.accepted', user_id: 'user-11', payload: {} };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'logged' });
  });

  test('offer.declined returns logged action', async () => {
    const event = { id: 'evt-12', event_type: 'offer.declined', user_id: 'user-12', payload: {} };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'logged' });
  });

  test('offer.expired sends notification', async () => {
    const event = { id: 'evt-13', event_type: 'offer.expired', user_id: 'user-13', payload: { itemTitle: 'Boots' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  test('account.synced sends sync complete notification', async () => {
    const event = { id: 'evt-14', event_type: 'account.synced', user_id: 'user-14', payload: { platform: 'eBay', itemsSynced: 42 } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  test('account.error sends important error notification', async () => {
    const event = { id: 'evt-15', event_type: 'account.error', user_id: 'user-15', payload: { platform: 'Poshmark', error: 'Auth expired' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'error_notification_sent' });
  });

  test('inventory.low_stock sends low stock notification', async () => {
    const event = { id: 'evt-16', event_type: 'inventory.low_stock', user_id: 'user-16', payload: { itemTitle: 'T-Shirt', quantity: 2 } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  test('inventory.out_of_stock sends important out of stock notification', async () => {
    const event = { id: 'evt-17', event_type: 'inventory.out_of_stock', user_id: 'user-17', payload: { itemTitle: 'Mug' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  // --- unknown event type ---
  test('returns error for unknown event type', async () => {
    const event = { id: 'evt-unk', event_type: 'nonexistent.event', payload: {} };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown event type');
  });

  // --- string payload ---
  test('parses string payload as JSON', async () => {
    const payload = { title: 'Parsed Lamp', platform: 'eBay' };
    const event = { id: 'evt-str', event_type: 'listing.created', user_id: 'user-str', payload: JSON.stringify(payload) };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
  });

  // --- object payload (no parsing needed) ---
  test('accepts object payload directly', async () => {
    const event = { id: 'evt-obj', event_type: 'listing.created', user_id: 'user-obj', payload: { title: 'Direct Object', platform: 'Mercari' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'notification_sent' });
  });

  // --- error handling: handler throws ---
  test('returns error when handler throws', async () => {
    // listing.sold awaits dispatchToUserEndpoints which calls query.all
    // Make query.all throw to propagate error up through the handler
    const errorMsg = 'DB query failed';
    mockQueryAll.mockImplementation(() => { throw new Error(errorMsg); });

    const event = { id: 'evt-err', event_type: 'listing.sold', user_id: 'user-err', payload: { title: 'Broken', price: 10, platform: 'eBay' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(false);
    expect(result.error).toBe(errorMsg);
  });

  // --- DB status updates ---
  test('updates event status to processed on success', async () => {
    const calls = [];
    mockQueryRun.mockImplementation((...args) => { calls.push(args); return { changes: 1 }; });

    const event = { id: 'evt-status', event_type: 'offer.accepted', user_id: 'user-s', payload: {} };
    await processWebhookEvent(event);

    // The last query.run call should be the status update to 'processed'
    const statusCall = calls.find(c => typeof c[0] === 'string' && c[0].includes("status = 'processed'"));
    expect(statusCall).toBeTruthy();
    expect(statusCall[1]).toEqual(['evt-status']);
  });

  test('updates event status to failed on error', async () => {
    // Make query.all throw so listing.sold's dispatchToUserEndpoints fails
    // query.run should still work to record the failure status
    mockQueryAll.mockImplementation(() => { throw new Error('Deliberate fail'); });

    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    const event = { id: 'evt-fail', event_type: 'listing.sold', user_id: 'user-f', payload: { title: 'Oops', price: 5, platform: 'eBay' } };
    await processWebhookEvent(event);

    const failCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes("status = 'failed'"));
    expect(failCall).toBeTruthy();
    expect(failCall[1]).toEqual(['Deliberate fail', 'evt-fail']);
  });

  test('event without user_id skips notification for listing.created', async () => {
    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    const event = { id: 'evt-nouser', event_type: 'listing.created', payload: { title: 'No User', platform: 'eBay' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    // No INSERT INTO notifications should have been called
    const insertCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications'));
    expect(insertCall).toBeUndefined();
  });

  test('account.synced with missing itemsSynced defaults to 0 in message', async () => {
    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    const event = { id: 'evt-sync-noi', event_type: 'account.synced', user_id: 'user-sn', payload: { platform: 'eBay' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    // Check that the notification message contains "0 items synced"
    const insertCall = runCalls.find(c =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeTruthy();
    // The message param in the insert call should contain '0 items synced'
    const message = insertCall[1][4]; // 5th param is message
    expect(message).toContain('0 items synced');
  });

  test('processWebhookEvent with invalid JSON string payload returns error', async () => {
    const event = { id: 'evt-bad-json', event_type: 'listing.created', user_id: 'user-bj', payload: '{not valid json' };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// =============================================================================
// 2. verifySignature
// =============================================================================

describe('verifySignature', () => {
  const secret = 'webhook-secret-key-1234';

  test('returns true for valid signature', () => {
    const payload = { event: 'test', data: 'hello' };
    const sig = buildSignature(payload, secret);
    expect(verifySignature(payload, sig, secret)).toBe(true);
  });

  test('returns true for valid string payload signature', () => {
    const payload = '{"event":"test"}';
    const sig = buildSignature(payload, secret);
    expect(verifySignature(payload, sig, secret)).toBe(true);
  });

  test('returns false for invalid signature', () => {
    const payload = { event: 'test' };
    const wrongSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    expect(verifySignature(payload, wrongSig, secret)).toBe(false);
  });

  test('returns false for tampered payload', () => {
    const original = { event: 'test', amount: 100 };
    const sig = buildSignature(original, secret);
    const tampered = { event: 'test', amount: 999 };
    expect(verifySignature(tampered, sig, secret)).toBe(false);
  });

  test('returns false for missing signature (null)', () => {
    expect(verifySignature({ data: 1 }, null, secret)).toBe(false);
  });

  test('returns false for missing signature (undefined)', () => {
    expect(verifySignature({ data: 1 }, undefined, secret)).toBe(false);
  });

  test('returns false for empty string signature', () => {
    expect(verifySignature({ data: 1 }, '', secret)).toBe(false);
  });

  test('returns false for missing secret', () => {
    const payload = { data: 1 };
    const sig = buildSignature(payload, secret);
    expect(verifySignature(payload, sig, null)).toBe(false);
  });

  test('returns false for mismatched length signatures', () => {
    const payload = { event: 'test' };
    // Signature that is shorter than expected
    const shortSig = 'sha256=abcd';
    expect(verifySignature(payload, shortSig, secret)).toBe(false);
  });
});

// =============================================================================
// 3. dispatchToUserEndpoints
// =============================================================================

describe('dispatchToUserEndpoints', () => {
  test('does nothing when no endpoints are registered', async () => {
    mockQueryAll.mockReturnValue([]);
    await dispatchToUserEndpoints('user-1', 'listing.sold', { title: 'Widget' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('dispatches to enabled endpoints with correct headers', async () => {
    const endpoint = { id: 'ep-1', url: 'https://example.com/hook', secret: 'ep-secret', name: 'Test Hook' };
    mockQueryAll.mockReturnValue([endpoint]);

    await dispatchToUserEndpoints('user-d', 'listing.sold', { title: 'Lamp' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['X-VaultLister-Event']).toBe('listing.sold');
    expect(opts.headers['X-VaultLister-Signature']).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  test('dispatches to multiple endpoints', async () => {
    const endpoints = [
      { id: 'ep-1', url: 'https://a.com/hook', secret: 's1', name: 'Hook A' },
      { id: 'ep-2', url: 'https://b.com/hook', secret: 's2', name: 'Hook B' },
      { id: 'ep-3', url: 'https://c.com/hook', secret: 's3', name: 'Hook C' }
    ];
    mockQueryAll.mockReturnValue(endpoints);

    await dispatchToUserEndpoints('user-m', 'order.created', { itemTitle: 'Shoes' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  test('updates endpoint success state on successful dispatch', async () => {
    const endpoint = { id: 'ep-ok', url: 'https://ok.com/hook', secret: 'ok-secret', name: 'OK Hook' };
    mockQueryAll.mockReturnValue([endpoint]);

    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    await dispatchToUserEndpoints('user-ok', 'listing.sold', { title: 'Item' });

    const successCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('failure_count = 0'));
    expect(successCall).toBeTruthy();
    expect(successCall[1]).toEqual(['ep-ok']);
  });

  test('increments failure count when dispatch fails with non-ok response', async () => {
    globalThis.fetch = mock(() => Promise.resolve({ ok: false, status: 500 }));
    const endpoint = { id: 'ep-fail', url: 'https://fail.com/hook', secret: 'fail-secret', name: 'Fail Hook' };
    mockQueryAll.mockReturnValue([endpoint]);
    mockQueryGet.mockReturnValue({ failure_count: 3 });

    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    await dispatchToUserEndpoints('user-fail', 'listing.sold', { title: 'Broken' });

    const failCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('failure_count = failure_count + 1'));
    expect(failCall).toBeTruthy();
  });

  test('increments failure count when fetch throws network error', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('Network error')));
    const endpoint = { id: 'ep-net', url: 'https://down.com/hook', secret: 'net-secret', name: 'Net Hook' };
    mockQueryAll.mockReturnValue([endpoint]);
    mockQueryGet.mockReturnValue({ failure_count: 1 });

    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    await dispatchToUserEndpoints('user-net', 'listing.sold', { title: 'Down' });

    const failCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('failure_count = failure_count + 1'));
    expect(failCall).toBeTruthy();
  });

  test('disables endpoint and sends notification after 10+ failures', async () => {
    globalThis.fetch = mock(() => Promise.resolve({ ok: false, status: 503 }));
    const endpoint = { id: 'ep-dis', url: 'https://flaky.com/hook', secret: 'dis-secret', name: 'Flaky Hook' };
    mockQueryAll.mockReturnValue([endpoint]);
    mockQueryGet.mockReturnValue({ failure_count: 10 });

    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    await dispatchToUserEndpoints('user-dis', 'listing.sold', { title: 'Flaky' });

    const disableCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('is_enabled = 0'));
    expect(disableCall).toBeTruthy();
    // createNotification for webhook_disabled should produce an INSERT INTO notifications
    const notifCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications'));
    expect(notifCall).toBeTruthy();
  });

  test('does not disable endpoint when failure count is below threshold', async () => {
    globalThis.fetch = mock(() => Promise.resolve({ ok: false, status: 500 }));
    const endpoint = { id: 'ep-low', url: 'https://flaky.com/hook', secret: 'low-secret', name: 'Low Fail Hook' };
    mockQueryAll.mockReturnValue([endpoint]);
    mockQueryGet.mockReturnValue({ failure_count: 5 });

    const runCalls = [];
    mockQueryRun.mockImplementation((...args) => { runCalls.push(args); return { changes: 1 }; });

    await dispatchToUserEndpoints('user-low', 'listing.sold', { title: 'Item' });

    const disableCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('is_enabled = 0'));
    expect(disableCall).toBeUndefined();
    // No notification should have been created for webhook_disabled
    const notifCall = runCalls.find(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO notifications'));
    expect(notifCall).toBeUndefined();
  });

  test('sends correct body payload with event type and timestamp', async () => {
    const endpoint = { id: 'ep-body', url: 'https://body.com/hook', secret: 'body-secret', name: 'Body Hook' };
    mockQueryAll.mockReturnValue([endpoint]);

    const payload = { title: 'Gadget', price: 99 };
    await dispatchToUserEndpoints('user-body', 'order.created', payload);

    const [, opts] = globalThis.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.event).toBe('order.created');
    expect(body.payload).toEqual(payload);
    expect(body.timestamp).toBeDefined();
    // Timestamp should be a valid ISO string
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  test('generates correct HMAC signature for dispatch', async () => {
    const secret = 'verify-this-secret';
    const endpoint = { id: 'ep-sig', url: 'https://sig.com/hook', secret, name: 'Sig Hook' };
    mockQueryAll.mockReturnValue([endpoint]);

    const payload = { item: 'Test' };
    await dispatchToUserEndpoints('user-sig', 'listing.sold', payload);

    const [, opts] = globalThis.fetch.mock.calls[0];
    const sig = opts.headers['X-VaultLister-Signature'];

    // Verify the signature matches what we'd compute ourselves
    // The service signs the payload object, not the full body
    const expectedSig = buildSignature(payload, secret);
    expect(sig).toBe(expectedSig);
  });
});

// =============================================================================
// 4. Edge cases and integration-like scenarios
// =============================================================================

describe('edge cases', () => {
  test('listing.views with missing platform defaults gracefully', async () => {
    const event = { id: 'evt-view-np', event_type: 'listing.views', user_id: 'user-v', payload: { listingId: 'l-200' } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'engagement_tracked' });
  });

  test('listing.views without listingId still succeeds', async () => {
    const event = { id: 'evt-view-nl', event_type: 'listing.views', user_id: 'user-v2', payload: {} };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'engagement_tracked' });
  });

  test('listing.updated without listingId still succeeds', async () => {
    const event = { id: 'evt-upd-nl', event_type: 'listing.updated', user_id: 'user-u2', payload: { price: 15 } };
    const result = await processWebhookEvent(event);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ action: 'listing_updated' });
  });
});
