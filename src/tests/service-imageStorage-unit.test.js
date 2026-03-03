import { describe, expect, test, mock, beforeEach } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock();
const mockQueryRun = mock();

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  default: {}
}));

const { validateImage, getImageUrl, deleteImage } = await import('../backend/services/imageStorage.js');

describe('imageStorage', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryRun.mockReset();
  });

  describe('validateImage', () => {
    test('accepts JPEG', () => {
      expect(validateImage({ type: 'image/jpeg', size: 1024 })).toEqual({ valid: true });
    });

    test('accepts PNG', () => {
      expect(validateImage({ type: 'image/png', size: 2048 })).toEqual({ valid: true });
    });

    test('accepts WebP', () => {
      expect(validateImage({ type: 'image/webp', size: 512 })).toEqual({ valid: true });
    });

    test('rejects GIF', () => {
      const result = validateImage({ type: 'image/gif', size: 1024 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    test('rejects file exceeding 10MB', () => {
      const result = validateImage({ type: 'image/jpeg', size: 11 * 1024 * 1024 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });

    test('rejects null file', () => {
      expect(validateImage(null).valid).toBe(false);
    });

    test('rejects undefined file', () => {
      expect(validateImage(undefined).valid).toBe(false);
    });
  });

  describe('getImageUrl', () => {
    test('returns file_path when image exists', () => {
      mockQueryGet.mockReturnValueOnce({ file_path: '/uploads/images/original/user1/abc.jpg' });
      expect(getImageUrl('abc', 'user1')).toBe('/uploads/images/original/user1/abc.jpg');
    });

    test('returns null when image not found', () => {
      mockQueryGet.mockReturnValueOnce(null);
      expect(getImageUrl('nonexistent', 'user1')).toBeNull();
    });
  });

  describe('deleteImage', () => {
    test('returns error when image not found', async () => {
      mockQueryGet.mockReturnValueOnce(null);
      const result = await deleteImage('nonexistent', 'user1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Image not found');
    });
  });
});
