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

import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logger } from '../../shared/logger.js';

const TEMP_DIR = join(tmpdir(), 'vaultlister-img-upload');

// Ensure temp dir exists on first use
function ensureTempDir() {
    if (!existsSync(TEMP_DIR)) {
        mkdirSync(TEMP_DIR, { recursive: true });
    }
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
                    files.push(downloaded);
                    tempFiles.push(downloaded);
                }
            } else {
                // Local file path — normalize for the current OS
                const localPath = img.replace(/\\/g, '/');
                if (existsSync(localPath)) {
                    files.push(localPath);
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
async function downloadToTemp(url) {
    ensureTempDir();

    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const fileExt = allowedExts.includes(ext) ? ext : 'jpg';
    const filename = `img-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const destPath = join(TEMP_DIR, filename);

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
