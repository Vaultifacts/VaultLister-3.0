// Image Storage Service
// Handles filesystem storage for Image Bank

import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync, lstatSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');
const UPLOADS_DIR = join(ROOT_DIR, 'public', 'uploads', 'images');

// Ensure directories exist
['original', 'thumbnails', 'edited', 'temp'].forEach(dir => {
    const path = join(UPLOADS_DIR, dir);
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
});

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
        'image/gif': 'gif'
    };
    return map[mimeType] || 'jpg';
}

/**
 * Validate image file
 */
export function validateImage(file) {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    if (!file) {
        return { valid: false, error: 'No file provided' };
    }

    if (!allowedMimeTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
    }

    if (file.size > maxSizeBytes) {
        return { valid: false, error: 'File too large. Maximum size is 10MB.' };
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
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // WebP: RIFF....WEBP
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true;
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

        // Create user directory if it doesn't exist
        const userDir = join(UPLOADS_DIR, 'original', userId);
        if (!existsSync(userDir)) {
            mkdirSync(userDir, { recursive: true });
        }

        const filePath = join(userDir, storedFilename);

        // Convert base64 to buffer if needed
        let buffer;
        if (typeof fileData === 'string') {
            // Remove data URL prefix if present
            const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            buffer = fileData;
        }

        // Validate magic bytes to ensure actual image content
        if (!validateMagicBytes(buffer)) {
            throw new Error('Invalid image data: file signature does not match any supported image format');
        }

        // Write file
        writeFileSync(filePath, buffer);

        // Get file size and dimensions (basic info)
        const fileSize = buffer.length;

        // Generate thumbnail
        const thumbnailPath = await generateThumbnail(filePath, userId, imageId, extension);

        return {
            id: imageId,
            original_filename: originalFilename,
            stored_filename: storedFilename,
            file_path: `/uploads/images/original/${userId}/${storedFilename}`,
            file_size: fileSize,
            mime_type: mimeType,
            thumbnail_path: thumbnailPath,
            width: null, // Would need image library to get actual dimensions
            height: null,
            aspect_ratio: null,
            dominant_color: null
        };
    } catch (error) {
        logger.error('[ImageStorage] Error saving image', null, { detail: error.message });
        throw new Error('Failed to save image');
    }
}

/**
 * Generate thumbnail (max 300px wide, JPEG 80% quality)
 */
export async function generateThumbnail(originalPath, userId, imageId, extension) {
    const userThumbDir = join(UPLOADS_DIR, 'thumbnails', userId);
    if (!existsSync(userThumbDir)) {
        mkdirSync(userThumbDir, { recursive: true });
    }

    const thumbnailFilename = `${imageId}_thumb.jpg`;
    const thumbnailPath = join(userThumbDir, thumbnailFilename);

    try {
        const sharp = (await import('sharp')).default;
        await sharp(originalPath)
            .resize(300, null, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
    } catch (err) {
        logger.error('[ImageStorage] sharp resize failed, falling back to copy', null, { detail: err.message });
        const originalBuffer = readFileSync(originalPath);
        writeFileSync(thumbnailPath, originalBuffer);
    }

    return `/uploads/images/thumbnails/${userId}/${thumbnailFilename}`;
}

/**
 * Safely delete a file, blocking path traversal and symlink attacks
 */
function safeDeleteFile(relativePath) {
    try {
        const fullPath = join(ROOT_DIR, 'public', relativePath);
        const resolvedPath = resolve(fullPath);
        const resolvedUploadsDir = resolve(UPLOADS_DIR);
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
 * Delete image from filesystem and database
 */
export async function deleteImage(imageId, userId) {
    try {
        // Get image metadata from database
        const image = await query.get(
            'SELECT * FROM image_bank WHERE id = ? AND user_id = ?',
            [imageId, userId]
        );

        if (!image) {
            return { success: false, error: 'Image not found' };
        }

        // Delete original file (with path traversal + symlink protection)
        safeDeleteFile(image.file_path);

        // Delete thumbnail if exists
        if (image.thumbnail_path) {
            safeDeleteFile(image.thumbnail_path);
        }

        // Delete edited versions from edit history
        const editHistory = await query.all(
            'SELECT edited_path FROM image_edit_history WHERE image_id = ?',
            [imageId]
        );

        editHistory.forEach(edit => {
            safeDeleteFile(edit.edited_path);
        });

        // Delete from database
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
export function getImageUrl(imageId, userId) {
    const image = await query.get(
        'SELECT file_path FROM image_bank WHERE id = ? AND user_id = ?',
        [imageId, userId]
    );

    if (!image) {
        return null;
    }

    return image.file_path;
}

/**
 * Import image from inventory (migrate base64 to filesystem)
 */
export async function importFromInventory(inventoryId, userId) {
    try {
        // Get inventory item
        const item = await query.get(
            'SELECT images FROM inventory WHERE id = ? AND user_id = ?',
            [inventoryId, userId]
        );

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
            const savedImage = await saveImage(
                base64Image,
                userId,
                `inventory_${inventoryId}_${i + 1}.jpg`,
                mimeType
            );

            // Save to image_bank table
            await query.run(`
                INSERT INTO image_bank (
                    id, user_id, folder_id, original_filename, stored_filename,
                    file_path, file_size, mime_type, source_inventory_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                savedImage.id,
                userId,
                null,
                savedImage.original_filename,
                savedImage.stored_filename,
                savedImage.file_path,
                savedImage.file_size,
                savedImage.mime_type,
                inventoryId
            ]);

            importedImages.push(savedImage.id);
        }

        return { success: true, importedCount: importedImages.length, imageIds: importedImages };
    } catch (error) {
        logger.error('[ImageStorage] Error importing from inventory', null, { detail: error.message });
        return { success: false, error: error.message };
    }
}

export default {
    validateImage,
    saveImage,
    generateThumbnail,
    deleteImage,
    getImageUrl,
    importFromInventory
};
