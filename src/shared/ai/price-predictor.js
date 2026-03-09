// Price Prediction Utility
// Suggests prices based on item attributes and market data

// Base price ranges by category
const CATEGORY_PRICES = {
    'Tops': { min: 15, avg: 35, max: 100 },
    'T-Shirts': { min: 10, avg: 25, max: 75 },
    'Shirts': { min: 15, avg: 40, max: 120 },
    'Blouses': { min: 15, avg: 35, max: 100 },
    'Sweaters': { min: 20, avg: 45, max: 150 },
    'Bottoms': { min: 15, avg: 35, max: 100 },
    'Jeans': { min: 20, avg: 45, max: 150 },
    'Pants': { min: 15, avg: 40, max: 120 },
    'Shorts': { min: 12, avg: 28, max: 80 },
    'Skirts': { min: 15, avg: 35, max: 100 },
    'Dresses': { min: 20, avg: 55, max: 200 },
    'Outerwear': { min: 30, avg: 75, max: 300 },
    'Jackets': { min: 25, avg: 65, max: 250 },
    'Coats': { min: 40, avg: 100, max: 400 },
    'Footwear': { min: 20, avg: 50, max: 200 },
    'Sneakers': { min: 25, avg: 60, max: 250 },
    'Boots': { min: 30, avg: 75, max: 300 },
    'Heels': { min: 20, avg: 50, max: 200 },
    'Sandals': { min: 15, avg: 35, max: 100 },
    'Bags': { min: 20, avg: 60, max: 300 },
    'Handbags': { min: 25, avg: 80, max: 500 },
    'Accessories': { min: 10, avg: 30, max: 100 },
    'Jewelry': { min: 10, avg: 35, max: 200 },
    'Watches': { min: 30, avg: 100, max: 500 },
    'Electronics': { min: 20, avg: 100, max: 500 },
    'Home': { min: 15, avg: 40, max: 150 }
};

// Brand tier multipliers
const BRAND_TIERS = {
    // Luxury brands (3x-5x multiplier)
    luxury: {
        brands: ['Gucci', 'Louis Vuitton', 'Chanel', 'Prada', 'Hermes', 'Dior', 'Balenciaga', 'Burberry', 'Fendi', 'Valentino', 'Versace', 'Saint Laurent', 'Bottega Veneta', 'Celine', 'Givenchy'],
        multiplier: 4
    },
    // Designer brands (2x-3x multiplier)
    designer: {
        brands: ['Coach', 'Michael Kors', 'Kate Spade', 'Marc Jacobs', 'Tory Burch', 'Diane von Furstenberg', 'Theory', 'Vince', 'All Saints', 'Ted Baker', 'Hugo Boss', 'Tommy Hilfiger', 'Calvin Klein', 'Ralph Lauren'],
        multiplier: 2.5
    },
    // Premium brands (1.5x-2x multiplier)
    premium: {
        brands: ['Nike', 'Adidas', 'Levi\'s', 'North Face', 'Patagonia', 'Lululemon', 'Athleta', 'Free People', 'Anthropologie', 'Madewell', 'J.Crew', 'Banana Republic', 'Club Monaco', 'Reformation', 'Everlane'],
        multiplier: 1.75
    },
    // Mid-tier brands (1x-1.5x multiplier)
    mid: {
        brands: ['Zara', 'H&M', 'Uniqlo', 'Gap', 'Old Navy', 'American Eagle', 'Abercrombie', 'Express', 'Guess', 'Lucky Brand', 'Bebe', 'BCBGeneration'],
        multiplier: 1.25
    },
    // Vintage (variable, generally premium)
    vintage: {
        brands: ['Vintage'],
        multiplier: 2
    }
};

// Condition multipliers
const CONDITION_MULTIPLIERS = {
    'new': 1.0,       // Full price
    'like_new': 0.85, // 85% of base
    'good': 0.70,     // 70% of base
    'fair': 0.50,     // 50% of base
    'poor': 0.25      // 25% of base
};

// Seasonal adjustments
const SEASONAL_ADJUSTMENTS = {
    // Northern hemisphere seasons
    winter: {
        'Outerwear': 1.2, 'Coats': 1.3, 'Jackets': 1.2, 'Sweaters': 1.15, 'Boots': 1.2,
        'Shorts': 0.7, 'Sandals': 0.6, 'Swimwear': 0.5
    },
    spring: {
        'Dresses': 1.15, 'Jackets': 1.1, 'Sandals': 1.1,
        'Coats': 0.8, 'Boots': 0.85
    },
    summer: {
        'Shorts': 1.2, 'Sandals': 1.2, 'Swimwear': 1.3, 'Dresses': 1.1, 'T-Shirts': 1.1,
        'Coats': 0.6, 'Boots': 0.7, 'Sweaters': 0.7
    },
    fall: {
        'Outerwear': 1.1, 'Jackets': 1.15, 'Boots': 1.1, 'Sweaters': 1.1,
        'Shorts': 0.8, 'Sandals': 0.75
    }
};

/**
 * Predict a price for an item.
 * If historicalSales (array of {sale_price}) has 3+ entries, uses their average as the base
 * before applying brand/condition/seasonal multipliers.
 */
export function predictPrice(context) {
    const { title, brand, category, condition, originalRetail, size, historicalSales = [] } = context;

    // Get base price from category
    const categoryKey = findCategoryKey(category);
    const basePrice = CATEGORY_PRICES[categoryKey] || CATEGORY_PRICES['Accessories'];

    let price = basePrice.avg;
    let priceSource = 'category';

    // Use historical sold prices as PRIMARY base when sufficient data exists
    if (historicalSales.length >= 3) {
        const historicalAvg = historicalSales.reduce((sum, s) => sum + (s.sale_price || 0), 0) / historicalSales.length;
        if (historicalAvg > 0) {
            price = historicalAvg;
            priceSource = 'historical_sales';
        }
    }

    // Apply brand multiplier
    const brandMultiplier = getBrandMultiplier(brand);
    price *= brandMultiplier;

    // Apply condition multiplier
    const conditionMultiplier = CONDITION_MULTIPLIERS[condition] || 0.70;
    price *= conditionMultiplier;

    // Apply seasonal adjustment
    const season = getCurrentSeason();
    const seasonalAdj = SEASONAL_ADJUSTMENTS[season]?.[categoryKey] || 1;
    price *= seasonalAdj;

    // If original retail is provided, use it as a reference
    if (originalRetail && originalRetail > 0) {
        // Resale is typically 30-50% of retail for good condition
        const retailBasedPrice = originalRetail * conditionMultiplier * 0.5;
        // Blend with category-based price
        price = (price + retailBasedPrice) / 2;
    }

    // Size adjustments (plus sizes and petites may have different demand)
    if (size) {
        const sizeAdj = getSizeAdjustment(size);
        price *= sizeAdj;
    }

    // Round to nearest dollar
    price = Math.round(price);

    // Ensure within reasonable bounds
    price = Math.max(price, basePrice.min);
    price = Math.min(price, basePrice.max * brandMultiplier);

    return { price, priceSource };
}

/**
 * Get price range for an item
 */
export function getPriceRange(context) {
    const { price: suggestedPrice, priceSource } = predictPrice(context);

    return {
        low: Math.round(suggestedPrice * 0.75),
        suggested: suggestedPrice,
        high: Math.round(suggestedPrice * 1.25),
        quickSale: Math.round(suggestedPrice * 0.6),
        priceSource
    };
}

/**
 * Find matching category key
 */
function findCategoryKey(category) {
    if (!category) return 'Accessories';

    // Direct match
    if (CATEGORY_PRICES[category]) return category;

    // Fuzzy match
    const lower = category.toLowerCase();

    for (const key of Object.keys(CATEGORY_PRICES)) {
        if (key.toLowerCase() === lower || lower.includes(key.toLowerCase())) {
            return key;
        }
    }

    // Category inference
    if (lower.includes('top') || lower.includes('shirt') || lower.includes('blouse')) return 'Tops';
    if (lower.includes('jean')) return 'Jeans';
    if (lower.includes('pant')) return 'Pants';
    if (lower.includes('short')) return 'Shorts';
    if (lower.includes('skirt')) return 'Skirts';
    if (lower.includes('dress')) return 'Dresses';
    if (lower.includes('jacket')) return 'Jackets';
    if (lower.includes('coat')) return 'Coats';
    if (lower.includes('sweater')) return 'Sweaters';
    if (lower.includes('shoe') || lower.includes('sneaker')) return 'Sneakers';
    if (lower.includes('boot')) return 'Boots';
    if (lower.includes('heel')) return 'Heels';
    if (lower.includes('sandal')) return 'Sandals';
    if (lower.includes('bag') || lower.includes('purse')) return 'Handbags';
    if (lower.includes('watch')) return 'Watches';
    if (lower.includes('jewelry') || lower.includes('necklace') || lower.includes('earring')) return 'Jewelry';

    return 'Accessories';
}

/**
 * Get brand tier multiplier
 */
function getBrandMultiplier(brand) {
    if (!brand) return 1;

    const brandLower = brand.toLowerCase();

    for (const tier of Object.values(BRAND_TIERS)) {
        for (const tierBrand of tier.brands) {
            if (tierBrand.toLowerCase() === brandLower) {
                return tier.multiplier;
            }
        }
    }

    return 1;
}

/**
 * Get current season
 */
function getCurrentSeason() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
}

/**
 * Get size adjustment multiplier
 */
function getSizeAdjustment(size) {
    if (!size) return 1;

    const sizeUpper = size.toUpperCase();

    // Extended sizes may have different demand
    if (sizeUpper.includes('XXL') || sizeUpper.includes('3X') || sizeUpper.includes('4X')) {
        return 0.95; // Slightly lower due to less demand
    }
    if (sizeUpper.includes('XXS') || sizeUpper.includes('PETITE')) {
        return 0.95;
    }
    // Standard sizes have normal pricing
    if (['XS', 'S', 'M', 'L', 'XL'].some(s => sizeUpper.includes(s))) {
        return 1;
    }

    return 1;
}

/**
 * Calculate potential profit
 */
export function calculateProfit(listPrice, costPrice, platformFee = 0.20) {
    const fee = listPrice * platformFee;
    const profit = listPrice - fee - costPrice;
    const margin = (profit / listPrice) * 100;

    return {
        listPrice,
        costPrice,
        platformFee: Math.round(fee * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        margin: Math.round(margin)
    };
}

/**
 * Get price recommendations based on market position
 */
export function getPriceRecommendations(context) {
    const range = getPriceRange(context);

    return {
        aggressive: {
            price: range.quickSale,
            strategy: 'Price to sell quickly',
            expectedTime: '1-3 days'
        },
        competitive: {
            price: range.low,
            strategy: 'Competitive market price',
            expectedTime: '1-2 weeks'
        },
        balanced: {
            price: range.suggested,
            strategy: 'Balanced price point',
            expectedTime: '2-4 weeks'
        },
        premium: {
            price: range.high,
            strategy: 'Premium positioning, may take longer',
            expectedTime: '1-2 months'
        }
    };
}
