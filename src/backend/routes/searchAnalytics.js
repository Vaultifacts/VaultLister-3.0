import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

export async function searchAnalyticsRouter(ctx) {
  const { method, path, body, query: queryParams, user } = ctx;
  if (!user) return { status: 401, data: { error: 'Authentication required' } };

  try {
    // POST /track - Record a search (increment if exists)
    if (method === 'POST' && path === '/track') {
      const userId = user.id;
      const { term, results_found = 0 } = body;

      if (!term || term.trim().length === 0) {
        return { status: 400, data: { error: 'Search term is required' } };
      }

      if (term.length > 500) {
        return { status: 400, data: { error: 'Search term must be 500 characters or less' } };
      }

      const normalizedTerm = term.trim().toLowerCase();

      // Check if search term already exists
      const existing = await query.get(
        `SELECT id, search_count FROM search_analytics
         WHERE user_id = ? AND search_term = ?`,
        [userId, normalizedTerm]
      );

      if (existing) {
        // Increment count
        await query.run(
          `UPDATE search_analytics
           SET search_count = search_count + 1,
               results_found = ?,
               last_searched_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [results_found, existing.id]
        );

        return {
          status: 200,
          data: {
            success: true,
            search_count: existing.search_count + 1
          }
        };
      } else {
        // Create new entry
        const id = nanoid();
        await query.run(
          `INSERT INTO search_analytics
           (id, user_id, search_term, search_count, results_found, last_searched_at)
           VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)`,
          [id, userId, normalizedTerm, results_found]
        );

        return {
          status: 200,
          data: {
            success: true,
            search_count: 1
          }
        };
      }
    }

    // GET /popular - Top 20 most searched terms
    if (method === 'GET' && path === '/popular') {
      const userId = user.id;
      const limit = Math.min(parseInt(queryParams.limit) || 20, 100);

      const popular = await query.all(
        `SELECT search_term, search_count, results_found, last_searched_at
         FROM search_analytics
         WHERE user_id = ?
         ORDER BY search_count DESC
         LIMIT ?`,
        [userId, limit]
      );

      return { status: 200, data: { popular } };
    }

    // GET /no-results - Searches that returned 0 results
    if (method === 'GET' && path === '/no-results') {
      const userId = user.id;

      const noResults = await query.all(
        `SELECT search_term, search_count, last_searched_at
         FROM search_analytics
         WHERE user_id = ? AND results_found = 0
         ORDER BY search_count DESC
         LIMIT 200`,
        [userId]
      );

      return {
        status: 200,
        data: {
          no_results: noResults,
          message: noResults.length > 0
            ? 'These searches found no results - potential inventory gaps'
            : 'All searches returned results'
        }
      };
    }

    // GET /dashboard - Search analytics summary
    if (method === 'GET' && path === '/dashboard') {
      const userId = user.id;

      // Total searches
      const totalStats = await query.get(
        `SELECT
           COUNT(*) as unique_terms,
           SUM(search_count) as total_searches,
           AVG(results_found) as avg_results
         FROM search_analytics
         WHERE user_id = ?`,
        [userId]
      );

      // Top 10 searches
      const topSearches = await query.all(
        `SELECT search_term, search_count, results_found
         FROM search_analytics
         WHERE user_id = ?
         ORDER BY search_count DESC
         LIMIT 10`,
        [userId]
      );

      // Searches with no results count
      const noResultsCount = await query.get(
        `SELECT COUNT(*) as count
         FROM search_analytics
         WHERE user_id = ? AND results_found = 0`,
        [userId]
      );

      return {
        status: 200,
        data: {
          total_searches: totalStats.total_searches || 0,
          unique_terms: totalStats.unique_terms || 0,
          avg_results: Math.round((totalStats.avg_results || 0) * 10) / 10,
          no_results_count: noResultsCount.count || 0,
          top_searches: topSearches
        }
      };
    }

    return { status: 404, data: { error: 'Endpoint not found' } };
  } catch (error) {
    logger.error('[SearchAnalytics] Search analytics router error', user?.id || null, { detail: error.message });
    return { status: 500, data: { error: 'Internal server error' } };
  }
}
