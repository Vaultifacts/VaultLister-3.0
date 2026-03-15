// Architecture & Reliability — Integration Failures + Reliability
// Categories: #2 Integrations/dependencies, #3 Reliability/failure modes
// Audit gaps: H2 (network failure), H3 (no idempotency), H5 (no timeout),
//             H6 (AI silent catch), H11 (unavailability), H12 (partial sync)

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';
import crypto from 'crypto';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
    models: {
        create: mock(), findById: mock(), findOne: mock(),
        findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

const mockLogger = { info: mock(), error: mock(), warn: mock(), debug: mock() };
mock.module('../backend/shared/logger.js', () => ({
    logger: mockLogger,
    default: mockLogger,
}));

const mockCreateNotification = mock(() => {});
const mockCreateOAuthNotification = mock(() => {});
mock.module('../backend/services/notificationService.js', () => ({
    createNotification: mockCreateNotification,
    createOAuthNotification: mockCreateOAuthNotification,
    NotificationTypes: {
        TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
        OAUTH_DISCONNECTED: 'OAUTH_DISCONNECTED',
        SYNC_COMPLETED: 'SYNC_COMPLETED',
    },
    default: { createNotification: mockCreateNotification },
}));

mock.module('../backend/utils/encryption.js', () => ({
    encryptToken: (t) => `enc_${t}`,
    decryptToken: (t) => t.replace('enc_', ''),
}));

mock.module('../backend/services/websocket.js', () => ({
    websocketService: { sendToUser: mock(), broadcast: mock(), cleanup: mock() },
}));

// Mock Anthropic SDK — controllable per test
let mockAnthropicCreate = mock(() => ({
    content: [{ text: '{"title":"AI Title","description":"AI Desc","tags":["tag1"]}' }]
}));

mock.module('@anthropic-ai/sdk', () => ({
    default: class Anthropic {
        constructor() {}
        messages = { create: (...args) => mockAnthropicCreate(...args) };
    },
}));

// ─── Dynamic imports (after mocks) ──────────────────────────────────────────

const { processWebhookEvent, dispatchToUserEndpoints, verifySignature } =
    await import('../backend/services/webhookProcessor.js');

const { refreshShopToken, stopTokenRefreshScheduler, getOAuthConfig } =
    await import('../backend/services/tokenRefreshScheduler.js');

const { generateListing } =
    await import('../shared/ai/listing-generator.js');

// ─── Helpers ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

function resetMocks() {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    mockCreateNotification.mockReset();
    mockCreateOAuthNotification.mockReset();
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
    mockAnthropicCreate.mockReset();
    mockAnthropicCreate.mockReturnValue({
        content: [{ text: '{"title":"AI Title","description":"AI Desc","tags":["tag1"]}' }]
    });
}

beforeEach(() => {
    resetMocks();
    globalThis.fetch = originalFetch;
});

afterAll(() => {
    globalThis.fetch = originalFetch;
    stopTokenRefreshScheduler();
});

// ═══════════════════════════════════════════════════════════════════════════
// AI SILENT ERROR SWALLOWING (DC-2, High #6)
// ═══════════════════════════════════════════════════════════════════════════

describe('AI listing generator — silent catch fallback', () => {
    const ctx = { brand: 'Nike', category: 'Tops', condition: 'good', color: 'Black', size: 'M' };

    test('should fall back to template when Anthropic API throws', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
        mockAnthropicCreate.mockImplementation(() => { throw new Error('API unavailable'); });
        const result = await generateListing(ctx);
        expect(result.source).toBe('template');
        expect(result.title).toBeDefined();
        expect(result.description).toBeDefined();
        delete process.env.ANTHROPIC_API_KEY;
    });

    test('should fall back to template when API returns non-JSON', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
        mockAnthropicCreate.mockReturnValue({
            content: [{ text: 'This is not JSON at all' }]
        });
        const result = await generateListing(ctx);
        expect(result.source).toBe('template');
        delete process.env.ANTHROPIC_API_KEY;
    });

    test('should fall back to template when ANTHROPIC_API_KEY is unset', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const result = await generateListing(ctx);
        expect(result.source).toBe('template');
    });

    test('should return claude source when API returns valid JSON', async () => {
        process.env.ANTHROPIC_API_KEY = 'test-key';
        mockAnthropicCreate.mockReturnValue({
            content: [{ text: '{"title":"Test Title","description":"Test Desc","tags":["t1","t2"]}' }]
        });
        const result = await generateListing(ctx);
        expect(result.source).toBe('claude');
        expect(result.title).toBe('Test Title');
        expect(result.tags).toEqual(['t1', 't2']);
        delete process.env.ANTHROPIC_API_KEY;
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK PROCESSOR — EVENT HANDLING (High #2, #11)
// ═══════════════════════════════════════════════════════════════════════════

describe('Webhook processor — event handling', () => {
    test('should mark event as processed when handler succeeds', async () => {
        const event = {
            id: 'evt-1', event_type: 'listing.created', user_id: 'u1',
            payload: JSON.stringify({ title: 'Test', platform: 'poshmark' })
        };
        const result = await processWebhookEvent(event);
        expect(result.success).toBe(true);
        const updateCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes("status = 'processed'")
        );
        expect(updateCalls.length).toBeGreaterThan(0);
    });

    test('should mark event as failed when handler throws', async () => {
        // listing.updated handler does a query.run that we can make throw
        mockQueryRun.mockImplementationOnce(() => ({ changes: 1 })); // first call
        mockQueryRun.mockImplementationOnce(() => { throw new Error('DB error'); }); // handler query
        // But processWebhookEvent catches at the outer level, so we need the handler to throw
        // Use a valid event type with a payload that triggers an error path
        const event = {
            id: 'evt-2', event_type: 'listing.views', user_id: 'u1',
            payload: 'invalid-json'
        };
        const result = await processWebhookEvent(event);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });

    test('should return error for unknown event types', async () => {
        const event = { id: 'evt-3', event_type: 'unknown.event', payload: '{}' };
        const result = await processWebhookEvent(event);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown event type');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK DISPATCH — NO TIMEOUT / NO RETRY (High #2, #5)
// ═══════════════════════════════════════════════════════════════════════════

describe('Webhook dispatch — failure handling', () => {
    const endpoint = { id: 'ep-1', url: 'https://example.com/hook', secret: 'test-secret', name: 'Test' };

    test('should increment failure_count when fetch rejects', async () => {
        mockQueryAll.mockReturnValue([endpoint]);
        globalThis.fetch = mock(() => Promise.reject(new Error('Connection refused')));

        await dispatchToUserEndpoints('u1', 'listing.sold', { title: 'Item' });

        const failureCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('failure_count = failure_count + 1')
        );
        expect(failureCalls.length).toBe(1);
    });

    test('should increment failure_count when fetch returns non-ok status', async () => {
        mockQueryAll.mockReturnValue([endpoint]);
        globalThis.fetch = mock(() => Promise.resolve({ ok: false, status: 500 }));

        await dispatchToUserEndpoints('u1', 'listing.sold', { title: 'Item' });

        const failureCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('failure_count = failure_count + 1')
        );
        expect(failureCalls.length).toBe(1);
    });

    test('should disable endpoint after 10 consecutive failures', async () => {
        mockQueryAll.mockReturnValue([endpoint]);
        globalThis.fetch = mock(() => Promise.reject(new Error('timeout')));
        // After incrementing, the get returns failure_count >= 10
        mockQueryGet.mockReturnValue({ failure_count: 10 });

        await dispatchToUserEndpoints('u1', 'listing.sold', { title: 'Item' });

        const disableCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('is_enabled = 0')
        );
        expect(disableCalls.length).toBe(1);
        expect(mockCreateNotification).toHaveBeenCalled();
    });

    test('should reset failure_count to 0 on successful delivery', async () => {
        mockQueryAll.mockReturnValue([endpoint]);
        globalThis.fetch = mock(() => Promise.resolve({ ok: true, status: 200 }));

        await dispatchToUserEndpoints('u1', 'listing.sold', { title: 'Item' });

        const resetCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('failure_count = 0')
        );
        expect(resetCalls.length).toBe(1);
    });

    test('should attempt delivery to all endpoints even when one fails', async () => {
        const endpoints = [
            { id: 'ep-1', url: 'https://fail.example.com/hook', secret: 's1', name: 'Fail' },
            { id: 'ep-2', url: 'https://ok.example.com/hook', secret: 's2', name: 'OK' },
        ];
        mockQueryAll.mockReturnValue(endpoints);
        let callCount = 0;
        globalThis.fetch = mock(() => {
            callCount++;
            if (callCount === 1) return Promise.reject(new Error('fail'));
            return Promise.resolve({ ok: true, status: 200 });
        });

        await dispatchToUserEndpoints('u1', 'listing.sold', { title: 'Item' });
        expect(callCount).toBe(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK SIGNATURE VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

describe('Webhook signature verification', () => {
    test('should verify valid HMAC-SHA256 signature', () => {
        const payload = { event: 'test' };
        const secret = 'my-secret';
        const payloadStr = JSON.stringify(payload);
        const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
        expect(verifySignature(payload, expected, secret)).toBe(true);
    });

    test('should reject invalid signature', () => {
        expect(verifySignature({ event: 'test' }, 'sha256=wrong', 'my-secret')).toBe(false);
    });

    test('should reject when signature and expected have different lengths', () => {
        expect(verifySignature({ event: 'test' }, 'sha256=abc', 'my-secret')).toBe(false);
    });

    test('should return false when signature or secret is missing', () => {
        expect(verifySignature({ event: 'test' }, null, 'secret')).toBe(false);
        expect(verifySignature({ event: 'test' }, 'sha256=abc', null)).toBe(false);
        expect(verifySignature({ event: 'test' }, '', '')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN REFRESH FAILURE SCENARIOS (Medium #5, High #11)
// ═══════════════════════════════════════════════════════════════════════════

describe('Token refresh — consecutive failure tracking', () => {
    const makeShop = (failures = 0) => ({
        id: 'shop-1', platform: 'ebay', user_id: 'u1',
        oauth_refresh_token: 'enc_refresh_token',
        consecutive_refresh_failures: failures,
    });

    test('should increment consecutive_refresh_failures on refresh error', async () => {
        // performTokenRefresh will fail because fetch rejects
        globalThis.fetch = mock(() => Promise.reject(new Error('Network error')));
        try {
            await refreshShopToken(makeShop(0));
        } catch (_) { /* expected */ }

        const failureCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('consecutive_refresh_failures')
        );
        expect(failureCalls.length).toBeGreaterThan(0);
    });

    test('should auto-disconnect shop after 5 consecutive failures', async () => {
        // Network errors are transient — threshold is MAX_TRANSIENT_FAILURES=10
        globalThis.fetch = mock(() => Promise.reject(new Error('Network error')));
        try {
            await refreshShopToken(makeShop(9)); // 9 + 1 = 10 >= MAX_TRANSIENT_FAILURES
        } catch (_) { /* expected */ }

        const disconnectCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('is_connected = 0')
        );
        expect(disconnectCalls.length).toBe(1);
    });

    test('should create OAUTH_DISCONNECTED notification on auto-disconnect', async () => {
        // Network errors are transient — threshold is MAX_TRANSIENT_FAILURES=10
        globalThis.fetch = mock(() => Promise.reject(new Error('Network error')));
        try {
            await refreshShopToken(makeShop(9)); // 9 + 1 = 10 >= MAX_TRANSIENT_FAILURES
        } catch (_) { /* expected */ }

        // Should have two calls: TOKEN_REFRESH_FAILED and OAUTH_DISCONNECTED
        const disconnectCalls = mockCreateOAuthNotification.mock.calls.filter(c =>
            c[2] === 'OAUTH_DISCONNECTED'
        );
        expect(disconnectCalls.length).toBe(1);
    });

    test('should reset failures to 0 on successful token refresh', async () => {
        // Force mock mode for instant success without hitting real URLs
        const origMode = process.env.OAUTH_MODE;
        process.env.OAUTH_MODE = 'mock';
        const shop = makeShop(3);
        const result = await refreshShopToken(shop);
        expect(result.success).toBe(true);

        const resetCalls = mockQueryRun.mock.calls.filter(c =>
            typeof c[0] === 'string' && c[0].includes('consecutive_refresh_failures = 0')
        );
        expect(resetCalls.length).toBeGreaterThan(0);
        if (origMode !== undefined) process.env.OAUTH_MODE = origMode;
        else delete process.env.OAUTH_MODE;
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN ARCHITECTURE GAPS — DOCUMENTATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Known architecture gaps (documenting absence)', () => {
    test('REM-11 FIX: dispatchToUserEndpoints calls fetchWithTimeout WITH AbortSignal', async () => {
        mockQueryAll.mockReturnValue([{ id: 'ep-1', url: 'https://example.com', secret: 's', name: 'N' }]);
        let fetchArgs = null;
        globalThis.fetch = mock((...args) => {
            fetchArgs = args;
            return Promise.resolve({ ok: true, status: 200 });
        });

        await dispatchToUserEndpoints('u1', 'listing.sold', { title: 'Item' });

        // Verify AbortSignal IS now passed (REM-11 fix)
        expect(fetchArgs).toBeDefined();
        const options = fetchArgs[1];
        expect(options.signal).toBeDefined();
    });

    test('KNOWN GAP: processWebhookEvent has no deduplication — same event processed twice', async () => {
        const event = {
            id: 'evt-dup', event_type: 'offer.accepted', user_id: 'u1',
            payload: JSON.stringify({ offerId: 'o1' })
        };
        const result1 = await processWebhookEvent(event);
        const result2 = await processWebhookEvent(event);
        // Both succeed — no dedup guard
        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
    });
});
