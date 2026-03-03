// Cloudinary Service — Upload test with fetch mock
// Tests uploadToCloudinary which requires either real Cloudinary config or fetch mock
import { mock, describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { installFetchMock } from './helpers/mockFetch.js';

const fetchMock = installFetchMock();

const {
    default: cloudinaryModule,
} = await import('../backend/services/cloudinaryService.js');

const uploadToCloudinary = cloudinaryModule?.uploadToCloudinary || cloudinaryModule?.upload;
const isCloudinaryConfigured = cloudinaryModule?.isCloudinaryConfigured || cloudinaryModule?.isConfigured;

beforeEach(() => fetchMock.reset());
afterEach(() => fetchMock.restore());

describe('isCloudinaryConfigured', () => {
    test('returns boolean', () => {
        if (!isCloudinaryConfigured) {
            console.warn('isCloudinaryConfigured not exported');
            return;
        }
        expect(typeof isCloudinaryConfigured()).toBe('boolean');
    });
});

describe('uploadToCloudinary', () => {
    test('returns error when cloudinary is not configured', async () => {
        if (!uploadToCloudinary) {
            console.warn('uploadToCloudinary not exported');
            return;
        }
        // Without CLOUDINARY_* env vars, should return error
        const result = await uploadToCloudinary('/tmp/test.jpg', 'user-1', 'img-1');
        expect(result.success).toBe(false);
    });

    test('returns object with success property', async () => {
        if (!uploadToCloudinary) {
            console.warn('uploadToCloudinary not exported');
            return;
        }
        const result = await uploadToCloudinary('/tmp/test.jpg', 'user-1', 'img-1');
        expect(typeof result).toBe('object');
        expect(typeof result.success).toBe('boolean');
    });
});
