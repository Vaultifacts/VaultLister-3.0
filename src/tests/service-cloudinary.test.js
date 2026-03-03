// Cloudinary Service — Unit Tests
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import {
    generateResponsiveUrls,
    isCloudinaryConfigured,
    uploadToCloudinary,
    removeBackground,
    autoEnhance,
    smartCrop,
    applyTransformations,
    aiUpscale
} from '../backend/services/cloudinaryService.js';

// Save original env vars
const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
const originalApiKey = process.env.CLOUDINARY_API_KEY;
const originalApiSecret = process.env.CLOUDINARY_API_SECRET;

function setCloudinaryEnv() {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key-123';
    process.env.CLOUDINARY_API_SECRET = 'test-secret-456';
}

function clearCloudinaryEnv() {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
}

afterAll(() => {
    // Restore originals
    if (originalCloudName) process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    else delete process.env.CLOUDINARY_CLOUD_NAME;
    if (originalApiKey) process.env.CLOUDINARY_API_KEY = originalApiKey;
    else delete process.env.CLOUDINARY_API_KEY;
    if (originalApiSecret) process.env.CLOUDINARY_API_SECRET = originalApiSecret;
    else delete process.env.CLOUDINARY_API_SECRET;
});

describe('isCloudinaryConfigured', () => {
    test('returns false when env vars not set', () => {
        clearCloudinaryEnv();
        expect(isCloudinaryConfigured()).toBe(false);
    });

    test('returns false when only some vars set', () => {
        clearCloudinaryEnv();
        process.env.CLOUDINARY_CLOUD_NAME = 'test';
        expect(isCloudinaryConfigured()).toBe(false);
        clearCloudinaryEnv();
    });

    test('returns true when all vars set', () => {
        setCloudinaryEnv();
        expect(isCloudinaryConfigured()).toBe(true);
        clearCloudinaryEnv();
    });
});

describe('generateResponsiveUrls', () => {
    test('returns error when not configured', () => {
        clearCloudinaryEnv();
        const result = generateResponsiveUrls('test-image');
        expect(result.success).toBe(false);
        expect(result.error).toContain('not configured');
    });

    test('generates URLs for default sizes when configured', () => {
        setCloudinaryEnv();
        const result = generateResponsiveUrls('test-image');
        expect(result.success).toBe(true);
        expect(result.urls).toHaveProperty('w400');
        expect(result.urls).toHaveProperty('w800');
        expect(result.urls).toHaveProperty('w1200');
        expect(result.urls).toHaveProperty('w1600');
        clearCloudinaryEnv();
    });

    test('generates URLs with correct cloud name', () => {
        setCloudinaryEnv();
        const result = generateResponsiveUrls('my-photo');
        expect(result.urls.w400).toContain('test-cloud');
        expect(result.urls.w400).toContain('w_400');
        expect(result.urls.w400).toContain('my-photo');
        clearCloudinaryEnv();
    });

    test('supports custom sizes', () => {
        setCloudinaryEnv();
        const result = generateResponsiveUrls('img', [100, 200]);
        expect(result.success).toBe(true);
        expect(result.urls).toHaveProperty('w100');
        expect(result.urls).toHaveProperty('w200');
        expect(result.urls).not.toHaveProperty('w400');
        clearCloudinaryEnv();
    });

    test('URLs use c_scale transformation', () => {
        setCloudinaryEnv();
        const result = generateResponsiveUrls('img');
        expect(result.urls.w800).toContain('c_scale');
        clearCloudinaryEnv();
    });
});

describe('removeBackground (not configured)', () => {
    test('returns error when not configured', async () => {
        clearCloudinaryEnv();
        const result = await removeBackground('test-id');
        expect(result.success).toBe(false);
        expect(result.error).toContain('not configured');
    });

    test('returns URL when configured', async () => {
        setCloudinaryEnv();
        const result = await removeBackground('test-id');
        expect(result.success).toBe(true);
        expect(result.url).toContain('e_background_removal');
        expect(result.url).toContain('test-id');
        expect(result.transformation).toBe('background_removal');
        clearCloudinaryEnv();
    });
});

describe('autoEnhance', () => {
    test('returns error when not configured', async () => {
        clearCloudinaryEnv();
        const result = await autoEnhance('test-id');
        expect(result.success).toBe(false);
    });

    test('returns URL with enhance transformations', async () => {
        setCloudinaryEnv();
        const result = await autoEnhance('test-id');
        expect(result.success).toBe(true);
        expect(result.url).toContain('e_improve');
        expect(result.url).toContain('e_auto_contrast');
        expect(result.transformation).toBe('auto_enhance');
        clearCloudinaryEnv();
    });
});

describe('smartCrop', () => {
    test('returns error when not configured', async () => {
        clearCloudinaryEnv();
        const result = await smartCrop('test-id', 800, 600);
        expect(result.success).toBe(false);
    });

    test('returns URL with crop params', async () => {
        setCloudinaryEnv();
        const result = await smartCrop('test-id', 800, 600);
        expect(result.success).toBe(true);
        expect(result.url).toContain('c_fill');
        expect(result.url).toContain('g_auto');
        expect(result.url).toContain('w_800');
        expect(result.url).toContain('h_600');
        expect(result.width).toBe(800);
        expect(result.height).toBe(600);
        clearCloudinaryEnv();
    });
});

describe('applyTransformations', () => {
    test('returns error when not configured', async () => {
        clearCloudinaryEnv();
        const result = await applyTransformations('test-id', 'e_blur:100');
        expect(result.success).toBe(false);
    });

    test('applies string transformation', async () => {
        setCloudinaryEnv();
        const result = await applyTransformations('test-id', 'e_blur:100');
        expect(result.success).toBe(true);
        expect(result.url).toContain('e_blur:100');
        clearCloudinaryEnv();
    });

    test('applies array of transformations', async () => {
        setCloudinaryEnv();
        const result = await applyTransformations('test-id', ['e_blur:100', 'e_grayscale']);
        expect(result.success).toBe(true);
        expect(result.url).toContain('e_blur:100,e_grayscale');
        clearCloudinaryEnv();
    });
});

describe('aiUpscale', () => {
    test('returns error when not configured', async () => {
        clearCloudinaryEnv();
        const result = await aiUpscale('test-id');
        expect(result.success).toBe(false);
    });

    test('returns URL with upscale transformation', async () => {
        setCloudinaryEnv();
        const result = await aiUpscale('test-id');
        expect(result.success).toBe(true);
        expect(result.url).toContain('e_upscale');
        expect(result.transformation).toBe('ai_upscale');
        clearCloudinaryEnv();
    });
});

describe('uploadToCloudinary (not configured)', () => {
    test('returns error when not configured', async () => {
        clearCloudinaryEnv();
        const result = await uploadToCloudinary('/fake/path', 'user-1', 'img-1');
        expect(result.success).toBe(false);
        expect(result.error).toContain('not configured');
    });
});
