import { query } from '../../backend/db/database.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../backend/shared/logger.js';

export function buildSearchText(brand, model, category, subcategory) {
    // Brand + model + subcategory only. Category is intentionally excluded — long category strings
    // (e.g. "Kitchen & Home Appliances") otherwise dominate trigram similarity, swamping the
    // distinctive brand/model signal.
    return [brand, model, subcategory].filter(Boolean).join(' ');
}

export async function findSimilar(searchText, { threshold = 0.3, limit = 10, category = null, brand = null } = {}) {
    // Two-pass matching when brand is known:
    //   Pass 1: restrict to that brand → catches generic-model cases
    //           (e.g. Vision says "Stanley Tumbler" → finds "Stanley Quencher 40oz Tumbler"
    //            even though general trigram would lose to "Yeti Rambler Tumbler").
    //   Pass 2: full DB trigram search → fallback when brand isn't in DB or no good match.
    // Category param is intentionally ignored (Vision's category guess often differs from DB category).
    if (brand) {
        const branded = await query.all(
            `SELECT *, similarity(search_text, ?) AS sim
             FROM product_reference
             WHERE brand ILIKE ? AND similarity(search_text, ?) > ?
             ORDER BY sim DESC
             LIMIT ?`,
            [searchText, brand, searchText, Math.max(threshold * 0.5, 0.15), limit]
        );
        if (branded.length > 0) return branded;
    }
    return query.all(
        `SELECT *, similarity(search_text, ?) AS sim
         FROM product_reference
         WHERE similarity(search_text, ?) > ?
         ORDER BY sim DESC
         LIMIT ?`,
        [searchText, searchText, threshold, limit]
    );
}

export async function storeReference({ brand, model, category, subcategory, title, description, condition, tags, avgSoldPrice, minSoldPrice, maxSoldPrice, soldCount, source, sourceId }) {
    const id = uuidv4();
    await query.run(
        `INSERT INTO product_reference (id, brand, model, category, subcategory, title, description, condition, tags, avg_sold_price, min_sold_price, max_sold_price, sold_count, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
        [id, brand || null, model || null, category, subcategory || null, title, description || null, condition || null, JSON.stringify(tags || []), avgSoldPrice || null, minSoldPrice || null, maxSoldPrice || null, soldCount || 1, source || 'claude-generated', sourceId || null]
    );
    return id;
}

export async function batchStoreReferences(references) {
    let inserted = 0;
    for (let i = 0; i < references.length; i += 50) {
        const chunk = references.slice(i, i + 50);
        for (const ref of chunk) {
            try {
                await storeReference(ref);
                inserted++;
            } catch (err) {
                logger.warn('Failed to insert reference', { title: ref.title, error: err.message });
            }
        }
    }
    return inserted;
}

export async function getReferenceCount() {
    const row = await query.get('SELECT COUNT(*)::int AS count FROM product_reference');
    return row?.count || 0;
}

export async function getCachedResponse(hash) {
    const row = await query.get(
        `SELECT response FROM ai_cache WHERE hash = ? AND created_at > NOW() - INTERVAL '30 days'`,
        [hash]
    );
    return row?.response || null;
}

export async function setCachedResponse(hash, response) {
    await query.run(
        `INSERT INTO ai_cache (hash, response) VALUES (?, ?::jsonb)
         ON CONFLICT (hash) DO UPDATE SET response = EXCLUDED.response, created_at = NOW()`,
        [hash, JSON.stringify(response)]
    );
}

export async function cleanExpiredCache() {
    const result = await query.run(`DELETE FROM ai_cache WHERE created_at < NOW() - INTERVAL '30 days'`);
    return result;
}
