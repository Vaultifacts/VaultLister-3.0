import { describe, test, expect, beforeEach } from 'bun:test';
import { computeFileHash, checkImageDuplicate, recordImageHash, scanImages } from '../backend/services/platformSync/imageHasher.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const HASH_DB_PATH = path.join(process.cwd(), 'data', '.image-hash-db.json');

// Create temp test images
function createTempImage(content = 'test-image-data') {
    const tmpDir = os.tmpdir();
    const name = `test-img-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
    const fp = path.join(tmpDir, name);
    fs.writeFileSync(fp, content);
    return fp;
}

describe('Image Hasher', () => {
    beforeEach(() => {
        // Clean hash DB before each test
        try { fs.unlinkSync(HASH_DB_PATH); } catch {}
    });

    test('should compute consistent file hash', () => {
        const fp = createTempImage('identical-content');
        const hash1 = computeFileHash(fp);
        const hash2 = computeFileHash(fp);
        expect(hash1).toBe(hash2);
        expect(hash1.length).toBe(64); // SHA-256 hex
        fs.unlinkSync(fp);
    });

    test('should detect no duplicate for new image', () => {
        const fp = createTempImage('unique-image-1');
        const result = checkImageDuplicate(fp, 'profile-1');
        expect(result.isDuplicate).toBe(false);
        expect(result.match).toBeNull();
        fs.unlinkSync(fp);
    });

    test('should detect same-account duplicate after recording', () => {
        const fp = createTempImage('duplicate-image');
        recordImageHash(fp, { accountId: 'profile-1', platform: 'facebook', listingId: 'L1' });
        const result = checkImageDuplicate(fp, 'profile-1');
        expect(result.isDuplicate).toBe(true);
        expect(result.sameAccount).toBe(true);
        expect(result.message).toContain('already submitted by this account');
        fs.unlinkSync(fp);
    });

    test('should detect cross-account duplicate as CRITICAL', () => {
        const fp = createTempImage('shared-image');
        recordImageHash(fp, { accountId: 'profile-1', platform: 'facebook', listingId: 'L1' });
        const result = checkImageDuplicate(fp, 'profile-2');
        expect(result.isDuplicate).toBe(true);
        expect(result.sameAccount).toBe(false);
        expect(result.message).toContain('CRITICAL');
        fs.unlinkSync(fp);
    });

    test('scanImages should PASS for unique images', () => {
        const fp1 = createTempImage('img-a');
        const fp2 = createTempImage('img-b');
        const result = scanImages([fp1, fp2], 'profile-1');
        expect(result.status).toBe('PASS');
        expect(result.issues).toHaveLength(0);
        fs.unlinkSync(fp1);
        fs.unlinkSync(fp2);
    });

    test('scanImages should WARN for same-submission duplicates', () => {
        const fp1 = createTempImage('same-data');
        const fp2 = createTempImage('same-data');
        const result = scanImages([fp1, fp2], 'profile-1');
        expect(result.issues.some(i => i.includes('identical'))).toBe(true);
        fs.unlinkSync(fp1);
        fs.unlinkSync(fp2);
    });

    test('scanImages should BLOCK for cross-account reuse', () => {
        const fp = createTempImage('cross-account');
        recordImageHash(fp, { accountId: 'profile-1', platform: 'facebook', listingId: 'L1' });
        const result = scanImages([fp], 'profile-2');
        expect(result.status).toBe('BLOCK');
        expect(result.issues.some(i => i.includes('CRITICAL'))).toBe(true);
        fs.unlinkSync(fp);
    });
});
