// Roadmap Routes
// Product roadmap features and user voting

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { logger } from '../shared/logger.js';
import { cacheFor, cacheForUser } from '../middleware/cache.js';

/**
 * Roadmap router
 */
export async function roadmapRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ============================================
    // ROADMAP FEATURES
    // ============================================

    // GET /api/roadmap - List all roadmap features
    if (method === 'GET' && (path === '' || path === '/')) {
        const { status, category } = queryParams;

        try {
            let sql = `SELECT * FROM roadmap_features WHERE 1=1`;
            const params = [];

            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            sql += ` ORDER BY votes DESC, created_at DESC LIMIT 200`;

            const features = await query.all(sql, params);

            // For each feature, check if current user has voted
            if (user) {
                for (const feature of features) {
                    const vote = await query.get(
                        `SELECT id FROM roadmap_votes WHERE feature_id = ? AND user_id = ?`,
                        [feature.id, user.id]
                    );
                    feature.user_voted = !!vote;
                }
            }

            return {
                status: 200,
                data: { features },
                cacheControl: user ? cacheForUser(600) : cacheFor(600),
            };
        } catch (error) {
            logger.error('[Roadmap] Error fetching roadmap features', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch roadmap features' }
            };
        }
    }

    // GET /api/roadmap/:id - Get single roadmap feature
    if (method === 'GET' && path.match(/^\/[a-f0-9-]+$/)) {
        const featureId = path.split('/')[1];

        try {
            const feature = await query.get(`SELECT * FROM roadmap_features WHERE id = ?`, [featureId]);

            if (!feature) {
                return {
                    status: 404,
                    data: { error: 'Feature not found' }
                };
            }

            // Check if current user has voted
            if (user) {
                const vote = await query.get(
                    `SELECT id FROM roadmap_votes WHERE feature_id = ? AND user_id = ?`,
                    [feature.id, user.id]
                );
                feature.user_voted = !!vote;
            }

            return {
                status: 200,
                data: { feature }
            };
        } catch (error) {
            logger.error('[Roadmap] Error fetching roadmap feature', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch feature' }
            };
        }
    }

    // POST /api/roadmap/vote/:id - Vote for a feature
    if (method === 'POST' && path.match(/^\/vote\/[^\/]+$/)) {
        const featureId = path.split('/')[2];

        if (!user) {
            return {
                status: 401,
                data: { error: 'Authentication required' }
            };
        }

        const voteRateError = await applyRateLimit(ctx, 'mutation');
        if (voteRateError) return voteRateError;

        try {
            // Check if feature exists
            const feature = await query.get(`SELECT * FROM roadmap_features WHERE id = ?`, [featureId]);

            if (!feature) {
                return {
                    status: 404,
                    data: { error: 'Feature not found' }
                };
            }

            const result = await query.transaction(async (tx) => {
                const existingVote = await tx.get(
                    `SELECT id FROM roadmap_votes WHERE feature_id = ? AND user_id = ?`,
                    [featureId, user.id]
                );

                if (existingVote) {
                    await tx.run(`DELETE FROM roadmap_votes WHERE id = ? AND user_id = ?`, [existingVote.id, user.id]);
                    await tx.run(`UPDATE roadmap_features SET votes = votes - 1 WHERE id = ?`, [featureId]);
                    return { message: 'Vote removed', voted: false, votes: feature.votes - 1 };
                } else {
                    const voteId = nanoid();
                    await tx.run(
                        `INSERT INTO roadmap_votes (id, feature_id, user_id) VALUES (?, ?, ?)`,
                        [voteId, featureId, user.id]
                    );
                    await tx.run(`UPDATE roadmap_features SET votes = votes + 1 WHERE id = ?`, [featureId]);
                    return { message: 'Vote added', voted: true, votes: feature.votes + 1 };
                }
            });

            return { status: 200, data: result };
        } catch (error) {
            logger.error('[Roadmap] Error voting for feature', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to vote' }
            };
        }
    }

    // POST /api/roadmap - Create new feature (admin only)
    if (method === 'POST' && (path === '' || path === '/')) {
        if (!user || !user.is_admin) {
            return {
                status: 403,
                data: { error: 'Admin access required' }
            };
        }

        const { title, description, category, eta, status } = body;

        if (!title) {
            return {
                status: 400,
                data: { error: 'Title is required' }
            };
        }

        try {
            const featureId = nanoid();
            await query.run(
                `INSERT INTO roadmap_features (id, title, description, category, eta, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [featureId, title, description || null, category || null, eta || null, status || 'planned']
            );

            const feature = await query.get(`SELECT * FROM roadmap_features WHERE id = ?`, [featureId]);

            return {
                status: 201,
                data: { feature }
            };
        } catch (error) {
            logger.error('[Roadmap] Error creating roadmap feature', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to create feature' }
            };
        }
    }

    // PATCH /api/roadmap/:id - Update feature progress/status/eta/description/title (admin only)
    if (method === 'PATCH' && path.match(/^\/[a-f0-9-]+$/)) {
        const featureId = path.split('/')[1];

        if (!user?.is_admin) {
            return {
                status: 403,
                data: { error: 'Admin access required' }
            };
        }

        try {
            const updates = [];
            const params = [];
            if (body.progress !== undefined) { updates.push('progress = ?'); params.push(Math.min(100, Math.max(0, parseInt(body.progress) || 0))); }
            if (body.status !== undefined && ['planned', 'in_progress', 'completed'].includes(body.status)) {
                updates.push('status = ?'); params.push(body.status);
                if (body.status === 'completed') { updates.push('progress = 100'); }
            }
            if (body.eta !== undefined) { updates.push('eta = ?'); params.push(body.eta || null); }
            if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description || null); }
            if (body.title !== undefined && body.title) { updates.push('title = ?'); params.push(body.title); }
            if (updates.length === 0) return { status: 400, data: { error: 'No valid fields to update' } };
            updates.push('updated_at = NOW()');
            params.push(featureId);
            await query.run(`UPDATE roadmap_features SET ${updates.join(', ')} WHERE id = ?`, params);
            const feature = await query.get('SELECT * FROM roadmap_features WHERE id = ?', [featureId]);
            if (!feature) return { status: 404, data: { error: 'Feature not found' } };
            return { status: 200, data: { feature } };
        } catch (error) {
            logger.error('[Roadmap] Error updating roadmap feature', user?.id, { detail: error?.message });
            return {
                status: 500,
                data: { error: 'Failed to update feature' }
            };
        }
    }

    // GET /api/roadmap/changelog/rss - RSS feed for changelog
    if (method === 'GET' && path === '/changelog/rss') {
        const versions = [
            { version: 'v1.6.0', date: '2026-01-27', summary: 'Sidebar Icon-Only Mode, Pie Charts, Chart Type Toggle, About Us Page' },
            { version: 'v1.5.0', date: '2026-01-26', summary: 'Gmail Integration, Batch Photo Processing, Receipt Parser AI, Token Encryption' },
            { version: 'v1.4.0', date: '2026-01-24', summary: 'Calendar View, Product Roadmap, Enhanced Notifications' },
            { version: 'v1.3.0', date: '2026-01-15', summary: 'Help & Support System, Support Tickets, Search Functionality' },
            { version: 'v1.2.0', date: '2026-01-08', summary: 'Chrome Extension, Image Bank, Community Features' },
            { version: 'v1.1.0', date: '2025-12-20', summary: 'Listing Templates, Low Stock Alerts, OAuth Integration' },
            { version: 'v1.0.0', date: '2025-12-01', summary: 'Initial Release with Inventory, Multi-Platform Support, Analytics' }
        ];

        const rssItems = versions.map(v => `
    <item>
      <title>VaultLister ${v.version}</title>
      <description>${v.summary}</description>
      <pubDate>${v.date ? new Date(v.date).toUTCString() : new Date().toUTCString()}</pubDate>
      <guid>vaultlister-${v.version}</guid>
    </item>`).join('');

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VaultLister Changelog</title>
    <description>Latest updates and features from VaultLister</description>
    <link>https://vaultlister.com/changelog</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`;

        return {
            status: 200,
            headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
            data: rss,
            raw: true
        };
    }

    // 404
    return {
        status: 404,
        data: { error: 'Endpoint not found' }
    };
}
