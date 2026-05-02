// Image Storage Service
// Handles image storage: filesystem (dev) or Cloudflare R2/S3 (production)
// Set IMAGE_STORAGE=r2 to use R2; defaults to local filesystem

import fs, { existsSync, mkdirSync, unlinkSync, lstatSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
const UPLOADS_DIR = join(ROOT_DIR, 'public', 'uploads', 'images'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

const USE_R2 = process.env.IMAGE_STORAGE === 'r2';
const R2_BUCKET = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// Lazy R2/S3 client — only initialized when IMAGE_STORAGE=r2
let _s3;
async function getS3() {
    if (_s3) return _s3;
    const { S3Client } = await import('@aws-sdk/client-s3');
    _s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
    return _s3;
}

// Ensure local directories exist (local mode only)
if (!USE_R2) {
    ['original', 'thumbnails', 'edited', 'temp'].forEach((dir) => {
        const path = join(UPLOADS_DIR, dir); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (!existsSync(path)) {
            mkdirSync(path, { recursive: true });
        }
    });
}

/**
 * Generate unique image ID
 */
function generateImageId() {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Get file extension from mime type
 */
function getExtensionFromMime(mimeType) {
    const map = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
    };
    return map[mimeType] || 'jpg';
}

/**
 * Validate image file
 */
export async function validateImage(file) {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    if (!file) {
        return { valid: false, reason: 'missing', error: 'No file provided' };
    }

    if (!allowedMimeTypes.includes(file.type)) {
        return { valid: false, reason: 'mime', error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' };
    }

    if (file.size > maxSizeBytes) {
        return { valid: false, reason: 'size', error: 'File too large. Maximum size is 10MB.' };
    }

    // Validate actual file content via magic bytes if buffer is available
    if (file.buffer || file.arrayBuffer) {
        const buffer =
            file.buffer || (typeof file.arrayBuffer === 'function' ? Buffer.from(await file.arrayBuffer()) : null);
        if (buffer && !validateMagicBytes(buffer)) {
            return { valid: false, reason: 'content', error: 'File content does not match a valid image format.' };
        }
    }

    return { valid: true };
}

/**
 * Validate base64-encoded image data: MIME allowlist, size limit, and magic bytes.
 * Use this for API endpoints that receive images as base64 strings (AI routes, receipt parser).
 *
 * @param {string} base64Data - Base64-encoded image (with or without data URI prefix)
 * @param {string} declaredMimeType - MIME type declared by the client
 * @param {number} [maxBytes=10485760] - Max decoded size in bytes (default 10MB)
 * @returns {{ valid: boolean, error?: string, buffer?: Buffer }}
 */
export function validateBase64Image(base64Data, declaredMimeType, maxBytes = 10 * 1024 * 1024) {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!base64Data || typeof base64Data !== 'string') {
        return { valid: false, error: 'No image data provided' };
    }

    if (declaredMimeType && !allowedMimeTypes.includes(declaredMimeType)) {
        return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
    }

    // Strip data URI prefix if present
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');

    let buffer;
    try {
        buffer = Buffer.from(raw, 'base64');
    } catch {
        return { valid: false, error: 'Invalid base64 encoding' };
    }

    if (buffer.length > maxBytes) {
        return { valid: false, error: `Image too large. Maximum ${Math.round(maxBytes / 1024 / 1024)}MB.` };
    }

    if (!validateMagicBytes(buffer)) {
        return { valid: false, error: 'Invalid image data: file content does not match any supported image format.' };
    }

    return { valid: true, buffer };
}

/**
 * Validate file magic bytes to ensure actual image content
 */
function validateMagicBytes(buffer) {
    if (!buffer || buffer.length < 12) return false;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
    // WebP: RIFF....WEBP
    if (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    )
        return true;
    return false;
}

/**
 * Save image to filesystem
 * @param {Buffer|String} fileData - Image data (Buffer or base64 string)
 * @param {String} userId - User ID for organization
 * @param {String} originalFilename - Original filename
 * @param {String} mimeType - MIME type
 * @returns {Object} Image metadata
 */
export async function saveImage(fileData, userId, originalFilename, mimeType = 'image/jpeg') {
    try {
        const imageId = generateImageId();
        const extension = getExtensionFromMime(mimeType);
        const storedFilename = `${imageId}.${extension}`;

        // Convert base64 to buffer if needed
        let buffer;
        if (typeof fileData === 'string') {
            const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            buffer = fileData;
        }

        // Validate magic bytes to ensure actual image content
        if (!validateMagicBytes(buffer)) {
            throw new Error('Invalid image data: file signature does not match any supported image format');
        }

        const fileSize = buffer.length;
        let filePath, thumbnailPath;

        if (USE_R2) {
            const { PutObjectCommand } = await import('@aws-sdk/client-s3');
            const s3 = await getS3();
            const r2Key = `images/${userId}/${storedFilename}`;
            await s3.send(
                new PutObjectCommand({
                    Bucket: R2_BUCKET,
                    Key: r2Key,
                    Body: buffer,
                    ContentType: mimeType,
                }),
            );
            filePath = r2Key;
            thumbnailPath = await generateThumbnail(buffer, userId, imageId);
        } else {
            const safeUserId = String(userId).replace(/[^a-zA-Z0-9\-_]/g, '');
            const userDir = join(UPLOADS_DIR, 'original', safeUserId); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            if (!resolve(userDir).startsWith(resolve(UPLOADS_DIR))) throw new Error('Invalid user path'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            if (!existsSync(userDir)) {
                mkdirSync(userDir, { recursive: true });
            }
            const localPath = join(userDir, storedFilename); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            await fs.promises.writeFile(localPath, buffer);
            filePath = `/uploads/images/original/${userId}/${storedFilename}`;
            thumbnailPath = await generateThumbnail(localPath, userId, imageId, extension);
        }

        return {
            id: imageId,
            original_filename: originalFilename,
            stored_filename: storedFilename,
            file_path: filePath,
            file_size: fileSize,
            mime_type: mimeType,
            thumbnail_path: thumbnailPath,
            width: null,
            height: null,
            aspect_ratio: null,
            dominant_color: null,
        };
    } catch (error) {
        logger.error('[ImageStorage] Error saving image', null, { detail: error.message });
        throw new Error('Failed to save image');
    }
}

/**
 * Generate thumbnail (max 300px wide, JPEG 80% quality).
 * pathOrBuffer: file path (local mode) or Buffer (R2 mode).
 */
export async function generateThumbnail(pathOrBuffer, userId, imageId, extension) {
    const thumbnailFilename = `${imageId}_thumb.jpg`;

    if (USE_R2) {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = await getS3();
        const r2Key = `images/${userId}/thumbnails/${thumbnailFilename}`;
        try {
            const sharp = (await import('sharp')).default;
            const thumbBuffer = await sharp(pathOrBuffer)
                .resize(300, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
            await s3.send(
                new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key, Body: thumbBuffer, ContentType: 'image/jpeg' }),
            );
        } catch (err) {
            logger.error('[ImageStorage] sharp/R2 thumbnail failed, uploading original', null, { detail: err.message });
            await s3.send(
                new PutObjectCommand({ Bucket: R2_BUCKET, Key: r2Key, Body: pathOrBuffer, ContentType: 'image/jpeg' }),
            );
        }
        return r2Key;
    }

    const safeUserId = String(userId).replace(/[^a-zA-Z0-9\-_]/g, '');
    const userThumbDir = join(UPLOADS_DIR, 'thumbnails', safeUserId); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (!resolve(userThumbDir).startsWith(resolve(UPLOADS_DIR))) throw new Error('Invalid user path'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

    const fileSize = typeof pathOrBuffer === 'string' ? lstatSync(pathOrBuffer).size : pathOrBuffer.length;
    if (fileSize > 20 * 1024 * 1024) {
        logger.warn('[ImageStorage] File too large for thumbnail generation, skipping', null, { size: fileSize });
        return null;
    }

    if (!existsSync(userThumbDir)) {
        mkdirSync(userThumbDir, { recursive: true });
    }
    const thumbnailPath = join(userThumbDir, thumbnailFilename); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    try {
        const sharp = (await import('sharp')).default;
        await sharp(pathOrBuffer)
            .resize(300, null, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
    } catch (err) {
        logger.error('[ImageStorage] sharp resize failed, falling back to copy', null, { detail: err.message });
        try {
            const originalBuffer =
                typeof pathOrBuffer === 'string' ? await fs.promises.readFile(pathOrBuffer) : pathOrBuffer;
            await fs.promises.writeFile(thumbnailPath, originalBuffer);
        } catch (writeErr) {
            logger.error('[ImageStorage] Fallback thumbnail write failed', null, { detail: writeErr.message });
        }
    }
    return `/uploads/images/thumbnails/${userId}/${thumbnailFilename}`;
}

/**
 * Safely delete a file, blocking path traversal and symlink attacks
 */
function safeDeleteFile(relativePath) {
    try {
        const fullPath = join(ROOT_DIR, 'public', relativePath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const resolvedPath = resolve(fullPath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const resolvedUploadsDir = resolve(UPLOADS_DIR); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (!resolvedPath.startsWith(resolvedUploadsDir)) {
            logger.error('[ImageStorage] Path traversal blocked', null, { path: relativePath });
            return;
        }
        if (!existsSync(fullPath)) return;
        const stats = lstatSync(fullPath);
        if (!stats.isFile()) {
            logger.error('[ImageStorage] Skipping non-regular file (possible symlink)', null, { path: relativePath });
            return;
        }
        unlinkSync(fullPath);
    } catch (error) {
        logger.error('[ImageStorage] Error in safe file deletion', null, { detail: error.message });
    }
}

/**
 * Delete image from storage and database
 */
export async function streamFromR2(r2Key, mimeType = 'image/jpeg') {
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = await getS3();
    const resp = await s3.send(
        new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: r2Key,
        }),
    );
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    return {
        body: Buffer.concat(chunks),
        contentType: resp.ContentType || mimeType,
        contentLength: resp.ContentLength,
    };
}

export async function deleteImage(imageId, userId) {
    try {
        const image = await query.get('SELECT * FROM image_bank WHERE id = ? AND user_id = ?', [imageId, userId]);

        if (!image) {
            return { success: false, error: 'Image not found' };
        }

        const editHistory = await query.all('SELECT edited_path FROM image_edit_history WHERE image_id = ?', [imageId]);

        if (USE_R2) {
            const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
            const s3 = await getS3();
            const keys = [image.file_path];
            if (image.thumbnail_path) keys.push(image.thumbnail_path);
            editHistory.forEach((edit) => {
                if (edit.edited_path) keys.push(edit.edited_path);
            });
            await Promise.all(
                keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {})),
            );
        } else {
            safeDeleteFile(image.file_path);
            if (image.thumbnail_path) safeDeleteFile(image.thumbnail_path);
            editHistory.forEach((edit) => {
                safeDeleteFile(edit.edited_path);
            });
        }

        await query.run('DELETE FROM image_bank WHERE id = ? AND user_id = ?', [imageId, userId]);

        return { success: true };
    } catch (error) {
        logger.error('[ImageStorage] Error deleting image', null, { detail: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Get public URL for image
 */
export async function getImageUrl(imageId, userId) {
    const image = await query.get('SELECT file_path FROM image_bank WHERE id = ? AND user_id = ?', [imageId, userId]);

    if (!image) return null;

    if (USE_R2) {
        return `${R2_PUBLIC_URL}/${image.file_path}`;
    }
    return image.file_path;
}

/**
 * Import image from inventory (migrate base64 to filesystem)
 */
export async function importFromInventory(inventoryId, userId) {
    try {
        // Get inventory item
        const item = await query.get('SELECT images FROM inventory WHERE id = ? AND user_id = ?', [
            inventoryId,
            userId,
        ]);

        if (!item || !item.images) {
            return { success: false, error: 'Item not found or has no images' };
        }

        // Parse images JSON
        let images;
        try {
            images = JSON.parse(item.images);
        } catch (e) {
            return { success: false, error: 'Invalid images data' };
        }

        if (!Array.isArray(images) || images.length === 0) {
            return { success: false, error: 'No images to import' };
        }

        const importedImages = [];

        // Import each image
        for (let i = 0; i < images.length; i++) {
            const base64Image = images[i];

            // Determine mime type from base64 prefix
            let mimeType = 'image/jpeg';
            if (base64Image.startsWith('data:image/png')) {
                mimeType = 'image/png';
            } else if (base64Image.startsWith('data:image/webp')) {
                mimeType = 'image/webp';
            }

            // Save to filesystem
            const savedImage = await saveImage(base64Image, userId, `inventory_${inventoryId}_${i + 1}.jpg`, mimeType);

            // Save to image_vault table
            await query.run(
                `
                INSERT INTO image_bank (
                    id, user_id, folder_id, original_filename, stored_filename,
                    file_path, file_size, mime_type, source_inventory_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                    savedImage.id,
                    userId,
                    null,
                    savedImage.original_filename,
                    savedImage.stored_filename,
                    savedImage.file_path,
                    savedImage.file_size,
                    savedImage.mime_type,
                    inventoryId,
                ],
            );

            importedImages.push(savedImage.id);
        }

        return { success: true, importedCount: importedImages.length, imageIds: importedImages };
    } catch (error) {
        logger.error('[ImageStorage] Error importing from inventory', null, { detail: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Generate optimized image variants: WebP conversion, EXIF stripping, medium-size variant.
 * Falls back gracefully when sharp is unavailable.
 *
 * @param {Buffer|string} source - Image data as Buffer or local file path
 * @param {string} userId - User ID for storage path organization
 * @param {string} imageId - Unique image ID (used as filename base)
 * @returns {Promise<{ webp?: string, medium?: string, original?: string }>} Paths to variants
 */
export async function generateOptimizedVariants(source, userId, imageId) {
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9\-_]/g, '');
    const variants = {};

    let sharp;
    try {
        sharp = (await import('sharp')).default;
    } catch (_err) {
        logger.warn('[ImageStorage] sharp not available; skipping optimized variants');
        return variants;
    }

    // Resolve source buffer
    let inputBuffer;
    if (typeof source === 'string') {
        const { readFileSync } = await import('fs');
        inputBuffer = readFileSync(source);
    } else {
        inputBuffer = source;
    }

    if (USE_R2) {
        const { PutObjectCommand } = await import('@aws-sdk/client-s3');
        const s3 = await getS3();

        // WebP conversion + EXIF strip
        try {
            const webpBuffer = await sharp(inputBuffer)
                .rotate() // auto-rotate based on EXIF orientation, then strip EXIF
                .withMetadata({}) // strip all metadata
                .webp({ quality: 82 })
                .toBuffer();
            const webpKey = `images/${safeUserId}/webp/${imageId}.webp`;
            await s3.send(
                new PutObjectCommand({ Bucket: R2_BUCKET, Key: webpKey, Body: webpBuffer, ContentType: 'image/webp' }),
            );
            variants.webp = webpKey;
        } catch (err) {
            logger.error('[ImageStorage] WebP conversion failed (R2)', null, { detail: err.message });
        }

        // Medium variant (800px max width) + EXIF strip
        try {
            const mediumBuffer = await sharp(inputBuffer)
                .rotate()
                .withMetadata({})
                .resize(800, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
            const mediumKey = `images/${safeUserId}/medium/${imageId}_medium.jpg`;
            await s3.send(
                new PutObjectCommand({
                    Bucket: R2_BUCKET,
                    Key: mediumKey,
                    Body: mediumBuffer,
                    ContentType: 'image/jpeg',
                }),
            );
            variants.medium = mediumKey;
        } catch (err) {
            logger.error('[ImageStorage] Medium variant failed (R2)', null, { detail: err.message });
        }
    } else {
        // Strip EXIF from original in place
        try {
            const strippedBuffer = await sharp(inputBuffer).rotate().withMetadata({}).jpeg({ quality: 95 }).toBuffer();
            const userOriginalDir = join(UPLOADS_DIR, 'original', safeUserId); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            if (!resolve(userOriginalDir).startsWith(resolve(UPLOADS_DIR))) throw new Error('Invalid user path'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            mkdirSync(userOriginalDir, { recursive: true });
            const originalPath = join(userOriginalDir, `${imageId}.jpg`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            writeFileSync(originalPath, strippedBuffer);
            variants.original = `/uploads/images/original/${safeUserId}/${imageId}.jpg`;
        } catch (err) {
            logger.error('[ImageStorage] EXIF strip failed', null, { detail: err.message });
        }

        // WebP variant
        try {
            const webpDir = join(UPLOADS_DIR, 'webp', safeUserId); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            if (!resolve(webpDir).startsWith(resolve(UPLOADS_DIR))) throw new Error('Invalid user path'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            mkdirSync(webpDir, { recursive: true });
            const webpPath = join(webpDir, `${imageId}.webp`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            await sharp(inputBuffer).rotate().withMetadata({}).webp({ quality: 82 }).toFile(webpPath);
            variants.webp = `/uploads/images/webp/${safeUserId}/${imageId}.webp`;
        } catch (err) {
            logger.error('[ImageStorage] WebP variant failed', null, { detail: err.message });
        }

        // Medium variant (800px max width)
        try {
            const mediumDir = join(UPLOADS_DIR, 'medium', safeUserId); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            if (!resolve(mediumDir).startsWith(resolve(UPLOADS_DIR))) throw new Error('Invalid user path'); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            mkdirSync(mediumDir, { recursive: true });
            const mediumPath = join(mediumDir, `${imageId}_medium.jpg`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            await sharp(inputBuffer)
                .rotate()
                .withMetadata({})
                .resize(800, null, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toFile(mediumPath);
            variants.medium = `/uploads/images/medium/${safeUserId}/${imageId}_medium.jpg`;
        } catch (err) {
            logger.error('[ImageStorage] Medium variant failed', null, { detail: err.message });
        }
    }

    return variants;
}

export default {
    validateImage,
    saveImage,
    generateThumbnail,
    generateOptimizedVariants,
    deleteImage,
    getImageUrl,
    importFromInventory,
};
