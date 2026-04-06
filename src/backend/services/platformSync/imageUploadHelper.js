// Image Upload Helper for Playwright Publish Services
// Resolves an inventory.images JSON array into local file paths
// that Playwright's setInputFiles() can consume.
//
// Handles two formats that may appear in the images array:
//   - Local absolute paths (already on disk from Image Bank)
//   - HTTP(S) URLs (downloaded to a temp file)
//
// Usage:
//   import { resolveImageFiles, cleanupTempImages } from './imageUploadHelper.js';
//   const { files, tempFiles } = await resolveImageFiles(inventory.images, 10);
//   if (files.length > 0) {
//       await photoInput.setInputFiles(files);
//   }
//   await cleanupTempImages(tempFiles);

import { existsSync, writeFileSync, unlinkSync, mkdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../../shared/logger.js';
import sharp from 'sharp';

const TEMP_DIR = join(tmpdir(), 'vaultlister-img-upload');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

const COMPRESS_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — compress images above this size
const COMPRESS_MAX_PX    = 2000;             // max width/height after resize
const COMPRESS_QUALITY   = 85;               // JPEG quality for compressed output

// Ensure temp dir exists on first use
function ensureTempDir() {
    if (!existsSync(TEMP_DIR)) {
        mkdirSync(TEMP_DIR, { recursive: true });
    }
}

/**
 * Compress an image file if it exceeds COMPRESS_MAX_BYTES.
 * Resizes to max 2000px on the longest side and re-encodes as JPEG quality 85.
 * If compression is applied, the new temp file path is added to tempFiles for cleanup.
 * @param {string}   filePath  - Absolute path to the source image
 * @param {string[]} tempFiles - Mutable array; compressed temp file appended if created
 * @returns {Promise<string>} Path to use for upload (original or compressed)
 */
async function compressIfNeeded(filePath, tempFiles) {
    const stat = statSync(filePath);
    if (stat.size <= COMPRESS_MAX_BYTES) return filePath;
    ensureTempDir();
    const compressedPath = join(TEMP_DIR, `c-${randomUUID()}.jpg`);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    await sharp(filePath)
        .resize(COMPRESS_MAX_PX, COMPRESS_MAX_PX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: COMPRESS_QUALITY })
        .toFile(compressedPath);
    logger.info('[ImageUpload] Compressed image', { originalBytes: stat.size });
    tempFiles.push(compressedPath);
    return compressedPath;
}

/**
 * Resolve inventory image entries to absolute local file paths.
 * Downloads URL-based images to temp files as needed.
 *
 * @param {string|Array} rawImages - inventory.images (JSON string or already-parsed array)
 * @param {number} maxImages       - Max images to upload (default: 8)
 * @returns {{ files: string[], tempFiles: string[] }}
 *   files     - absolute paths ready for setInputFiles()
 *   tempFiles - temp file paths that must be cleaned up after upload
 */
export async function resolveImageFiles(rawImages, maxImages = 8) {
    let images;
    if (Array.isArray(rawImages)) {
        images = rawImages;
    } else {
        try { images = JSON.parse(rawImages || '[]'); } catch { images = []; }
    }

    if (!images.length) return { files: [], tempFiles: [] };

    const files = [];
    const tempFiles = [];

    for (const img of images.slice(0, maxImages)) {
        if (typeof img !== 'string' || !img) continue;

        try {
            if (img.startsWith('http://') || img.startsWith('https://')) {
                // Download to temp file
                const downloaded = await downloadToTemp(img);
                if (downloaded) {
                    tempFiles.push(downloaded); // register original for cleanup
                    files.push(await compressIfNeeded(downloaded, tempFiles));
                }
            } else {
                // Local file path — normalize for the current OS
                const localPath = img.replace(/\\/g, '/');
                if (existsSync(localPath)) {
                    files.push(await compressIfNeeded(localPath, tempFiles));
                } else {
                    logger.warn('[ImageUpload] Local image not found, skipping', { path: localPath });
                }
            }
        } catch (err) {
            logger.warn('[ImageUpload] Failed to resolve image, skipping', { img, error: err.message });
        }
    }

    return { files, tempFiles };
}

/**
 * Download a remote image URL to a temp file.
 * Returns the temp file path, or null on failure.
 * @param {string} url
 * @returns {string|null}
 */
function isPrivateUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        const hostname = parsed.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return true;
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
        if (hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) return true;
        if (hostname.endsWith('.local') || hostname.endsWith('.internal')) return true;
        return false;
    } catch { return true; }
}

async function downloadToTemp(url) {
    ensureTempDir();

    if (isPrivateUrl(url)) {
        logger.warn('[ImageUpload] Blocked private/internal URL', { url });
        return null;
    }

    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const fileExt = allowedExts.includes(ext) ? ext : 'jpg';
    const filename = `img-${randomUUID()}.${fileExt}`;
    const destPath = join(TEMP_DIR, filename);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

    const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 VaultLister/3.0 image-prefetch' },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        logger.warn('[ImageUpload] Failed to download image', { url, status: response.status });
        return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
        logger.warn('[ImageUpload] URL did not return an image', { url, contentType });
        return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destPath, buffer);
    return destPath;
}

/**
 * Delete temp files after upload completes (or fails).
 * @param {string[]} tempFiles
 */
export function cleanupTempImages(tempFiles) {
    for (const f of tempFiles) {
        try { unlinkSync(f); } catch {}
    }
}
