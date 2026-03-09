// AI Listing Generator - Local pattern-based generation with Claude API fallback
// Generates titles, descriptions, and tags using templates and rules

import Anthropic from '@anthropic-ai/sdk';
import { analyzeImage } from './image-analyzer.js';

// Brand-specific styling words
const BRAND_STYLES = {
    'Nike': ['athletic', 'sporty', 'performance', 'swoosh'],
    'Adidas': ['athletic', 'sporty', 'three stripes', 'performance'],
    'Levi\'s': ['denim', 'classic', 'authentic', 'timeless'],
    'Ralph Lauren': ['preppy', 'classic', 'polo', 'sophisticated'],
    'Coach': ['designer', 'leather', 'luxury', 'quality'],
    'Michael Kors': ['designer', 'modern', 'chic', 'luxury'],
    'Gucci': ['luxury', 'designer', 'high-end', 'iconic'],
    'Louis Vuitton': ['luxury', 'designer', 'iconic', 'prestigious'],
    'Chanel': ['luxury', 'elegant', 'timeless', 'iconic'],
    'Prada': ['luxury', 'designer', 'Italian', 'sophisticated'],
    'Zara': ['trendy', 'modern', 'fast fashion', 'stylish'],
    'H&M': ['trendy', 'affordable', 'modern', 'casual'],
    'Free People': ['boho', 'bohemian', 'free-spirited', 'effortless'],
    'Anthropologie': ['artsy', 'unique', 'eclectic', 'whimsical'],
    'Urban Outfitters': ['trendy', 'vintage-inspired', 'hipster', 'cool'],
    'Patagonia': ['outdoor', 'sustainable', 'adventure', 'quality'],
    'North Face': ['outdoor', 'adventure', 'performance', 'durable'],
    'Vintage': ['retro', 'classic', 'one-of-a-kind', 'nostalgic']
};

// Category-specific descriptions
const CATEGORY_TEMPLATES = {
    'Tops': {
        intro: ['Gorgeous', 'Beautiful', 'Stunning', 'Lovely', 'Classic'],
        features: ['flattering fit', 'soft fabric', 'versatile style', 'perfect for layering'],
        occasions: ['casual outings', 'work', 'everyday wear', 'date night']
    },
    'Bottoms': {
        intro: ['Perfect', 'Classic', 'Stylish', 'Essential', 'Flattering'],
        features: ['comfortable fit', 'quality construction', 'versatile styling', 'true to size'],
        occasions: ['casual wear', 'work', 'weekend outings', 'everyday style']
    },
    'Dresses': {
        intro: ['Stunning', 'Gorgeous', 'Beautiful', 'Elegant', 'Lovely'],
        features: ['flattering silhouette', 'quality fabric', 'perfect length', 'easy to style'],
        occasions: ['special events', 'date night', 'weddings', 'parties']
    },
    'Outerwear': {
        intro: ['Classic', 'Stylish', 'Cozy', 'Essential', 'Perfect'],
        features: ['warm and comfortable', 'quality materials', 'timeless design', 'functional pockets'],
        occasions: ['fall weather', 'winter layering', 'everyday wear', 'outdoor activities']
    },
    'Footwear': {
        intro: ['Classic', 'Stylish', 'Comfortable', 'Essential', 'Perfect'],
        features: ['comfortable fit', 'quality construction', 'versatile style', 'durable materials'],
        occasions: ['everyday wear', 'casual outings', 'work', 'special occasions']
    },
    'Bags': {
        intro: ['Beautiful', 'Classic', 'Stylish', 'Gorgeous', 'Perfect'],
        features: ['spacious interior', 'quality hardware', 'durable construction', 'versatile design'],
        occasions: ['everyday use', 'work', 'travel', 'special occasions']
    },
    'Accessories': {
        intro: ['Beautiful', 'Elegant', 'Classic', 'Stylish', 'Perfect'],
        features: ['quality materials', 'timeless design', 'versatile styling', 'attention to detail'],
        occasions: ['everyday wear', 'special occasions', 'gifting', 'statement piece']
    }
};

// Condition descriptions
const CONDITION_DESCRIPTIONS = {
    'new': 'Brand new with tags, never worn.',
    'like_new': 'Like new condition, worn once or twice. No visible signs of wear.',
    'good': 'Good pre-owned condition with minor signs of wear. Well cared for.',
    'fair': 'Fair condition with some visible wear. Priced accordingly.',
    'poor': 'Shows significant wear. Sold as-is for crafting or parts.'
};

// Color adjectives
const COLOR_ADJECTIVES = {
    'Black': ['classic', 'timeless', 'versatile', 'sleek'],
    'White': ['fresh', 'crisp', 'clean', 'bright'],
    'Blue': ['cool', 'classic', 'versatile', 'nautical'],
    'Red': ['bold', 'vibrant', 'statement', 'eye-catching'],
    'Pink': ['feminine', 'pretty', 'soft', 'romantic'],
    'Green': ['fresh', 'earthy', 'natural', 'vibrant'],
    'Navy': ['classic', 'nautical', 'sophisticated', 'timeless'],
    'Gray': ['neutral', 'versatile', 'sophisticated', 'modern'],
    'Brown': ['earthy', 'warm', 'classic', 'rich'],
    'Beige': ['neutral', 'classic', 'versatile', 'sophisticated']
};

/**
 * Generate a listing title
 */
export function generateTitle(context) {
    const { brand, category, color, size, condition, keywords = [], description } = context;

    const parts = [];

    // Add brand if available
    if (brand && brand !== 'Vintage' && brand !== 'Unknown') {
        parts.push(brand);
    }

    // Add color if available
    if (color) {
        parts.push(color);
    }

    // Add category or item type
    if (category) {
        parts.push(category);
    } else if (description) {
        // Extract item type from description
        const itemTypes = ['shirt', 'top', 'blouse', 'dress', 'pants', 'jeans', 'jacket', 'coat', 'sweater', 'skirt', 'shorts', 'bag', 'shoes', 'sneakers', 'boots', 'heels'];
        const found = itemTypes.find(type => description.toLowerCase().includes(type));
        if (found) parts.push(found.charAt(0).toUpperCase() + found.slice(1));
    }

    // Add size if relevant
    if (size && !['OS', 'One Size', 'N/A'].includes(size)) {
        parts.push(`Size ${size}`);
    }

    // Add condition indicator for non-new items
    if (condition === 'like_new') {
        parts.push('- Like New');
    } else if (condition === 'new') {
        parts.push('- NWT');
    }

    // Add key descriptors from keywords
    const descriptors = keywords.slice(0, 2).filter(k =>
        !parts.some(p => p.toLowerCase().includes(k.toLowerCase()))
    );
    if (descriptors.length > 0) {
        parts.splice(1, 0, descriptors.join(' '));
    }

    let title = parts.filter(Boolean).join(' ');

    // Ensure title isn't too long (most platforms limit to 80 chars)
    if (title.length > 80) {
        title = title.substring(0, 77) + '...';
    }

    return title;
}

/**
 * Generate a listing description
 */
export function generateDescription(context) {
    const {
        title, brand, category, condition, size, color,
        material, keywords = [], measurements
    } = context;

    const lines = [];

    // Opening line
    const categoryKey = findCategoryKey(category);
    const templates = CATEGORY_TEMPLATES[categoryKey] || CATEGORY_TEMPLATES['Tops'];
    const intro = templates.intro[Math.floor(Math.random() * templates.intro.length)];

    let opening = `${intro} ${brand || ''} ${category || 'item'}`.trim();
    if (color) {
        const colorAdj = COLOR_ADJECTIVES[color]?.[0] || 'beautiful';
        opening += ` in a ${colorAdj} ${color.toLowerCase()} shade`;
    }
    opening += '.';
    lines.push(opening);

    // Brand-specific line
    if (brand && BRAND_STYLES[brand]) {
        const styles = BRAND_STYLES[brand];
        const style = styles[Math.floor(Math.random() * styles.length)];
        lines.push(`Known for their ${style} aesthetic, ${brand} delivers quality and style.`);
    }

    // Features
    const feature = templates.features[Math.floor(Math.random() * templates.features.length)];
    lines.push(`Features ${feature}.`);

    // Occasion
    const occasion = templates.occasions[Math.floor(Math.random() * templates.occasions.length)];
    lines.push(`Perfect for ${occasion}.`);

    // Add blank line
    lines.push('');

    // Details section
    lines.push('📋 DETAILS:');

    if (brand) lines.push(`• Brand: ${brand}`);
    if (size) lines.push(`• Size: ${size}`);
    if (color) lines.push(`• Color: ${color}`);
    if (material) lines.push(`• Material: ${material}`);
    if (condition) {
        lines.push(`• Condition: ${condition.charAt(0).toUpperCase() + condition.slice(1).replace('_', ' ')}`);
    }

    // Add measurements if provided
    if (measurements) {
        lines.push('');
        lines.push('📏 MEASUREMENTS:');
        for (const [key, value] of Object.entries(measurements)) {
            lines.push(`• ${key}: ${value}`);
        }
    }

    // Condition note
    lines.push('');
    lines.push(CONDITION_DESCRIPTIONS[condition] || CONDITION_DESCRIPTIONS['good']);

    // Closing
    lines.push('');
    lines.push('💕 Thank you for shopping my closet! Bundle and save on shipping!');

    return lines.join('\n');
}

/**
 * Generate tags/keywords for a listing
 */
export function generateTags(context) {
    const { title, description, brand, category, color, keywords = [] } = context;

    const tags = new Set(keywords.map(k => k.toLowerCase()));

    // Add brand tags
    if (brand) {
        tags.add(brand.toLowerCase());
        tags.add(brand.toLowerCase().replace(/['\s]/g, ''));
    }

    // Add category tags
    if (category) {
        tags.add(category.toLowerCase());
        // Add related category tags
        const relatedTags = getCategoryTags(category);
        relatedTags.forEach(t => tags.add(t));
    }

    // Add color tags
    if (color) {
        tags.add(color.toLowerCase());
    }

    // Extract tags from title and description
    const text = `${title || ''} ${description || ''}`.toLowerCase();
    const commonTags = [
        'vintage', 'retro', 'boho', 'bohemian', 'minimalist', 'classic',
        'trendy', 'y2k', '90s', '80s', 'designer', 'luxury', 'streetwear',
        'athletic', 'casual', 'formal', 'preppy', 'grunge', 'cottagecore'
    ];

    for (const tag of commonTags) {
        if (text.includes(tag)) {
            tags.add(tag);
        }
    }

    // Add some standard reseller tags
    tags.add('thrifted');
    tags.add('secondhand');
    tags.add('sustainable');

    // Convert to array and limit
    return Array.from(tags).slice(0, 20);
}

/**
 * Find matching category key
 */
function findCategoryKey(category) {
    if (!category) return 'Tops';

    const lower = category.toLowerCase();

    if (lower.includes('top') || lower.includes('shirt') || lower.includes('blouse') || lower.includes('sweater')) {
        return 'Tops';
    }
    if (lower.includes('pant') || lower.includes('jean') || lower.includes('short') || lower.includes('skirt') || lower.includes('bottom')) {
        return 'Bottoms';
    }
    if (lower.includes('dress')) {
        return 'Dresses';
    }
    if (lower.includes('jacket') || lower.includes('coat') || lower.includes('outerwear')) {
        return 'Outerwear';
    }
    if (lower.includes('shoe') || lower.includes('boot') || lower.includes('sneaker') || lower.includes('heel') || lower.includes('sandal') || lower.includes('footwear')) {
        return 'Footwear';
    }
    if (lower.includes('bag') || lower.includes('purse') || lower.includes('tote') || lower.includes('clutch')) {
        return 'Bags';
    }

    return 'Accessories';
}

/**
 * Get related category tags
 */
function getCategoryTags(category) {
    const tagMap = {
        'Tops': ['top', 'shirt', 'blouse', 'womens-tops', 'fashion'],
        'Bottoms': ['bottoms', 'pants', 'womens-bottoms', 'fashion'],
        'Dresses': ['dress', 'dresses', 'womens-dresses', 'fashion'],
        'Outerwear': ['jacket', 'coat', 'outerwear', 'layering'],
        'Footwear': ['shoes', 'footwear', 'womens-shoes'],
        'Bags': ['bag', 'purse', 'handbag', 'accessories'],
        'Accessories': ['accessories', 'jewelry', 'fashion-accessories']
    };

    const key = findCategoryKey(category);
    return tagMap[key] || ['fashion', 'style'];
}

// analyzeImage is imported from image-analyzer.js and re-exported for backward compatibility
export { analyzeImage };

/**
 * Generate title, description, and tags via Claude Haiku in one API call.
 * Falls back to local template functions if API is unavailable or fails.
 */
export async function generateListing(context) {
    const { brand, category, condition, color, size, originalPrice, notes, keywords = [] } = context;

    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

            const prompt = `You are an expert reseller. Generate a marketplace listing for this secondhand item.

Brand: ${brand || 'Unknown'}
Category: ${category || 'Clothing'}
Condition: ${condition || 'good'}
Color: ${color || 'N/A'}
Size: ${size || 'N/A'}
Original Price: ${originalPrice ? `$${originalPrice}` : 'N/A'}
Notes: ${notes || (keywords.length ? keywords.join(', ') : 'None')}

Respond with ONLY valid JSON in this exact format:
{"title":"listing title max 80 chars SEO-optimized with brand and key attributes","description":"200-500 word persuasive description with condition, features, and item details. Include a DETAILS section with brand, size, color, condition. End with a friendly closing line.","tags":["tag1","tag2","up to 20 relevant search tags"]}`;

            const response = await anthropic.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            });

            const m = response.content[0].text.trim().match(/\{[\s\S]*\}/);
            if (m) {
                const r = JSON.parse(m[0]);
                if (r.title && r.description && Array.isArray(r.tags)) {
                    return {
                        title: r.title.slice(0, 80),
                        description: r.description,
                        tags: r.tags.slice(0, 20),
                        source: 'claude'
                    };
                }
            }
        } catch (_) {
            // fall through to templates
        }
    }

    return {
        title: generateTitle(context),
        description: generateDescription(context),
        tags: generateTags(context),
        source: 'template'
    };
}
