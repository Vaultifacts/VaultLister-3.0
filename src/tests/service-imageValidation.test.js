// Image Storage — validateImage Unit Tests (pure function, no filesystem needed)
import { describe, expect, test } from 'bun:test';
import { validateImage } from '../backend/services/imageStorage.js';

describe('validateImage', () => {
    test('returns invalid for null file', () => {
        const result = validateImage(null);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('No file');
    });

    test('returns invalid for undefined file', () => {
        const result = validateImage(undefined);
        expect(result.valid).toBe(false);
    });

    test('accepts image/jpeg', () => {
        const result = validateImage({ type: 'image/jpeg', size: 1024 });
        expect(result.valid).toBe(true);
    });

    test('accepts image/jpg', () => {
        const result = validateImage({ type: 'image/jpg', size: 1024 });
        expect(result.valid).toBe(true);
    });

    test('accepts image/png', () => {
        const result = validateImage({ type: 'image/png', size: 5000 });
        expect(result.valid).toBe(true);
    });

    test('accepts image/webp', () => {
        const result = validateImage({ type: 'image/webp', size: 2000 });
        expect(result.valid).toBe(true);
    });

    test('rejects image/gif', () => {
        const result = validateImage({ type: 'image/gif', size: 1024 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid file type');
    });

    test('rejects application/pdf', () => {
        const result = validateImage({ type: 'application/pdf', size: 1024 });
        expect(result.valid).toBe(false);
    });

    test('rejects file over 10MB', () => {
        const over10MB = 10 * 1024 * 1024 + 1;
        const result = validateImage({ type: 'image/jpeg', size: over10MB });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('too large');
    });

    test('accepts file exactly at 10MB limit', () => {
        const exactly10MB = 10 * 1024 * 1024;
        const result = validateImage({ type: 'image/jpeg', size: exactly10MB });
        expect(result.valid).toBe(true);
    });

    test('accepts very small file', () => {
        const result = validateImage({ type: 'image/png', size: 1 });
        expect(result.valid).toBe(true);
    });
});
