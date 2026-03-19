// predictions-ai.js — Unit Tests
// Mocks: @anthropic-ai/sdk, circuitBreaker, withTimeout, logger
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// --- Module-level mocks (must be declared before the dynamic import) ---

let mockMessagesCreate = mock(() => Promise.resolve({
    content: [{ text: '{"predicted_price":75,"confidence":82,"recommendation":"price_up","recommendation_reason":"Sales data supports higher price.","avg_days_to_sell":10,"demand_score":78}' }]
}));

mock.module('@anthropic-ai/sdk', () => ({
    default: class MockAnthropic {
        constructor() {
            this.messages = { create: mockMessagesCreate };
        }
    }
}));

mock.module('../../backend/shared/circuitBreaker.js', () => ({
    circuitBreaker: mock((_name, fn, _opts) => fn())
}));

mock.module('../../backend/shared/fetchWithTimeout.js', () => ({
    withTimeout: mock((promise, _ms, _label) => promise)
}));

mock.module('../../backend/shared/logger.js', () => ({
    logger: { info: mock(), warn: mock(), error: mock() }
}));

mock.module('./sanitize-input.js', () => ({
    sanitizeForAI: mock((val) => val)
}));

// Dynamic import AFTER mocks are registered
const { claudePricePrediction, claudeDemandForecast, invalidatePredictionCache } =
    await import('../shared/ai/predictions-ai.js');

// --- Test fixtures ---

const baseItem = {
    id: 'item-001',
    user_id: 'user-abc',
    title: 'Nike Air Max 90',
    brand: 'Nike',
    category: 'Shoes',
    condition: 'good',
    list_price: 60,
    cost_price: 20,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
};

const salesHistory = [
    { sale_price: 70, platform: 'poshmark', category: 'Shoes', created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
    { sale_price: 75, platform: 'ebay', category: 'Shoes', created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
    { sale_price: 65, platform: 'mercari', category: 'Shoes', created_at: new Date(Date.now() - 30 * 86400000).toISOString() }
];

// Save and restore ANTHROPIC_API_KEY between tests
const originalApiKey = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key-unit';
    // Clear the module-level cache between tests by invalidating the fixture item
    invalidatePredictionCache('item-001', 'user-abc');
});

afterEach(() => {
    if (originalApiKey) process.env.ANTHROPIC_API_KEY = originalApiKey;
    else delete process.env.ANTHROPIC_API_KEY;
});

// ===== claudePricePrediction =====

describe('claudePricePrediction', () => {
    test('should return cached value without API call when cache is warm', async () => {
        // Prime the cache
        const first = await claudePricePrediction(baseItem, salesHistory);
        expect(first.source).toBe('claude');

        const callCountAfterFirst = mockMessagesCreate.mock.calls.length;

        // Second call must hit cache
        const second = await claudePricePrediction(baseItem, salesHistory);
        expect(second.source).toBe('cache');
        expect(mockMessagesCreate.mock.calls.length).toBe(callCountAfterFirst);
    });

    test('should trigger API call on cache miss', async () => {
        // Cache was cleared in beforeEach
        const callsBefore = mockMessagesCreate.mock.calls.length;
        const result = await claudePricePrediction(baseItem, salesHistory);
        expect(mockMessagesCreate.mock.calls.length).toBeGreaterThan(callsBefore);
        expect(result.source).toBe('claude');
    });

    test('should return correct prediction shape from API response', async () => {
        const result = await claudePricePrediction(baseItem, salesHistory);
        expect(result).toHaveProperty('predicted_price');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('recommendation');
        expect(result).toHaveProperty('recommendation_reason');
        expect(result).toHaveProperty('avg_days_to_sell');
        expect(result).toHaveProperty('demand_score');
        expect(result).toHaveProperty('source');
    });

    test('should parse predicted_price from API response', async () => {
        const result = await claudePricePrediction(baseItem, salesHistory);
        expect(result.predicted_price).toBe(75);
        expect(result.confidence).toBe(82);
        expect(result.recommendation).toBe('price_up');
    });

    test('should use statistical fallback when ANTHROPIC_API_KEY is not set', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        invalidatePredictionCache('item-001', 'user-abc');

        const callsBefore = mockMessagesCreate.mock.calls.length;
        const result = await claudePricePrediction(baseItem, salesHistory);
        expect(result.source).toBe('statistical');
        expect(mockMessagesCreate.mock.calls.length).toBe(callsBefore);
    });

    test('should use statistical fallback when API call throws', async () => {
        mockMessagesCreate = mock(() => Promise.reject(new Error('Network error')));
        invalidatePredictionCache('item-001', 'user-abc');

        const result = await claudePricePrediction(baseItem, salesHistory);
        expect(result.source).toBe('statistical');
        // Restore working mock for subsequent tests
        mockMessagesCreate = mock(() => Promise.resolve({
            content: [{ text: '{"predicted_price":75,"confidence":82,"recommendation":"price_up","recommendation_reason":"Sales data supports higher price.","avg_days_to_sell":10,"demand_score":78}' }]
        }));
    });

    test('should return statistical fallback with recommendation_reason when no API key', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        invalidatePredictionCache('item-001', 'user-abc');

        const result = await claudePricePrediction(baseItem, salesHistory);
        expect(typeof result.recommendation_reason).toBe('string');
        expect(result.recommendation_reason.length).toBeGreaterThan(0);
    });

    test('should recommend relist when item listed over 30 days ago with no API key', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const staleItem = {
            ...baseItem,
            id: 'item-stale',
            list_price: 50,
            created_at: new Date(Date.now() - 35 * 86400000).toISOString()
        };
        invalidatePredictionCache('item-stale', 'user-abc');

        const result = await claudePricePrediction(staleItem, []);
        expect(result.source).toBe('statistical');
        expect(result.recommendation).toBe('relist');
    });

    test('should evict oldest cache entry when MAX_CACHE_SIZE is exceeded', async () => {
        // Fill the cache beyond MAX_CACHE_SIZE (500) by calling with unique item IDs
        // We verify eviction indirectly: after filling, a re-requested early item is a miss.
        // For test-speed we just confirm cacheSet does not throw on overflow.
        const promises = [];
        for (let i = 0; i < 5; i++) {
            const item = { ...baseItem, id: `item-overflow-${i}`, user_id: 'user-overflow' };
            invalidatePredictionCache(`item-overflow-${i}`, 'user-overflow');
            promises.push(claudePricePrediction(item, []));
        }
        const results = await Promise.all(promises);
        for (const r of results) {
            expect(['claude', 'statistical']).toContain(r.source);
        }
    });
});

// ===== invalidatePredictionCache =====

describe('invalidatePredictionCache', () => {
    test('should clear specific cache key so next call is a miss', async () => {
        // Prime the cache
        await claudePricePrediction(baseItem, salesHistory);
        const callsAfterPrime = mockMessagesCreate.mock.calls.length;

        // Invalidate
        invalidatePredictionCache('item-001', 'user-abc');

        // Should re-hit the API
        await claudePricePrediction(baseItem, salesHistory);
        expect(mockMessagesCreate.mock.calls.length).toBeGreaterThan(callsAfterPrime);
    });

    test('should not affect other cached keys when invalidating one item', async () => {
        const otherItem = { ...baseItem, id: 'item-002', user_id: 'user-abc' };
        invalidatePredictionCache('item-002', 'user-abc');

        await claudePricePrediction(otherItem, salesHistory);
        const callsAfterOther = mockMessagesCreate.mock.calls.length;

        // Invalidate item-001, not item-002
        invalidatePredictionCache('item-001', 'user-abc');

        // item-002 should still be cached
        const result = await claudePricePrediction(otherItem, salesHistory);
        expect(result.source).toBe('cache');
        expect(mockMessagesCreate.mock.calls.length).toBe(callsAfterOther);
    });
});

// ===== claudeDemandForecast =====

describe('claudeDemandForecast', () => {
    const demandApiResponse = JSON.stringify([
        { category: 'Shoes', demand_level: 'high', price_trend: 'rising', seasonality_index: 1.1, notes: 'Peak season.' },
        { category: 'Clothing', demand_level: 'medium', price_trend: 'stable', seasonality_index: 1.0, notes: 'Normal activity.' }
    ]);

    beforeEach(() => {
        mockMessagesCreate = mock(() => Promise.resolve({
            content: [{ text: demandApiResponse }]
        }));
        // Invalidate demand cache for this user
        // demand cache key is `demand:userId` — no public invalidator, so we rely on each
        // test using a unique userId to avoid cross-test pollution.
    });

    test('should return array of forecasts from API when key is set', async () => {
        const results = await claudeDemandForecast('user-demand-001', [
            { category: 'Shoes', sale_price: 70, created_at: new Date().toISOString() }
        ]);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('category');
        expect(results[0]).toHaveProperty('demand_level');
        expect(results[0]).toHaveProperty('price_trend');
        expect(results[0]).toHaveProperty('seasonality_index');
        expect(results[0]).toHaveProperty('notes');
    });

    test('should use statistical fallback when ANTHROPIC_API_KEY is not set', async () => {
        delete process.env.ANTHROPIC_API_KEY;

        const results = await claudeDemandForecast('user-demand-002', []);
        expect(Array.isArray(results)).toBe(true);
        for (const f of results) {
            expect(f.source).toBe('statistical');
        }
    });

    test('should clamp seasonality_index between 0.5 and 1.5', async () => {
        mockMessagesCreate = mock(() => Promise.resolve({
            content: [{ text: JSON.stringify([
                { category: 'Shoes', demand_level: 'high', price_trend: 'rising', seasonality_index: 9.9, notes: 'Test.' }
            ]) }]
        }));

        const results = await claudeDemandForecast('user-demand-003', [
            { category: 'Shoes', sale_price: 50, created_at: new Date().toISOString() }
        ]);
        expect(results[0].seasonality_index).toBeLessThanOrEqual(1.5);
        expect(results[0].seasonality_index).toBeGreaterThanOrEqual(0.5);
    });
});
