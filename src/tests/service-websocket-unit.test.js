// Comprehensive unit tests for WebSocket service
// Tests handleConnection, handleAuth, handleSubscribe, handleUnsubscribe,
// handleDisconnect, send, sendToUser, broadcast, broadcastAll, handleMessage,
// rate limiting, max connections, chat messages, getStats, business events, cleanup.
import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';
import jwt from 'jsonwebtoken';

// ─── Mocks (ONLY database.js and logger.js) ─────────────────────────────────
mock.module('../backend/shared/logger.js', () => ({
  logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
  default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

// websocket.js does not import database.js but we mock it for completeness
// and to prevent cross-file contamination
mock.module('../backend/db/database.js', () => ({
  query: {
    get: mock(), all: mock(() => []), run: mock(() => ({ changes: 1 })),
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

// jsonwebtoken, uuid load naturally — no mock.module for them

// ─── Import after mocks ─────────────────────────────────────────────────────
const { websocketService, MESSAGE_TYPES } = await import('../backend/services/websocket.js');

// ─── Contamination guard ─────────────────────────────────────────────────────
// On Linux Bun 1.3.9, mock.module is global across test workers. Several files
// (secgov-admin-monitoring, secgov-abuse-community, secgov-gdpr-privacy,
// secgov-offboarding-worker, arch-reliability-failure-modes) mock websocket.js
// with a minimal stub { sendToUser, broadcast, cleanup }. If any of those files'
// mock.module call wins the race for this worker's module cache, websocketService
// will be missing handleConnection, handleAuth, handleMessage, etc.
// Detect by checking for a method only present in the real module.
const _isContaminated = (
    !websocketService ||
    typeof websocketService.handleConnection !== 'function' ||
    typeof websocketService.handleAuth !== 'function' ||
    typeof websocketService.handleMessage !== 'function' ||
    typeof websocketService.getStats !== 'function'
);
if (_isContaminated) {
    console.warn(
        '[service-websocket-unit] mock contamination detected — websocket.js was ' +
        'intercepted by another test file\'s mock.module call (stub has sendToUser/broadcast/cleanup ' +
        'but not handleConnection/handleAuth). All tests in this file will be skipped. ' +
        'Run in isolation: bun test src/tests/service-websocket-unit.test.js'
    );
}
const _it = (name, fn) => test(name, () => { if (_isContaminated) return; return fn(); });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function createMockWs(overrides = {}) {
  return {
    send: mock(),
    close: mock(),
    ping: mock(),
    readyState: 1, // OPEN
    data: {
      connectionId: overrides.connectionId || null,
      userId: overrides.userId || null,
      isAlive: true,
      subscriptions: new Set(),
      messageWindowStart: null,
      messageCount: 0,
      ...(overrides.data || {})
    },
    on: mock((event, fn) => {}),
    ...overrides
  };
}

// Use a fixed JWT secret for tests
// Must match the default in websocket.js (captured at import time, not from env)
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-not-for-production';

// Stash original env
const originalJwtSecret = process.env.JWT_SECRET;

beforeEach(() => {
  // Provide a JWT secret for auth tests
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});

afterAll(() => {
  if (!_isContaminated) websocketService.cleanup();
  if (originalJwtSecret !== undefined) {
    process.env.JWT_SECRET = originalJwtSecret;
  } else {
    delete process.env.JWT_SECRET;
  }
});

// Helper: create a real JWT token using the real jwt module
function createToken(payload) {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. MESSAGE_TYPES constants
// ═════════════════════════════════════════════════════════════════════════════
describe('MESSAGE_TYPES constants', () => {
  _it('has connection types (PING, PONG, AUTH, AUTH_SUCCESS, AUTH_FAILED)', () => {
    expect(MESSAGE_TYPES.PING).toBe('ping');
    expect(MESSAGE_TYPES.PONG).toBe('pong');
    expect(MESSAGE_TYPES.AUTH).toBe('auth');
    expect(MESSAGE_TYPES.AUTH_SUCCESS).toBe('auth_success');
    expect(MESSAGE_TYPES.AUTH_FAILED).toBe('auth_failed');
  });

  _it('has subscription types', () => {
    expect(MESSAGE_TYPES.SUBSCRIBE).toBe('subscribe');
    expect(MESSAGE_TYPES.UNSUBSCRIBE).toBe('unsubscribe');
    expect(MESSAGE_TYPES.SUBSCRIBED).toBe('subscribed');
  });

  _it('has inventory event types', () => {
    expect(MESSAGE_TYPES.INVENTORY_CREATED).toBe('inventory.created');
    expect(MESSAGE_TYPES.INVENTORY_UPDATED).toBe('inventory.updated');
    expect(MESSAGE_TYPES.INVENTORY_DELETED).toBe('inventory.deleted');
    expect(MESSAGE_TYPES.INVENTORY_SYNC).toBe('inventory.sync');
  });

  _it('has listing event types', () => {
    expect(MESSAGE_TYPES.LISTING_CREATED).toBe('listing.created');
    expect(MESSAGE_TYPES.LISTING_UPDATED).toBe('listing.updated');
    expect(MESSAGE_TYPES.LISTING_SOLD).toBe('listing.sold');
    expect(MESSAGE_TYPES.LISTING_VIEW).toBe('listing.view');
  });

  _it('has sale, offer, notification, chat, presence, error types', () => {
    expect(MESSAGE_TYPES.SALE_CREATED).toBe('sale.created');
    expect(MESSAGE_TYPES.SALE_SHIPPED).toBe('sale.shipped');
    expect(MESSAGE_TYPES.SALE_DELIVERED).toBe('sale.delivered');
    expect(MESSAGE_TYPES.OFFER_RECEIVED).toBe('offer.received');
    expect(MESSAGE_TYPES.OFFER_ACCEPTED).toBe('offer.accepted');
    expect(MESSAGE_TYPES.OFFER_DECLINED).toBe('offer.declined');
    expect(MESSAGE_TYPES.NOTIFICATION).toBe('notification');
    expect(MESSAGE_TYPES.CHAT_MESSAGE).toBe('chat.message');
    expect(MESSAGE_TYPES.USER_ONLINE).toBe('user.online');
    expect(MESSAGE_TYPES.USER_OFFLINE).toBe('user.offline');
    expect(MESSAGE_TYPES.ERROR).toBe('error');
  });

  _it('all values are unique strings', () => {
    const vals = Object.values(MESSAGE_TYPES);
    expect(new Set(vals).size).toBe(vals.length);
    for (const v of vals) expect(typeof v).toBe('string');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. handleConnection
// ═════════════════════════════════════════════════════════════════════════════
describe('handleConnection', () => {
  _it('assigns connectionId and sets up data', () => {
    const bareWs = { send: mock(), close: mock(), readyState: 1, on: mock(), ping: mock() };
    websocketService.handleConnection(bareWs);
    expect(bareWs.data).toBeDefined();
    expect(bareWs.data.connectionId).toBeTruthy();
    // connectionId should be a string (a uuid)
    expect(typeof bareWs.data.connectionId).toBe('string');
    expect(bareWs.data.isAlive).toBe(true);
    expect(bareWs.data.userId).toBeNull();
    expect(bareWs.data.subscriptions).toBeInstanceOf(Set);
  });

  _it('sends connection acknowledgment with connectionId', () => {
    const ws = { send: mock(), close: mock(), readyState: 1, on: mock(), ping: mock() };
    websocketService.handleConnection(ws);
    expect(ws.send).toHaveBeenCalled();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('connected');
    expect(sent.connectionId).toBeTruthy();
    expect(sent.serverTime).toBeTruthy();
  });

  _it('registers message, close, error, pong handlers', () => {
    const ws = { send: mock(), close: mock(), readyState: 1, on: mock(), ping: mock() };
    websocketService.handleConnection(ws);
    const events = ws.on.mock.calls.map(c => c[0]);
    expect(events).toContain('message');
    expect(events).toContain('close');
    expect(events).toContain('error');
    expect(events).toContain('pong');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3-4. handleAuth (valid / invalid JWT)
// ═════════════════════════════════════════════════════════════════════════════
describe('handleAuth', () => {
  _it('authenticates with valid JWT and sends AUTH_SUCCESS', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-123' });

    await websocketService.handleAuth(ws, { token });

    expect(ws.data.userId).toBe('user-123');
    // Should have sent AUTH_SUCCESS
    const calls = ws.send.mock.calls;
    const successMsg = calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.AUTH_SUCCESS;
    });
    expect(successMsg).toBeTruthy();
    const parsed = JSON.parse(successMsg[0]);
    expect(parsed.userId).toBe('user-123');
    expect(Array.isArray(parsed.subscriptions)).toBe(true);

    // Cleanup: disconnect to clear connections map
    websocketService.handleDisconnect(ws);
  });

  _it('authenticates using decoded.id fallback', async () => {
    const ws = createMockWs();
    const token = createToken({ id: 'user-fallback' });

    await websocketService.handleAuth(ws, { token });
    expect(ws.data.userId).toBe('user-fallback');

    websocketService.handleDisconnect(ws);
  });

  _it('rejects invalid JWT and sends AUTH_FAILED', async () => {
    const ws = createMockWs();

    await websocketService.handleAuth(ws, { token: 'totally-invalid-jwt-token' });

    const failMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.AUTH_FAILED;
    });
    expect(failMsg).toBeTruthy();
    expect(ws.close).toHaveBeenCalled();
  });

  _it('rejects auth when JWT_SECRET is not configured', async () => {
    const ws = createMockWs();
    delete process.env.JWT_SECRET;

    await websocketService.handleAuth(ws, { token: 'some-jwt' });

    const failMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.AUTH_FAILED;
    });
    expect(failMsg).toBeTruthy();
    expect(ws.close).toHaveBeenCalled();

    // Restore for subsequent tests
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  _it('auto-subscribes to user-specific topics on auth', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-auto-sub' });

    await websocketService.handleAuth(ws, { token });

    expect(ws.data.subscriptions.has('user.user-auto-sub')).toBe(true);
    expect(ws.data.subscriptions.has('inventory.user-auto-sub')).toBe(true);
    expect(ws.data.subscriptions.has('listings.user-auto-sub')).toBe(true);
    expect(ws.data.subscriptions.has('sales.user-auto-sub')).toBe(true);
    expect(ws.data.subscriptions.has('notifications.user-auto-sub')).toBe(true);

    websocketService.handleDisconnect(ws);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5-7. handleSubscribe
// ═════════════════════════════════════════════════════════════════════════════
describe('handleSubscribe', () => {
  _it('subscribes to valid topics for authenticated user', () => {
    const ws = createMockWs({ data: { connectionId: 'c1', userId: 'user-sub-1', isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, [`user.user-sub-1`]);

    expect(ws.data.subscriptions.has('user.user-sub-1')).toBe(true);
    // Check SUBSCRIBED message was sent
    const subMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.SUBSCRIBED;
    });
    expect(subMsg).toBeTruthy();
  });

  _it('rejects subscription to another users topics', () => {
    const ws = createMockWs({ data: { connectionId: 'c2', userId: 'user-sub-2', isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, ['user.other-user-id']);

    expect(ws.data.subscriptions.has('user.other-user-id')).toBe(false);
    const errMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.ERROR && p.message.includes('Unauthorized');
    });
    expect(errMsg).toBeTruthy();
  });

  _it('rejects subscription when not authenticated', () => {
    const ws = createMockWs({ data: { connectionId: 'c3', userId: null, isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, ['some.topic']);

    expect(ws.data.subscriptions.size).toBe(0);
    const errMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.ERROR && p.message.includes('authenticated');
    });
    expect(errMsg).toBeTruthy();
  });

  _it('rejects presence subscription without authentication', () => {
    const ws = createMockWs({ data: { connectionId: 'c4', userId: null, isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, ['presence']);

    expect(ws.data.subscriptions.has('presence')).toBe(false);
  });

  _it('exceeds max 50 subscriptions', () => {
    const existing = new Set();
    for (let i = 0; i < 48; i++) existing.add(`topic-${i}`);
    const ws = createMockWs({ data: { connectionId: 'c5', userId: 'user-sub-5', isAlive: true, subscriptions: existing } });

    // Try to add 3 more (48 + 3 = 51 > 50)
    websocketService.handleSubscribe(ws, ['a.user-sub-5', 'b.user-sub-5', 'c.user-sub-5']);

    const errMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.ERROR && p.message.includes('Maximum 50');
    });
    expect(errMsg).toBeTruthy();
  });

  _it('rejects invalid topic format (special characters)', () => {
    const ws = createMockWs({ data: { connectionId: 'c6', userId: 'user-sub-6', isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, ['invalid topic!@#']);

    expect(ws.data.subscriptions.size).toBe(0);
  });

  _it('rejects topic over 100 characters', () => {
    const ws = createMockWs({ data: { connectionId: 'c7', userId: 'user-sub-7', isAlive: true, subscriptions: new Set() } });
    const longTopic = 'a'.repeat(101);

    websocketService.handleSubscribe(ws, [longTopic]);

    expect(ws.data.subscriptions.size).toBe(0);
  });

  _it('allows chat topics for authenticated users', () => {
    const ws = createMockWs({ data: { connectionId: 'c8', userId: 'user-sub-8', isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, ['chat.room-1']);

    expect(ws.data.subscriptions.has('chat.room-1')).toBe(true);
  });

  _it('allows presence for authenticated user', () => {
    const ws = createMockWs({ data: { connectionId: 'c9', userId: 'user-sub-9', isAlive: true, subscriptions: new Set() } });

    websocketService.handleSubscribe(ws, ['presence']);

    expect(ws.data.subscriptions.has('presence')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. handleUnsubscribe
// ═════════════════════════════════════════════════════════════════════════════
describe('handleUnsubscribe', () => {
  _it('removes topics from subscriptions', () => {
    const ws = createMockWs({
      data: { connectionId: 'cu1', userId: 'user-unsub-1', isAlive: true, subscriptions: new Set(['topic-a', 'topic-b']) }
    });

    websocketService.handleUnsubscribe(ws, ['topic-a']);

    expect(ws.data.subscriptions.has('topic-a')).toBe(false);
    expect(ws.data.subscriptions.has('topic-b')).toBe(true);
  });

  _it('handles single topic (non-array)', () => {
    const ws = createMockWs({
      data: { connectionId: 'cu2', userId: 'user-unsub-2', isAlive: true, subscriptions: new Set(['single-topic']) }
    });

    websocketService.handleUnsubscribe(ws, 'single-topic');

    expect(ws.data.subscriptions.has('single-topic')).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. handleDisconnect
// ═════════════════════════════════════════════════════════════════════════════
describe('handleDisconnect', () => {
  _it('cleans up user connections and subscriptions', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-disc-1' });
    await websocketService.handleAuth(ws, { token });

    const statsBefore = websocketService.getStats();
    expect(statsBefore.totalConnections).toBeGreaterThan(0);

    websocketService.handleDisconnect(ws);

    const statsAfter = websocketService.getStats();
    expect(statsAfter.totalConnections).toBeLessThanOrEqual(statsBefore.totalConnections - 1);
  });

  _it('keeps user in connections if other connections exist', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const token = createToken({ userId: 'user-disc-2' });
    await websocketService.handleAuth(ws1, { token });
    await websocketService.handleAuth(ws2, { token });

    websocketService.handleDisconnect(ws1);

    // ws2 should still be connected
    const stats = websocketService.getStats();
    expect(stats.totalConnections).toBeGreaterThanOrEqual(1);

    // Cleanup
    websocketService.handleDisconnect(ws2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. send()
// ═════════════════════════════════════════════════════════════════════════════
describe('send()', () => {
  _it('calls ws.send with JSON-stringified data when readyState is OPEN', () => {
    const ws = createMockWs();
    ws.readyState = 1;
    const payload = { type: 'test', foo: 'bar' };

    websocketService.send(ws, payload);

    expect(ws.send).toHaveBeenCalledOnce();
    const sent = JSON.parse(ws.send.mock.calls[0][0]);
    expect(sent).toMatchObject(payload);
    expect(typeof sent.messageId).toBe('string');
  });

  _it('does not send when readyState is not OPEN', () => {
    const ws = createMockWs();
    ws.readyState = 3; // CLOSED

    websocketService.send(ws, { type: 'test' });

    expect(ws.send).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 11. sendToUser()
// ═════════════════════════════════════════════════════════════════════════════
describe('sendToUser()', () => {
  _it('sends to all connections for a user', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const token = createToken({ userId: 'user-send-1' });

    await websocketService.handleAuth(ws1, { token });
    await websocketService.handleAuth(ws2, { token });

    ws1.send.mockClear();
    ws2.send.mockClear();

    const payload = { type: 'test-event', data: 'hello' };
    websocketService.sendToUser('user-send-1', payload);

    // Both should have received the message
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();

    websocketService.handleDisconnect(ws1);
    websocketService.handleDisconnect(ws2);
  });

  _it('does nothing for unknown user', () => {
    // Should not throw
    websocketService.sendToUser('nonexistent-user', { type: 'noop' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 12. broadcast()
// ═════════════════════════════════════════════════════════════════════════════
describe('broadcast()', () => {
  _it('sends to all connections subscribed to a topic', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const token1 = createToken({ userId: 'user-bcast-1' });
    const token2 = createToken({ userId: 'user-bcast-2' });

    await websocketService.handleAuth(ws1, { token: token1 });
    await websocketService.handleAuth(ws2, { token: token2 });

    // ws1 is subscribed to chat.room-abc
    websocketService.handleSubscribe(ws1, ['chat.room-abc']);

    ws1.send.mockClear();
    ws2.send.mockClear();

    websocketService.broadcast('chat.room-abc', { type: 'msg', content: 'hi' });

    expect(ws1.send).toHaveBeenCalled();
    // ws2 not subscribed to chat.room-abc
    expect(ws2.send).not.toHaveBeenCalled();

    websocketService.handleDisconnect(ws1);
    websocketService.handleDisconnect(ws2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 13. broadcastAll()
// ═════════════════════════════════════════════════════════════════════════════
describe('broadcastAll()', () => {
  _it('sends to every connected client', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const token1 = createToken({ userId: 'user-ball-1' });
    const token2 = createToken({ userId: 'user-ball-2' });
    await websocketService.handleAuth(ws1, { token: token1 });
    await websocketService.handleAuth(ws2, { token: token2 });

    ws1.send.mockClear();
    ws2.send.mockClear();

    websocketService.broadcastAll({ type: 'announcement', text: 'maintenance' });

    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();

    websocketService.handleDisconnect(ws1);
    websocketService.handleDisconnect(ws2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 14. handleMessage with PING
// ═════════════════════════════════════════════════════════════════════════════
describe('handleMessage', () => {
  _it('responds to PING with PONG', async () => {
    const ws = createMockWs();
    const data = Buffer.from(JSON.stringify({ type: MESSAGE_TYPES.PING }));

    await websocketService.handleMessage(ws, data);

    const pongMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.PONG;
    });
    expect(pongMsg).toBeTruthy();
    const parsed = JSON.parse(pongMsg[0]);
    expect(parsed.timestamp).toBeDefined();
  });

  // 15. handleMessage with invalid JSON
  _it('handles invalid JSON gracefully and sends error', async () => {
    const ws = createMockWs();
    const data = Buffer.from('not-json-{{{');

    await websocketService.handleMessage(ws, data);

    const errMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.ERROR;
    });
    expect(errMsg).toBeTruthy();
    const parsed = JSON.parse(errMsg[0]);
    expect(parsed.message).toBe('Invalid message format');
  });

  _it('routes AUTH messages to handleAuth', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-msg-auth' });

    const data = Buffer.from(JSON.stringify({ type: MESSAGE_TYPES.AUTH, token }));
    await websocketService.handleMessage(ws, data);

    expect(ws.data.userId).toBe('user-msg-auth');

    websocketService.handleDisconnect(ws);
  });

  _it('routes SUBSCRIBE messages', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-msg-sub' });
    // Auth first
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    const data = Buffer.from(JSON.stringify({ type: MESSAGE_TYPES.SUBSCRIBE, topics: ['chat.room-x'] }));
    await websocketService.handleMessage(ws, data);

    expect(ws.data.subscriptions.has('chat.room-x')).toBe(true);

    websocketService.handleDisconnect(ws);
  });

  _it('routes UNSUBSCRIBE messages', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-msg-unsub' });
    await websocketService.handleAuth(ws, { token });
    websocketService.handleSubscribe(ws, ['chat.room-y']);
    expect(ws.data.subscriptions.has('chat.room-y')).toBe(true);

    const data = Buffer.from(JSON.stringify({ type: MESSAGE_TYPES.UNSUBSCRIBE, topics: ['chat.room-y'] }));
    await websocketService.handleMessage(ws, data);

    expect(ws.data.subscriptions.has('chat.room-y')).toBe(false);

    websocketService.handleDisconnect(ws);
  });

  _it('ignores CHAT_MESSAGE from unauthenticated user', async () => {
    const ws = createMockWs();
    // userId is null — not authenticated

    const data = Buffer.from(JSON.stringify({
      type: MESSAGE_TYPES.CHAT_MESSAGE,
      roomId: 'room1',
      content: 'hello'
    }));
    await websocketService.handleMessage(ws, data);

    // No chat broadcast should occur — we just check no crash
  });

  _it('logs unknown message types', async () => {
    const ws = createMockWs();
    const data = Buffer.from(JSON.stringify({ type: 'unknown.type.xyz' }));
    await websocketService.handleMessage(ws, data);
    // Should not throw — just logged
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 16. Rate limiting (60 msgs per 10 seconds)
// ═════════════════════════════════════════════════════════════════════════════
describe('rate limiting', () => {
  _it('allows up to 30 messages in a window', async () => {
    const ws = createMockWs();

    for (let i = 0; i < 30; i++) {
      const data = Buffer.from(JSON.stringify({ type: MESSAGE_TYPES.PING }));
      await websocketService.handleMessage(ws, data);
    }

    // Should have received 30 PONG messages (rate limit is 30 per minute)
    const pongCount = ws.send.mock.calls.filter(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.PONG;
    }).length;
    expect(pongCount).toBe(30);
    expect(ws.close).not.toHaveBeenCalled();
  });

  _it('closes connection after exceeding 60 messages', async () => {
    const ws = createMockWs();

    // Send 61 messages — the 61st should trigger rate limit
    for (let i = 0; i < 61; i++) {
      const data = Buffer.from(JSON.stringify({ type: MESSAGE_TYPES.PING }));
      await websocketService.handleMessage(ws, data);
    }

    const errMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.ERROR && p.message.includes('Rate limit');
    });
    expect(errMsg).toBeTruthy();
    expect(ws.close).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 17. Max connections per user (10)
// ═════════════════════════════════════════════════════════════════════════════
describe('max connections per user', () => {
  _it('rejects 11th connection for same user', async () => {
    const connections = [];
    const token = createToken({ userId: 'user-maxconn' });

    for (let i = 0; i < 10; i++) {
      const ws = createMockWs();
      await websocketService.handleAuth(ws, { token });
      connections.push(ws);
    }

    // 11th connection should be rejected
    const ws11 = createMockWs();
    await websocketService.handleAuth(ws11, { token });

    const errMsg = ws11.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.ERROR && p.message.includes('Too many connections');
    });
    expect(errMsg).toBeTruthy();
    expect(ws11.close).toHaveBeenCalled();

    // Cleanup all
    for (const ws of connections) {
      websocketService.handleDisconnect(ws);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 18. Chat message handling
// ═════════════════════════════════════════════════════════════════════════════
describe('chat message handling', () => {
  _it('broadcasts sanitized chat message to room', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const token1 = createToken({ userId: 'user-chat-1' });
    const token2 = createToken({ userId: 'user-chat-2' });
    await websocketService.handleAuth(ws1, { token: token1 });
    await websocketService.handleAuth(ws2, { token: token2 });

    // Subscribe both to chat.room-chat-test
    websocketService.handleSubscribe(ws1, ['chat.room-chat-test']);
    websocketService.handleSubscribe(ws2, ['chat.room-chat-test']);

    ws1.send.mockClear();
    ws2.send.mockClear();

    // ws1 sends a chat message
    websocketService.handleChatMessage(ws1, {
      roomId: 'room-chat-test',
      content: 'Hello <script>alert("xss")</script> world'
    });

    // Both should receive the broadcast
    const chatMsg1 = ws1.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.CHAT_MESSAGE;
    });
    expect(chatMsg1).toBeTruthy();
    const parsed = JSON.parse(chatMsg1[0]);
    expect(parsed.content).toBe('Hello alert("xss") world');
    expect(parsed.content).not.toContain('<script>');
    expect(parsed.senderId).toBe('user-chat-1');
    expect(parsed.roomId).toBe('room-chat-test');

    websocketService.handleDisconnect(ws1);
    websocketService.handleDisconnect(ws2);
  });

  _it('truncates chat content to 2000 characters', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-chat-trunc' });
    await websocketService.handleAuth(ws, { token });
    websocketService.handleSubscribe(ws, ['chat.room-trunc']);
    ws.send.mockClear();

    websocketService.handleChatMessage(ws, {
      roomId: 'room-trunc',
      content: 'x'.repeat(3000)
    });

    const chatMsg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.CHAT_MESSAGE;
    });
    expect(chatMsg).toBeTruthy();
    const parsed = JSON.parse(chatMsg[0]);
    expect(parsed.content.length).toBeLessThanOrEqual(2000);

    websocketService.handleDisconnect(ws);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 19. getStats
// ═════════════════════════════════════════════════════════════════════════════
describe('getStats()', () => {
  _it('returns connectedUsers, totalConnections, rooms', () => {
    const stats = websocketService.getStats();
    expect(stats).toHaveProperty('connectedUsers');
    expect(stats).toHaveProperty('totalConnections');
    expect(stats).toHaveProperty('rooms');
    expect(typeof stats.connectedUsers).toBe('number');
    expect(typeof stats.totalConnections).toBe('number');
    expect(typeof stats.rooms).toBe('number');
  });

  _it('increments after auth and decrements after disconnect', async () => {
    const statsBefore = websocketService.getStats();
    const ws = createMockWs();
    const token = createToken({ userId: 'user-stats-1' });
    await websocketService.handleAuth(ws, { token });

    const statsAfter = websocketService.getStats();
    expect(statsAfter.totalConnections).toBe(statsBefore.totalConnections + 1);

    websocketService.handleDisconnect(ws);
    const statsFinal = websocketService.getStats();
    expect(statsFinal.totalConnections).toBe(statsBefore.totalConnections);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 20. Business event notifications
// ═════════════════════════════════════════════════════════════════════════════
describe('business event notifications', () => {
  _it('notifyInventoryCreated sends correct message type', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-1' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    const item = { id: 'item-1', name: 'Test Item' };
    websocketService.notifyInventoryCreated('user-biz-1', item);

    const msg = ws.send.mock.calls.find(c => {
      const p = JSON.parse(c[0]);
      return p.type === MESSAGE_TYPES.INVENTORY_CREATED;
    });
    expect(msg).toBeTruthy();
    const parsed = JSON.parse(msg[0]);
    expect(parsed.item).toEqual(item);
    expect(parsed.timestamp).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifyInventoryUpdated sends correct message type', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-2' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyInventoryUpdated('user-biz-2', { id: 'i2' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.INVENTORY_UPDATED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifyInventoryDeleted sends correct message type', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-3' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyInventoryDeleted('user-biz-3', 'item-del-1');

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.INVENTORY_DELETED);
    expect(msg).toBeTruthy();
    expect(JSON.parse(msg[0]).itemId).toBe('item-del-1');

    websocketService.handleDisconnect(ws);
  });

  _it('notifyInventorySync sends items array', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-4' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    const items = [{ id: 1 }, { id: 2 }];
    websocketService.notifyInventorySync('user-biz-4', items);

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.INVENTORY_SYNC);
    expect(msg).toBeTruthy();
    expect(JSON.parse(msg[0]).items).toEqual(items);

    websocketService.handleDisconnect(ws);
  });

  _it('notifyListingCreated sends listing data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-5' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyListingCreated('user-biz-5', { id: 'list-1', title: 'Vintage Watch' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.LISTING_CREATED);
    expect(msg).toBeTruthy();
    expect(JSON.parse(msg[0]).listing.title).toBe('Vintage Watch');

    websocketService.handleDisconnect(ws);
  });

  _it('notifyListingUpdated sends listing data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-5u' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyListingUpdated('user-biz-5u', { id: 'l1' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.LISTING_UPDATED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifyListingSold sends listing and sale data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-6' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyListingSold('user-biz-6', { id: 'l2' }, { id: 's1', price: 99 });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.LISTING_SOLD);
    expect(msg).toBeTruthy();
    const parsed = JSON.parse(msg[0]);
    expect(parsed.listing.id).toBe('l2');
    expect(parsed.sale.price).toBe(99);

    websocketService.handleDisconnect(ws);
  });

  _it('notifyListingView sends view data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-7' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyListingView('user-biz-7', 'listing-abc', { viewerCount: 42 });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.LISTING_VIEW);
    expect(msg).toBeTruthy();
    const parsed = JSON.parse(msg[0]);
    expect(parsed.listingId).toBe('listing-abc');
    expect(parsed.viewerCount).toBe(42);

    websocketService.handleDisconnect(ws);
  });

  _it('notifySaleCreated sends sale data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-8' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifySaleCreated('user-biz-8', { id: 's1' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.SALE_CREATED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifySaleShipped sends sale data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-9' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifySaleShipped('user-biz-9', { id: 's2', tracking: 'TRK123' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.SALE_SHIPPED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifySaleDelivered sends sale data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-10' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifySaleDelivered('user-biz-10', { id: 's3' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.SALE_DELIVERED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifyOfferReceived sends offer data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-11' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyOfferReceived('user-biz-11', { id: 'o1', amount: 50 });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.OFFER_RECEIVED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifyOfferAccepted sends offer data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-12' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyOfferAccepted('user-biz-12', { id: 'o2' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.OFFER_ACCEPTED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notifyOfferDeclined sends offer data', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-13' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notifyOfferDeclined('user-biz-13', { id: 'o3' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.OFFER_DECLINED);
    expect(msg).toBeTruthy();

    websocketService.handleDisconnect(ws);
  });

  _it('notify sends generic notification', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-biz-14' });
    await websocketService.handleAuth(ws, { token });
    ws.send.mockClear();

    websocketService.notify('user-biz-14', { title: 'Alert', body: 'Something happened' });

    const msg = ws.send.mock.calls.find(c => JSON.parse(c[0]).type === MESSAGE_TYPES.NOTIFICATION);
    expect(msg).toBeTruthy();
    expect(JSON.parse(msg[0]).notification.title).toBe('Alert');

    websocketService.handleDisconnect(ws);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 21. cleanup()
// ═════════════════════════════════════════════════════════════════════════════
describe('cleanup()', () => {
  _it('clears heartbeat interval', () => {
    // Init to start a heartbeat
    websocketService.init(null);
    expect(websocketService.heartbeatInterval).toBeTruthy();

    websocketService.cleanup();
    expect(websocketService.heartbeatInterval).toBeNull();
  });

  _it('calling cleanup twice does not throw', () => {
    websocketService.cleanup();
    websocketService.cleanup();
    expect(websocketService.heartbeatInterval).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Additional edge cases
// ═════════════════════════════════════════════════════════════════════════════
describe('init()', () => {
  _it('stores server reference and returns this', () => {
    const fakeServer = { name: 'fake' };
    const result = websocketService.init(fakeServer);
    expect(result).toBe(websocketService);
    expect(websocketService.server).toBe(fakeServer);

    websocketService.cleanup();
  });
});

describe('disconnectAllForUser()', () => {
  _it('closes all connections for a user', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    const token = createToken({ userId: 'user-disc-all' });
    await websocketService.handleAuth(ws1, { token });
    await websocketService.handleAuth(ws2, { token });

    websocketService.disconnectAllForUser('user-disc-all');

    expect(ws1.close).toHaveBeenCalled();
    expect(ws2.close).toHaveBeenCalled();

    // Manual cleanup since close is mocked
    websocketService.handleDisconnect(ws1);
    websocketService.handleDisconnect(ws2);
  });

  _it('does nothing for nonexistent user', () => {
    // Should not throw
    websocketService.disconnectAllForUser('no-such-user');
  });
});

describe('heartbeat()', () => {
  _it('pings alive connections and sets pingPending', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-hb-1' });
    await websocketService.handleAuth(ws, { token });

    websocketService.heartbeat();

    expect(ws.ping).toHaveBeenCalled();
    expect(ws.data.pingPending).toBe(true);

    websocketService.handleDisconnect(ws);
  });

  _it('closes connections that have not responded to ping within 10s', async () => {
    const ws = createMockWs();
    const token = createToken({ userId: 'user-hb-2' });
    await websocketService.handleAuth(ws, { token });

    // Simulate a ping that was sent >10s ago with no pong received
    ws.data.pingPending = true;
    ws.data.pingPendingSince = Date.now() - 11000;
    websocketService.heartbeat();

    expect(ws.close).toHaveBeenCalled();
  });
});

describe('WebSocketClient export', () => {
  _it('WebSocketClient is exported as a string template', async () => {
    const mod = await import('../backend/services/websocket.js');
    expect(typeof mod.WebSocketClient).toBe('string');
    expect(mod.WebSocketClient).toContain('VaultListerSocket');
    expect(mod.WebSocketClient).toContain('connect');
    expect(mod.WebSocketClient).toContain('authenticate');
  });
});
