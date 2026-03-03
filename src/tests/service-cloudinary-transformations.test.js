import { describe, expect, test, beforeAll, afterAll } from 'bun:test';

const {
  removeBackground,
  autoEnhance,
  smartCrop,
  aiUpscale,
  applyTransformations,
  generateResponsiveUrls,
  isCloudinaryConfigured
} = await import('../backend/services/cloudinaryService.js');

describe('cloudinaryService transformations', () => {

  describe('when NOT configured', () => {
    test('removeBackground returns error', async () => {
      const result = await removeBackground('test/image');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    test('autoEnhance returns error', async () => {
      expect((await autoEnhance('test/image')).success).toBe(false);
    });

    test('generateResponsiveUrls returns error', () => {
      expect(generateResponsiveUrls('test/image').success).toBe(false);
    });
  });

  describe('when configured', () => {
    const saved = {};

    beforeAll(() => {
      saved.cloud = process.env.CLOUDINARY_CLOUD_NAME;
      saved.key = process.env.CLOUDINARY_API_KEY;
      saved.secret = process.env.CLOUDINARY_API_SECRET;
      process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
      process.env.CLOUDINARY_API_KEY = 'test-key';
      process.env.CLOUDINARY_API_SECRET = 'test-secret';
    });

    afterAll(() => {
      for (const [k, v] of [['CLOUDINARY_CLOUD_NAME', saved.cloud], ['CLOUDINARY_API_KEY', saved.key], ['CLOUDINARY_API_SECRET', saved.secret]]) {
        if (v) process.env[k] = v; else delete process.env[k];
      }
    });

    test('removeBackground returns URL with e_background_removal', async () => {
      const result = await removeBackground('vaultlister/user1/img1');
      expect(result.success).toBe(true);
      expect(result.url).toContain('e_background_removal');
      expect(result.url).toContain('test-cloud');
      expect(result.transformation).toBe('background_removal');
    });

    test('autoEnhance returns URL with improvement transforms', async () => {
      const result = await autoEnhance('vaultlister/user1/img1');
      expect(result.success).toBe(true);
      expect(result.url).toContain('e_improve');
      expect(result.url).toContain('e_auto_contrast');
    });

    test('smartCrop returns URL with dimensions', async () => {
      const result = await smartCrop('vaultlister/user1/img1', 800, 600);
      expect(result.success).toBe(true);
      expect(result.url).toContain('w_800');
      expect(result.url).toContain('h_600');
      expect(result.url).toContain('c_fill');
      expect(result.width).toBe(800);
    });

    test('aiUpscale returns URL with e_upscale', async () => {
      const result = await aiUpscale('vaultlister/user1/img1');
      expect(result.success).toBe(true);
      expect(result.url).toContain('e_upscale');
    });

    test('applyTransformations builds URL from string', async () => {
      const result = await applyTransformations('img1', 'w_400,h_300');
      expect(result.success).toBe(true);
      expect(result.url).toContain('w_400,h_300');
    });

    test('applyTransformations builds URL from array', async () => {
      const result = await applyTransformations('img1', ['w_400', 'h_300']);
      expect(result.success).toBe(true);
      expect(result.url).toContain('w_400,h_300');
    });

    test('generateResponsiveUrls returns multiple sizes', () => {
      const result = generateResponsiveUrls('img1');
      expect(result.success).toBe(true);
      expect(result.urls).toHaveProperty('w400');
      expect(result.urls).toHaveProperty('w800');
      expect(result.urls).toHaveProperty('w1200');
      expect(result.urls).toHaveProperty('w1600');
      expect(result.urls.w400).toContain('w_400');
    });
  });
});
