// CDN Middleware Unit Tests
import { describe, expect, test } from 'bun:test';
import { getCacheDuration, getCacheControl, cdnUrl, staticCacheMiddleware, getPreloadHints } from '../backend/middleware/cdn.js';

// ============================================================
// getCacheDuration
// ============================================================
describe('CDN - getCacheDuration', () => {
    test('.js files return 7 days', () => {
        expect(getCacheDuration('/app.js')).toBe(604800);
    });

    test('.css files return 7 days', () => {
        expect(getCacheDuration('/styles/main.css')).toBe(604800);
    });

    test('.png files return 30 days', () => {
        expect(getCacheDuration('/images/logo.png')).toBe(2592000);
    });

    test('.jpg files return 30 days', () => {
        expect(getCacheDuration('/photos/item.jpg')).toBe(2592000);
    });

    test('.html files return 0 (no cache)', () => {
        expect(getCacheDuration('/index.html')).toBe(0);
    });

    test('.woff2 font files return 1 year', () => {
        expect(getCacheDuration('/fonts/roboto.woff2')).toBe(31536000);
    });

    test('hashed files return 1 year (immutable)', () => {
        expect(getCacheDuration('/app.abc12345.js')).toBe(31536000);
    });

    test('hashed CSS files return 1 year', () => {
        expect(getCacheDuration('/styles.deadbeef.css')).toBe(31536000);
    });

    test('unknown extension returns 1 hour default', () => {
        expect(getCacheDuration('/data.xml')).toBe(3600);
    });

    test('.svg images return 30 days', () => {
        expect(getCacheDuration('/icon.svg')).toBe(2592000);
    });
});

// ============================================================
// getCacheControl
// ============================================================
describe('CDN - getCacheControl', () => {
    test('.html returns no-store directive', () => {
        const header = getCacheControl('/index.html');
        expect(header).toContain('no-store');
        expect(header).toContain('no-cache');
    });

    test('.js public includes "public" and max-age', () => {
        const header = getCacheControl('/app.js');
        expect(header).toContain('public');
        expect(header).toContain('max-age=604800');
    });

    test('.js private includes "private"', () => {
        const header = getCacheControl('/app.js', true);
        expect(header).toContain('private');
        expect(header).not.toContain('public');
    });

    test('hashed files include "immutable"', () => {
        const header = getCacheControl('/app.abc12345.js');
        expect(header).toContain('immutable');
    });

    test('long-cached assets include stale-while-revalidate', () => {
        const header = getCacheControl('/app.js');
        expect(header).toContain('stale-while-revalidate');
    });
});

// ============================================================
// cdnUrl
// ============================================================
describe('CDN - cdnUrl', () => {
    test('returns path as-is when CDN_URL is not set', () => {
        // CDN_URL defaults to empty string
        const result = cdnUrl('/app.js');
        // Without CDN_URL configured, should return path directly
        expect(typeof result).toBe('string');
        expect(result).toContain('/app.js');
    });

    test('returns path unchanged without CDN_URL', () => {
        const result = cdnUrl('app.js');
        // Without CDN_URL, path is returned as-is (no normalization)
        expect(result).toBe('app.js');
    });
});

// ============================================================
// staticCacheMiddleware
// ============================================================
describe('CDN - staticCacheMiddleware', () => {
    test('returns null for API routes', () => {
        const result = staticCacheMiddleware({ path: '/api/inventory' });
        expect(result).toBeNull();
    });

    test('returns cache headers for static routes', () => {
        const result = staticCacheMiddleware({ path: '/styles/main.css' });
        expect(result).not.toBeNull();
        expect(result['Cache-Control']).toBeDefined();
        expect(result['Vary']).toBe('Accept-Encoding');
    });

    test('returns no-store for HTML paths', () => {
        const result = staticCacheMiddleware({ path: '/index.html' });
        expect(result['Cache-Control']).toContain('no-store');
    });
});

// ============================================================
// getPreloadHints
// ============================================================
describe('CDN - getPreloadHints', () => {
    test('returns preload hints string', () => {
        const hints = getPreloadHints();
        expect(typeof hints).toBe('string');
        expect(hints).toContain('rel=preload');
    });

    test('includes critical CSS and JS assets', () => {
        const hints = getPreloadHints();
        expect(hints).toContain('main.css');
        expect(hints).toContain('app.js');
    });
});
