// Image Bank Routes
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, existsSync } from 'fs';
import { parseIntSafe } from '../../shared/utils/validation.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAnthropicClient } from '../../shared/ai/claude-client.js';
import { withTimeout } from '../shared/fetchWithTimeout.js';
import { circuitBreaker } from '../shared/circuitBreaker.js';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { saveImage, deleteImage, getImageUrl, importFromInventory, validateImage, streamFromR2 } from '../services/imageStorage.js';
import { safeJsonParse } from '../shared/utils.js';


const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..', '..');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
import {
    uploadToCloudinary,
    removeBackground,
    autoEnhance,
    smartCrop,
    aiUpscale,
    applyTransformations,
    isCloudinaryConfigured
} from '../services/cloudinaryService.js';

async function optimizeImage(filePath) {
    try {
        const { default: sharp } = await import('sharp');
        const base = filePath.replace(/\.[^.]+$/, '');
        await sharp(filePath).webp({ quality: 85 }).toFile(base + '.webp');
        await sharp(filePath).resize(300, 300, { fit: 'cover' }).webp({ quality: 80 }).toFile(base + '_thumb.webp');
        return { webp: base + '.webp', thumb: base + '_thumb.webp' };
    } catch (err) {
        logger.warn('[ImageBank] Image optimization skipped', null, { reason: err.message });
        return null;
    }
}

export async function imageBankRouter(ctx) {
    const { method, path, user, body, query: queryParams } = ctx;

    // Reserved paths that should not be treated as image IDs
    const reservedPaths = ['/upload', '/bulk-delete', '/bulk-move', '/bulk-tag', '/search', '/analyze', '/folders', '/import-from-inventory', '/edit', '/cloudinary-status', '/cloudinary-edit', '/storage-stats', '/scan-usage'];

    // POST /api/image-bank/upload - Upload new images
    if (method === 'POST' && path === '/upload') {
        try {
            const { images, folderId, tags, title, description } = body;

            if (!images || !Array.isArray(images) || images.length === 0) {
                return { status: 400, data: { error: 'No images provided' } };
            }

            if (images.length > 20) {
                return { status: 400, data: { error: 'Maximum 20 images per upload' } };
            }

            // Enforce per-user storage quota (5GB)
            const storageStats = await query.get(
                'SELECT COALESCE(SUM(file_size), 0) as total_bytes FROM image_bank WHERE user_id = ?',
                [user.id]
            );
            const QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
            if (storageStats && storageStats.total_bytes >= QUOTA_BYTES) {
                return { status: 400, data: { error: 'Storage quota exceeded (5GB limit). Delete unused images to free space.' } };
            }

            const uploadedImages = [];

            const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

            for (const imageData of images) {
                // Enforce MIME type allowlist before processing
                const declaredMimeType = imageData.mimeType || 'image/jpeg';
                if (!ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
                    return { status: 400, data: { error: `Unsupported image type: ${declaredMimeType}. Allowed types: JPEG, PNG, GIF, WebP.` } };
                }

                // Validate image size
                const validation = await validateImage({
                    type: declaredMimeType,
                    size: Buffer.byteLength(imageData.data || imageData, 'base64')
                });

                if (!validation.valid) {
                    const httpStatus = validation.reason === 'size' ? 413
                        : validation.reason === 'mime' ? 415
                        : 400;
                    return { status: httpStatus, data: { error: validation.error } };
                }

                // Save to filesystem (also validates magic bytes internally)
                const savedImage = await saveImage(
                    imageData.data || imageData,
                    user.id,
                    imageData.filename || `upload_${Date.now()}.jpg`,
                    declaredMimeType
                );

                // Save to database
                const imageId = uuidv4();
                try {
                    await query.run(`
                        INSERT INTO image_bank (
                            id, user_id, folder_id, original_filename, stored_filename,
                            file_path, file_size, mime_type, title, description, tags
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        imageId,
                        user.id,
                        folderId || null,
                        savedImage.original_filename,
                        savedImage.stored_filename,
                        savedImage.file_path,
                        savedImage.file_size,
                        savedImage.mime_type,
                        title || null,
                        description || null,
                        JSON.stringify(tags || [])
                    ]);
                } catch (dbError) {
                    try { const fs = await import('fs'); fs.unlinkSync(savedImage.file_path); } catch (cleanupErr) {
                        logger.error('[ImageBank] Failed to clean up file after DB error', user?.id, { detail: cleanupErr?.message });
                    }
                    throw dbError;
                }

                const optimized = await optimizeImage(savedImage.file_path);
                if (optimized) {
                    await query.run(
                        'UPDATE image_bank SET webp_path = $1, thumbnail_path = $2 WHERE id = $3',
                        [optimized.webp, optimized.thumb, imageId]
                    );
                }

                uploadedImages.push({ id: imageId, url: `/api/image-bank/${imageId}/file` });
            }

            return { status: 200, data: { images: uploadedImages, count: uploadedImages.length } };
        } catch (error) {
            logger.error('[ImageBank] Upload error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to upload images' } };
        }
    }

    // GET /api/image-bank - List images with filters
    if (method === 'GET' && (path === '' || path === '/')) {
        const { folderId, tags, dateFrom, dateTo, used, limit = 50, offset = 0 } = queryParams;

        let sql = 'SELECT * FROM image_bank WHERE user_id = ?';
        const params = [user.id];

        // Apply filters
        if (folderId) {
            sql += ' AND folder_id = ?';
            params.push(folderId);
        }

        if (dateFrom) {
            sql += ' AND created_at >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ' AND created_at <= ?';
            params.push(dateTo);
        }

        if (used === 'true') {
            sql += ' AND used_count > 0';
        } else if (used === 'false') {
            sql += ' AND used_count = 0';
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseIntSafe(limit, { min: 1, max: 200, fallback: 50 }), parseIntSafe(offset, { min: 0, fallback: 0 }));

        const images = await query.all(sql, params);

        // Parse JSON fields
        images.forEach(img => {
            img.tags = safeJsonParse(img.tags, []);
            img.ai_analysis = safeJsonParse(img.ai_analysis, {});
        });

        // Get total count
        let countSql = 'SELECT COUNT(*) as count FROM image_bank WHERE user_id = ?';
        const countParams = [user.id];
        if (folderId) {
            countSql += ' AND folder_id = ?';
            countParams.push(folderId);
        }
        const { count } = await query.get(countSql, countParams);

        return { status: 200, data: { images, total: count, limit: parseInt(limit), offset: parseInt(offset) } };
    }

    // GET /api/image-bank/:id/file - Serve image binary
    if (method === 'GET' && path.match(/^\/[a-zA-Z0-9_-]+\/file$/)) {
        const imageId = path.slice(1, -5); // strip leading / and trailing /file
        const image = await query.get(
            'SELECT id, file_path, mime_type FROM image_bank WHERE id = ?',
            [imageId]
        );
        if (!image) return { status: 404, data: { error: 'Image not found' } };

        // R2 path: no leading slash (e.g. "images/userId/filename.jpg") → proxy through server
        if (!image.file_path.startsWith('/')) {
            const { body, contentType } = await streamFromR2(image.file_path, image.mime_type || 'image/jpeg');
            return {
                isStream: true,
                body,
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=86400',
                    'Content-Length': String(body.byteLength)
                }
            };
        }

        // Local path: leading slash (e.g. "/uploads/images/original/userId/filename.jpg")
        const absolutePath = join(ROOT_DIR, 'public', image.file_path);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (!existsSync(absolutePath)) {
            return { status: 404, data: { error: 'Image file not found on disk' } };
        }

        const fileBuffer = readFileSync(absolutePath);
        return {
            isStream: true,
            body: fileBuffer,
            headers: {
                'Content-Type': image.mime_type || 'image/jpeg',
                'Cache-Control': 'public, max-age=86400',
                'Content-Length': String(fileBuffer.byteLength)
            }
        };
    }

    // GET /api/image-bank/:id - Get single image details
    if (method === 'GET' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !reservedPaths.includes(path) && !path.startsWith('/usage/') && !path.startsWith('/edit-history/') && !path.startsWith('/folders/')) {
        const imageId = path.substring(1);
        const image = await query.get('SELECT * FROM image_bank WHERE id = ? AND user_id = ?', [imageId, user.id]);

        if (!image) {
            return { status: 404, data: { error: 'Image not found' } };
        }

        // Parse JSON fields
        image.tags = safeJsonParse(image.tags, []);
        image.ai_analysis = safeJsonParse(image.ai_analysis, {});

        // Get usage information
        const usage = await query.all(
            'SELECT inventory_id FROM image_bank_usage WHERE image_id = ?',
            [imageId]
        );
        image.used_in = usage.map(u => u.inventory_id);

        return { status: 200, data: image };
    }

    // PATCH /api/image-bank/:id - Update image metadata
    if (method === 'PATCH' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !reservedPaths.includes(path) && !path.startsWith('/folders/')) {
        const imageId = path.substring(1);
        const { title, description, tags, folderId } = body;

        // Verify ownership
        const existing = await query.get('SELECT id FROM image_bank WHERE id = ? AND user_id = ?', [imageId, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Image not found' } };
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (tags !== undefined) {
            updates.push('tags = ?');
            params.push(JSON.stringify(tags));
        }
        if (folderId !== undefined) {
            updates.push('folder_id = ?');
            params.push(folderId);
        }

        if (updates.length === 0) {
            return { status: 400, data: { error: 'No updates provided' } };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(imageId, user.id);

        await query.run(
            `UPDATE image_bank SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
            params
        );

        return { status: 200, data: { message: 'Image updated successfully' } };
    }

    // DELETE /api/image-bank/:id - Delete image
    if (method === 'DELETE' && path.match(/^\/[a-zA-Z0-9_-]+$/) && !reservedPaths.includes(path) && !path.startsWith('/folders/')) {
        const imageId = path.substring(1);
        const result = await deleteImage(imageId, user.id);

        if (!result.success) {
            return { status: 404, data: { error: result.error || 'Image not found' } };
        }

        return { status: 200, data: { message: 'Image deleted successfully' } };
    }

    // POST /api/image-bank/bulk-delete - Delete multiple images
    if (method === 'POST' && path === '/bulk-delete') {
        const { imageIds } = body;

        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return { status: 400, data: { error: 'No image IDs provided' } };
        }

        if (imageIds.length > 100) {
            return { status: 400, data: { error: 'Too many images (max 100 per bulk operation)' } };
        }

        let successCount = 0;
        let failCount = 0;

        for (const imageId of imageIds) {
            const result = await deleteImage(imageId, user.id);
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        return { status: 200, data: { deleted: successCount, failed: failCount } };
    }

    // POST /api/image-bank/bulk-move - Move images to folder
    if (method === 'POST' && path === '/bulk-move') {
        const { imageIds, folderId } = body;

        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return { status: 400, data: { error: 'No image IDs provided' } };
        }

        if (imageIds.length > 100) {
            return { status: 400, data: { error: 'Too many images (max 100 per bulk operation)' } };
        }

        const placeholders = imageIds.map(() => '?').join(',');
        await query.run(
            `UPDATE image_bank SET folder_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id IN (${placeholders}) AND user_id = ?`,
            [folderId || null, ...imageIds, user.id]
        );

        return { status: 200, data: { message: 'Images moved successfully', count: imageIds.length } };
    }

    // POST /api/image-bank/bulk-tag - Add tags to multiple images
    if (method === 'POST' && path === '/bulk-tag') {
        const { imageIds, tags } = body;

        if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
            return { status: 400, data: { error: 'No image IDs provided' } };
        }

        if (imageIds.length > 100) {
            return { status: 400, data: { error: 'Too many images (max 100 per bulk operation)' } };
        }

        if (!tags || !Array.isArray(tags) || tags.length === 0) {
            return { status: 400, data: { error: 'No tags provided' } };
        }

        // Batch fetch all images instead of N+1 individual queries
        const placeholders = imageIds.map(() => '?').join(',');
        const images = await query.all(
            `SELECT id, tags FROM image_bank WHERE id IN (${placeholders}) AND user_id = ?`,
            [...imageIds, user.id]
        );
        const imageMap = new Map(images.map(img => [img.id, img]));

        for (const imageId of imageIds) {
            const image = imageMap.get(imageId);
            if (image) {
                let existingTags = safeJsonParse(image.tags, []);

                // Merge tags (avoid duplicates)
                const mergedTags = [...new Set([...existingTags, ...tags])];

                await query.run(
                    'UPDATE image_bank SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    [JSON.stringify(mergedTags), imageId, user.id]
                );
            }
        }

        return { status: 200, data: { message: 'Tags added successfully', count: imageIds.length } };
    }

    // GET /api/image-bank/search - Full-text search
    if (method === 'GET' && path === '/search') {
        const { q, limit = 50 } = queryParams;

        if (!q || q.trim().length === 0) {
            return { status: 400, data: { error: 'Search query required' } };
        }

        if (q.length > 500) {
            return { status: 400, data: { error: 'Search query too long (max 500 characters)' } };
        }

        // Sanitize search query for FTS5 (strip quotes, operators, special chars)
        const sanitizedQuery = q.replace(/['"*(){}[\]^~\\]/g, '').replace(/\b(AND|OR|NOT|NEAR)\b/gi, '');

        const images = await query.all(`
            SELECT ib.* FROM image_bank ib
            WHERE ib.search_vector @@ plainto_tsquery('english', ?) AND ib.user_id = ?
            ORDER BY ts_rank(ib.search_vector, plainto_tsquery('english', ?)) DESC
            LIMIT ?
        `, [sanitizedQuery, user.id, sanitizedQuery, parseInt(limit)]);

        // Parse JSON fields
        images.forEach(img => {
            img.tags = safeJsonParse(img.tags, []);
            img.ai_analysis = safeJsonParse(img.ai_analysis, {});
        });

        return { status: 200, data: { images, count: images.length } };
    }

    // POST /api/image-bank/analyze - AI analyze image with Claude Vision
    if (method === 'POST' && path === '/analyze') {
        const { imageId } = body;

        const image = await query.get('SELECT * FROM image_bank WHERE id = ? AND user_id = ?', [imageId, user.id]);
        if (!image) {
            return { status: 404, data: { error: 'Image not found' } };
        }

        const apiKey = process.env.VAULTLISTER_IMAGE_ANALYZER || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return { status: 200, data: { imageId, analysis: null, message: 'AI analysis requires ANTHROPIC_API_KEY to be configured' } };
        }

        const absolutePath = join(ROOT_DIR, 'public', image.file_path);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        let imageBase64;
        try {
            imageBase64 = readFileSync(absolutePath).toString('base64');
        } catch {
            // File not on disk (demo data or deleted) — return graceful response
            return { status: 200, data: { imageId, analysis: null, message: 'Image file not available for analysis' } };
        }

        const mimeType = image.mime_type || 'image/jpeg';

        const prompt = `You are analyzing a product photo for a reseller listing. Return a JSON object with this exact shape:
{
  "brand": "detected brand name or null",
  "category": "clothing|shoes|accessories|electronics|collectibles|home|other",
  "subcategory": "more specific type (e.g. jacket, sneakers, mug)",
  "condition": "new|like_new|good|fair|poor",
  "colors": ["primary color", "secondary color if any"],
  "materials": ["material if detectable"],
  "suggestedTags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "suggestedTitle": "concise listing title (under 80 chars)",
  "suggestedDescription": "2-3 sentence listing description highlighting key features",
  "photoQuality": { "score": 1-10, "issues": ["issue if any"], "suggestions": ["improvement"] }
}

Be specific and accurate. Only include what you can confidently detect from the image.`;

        try {
            const anthropic = getAnthropicClient(apiKey);
            const response = await circuitBreaker('anthropic-imagebank-analyze', () =>
                withTimeout(anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1000,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
                            { type: 'text', text: prompt }
                        ]
                    }]
                }), 45000, 'ImageBank AI analysis'),
                { failureThreshold: 3, cooldownMs: 60000 }
            );

            const responseText = response.content[0].text;
            let analysis;
            try {
                analysis = JSON.parse(responseText);
            } catch {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        analysis = JSON.parse(jsonMatch[0]);
                    } catch {
                        analysis = null;
                    }
                } else {
                    analysis = null;
                }
            }

            if (!analysis) {
                return { status: 500, data: { error: 'AI returned unparseable response' } };
            }

            // Persist analysis and merge suggested tags into image tags
            const existingTags = safeJsonParse(image.tags || '[]', []);
            const mergedTags = [...new Set([...existingTags, ...(analysis.suggestedTags || [])])];

            await query.run(
                `UPDATE image_bank SET ai_analysis = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [JSON.stringify(analysis), JSON.stringify(mergedTags), imageId]
            );

            logger.info('[ImageBank] AI analysis complete', user.id, { imageId });
            return { status: 200, data: { imageId, analysis, tags: mergedTags, aiProvider: 'claude-sonnet-4' } };

        } catch (err) {
            logger.error('[ImageBank] Claude Vision API error', user.id, { detail: err.message });
            return { status: 200, data: { imageId, analysis: null, message: 'AI analysis unavailable', detail: err.message } };
        }
    }

    // POST /api/image-bank/folders - Create folder
    if (method === 'POST' && path === '/folders') {
        const { name, parentId, color, icon } = body;

        if (!name || name.trim().length === 0) {
            return { status: 400, data: { error: 'Folder name required' } };
        }

        const folderId = uuidv4();
        await query.run(`
            INSERT INTO image_bank_folders (id, user_id, name, parent_id, color, icon)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [folderId, user.id, name.trim(), parentId || null, color || '#f59e0b', icon || 'folder']);

        return { status: 201, data: { folder: { id: folderId, name, parentId, color, icon } } };
    }

    // GET /api/image-bank/folders - List folders (tree structure)
    if (method === 'GET' && path === '/folders') {
        const folders = await query.all(
            'SELECT * FROM image_bank_folders WHERE user_id = ? ORDER BY name ASC LIMIT 1000',
            [user.id]
        );

        // Build tree structure
        const folderMap = {};
        const rootFolders = [];

        folders.forEach(folder => {
            folderMap[folder.id] = { ...folder, children: [] };
        });

        folders.forEach(folder => {
            if (folder.parent_id && folderMap[folder.parent_id]) {
                folderMap[folder.parent_id].children.push(folderMap[folder.id]);
            } else {
                rootFolders.push(folderMap[folder.id]);
            }
        });

        return { status: 200, data: { folders: rootFolders } };
    }

    // PATCH /api/image-bank/folders/:id - Update folder
    if (method === 'PATCH' && path.startsWith('/folders/')) {
        const folderId = path.substring('/folders/'.length);
        const { name, color, icon, parentId } = body;

        const existing = await query.get('SELECT id FROM image_bank_folders WHERE id = ? AND user_id = ?', [folderId, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Folder not found' } };
        }

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name);
        }
        if (color !== undefined) {
            updates.push('color = ?');
            params.push(color);
        }
        if (icon !== undefined) {
            updates.push('icon = ?');
            params.push(icon);
        }
        if (parentId !== undefined) {
            updates.push('parent_id = ?');
            params.push(parentId);
        }

        if (updates.length === 0) {
            return { status: 400, data: { error: 'No updates provided' } };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(folderId, user.id);

        await query.run(
            `UPDATE image_bank_folders SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
            params
        );

        // Return updated folder data
        const updatedFolder = await query.get('SELECT * FROM image_bank_folders WHERE id = ? AND user_id = ?', [folderId, user.id]);
        return { status: 200, data: { folder: updatedFolder } };
    }

    // DELETE /api/image-bank/folders/:id - Delete folder
    if (method === 'DELETE' && path.startsWith('/folders/')) {
        const folderId = path.substring('/folders/'.length);

        const existing = await query.get('SELECT id FROM image_bank_folders WHERE id = ? AND user_id = ?', [folderId, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Folder not found' } };
        }

        // Move images in this folder to root (folder_id = NULL)
        await query.run('UPDATE image_bank SET folder_id = NULL WHERE folder_id = ? AND user_id = ?', [folderId, user.id]);

        // Delete folder
        await query.run('DELETE FROM image_bank_folders WHERE id = ? AND user_id = ?', [folderId, user.id]);

        return { status: 200, data: { message: 'Folder deleted successfully' } };
    }

    // POST /api/image-bank/import-from-inventory - Import existing inventory images
    if (method === 'POST' && path === '/import-from-inventory') {
        const { inventoryId } = body;

        if (!inventoryId) {
            return { status: 400, data: { error: 'Inventory ID required' } };
        }

        const result = await importFromInventory(inventoryId, user.id);

        if (!result.success) {
            return { status: 400, data: { error: result.error } };
        }

        return { status: 200, data: {
            message: 'Images imported successfully',
            importedCount: result.importedCount,
            imageIds: result.imageIds
        } };
    }

    // GET /api/image-bank/usage/:imageId - Get items using this image
    if (method === 'GET' && path.startsWith('/usage/')) {
        const imageId = path.substring('/usage/'.length);

        const image = await query.get('SELECT id FROM image_bank WHERE id = ? AND user_id = ?', [imageId, user.id]);
        if (!image) {
            return { status: 404, data: { error: 'Image not found' } };
        }

        const usage = await query.all(`
            SELECT u.inventory_id, i.title
            FROM image_bank_usage u
            JOIN inventory i ON u.inventory_id = i.id
            WHERE u.image_id = ? AND i.user_id = ?
        `, [imageId, user.id]);

        return { status: 200, data: { usage, count: usage.length } };
    }

    // POST /api/image-bank/edit - Apply Canvas edits
    if (method === 'POST' && path === '/edit') {
        const { imageId, editType, parameters } = body;

        const image = await query.get('SELECT * FROM image_bank WHERE id = ? AND user_id = ?', [imageId, user.id]);
        if (!image) {
            return { status: 404, data: { error: 'Image not found' } };
        }

        // TECH-DEBT: Implement Canvas-based editing (crop, rotate, filters)
        // For now, save edit history
        const editId = uuidv4();
        await query.run(`
            INSERT INTO image_edit_history (id, image_id, user_id, edit_type, parameters, original_path, edited_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [editId, imageId, user.id, editType, JSON.stringify(parameters), image.file_path, image.file_path]);

        return { status: 200, data: { message: 'Edit saved', editId } };
    }

    // GET /api/image-bank/cloudinary-status - Check if Cloudinary is configured
    if (method === 'GET' && path === '/cloudinary-status') {
        const configured = isCloudinaryConfigured();
        return {
            status: 200,
            data: {
                configured,
                cloudName: configured ? process.env.CLOUDINARY_CLOUD_NAME : null
            }
        };
    }

    // POST /api/image-bank/cloudinary-edit - Advanced edits with Cloudinary
    if (method === 'POST' && path === '/cloudinary-edit') {
        const { imageId, operation, params } = body;

        // Check Cloudinary configuration
        if (!isCloudinaryConfigured()) {
            return {
                status: 400,
                data: {
                    error: 'Cloudinary not configured',
                    message: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables'
                }
            };
        }

        // Validate imageId
        if (!imageId) {
            return { status: 400, data: { error: 'Image ID required' } };
        }

        const image = await query.get('SELECT * FROM image_bank WHERE id = ? AND user_id = ?', [imageId, user.id]);
        if (!image) {
            return { status: 404, data: { error: 'Image not found' } };
        }

        let publicId = image.cloudinary_public_id;
        let result;

        try {
            // If image not on Cloudinary yet, upload it first
            if (!publicId && operation !== 'upload') {
                const uploadResult = await uploadToCloudinary(image.file_path, user.id, imageId);
                if (!uploadResult.success) {
                    return { status: 500, data: { error: uploadResult.error || 'Failed to upload to Cloudinary' } };
                }
                publicId = uploadResult.publicId;

                // Save public ID to database
                await query.run(
                    'UPDATE image_bank SET cloudinary_public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                    [publicId, imageId, user.id]
                );
            }

            // Apply the requested operation
            switch (operation) {
                case 'upload':
                    // Just upload without transformation
                    if (!publicId) {
                        const uploadResult = await uploadToCloudinary(image.file_path, user.id, imageId);
                        if (!uploadResult.success) {
                            return { status: 500, data: { error: uploadResult.error || 'Failed to upload to Cloudinary' } };
                        }
                        publicId = uploadResult.publicId;
                        await query.run(
                            'UPDATE image_bank SET cloudinary_public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
                            [publicId, imageId, user.id]
                        );
                    }
                    result = { success: true, publicId, url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}` };
                    break;

                case 'remove-background':
                    result = await removeBackground(publicId);
                    break;

                case 'enhance':
                    result = await autoEnhance(publicId);
                    break;

                case 'smart-crop':
                    const { width = 800, height = 800 } = params || {};
                    result = await smartCrop(publicId, width, height);
                    break;

                case 'upscale':
                    result = await aiUpscale(publicId);
                    break;

                case 'apply-all':
                    // Apply multiple transformations at once
                    const transformations = [];
                    const { removeBackground: removeBg, enhance: doEnhance, upscale: doUpscale, cropWidth, cropHeight } = params || {};

                    if (removeBg) transformations.push('e_background_removal');
                    if (doEnhance) transformations.push('e_improve', 'e_auto_contrast', 'e_auto_brightness');
                    if (doUpscale) transformations.push('e_upscale');
                    if (cropWidth && cropHeight) {
                        const w = parseInt(cropWidth);
                        const h = parseInt(cropHeight);
                        if (!w || !h || w < 1 || h < 1 || w > 10000 || h > 10000) {
                            return { status: 400, data: { error: 'Invalid crop dimensions (1-10000)' } };
                        }
                        transformations.push(`c_fill,g_auto,w_${w},h_${h}`);
                    }

                    if (transformations.length === 0) {
                        result = { success: true, url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}`, publicId };
                    } else {
                        result = await applyTransformations(publicId, transformations.join('/'));
                    }
                    break;

                default:
                    return { status: 400, data: { error: `Unknown operation: ${operation}` } };
            }

            if (!result.success) {
                return { status: 500, data: { error: result.error || 'Transformation failed' } };
            }

            // Log to edit history
            const editId = uuidv4();
            await query.run(`
                INSERT INTO image_edit_history (id, image_id, user_id, edit_type, parameters, original_path, edited_path, cloudinary_public_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [editId, imageId, user.id, `cloudinary_${operation}`, JSON.stringify(params || {}), image.file_path, result.url, publicId]);

            return {
                status: 200,
                data: {
                    success: true,
                    imageId,
                    publicId,
                    operation,
                    url: result.url,
                    editId
                }
            };
        } catch (error) {
            logger.error('[ImageBank] Cloudinary operation error', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Cloudinary operation failed' } };
        }
    }

    // GET /api/image-bank/edit-history/:id - Get edit history
    if (method === 'GET' && path.startsWith('/edit-history/')) {
        const imageId = path.substring('/edit-history/'.length);

        const history = await query.all(
            'SELECT * FROM image_edit_history WHERE image_id = ? AND user_id = ? ORDER BY created_at DESC',
            [imageId, user.id]
        );

        history.forEach(edit => {
            edit.parameters = safeJsonParse(edit.parameters, {});
        });

        return { status: 200, data: { history, count: history.length } };
    }

    // GET /api/image-bank/storage-stats - Real storage usage stats
    if (method === 'GET' && path === '/storage-stats') {
        try {
            const stats = await query.get(`
                SELECT
                    COUNT(*) as total_images,
                    COALESCE(SUM(file_size), 0) as total_bytes,
                    COUNT(CASE WHEN used_count > 0 THEN 1 END) as used_images
                FROM image_bank
                WHERE user_id = ?
            `, [user.id]);

            const quotaBytes = 5 * 1024 * 1024 * 1024; // 5GB
            return {
                status: 200,
                data: {
                    total_bytes: stats.total_bytes,
                    quota_bytes: quotaBytes,
                    total_images: stats.total_images,
                    used_images: stats.used_images,
                    percent_used: stats.total_bytes > 0 ? ((stats.total_bytes / quotaBytes) * 100).toFixed(2) : '0.00'
                }
            };
        } catch (error) {
            logger.error('[ImageBank] Error fetching storage stats', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch storage stats' } };
        }
    }

    // POST /api/image-bank/scan-usage - Scan inventory for image references
    if (method === 'POST' && path === '/scan-usage') {
        try {
            // Get all user images
            const images = await query.all(
                'SELECT id, file_path, original_filename FROM image_bank WHERE user_id = ? LIMIT 10000',
                [user.id]
            );

            // Get all inventory items with images
            const inventoryItems = await query.all(
                "SELECT id, title, images FROM inventory WHERE user_id = ? AND images IS NOT NULL AND images != '[]' LIMIT 10000",
                [user.id]
            );

            let updatedCount = 0;

            // Clear existing usage records for this user
            await query.run(`
                DELETE FROM image_bank_usage WHERE image_id IN (
                    SELECT id FROM image_bank WHERE user_id = ?
                )
            `, [user.id]);

            // Scan each inventory item's images for matches
            for (const item of inventoryItems) {
                let itemImages = [];
                try {
                    itemImages = JSON.parse(item.images);
                } catch (e) {
                    continue;
                }

                for (const img of images) {
                    const isUsed = itemImages.some(invImg => {
                        const invPath = typeof invImg === 'string' ? invImg : (invImg.url || invImg.path || '');
                        return invPath.includes(img.file_path) || invPath.includes(img.original_filename);
                    });

                    if (isUsed) {
                        await query.run(
                            'INSERT INTO image_bank_usage (image_id, inventory_id) VALUES (?, ?)',
                            [img.id, item.id]
                        );
                    }
                }
            }

            // Update used_count for all images
            await query.run(`
                UPDATE image_bank SET used_count = (
                    SELECT COUNT(*) FROM image_bank_usage WHERE image_bank_usage.image_id = image_bank.id
                ), updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            `, [user.id]);

            updatedCount = images.length;

            return {
                status: 200,
                data: {
                    message: 'Usage scan complete',
                    images_scanned: images.length,
                    inventory_items_checked: inventoryItems.length,
                    updated: updatedCount
                }
            };
        } catch (error) {
            logger.error('[ImageBank] Error scanning image usage', user?.id, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to scan image usage' } };
        }
    }

    return { status: 404, data: { error: 'Not found' } };
}
