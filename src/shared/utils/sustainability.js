// Sustainability analytics utilities
// Calculate environmental impact of reselling items

// Citation and accuracy metadata by broad product category
const SUSTAINABILITY_CITATIONS = {
    clothing: {
        citation: 'Ellen MacArthur Foundation, A New Textiles Economy (2017)',
        accuracy_range: '±15%',
        methodology: 'Based on average kg CO2e per garment lifecycle assessment data',
    },
    footwear: {
        citation:
            'Quantis, Measuring Fashion: Environmental Impact of the Global Apparel and Footwear Industries Study (2018)',
        accuracy_range: '±20%',
        methodology: 'Based on average lifecycle CO2e and water footprint per footwear unit',
    },
    accessories: {
        citation: 'WRAP (Waste and Resources Action Programme), Valuing Our Clothes (2017)',
        accuracy_range: '±20%',
        methodology: 'Estimated from accessory category average lifecycle assessment data',
    },
    electronics: {
        citation: 'EPA Electronics Product Environmental Assessment Tool (EPEAT), 2023',
        accuracy_range: '±20%',
        methodology: 'Based on average lifecycle CO2e and material weight for consumer electronics',
    },
    home: {
        citation: 'EPA Waste Reduction Model (WARM) v15',
        accuracy_range: '±20%',
        methodology: 'Estimated from household goods category average lifecycle assessment data',
    },
    default: {
        citation: 'EPA Waste Reduction Model (WARM) v15',
        accuracy_range: '±15-20%',
        methodology: 'Estimated from product category average lifecycle assessment data',
    },
};

// Map inventory category keys to citation groups
const CITATION_CATEGORY_MAP = {
    Tops: 'clothing',
    'T-Shirts': 'clothing',
    Shirts: 'clothing',
    Blouses: 'clothing',
    Sweaters: 'clothing',
    Bottoms: 'clothing',
    Jeans: 'clothing',
    Pants: 'clothing',
    Shorts: 'clothing',
    Skirts: 'clothing',
    Dresses: 'clothing',
    Outerwear: 'clothing',
    Jackets: 'clothing',
    Coats: 'clothing',
    Footwear: 'footwear',
    Sneakers: 'footwear',
    Boots: 'footwear',
    Heels: 'footwear',
    Sandals: 'footwear',
    Bags: 'accessories',
    Handbags: 'accessories',
    Accessories: 'accessories',
    Jewelry: 'accessories',
    Watches: 'accessories',
    Electronics: 'electronics',
    Home: 'home',
};

// Environmental impact data by category (approximate values)
const IMPACT_DATA = {
    // Water saved in liters
    water: {
        Tops: 2700,
        'T-Shirts': 2700,
        Shirts: 2700,
        Blouses: 2500,
        Sweaters: 3000,
        Bottoms: 3800,
        Jeans: 7500,
        Pants: 3500,
        Shorts: 2000,
        Skirts: 2500,
        Dresses: 4000,
        Outerwear: 5000,
        Jackets: 4500,
        Coats: 6000,
        Footwear: 8000,
        Sneakers: 8000,
        Boots: 10000,
        Heels: 6000,
        Sandals: 3000,
        Bags: 4000,
        Handbags: 5000,
        Accessories: 1500,
        Jewelry: 500,
        Watches: 1000,
        Electronics: 2000,
        Home: 3000,
        default: 2700,
    },
    // CO2 saved in kg
    co2: {
        Tops: 8,
        'T-Shirts': 6,
        Shirts: 10,
        Blouses: 9,
        Sweaters: 15,
        Bottoms: 12,
        Jeans: 33,
        Pants: 15,
        Shorts: 8,
        Skirts: 10,
        Dresses: 20,
        Outerwear: 30,
        Jackets: 25,
        Coats: 40,
        Footwear: 14,
        Sneakers: 14,
        Boots: 20,
        Heels: 12,
        Sandals: 8,
        Bags: 10,
        Handbags: 15,
        Accessories: 5,
        Jewelry: 2,
        Watches: 5,
        Electronics: 50,
        Home: 20,
        default: 10,
    },
    // Waste prevented in kg
    waste: {
        Tops: 0.3,
        'T-Shirts': 0.2,
        Shirts: 0.3,
        Blouses: 0.25,
        Sweaters: 0.5,
        Bottoms: 0.5,
        Jeans: 0.7,
        Pants: 0.5,
        Shorts: 0.3,
        Skirts: 0.35,
        Dresses: 0.6,
        Outerwear: 1.0,
        Jackets: 0.8,
        Coats: 1.5,
        Footwear: 0.8,
        Sneakers: 0.9,
        Boots: 1.2,
        Heels: 0.6,
        Sandals: 0.4,
        Bags: 0.5,
        Handbags: 0.7,
        Accessories: 0.2,
        Jewelry: 0.05,
        Watches: 0.15,
        Electronics: 2.0,
        Home: 1.5,
        default: 0.5,
    },
};

// Condition multipliers - better condition means more environmental benefit
const CONDITION_MULTIPLIERS = {
    new: 1.0,
    like_new: 0.95,
    good: 0.85,
    fair: 0.7,
    poor: 0.5,
};

/**
 * Calculate sustainability impact for a single item
 */
export function calculateSustainability(category, condition = 'good') {
    const categoryKey = findMatchingCategory(category);
    const multiplier = CONDITION_MULTIPLIERS[condition] || 0.85;
    const citationGroup = CITATION_CATEGORY_MAP[categoryKey] || 'default';
    const citationData = SUSTAINABILITY_CITATIONS[citationGroup];

    return {
        waterSaved: Math.round((IMPACT_DATA.water[categoryKey] || IMPACT_DATA.water.default) * multiplier),
        co2Saved: Math.round((IMPACT_DATA.co2[categoryKey] || IMPACT_DATA.co2.default) * multiplier * 10) / 10,
        wastePrevented:
            Math.round((IMPACT_DATA.waste[categoryKey] || IMPACT_DATA.waste.default) * multiplier * 100) / 100,
        citation: citationData.citation,
        accuracy_range: citationData.accuracy_range,
        methodology: citationData.methodology,
    };
}

/**
 * Find matching category from impact data
 */
function findMatchingCategory(category) {
    if (!category) return 'default';

    // Direct match
    if (IMPACT_DATA.water[category]) return category;

    // Try to find partial match
    const lowerCategory = category.toLowerCase();
    for (const key of Object.keys(IMPACT_DATA.water)) {
        if (key.toLowerCase().includes(lowerCategory) || lowerCategory.includes(key.toLowerCase())) {
            return key;
        }
    }

    return 'default';
}

/**
 * Calculate total impact for multiple items
 */
export function calculateTotalImpact(items) {
    const totals = {
        waterSaved: 0,
        co2Saved: 0,
        wastePrevented: 0,
        itemCount: items.length,
    };

    for (const item of items) {
        const impact = calculateSustainability(item.category, item.condition);
        totals.waterSaved += impact.waterSaved;
        totals.co2Saved += impact.co2Saved;
        totals.wastePrevented += impact.wastePrevented;
    }

    return {
        ...totals,
        waterSaved: Math.round(totals.waterSaved),
        co2Saved: Math.round(totals.co2Saved * 10) / 10,
        wastePrevented: Math.round(totals.wastePrevented * 100) / 100,
    };
}

/**
 * Convert impact to real-world equivalents
 */
export function getImpactEquivalents(impact) {
    return {
        // Showers saved (average shower uses ~65 liters)
        showers: Math.round(impact.waterSaved / 65),

        // Miles driven in a car (average car emits ~0.404 kg CO2 per mile)
        carMiles: Math.round(impact.co2Saved / 0.404),

        // Trees planted equivalent (1 tree absorbs ~22 kg CO2/year)
        treesPlanted: Math.round((impact.co2Saved / 22) * 10) / 10,

        // Plastic bags saved (average bag weighs ~5g)
        plasticBags: Math.round((impact.wastePrevented * 1000) / 5),

        // Trash bags saved (average ~4.5 kg per bag)
        trashBags: Math.round(impact.wastePrevented / 4.5),

        // Phone charges saved (charging uses ~0.012 kWh, ~0.005 kg CO2)
        phoneCharges: Math.round(impact.co2Saved / 0.005),

        // Lightbulb hours saved (60W bulb for 1 hour = ~0.025 kg CO2)
        lightbulbHours: Math.round(impact.co2Saved / 0.025),
    };
}

/**
 * Generate sustainability report
 */
export function generateSustainabilityReport(items, period = 'all-time') {
    const impact = calculateTotalImpact(items);
    const equivalents = getImpactEquivalents(impact);

    // Group by category
    const byCategory = {};
    for (const item of items) {
        const cat = item.category || 'Other';
        if (!byCategory[cat]) {
            byCategory[cat] = { items: [], impact: { waterSaved: 0, co2Saved: 0, wastePrevented: 0 } };
        }
        byCategory[cat].items.push(item);
        const itemImpact = calculateSustainability(item.category, item.condition);
        byCategory[cat].impact.waterSaved += itemImpact.waterSaved;
        byCategory[cat].impact.co2Saved += itemImpact.co2Saved;
        byCategory[cat].impact.wastePrevented += itemImpact.wastePrevented;
    }

    return {
        period,
        totalItems: items.length,
        totalImpact: impact,
        equivalents,
        byCategory,
        highlights: generateHighlights(impact, equivalents),
    };
}

/**
 * Generate impact highlights for display
 */
function generateHighlights(impact, equivalents) {
    const highlights = [];

    if (impact.waterSaved > 10000) {
        highlights.push(`Saved enough water for ${equivalents.showers} showers`);
    }

    if (impact.co2Saved > 50) {
        highlights.push(`Prevented ${impact.co2Saved} kg of CO2 emissions`);
    }

    if (equivalents.carMiles > 100) {
        highlights.push(`Equivalent to taking ${equivalents.carMiles} miles off the road`);
    }

    if (equivalents.treesPlanted >= 1) {
        highlights.push(`Environmental impact of planting ${equivalents.treesPlanted} trees`);
    }

    return highlights;
}

/**
 * Get sustainability score (0-100)
 */
export function getSustainabilityScore(impact) {
    // Weighted score based on impact metrics
    const waterScore = Math.min((impact.waterSaved / 100000) * 100, 100) * 0.3;
    const co2Score = Math.min((impact.co2Saved / 500) * 100, 100) * 0.4;
    const wasteScore = Math.min((impact.wastePrevented / 25) * 100, 100) * 0.3;

    return Math.round(waterScore + co2Score + wasteScore);
}

/**
 * Get sustainability badge based on score
 */
export function getSustainabilityBadge(score) {
    if (score >= 90) return { name: 'Eco Champion', icon: '🌟', color: '#FFD700' };
    if (score >= 70) return { name: 'Green Leader', icon: '🌿', color: '#228B22' };
    if (score >= 50) return { name: 'Earth Friend', icon: '🌍', color: '#4169E1' };
    if (score >= 30) return { name: 'Eco Starter', icon: '🌱', color: '#90EE90' };
    return { name: 'Getting Started', icon: '🌾', color: '#DEB887' };
}
