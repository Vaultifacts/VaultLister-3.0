// Market Data Service — Unit Tests
import { describe, expect, test } from 'bun:test';
import {
    getCompetitorsForPlatform,
    generateCompetitorListings,
    getMarketInsight,
    findOpportunities,
    comparePricesWithCompetitors,
    getTrendingCategories
} from '../backend/services/marketDataService.js';

describe('getCompetitorsForPlatform', () => {
    test('returns competitors for poshmark', () => {
        const competitors = getCompetitorsForPlatform('poshmark');
        expect(Array.isArray(competitors)).toBe(true);
        expect(competitors.length).toBeGreaterThan(0);
        const comp = competitors[0];
        expect(comp).toHaveProperty('id');
        expect(comp).toHaveProperty('username');
        expect(comp).toHaveProperty('displayName');
        expect(comp).toHaveProperty('avg_price');
        expect(comp).toHaveProperty('listing_count');
        expect(comp).toHaveProperty('sell_through_rate');
        expect(comp).toHaveProperty('profile_url');
        expect(comp.platform).toBe('poshmark');
    });

    test('returns competitors for ebay', () => {
        const competitors = getCompetitorsForPlatform('ebay');
        expect(competitors.length).toBeGreaterThan(0);
        expect(competitors[0].platform).toBe('ebay');
    });

    test('returns competitors for mercari', () => {
        const competitors = getCompetitorsForPlatform('mercari');
        expect(competitors.length).toBeGreaterThan(0);
    });

    test('returns competitors for depop', () => {
        const competitors = getCompetitorsForPlatform('depop');
        expect(competitors.length).toBeGreaterThan(0);
    });

    test('returns competitors for grailed', () => {
        const competitors = getCompetitorsForPlatform('grailed');
        expect(competitors.length).toBeGreaterThan(0);
    });

    test('returns empty array for unknown platform', () => {
        const competitors = getCompetitorsForPlatform('unknown');
        expect(competitors).toEqual([]);
    });

    test('handles case-insensitive platform names', () => {
        const competitors = getCompetitorsForPlatform('Poshmark');
        expect(competitors.length).toBeGreaterThan(0);
    });

    test('each competitor has unique id', () => {
        const competitors = getCompetitorsForPlatform('ebay');
        const ids = competitors.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('infers category focus from username', () => {
        const competitors = getCompetitorsForPlatform('poshmark');
        const vintage = competitors.find(c => c.username.includes('vintage'));
        if (vintage) {
            expect(vintage.category_focus).toBe('Vintage');
        }
    });
});

describe('generateCompetitorListings', () => {
    test('generates specified number of listings', () => {
        const listings = generateCompetitorListings('comp-1', 5);
        expect(listings.length).toBe(5);
    });

    test('defaults to 10 listings', () => {
        const listings = generateCompetitorListings('comp-1');
        expect(listings.length).toBe(10);
    });

    test('listings have required fields', () => {
        const listings = generateCompetitorListings('comp-1', 1);
        const listing = listings[0];
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('competitor_id', 'comp-1');
        expect(listing).toHaveProperty('title');
        expect(listing).toHaveProperty('price');
        expect(listing).toHaveProperty('original_price');
        expect(listing).toHaveProperty('category');
        expect(listing).toHaveProperty('brand');
        expect(listing).toHaveProperty('condition');
        expect(listing).toHaveProperty('listed_at');
    });

    test('prices are positive numbers', () => {
        const listings = generateCompetitorListings('comp-1', 20);
        for (const listing of listings) {
            expect(listing.price).toBeGreaterThan(0);
            expect(listing.original_price).toBeGreaterThan(0);
        }
    });

    test('some listings are sold', () => {
        const listings = generateCompetitorListings('comp-1', 50);
        const sold = listings.filter(l => l.sold_at !== null);
        expect(sold.length).toBeGreaterThan(0);
        for (const s of sold) {
            expect(s.days_to_sell).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('getMarketInsight', () => {
    test('returns insight for known category', () => {
        const insight = getMarketInsight('Shoes');
        expect(insight).toHaveProperty('category', 'Shoes');
        expect(insight).toHaveProperty('saturation_score');
        expect(insight).toHaveProperty('opportunity_score');
        expect(insight).toHaveProperty('avg_price');
        expect(insight).toHaveProperty('avg_days_to_sell');
        expect(insight).toHaveProperty('demand_trend');
        expect(insight).toHaveProperty('competition_level');
        expect(insight).toHaveProperty('recommended_price_range');
    });

    test('falls back to Clothing for unknown category', () => {
        const insight = getMarketInsight('Unknown');
        expect(insight.category).toBe('Unknown');
        expect(insight.avg_price).toBeGreaterThan(0);
    });

    test('applies platform multiplier for grailed', () => {
        const base = getMarketInsight('Clothing');
        const grailed = getMarketInsight('Clothing', { platform: 'grailed' });
        expect(grailed.avg_price).toBeGreaterThan(base.avg_price);
    });

    test('applies brand multiplier for premium brands', () => {
        const base = getMarketInsight('Bags');
        const gucci = getMarketInsight('Bags', { brand: 'Gucci' });
        expect(gucci.avg_price).toBeGreaterThan(base.avg_price);
    });

    test('includes insights_json', () => {
        const insight = getMarketInsight('Shoes');
        const details = JSON.parse(insight.insights_json);
        expect(details).toHaveProperty('best_time_to_list');
        expect(details).toHaveProperty('hot_keywords');
    });
});

describe('findOpportunities', () => {
    test('returns opportunity array', () => {
        const opportunities = findOpportunities('user-1');
        expect(Array.isArray(opportunities)).toBe(true);
        expect(opportunities.length).toBeGreaterThan(0);
    });

    test('only includes high-opportunity categories', () => {
        const opportunities = findOpportunities('user-1');
        for (const opp of opportunities) {
            expect(opp.opportunity_score).toBeGreaterThanOrEqual(60);
        }
    });

    test('sorted by opportunity score descending', () => {
        const opportunities = findOpportunities('user-1');
        for (let i = 1; i < opportunities.length; i++) {
            expect(opportunities[i - 1].opportunity_score)
                .toBeGreaterThanOrEqual(opportunities[i].opportunity_score);
        }
    });

    test('respects limit option', () => {
        const opportunities = findOpportunities('user-1', { limit: 2 });
        expect(opportunities.length).toBeLessThanOrEqual(2);
    });

    test('includes recommendation text', () => {
        const opportunities = findOpportunities('user-1');
        for (const opp of opportunities) {
            expect(typeof opp.recommendation).toBe('string');
            expect(opp.recommendation.length).toBeGreaterThan(0);
        }
    });
});

describe('comparePricesWithCompetitors', () => {
    test('returns comparison data', () => {
        const item = { category: 'Shoes', list_price: 85 };
        const result = comparePricesWithCompetitors(item, 'ebay');
        expect(result).toHaveProperty('your_price', 85);
        expect(result).toHaveProperty('avg_competitor_price');
        expect(result).toHaveProperty('min_competitor_price');
        expect(result).toHaveProperty('max_competitor_price');
        expect(result).toHaveProperty('price_position');
        expect(result).toHaveProperty('percent_difference');
        expect(result).toHaveProperty('competitor_count');
        expect(result).toHaveProperty('recommendation');
    });

    test('price_position is one of expected values', () => {
        const item = { category: 'Shoes', list_price: 85 };
        const result = comparePricesWithCompetitors(item, 'ebay');
        expect(['competitive', 'above_market', 'below_market']).toContain(result.price_position);
    });

    test('very high price is above_market', () => {
        const item = { category: 'Clothing', list_price: 999 };
        const result = comparePricesWithCompetitors(item, 'poshmark');
        expect(result.price_position).toBe('above_market');
        expect(result.recommendation).toContain('lower');
    });

    test('very low price is below_market', () => {
        const item = { category: 'Clothing', list_price: 1 };
        const result = comparePricesWithCompetitors(item, 'poshmark');
        expect(result.price_position).toBe('below_market');
        expect(result.recommendation).toContain('money');
    });

    test('falls back to Clothing for unknown category', () => {
        const item = { category: 'Unknown', list_price: 42 };
        const result = comparePricesWithCompetitors(item, 'ebay');
        expect(result.avg_competitor_price).toBeGreaterThan(0);
    });
});

describe('getTrendingCategories', () => {
    test('returns top 5 trending categories', () => {
        const trending = getTrendingCategories();
        expect(Array.isArray(trending)).toBe(true);
        expect(trending.length).toBeLessThanOrEqual(5);
    });

    test('sorted by trend_score descending', () => {
        const trending = getTrendingCategories();
        for (let i = 1; i < trending.length; i++) {
            expect(trending[i - 1].trend_score)
                .toBeGreaterThanOrEqual(trending[i].trend_score);
        }
    });

    test('each entry has required fields', () => {
        const trending = getTrendingCategories();
        for (const item of trending) {
            expect(item).toHaveProperty('category');
            expect(item).toHaveProperty('trend_score');
            expect(item).toHaveProperty('avg_price');
            expect(item).toHaveProperty('demand');
            expect(['rising', 'stable', 'falling']).toContain(item.demand);
        }
    });
});
