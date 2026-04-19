// Image Analyzer Utility
// Analyzes product images to extract information
// Primary: Claude Haiku Vision API. Fallback: text-based pattern helpers.

import Anthropic from '@anthropic-ai/sdk';
import Sentry from '../../backend/instrument.js';
import { logger } from '../../backend/shared/logger.js';
import { sanitizeForAI } from './sanitize-input.js';
import { withTimeout } from '../../backend/shared/fetchWithTimeout.js';
import { circuitBreaker } from '../../backend/shared/circuitBreaker.js';
import { getCachedResponse, setCachedResponse } from './embedding-service.js';
import { createHash } from 'crypto';

// Common brand patterns (for text detection in images)
const BRAND_PATTERNS = [
    { pattern: /nike/i, brand: 'Nike' },
    { pattern: /adidas/i, brand: 'Adidas' },
    { pattern: /levi'?s/i, brand: 'Levi\'s' },
    { pattern: /ralph\s*lauren/i, brand: 'Ralph Lauren' },
    { pattern: /coach/i, brand: 'Coach' },
    { pattern: /michael\s*kors/i, brand: 'Michael Kors' },
    { pattern: /gucci/i, brand: 'Gucci' },
    { pattern: /louis\s*vuitton|lv/i, brand: 'Louis Vuitton' },
    { pattern: /chanel/i, brand: 'Chanel' },
    { pattern: /prada/i, brand: 'Prada' },
    { pattern: /zara/i, brand: 'Zara' },
    { pattern: /h&m/i, brand: 'H&M' },
    { pattern: /free\s*people/i, brand: 'Free People' },
    { pattern: /anthropologie/i, brand: 'Anthropologie' },
    { pattern: /north\s*face/i, brand: 'North Face' },
    { pattern: /patagonia/i, brand: 'Patagonia' }
];

// Color detection (simplified - real implementation would analyze pixels)
const COMMON_COLORS = [
    'Black', 'White', 'Gray', 'Navy', 'Blue', 'Red', 'Pink',
    'Green', 'Brown', 'Beige', 'Cream', 'Yellow', 'Orange',
    'Purple', 'Gold', 'Silver', 'Multi'
];

// Category keywords for detection
const CATEGORY_KEYWORDS = {
    'Tops': ['shirt', 'blouse', 'top', 'tee', 't-shirt', 'tank', 'sweater', 'cardigan', 'hoodie', 'pullover'],
    'Bottoms': ['pants', 'jeans', 'shorts', 'skirt', 'trousers', 'leggings'],
    'Dresses': ['dress', 'gown', 'romper', 'jumpsuit'],
    'Outerwear': ['jacket', 'coat', 'blazer', 'vest', 'parka', 'windbreaker'],
    'Footwear': ['shoes', 'sneakers', 'boots', 'heels', 'sandals', 'flats', 'loafers', 'pumps'],
    'Bags': ['bag', 'purse', 'handbag', 'tote', 'clutch', 'backpack', 'crossbody', 'satchel'],
    'Accessories': ['hat', 'scarf', 'belt', 'sunglasses', 'watch', 'jewelry', 'necklace', 'bracelet', 'earrings', 'ring']
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BASE64_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validate image data before sending to API.
 * @param {string} imageData - URL or base64 data URI
 * @returns {{ valid: boolean, error?: string, imageSource?: object }}
 */
function validateImageData(imageData) {
    if (!imageData || typeof imageData !== 'string') {
        return { valid: false, error: 'Image data must be a non-empty string' };
    }

    if (imageData.startsWith('data:')) {
        const m = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) {
            return { valid: false, error: 'Invalid base64 data URI format' };
        }
        const mimeType = m[1].toLowerCase();
        const base64Data = m[2];

        if (!ALLOWED_MIME_TYPES.has(mimeType)) {
            return { valid: false, error: `Unsupported image format: ${mimeType}. Allowed: jpeg, png, webp, gif` };
        }

        // Validate base64 characters
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
            return { valid: false, error: 'Invalid base64 encoding in image data' };
        }

        // Approximate byte size: base64 encodes 3 bytes per 4 chars
        const approxBytes = Math.floor(base64Data.length * 0.75);
        if (approxBytes > MAX_BASE64_BYTES) {
            return { valid: false, error: `Image too large: ~${Math.round(approxBytes / 1024 / 1024)}MB exceeds the 5MB limit` };
        }

        return { valid: true, imageSource: { type: 'base64', media_type: mimeType, data: base64Data } };
    }

    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
        return { valid: true, imageSource: { type: 'url', url: imageData } };
    }

    return { valid: false, error: 'Image data must be a base64 data URI or an http(s) URL' };
}

/**
 * Analyze an image and extract product information.
 * Calls Claude Haiku Vision API first; falls back to text-based helpers on failure.
 * @param {string} imageData - URL or base64 data URI
 * @returns {Object} Analysis results
 */
export async function analyzeImage(imageData) {
    const imageApiKey = process.env.VAULTLISTER_IMAGE_ANALYZER || process.env.ANTHROPIC_API_KEY;
    if (imageApiKey && imageData) {
        try {
            const hash = createHash('sha256').update(imageData).digest('hex');

            const cached = await getCachedResponse(hash);
            if (cached) {
                return { ...cached, metadata: { ...cached.metadata, cached: true } };
            }

            const anthropic = new Anthropic({ apiKey: imageApiKey });

            const validation = validateImageData(imageData);
            if (!validation.valid) {
                logger.warn('AI image analysis skipped: invalid input', { reason: validation.error });
                return {
                    category: null, brand: null, colors: [], style: null, tags: [],
                    condition: null, confidence: 0,
                    metadata: { analyzed: false, reason: validation.error }
                };
            }

            const imageSource = validation.imageSource;

            if (imageSource) {
                const response = await Sentry.startSpan({ name: 'claude.image-analysis', op: 'ai.run', attributes: { model: 'claude-haiku-4-5-20251001' } }, () =>
                    circuitBreaker('anthropic-image', () =>
                        withTimeout(anthropic.messages.create({
                            model: 'claude-haiku-4-5-20251001',
                            max_tokens: 512,
                            system: 'Analyze product images for resale. Respond ONLY with valid JSON: {"brand":"brand name or null","category":"Tops/Bottoms/Dresses/Outerwear/Footwear/Bags/Accessories","condition":"new/like_new/good/fair/poor","colors":["primary","secondary"],"style":"casual/vintage/streetwear/etc or null","tags":["tag1","tag2","tag3"],"confidence":0.0}',
                            messages: [{
                                role: 'user',
                                content: [
                                    { type: 'image', source: imageSource },
                                    { type: 'text', text: 'Analyze this product image.' }
                                ]
                            }]
                        }), 30000, 'Anthropic image analysis'),
                        { failureThreshold: 3, cooldownMs: 60000 }
                    )
                );

                const match = response.content[0].text.trim().match(/\{[\s\S]*\}/);
                if (match) {
                    let r = null;
                    try { r = JSON.parse(match[0]); } catch (parseErr) {
                        logger.warn('AI image analysis: JSON parse failed, falling back to text helpers', { error: parseErr.message });
                    }
                    if (r) {
                        const result = {
                            source: 'ai-vision',
                            category: r.category || null,
                            brand: r.brand || null,
                            colors: Array.isArray(r.colors) ? r.colors : [],
                            style: r.style || null,
                            tags: Array.isArray(r.tags) ? r.tags : [],
                            condition: r.condition || null,
                            confidence: typeof r.confidence === 'number' ? r.confidence : 0.8,
                            metadata: { analyzed: true, source: 'claude-haiku-vision' }
                        };
                        await setCachedResponse(hash, result);
                        return result;
                    }
                }
            }
        } catch (err) {
            logger.warn('AI image analysis failed, falling back to text-based helpers', {
                error: err.message,
                hasImageData: !!imageData
            });
        }
    }

    // Text-based fallback: use filename/URL clues and pattern helpers
    const textHints = typeof imageData === 'string' ? analyzeFilename(imageData) : {};
    return {
        source: 'fallback',
        category: textHints.category || null,
        brand: textHints.brand || null,
        colors: textHints.colors || [],
        style: null,
        tags: generateTagsFromAnalysis(textHints),
        condition: null,
        confidence: 0,
        metadata: {
            analyzed: false,
            reason: process.env.ANTHROPIC_API_KEY ? 'Vision API call failed' : 'ANTHROPIC_API_KEY not configured'
        }
    };
}

/**
 * Detect brand from text or filename
 */
export function detectBrand(text) {
    if (!text) return null;

    for (const { pattern, brand } of BRAND_PATTERNS) {
        if (pattern.test(text)) {
            return brand;
        }
    }

    return null;
}

/**
 * Detect category from text
 */
export function detectCategory(text) {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerText.includes(keyword)) {
                return category;
            }
        }
    }

    return null;
}

/**
 * Extract colors from text description
 */
export function extractColors(text) {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    const foundColors = [];

    for (const color of COMMON_COLORS) {
        if (lowerText.includes(color.toLowerCase())) {
            foundColors.push(color);
        }
    }

    return foundColors;
}

/**
 * Analyze image filename for clues
 */
export function analyzeFilename(filename) {
    if (!filename) return {};

    const results = {
        brand: detectBrand(filename),
        category: detectCategory(filename),
        colors: extractColors(filename)
    };

    // Try to extract size from filename
    const sizeMatch = filename.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|\d{1,2})\b/i);
    if (sizeMatch) {
        results.size = sizeMatch[1].toUpperCase();
    }

    return results;
}

/**
 * Generate suggested tags from image analysis
 */
export function generateTagsFromAnalysis(analysis) {
    const tags = new Set();

    if (analysis.brand) {
        tags.add(analysis.brand.toLowerCase());
        tags.add(analysis.brand.toLowerCase().replace(/['\s]/g, ''));
    }

    if (analysis.category) {
        tags.add(analysis.category.toLowerCase());
    }

    for (const color of (analysis.colors || [])) {
        tags.add(color.toLowerCase());
    }

    if (analysis.style) {
        tags.add(analysis.style.toLowerCase());
    }

    // Add related tags
    if (analysis.category === 'Footwear') {
        tags.add('shoes');
    }
    if (analysis.category === 'Bags') {
        tags.add('purse');
        tags.add('handbag');
    }

    return Array.from(tags);
}

/**
 * Estimate image quality
 * @param {Object} imageInfo - { width, height, fileSize }
 * @param {Object} [aiAnalysis] - Optional AI analysis from Claude Vision (photoQuality field)
 */
export function estimateImageQuality(imageInfo, aiAnalysis) {
    // HIGH 19: Return null when no meaningful metadata is available to avoid fake scores
    const hasDimensions = imageInfo && imageInfo.width && imageInfo.height;
    const hasFileSize = imageInfo && imageInfo.fileSize;
    if (!aiAnalysis?.photoQuality && !hasDimensions && !hasFileSize) {
        return null;
    }

    const quality = {
        score: 0,
        issues: [],
        suggestions: []
    };

    // If AI analysis with photoQuality is available, use it directly
    if (aiAnalysis?.photoQuality) {
        const pq = aiAnalysis.photoQuality;
        quality.score = Math.round((pq.score || 5) * 10); // Convert 1-10 to 0-100
        quality.issues = pq.issues || [];
        quality.suggestions = pq.suggestions || [];
        quality.source = 'claude-vision';
        quality.score = Math.min(100, quality.score);

        if (quality.score >= 80) quality.assessment = 'Excellent';
        else if (quality.score >= 60) quality.assessment = 'Good';
        else if (quality.score >= 40) quality.assessment = 'Fair';
        else quality.assessment = 'Needs improvement';

        return quality;
    }

    // Fallback: metadata-based estimation
    quality.source = 'metadata';

    // Check dimensions (if available)
    if (imageInfo.width && imageInfo.height) {
        const minDimension = Math.min(imageInfo.width, imageInfo.height);

        if (minDimension >= 1000) {
            quality.score += 40;
        } else if (minDimension >= 500) {
            quality.score += 25;
            quality.suggestions.push('Higher resolution images perform better');
        } else {
            quality.score += 10;
            quality.issues.push('Image resolution is too low');
        }

        // Check aspect ratio
        const ratio = imageInfo.width / imageInfo.height;
        if (ratio >= 0.8 && ratio <= 1.2) {
            quality.score += 20;
        } else {
            quality.suggestions.push('Square images work best on most platforms');
        }
    } else {
        quality.score += 30;
    }

    // Check file size (if available)
    if (imageInfo.fileSize) {
        if (imageInfo.fileSize > 5 * 1024 * 1024) {
            quality.suggestions.push('Consider compressing the image for faster loading');
        } else if (imageInfo.fileSize < 50 * 1024) {
            quality.issues.push('Image file size is very small, may be low quality');
        } else {
            quality.score += 20;
        }
    } else {
        quality.score += 15;
    }

    // Background check — without AI, award partial points based on resolution
    // (high-res images are more likely to have intentional backgrounds)
    if (imageInfo.width && imageInfo.height && Math.min(imageInfo.width, imageInfo.height) >= 800) {
        quality.score += 15;
    } else {
        quality.score += 10;
        quality.suggestions.push('Use a clean, well-lit background for better listings');
    }

    // Normalize score to 0-100
    quality.score = Math.min(100, quality.score);

    // Generate overall assessment
    if (quality.score >= 80) {
        quality.assessment = 'Excellent';
    } else if (quality.score >= 60) {
        quality.assessment = 'Good';
    } else if (quality.score >= 40) {
        quality.assessment = 'Fair';
    } else {
        quality.assessment = 'Needs improvement';
    }

    return quality;
}

/**
 * Get image optimization recommendations
 */
export function getImageRecommendations() {
    return {
        dimensions: {
            recommended: '1000x1000 pixels minimum',
            ideal: '1500x1500 pixels',
            aspectRatio: '1:1 (square) for most platforms'
        },
        format: {
            recommended: ['JPEG', 'PNG'],
            forPhotos: 'JPEG with 80-90% quality',
            forGraphics: 'PNG for transparency'
        },
        fileSize: {
            max: '5MB',
            recommended: '500KB - 2MB'
        },
        tips: [
            'Use natural lighting when possible',
            'Shoot against a clean, neutral background',
            'Include multiple angles (front, back, detail shots)',
            'Show any flaws or wear clearly',
            'Use a flat lay or mannequin for clothing',
            'Ensure the item fills most of the frame'
        ]
    };
}
