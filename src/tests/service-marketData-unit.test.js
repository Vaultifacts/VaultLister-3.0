import { describe, expect, test, mock } from 'bun:test';

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mock, all: mock, run: mock,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  default: {}
}));

const {
  getCompetitorsForPlatform,
  generateCompetitorListings,
  getMarketInsight,
  findOpportunities,
  comparePricesWithCompetitors,
  getTrendingCategories
} = await import('../backend/services/marketDataService.js');

describe('marketDataService', () => {

  describe('getCompetitorsForPlatform', () => {
    test('returns competitors for poshmark', () => {
      const competitors = getCompetitorsForPlatform('poshmark');
      expect(competitors.length).toBeGreaterThan(0);
      expect(competitors[0]).toHaveProperty('username');
      expect(competitors[0]).toHaveProperty('platform', 'poshmark');
    });

    test('returns competitors for ebay', () => {
      const competitors = getCompetitorsForPlatform('ebay');
      expect(competitors.length).toBeGreaterThan(0);
      expect(competitors[0].platform).toBe('ebay');
    });

    test('returns empty array for unknown platform', () => {
      expect(getCompetitorsForPlatform('unknown')).toEqual([]);
    });

    test('each competitor has required fields', () => {
      for (const comp of getCompetitorsForPlatform('mercari')) {
        expect(comp).toHaveProperty('id');
        expect(comp).toHaveProperty('displayName');
        expect(comp).toHaveProperty('avg_price');
        expect(comp).toHaveProperty('listing_count');
        expect(comp).toHaveProperty('sell_through_rate');
        expect(comp).toHaveProperty('category_focus');
        expect(comp).toHaveProperty('last_checked_at');
      }
    });
  });

  describe('generateCompetitorListings', () => {
    test('returns requested number of listings', () => {
      expect(generateCompetitorListings('c1', 5)).toHaveLength(5);
    });

    test('defaults to 10 listings', () => {
      expect(generateCompetitorListings('c1')).toHaveLength(10);
    });

    test('each listing has required fields', () => {
      for (const listing of generateCompetitorListings('c1', 3)) {
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('competitor_id', 'c1');
        expect(listing).toHaveProperty('title');
        expect(typeof listing.price).toBe('number');
        expect(listing).toHaveProperty('category');
        expect(listing).toHaveProperty('brand');
      }
    });
  });

  describe('getMarketInsight', () => {
    test('returns insight with correct structure', () => {
      const insight = getMarketInsight('Shoes');
      expect(insight).toHaveProperty('category', 'Shoes');
      expect(insight).toHaveProperty('avg_price');
      expect(insight).toHaveProperty('saturation_score');
      expect(insight).toHaveProperty('opportunity_score');
      expect(insight).toHaveProperty('demand_trend');
      expect(insight).toHaveProperty('competition_level');
      expect(insight).toHaveProperty('recommended_price_range');
    });

    test('applies grailed platform multiplier (higher prices)', () => {
      const grailed = getMarketInsight('Shoes', { platform: 'grailed' });
      const base = getMarketInsight('Shoes');
      expect(grailed.avg_price).toBeGreaterThan(base.avg_price * 1.2);
    });

    test('applies premium brand multiplier', () => {
      const premium = getMarketInsight('Bags', { brand: 'Gucci' });
      const base = getMarketInsight('Bags');
      expect(premium.avg_price).toBeGreaterThan(base.avg_price * 2);
    });
  });

  describe('findOpportunities', () => {
    test('returns sorted by opportunity score descending', () => {
      const opps = findOpportunities('user-1');
      for (let i = 1; i < opps.length; i++) {
        expect(opps[i - 1].opportunity_score).toBeGreaterThanOrEqual(opps[i].opportunity_score);
      }
    });

    test('only includes categories with opportunity >= 60', () => {
      for (const opp of findOpportunities('user-1')) {
        expect(opp.opportunity_score).toBeGreaterThanOrEqual(60);
      }
    });

    test('respects limit option', () => {
      expect(findOpportunities('user-1', { limit: 2 }).length).toBeLessThanOrEqual(2);
    });
  });

  describe('comparePricesWithCompetitors', () => {
    test('returns comparison with required fields', () => {
      const result = comparePricesWithCompetitors({ category: 'Shoes', list_price: 100 }, 'ebay');
      expect(result).toHaveProperty('your_price', 100);
      expect(result).toHaveProperty('avg_competitor_price');
      expect(result).toHaveProperty('price_position');
      expect(['above_market', 'below_market', 'competitive']).toContain(result.price_position);
    });
  });

  describe('getTrendingCategories', () => {
    test('returns max 5 categories sorted by trend_score', () => {
      const trending = getTrendingCategories();
      expect(trending.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < trending.length; i++) {
        expect(trending[i - 1].trend_score).toBeGreaterThanOrEqual(trending[i].trend_score);
      }
    });

    test('each category has required fields', () => {
      for (const cat of getTrendingCategories()) {
        expect(cat).toHaveProperty('category');
        expect(cat).toHaveProperty('trend_score');
        expect(cat).toHaveProperty('demand');
        expect(['rising', 'stable', 'falling']).toContain(cat.demand);
      }
    });
  });
});
