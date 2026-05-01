// Cloudinary Service — Upload test with fetch mock
// Tests uploadToCloudinary which requires either real Cloudinary config or fetch mock
import { mock, describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { installFetchMock } from './helpers/mockFetch.js';

const fetchMock = installFetchMock();

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
    default: { info: mock(), error: mock(), warn: mock(), debug: mock() },
}));

const { default: cloudinaryModule } = await import('../backend/services/cloudinaryService.js');

const uploadToCloudinary = cloudinaryModule?.uploadToCloudinary || cloudinaryModule?.upload;
const isCloudinaryConfigured = cloudinaryModule?.isCloudinaryConfigured || cloudinaryModule?.isConfigured;

beforeEach(() => fetchMock.reset());
afterAll(() => fetchMock.restore());

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

    test('uploads R2 object keys as base64 data URIs', async () => {
        if (!uploadToCloudinary) {
            console.warn('uploadToCloudinary not exported');
            return;
        }

        const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const originalApiKey = process.env.CLOUDINARY_API_KEY;
        const originalApiSecret = process.env.CLOUDINARY_API_SECRET;
        const streamFromR2 = mock(async () => ({
            body: Buffer.from('r2-image'),
            contentType: 'image/avif',
        }));

        fetchMock.respondWith({
            data: {
                public_id: 'vaultlister/user-1/img-1',
                secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/vaultlister/user-1/img-1',
                width: 100,
                height: 80,
            },
        });

        try {
            process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
            process.env.CLOUDINARY_API_KEY = 'test-key';
            process.env.CLOUDINARY_API_SECRET = 'test-secret';

            const result = await uploadToCloudinary('r2/products/item.avif', 'user-1', 'img-1', { streamFromR2 });

            expect(result.success).toBe(true);
            expect(streamFromR2).toHaveBeenCalledWith('r2/products/item.avif', 'image/avif');
            const uploadBody = fetchMock.spy.mock.calls[0][1].body;
            expect(uploadBody.get('file')).toBe(`data:image/avif;base64,${Buffer.from('r2-image').toString('base64')}`);
            expect(uploadBody.get('public_id')).toBe('vaultlister/user-1/img-1');
        } finally {
            if (originalCloudName) process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
            else delete process.env.CLOUDINARY_CLOUD_NAME;
            if (originalApiKey) process.env.CLOUDINARY_API_KEY = originalApiKey;
            else delete process.env.CLOUDINARY_API_KEY;
            if (originalApiSecret) process.env.CLOUDINARY_API_SECRET = originalApiSecret;
            else delete process.env.CLOUDINARY_API_SECRET;
        }
    });
});
