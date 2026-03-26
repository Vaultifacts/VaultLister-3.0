// src/backend/routes/batchPhoto.js - Batch Photo Processing API
// Enables batch Cloudinary transformations on multiple images

import { query } from '../db/database.js';
import {
    uploadToCloudinary,
    applyTransformations,
    isCloudinaryConfigured
} from '../services/cloudinaryService.js';
import { logger } from '../shared/logger.js';

// Helper: Generate UUID
function generateId() {
    return crypto.randomUUID();
}

// Helper: Get current timestamp
function now() {
    return new Date().toISOString();
}

// Helper: Build transformation string from options
function buildTransformationString(transformations) {
    const transforms = [];

    if (transformations.removeBackground) {
        transforms.push('e_background_removal');
    }
    if (transformations.enhance) {
        transforms.push('e_improve/e_auto_contrast/e_auto_brightness');
    }
    if (transformations.upscale) {
        transforms.push('e_upscale');
    }
    if (transformations.cropWidth && transformations.cropHeight) {
        const cw = parseInt(transformations.cropWidth);
        const ch = parseInt(transformations.cropHeight);
        if (cw > 0 && cw <= 10000 && ch > 0 && ch <= 10000) {
            transforms.push(`c_fill,g_auto,w_${cw},h_${ch}`);
        }
    }

    return transforms.join('/');
}

// Process a single image in a batch job
async function processJobItem(item, transformations, userId) {
    const startTime = Date.now();

    // Get image from database
    const image = await query.get('SELECT * FROM image_bank WHERE id = ? AND user_id = ?', [item.image_id, userId]);
    if (!image) {
        throw new Error('Image not found');
    }

    // Upload to Cloudinary if needed
    let publicId = image.cloudinary_public_id;
    if (!publicId) {
        const uploadResult = await uploadToCloudinary(image.file_path, userId, image.id);
        if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed');
        }
        publicId = uploadResult.publicId;
        await query.run(
            'UPDATE image_bank SET cloudinary_public_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            [publicId, image.id, userId]
        );
    }

    // Build and apply transformations
    const transformString = buildTransformationString(transformations);
    if (!transformString) {
        throw new Error('No transformations specified');
    }

    const result = await applyTransformations(publicId, transformString);
    if (!result.success) {
        throw new Error(result.error || 'Transformation failed');
    }

    return {
        resultUrl: result.url,
        publicId: result.publicId || publicId,
        processingTime: Date.now() - startTime
    };
}

// Process entire batch job (called async after creation)
async function processJob(jobId) {
    const job = await query.get('SELECT * FROM batch_photo_jobs WHERE id = ?', [jobId]);
    if (!job || job.status !== 'pending') {
        return;
    }

    // Check Cloudinary configuration
    if (!isCloudinaryConfigured()) {
        await query.run(
            "UPDATE batch_photo_jobs SET status = 'failed', error_message = 'Cloudinary not configured', completed_at = ? WHERE id = ? AND user_id = ?",
            [now(), jobId, job.user_id]
        );
        return;
    }

    // Mark job as processing
    await query.run(
        "UPDATE batch_photo_jobs SET status = 'processing', started_at = ? WHERE id = ? AND user_id = ?",
        [now(), jobId, job.user_id]
    );

    const items = await query.all(
        'SELECT * FROM batch_photo_items WHERE job_id = ? AND status = ?',
        [jobId, 'pending']
    );

    let transformations;
    try {
        transformations = JSON.parse(job.transformations);
    } catch (err) {
        logger.error('[BatchPhoto] Failed to parse transformations', null, { detail: err.message });
        await query.run(
            "UPDATE batch_photo_jobs SET status = 'failed', error_message = 'Invalid transformations data', completed_at = ? WHERE id = ? AND user_id = ?",
            [now(), jobId, job.user_id]
        );
        return;
    }

    let processed = 0;
    let failed = 0;

    // Read cancellation status once before the loop; re-check only after each async operation
    let cancelled = false;

    for (const item of items) {
        if (cancelled) break;

        try {
            // Mark item as processing (verified via job ownership check above)
            await query.run("UPDATE batch_photo_items SET status = 'processing' WHERE id = ?", [item.id]);

            const result = await processJobItem(item, transformations, job.user_id);

            // Check for cancellation and commit item results in one transaction
            await query.transaction(async () => {
                const currentJob = await query.get('SELECT status FROM batch_photo_jobs WHERE id = ?', [jobId]);
                if (currentJob.status === 'cancelled') {
                    cancelled = true;
                    return;
                }
                await query.run(`
                    UPDATE batch_photo_items
                    SET status = 'completed', result_url = ?, cloudinary_public_id = ?,
                        processing_time_ms = ?, processed_at = ?
                    WHERE id = ?
                `, [result.resultUrl, result.publicId, result.processingTime, now(), item.id]);
                await query.run(`
                    INSERT INTO image_edit_history (id, image_id, user_id, edit_type, parameters, cloudinary_public_id, created_at)
                    VALUES (?, ?, ?, 'batch_transform', ?, ?, ?)
                `, [generateId(), item.image_id, job.user_id, job.transformations, result.publicId, now()]);
            });

            if (!cancelled) processed++;
        } catch (error) {
            // Mark item failed
            await query.run(`
                UPDATE batch_photo_items
                SET status = 'failed', error_message = ?, processed_at = ?
                WHERE id = ?
            `, [error.message, now(), item.id]);
            failed++;
        }
    }

    // Write final progress count once after the loop instead of after every item
    await query.run(`
        UPDATE batch_photo_jobs
        SET processed_images = ?, failed_images = ?
        WHERE id = ?
    `, [processed, failed, jobId]);

    // Mark job complete
    const finalStatus = failed === items.length ? 'failed' : 'completed';
    await query.run(`
        UPDATE batch_photo_jobs
        SET status = ?, completed_at = ?
        WHERE id = ?
    `, [finalStatus, now(), jobId]);
}

export async function batchPhotoRouter(context) {
    const { method, path, body, user } = context;

    // ==========================================
    // JOBS ENDPOINTS
    // ==========================================

    // POST /jobs - Create new batch job
    if (method === 'POST' && path === '/jobs') {
        try {
            const { imageIds, transformations, name, presetId } = body;

            if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
                return { status: 400, data: { error: 'Image IDs required' } };
            }

            if (imageIds.length > 50) {
                return { status: 400, data: { error: 'Maximum 50 images per batch' } };
            }

            if (!transformations || typeof transformations !== 'object') {
                return { status: 400, data: { error: 'Transformations required' } };
            }

            // Verify at least one transformation selected
            const hasTransform = transformations.removeBackground ||
                               transformations.enhance ||
                               transformations.upscale ||
                               (transformations.cropWidth && transformations.cropHeight);

            if (!hasTransform) {
                return { status: 400, data: { error: 'At least one transformation required' } };
            }

            // Verify all images exist and belong to user
            const placeholders = imageIds.map(() => '?').join(',');
            const images = await query.all(
                `SELECT id FROM image_bank WHERE id IN (${placeholders}) AND user_id = ?`,
                [...imageIds, user.id]
            );

            if (images.length !== imageIds.length) {
                return { status: 400, data: { error: 'Some images not found or unauthorized' } };
            }

            // Create job
            const jobId = generateId();
            await query.run(`
                INSERT INTO batch_photo_jobs (id, user_id, name, total_images, transformations, preset_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [jobId, user.id, name || null, imageIds.length, JSON.stringify(transformations), presetId || null, now()]);

            // Batch-fetch file_path for all images in one query, then insert items in a transaction
            const filePathPlaceholders = imageIds.map(() => '?').join(',');
            const imageFilePaths = await query.all(
                `SELECT id, file_path FROM image_bank WHERE id IN (${filePathPlaceholders})`,
                imageIds
            );
            const filePathMap = Object.fromEntries(imageFilePaths.map(r => [r.id, r.file_path]));

            await query.transaction(async () => {
                for (const imageId of imageIds) {
                    await query.run(`
                        INSERT INTO batch_photo_items (id, job_id, image_id, original_url, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `, [generateId(), jobId, imageId, filePathMap[imageId] || null, now()]);
                }
            });

            // Increment preset usage if used
            if (presetId) {
                await query.run(
                    'UPDATE batch_photo_presets SET usage_count = usage_count + 1 WHERE id = ? AND user_id = ?',
                    [presetId, user.id]
                );
            }

            return {
                status: 201,
                data: {
                    job: {
                        id: jobId,
                        total_images: imageIds.length,
                        status: 'pending',
                        transformations
                    }
                }
            };
        } catch (error) {
            logger.error('[BatchPhoto] Error creating batch job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /jobs - List user's batch jobs
    if (method === 'GET' && path === '/jobs') {
        try {
            const jobs = await query.all(`
                SELECT * FROM batch_photo_jobs
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            `, [user.id]);

            return { status: 200, data: { jobs } };
        } catch (error) {
            logger.error('[BatchPhoto] Error listing batch jobs', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /jobs/:id - Get job details with items
    if (method === 'GET' && path.match(/^\/jobs\/[^/]+$/)) {
        try {
            const jobId = path.split('/')[2];

            const job = await query.get(
                'SELECT * FROM batch_photo_jobs WHERE id = ? AND user_id = ?',
                [jobId, user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Job not found' } };
            }

            const items = await query.all(
                'SELECT * FROM batch_photo_items WHERE job_id = ? ORDER BY created_at',
                [jobId]
            );

            return {
                status: 200,
                data: {
                    job: {
                        ...job,
                        transformations: (() => { try { return JSON.parse(job.transformations || '{}'); } catch { return {}; } })(),
                        items
                    }
                }
            };
        } catch (error) {
            logger.error('[BatchPhoto] Error getting job details', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /jobs/:id/start - Start processing a job
    if (method === 'POST' && path.match(/^\/jobs\/[^/]+\/start$/)) {
        try {
            const jobId = path.split('/')[2];

            const job = await query.get(
                'SELECT * FROM batch_photo_jobs WHERE id = ? AND user_id = ?',
                [jobId, user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Job not found' } };
            }

            if (job.status !== 'pending') {
                return { status: 400, data: { error: `Job is already ${job.status}` } };
            }

            // Start processing in background (don't await)
            processJob(jobId).catch(async err => {
                logger.error('[BatchPhoto] Batch job processing error', null, { detail: err.message });
                await query.run(
                    "UPDATE batch_photo_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ? AND user_id = ?",
                    [err.message, now(), jobId, user.id]
                );
            });

            return { status: 200, data: { message: 'Job started', jobId } };
        } catch (error) {
            logger.error('[BatchPhoto] Error starting batch job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /jobs/:id/cancel - Cancel a running job
    if (method === 'POST' && path.match(/^\/jobs\/[^/]+\/cancel$/)) {
        try {
            const jobId = path.split('/')[2];

            const job = await query.get(
                'SELECT * FROM batch_photo_jobs WHERE id = ? AND user_id = ?',
                [jobId, user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Job not found' } };
            }

            if (job.status !== 'processing' && job.status !== 'pending') {
                return { status: 400, data: { error: 'Job cannot be cancelled' } };
            }

            await query.run(
                "UPDATE batch_photo_jobs SET status = 'cancelled', completed_at = ? WHERE id = ? AND user_id = ?",
                [now(), jobId, user.id]
            );

            // Mark remaining pending items as skipped (job ownership already verified above)
            await query.run(
                "UPDATE batch_photo_items SET status = 'skipped' WHERE job_id = ? AND status = 'pending'",
                [jobId]
            );

            return { status: 200, data: { message: 'Job cancelled' } };
        } catch (error) {
            logger.error('[BatchPhoto] Error cancelling batch job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /jobs/:id - Delete a job
    if (method === 'DELETE' && path.match(/^\/jobs\/[^/]+$/)) {
        try {
            const jobId = path.split('/')[2];

            const job = await query.get(
                'SELECT * FROM batch_photo_jobs WHERE id = ? AND user_id = ?',
                [jobId, user.id]
            );

            if (!job) {
                return { status: 404, data: { error: 'Job not found' } };
            }

            if (job.status === 'processing') {
                return { status: 400, data: { error: 'Cannot delete a running job' } };
            }

            // Delete items and job atomically
            await query.transaction(async () => {
                await query.run('DELETE FROM batch_photo_items WHERE job_id = ?', [jobId]);
                await query.run('DELETE FROM batch_photo_jobs WHERE id = ? AND user_id = ?', [jobId, user.id]);
            });

            return { status: 200, data: { message: 'Job deleted' } };
        } catch (error) {
            logger.error('[BatchPhoto] Error deleting batch job', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // ==========================================
    // PRESETS ENDPOINTS
    // ==========================================

    // GET /presets - List saved presets
    if (method === 'GET' && path === '/presets') {
        try {
            const presets = await query.all(`
                SELECT * FROM batch_photo_presets
                WHERE user_id = ?
                ORDER BY usage_count DESC, created_at DESC
            `, [user.id]);

            return {
                status: 200,
                data: {
                    presets: presets.map(p => {
                        let transformations;
                        try {
                            transformations = JSON.parse(p.transformations || '{}');
                        } catch (err) {
                            logger.error('[BatchPhoto] Failed to parse preset transformations', null, { detail: err.message });
                            transformations = {};
                        }
                        return {
                            ...p,
                            transformations
                        };
                    })
                }
            };
        } catch (error) {
            logger.error('[BatchPhoto] Error listing presets', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /presets - Create preset
    if (method === 'POST' && path === '/presets') {
        try {
            const { name, description, transformations, isDefault } = body;

            if (!name || !transformations) {
                return { status: 400, data: { error: 'Name and transformations required' } };
            }

            // If setting as default, clear other defaults
            if (isDefault) {
                await query.run(
                    'UPDATE batch_photo_presets SET is_default = 0 WHERE user_id = ?',
                    [user.id]
                );
            }

            const presetId = generateId();
            await query.run(`
                INSERT INTO batch_photo_presets (id, user_id, name, description, transformations, is_default, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [presetId, user.id, name, description || null, JSON.stringify(transformations), isDefault ? 1 : 0, now(), now()]);

            return {
                status: 201,
                data: {
                    preset: {
                        id: presetId,
                        name,
                        description,
                        transformations,
                        is_default: isDefault ? 1 : 0
                    }
                }
            };
        } catch (error) {
            logger.error('[BatchPhoto] Error creating preset', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /presets/:id - Update preset
    if (method === 'PUT' && path.match(/^\/presets\/[^/]+$/)) {
        try {
            const presetId = path.split('/')[2];

            const preset = await query.get(
                'SELECT * FROM batch_photo_presets WHERE id = ? AND user_id = ?',
                [presetId, user.id]
            );

            if (!preset) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            const { name, description, transformations, isDefault } = body;

            // If setting as default, clear other defaults
            if (isDefault) {
                await query.run(
                    'UPDATE batch_photo_presets SET is_default = 0 WHERE user_id = ?',
                    [user.id]
                );
            }

            await query.run(`
                UPDATE batch_photo_presets
                SET name = ?, description = ?, transformations = ?, is_default = ?, updated_at = ?
                WHERE id = ?
            `, [
                name || preset.name,
                description !== undefined ? description : preset.description,
                transformations ? JSON.stringify(transformations) : preset.transformations,
                isDefault ? 1 : (isDefault === false ? 0 : preset.is_default),
                now(),
                presetId
            ]);

            return { status: 200, data: { message: 'Preset updated' } };
        } catch (error) {
            logger.error('[BatchPhoto] Error updating preset', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /presets/:id - Delete preset
    if (method === 'DELETE' && path.match(/^\/presets\/[^/]+$/)) {
        try {
            const presetId = path.split('/')[2];

            const preset = await query.get(
                'SELECT * FROM batch_photo_presets WHERE id = ? AND user_id = ?',
                [presetId, user.id]
            );

            if (!preset) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            await query.run('DELETE FROM batch_photo_presets WHERE id = ? AND user_id = ?', [presetId, user.id]);

            return { status: 200, data: { message: 'Preset deleted' } };
        } catch (error) {
            logger.error('[BatchPhoto] Error deleting preset', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /presets/:id/set-default - Set default preset
    if (method === 'POST' && path.match(/^\/presets\/[^/]+\/set-default$/)) {
        try {
            const presetId = path.split('/')[2];

            const preset = await query.get(
                'SELECT * FROM batch_photo_presets WHERE id = ? AND user_id = ?',
                [presetId, user.id]
            );

            if (!preset) {
                return { status: 404, data: { error: 'Preset not found' } };
            }

            // Clear all defaults for user, then set this one (atomic transaction)
            await query.transaction(async () => {
                await query.run('UPDATE batch_photo_presets SET is_default = 0 WHERE user_id = ?', [user.id]);
                await query.run('UPDATE batch_photo_presets SET is_default = 1, updated_at = ? WHERE id = ? AND user_id = ?', [now(), presetId, user.id]);
            });

            return { status: 200, data: { message: 'Default preset updated' } };
        } catch (error) {
            logger.error('[BatchPhoto] Error setting default preset', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // 404 for unmatched routes
    return { status: 404, data: { error: 'Not found' } };
}
