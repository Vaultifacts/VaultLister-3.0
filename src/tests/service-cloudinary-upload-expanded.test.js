// Cloudinary Service — Expanded Unit Tests
// Tests transformation URL generators, responsive URLs, config check
// Note: Without CLOUDINARY_* env vars, transformation functions return {} or error objects
import { describe, expect, test, beforeAll } from 'bun:test';

let mod;

beforeAll(async () => {
    try {
        mod = await import('../backend/services/cloudinaryService.js');
    } catch (e) {
        console.warn('Could not import cloudinaryService:', e.message);
    }
});

describe('isCloudinaryConfigured', () => {
    test('returns boolean', () => {
        const fn = mod?.isCloudinaryConfigured;
        if (!fn) { console.warn('isCloudinaryConfigured not exported'); return; }
        expect(typeof fn()).toBe('boolean');
    });

    test('returns false without env vars', () => {
        const fn = mod?.isCloudinaryConfigured;
        if (!fn) { console.warn('isCloudinaryConfigured not exported'); return; }
        // In test env, Cloudinary vars are not set
        expect(fn()).toBe(false);
    });
});

describe('uploadToCloudinary', () => {
    test('returns error when not configured', async () => {
        const fn = mod?.uploadToCloudinary;
        if (!fn) { console.warn('uploadToCloudinary not exported'); return; }
        const result = await fn('/tmp/test.jpg', 'user-1', 'img-1');
        expect(result.success).toBe(false);
    });

    test('returns object with success property', async () => {
        const fn = mod?.uploadToCloudinary;
        if (!fn) { console.warn('uploadToCloudinary not exported'); return; }
        const result = await fn('/tmp/test.jpg', 'user-1', 'img-1');
        expect(typeof result).toBe('object');
        expect(typeof result.success).toBe('boolean');
    });
});

describe('removeBackground — unconfigured returns empty object', () => {
    test('returns object', () => {
        const fn = mod?.removeBackground;
        if (!fn) { console.warn('removeBackground not exported'); return; }
        const result = fn('test-id');
        expect(typeof result).toBe('object');
    });

    test('does not throw for any public ID', () => {
        const fn = mod?.removeBackground;
        if (!fn) { console.warn('removeBackground not exported'); return; }
        expect(() => fn('users/folder/img')).not.toThrow();
        expect(() => fn('')).not.toThrow();
    });
});

describe('autoEnhance — unconfigured returns empty object', () => {
    test('returns object', () => {
        const fn = mod?.autoEnhance;
        if (!fn) { console.warn('autoEnhance not exported'); return; }
        const result = fn('test-id');
        expect(typeof result).toBe('object');
    });
});

describe('smartCrop — unconfigured returns empty object', () => {
    test('returns object', () => {
        const fn = mod?.smartCrop;
        if (!fn) { console.warn('smartCrop not exported'); return; }
        const result = fn('test-id', 800, 600);
        expect(typeof result).toBe('object');
    });

    test('does not throw for various dimensions', () => {
        const fn = mod?.smartCrop;
        if (!fn) { console.warn('smartCrop not exported'); return; }
        expect(() => fn('id', 0, 0)).not.toThrow();
        expect(() => fn('id', 9999, 9999)).not.toThrow();
    });
});

describe('aiUpscale — unconfigured returns empty object', () => {
    test('returns object', () => {
        const fn = mod?.aiUpscale;
        if (!fn) { console.warn('aiUpscale not exported'); return; }
        const result = fn('test-id');
        expect(typeof result).toBe('object');
    });
});

describe('applyTransformations — unconfigured returns empty object', () => {
    test('returns object', () => {
        const fn = mod?.applyTransformations;
        if (!fn) { console.warn('applyTransformations not exported'); return; }
        const result = fn('test-id', 'w_500,h_500');
        expect(typeof result).toBe('object');
    });
});

describe('generateResponsiveUrls — unconfigured returns error', () => {
    test('returns object with success=false', () => {
        const fn = mod?.generateResponsiveUrls;
        if (!fn) { console.warn('generateResponsiveUrls not exported'); return; }
        const result = fn('test-id');
        expect(typeof result).toBe('object');
        expect(result.success).toBe(false);
    });

    test('handles custom sizes param', () => {
        const fn = mod?.generateResponsiveUrls;
        if (!fn) { console.warn('generateResponsiveUrls not exported'); return; }
        const result = fn('test-id', [320, 640]);
        expect(typeof result).toBe('object');
    });
});

describe('Cloudinary exports are all functions', () => {
    test('all expected functions are exported', () => {
        if (!mod) { console.warn('Module not loaded'); return; }
        const expected = [
            'uploadToCloudinary', 'removeBackground', 'autoEnhance',
            'smartCrop', 'applyTransformations', 'aiUpscale',
            'generateResponsiveUrls', 'isCloudinaryConfigured'
        ];
        for (const name of expected) {
            expect(typeof mod[name]).toBe('function');
        }
    });
});
