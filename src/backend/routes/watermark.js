// Watermark Routes
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

export async function watermarkRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // GET /api/watermark/presets - List user's watermark presets
    if (method === 'GET' && path === '/presets') {
        try {
            const presets = query.all(
                `SELECT * FROM watermark_presets
                WHERE user_id = ?
                ORDER BY is_default DESC, name`,
                [user.id]
            );

            return { status: 200, data: presets };
        } catch (error) {
            logger.error('[Watermark] Get presets error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to load watermark presets' } };
        }
    }

    // POST /api/watermark/presets - Create watermark preset
    if (method === 'POST' && path === '/presets') {
        try {
            const { name, type, content, position, opacity, size, rotation, color } = body;

            if (!name || !name.trim()) {
                return { status: 400, data: { error: 'Preset name required' } };
            }

            if (!type) {
                return { status: 400, data: { error: 'Watermark type required' } };
            }

            const validTypes = ['text', 'image', 'logo'];
            if (!validTypes.includes(type)) {
                return { status: 400, data: { error: `Invalid type. Must be: ${validTypes.join(', ')}` } };
            }

            if (!content) {
                return { status: 400, data: { error: 'Content required (text or image URL)' } };
            }

            // Validate URL format for image/logo types
            if ((type === 'image' || type === 'logo') && content) {
                try {
                    const url = new URL(content);
                    if (!['http:', 'https:'].includes(url.protocol)) {
                        return { status: 400, data: { error: 'Image URL must use http or https' } };
                    }
                    if (content.length > 2048) {
                        return { status: 400, data: { error: 'URL exceeds maximum length (2048)' } };
                    }
                } catch {
                    return { status: 400, data: { error: 'Invalid image URL format' } };
                }
            }

            // Validate position
            const validPositions = ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'];
            const presetPosition = position || 'bottom-right';
            if (!validPositions.includes(presetPosition)) {
                return { status: 400, data: { error: `Invalid position. Must be: ${validPositions.join(', ')}` } };
            }

            // Validate opacity (0-100)
            const presetOpacity = opacity !== undefined ? opacity : 50;
            if (presetOpacity < 0 || presetOpacity > 100) {
                return { status: 400, data: { error: 'Opacity must be between 0 and 100' } };
            }

            // Validate size (1-200)
            const presetSize = size || 20;
            if (presetSize < 1 || presetSize > 200) {
                return { status: 400, data: { error: 'Size must be between 1 and 200' } };
            }

            // Validate rotation (-180 to 180)
            const presetRotation = rotation || 0;
            if (presetRotation < -180 || presetRotation > 180) {
                return { status: 400, data: { error: 'Rotation must be between -180 and 180 degrees' } };
            }

            const id = uuidv4();

            query.run(
                `INSERT INTO watermark_presets
                (id, user_id, name, type, content, position, opacity, size, rotation, color, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, user.id, name.trim(), type, content, presetPosition, presetOpacity, presetSize, presetRotation, color || null, false]
            );

            const preset = query.get('SELECT * FROM watermark_presets WHERE id = ?', [id]);

            return { status: 201, data: preset };
        } catch (error) {
            logger.error('[Watermark] Create preset error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to create watermark preset' } };
        }
    }

    // PUT /api/watermark/presets/:id - Update preset
    if (method === 'PUT' && path.match(/^\/presets\/[a-f0-9-]+$/)) {
        try {
            const presetId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM watermark_presets WHERE id = ? AND user_id = ?',
                [presetId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            const { name, type, content, position, opacity, size, rotation, color } = body;
            const updates = [];
            const values = [];

            if (name !== undefined) {
                if (!name.trim()) {
                    return { status: 400, data: { error: 'Preset name cannot be empty' } };
                }
                updates.push('name = ?');
                values.push(name.trim());
            }

            if (type !== undefined) {
                const validTypes = ['text', 'image', 'logo'];
                if (!validTypes.includes(type)) {
                    return { status: 400, data: { error: `Invalid type. Must be: ${validTypes.join(', ')}` } };
                }
                updates.push('type = ?');
                values.push(type);
            }

            if (content !== undefined) {
                updates.push('content = ?');
                values.push(content);
            }

            if (position !== undefined) {
                const validPositions = ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'];
                if (!validPositions.includes(position)) {
                    return { status: 400, data: { error: `Invalid position. Must be: ${validPositions.join(', ')}` } };
                }
                updates.push('position = ?');
                values.push(position);
            }

            if (opacity !== undefined) {
                if (opacity < 0 || opacity > 100) {
                    return { status: 400, data: { error: 'Opacity must be between 0 and 100' } };
                }
                updates.push('opacity = ?');
                values.push(opacity);
            }

            if (size !== undefined) {
                if (size < 1 || size > 200) {
                    return { status: 400, data: { error: 'Size must be between 1 and 200' } };
                }
                updates.push('size = ?');
                values.push(size);
            }

            if (rotation !== undefined) {
                if (rotation < -180 || rotation > 180) {
                    return { status: 400, data: { error: 'Rotation must be between -180 and 180 degrees' } };
                }
                updates.push('rotation = ?');
                values.push(rotation);
            }

            if (color !== undefined) {
                updates.push('color = ?');
                values.push(color);
            }

            if (updates.length === 0) {
                return { status: 400, data: { error: 'No fields to update' } };
            }

            values.push(presetId);

            query.run(
                `UPDATE watermark_presets SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            const updated = query.get('SELECT * FROM watermark_presets WHERE id = ?', [presetId]);

            return { status: 200, data: updated };
        } catch (error) {
            logger.error('[Watermark] Update preset error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to update preset' } };
        }
    }

    // DELETE /api/watermark/presets/:id - Delete preset
    if (method === 'DELETE' && path.match(/^\/presets\/[a-f0-9-]+$/)) {
        try {
            const presetId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM watermark_presets WHERE id = ? AND user_id = ?',
                [presetId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            if (existing.is_default) {
                return { status: 409, data: { error: 'Cannot delete default preset. Set another preset as default first.' } };
            }

            query.run('DELETE FROM watermark_presets WHERE id = ? AND user_id = ?', [presetId, user.id]);

            return { status: 200, data: { message: 'Preset deleted successfully' } };
        } catch (error) {
            logger.error('[Watermark] Delete preset error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to delete preset' } };
        }
    }

    // POST /api/watermark/presets/:id/set-default - Set as default watermark
    if (method === 'POST' && path.match(/^\/presets\/[a-f0-9-]+\/set-default$/)) {
        try {
            const presetId = path.split('/')[2];

            const existing = query.get(
                'SELECT * FROM watermark_presets WHERE id = ? AND user_id = ?',
                [presetId, user.id]
            );

            if (!existing) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            // Use transaction to ensure atomicity
            await query.transaction(async (tx) => {
                await tx.run('UPDATE watermark_presets SET is_default = 0 WHERE user_id = ?', [user.id]);
                await tx.run('UPDATE watermark_presets SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [presetId, user.id]);
            });

            const updated = query.get('SELECT * FROM watermark_presets WHERE id = ? AND user_id = ?', [presetId, user.id]);

            return { status: 200, data: updated };
        } catch (error) {
            logger.error('[Watermark] Set default error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to set default preset' } };
        }
    }

    // POST /api/watermark/apply-batch - Apply watermark to batch of images
    if (method === 'POST' && path === '/apply-batch') {
        try {
            const { preset_id, image_ids } = body;

            if (!preset_id) {
                return { status: 400, data: { error: 'preset_id required' } };
            }

            if (!Array.isArray(image_ids) || image_ids.length === 0) {
                return { status: 400, data: { error: 'image_ids array required' } };
            }

            // Verify preset exists
            const preset = query.get(
                'SELECT * FROM watermark_presets WHERE id = ? AND user_id = ?',
                [preset_id, user.id]
            );

            if (!preset) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            let processed = 0;
            let failed = 0;
            const errors = [];

            // Process each image
            for (const imageId of image_ids) {
                try {
                    // Verify image belongs to user
                    const image = query.get(
                        'SELECT id FROM image_bank WHERE id = ? AND user_id = ?',
                        [imageId, user.id]
                    );

                    if (!image) {
                        failed++;
                        errors.push({ image_id: imageId, error: 'Image not found' });
                        continue;
                    }

                    // Mark as watermarked (actual watermark application happens client-side or worker)
                    query.run(
                        `UPDATE image_bank
                        SET watermarked = 1, watermark_preset_id = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?`,
                        [preset_id, imageId]
                    );

                    processed++;
                } catch (err) {
                    logger.error('[Watermark] Error processing watermark', null, { detail: err?.message || 'Unknown error' });
                    failed++;
                    errors.push({ image_id: imageId, error: 'Failed to process image' });
                }
            }

            return {
                status: 200,
                data: {
                    message: 'Batch watermark applied',
                    processed,
                    failed,
                    total: image_ids.length,
                    errors: errors.length > 0 ? errors : undefined
                }
            };
        } catch (error) {
            logger.error('[Watermark] Apply batch error', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to apply batch watermark' } };
        }
    }

    return { status: 404, data: { error: 'Watermark endpoint not found' } };
}
