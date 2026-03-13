// Tests for file upload validation (REM-18: file upload abuse prevention)
import { describe, expect, test } from 'bun:test';
import { validateBase64Image } from '../backend/services/imageStorage.js';

// Valid minimal image magic bytes encoded as base64
const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]).toString('base64');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]).toString('base64');
const WEBP_MAGIC = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).toString('base64');
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x00, 0x00, 0x00, 0x00]).toString('base64');
const EXE_MAGIC = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).toString('base64');

describe('validateBase64Image', () => {
    test('rejects null/undefined/empty input', () => {
        expect(validateBase64Image(null, 'image/jpeg').valid).toBe(false);
        expect(validateBase64Image(undefined, 'image/jpeg').valid).toBe(false);
        expect(validateBase64Image('', 'image/jpeg').valid).toBe(false);
    });

    test('rejects non-string input', () => {
        expect(validateBase64Image(123, 'image/jpeg').valid).toBe(false);
    });

    test('rejects disallowed MIME types', () => {
        const result = validateBase64Image(JPEG_MAGIC, 'application/pdf');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid file type');
    });

    test('rejects text/html MIME type', () => {
        expect(validateBase64Image(JPEG_MAGIC, 'text/html').valid).toBe(false);
    });

    test('rejects application/javascript MIME type', () => {
        expect(validateBase64Image(JPEG_MAGIC, 'application/javascript').valid).toBe(false);
    });

    test('accepts valid JPEG magic bytes with image/jpeg MIME', () => {
        const result = validateBase64Image(JPEG_MAGIC, 'image/jpeg');
        expect(result.valid).toBe(true);
        expect(result.buffer).toBeDefined();
    });

    test('accepts valid PNG magic bytes with image/png MIME', () => {
        const result = validateBase64Image(PNG_MAGIC, 'image/png');
        expect(result.valid).toBe(true);
    });

    test('accepts valid WebP magic bytes with image/webp MIME', () => {
        const result = validateBase64Image(WEBP_MAGIC, 'image/webp');
        expect(result.valid).toBe(true);
    });

    test('rejects PDF magic bytes even with image/jpeg MIME', () => {
        const result = validateBase64Image(PDF_MAGIC, 'image/jpeg');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('file content does not match');
    });

    test('rejects EXE magic bytes even with image/png MIME', () => {
        const result = validateBase64Image(EXE_MAGIC, 'image/png');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('file content does not match');
    });

    test('rejects oversized images', () => {
        // Create a valid JPEG header + padding that exceeds 1KB limit
        const header = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
        const padding = Buffer.alloc(2000);
        const oversized = Buffer.concat([header, padding]).toString('base64');
        const result = validateBase64Image(oversized, 'image/jpeg', 1024);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('too large');
    });

    test('accepts images within custom size limit', () => {
        const result = validateBase64Image(JPEG_MAGIC, 'image/jpeg', 1024 * 1024);
        expect(result.valid).toBe(true);
    });

    test('strips data URI prefix before validation', () => {
        const dataUri = `data:image/jpeg;base64,${JPEG_MAGIC}`;
        const result = validateBase64Image(dataUri, 'image/jpeg');
        expect(result.valid).toBe(true);
    });

    test('accepts null MIME type (skips MIME check, still validates magic bytes)', () => {
        const result = validateBase64Image(JPEG_MAGIC, null);
        expect(result.valid).toBe(true);
    });

    test('rejects data too short to have valid magic bytes', () => {
        const tiny = Buffer.from([0xFF, 0xD8]).toString('base64');
        const result = validateBase64Image(tiny, 'image/jpeg');
        expect(result.valid).toBe(false);
    });
});
