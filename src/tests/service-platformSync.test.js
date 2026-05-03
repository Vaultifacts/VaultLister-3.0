// Platform Sync — Pure Function Unit Tests
import { describe, expect, test } from 'bun:test';
import { isSyncSupported, getSupportedPlatforms } from '../backend/services/platformSync/index.js';

describe('isSyncSupported', () => {
    test('returns true for ebay', () => {
        expect(isSyncSupported('ebay')).toBe(true);
    });

    test('returns true for poshmark', () => {
        expect(isSyncSupported('poshmark')).toBe(true);
    });

    test('returns true for mercari', () => {
        expect(isSyncSupported('mercari')).toBe(true);
    });

    test('returns true for depop', () => {
        expect(isSyncSupported('depop')).toBe(true);
    });

    test('returns true for grailed', () => {
        expect(isSyncSupported('grailed')).toBe(true);
    });

    test('returns true for etsy', () => {
        expect(isSyncSupported('etsy')).toBe(true);
    });

    test('returns false for unknown platform', () => {
        expect(isSyncSupported('amazon')).toBe(false);
    });

    test('is case-insensitive', () => {
        expect(isSyncSupported('EBAY')).toBe(true);
        expect(isSyncSupported('Etsy')).toBe(true);
    });

    test('returns true for facebook', () => {
        expect(isSyncSupported('facebook')).toBe(true);
    });

    test('returns true for whatnot', () => {
        expect(isSyncSupported('whatnot')).toBe(true);
    });

    test('returns true for shopify', () => {
        expect(isSyncSupported('shopify')).toBe(true);
    });
});

describe('getSupportedPlatforms', () => {
    test('returns an array', () => {
        const platforms = getSupportedPlatforms();
        expect(Array.isArray(platforms)).toBe(true);
    });

    test('returns 7 platforms', () => {
        expect(getSupportedPlatforms().length).toBe(7);
    });

    test('each platform has required shape', () => {
        for (const p of getSupportedPlatforms()) {
            expect(typeof p.platform).toBe('string');
            expect(typeof p.syncSupported).toBe('boolean');
            expect(Array.isArray(p.capabilities)).toBe(true);
            expect(typeof p.oauthSupported).toBe('boolean');
        }
    });

    test('7 platforms have syncSupported=true', () => {
        const supported = getSupportedPlatforms().filter(p => p.syncSupported);
        expect(supported.length).toBe(7);
    });

    test('facebook has syncSupported=true', () => {
        const fb = getSupportedPlatforms().find(p => p.platform === 'facebook');
        expect(fb.syncSupported).toBe(true);
        expect(fb.capabilities).toContain('listings');
    });

    test('supported platforms have listings and orders capabilities', () => {
        const supported = getSupportedPlatforms().filter(p => p.syncSupported);
        for (const p of supported) {
            expect(p.capabilities).toContain('listings');
            expect(p.capabilities).toContain('orders');
        }
    });
});
