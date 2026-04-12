import { describe, expect, test, mock } from 'bun:test';

const mockQueryAll = mock(() => Promise.resolve([]));

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mock(() => Promise.resolve(null)),
        all: mockQueryAll,
        run: mock(() => Promise.resolve({ changes: 0 })),
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  default: {}
}));

const {
  getCompetitorsForPlatform,
  normalizeScrapedListings,
  getMarketInsight,
  findOpportunities,
  comparePricesWithCompetitors,
  getTrendingCategories
} = await import('../backend/services/marketDataService.js');

describe('marketDataService', () => {

  describe('getCompetitorsForPlatform', () => {
    test('returns empty array when no userId provided', async () => {
      expect(await getCompetitorsForPlatform('poshmark')).toEqual([]);
    });

    test('returns empty array for unknown platform when no userId provided', async () => {
      expect(await getCompetitorsForPlatform('unknown')).toEqual([]);
    });

    test('calls db and returns array when userId is provided', async () => {
      // mockQueryAll returns [] — function returns that array
      const result = await getCompetitorsForPlatform('ebay', 'user-1');
      expect(Array.isArray(result)).toBe(true);
    });

    test('returns empty array when query throws', async () => {
      // Temporarily make query.all throw, source catch returns []
      mockQueryAll.mockImplementationOnce(() => { throw new Error('db error'); });
      const result = await getCompetitorsForPlatform('mercari', 'user-1');
      expect(result).toEqual([]);
    });
  });

  describe('normalizeScrapedListings', () => {
    test('returns requested number of listings', () => {
      const scraped = Array.from({ length: 5 }, (_, i) => ({ title: `Item ${i}`, price: `$${10 + i}`, listingUrl: `/listing/id-${i}` }));
      expect(normalizeScrapedListings('c1', scraped)).toHaveLength(5);
    });

    test('filters out entries with no title', () => {
      const scraped = [{ title: 'Good' }, { price: '$10' }, { title: 'Also Good' }];
      expect(normalizeScrapedListings('c1', scraped)).toHaveLength(2);
    });

    test('each listing has required fields', () => {
      const scraped = Array.from({ length: 3 }, (_, i) => ({ title: `Item ${i}`, price: `$${20 + i}`, listingUrl: `/listing/id-${i}` }));
      for (const listing of normalizeScrapedListings('c1', scraped)) {
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('competitor_id', 'c1');
        expect(listing).toHaveProperty('title');
        expect(typeof listing.price).toBe('number');
        expect(listing).toHaveProperty('external_id');
        expect(listing).toHaveProperty('url');
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
    test('returns comparison with required fields', async () => {
      const result = await comparePricesWithCompetitors({ category: 'Shoes', list_price: 100 }, 'ebay');
      expect(result).toHaveProperty('your_price', 100);
      expect(result).toHaveProperty('price_position');
      expect(['above_market', 'below_market', 'competitive', 'unknown']).toContain(result.price_position);
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
