// Environment & Quality — AI/ML: Price Predictor + Listing Generator
// Audit gaps: H27 (price predictor untested), H28 (listing output unvalidated),
//             H30 (image analyzer output schema), H39 (property-based financial tests)
// Category: AI/ML/Ranking Assurance, Exploratory/Property-Based

import { describe, expect, test } from 'bun:test';
import {
    predictPrice,
    getPriceRange,
    calculateProfit,
    getPriceRecommendations,
} from '../shared/ai/price-predictor.js';
import {
    generateTitle,
    generateDescription,
    generateTags,
} from '../shared/ai/listing-generator.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Price Predictor — predictPrice (H27)
// ═══════════════════════════════════════════════════════════════════════════════

describe('predictPrice — category base pricing (H27)', () => {
    test('known category returns price within category range', () => {
        const { price } = predictPrice({ category: 'Dresses', condition: 'good' });
        // Dresses: min 20, avg 55, max 200
        expect(price).toBeGreaterThanOrEqual(20);
        expect(price).toBeLessThanOrEqual(200);
    });

    test('unknown category falls back to Accessories range', () => {
        const { price } = predictPrice({ category: 'Alien Artifact', condition: 'good' });
        // Accessories: min 10, avg 30, max 100
        expect(price).toBeGreaterThanOrEqual(10);
        expect(price).toBeLessThanOrEqual(100);
    });

    test('null category falls back to Accessories', () => {
        const { price } = predictPrice({ condition: 'good' });
        expect(price).toBeGreaterThanOrEqual(10);
    });
});

describe('predictPrice — brand multiplier (H27)', () => {
    test('luxury brand (Gucci) increases price with 4x multiplier', () => {
        const base = predictPrice({ category: 'Bags', condition: 'new' });
        const luxury = predictPrice({ category: 'Bags', condition: 'new', brand: 'Gucci' });
        expect(luxury.price).toBeGreaterThan(base.price);
    });

    test('designer brand (Coach) applies 2.5x multiplier', () => {
        const base = predictPrice({ category: 'Bags', condition: 'new' });
        const designer = predictPrice({ category: 'Bags', condition: 'new', brand: 'Coach' });
        expect(designer.price).toBeGreaterThan(base.price);
    });

    test('premium brand (Nike) applies 1.75x multiplier', () => {
        const base = predictPrice({ category: 'Sneakers', condition: 'new' });
        const premium = predictPrice({ category: 'Sneakers', condition: 'new', brand: 'Nike' });
        expect(premium.price).toBeGreaterThan(base.price);
    });

    test('unknown brand uses 1x multiplier (no change)', () => {
        const base = predictPrice({ category: 'Tops', condition: 'new' });
        const unknown = predictPrice({ category: 'Tops', condition: 'new', brand: 'NoName' });
        expect(unknown.price).toBe(base.price);
    });

    test('brand matching is case-insensitive', () => {
        const r1 = predictPrice({ category: 'Tops', condition: 'new', brand: 'nike' });
        const r2 = predictPrice({ category: 'Tops', condition: 'new', brand: 'Nike' });
        expect(r1.price).toBe(r2.price);
    });
});

describe('predictPrice — condition multiplier (H27)', () => {
    test('new condition is 1.0x (full price)', () => {
        const n = predictPrice({ category: 'Jeans', condition: 'new' });
        const ln = predictPrice({ category: 'Jeans', condition: 'like_new' });
        expect(n.price).toBeGreaterThan(ln.price);
    });

    test('condition ladder: new > like_new > good > fair > poor', () => {
        const conditions = ['new', 'like_new', 'good', 'fair', 'poor'];
        const prices = conditions.map(c =>
            predictPrice({ category: 'Tops', condition: c }).price
        );
        for (let i = 0; i < prices.length - 1; i++) {
            expect(prices[i]).toBeGreaterThanOrEqual(prices[i + 1]);
        }
    });

    test('unknown condition defaults to 0.70 (good)', () => {
        const good = predictPrice({ category: 'Tops', condition: 'good' });
        const unk = predictPrice({ category: 'Tops', condition: 'mystery' });
        expect(unk.price).toBe(good.price);
    });
});

describe('predictPrice — historical sales as base (H27)', () => {
    test('uses historical average when >= 3 sales exist', () => {
        const result = predictPrice({
            category: 'Tops',
            condition: 'good',
            historicalSales: [
                { sale_price: 50 },
                { sale_price: 60 },
                { sale_price: 70 },
            ],
        });
        expect(result.priceSource).toBe('historical_sales');
    });

    test('falls back to category when < 3 sales', () => {
        const result = predictPrice({
            category: 'Tops',
            condition: 'good',
            historicalSales: [{ sale_price: 50 }, { sale_price: 60 }],
        });
        expect(result.priceSource).toBe('category');
    });

    test('ignores zero-average historical sales', () => {
        const result = predictPrice({
            category: 'Tops',
            condition: 'good',
            historicalSales: [
                { sale_price: 0 },
                { sale_price: 0 },
                { sale_price: 0 },
            ],
        });
        expect(result.priceSource).toBe('category');
    });
});

describe('predictPrice — category fuzzy matching (H27)', () => {
    test('case-insensitive match: "dresses" → Dresses', () => {
        const { price } = predictPrice({ category: 'dresses', condition: 'good' });
        expect(price).toBeGreaterThanOrEqual(20); // Dresses min
    });

    test('inference: "running shoes" → Sneakers', () => {
        const { price } = predictPrice({ category: 'running shoes', condition: 'good' });
        expect(price).toBeGreaterThanOrEqual(25); // Sneakers min
    });

    test('inference: "leather purse" → Handbags', () => {
        const { price } = predictPrice({ category: 'leather purse', condition: 'good' });
        expect(price).toBeGreaterThanOrEqual(25); // Handbags min
    });
});

describe('predictPrice — size adjustment (H27)', () => {
    test('XXL size gets 0.95x adjustment', () => {
        const reg = predictPrice({ category: 'Tops', condition: 'new', size: 'M' });
        const xxl = predictPrice({ category: 'Tops', condition: 'new', size: 'XXL' });
        expect(xxl.price).toBeLessThanOrEqual(reg.price);
    });

    test('standard sizes (S, M, L) get 1.0x adjustment', () => {
        const s = predictPrice({ category: 'Tops', condition: 'new', size: 'S' });
        const m = predictPrice({ category: 'Tops', condition: 'new', size: 'M' });
        expect(s.price).toBe(m.price);
    });
});

describe('predictPrice — originalRetail blending (H27)', () => {
    test('original retail price blends with category price', () => {
        const withRetail = predictPrice({
            category: 'Tops',
            condition: 'good',
            originalRetail: 200,
        });
        const withoutRetail = predictPrice({
            category: 'Tops',
            condition: 'good',
        });
        // Retail-blended price should differ from pure category price
        expect(withRetail.price).not.toBe(withoutRetail.price);
    });
});

describe('predictPrice — output invariants (H27, H39)', () => {
    test('price is always a positive integer (rounded)', () => {
        const contexts = [
            { category: 'Tops', condition: 'poor' },
            { category: 'Coats', condition: 'new', brand: 'Gucci' },
            { category: 'Accessories', condition: 'fair' },
            { category: 'Sneakers', condition: 'like_new', brand: 'Nike', size: 'XXL' },
        ];
        for (const ctx of contexts) {
            const { price } = predictPrice(ctx);
            expect(price).toBeGreaterThan(0);
            expect(Number.isInteger(price)).toBe(true);
        }
    });

    test('price never exceeds max * brandMultiplier', () => {
        // Luxury brand on Accessories: max 100 * 4 = 400
        const { price } = predictPrice({
            category: 'Accessories',
            condition: 'new',
            brand: 'Gucci',
        });
        expect(price).toBeLessThanOrEqual(400);
    });

    test('price never falls below category minimum', () => {
        const { price } = predictPrice({
            category: 'Watches',
            condition: 'poor',
        });
        expect(price).toBeGreaterThanOrEqual(30); // Watches min
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getPriceRange (H27)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getPriceRange (H27)', () => {
    test('returns all price tiers', () => {
        const range = getPriceRange({ category: 'Tops', condition: 'good' });
        expect(range).toHaveProperty('low');
        expect(range).toHaveProperty('suggested');
        expect(range).toHaveProperty('high');
        expect(range).toHaveProperty('quickSale');
        expect(range).toHaveProperty('priceSource');
    });

    test('quickSale < low < suggested < high', () => {
        const range = getPriceRange({ category: 'Dresses', condition: 'good' });
        expect(range.quickSale).toBeLessThan(range.low);
        expect(range.low).toBeLessThanOrEqual(range.suggested);
        expect(range.suggested).toBeLessThanOrEqual(range.high);
    });

    test('all values are integers', () => {
        const range = getPriceRange({ category: 'Tops', condition: 'good' });
        expect(Number.isInteger(range.low)).toBe(true);
        expect(Number.isInteger(range.suggested)).toBe(true);
        expect(Number.isInteger(range.high)).toBe(true);
        expect(Number.isInteger(range.quickSale)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateProfit (H27, H42)
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateProfit (H27, H42)', () => {
    test('basic profit calculation', () => {
        const result = calculateProfit(100, 30, 0.20);
        // profit = 100 - 20 - 30 = 50
        expect(result.profit).toBe(50);
        expect(result.platformFee).toBe(20);
        expect(result.margin).toBe(50); // 50%
    });

    test('zero cost price', () => {
        const result = calculateProfit(50, 0, 0.20);
        // profit = 50 - 10 - 0 = 40
        expect(result.profit).toBe(40);
    });

    test('default platformFee is 20%', () => {
        const result = calculateProfit(100, 50);
        expect(result.platformFee).toBe(20);
        expect(result.profit).toBe(30);
    });

    test('negative profit when cost > revenue after fees', () => {
        const result = calculateProfit(20, 50, 0.20);
        // profit = 20 - 4 - 50 = -34
        expect(result.profit).toBe(-34);
    });

    test('profit and platformFee rounded to 2 decimal places', () => {
        const result = calculateProfit(33.33, 10, 0.15);
        // fee = 33.33 * 0.15 = 4.9995 → 5.00
        expect(result.platformFee).toBe(5);
        // profit = 33.33 - 5.00 - 10 = 18.33
        expect(result.profit).toBe(18.33);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getPriceRecommendations (H27)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getPriceRecommendations (H27)', () => {
    test('returns all 4 strategies', () => {
        const rec = getPriceRecommendations({ category: 'Tops', condition: 'good' });
        expect(rec).toHaveProperty('aggressive');
        expect(rec).toHaveProperty('competitive');
        expect(rec).toHaveProperty('balanced');
        expect(rec).toHaveProperty('premium');
    });

    test('each strategy has price, strategy text, and expectedTime', () => {
        const rec = getPriceRecommendations({ category: 'Tops', condition: 'good' });
        for (const key of ['aggressive', 'competitive', 'balanced', 'premium']) {
            expect(rec[key]).toHaveProperty('price');
            expect(rec[key]).toHaveProperty('strategy');
            expect(rec[key]).toHaveProperty('expectedTime');
            expect(typeof rec[key].price).toBe('number');
        }
    });

    test('aggressive < competitive < balanced < premium', () => {
        const rec = getPriceRecommendations({ category: 'Dresses', condition: 'good' });
        expect(rec.aggressive.price).toBeLessThanOrEqual(rec.competitive.price);
        expect(rec.competitive.price).toBeLessThanOrEqual(rec.balanced.price);
        expect(rec.balanced.price).toBeLessThanOrEqual(rec.premium.price);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Listing Generator — generateTitle (H28)
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateTitle — output validation (H28)', () => {
    test('includes brand when provided', () => {
        const title = generateTitle({ brand: 'Nike', category: 'Sneakers', condition: 'new' });
        expect(title).toContain('Nike');
    });

    test('excludes Unknown and Vintage brands from title', () => {
        const t1 = generateTitle({ brand: 'Unknown', category: 'Tops', condition: 'good' });
        expect(t1).not.toContain('Unknown');
        const t2 = generateTitle({ brand: 'Vintage', category: 'Tops', condition: 'good' });
        expect(t2).not.toContain('Vintage');
    });

    test('includes color when provided', () => {
        const title = generateTitle({ brand: 'Nike', category: 'Sneakers', color: 'Red', condition: 'good' });
        expect(title).toContain('Red');
    });

    test('includes size when not OS/One Size', () => {
        const title = generateTitle({ brand: 'Nike', category: 'Tops', size: 'M', condition: 'good' });
        expect(title).toContain('Size M');
    });

    test('excludes size when One Size or OS', () => {
        const t1 = generateTitle({ brand: 'Nike', category: 'Tops', size: 'OS', condition: 'good' });
        expect(t1).not.toContain('Size OS');
        const t2 = generateTitle({ brand: 'Nike', category: 'Tops', size: 'One Size', condition: 'good' });
        expect(t2).not.toContain('Size One Size');
    });

    test('adds NWT for new condition', () => {
        const title = generateTitle({ category: 'Tops', condition: 'new' });
        expect(title).toContain('NWT');
    });

    test('adds Like New for like_new condition', () => {
        const title = generateTitle({ category: 'Tops', condition: 'like_new' });
        expect(title).toContain('Like New');
    });

    test('title never exceeds 80 characters', () => {
        const title = generateTitle({
            brand: 'Michael Kors',
            category: 'Very Long Category Name That Goes On',
            color: 'Navy Blue',
            size: 'Medium',
            condition: 'like_new',
            keywords: ['designer', 'vintage-inspired', 'limited-edition'],
        });
        expect(title.length).toBeLessThanOrEqual(80);
    });

    test('returns string with minimal context (may be empty if no attributes)', () => {
        const title = generateTitle({});
        expect(typeof title).toBe('string');
        // With no brand/category/color/size, title can be empty — that's valid
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Listing Generator — generateDescription (H28)
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateDescription — output validation (H28)', () => {
    test('includes brand details section', () => {
        const desc = generateDescription({
            brand: 'Nike', category: 'Sneakers', condition: 'good', color: 'Black',
        });
        expect(desc).toContain('DETAILS');
        expect(desc).toContain('Nike');
        expect(desc).toContain('Black');
    });

    test('includes condition description', () => {
        const desc = generateDescription({ category: 'Tops', condition: 'new' });
        expect(desc).toContain('Brand new with tags');
    });

    test('includes measurements when provided', () => {
        const desc = generateDescription({
            category: 'Tops',
            condition: 'good',
            measurements: { chest: '42"', length: '28"' },
        });
        expect(desc).toContain('MEASUREMENTS');
        expect(desc).toContain('chest');
        expect(desc).toContain('42"');
    });

    test('includes closing line', () => {
        const desc = generateDescription({ category: 'Tops', condition: 'good' });
        expect(desc).toContain('Thank you for shopping');
    });

    test('returns multi-line string', () => {
        const desc = generateDescription({ category: 'Dresses', condition: 'good' });
        const lines = desc.split('\n').filter(l => l.trim().length > 0);
        expect(lines.length).toBeGreaterThanOrEqual(4);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Listing Generator — generateTags (H28)
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateTags — output validation (H28)', () => {
    test('includes brand as tag', () => {
        const tags = generateTags({ brand: 'Nike', category: 'Sneakers' });
        expect(tags).toContain('nike');
    });

    test('includes category-related tags', () => {
        const tags = generateTags({ category: 'Dresses' });
        expect(tags).toContain('dress');
        expect(tags).toContain('dresses');
    });

    test('always includes standard reseller tags', () => {
        const tags = generateTags({ category: 'Tops' });
        expect(tags).toContain('thrifted');
        expect(tags).toContain('secondhand');
        expect(tags).toContain('sustainable');
    });

    test('caps at 20 tags maximum', () => {
        const tags = generateTags({
            brand: 'Nike',
            category: 'Sneakers',
            color: 'Black',
            keywords: Array(25).fill('keyword'),
        });
        expect(tags.length).toBeLessThanOrEqual(20);
    });

    test('tags are all lowercase', () => {
        const tags = generateTags({ brand: 'GUCCI', category: 'BAGS', color: 'RED' });
        for (const tag of tags) {
            expect(tag).toBe(tag.toLowerCase());
        }
    });

    test('no duplicate tags', () => {
        const tags = generateTags({
            brand: 'Nike',
            category: 'Sneakers',
            keywords: ['nike', 'sneakers', 'nike'],
        });
        expect(tags.length).toBe(new Set(tags).size);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property-based financial tests (H39)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property-based financial invariants (H39)', () => {
    test('calculateProfit: profit + fee + cost always equals listPrice', () => {
        // Invariant: profit + platformFee + costPrice = listPrice
        const testCases = [
            [100, 30, 0.20],
            [50, 10, 0.15],
            [200, 0, 0.10],
            [33.33, 15.50, 0.25],
            [0.01, 0, 0.20],
        ];
        for (const [listPrice, costPrice, feeRate] of testCases) {
            const result = calculateProfit(listPrice, costPrice, feeRate);
            const reconstructed = result.profit + result.platformFee + costPrice;
            // Allow small rounding error
            expect(Math.abs(reconstructed - listPrice)).toBeLessThan(0.02);
        }
    });

    test('calculateProfit: margin is always profit/listPrice*100', () => {
        const result = calculateProfit(80, 25, 0.20);
        const expectedMargin = Math.round((result.profit / 80) * 100);
        expect(result.margin).toBe(expectedMargin);
    });

    test('predictPrice: same inputs always produce same output (deterministic)', () => {
        const ctx = { category: 'Tops', condition: 'good', brand: 'Nike', size: 'M' };
        const r1 = predictPrice(ctx);
        const r2 = predictPrice(ctx);
        expect(r1.price).toBe(r2.price);
        expect(r1.priceSource).toBe(r2.priceSource);
    });
});
