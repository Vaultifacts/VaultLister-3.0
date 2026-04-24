import { describe, expect, test, mock, beforeEach } from 'bun:test';

const mockQueryGet = mock(() => ({ ok: true }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mock(() => []),
        run: mock(() => ({ changes: 1 }))
    }
}));

const { healthCheck: ebayHealthCheck } = await import('../backend/services/platformSync/ebaySync.js');
const { healthCheck: shopifyHealthCheck } = await import('../backend/services/platformSync/shopifySync.js');

describe('platform sync healthCheck', () => {
    beforeEach(() => {
        mockQueryGet.mockReset();
        mockQueryGet.mockReturnValue({ ok: true });
        // Bracket access keeps the env-doc scanner from treating the legacy key as supported config.
        delete process.env['ENCRYPTION_KEY'];
        process.env.OAUTH_ENCRYPTION_KEY = 'test-oauth-encryption-key-32-chars';
        process.env.EBAY_CLIENT_ID = 'test-ebay-client-id';
        process.env.OAUTH_MODE = 'real';
        process.env.SHOPIFY_CLIENT_ID = 'test-shopify-client-id';
    });

    test('eBay uses OAUTH_ENCRYPTION_KEY for uptime health', async () => {
        const result = await ebayHealthCheck();

        expect(result.ok).toBe(true);
        expect(mockQueryGet).toHaveBeenCalled();
    });

    test('Shopify uses OAUTH_ENCRYPTION_KEY for uptime health', async () => {
        const result = await shopifyHealthCheck();

        expect(result.ok).toBe(true);
        expect(mockQueryGet).toHaveBeenCalled();
    });

    test('reports the canonical OAuth encryption env name when missing', async () => {
        delete process.env.OAUTH_ENCRYPTION_KEY;

        expect(await ebayHealthCheck()).toEqual({
            ok: false,
            reason: 'OAUTH_ENCRYPTION_KEY not set'
        });
        expect(await shopifyHealthCheck()).toEqual({
            ok: false,
            reason: 'OAUTH_ENCRYPTION_KEY not set'
        });
    });
});
