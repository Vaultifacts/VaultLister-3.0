// Cloudinary Service
// Handles advanced image editing using Cloudinary AI features

import crypto from 'crypto';
import { readFileSync } from 'fs';
import { logger } from '../shared/logger.js';

const MIME_FROM_EXT = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
};

// Check if Cloudinary is configured
const isConfigured = () => {
    return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
};

/**
 * Generate Cloudinary API signature
 */
function generateSignature(params, apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    params.timestamp = timestamp;

    // Sort parameters alphabetically
    const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&');

    const signature = crypto
        .createHash('sha256')
        .update(sortedParams + apiSecret)
        .digest('hex');

    return { signature, timestamp };
}

/**
 * Upload image to Cloudinary
 */
export async function uploadToCloudinary(imagePath, userId, imageId) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured' };
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        // Resolve image to a base64 data URI
        let fileDataUri;
        const ext = (imagePath.split('.').pop() || '').toLowerCase();
        const mimeType = MIME_FROM_EXT[ext] || 'image/jpeg';

        if (!imagePath.startsWith('/')) {
            // R2 key — fetch buffer via streamFromR2
            const { streamFromR2 } = await import('./imageStorage.js');
            const { body, contentType } = await streamFromR2(imagePath, mimeType);
            fileDataUri = `data:${contentType || mimeType};base64,${body.toString('base64')}`;
        } else {
            // Local filesystem path
            const imageBuffer = readFileSync(imagePath);
            fileDataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
        }

        // Prepare upload parameters
        const params = {
            public_id: `vaultlister/${userId}/${imageId}`,
        };

        const { signature, timestamp } = generateSignature(params, apiSecret);

        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', fileDataUri);
        formData.append('public_id', params.public_id);
        formData.append('timestamp', timestamp);
        formData.append('api_key', apiKey);
        formData.append('signature', signature);

        let response;
        try {
            response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(30000),
            });
        } catch (fetchError) {
            if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
                logger.error('[Cloudinary] Upload timed out after 30s');
                return { success: false, error: 'Upload timed out. Please try again.' };
            }
            throw fetchError;
        }

        const data = await response.json();

        if (response.ok) {
            return {
                success: true,
                publicId: data.public_id,
                url: data.secure_url,
                width: data.width,
                height: data.height,
            };
        } else {
            return { success: false, error: data.error?.message || 'Upload failed' };
        }
    } catch (error) {
        logger.error('[Cloudinary] Upload error', null, { detail: error?.message || 'Unknown error' });
        return { success: false, error: error.message };
    }
}

/**
 * Remove background from image
 * Uses Cloudinary's AI background removal feature
 */
export async function removeBackground(publicId) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured. Add CLOUDINARY_* environment variables.' };
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        // Generate transformation URL
        const transformationUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_background_removal/${publicId}`;

        return {
            success: true,
            url: transformationUrl,
            transformation: 'background_removal',
            publicId,
        };
    } catch (error) {
        logger.error('[Cloudinary] Background removal error', null, { detail: error?.message || 'Unknown error' });
        return { success: false, error: error.message };
    }
}

/**
 * Auto-enhance image
 * Uses Cloudinary's AI improvement feature
 */
export async function autoEnhance(publicId) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured. Add CLOUDINARY_* environment variables.' };
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        // Generate transformation URL with multiple enhancements
        const transformationUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_improve,e_auto_contrast,e_auto_brightness/${publicId}`;

        return {
            success: true,
            url: transformationUrl,
            transformation: 'auto_enhance',
            publicId,
        };
    } catch (error) {
        logger.error('[Cloudinary] Auto enhance error', null, { detail: error?.message || 'Unknown error' });
        return { success: false, error: error.message };
    }
}

/**
 * Smart crop image
 * Uses Cloudinary's AI-powered cropping
 */
export async function smartCrop(publicId, width, height) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured. Add CLOUDINARY_* environment variables.' };
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const w = Math.max(1, Math.min(Math.round(Number(width) || 800), 4096));
        const h = Math.max(1, Math.min(Math.round(Number(height) || 800), 4096));

        // Generate transformation URL with smart cropping
        const transformationUrl = `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_auto,w_${w},h_${h}/${publicId}`;

        return {
            success: true,
            url: transformationUrl,
            transformation: 'smart_crop',
            width,
            height,
            publicId,
        };
    } catch (error) {
        logger.error('[Cloudinary] Smart crop error', null, { detail: error?.message || 'Unknown error' });
        return { success: false, error: error.message };
    }
}

/**
 * Apply custom transformations
 * Allows combining multiple Cloudinary transformations
 */
export async function applyTransformations(publicId, transformations) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured. Add CLOUDINARY_* environment variables.' };
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        // Build transformation string
        const transformString = Array.isArray(transformations) ? transformations.join(',') : transformations;

        const transformationUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}/${publicId}`;

        return {
            success: true,
            url: transformationUrl,
            transformation: transformString,
            publicId,
        };
    } catch (error) {
        logger.error('[Cloudinary] Apply transformations error', null, { detail: error?.message || 'Unknown error' });
        return { success: false, error: error.message };
    }
}

/**
 * AI upscale image
 * Increases image resolution using AI
 */
export async function aiUpscale(publicId) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured. Add CLOUDINARY_* environment variables.' };
    }

    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        // Generate transformation URL with AI upscaling
        const transformationUrl = `https://res.cloudinary.com/${cloudName}/image/upload/e_upscale/${publicId}`;

        return {
            success: true,
            url: transformationUrl,
            transformation: 'ai_upscale',
            publicId,
        };
    } catch (error) {
        logger.error('[Cloudinary] AI upscale error', null, { detail: error?.message || 'Unknown error' });
        return { success: false, error: error.message };
    }
}

/**
 * Generate responsive image URLs
 * Creates multiple sizes for responsive images
 */
export function generateResponsiveUrls(publicId, sizes = [400, 800, 1200, 1600]) {
    if (!isConfigured()) {
        return { success: false, error: 'Cloudinary not configured' };
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const urls = {};

    sizes.forEach((size) => {
        urls[`w${size}`] = `https://res.cloudinary.com/${cloudName}/image/upload/w_${size},c_scale/${publicId}`;
    });

    return { success: true, urls };
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured() {
    return isConfigured();
}

export default {
    uploadToCloudinary,
    removeBackground,
    autoEnhance,
    smartCrop,
    applyTransformations,
    aiUpscale,
    generateResponsiveUrls,
    isCloudinaryConfigured,
};
