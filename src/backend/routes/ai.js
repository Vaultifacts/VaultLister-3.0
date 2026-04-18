// AI Routes - Local AI features using pattern matching and templates
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { checkTierPermission } from '../middleware/auth.js';
import { generateTitle, generateDescription, generateTags, analyzeImage, generateListing } from '../../shared/ai/listing-generator.js';
import { predictPrice, getPriceRange } from '../../shared/ai/price-predictor.js';
import { detectBrand, detectCategory } from '../../shared/ai/image-analyzer.js';
import { getAnthropicClient } from '../../shared/ai/claude-client.js';
import { logger } from '../shared/logger.js';
import { validateBase64Image } from '../services/imageStorage.js';
import { requireFeature } from '../middleware/featureFlags.js';
import { sanitizeForAI } from '../../shared/ai/sanitize-input.js';
import { withTimeout } from '../shared/fetchWithTimeout.js';
import { circuitBreaker } from '../shared/circuitBreaker.js';
import { RateLimiter } from '../middleware/rateLimiter.js';
import { safeJsonParse } from '../shared/utils.js';
import { findSimilar, storeReference, getCachedResponse, setCachedResponse, buildSearchText } from '../../shared/ai/embedding-service.js';
import { createHash } from 'crypto';


// Rate limiter for expensive AI API calls (per-user, 10 requests per minute)
const aiRateLimiter = new RateLimiter();

/**
 * Score a generated listing 0–100 based on title, description, tags, and price completeness.
 * Returns { score, label, details }.
 */
function computeListingQualityScore(title = '', description = '', tags = [], suggestedPrice, guidelines = {}) {
    const titleLen = title.length;
    const descLen = description.length;
    const tagCount = Array.isArray(tags) ? tags.length : 0;
    const titleMax = guidelines.titleMax || 80;
    const descMax = guidelines.descMax || 1000;

    // Title: 25pts — optimal is 50–100% of platform limit
    const titleRatio = titleLen / titleMax;
    const titleScore = titleLen === 0 ? 0 : titleRatio >= 0.5 ? 25 : Math.round(titleRatio * 50);

    // Description: 30pts — longer and structured earns more
    const descRatio = Math.min(1, descLen / Math.max(1, descMax * 0.4));
    const hasDetails = /detail|condition|brand|size|color/i.test(description);
    const descScore = Math.round(descRatio * 20) + (hasDetails ? 10 : 0);

    // Tags: 25pts — 10+ tags is full score
    const tagScore = tagCount === 0 ? 0 : tagCount >= 10 ? 25 : Math.round((tagCount / 10) * 25);

    // Price: 10pts — any suggested price present
    const priceScore = suggestedPrice != null && suggestedPrice > 0 ? 10 : 0;

    // Platform compliance: 10pts — title within limit, description within limit
    const complianceScore = (titleLen <= titleMax ? 5 : 0) + (descLen <= descMax ? 5 : 0);

    const score = Math.min(100, titleScore + descScore + tagScore + priceScore + complianceScore);
    const label = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'needs_work';

    return { score, label, details: { titleScore, descScore, tagScore, priceScore, complianceScore } };
}

// Canada launch platforms only — post-launch platforms (mercari, grailed, etsy, shopify) are not supported
const LAUNCH_PLATFORMS = new Set(['poshmark', 'ebay', 'depop', 'facebook', 'whatnot']);

// Configurable AI thresholds — override via environment variables
const AI_CONFIG = {
    fallbackConfidence: parseFloat(process.env.AI_FALLBACK_CONFIDENCE) || 0.65,
    priceRangeLow: parseFloat(process.env.AI_PRICE_RANGE_LOW) || 0.8,
    priceRangeHigh: parseFloat(process.env.AI_PRICE_RANGE_HIGH) || 1.2,
    duplicateThreshold: parseFloat(process.env.AI_DUPLICATE_THRESHOLD) || 0.8,
    categoryConfidence: parseFloat(process.env.AI_CATEGORY_CONFIDENCE) || 0.85,
    similarityWeights: { brand: 0.3, category: 0.2, size: 0.1, color: 0.1, title: 0.3 },
    profitMargins: { minimum: 0.30, healthy: 0.50, premium: 0.70 }
};

export async function aiRouter(ctx) {
    const { method, path, body, user } = ctx;

    // Feature flag gate (REM-17)
    if (requireFeature('FEATURE_AI_LISTING', ctx)) return ctx.res;

    // Check AI permission
    const permission = await checkTierPermission(user, 'aiFeatures');
    if (!permission.allowed) {
        return { status: 403, data: { error: 'AI features not available on your plan' } };
    }

    // POST /api/ai/analyze-listing-image - Advanced AI image analysis with Claude Vision
    if (method === 'POST' && path === '/analyze-listing-image') {
        // Rate limit: 10 API calls per minute per user
        const rateLimitKey = aiRateLimiter.getKey('claude-api', user?.id);
        const rateLimitResult = await aiRateLimiter.check(rateLimitKey, 'expensive', 'claude-api');
        if (!rateLimitResult.allowed) {
            return { status: 429, data: { error: 'Too many AI requests. Please wait before trying again.' } };
        }

        const { imageBase64, imageMimeType, platform = 'poshmark' } = body;

        if (platform && !LAUNCH_PLATFORMS.has(platform)) {
            return { status: 400, data: { error: `Platform '${platform}' is not supported at launch` } };
        }

        if (!imageBase64) {
            return { status: 400, data: { error: 'Image data required (base64)' } };
        }

        // Validate MIME type, size, and magic bytes
        const imgValidation = validateBase64Image(imageBase64, imageMimeType);
        if (!imgValidation.valid) {
            return { status: 400, data: { error: imgValidation.error } };
        }

        // Check if Anthropic API key is configured
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            // Fallback to local pattern-based analysis when no API key
            const platformTitles = {
                poshmark: 'Vintage Designer Item - Excellent Condition',
                ebay: 'Authentic Pre-Owned Fashion Item - Fast Shipping',
                depop: 'Y2K Vintage Fashion Find - Unique Style',
                facebook: 'Fashion Item For Sale - Local Pickup Available',
                whatnot: 'Collectible Item - Live Auction'
            };
            return { status: 200, data: {
                analysis: {
                    title: platformTitles[platform] || 'Fashion Item - Great Condition',
                    description: `Beautiful item in excellent condition. Perfect for any wardrobe. This piece features quality materials and craftsmanship. Measurements and details available upon request. Smoke-free home. Ships within 1-2 business days. Feel free to ask any questions!`,
                    brand: 'Unknown',
                    category: 'Clothing',
                    subcategory: 'Tops',
                    color: 'Multi',
                    pattern: 'Solid',
                    condition: 'Excellent',
                    size: 'M',
                    suggestedPrice: { low: 15, mid: 25, high: 40 },
                    tags: ['fashion', 'vintage', 'style', 'trendy', 'quality'],
                    material: 'Mixed Materials',
                    season: 'All Season',
                    style: 'Casual',
                    confidence: AI_CONFIG.fallbackConfidence,
                    note: 'AI analysis generated using pattern matching (no API key configured). For more accurate results, configure your ANTHROPIC_API_KEY.'
                }
            }};
        }

        try {
            const anthropic = getAnthropicClient();

            // Platform-specific character limits and guidelines
            const platformGuidelines = {
                poshmark: { titleMax: 80, descMax: 500, emphasize: 'brand, condition, style keywords' },
                ebay: { titleMax: 80, descMax: 1000, emphasize: 'specifics, measurements, model numbers' },
                mercari: { titleMax: 40, descMax: 1000, emphasize: 'condition, shipping details' },
                depop: { titleMax: 65, descMax: 1000, emphasize: 'aesthetic, vintage, Y2K style' },
                grailed: { titleMax: 100, descMax: 2000, emphasize: 'designer details, condition, fit' },
                facebook: { titleMax: 100, descMax: 5000, emphasize: 'local pickup, condition' }
            };

            const guidelines = platformGuidelines[platform] || platformGuidelines.poshmark;

            const prompt = `You are an expert reseller assistant analyzing a product image to create an optimized listing.

Analyze this product image and provide a detailed, structured response in JSON format with the following fields:

{
  "title": "Create a concise, SEO-optimized title (max ${guidelines.titleMax} chars) that includes brand, item type, and key features. ${guidelines.emphasize ? 'Emphasize: ' + guidelines.emphasize : ''}",
  "description": "Write a detailed, persuasive description (max ${guidelines.descMax} chars) covering: condition, key features, measurements (if visible), materials, style, and any flaws. Use professional reseller language.",
  "brand": "Identify the brand/designer (or 'Unknown' if not visible)",
  "category": "Main category (e.g., 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Outerwear', 'Dresses')",
  "subcategory": "Subcategory (e.g., 'T-Shirts', 'Jeans', 'Sneakers', 'Crossbody', 'Sunglasses', 'Jackets', 'Maxi')",
  "color": "Primary color(s)",
  "pattern": "Pattern if applicable (e.g., 'Solid', 'Striped', 'Floral', 'Plaid', 'Graphic')",
  "material": "Fabric/material if identifiable",
  "condition": "Estimated condition: 'new', 'like_new', 'good', 'fair' based on visible wear",
  "style": "Style tags (e.g., 'Casual', 'Vintage', 'Preppy', 'Streetwear', 'Y2K', 'Boho')",
  "tags": ["Array of 10-15 relevant search keywords/tags for discoverability"],
  "estimatedSize": "Size if visible or 'Not visible'",
  "keyFeatures": ["Array of 3-5 standout features or selling points"],
  "suggestedPrice": "Estimated resale value in USD (just the number, e.g., 45)",
  "confidence": "Your confidence level: 'high', 'medium', 'low' based on image quality and visibility"
}

Important:
- Be specific and accurate based only on what's clearly visible
- Use professional reseller language
- Optimize for ${platform} marketplace
- If something is unclear, state "Not visible" rather than guessing
- Focus on features that buyers search for
- Return ONLY valid JSON, no other text`;

            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageMimeType || 'image/jpeg',
                                data: imageBase64
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }]
            });

            // Extract JSON from response
            const responseText = response.content[0].text;
            let analysisData;

            // Try to parse the entire response as JSON
            analysisData = safeJsonParse(responseText, null);
            if (!analysisData) {
                // If that fails, try to extract JSON from markdown code blocks
                const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                if (jsonMatch) analysisData = safeJsonParse(jsonMatch[1], null);
            }
            if (!analysisData) {
                // Last resort: try to find JSON object in the text
                const objectMatch = responseText.match(/\{[\s\S]*\}/);
                if (objectMatch) analysisData = safeJsonParse(objectMatch[0], null);
            }
            if (!analysisData) {
                throw new Error('Could not extract JSON from AI response');
            }

            return {
                status: 200,
                data: {
                    ...analysisData,
                    aiProvider: 'claude-sonnet-4',
                    platform: platform,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('[AI] Claude AI analysis error', user?.id || null, { detail: error.message });
            return {
                status: 500,
                data: {
                    error: 'AI analysis failed',
                    fallback: true
                }
            };
        }
    }

    // POST /api/ai/generate-listing - Generate listing from image/details or an existing inventory item
    if (method === 'POST' && path === '/generate-listing') {
        // Rate limit: 10 API calls per minute per user
        const rateLimitKey = aiRateLimiter.getKey('claude-api', user?.id);
        const rateLimitResult = await aiRateLimiter.check(rateLimitKey, 'expensive', 'claude-api');
        if (!rateLimitResult.allowed) {
            return { status: 429, data: { error: 'Too many AI requests. Please wait before trying again.' } };
        }

        let { imageUrl, imageBase64, category, brand, condition, keywords, inventoryId, platform = 'poshmark', notes: extraNotes } = body;

        if (platform && !LAUNCH_PLATFORMS.has(platform)) {
            return { status: 400, data: { error: `Platform '${platform}' is not supported at launch` } };
        }

        // HIGH 16: Normalize keywords — accept comma-separated string or array
        if (typeof keywords === 'string') keywords = keywords.split(',').map(k => k.trim()).filter(Boolean);

        const platformGuidelines = {
            poshmark: { titleMax: 80, descMax: 500, emphasize: 'brand, condition, style keywords' },
            ebay: { titleMax: 80, descMax: 1000, emphasize: 'specifics, measurements, model numbers' },
            mercari: { titleMax: 40, descMax: 1000, emphasize: 'condition, shipping details' },
            depop: { titleMax: 65, descMax: 1000, emphasize: 'aesthetic, vintage, Y2K style' },
            grailed: { titleMax: 100, descMax: 2000, emphasize: 'designer details, condition, fit' },
            facebook: { titleMax: 100, descMax: 5000, emphasize: 'local pickup, condition' }
        };
        const guidelines = platformGuidelines[platform] || platformGuidelines.poshmark;

        try {
            let itemData = {};

            // If inventoryId provided, pull item from DB for richer context
            if (inventoryId) {
                const item = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, user.id]);
                if (!item) {
                    return { status: 404, data: { error: 'Inventory item not found' } };
                }
                itemData = item;
            }

            // Analyze image if provided
            let imageAnalysis = {};
            if (imageUrl || imageBase64) {
                imageAnalysis = await analyzeImage(imageUrl || imageBase64);
            }

            // Build generation context from DB item + override fields + image analysis
            const context = {
                category: category || itemData.category || imageAnalysis.category,
                brand: brand || itemData.brand || imageAnalysis.brand,
                condition: condition || itemData.condition || 'good',
                size: itemData.size,
                color: itemData.color,
                material: itemData.material,
                originalPrice: itemData.cost_price,
                notes: [extraNotes, itemData.notes].filter(Boolean).join('. ') || undefined,
                keywords: (Array.isArray(keywords) ? keywords : keywords ? [keywords] : null) || (itemData.tags ? (typeof itemData.tags === 'string' ? safeJsonParse(itemData.tags, []) : itemData.tags) : []) || imageAnalysis.tags || [],
                colors: imageAnalysis.colors || [],
                style: imageAnalysis.style
            };

            // Use Claude Sonnet for platform-specific generation when API key is available
            if (process.env.ANTHROPIC_API_KEY) {
                try {
                    const anthropic = getAnthropicClient();

                    const safeBrand = sanitizeForAI(context.brand || 'Unknown', 100);
                    const safeCategory = sanitizeForAI(context.category || 'Clothing', 100);
                    const safeCondition = sanitizeForAI(context.condition || 'good', 50);
                    const safeColor = sanitizeForAI(context.color || 'N/A', 50);
                    const safeSize = sanitizeForAI(context.size || 'N/A', 20);
                    const safeMaterial = sanitizeForAI(context.material || 'N/A', 100);
                    const safeNotes = sanitizeForAI(context.notes || (context.keywords.length ? context.keywords.join(', ') : 'None'), 500);
                    const safePrice = context.originalPrice ? `$${sanitizeForAI(String(context.originalPrice), 20)}` : 'N/A';
                    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);

                    const userContent = `Brand: ${safeBrand}\nCategory: ${safeCategory}\nCondition: ${safeCondition}\nColor: ${safeColor}\nSize: ${safeSize}\nMaterial: ${safeMaterial}\nOriginal Cost: ${safePrice}\nNotes/Keywords: ${safeNotes}`;

                    const response = await circuitBreaker('anthropic-listing-platform', () =>
                        withTimeout(anthropic.messages.create({
                            model: 'claude-sonnet-4-6',
                            max_tokens: 1500,
                            system: `You are an expert reseller. Generate a ${platformName} marketplace listing for the secondhand item described. Platform guidelines: title max ${guidelines.titleMax} chars, description max ${guidelines.descMax} chars, emphasize ${guidelines.emphasize}. Respond with ONLY valid JSON in this exact format: {"title":"listing title SEO-optimized for ${platformName}","description":"persuasive description with DETAILS section (brand, size, color, condition) and friendly closing line","tags":["up to 20 relevant search tags"],"suggestedPrice":number}`,
                            messages: [{ role: 'user', content: userContent }]
                        }), 30000, 'Anthropic platform listing generation'),
                        { failureThreshold: 3, cooldownMs: 60000 }
                    );

                    const m = response.content[0].text.trim().match(/\{[\s\S]*\}/);
                    if (m) {
                        const r = safeJsonParse(m[0], null);
                        if (r && r.title && r.description && Array.isArray(r.tags)) {
                            const priceRange = getPriceRange(context);
                            const resolvedPrice = r.suggestedPrice || priceRange.suggested;
                            const finalTitle = r.title.slice(0, guidelines.titleMax);
                            const finalDesc = r.description.slice(0, guidelines.descMax);
                            const finalTags = r.tags.slice(0, 20);
                            const quality = computeListingQualityScore(finalTitle, finalDesc, finalTags, resolvedPrice, guidelines);
                            return {
                                status: 200,
                                data: {
                                    title: finalTitle,
                                    description: finalDesc,
                                    tags: finalTags,
                                    aiSource: 'claude-sonnet',
                                    suggestedPrice: resolvedPrice,
                                    priceRange: { low: priceRange.low, suggested: resolvedPrice, high: priceRange.high },
                                    priceSource: priceRange.priceSource,
                                    category: context.category,
                                    brand: context.brand,
                                    platform,
                                    inventoryId: inventoryId || null,
                                    qualityScore: quality.score,
                                    qualityLabel: quality.label,
                                    qualityDetails: quality.details
                                }
                            };
                        }
                    }
                } catch (claudeErr) {
                    logger.warn('[AI] Claude Sonnet listing generation failed, falling back to Haiku/template', {
                        error: claudeErr.message,
                        inventoryId: inventoryId || null
                    });
                }
            }

            // Fallback: Haiku or template (via generateListing in listing-generator.js)
            const listing = await generateListing(context);
            const priceRange = getPriceRange(context);
            const fbTitle = listing.title.slice(0, guidelines.titleMax);
            const fbQuality = computeListingQualityScore(fbTitle, listing.description, listing.tags, priceRange.suggested, guidelines);

            return {
                status: 200,
                data: {
                    title: fbTitle,
                    description: listing.description,
                    tags: listing.tags,
                    aiSource: listing.source,
                    suggestedPrice: priceRange.suggested,
                    priceRange: { low: priceRange.low, suggested: priceRange.suggested, high: priceRange.high },
                    priceSource: priceRange.priceSource,
                    category: context.category,
                    brand: context.brand,
                    platform,
                    inventoryId: inventoryId || null,
                    imageAnalysis,
                    qualityScore: fbQuality.score,
                    qualityLabel: fbQuality.label,
                    qualityDetails: fbQuality.details
                }
            };
        } catch (error) {
            logger.error('[AI] AI generation failed', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'AI generation failed' } };
        }
    }

    // POST /api/ai/generate-title - Generate title only
    if (method === 'POST' && path === '/generate-title') {
        try {
            const { description, brand, category, keywords, condition, color, size } = body;

            if (!description && !keywords?.length) {
                return { status: 400, data: { error: 'Description or keywords required' } };
            }

            if (process.env.ANTHROPIC_API_KEY) {
                try {
                    const anthropic = getAnthropicClient();
                    const safeBrand = sanitizeForAI(brand || 'Unknown', 100);
                    const safeCategory = sanitizeForAI(category || 'Clothing', 100);
                    const safeKeywords = sanitizeForAI((keywords || []).join(', ') || 'N/A', 200);
                    const safeDesc = sanitizeForAI(description || 'N/A', 300);
                    const userContent = `Brand: ${safeBrand}\nCategory: ${safeCategory}\nCondition: ${sanitizeForAI(condition || 'N/A', 50)}\nColor: ${sanitizeForAI(color || 'N/A', 50)}\nSize: ${sanitizeForAI(size || 'N/A', 20)}\nKeywords: ${safeKeywords}\nDescription: ${safeDesc}`;
                    const response = await circuitBreaker('anthropic-title', () =>
                        withTimeout(anthropic.messages.create({
                            model: 'claude-haiku-4-5',
                            max_tokens: 128,
                            system: 'You are an expert reseller copywriter. Generate a single marketplace listing title (max 80 chars, SEO-optimized with brand and key attributes). Respond with ONLY the title text — no quotes, no JSON, no explanation.',
                            messages: [{ role: 'user', content: userContent }]
                        }), 15000, 'Anthropic title generation'),
                        { failureThreshold: 3, cooldownMs: 60000 }
                    );
                    const title = response.content[0].text.trim().slice(0, 80);
                    if (title) return { status: 200, data: { title, source: 'claude-haiku' } };
                } catch (err) {
                    logger.warn('[AI] Haiku title generation failed, falling back to template', { error: err.message });
                }
            }

            const title = generateTitle({ description, brand, category, keywords, condition, color, size });
            return { status: 200, data: { title, source: 'template' } };
        } catch (error) {
            logger.error('[AI] Error generating title', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/generate-description - Generate description
    if (method === 'POST' && path === '/generate-description') {
        try {
            const { title, brand, category, condition, size, color, material, keywords } = body;

            if (!title) {
                return { status: 400, data: { error: 'Title required' } };
            }

            if (process.env.ANTHROPIC_API_KEY) {
                try {
                    const anthropic = getAnthropicClient();
                    const userContent = `Title: ${sanitizeForAI(title, 100)}\nBrand: ${sanitizeForAI(brand || 'Unknown', 100)}\nCategory: ${sanitizeForAI(category || 'Clothing', 100)}\nCondition: ${sanitizeForAI(condition || 'good', 50)}\nSize: ${sanitizeForAI(size || 'N/A', 20)}\nColor: ${sanitizeForAI(color || 'N/A', 50)}\nMaterial: ${sanitizeForAI(material || 'N/A', 100)}\nKeywords: ${sanitizeForAI((keywords || []).join(', ') || 'N/A', 200)}`;
                    const response = await circuitBreaker('anthropic-description', () =>
                        withTimeout(anthropic.messages.create({
                            model: 'claude-haiku-4-5',
                            max_tokens: 700,
                            system: 'You are an expert reseller copywriter. Write a 200-500 word marketplace listing description for the secondhand item provided. Include a DETAILS section (brand, size, color, condition) and end with a friendly closing line. Respond with ONLY the description text — no JSON, no extra commentary.',
                            messages: [{ role: 'user', content: userContent }]
                        }), 20000, 'Anthropic description generation'),
                        { failureThreshold: 3, cooldownMs: 60000 }
                    );
                    const description = response.content[0].text.trim();
                    if (description) return { status: 200, data: { description, source: 'claude-haiku' } };
                } catch (err) {
                    logger.warn('[AI] Haiku description generation failed, falling back to template', { error: err.message });
                }
            }

            const description = generateDescription({ title, brand, category, condition, size, color, material, keywords });
            return { status: 200, data: { description, source: 'template' } };
        } catch (error) {
            logger.error('[AI] Error generating description', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/generate-tags - Generate tags/keywords
    if (method === 'POST' && path === '/generate-tags') {
        try {
            const { title, description, brand, category } = body;

            if (!title && !description) {
                return { status: 400, data: { error: 'Title or description required' } };
            }

            if (process.env.ANTHROPIC_API_KEY) {
                try {
                    const anthropic = getAnthropicClient();
                    const userContent = `Title: ${sanitizeForAI(title || 'N/A', 100)}\nDescription: ${sanitizeForAI(description || 'N/A', 300)}\nBrand: ${sanitizeForAI(brand || 'Unknown', 100)}\nCategory: ${sanitizeForAI(category || 'Clothing', 100)}`;
                    const response = await circuitBreaker('anthropic-tags', () =>
                        withTimeout(anthropic.messages.create({
                            model: 'claude-haiku-4-5',
                            max_tokens: 256,
                            system: 'You are an expert reseller. Generate up to 20 relevant search tags for the marketplace listing provided. Respond with ONLY a JSON array of lowercase strings, e.g. ["tag1","tag2"]. No explanation, no extra text.',
                            messages: [{ role: 'user', content: userContent }]
                        }), 15000, 'Anthropic tags generation'),
                        { failureThreshold: 3, cooldownMs: 60000 }
                    );
                    const m = response.content[0].text.trim().match(/\[[\s\S]*\]/);
                    if (m) {
                        const parsed = safeJsonParse(m[0], null);
                        if (Array.isArray(parsed) && parsed.length) {
                            return { status: 200, data: { tags: parsed.slice(0, 20), source: 'claude-haiku' } };
                        }
                    }
                } catch (err) {
                    logger.warn('[AI] Haiku tags generation failed, falling back to template', { error: err.message });
                }
            }

            const tags = generateTags({ title, description, brand, category });
            return { status: 200, data: { tags, source: 'template' } };
        } catch (error) {
            logger.error('[AI] Error generating tags', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/suggest-price - Suggest price based on item details
    if (method === 'POST' && path === '/suggest-price') {
        try {
            const { title, brand, category, condition, originalRetail } = body;

            // Get comparable sales from database first so predictor can use them
            const comparables = await query.all(`
                SELECT s.sale_price, i.brand, i.category, i.condition
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE i.category = ? AND i.user_id = ?
                ORDER BY s.created_at DESC
                LIMIT 10
            `, [category, user.id]);

            const priceRange = getPriceRange({
                title, brand, category, condition, originalRetail,
                historicalSales: comparables
            });

            return {
                status: 200,
                data: {
                    suggestedPrice: priceRange.suggested,
                    priceRange: { low: priceRange.low, suggested: priceRange.suggested, high: priceRange.high },
                    priceSource: priceRange.priceSource,
                    comparables
                }
            };
        } catch (error) {
            logger.error('[AI] Error suggesting price', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/analyze-image - Analyze product image
    if (method === 'POST' && path === '/analyze-image') {
        const { imageUrl, imageBase64 } = body;

        if (!imageUrl && !imageBase64) {
            return { status: 400, data: { error: 'Image URL or base64 required' } };
        }

        try {
            const analysis = await analyzeImage(imageUrl || imageBase64);

            return { status: 200, data: { analysis } };
        } catch (error) {
            logger.error('[AI] Image analysis failed', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Image analysis failed' } };
        }
    }

    // POST /api/ai/optimize-listing - Optimize existing listing
    if (method === 'POST' && path === '/optimize-listing') {
        try {
            const { listingId, inventoryId } = body;

            const item = inventoryId
                ? await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, user.id])
                : await query.get(`
                    SELECT i.* FROM listings l
                    JOIN inventory i ON l.inventory_id = i.id
                    WHERE l.id = ? AND l.user_id = ?
                `, [listingId, user.id]);

            if (!item) {
                return { status: 404, data: { error: 'Item not found' } };
            }

            const context = {
                title: item.title,
                description: item.description,
                brand: item.brand,
                category: item.category,
                condition: item.condition,
                keywords: safeJsonParse(item.tags, [])
            };

            const optimizedTitle = generateTitle(context);
            const optimizedDescription = generateDescription(context);
            const optimizedTags = generateTags(context);

            const suggestions = [];

            if (optimizedTitle !== item.title) {
                suggestions.push({
                    field: 'title',
                    current: item.title,
                    suggested: optimizedTitle,
                    reason: 'More descriptive and SEO-friendly'
                });
            }

            if (item.description?.length < 100) {
                suggestions.push({
                    field: 'description',
                    current: item.description,
                    suggested: optimizedDescription,
                    reason: 'More detailed description improves conversion'
                });
            }

            const currentTags = safeJsonParse(item.tags, []);
            const newTags = optimizedTags.filter(t => !currentTags.includes(t));
            if (newTags.length > 0) {
                suggestions.push({
                    field: 'tags',
                    current: currentTags,
                    suggested: [...currentTags, ...newTags].slice(0, 20),
                    reason: `Add ${newTags.length} more relevant tags for better discoverability`
                });
            }

            return { status: 200, data: { suggestions, optimizedTitle, optimizedDescription, optimizedTags } };
        } catch (error) {
            logger.error('[AI] Error optimizing listing', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/bulk-generate - Bulk generate for multiple items
    if (method === 'POST' && path === '/bulk-generate') {
        // Rate limit: 10 API calls per minute per user (bulk operations consume more allowance)
        const rateLimitKey = aiRateLimiter.getKey('claude-api', user?.id);
        const rateLimitResult = await aiRateLimiter.check(rateLimitKey, 'expensive', 'claude-api');
        if (!rateLimitResult.allowed) {
            return { status: 429, data: { error: 'Too many AI requests. Please wait before trying again.' } };
        }

        try {
            const { inventoryIds, fields = ['title', 'description', 'tags'] } = body;

            if (!inventoryIds || !Array.isArray(inventoryIds)) {
                return { status: 400, data: { error: 'Inventory IDs array required' } };
            }

            // Cap batch size to prevent abuse
            const ids = inventoryIds.slice(0, 100);

            // Batch fetch all items at once instead of N+1 individual queries
            const placeholders = ids.map(() => '?').join(',');
            const items = await query.all(
                `SELECT * FROM inventory WHERE id IN (${placeholders}) AND user_id = ?`,
                [...ids, user.id]
            );
            const itemMap = new Map(items.map(item => [item.id, item]));

            const results = [];

            for (const id of ids) {
                const item = itemMap.get(id);

                if (!item) {
                    results.push({ id, error: 'Not found' });
                    continue;
                }

                const context = {
                    title: item.title,
                    brand: item.brand,
                    category: item.category,
                    condition: item.condition,
                    size: item.size,
                    color: item.color,
                    keywords: safeJsonParse(item.tags, [])
                };

                const generated = {};

                if (fields.includes('title')) {
                    generated.title = generateTitle(context);
                }
                if (fields.includes('description')) {
                    generated.description = generateDescription(context);
                }
                if (fields.includes('tags')) {
                    generated.tags = generateTags(context);
                }
                if (fields.includes('price')) {
                    const { price } = predictPrice(context);
                    generated.suggestedPrice = price;
                }

                results.push({ id, generated });
            }

            return { status: 200, data: { results } };
        } catch (error) {
            logger.error('[AI] Error bulk generating', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/detect-duplicates - Find potential duplicate listings
    if (method === 'POST' && path === '/detect-duplicates') {
        try {
            const { inventoryId, threshold = AI_CONFIG.duplicateThreshold } = body;

            const item = await query.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [inventoryId, user.id]);

            if (!item) {
                return { status: 404, data: { error: 'Item not found' } };
            }

            // Find similar items based on title, brand, category
            const firstWord = (item.title?.split(' ')[0] || '').replace(/[%_\\]/g, '\\$&');
            const similar = await query.all(`
                SELECT * FROM inventory
                WHERE user_id = ? AND id != ? AND status != 'deleted'
                AND (
                    brand = ? OR category = ?
                    OR title ILIKE ? ESCAPE '\\'
                )
                LIMIT 20
            `, [user.id, inventoryId, item.brand, item.category, `%${firstWord}%`]);

            // Calculate similarity scores
            const duplicates = similar.map(s => {
                let score = 0;
                const w = AI_CONFIG.similarityWeights;
                if (s.brand === item.brand) score += w.brand;
                if (s.category === item.category) score += w.category;
                if (s.size === item.size) score += w.size;
                if (s.color === item.color) score += w.color;

                // Title similarity (simple word overlap)
                const itemWords = new Set(item.title?.toLowerCase().split(/\s+/) || []);
                const sWords = s.title?.toLowerCase().split(/\s+/) || [];
                const overlap = sWords.filter(w2 => itemWords.has(w2)).length;
                score += (overlap / Math.max(itemWords.size, sWords.length)) * w.title;

                return { ...s, similarityScore: score };
            }).filter(s => s.similarityScore >= threshold)
              .sort((a, b) => b.similarityScore - a.similarityScore);

            return { status: 200, data: { duplicates } };
        } catch (error) {
            logger.error('[AI] Error detecting duplicates', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/ai/sourcing-suggestions - Get AI sourcing suggestions
    if (method === 'GET' && path === '/sourcing-suggestions') {
        try {
            // Analyze user's successful sales to suggest what to source
            const topSellers = await query.all(`
                SELECT
                    i.category, i.brand,
                    COUNT(*) as sales,
                    AVG(s.net_profit) as avg_profit,
                    AVG(EXTRACT(EPOCH FROM (s.created_at - i.created_at)) / 86400) as avg_days_to_sell
                FROM sales s
                JOIN inventory i ON s.inventory_id = i.id
                WHERE s.user_id = ?
                GROUP BY i.category, i.brand
                HAVING sales >= 2
                ORDER BY avg_profit DESC
                LIMIT 10
            `, [user.id]);

            const suggestions = topSellers.map(item => ({
                category: item.category,
                brand: item.brand,
                reason: `${item.sales} sales with avg profit $${Math.round(item.avg_profit)} in ${Math.round(item.avg_days_to_sell)} days`,
                priority: item.avg_profit > 30 ? 'high' : item.avg_profit > 15 ? 'medium' : 'low'
            }));

            return { status: 200, data: { suggestions } };
        } catch (error) {
            logger.error('[AI] Error getting sourcing suggestions', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/ai/translate - Translate listing for international markets
    if (method === 'POST' && path === '/translate') {
        const { title, description, tags, targetLanguage = 'es', sourceLanguage = 'en' } = body;

        if (!title && !description) {
            return { status: 400, data: { error: 'Title or description required' } };
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            // Fallback: return simple translations for common languages
            const fallbackTranslations = {
                es: { prefix: '[ES] ', note: 'Translation requires API key' },
                fr: { prefix: '[FR] ', note: 'Translation requires API key' },
                de: { prefix: '[DE] ', note: 'Translation requires API key' },
                it: { prefix: '[IT] ', note: 'Translation requires API key' },
                pt: { prefix: '[PT] ', note: 'Translation requires API key' },
                ja: { prefix: '[JA] ', note: 'Translation requires API key' },
                zh: { prefix: '[ZH] ', note: 'Translation requires API key' }
            };
            const fb = fallbackTranslations[targetLanguage] || { prefix: `[${targetLanguage.toUpperCase()}] `, note: 'Translation requires API key' };
            return {
                status: 200,
                data: {
                    translatedTitle: title ? fb.prefix + title : null,
                    translatedDescription: description ? fb.prefix + description : null,
                    translatedTags: tags ? tags.map(t => fb.prefix + t) : null,
                    targetLanguage,
                    note: fb.note
                }
            };
        }

        try {
            const anthropic = getAnthropicClient();

            const languageNames = {
                es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
                pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese (Simplified)',
                ko: 'Korean', nl: 'Dutch', ru: 'Russian', ar: 'Arabic'
            };

            const targetLangName = languageNames[targetLanguage] || targetLanguage;

            const prompt = `Translate the following e-commerce listing content from ${sourceLanguage === 'en' ? 'English' : sourceLanguage} to ${targetLangName}.

Maintain the marketing tone and SEO optimization. Keep brand names, sizes, and measurements in their original form.

Content to translate:
${title ? `Title: "${title}"` : ''}
${description ? `Description: "${description}"` : ''}
${tags?.length ? `Tags: ${JSON.stringify(tags)}` : ''}

Return ONLY valid JSON with this structure:
{
  "translatedTitle": "translated title here",
  "translatedDescription": "translated description here",
  "translatedTags": ["tag1", "tag2", ...]
}`;

            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }]
            });

            const responseText = response.content[0].text;
            let translatedData;
            translatedData = safeJsonParse(responseText, null);
            if (!translatedData) {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                translatedData = jsonMatch ? safeJsonParse(jsonMatch[0], {}) : {};
            }

            return {
                status: 200,
                data: {
                    ...translatedData,
                    targetLanguage,
                    sourceLanguage,
                    aiProvider: 'claude-sonnet-4'
                }
            };
        } catch (error) {
            logger.error('[AI] Translation failed', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Translation failed' } };
        }
    }

    // POST /api/ai/category-mapping - Map categories across marketplaces
    if (method === 'POST' && path === '/category-mapping') {
      try {
        const { category, subcategory, sourcePlatform = 'poshmark', targetPlatforms = ['ebay', 'mercari', 'depop'] } = body;

        if (!category) {
            return { status: 400, data: { error: 'Category required' } };
        }

        // Comprehensive category mapping across platforms
        const categoryMappings = {
            'Tops': {
                poshmark: { category: 'Women > Tops', path: ['Women', 'Tops'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Tops & Blouses', categoryId: '53159' },
                mercari: { category: 'Women > Tops', categoryId: '4' },
                depop: { category: 'Tops', categoryId: 'tops' },
                grailed: { category: 'Tops', department: 'Womenswear' },
                facebook: { category: 'Clothing & Shoes > Women\'s Clothing > Tops' }
            },
            'Dresses': {
                poshmark: { category: 'Women > Dresses', path: ['Women', 'Dresses'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Dresses', categoryId: '63861' },
                mercari: { category: 'Women > Dresses', categoryId: '8' },
                depop: { category: 'Dresses', categoryId: 'dresses' },
                grailed: { category: 'Dresses', department: 'Womenswear' },
                facebook: { category: 'Clothing & Shoes > Women\'s Clothing > Dresses' }
            },
            'Jeans': {
                poshmark: { category: 'Women > Jeans', path: ['Women', 'Jeans'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Jeans', categoryId: '11554' },
                mercari: { category: 'Women > Pants > Jeans', categoryId: '12' },
                depop: { category: 'Bottoms > Jeans', categoryId: 'jeans' },
                grailed: { category: 'Bottoms > Jeans', department: 'Womenswear' },
                facebook: { category: 'Clothing & Shoes > Women\'s Clothing > Jeans' }
            },
            'Sneakers': {
                poshmark: { category: 'Women > Shoes > Sneakers', path: ['Women', 'Shoes', 'Sneakers'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Women\'s Shoes > Athletic Shoes', categoryId: '95672' },
                mercari: { category: 'Women > Shoes > Sneakers', categoryId: '20' },
                depop: { category: 'Shoes > Sneakers', categoryId: 'sneakers' },
                grailed: { category: 'Footwear > Low-Top Sneakers', department: 'Footwear' },
                facebook: { category: 'Clothing & Shoes > Women\'s Shoes > Athletic Shoes' }
            },
            'Handbags': {
                poshmark: { category: 'Women > Bags > Shoulder Bags', path: ['Women', 'Bags'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Women\'s Bags & Handbags', categoryId: '169291' },
                mercari: { category: 'Women > Bags > Handbags', categoryId: '30' },
                depop: { category: 'Bags', categoryId: 'bags' },
                grailed: { category: 'Accessories > Bags & Luggage', department: 'Accessories' },
                facebook: { category: 'Clothing & Shoes > Bags & Luggage > Handbags' }
            },
            'Outerwear': {
                poshmark: { category: 'Women > Jackets & Coats', path: ['Women', 'Jackets & Coats'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Coats, Jackets & Vests', categoryId: '63862' },
                mercari: { category: 'Women > Jackets & Coats', categoryId: '6' },
                depop: { category: 'Coats & Jackets', categoryId: 'coats-jackets' },
                grailed: { category: 'Outerwear', department: 'Womenswear' },
                facebook: { category: 'Clothing & Shoes > Women\'s Clothing > Coats & Jackets' }
            },
            'Accessories': {
                poshmark: { category: 'Women > Accessories', path: ['Women', 'Accessories'] },
                ebay: { category: 'Clothing, Shoes & Accessories > Women > Women\'s Accessories', categoryId: '4251' },
                mercari: { category: 'Women > Accessories', categoryId: '40' },
                depop: { category: 'Accessories', categoryId: 'accessories' },
                grailed: { category: 'Accessories', department: 'Accessories' },
                facebook: { category: 'Clothing & Shoes > Jewelry & Watches' }
            }
        };

        // Find the category mapping
        const normalizedCategory = Object.keys(categoryMappings).find(k =>
            k.toLowerCase() === category.toLowerCase() ||
            category.toLowerCase().includes(k.toLowerCase())
        ) || 'Accessories';

        const mapping = categoryMappings[normalizedCategory] || categoryMappings['Accessories'];

        // Build response for requested platforms
        const result = {};
        for (const platform of targetPlatforms) {
            if (mapping[platform]) {
                result[platform] = mapping[platform];
            } else {
                result[platform] = { category: category, note: 'Direct mapping not available' };
            }
        }

        return {
            status: 200,
            data: {
                sourceCategory: category,
                sourceSubcategory: subcategory,
                sourcePlatform,
                mappings: result
            }
        };
      } catch (error) {
          logger.error('[AI] Error mapping categories', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/ai/generate-hashtags - Generate optimized hashtags with trending analysis
    if (method === 'POST' && path === '/generate-hashtags') {
      try {
        const { title, description, brand, category, platform = 'poshmark', includeTrending = true } = body;

        if (!title && !description) {
            return { status: 400, data: { error: 'Title or description required' } };
        }

        // Platform-specific hashtag limits and styles
        const platformConfig = {
            poshmark: { limit: 5, prefix: '', style: 'camelCase' },
            ebay: { limit: 0, prefix: '', style: 'none', note: 'eBay does not use hashtags' },
            mercari: { limit: 3, prefix: '#', style: 'lowercase' },
            depop: { limit: 5, prefix: '#', style: 'lowercase' },
            instagram: { limit: 30, prefix: '#', style: 'lowercase' },
            grailed: { limit: 0, prefix: '', style: 'none', note: 'Grailed uses tags, not hashtags' }
        };

        const config = platformConfig[platform] || platformConfig.poshmark;

        if (config.limit === 0) {
            return {
                status: 200,
                data: {
                    hashtags: [],
                    platform,
                    note: config.note || 'This platform does not support hashtags'
                }
            };
        }

        // Generate base hashtags from item details
        const baseHashtags = new Set();

        // Brand hashtags
        if (brand) {
            baseHashtags.add(brand.replace(/\s+/g, '').toLowerCase());
            baseHashtags.add(`${brand.replace(/\s+/g, '')}style`.toLowerCase());
        }

        // Category hashtags
        if (category) {
            baseHashtags.add(category.toLowerCase().replace(/\s+/g, ''));
        }

        // Extract keywords from title and description
        const text = `${title || ''} ${description || ''}`.toLowerCase();
        const keywordPatterns = [
            /vintage/gi, /y2k/gi, /retro/gi, /boho/gi, /minimalist/gi,
            /designer/gi, /luxury/gi, /streetwear/gi, /preppy/gi, /casual/gi,
            /aesthetic/gi, /cottagecore/gi, /grunge/gi, /fairycore/gi
        ];

        keywordPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                matches.forEach(m => baseHashtags.add(m.toLowerCase()));
            }
        });

        // Trending hashtags by platform
        const trendingHashtags = {
            poshmark: ['poshfinds', 'closetcrush', 'styleinspo', 'fashionfinds', 'thriftedstyle'],
            depop: ['depopfamous', 'y2kfashion', 'vintagefinds', 'sustainablefashion', 'thrifted'],
            mercari: ['mercarifinds', 'fashiondeals', 'stylesteals'],
            instagram: ['ootd', 'fashionblogger', 'styleinspo', 'thrifthaul', 'sustainablestyle']
        };

        if (includeTrending && trendingHashtags[platform]) {
            trendingHashtags[platform].forEach(tag => baseHashtags.add(tag));
        }

        // General reseller hashtags
        const generalHashtags = ['thrifted', 'secondhand', 'reseller', 'sustainable', 'preowned'];
        generalHashtags.forEach(tag => baseHashtags.add(tag));

        // Format hashtags according to platform style
        let formattedHashtags = Array.from(baseHashtags).slice(0, config.limit * 2);

        if (config.style === 'camelCase') {
            formattedHashtags = formattedHashtags.map(tag =>
                tag.split(/(?=[A-Z])/).map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
            );
        }

        // Add prefix if needed
        if (config.prefix) {
            formattedHashtags = formattedHashtags.map(tag => config.prefix + tag);
        }

        // Limit to platform max
        formattedHashtags = formattedHashtags.slice(0, config.limit);

        return {
            status: 200,
            data: {
                hashtags: formattedHashtags,
                allSuggestions: Array.from(baseHashtags).map(tag => config.prefix + tag),
                platform,
                limit: config.limit,
                trending: includeTrending ? (trendingHashtags[platform] || []) : []
            }
        };
      } catch (error) {
          logger.error('[AI] Error generating hashtags', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/ai/image-enhancement - Get AI suggestions for image improvement
    if (method === 'POST' && path === '/image-enhancement') {
        const { imageBase64, imageMimeType, imageUrl } = body;

        if (!imageBase64 && !imageUrl) {
            return { status: 400, data: { error: 'Image required (base64 or URL)' } };
        }

        // Basic image analysis without AI
        const suggestions = [];
        const optimizations = [];

        // General best practices
        suggestions.push({
            type: 'lighting',
            suggestion: 'Ensure bright, even lighting with no harsh shadows',
            priority: 'high',
            impact: 'Better photos can increase sales by 30%'
        });

        suggestions.push({
            type: 'background',
            suggestion: 'Use a clean, neutral background (white or light gray works best)',
            priority: 'high',
            impact: 'Clean backgrounds improve perceived item quality'
        });

        suggestions.push({
            type: 'angles',
            suggestion: 'Include multiple angles: front, back, detail shots, and any flaws',
            priority: 'medium',
            impact: 'More angles reduce returns and increase buyer confidence'
        });

        suggestions.push({
            type: 'styling',
            suggestion: 'Consider flat lay or mannequin display for clothing items',
            priority: 'medium',
            impact: 'Styled photos can increase engagement by 40%'
        });

        suggestions.push({
            type: 'resolution',
            suggestion: 'Use at least 1000x1000 pixels for clear detail visibility',
            priority: 'high',
            impact: 'Higher resolution enables zoom functionality'
        });

        // Platform-specific recommendations
        const platformTips = {
            poshmark: 'Use square 1:1 aspect ratio, cover photo should show full item',
            ebay: 'White background preferred, include scale reference for size',
            mercari: 'Bright lighting essential, show item from multiple angles',
            depop: 'Lifestyle/styled photos perform well, show item being worn if possible'
        };

        // If we have API key, use Claude Vision for detailed analysis
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey && imageBase64) {
            try {
                const anthropic = getAnthropicClient();

                const prompt = `Analyze this product photo for an e-commerce listing. Provide specific, actionable feedback in JSON format:

{
  "overallScore": 1-10 rating,
  "lighting": { "score": 1-10, "issues": [], "suggestions": [] },
  "background": { "score": 1-10, "issues": [], "suggestions": [] },
  "composition": { "score": 1-10, "issues": [], "suggestions": [] },
  "focus": { "score": 1-10, "issues": [], "suggestions": [] },
  "productVisibility": { "score": 1-10, "issues": [], "suggestions": [] },
  "recommendedEdits": ["crop suggestion", "brightness adjustment", etc.],
  "missingShots": ["back view", "detail shot", etc.]
}

Be specific about what could be improved for better sales conversion.`;

                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 1500,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
                            { type: 'text', text: prompt }
                        ]
                    }]
                });

                const responseText = response.content[0].text;
                let aiAnalysis;
                aiAnalysis = safeJsonParse(responseText, null);
                if (!aiAnalysis) {
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    aiAnalysis = jsonMatch ? safeJsonParse(jsonMatch[0], null) : null;
                }

                if (aiAnalysis) {
                    return {
                        status: 200,
                        data: {
                            aiAnalysis,
                            generalSuggestions: suggestions,
                            platformTips,
                            aiProvider: 'claude-sonnet-4'
                        }
                    };
                }
            } catch (error) {
                logger.error('[AI] AI image analysis failed', user?.id || null, { detail: error.message });
                // Fall through to basic analysis
            }
        }

        // Return basic analysis without AI
        return {
            status: 200,
            data: {
                generalSuggestions: suggestions,
                platformTips,
                optimizations: [
                    { action: 'Auto-adjust brightness', tool: 'Photo Editor' },
                    { action: 'Remove background', tool: 'Background Remover' },
                    { action: 'Crop to square', tool: 'Crop Tool' },
                    { action: 'Enhance colors', tool: 'Color Adjustment' }
                ],
                note: 'For detailed AI analysis, configure ANTHROPIC_API_KEY'
            }
        };
    }

    // POST /api/ai/profit-prediction - Comprehensive profit prediction with fees and shipping
    if (method === 'POST' && path === '/profit-prediction') {
      try {
        const {
            platform = 'poshmark',
            category,
            weight: rawWeight = 1,
            shippingMethod = 'standard',
            buyerLocation = 'domestic'
        } = body;

        // Validate numeric inputs to prevent NaN propagation
        const listPrice = parseFloat(body.listPrice);
        const costPrice = parseFloat(body.costPrice) || 0;
        const weight = parseFloat(rawWeight) || 1;

        if (!Number.isFinite(listPrice) || listPrice <= 0) {
            return { status: 400, data: { error: 'listPrice must be a positive number' } };
        }

        if (!listPrice) {
            return { status: 400, data: { error: 'List price required' } };
        }

        // Platform fee structures (as of 2024)
        const platformFees = {
            poshmark: {
                flat: listPrice < 15 ? 2.95 : 0,
                percentage: listPrice >= 15 ? 0.20 : 0,
                shippingPaidBy: 'buyer',
                note: '$2.95 flat fee for items under $15, 20% for $15+'
            },
            ebay: {
                flat: 0.30, // insertion fee waived for most sellers
                percentage: 0.1325, // 13.25% final value fee (varies by category)
                paymentProcessing: 0.029 * listPrice + 0.30,
                shippingPaidBy: 'configurable',
                note: '13.25% final value fee + payment processing'
            },
            mercari: {
                flat: 0,
                percentage: 0.10,
                paymentProcessing: 0.029 * listPrice + 0.50,
                shippingPaidBy: 'configurable',
                note: '10% selling fee + payment processing'
            },
            depop: {
                flat: 0,
                percentage: 0.10,
                paymentProcessing: 0.029 * listPrice + 0.30,
                shippingPaidBy: 'configurable',
                note: '10% fee + payment processing (US)'
            },
            grailed: {
                flat: 0,
                percentage: 0.09,
                paymentProcessing: 0.029 * listPrice + 0.30,
                shippingPaidBy: 'seller_usually',
                note: '9% commission + payment processing'
            },
            facebook: {
                flat: 0,
                percentage: listPrice <= 8 ? 0 : 0.05,
                paymentProcessing: 0,
                shippingPaidBy: 'configurable',
                note: '5% fee (free for items $8 and under)'
            }
        };

        // Shipping cost estimates by weight and method
        const shippingCosts = {
            domestic: {
                standard: weight <= 1 ? 5.99 : weight <= 3 ? 8.99 : 12.99,
                priority: weight <= 1 ? 8.50 : weight <= 3 ? 14.00 : 20.00,
                ground: weight <= 1 ? 4.50 : weight <= 3 ? 6.50 : 9.00
            },
            international: {
                standard: weight <= 1 ? 15.00 : weight <= 3 ? 25.00 : 40.00,
                priority: weight <= 1 ? 28.00 : weight <= 3 ? 45.00 : 65.00
            }
        };

        const fees = platformFees[platform] || platformFees.poshmark;
        const shippingRegion = shippingCosts[buyerLocation] || shippingCosts.domestic;
        const shippingCost = shippingRegion[shippingMethod] || shippingRegion.standard;

        // Calculate fees
        const platformFee = fees.flat + (listPrice * fees.percentage);
        const paymentFee = fees.paymentProcessing || 0;
        const totalFees = platformFee + paymentFee;

        // Determine if seller pays shipping
        const sellerPaysShipping = fees.shippingPaidBy === 'seller_usually' ||
            (fees.shippingPaidBy === 'configurable' && body.sellerPaysShipping);
        const effectiveShipping = sellerPaysShipping ? shippingCost : 0;

        // Calculate profit
        const grossProfit = listPrice - totalFees - effectiveShipping - costPrice;
        const profitMargin = listPrice > 0 ? (grossProfit / listPrice * 100) : 0;
        const roi = costPrice > 0 ? (grossProfit / costPrice * 100) : 0;

        // Price recommendations for target margins
        const pm = AI_CONFIG.profitMargins;
        const targetMargins = {
            minimum: { margin: pm.minimum * 100, price: Math.ceil((costPrice + effectiveShipping) / (1 - fees.percentage - pm.minimum) / 0.95) },
            healthy: { margin: pm.healthy * 100, price: Math.ceil((costPrice + effectiveShipping) / (1 - fees.percentage - pm.healthy) / 0.95) },
            premium: { margin: pm.premium * 100, price: Math.ceil((costPrice + effectiveShipping) / (1 - fees.percentage - pm.premium) / 0.95) }
        };

        return {
            status: 200,
            data: {
                listPrice,
                costPrice,
                platform,
                breakdown: {
                    platformFee: Math.round(platformFee * 100) / 100,
                    paymentProcessingFee: Math.round(paymentFee * 100) / 100,
                    totalFees: Math.round(totalFees * 100) / 100,
                    shippingCost: Math.round(shippingCost * 100) / 100,
                    sellerPaysShipping,
                    effectiveShippingCost: Math.round(effectiveShipping * 100) / 100
                },
                profit: {
                    gross: Math.round(grossProfit * 100) / 100,
                    margin: Math.round(profitMargin * 10) / 10,
                    roi: Math.round(roi * 10) / 10
                },
                recommendations: targetMargins,
                platformNote: fees.note,
                comparison: Object.entries(platformFees).map(([p, f]) => {
                    const pFee = f.flat + (listPrice * f.percentage) + (f.paymentProcessing || 0);
                    const pProfit = listPrice - pFee - (f.shippingPaidBy === 'seller_usually' ? shippingCost : 0) - costPrice;
                    return { platform: p, fees: Math.round(pFee * 100) / 100, profit: Math.round(pProfit * 100) / 100 };
                }).sort((a, b) => b.profit - a.profit)
            }
        };
      } catch (error) {
          logger.error('[AI] Error predicting profit', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/ai/seo-optimize - Full SEO optimization for listings
    if (method === 'POST' && path === '/seo-optimize') {
      try {
        const { title, description, tags, brand, category, platform = 'poshmark' } = body;

        if (!title) {
            return { status: 400, data: { error: 'Title required' } };
        }

        // Platform-specific SEO guidelines
        const seoGuidelines = {
            poshmark: {
                titleLength: 80,
                descLength: 500,
                keyFeatures: ['brand first', 'condition', 'style keywords', 'size'],
                avoidWords: ['sale', 'discount', 'cheap', 'free shipping']
            },
            ebay: {
                titleLength: 80,
                descLength: 1000,
                keyFeatures: ['brand', 'model', 'size', 'color', 'condition', 'material'],
                avoidWords: ['wow', 'amazing', 'look', 'L@@K']
            },
            mercari: {
                titleLength: 40,
                descLength: 1000,
                keyFeatures: ['brand', 'condition', 'key feature'],
                avoidWords: ['sale', 'discount']
            },
            depop: {
                titleLength: 65,
                descLength: 1000,
                keyFeatures: ['aesthetic', 'y2k', 'vintage', 'style'],
                avoidWords: []
            }
        };

        const guidelines = seoGuidelines[platform] || seoGuidelines.poshmark;

        // Analyze current title
        const titleAnalysis = {
            length: title.length,
            optimal: title.length <= guidelines.titleLength,
            hasBrand: brand ? title.toLowerCase().includes(brand.toLowerCase()) : false,
            hasSize: /\b(xs|s|m|l|xl|xxl|\d+)\b/i.test(title),
            hasCondition: /\b(new|nwt|nwot|like new|excellent|good|fair)\b/i.test(title),
            wordsToAvoid: guidelines.avoidWords.filter(w => title.toLowerCase().includes(w))
        };

        // Generate optimized title
        let optimizedTitle = title;
        if (brand && !titleAnalysis.hasBrand) {
            optimizedTitle = `${brand} ${optimizedTitle}`;
        }
        if (optimizedTitle.length > guidelines.titleLength) {
            optimizedTitle = optimizedTitle.substring(0, guidelines.titleLength - 3) + '...';
        }

        // Generate SEO keywords
        const seoKeywords = new Set();
        if (brand) seoKeywords.add(brand.toLowerCase());
        if (category) seoKeywords.add(category.toLowerCase());

        // Extract from title
        const words = title.toLowerCase().split(/\s+/);
        words.forEach(w => {
            if (w.length > 3 && !['with', 'the', 'and', 'for'].includes(w)) {
                seoKeywords.add(w);
            }
        });

        // Keyword density analysis for description
        let keywordDensity = {};
        if (description) {
            const descWords = description.toLowerCase().split(/\s+/);
            const totalWords = descWords.length;
            seoKeywords.forEach(kw => {
                const count = descWords.filter(w => w.includes(kw)).length;
                keywordDensity[kw] = {
                    count,
                    density: Math.round((count / totalWords) * 100 * 10) / 10
                };
            });
        }

        return {
            status: 200,
            data: {
                original: { title, description, tags },
                optimized: {
                    title: optimizedTitle,
                    suggestedKeywords: Array.from(seoKeywords).slice(0, 15)
                },
                analysis: {
                    title: titleAnalysis,
                    keywordDensity,
                    platformGuidelines: guidelines
                },
                suggestions: [
                    !titleAnalysis.hasBrand && brand ? `Add brand name "${brand}" to title for better searchability` : null,
                    !titleAnalysis.hasSize ? 'Include size in title for better matching' : null,
                    !titleAnalysis.hasCondition ? 'Add condition (NWT, EUC, etc.) to improve trust' : null,
                    titleAnalysis.wordsToAvoid.length > 0 ? `Avoid words: ${titleAnalysis.wordsToAvoid.join(', ')}` : null,
                    title.length > guidelines.titleLength ? `Title exceeds ${guidelines.titleLength} char limit` : null
                ].filter(Boolean)
            }
        };
      } catch (error) {
          logger.error('[AI] Error optimizing SEO', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/ai/auto-categorize - Auto-categorize item from title/description
    if (method === 'POST' && path === '/auto-categorize') {
      try {
        const { title, description, brand } = body;

        if (!title && !description) {
            return { status: 400, data: { error: 'Title or description required' } };
        }

        const text = `${title || ''} ${description || ''}`.toLowerCase();

        // Category detection patterns
        const categoryPatterns = {
            'Tops': ['top', 'shirt', 'blouse', 'tee', 't-shirt', 'tank', 'cami', 'polo', 'henley', 'crop top'],
            'Dresses': ['dress', 'gown', 'maxi', 'midi', 'mini dress', 'sundress', 'romper', 'jumpsuit'],
            'Bottoms': ['pants', 'jeans', 'shorts', 'skirt', 'leggings', 'trousers', 'joggers', 'culottes'],
            'Outerwear': ['jacket', 'coat', 'blazer', 'cardigan', 'hoodie', 'sweater', 'vest', 'parka', 'puffer'],
            'Shoes': ['shoes', 'sneakers', 'boots', 'heels', 'sandals', 'flats', 'loafers', 'mules', 'slides'],
            'Bags': ['bag', 'purse', 'handbag', 'tote', 'clutch', 'backpack', 'crossbody', 'satchel', 'wallet'],
            'Accessories': ['jewelry', 'necklace', 'bracelet', 'earrings', 'ring', 'watch', 'scarf', 'belt', 'hat', 'sunglasses'],
            'Activewear': ['athletic', 'workout', 'yoga', 'gym', 'sports bra', 'leggings', 'running']
        };

        // Size detection
        const sizePatterns = {
            'XS': ['xs', 'extra small', 'x-small'],
            'S': ['\\bs\\b', 'small', 'size s'],
            'M': ['\\bm\\b', 'medium', 'size m'],
            'L': ['\\bl\\b', 'large', 'size l'],
            'XL': ['xl', 'extra large', 'x-large'],
            'XXL': ['xxl', '2xl', '2x'],
            '0': ['size 0', '\\b0\\b'],
            '2': ['size 2', '\\b2\\b'],
            '4': ['size 4', '\\b4\\b'],
            '6': ['size 6', '\\b6\\b'],
            '8': ['size 8', '\\b8\\b'],
            '10': ['size 10', '\\b10\\b'],
            '12': ['size 12', '\\b12\\b']
        };

        // Color detection
        const colorPatterns = ['black', 'white', 'red', 'blue', 'navy', 'green', 'pink', 'purple', 'yellow', 'orange', 'brown', 'beige', 'cream', 'gray', 'grey', 'gold', 'silver', 'multi'];

        // Condition detection
        const conditionPatterns = {
            'new': ['nwt', 'new with tags', 'brand new', 'never worn', 'bnwt'],
            'like_new': ['nwot', 'new without tags', 'like new', 'mint', 'excellent'],
            'good': ['good condition', 'guc', 'euc', 'excellent used', 'great condition'],
            'fair': ['fair condition', 'some wear', 'minor flaws', 'used']
        };

        // Detect category
        let detectedCategory = null;
        let categoryConfidence = 0;
        for (const [cat, patterns] of Object.entries(categoryPatterns)) {
            for (const pattern of patterns) {
                if (text.includes(pattern)) {
                    detectedCategory = cat;
                    categoryConfidence = AI_CONFIG.categoryConfidence;
                    break;
                }
            }
            if (detectedCategory) break;
        }

        // Detect size
        let detectedSize = null;
        for (const [size, patterns] of Object.entries(sizePatterns)) {
            for (const pattern of patterns) {
                if (new RegExp(pattern, 'i').test(text)) { // nosemgrep: javascript.lang.security.detect-non-literal-regexp
                    detectedSize = size;
                    break;
                }
            }
            if (detectedSize) break;
        }

        // Detect color
        const detectedColors = colorPatterns.filter(color => text.includes(color));

        // Detect condition
        let detectedCondition = 'good'; // default
        for (const [condition, patterns] of Object.entries(conditionPatterns)) {
            for (const pattern of patterns) {
                if (text.includes(pattern)) {
                    detectedCondition = condition;
                    break;
                }
            }
        }

        return {
            status: 200,
            data: {
                category: detectedCategory || 'Accessories',
                categoryConfidence,
                size: detectedSize,
                color: detectedColors[0] || null,
                colors: detectedColors,
                condition: detectedCondition,
                brand: brand || detectBrand(title || ''),
                suggestions: {
                    category: detectedCategory ? null : 'Could not auto-detect category, please select manually',
                    size: detectedSize ? null : 'Size not detected, please specify',
                    color: detectedColors.length === 0 ? 'Color not detected, please specify' : null
                }
            }
        };
      } catch (error) {
          logger.error('[AI] Error auto-categorizing', user?.id, { detail: error.message });
          return { status: 500, data: { error: 'Internal server error' } };
      }
    }

    // POST /api/ai/identify - Identify a product from an image using Claude Vision + reference DB
    if (method === 'POST' && path === '/identify') {
        const rateLimitKey = aiRateLimiter.getKey('claude-api', user?.id);
        const rateLimitResult = await aiRateLimiter.check(rateLimitKey, 'expensive', 'claude-api');
        if (!rateLimitResult.allowed) {
            return { status: 429, data: { error: 'Too many AI requests. Please wait before trying again.' } };
        }

        const { imageBase64, imageMimeType, platform } = body;

        if (platform && !LAUNCH_PLATFORMS.has(platform)) {
            return { status: 400, data: { error: `Platform '${platform}' is not supported at launch` } };
        }

        if (!imageBase64) {
            return { status: 400, data: { error: 'Image data required (base64)' } };
        }

        const imgValidation = validateBase64Image(imageBase64, imageMimeType);
        if (!imgValidation.valid) {
            return { status: 400, data: { error: imgValidation.error } };
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            return { status: 503, data: { error: 'AI service not configured. Please set ANTHROPIC_API_KEY environment variable.' } };
        }

        try {
            const hash = createHash('sha256').update(imageBase64).digest('hex');

            const cached = await getCachedResponse(hash);
            if (cached) {
                return { status: 200, data: cached };
            }

            const anthropic = getAnthropicClient();
            const systemPrompt = 'You are a product identification expert for resellers. Analyze the product image and identify it precisely. ALWAYS provide a SINGLE best-guess brand and model even when no logo is visible — infer from shape, style, materials, and design cues (e.g. an unbranded knit beanie can still be guessed as "Carhartt-style watch cap"). Use a low confidence value (0.2-0.5) to signal uncertainty rather than returning null. Only return null brand/model if the image is genuinely unidentifiable (blurry, no product visible). NEVER return alternatives in brand or model fields — no "or", no slashes, no parentheses with alternatives. Pick ONE. Wrong: "iPhone 12 Pro or iPhone 13 Pro" / "IKEA or Generic" / "Apple/Samsung". Right: "iPhone 13 Pro" / "IKEA" / "Apple". Respond ONLY with valid JSON: {"brand":"best-guess brand","model":"best-guess model name","category":"Women\'s Clothing/Men\'s Clothing/Denim/Sneakers/Handbags & Accessories/Activewear/Outerwear/Electronics/Kitchen & Home Appliances/Vintage Kitchen & Glass/Furniture/Watches/Jewelry/Toys & Games/Sports Equipment/Books & Media/Art & Decor/Cameras & Photo/Musical Instruments/Baby & Kids/Pet Items/Craft Supplies/Outdoor & Garden/Collectibles & Memorabilia/Automotive Parts/Trading Cards/K-pop & Anime Merchandise/Vintage & Y2K Clothing/Etsy Personalized Items","subcategory":"specific subcategory","condition":"NWT/NWOT/EUC/GUC/Fair/Poor","colors":["primary","secondary"],"tags":["tag1","tag2"],"title":"suggested listing title","description":"suggested listing description","suggested_price":0.00,"confidence":0.0,"logo_visible":true,"identification_basis":"logo|design|inference"}';

            let visionText;
            try {
                const visionResponse = await anthropic.messages.create({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [{
                        role: 'user',
                        content: [
                            { type: 'image', source: { type: 'base64', media_type: imageMimeType || 'image/jpeg', data: imageBase64 } },
                            { type: 'text', text: 'Identify this product.' }
                        ]
                    }]
                });
                visionText = visionResponse.content[0].text;
            } catch (visionErr) {
                logger.error('[AI] identify: Claude Vision failed', user?.id, { detail: visionErr.message });
                return { status: 502, data: { error: 'AI vision service error. Please try again.' } };
            }

            let identified = safeJsonParse(visionText, null);
            if (!identified) {
                const jsonMatch = visionText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                if (jsonMatch) identified = safeJsonParse(jsonMatch[1], null);
            }
            if (!identified) {
                const objectMatch = visionText.match(/\{[\s\S]*\}/);
                if (objectMatch) identified = safeJsonParse(objectMatch[0], null);
            }
            if (!identified) {
                logger.error('[AI] identify: could not parse Vision response', user?.id, { raw: visionText?.slice(0, 200) });
                return { status: 502, data: { error: 'AI returned an unparseable response. Please try again.' } };
            }

            const searchText = buildSearchText(identified.brand, identified.model, identified.category, identified.subcategory);
            const similarItems = await findSimilar(searchText, { threshold: 0.3, limit: 5, brand: identified.brand });

            // Sanitize Vision output: keep first alternative if it returned multiple ("X or Y"),
            // strip parenthetical descriptions, drop description-as-brand placeholders.
            const pickFirst = (s) => {
                if (!s || typeof s !== 'string') return s;
                // Drop parens only if they contain no digits — keeps "(40oz)" / "(2L)" / "(2024)",
                // strips "(Unbranded)" / "(maybe XYZ)".
                let v = s.replace(/\s*\(([^)]*)\)\s*/g, (m, inside) => /\d/.test(inside) ? ' ('+inside+') ' : ' ').trim();
                v = v.replace(/\s{2,}/g, ' ');
                // Take only the first alternative when separated by " or ", "/", " / "
                v = v.split(/\s+(?:or|\/)\s+|\s*\/\s*/i)[0].trim();
                return v || null;
            };
            identified.brand = pickFirst(identified.brand);
            identified.model = pickFirst(identified.model);
            const rawBrand = identified.brand;
            if (rawBrand && /^(unbranded|generic|no brand|unknown|none)$/i.test(rawBrand)) {
                identified.brand = null;
            }

            const confidence = typeof identified.confidence === 'number' ? identified.confidence : 0;
            const logoVisible = identified.logo_visible !== false; // default true if Vision didn't return it
            const hasBrand = identified.brand && identified.brand !== 'null';

            let pricingInfo = {
                suggested_price: identified.suggested_price || null,
                price_range: null,
                based_on_sold_count: 0
            };
            let source = 'ai-vision';
            let matchQuality = 'no_match'; // no_match | brand_only | model_match | exact_match

            const topMatch = similarItems[0];
            if (topMatch && topMatch.sim > 0.3) {
                // Determine match quality before trusting DB pricing.
                // Only "exact_match" or "model_match" pricing should override Vision's estimate;
                // brand-only/cross-brand matches are shown as "related" but don't drive price.
                const sameBrand = hasBrand && topMatch.brand && topMatch.brand.toLowerCase() === identified.brand.toLowerCase();
                const sameModel = identified.model && topMatch.model && topMatch.model.toLowerCase() === identified.model.toLowerCase();
                if (sameBrand && sameModel) matchQuality = 'exact_match';
                else if (sameBrand && topMatch.sim > 0.5) matchQuality = 'model_match';
                else if (sameBrand) matchQuality = 'brand_only';
                else matchQuality = 'related';

                if (matchQuality === 'exact_match' || matchQuality === 'model_match') {
                    source = 'ai-vision+reference-match';
                    // Only use prices from same-brand+similar-model items (filter out cross-brand noise)
                    const validPrices = similarItems
                        .filter(i => i.brand && i.brand.toLowerCase() === identified.brand.toLowerCase())
                        .map(i => parseFloat(i.avg_sold_price))
                        .filter(p => !isNaN(p) && p > 0);
                    if (validPrices.length > 0) {
                        const avg = validPrices.reduce((a, b) => a + b, 0) / validPrices.length;
                        pricingInfo = {
                            suggested_price: identified.suggested_price || Math.round(avg * 100) / 100,
                            price_range: {
                                min: Math.min(...validPrices),
                                max: Math.max(...validPrices),
                                avg: Math.round(avg * 100) / 100
                            },
                            based_on_sold_count: similarItems
                                .filter(i => i.brand && i.brand.toLowerCase() === identified.brand.toLowerCase())
                                .reduce((sum, i) => sum + (i.sold_count || 0), 0)
                        };
                    }
                }
            }
            let warning = null;
            if (!hasBrand) {
                warning = 'No identifiable brand or logo visible in this photo. Results are based on visual inference only and may be inaccurate. For best results, upload a photo that clearly shows the brand logo, label, or product tag.';
            } else if (confidence < 0.6 || !logoVisible) {
                warning = 'Brand identified by visual inference (no clear logo visible). For higher accuracy, upload a photo showing the brand logo or label.';
            }

            const responseData = {
                identification: {
                    brand: identified.brand || null,
                    model: identified.model || null,
                    category: identified.category || null,
                    subcategory: identified.subcategory || null,
                    condition: identified.condition || null,
                    colors: Array.isArray(identified.colors) ? identified.colors : [],
                    tags: Array.isArray(identified.tags) ? identified.tags : [],
                    confidence,
                    logo_visible: logoVisible,
                    identification_basis: identified.identification_basis || (logoVisible ? 'logo' : 'inference')
                },
                pricing: pricingInfo,
                match_quality: matchQuality, // exact_match | model_match | brand_only | related | no_match
                listing: {
                    title: identified.title || null,
                    description: identified.description || null,
                    tags: Array.isArray(identified.tags) ? identified.tags : []
                },
                similar_items: similarItems.slice(0, 5).map(i => ({
                    title: i.title,
                    brand: i.brand || null,
                    model: i.model || null,
                    price: parseFloat(i.avg_sold_price) || null,
                    similarity: i.sim
                })),
                source,
                warning
            };

            await setCachedResponse(hash, responseData);

            // Only auto-store when we got a HIGH-CONFIDENCE brand+model AND no good DB match exists.
            // Storing low-confidence visual-inference guesses (logo not visible, low confidence)
            // pollutes the DB with potentially wrong brands that then outrank correct items on
            // future trigram searches.
            const shouldStore = hasBrand
                && identified.model
                && logoVisible
                && confidence >= 0.7
                && (!topMatch || topMatch.sim <= 0.7);
            if (shouldStore) {
                await storeReference({
                    brand: identified.brand,
                    model: identified.model,
                    category: identified.category || 'Uncategorized',
                    subcategory: identified.subcategory,
                    title: identified.title || `${identified.brand} ${identified.model}`,
                    avgSoldPrice: identified.suggested_price
                });
            }

            return { status: 200, data: responseData };
        } catch (err) {
            logger.error('[AI] identify: unexpected error', user?.id, { detail: err.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
