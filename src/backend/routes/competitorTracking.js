import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function competitorTrackingRouter(ctx) {
  const { method, path, body, query: queryParams, user } = ctx;

  if (!user) {
    return { status: 401, data: { error: 'Authentication required' } };
  }

  try {
    // GET /keywords - List keyword clusters with opportunity scores
    if (method === 'GET' && path === '/keywords') {
      const keywords = await query.all(
        `SELECT * FROM competitor_keywords
         WHERE user_id = ?
         ORDER BY opportunity_score DESC, competitor_count DESC
         LIMIT 500`,
        [user.id]
      );

      return { status: 200, data: { keywords } };
    }

    // POST /keywords/analyze - Analyze competitor keywords from listings data
    if (method === 'POST' && path === '/keywords/analyze') {
      // Get all competitor listings
      const competitorListings = await query.all(
        `SELECT cl.title, cl.price FROM competitor_listings cl
         JOIN competitors c ON cl.competitor_id = c.id
         WHERE c.user_id = ?`,
        [user.id]
      );

      // Get user's listings
      const userListings = await query.all(
        `SELECT title FROM listings WHERE user_id = ?`,
        [user.id]
      );

      // Extract keywords from titles (simple word extraction)
      const keywordMap = {};
      const userKeywords = new Set();

      // Process competitor listings
      competitorListings.forEach(listing => {
        const words = listing.title.toLowerCase().match(/\b\w{4,}\b/g) || [];
        words.forEach(word => {
          if (!keywordMap[word]) {
            keywordMap[word] = { count: 0, prices: [] };
          }
          keywordMap[word].count++;
          if (listing.price) {
            keywordMap[word].prices.push(listing.price);
          }
        });
      });

      // Process user listings
      userListings.forEach(listing => {
        const words = listing.title.toLowerCase().match(/\b\w{4,}\b/g) || [];
        words.forEach(word => userKeywords.add(word));
      });

      // Clear existing keywords for this user
      await query.run(
        `DELETE FROM competitor_keywords WHERE user_id = ?`,
        [user.id]
      );

      // Insert analyzed keywords with opportunity scores
      const insertPromises = [];
      for (const [keyword, data] of Object.entries(keywordMap)) {
        const avgPrice = data.prices.length > 0
          ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length
          : null;

        const yourListingCount = userKeywords.has(keyword) ? 1 : 0;

        // Opportunity score: high competitor count + low user count = high opportunity
        const opportunityScore = data.count * (yourListingCount === 0 ? 2 : 0.5);

        insertPromises.push(
          query.run(
            `INSERT INTO competitor_keywords
             (id, user_id, keyword, competitor_count, avg_price, your_listing_count, opportunity_score, last_analyzed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [nanoid(), user.id, keyword, data.count, avgPrice, yourListingCount, opportunityScore]
          )
        );
      }

      await Promise.all(insertPromises);

      const totalKeywords = Object.keys(keywordMap).length;
      return {
        status: 200,
        data: {
          success: true,
          analyzed: totalKeywords,
          message: `Analyzed ${totalKeywords} keywords from competitor listings`
        }
      };
    }

    // GET /keywords/opportunities - Top keyword opportunities
    if (method === 'GET' && path === '/keywords/opportunities') {
      const limit = Math.min(Math.max(1, parseInt(queryParams.limit) || 20), 100);

      const opportunities = await query.all(
        `SELECT * FROM competitor_keywords
         WHERE user_id = ?
         AND your_listing_count = 0
         AND competitor_count >= 3
         ORDER BY opportunity_score DESC
         LIMIT ?`,
        [user.id, limit]
      );

      return { status: 200, data: { opportunities } };
    }

    // GET /price-intelligence - Get pricing suggestions based on competitor data
    if (method === 'GET' && path === '/price-intelligence') {
      const { category, brand } = queryParams;

      let competitorQuery = `
        SELECT cl.price FROM competitor_listings cl
        JOIN competitors c ON cl.competitor_id = c.id
        WHERE c.user_id = ? AND cl.price > 0
      `;
      const params = [user.id];

      if (category) {
        competitorQuery += ` AND category = ?`;
        params.push(category);
      }
      if (brand) {
        competitorQuery += ` AND brand = ?`;
        params.push(brand);
      }

      const competitorPrices = await query.all(competitorQuery, params);

      if (competitorPrices.length === 0) {
        return {
          status: 200,
          data: {
            message: 'No competitor pricing data available',
            suggested_price: null
          }
        };
      }

      const prices = competitorPrices.map(c => c.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Suggested price: slightly below average (competitive)
      const suggestedPrice = Math.round((avgPrice * 0.95) * 100) / 100;

      // Get user's current price if available
      let userQuery = `
        SELECT AVG(price) as current_price FROM listings
        WHERE user_id = ? AND price > 0
      `;
      const userParams = [user.id];

      if (category) {
        userQuery += ` AND category = ?`;
        userParams.push(category);
      }
      if (brand) {
        userQuery += ` AND brand = ?`;
        userParams.push(brand);
      }

      const userPrice = await query.get(userQuery, userParams);

      return {
        status: 200,
        data: {
          suggested_price: suggestedPrice,
          competitor_avg: Math.round(avgPrice * 100) / 100,
          competitor_min: minPrice,
          competitor_max: maxPrice,
          your_current_price: userPrice?.current_price || null,
          sample_size: prices.length
        }
      };
    }

    // POST /price-intelligence/refresh - Recalculate prices from competitor_listings
    if (method === 'POST' && path === '/price-intelligence/refresh') {
      // Get all unique categories and brands
      const segments = await query.all(
        `SELECT DISTINCT cl.category, cl.brand FROM competitor_listings cl
         JOIN competitors c ON cl.competitor_id = c.id
         WHERE c.user_id = ? AND cl.price > 0`,
        [user.id]
      );

      const insights = [];

      for (const segment of segments) {
        const prices = await query.all(
          `SELECT cl.price FROM competitor_listings cl
           JOIN competitors c ON cl.competitor_id = c.id
           WHERE c.user_id = ? AND cl.category = ? AND cl.brand = ? AND cl.price > 0`,
          [user.id, segment.category, segment.brand]
        );

        if (prices.length > 0) {
          const priceValues = prices.map(p => p.price);
          const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;

          insights.push({
            category: segment.category,
            brand: segment.brand,
            avg_price: Math.round(avg * 100) / 100,
            min_price: Math.min(...priceValues),
            max_price: Math.max(...priceValues),
            sample_size: prices.length
          });
        }
      }

      return {
        status: 200,
        data: {
          success: true,
          insights,
          message: `Refreshed pricing intelligence for ${insights.length} segments`
        }
      };
    }

    // No matching route
    return { status: 404, data: { error: 'Endpoint not found' } };

  } catch (error) {
    logger.error('[CompetitorTracking] Competitor tracking router error', user?.id || null, { detail: error.message });
    return { status: 500, data: { error: 'Internal server error' } };
  }
}
