// Community Routes
// Handles forum posts, success stories, tips, leaderboard, and moderation

import crypto from 'crypto';
import { query, escapeLike } from '../db/database.js';
import { logger } from '../shared/logger.js';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

/**
 * Community router
 */
export async function communityRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;
// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

    // POST /api/community/posts - Create new post
    if (method === 'POST' && path === '/posts') {
        const { type, title, content, tags, sale_details } = body;

        if (!type || !title || !content) {
            return {
                status: 400,
                data: { error: 'type, title, and content are required' }
            };
        }

        if (!['discussion', 'success', 'tip'].includes(type)) {
            return {
                status: 400,
                data: { error: 'type must be discussion, success, or tip' }
            };
        }

        // Validate length limits
        if (title.length > 200) {
            return { status: 400, data: { error: 'Title must be 200 characters or less' } };
        }

        if (content.length > 10000) {
            return { status: 400, data: { error: 'Content must be 10,000 characters or less' } };
        }

        if (tags && (!Array.isArray(tags) || tags.length > 10)) {
            return { status: 400, data: { error: 'Tags must be an array with 10 or fewer items' } };
        }

        // Sanitize tags: enforce max length and strip HTML
        const sanitizedTags = tags ? tags.map(t => String(t).slice(0, 50).replace(/<[^>]*>/g, '').trim()).filter(Boolean) : null;

        try {
            const postId = `post_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO community_posts (id, user_id, type, title, body, tags, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    postId,
                    user.id,
                    type,
                    escapeHtml(title),
                    escapeHtml(content),
                    sanitizedTags ? JSON.stringify(sanitizedTags) : '[]'
                ]
            );

            const post = await query.get(
                `SELECT p.*, u.username as author_name
                 FROM community_posts p
                 JOIN users u ON p.user_id = u.id
                 WHERE p.id = ?`,
                [postId]
            );

            // Parse JSON fields
            post.tags = safeJsonParse(post.tags, []);
            post.sale_details = post.sale_details ? safeJsonParse(post.sale_details, null) : null;

            return {
                status: 201,
                data: { success: true, post }
            };
        } catch (error) {
            logger.error('[Community] Error creating post', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to create post' }
            };
        }
    }

    // GET /api/community/posts - List posts with filters
    if (method === 'GET' && path === '/posts') {
        const { type, sort = 'recent', search, limit: rawLimit = 50, offset: rawOffset = 0 } = queryParams;
        const limit = Math.min(Math.max(1, parseInt(rawLimit) || 50), 100);
        const offset = Math.max(0, parseInt(rawOffset) || 0);

        try {
            let sql = `
                SELECT
                    p.*,
                    u.username as author_name,
                    (SELECT COUNT(*) FROM community_replies WHERE post_id = p.id) as reply_count,
                    (SELECT COUNT(*) FROM community_reactions WHERE target_type = 'post' AND target_id = p.id AND reaction_type = 'upvote') as upvote_count
                FROM community_posts p
                JOIN users u ON p.user_id = u.id
                WHERE p.is_hidden = 0
            `;

            const params = [];

            // Filter by type
            if (type && ['discussion', 'success', 'tip'].includes(type)) {
                sql += ` AND p.type = ?`;
                params.push(type);
            }

            // Search in title/body
            if (search) {
                sql += ` AND (p.title ILIKE ? ESCAPE '\\' OR p.body ILIKE ? ESCAPE '\\')`;
                params.push(`%${escapeLike(search)}%`, `%${escapeLike(search)}%`);
            }

            // Sorting
            if (sort === 'recent') {
                sql += ` ORDER BY p.created_at DESC`;
            } else if (sort === 'popular') {
                sql += ` ORDER BY upvote_count DESC, p.created_at DESC`;
            } else if (sort === 'discussed') {
                sql += ` ORDER BY reply_count DESC, p.created_at DESC`;
            }

            sql += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const posts = await query.all(sql, params);

            // Parse JSON fields
            posts.forEach(post => {
                post.tags = safeJsonParse(post.tags, []);
                post.sale_details = post.sale_details ? safeJsonParse(post.sale_details, null) : null;
            });

            return {
                status: 200,
                data: { posts }
            };
        } catch (error) {
            logger.error('[Community] Error fetching posts', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch posts' }
            };
        }
    }

    // GET /api/community/posts/:id - Get single post with replies
    if (method === 'GET' && path.match(/^\/posts\/[a-f0-9-]+$/)) {
        const postId = path.split('/')[2];

        try {
            // Get post (hidden posts only visible to their author)
            const post = await query.get(
                `SELECT p.*, u.username as author_name
                 FROM community_posts p
                 JOIN users u ON p.user_id = u.id
                 WHERE p.id = ? AND (p.is_hidden = 0 OR p.user_id = ?)`,
                [postId, user?.id]
            );

            if (!post) {
                return {
                    status: 404,
                    data: { error: 'Post not found' }
                };
            }

            // Parse JSON
            post.tags = safeJsonParse(post.tags, []);
            post.sale_details = post.sale_details ? safeJsonParse(post.sale_details, null) : null;

            // Get replies
            const replies = await query.all(
                `SELECT r.*, u.username as author_name
                 FROM community_replies r
                 JOIN users u ON r.user_id = u.id
                 WHERE r.post_id = ?
                 ORDER BY r.created_at ASC
                 LIMIT 500`,
                [postId]
            );

            // Get reactions
            const reactions = await query.all(
                `SELECT reaction_type, COUNT(*) as count
                 FROM community_reactions
                 WHERE target_type = 'post' AND target_id = ?
                 GROUP BY reaction_type`,
                [postId]
            );

            // Check if user reacted (only if authenticated)
            const userReaction = user ? await query.get(
                `SELECT reaction_type FROM community_reactions
                 WHERE target_type = 'post' AND target_id = ? AND user_id = ?`,
                [postId, user.id]
            ) : null;

            return {
                status: 200,
                data: {
                    post,
                    replies,
                    reactions,
                    user_reaction: userReaction?.reaction_type || null
                }
            };
        } catch (error) {
            logger.error('[Community] Error fetching post', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch post' }
            };
        }
    }

    // POST /api/community/posts/:id/replies - Add reply to post
    if (method === 'POST' && path.match(/^\/posts\/[^/]+\/replies$/)) {
        const postId = path.split('/')[2];
        const { content, parent_reply_id } = body;

        if (!content || !content.trim()) {
            return {
                status: 400,
                data: { error: 'content is required' }
            };
        }

        try {
            // Verify post exists
            const post = await query.get(
                `SELECT id FROM community_posts WHERE id = ?`,
                [postId]
            );

            if (!post) {
                return {
                    status: 404,
                    data: { error: 'Post not found' }
                };
            }

            const replyId = `reply_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO community_replies (id, post_id, user_id, parent_reply_id, body)
                 VALUES (?, ?, ?, ?, ?)`,
                [replyId, postId, user.id, parent_reply_id || null, escapeHtml(content)]
            );

            const reply = await query.get(
                `SELECT r.*, u.username as author_name
                 FROM community_replies r
                 JOIN users u ON r.user_id = u.id
                 WHERE r.id = ?`,
                [replyId]
            );

            return {
                status: 201,
                data: { success: true, reply }
            };
        } catch (error) {
            logger.error('[Community] Error adding reply', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to add reply' }
            };
        }
    }

    // POST /api/community/posts/:id/react - React to post
    if (method === 'POST' && path.match(/^\/posts\/[^/]+\/react$/)) {
        const postId = path.split('/')[2];
        const { reaction_type } = body;

        if (!['upvote', 'congratulate', 'helpful'].includes(reaction_type)) {
            return {
                status: 400,
                data: { error: 'reaction_type must be upvote, congratulate, or helpful' }
            };
        }

        try {
            // Check if already reacted
            const existing = await query.get(
                `SELECT id, reaction_type FROM community_reactions
                 WHERE target_type = 'post' AND target_id = ? AND user_id = ?`,
                [postId, user.id]
            );

            if (existing) {
                if (existing.reaction_type === reaction_type) {
                    // Remove reaction (toggle off)
                    await query.run(
                        `DELETE FROM community_reactions WHERE id = ? AND user_id = ?`,
                        [existing.id, user.id]
                    );

                    return {
                        status: 200,
                        data: { success: true, action: 'removed' }
                    };
                } else {
                    // Update reaction
                    await query.run(
                        `UPDATE community_reactions SET reaction_type = ? WHERE id = ? AND user_id = ?`,
                        [reaction_type, existing.id, user.id]
                    );

                    return {
                        status: 200,
                        data: { success: true, action: 'updated' }
                    };
                }
            }

            // Add new reaction
            const reactionId = `react_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            await query.run(
                `INSERT INTO community_reactions (id, user_id, target_type, target_id, reaction_type, created_at)
                 VALUES (?, ?, 'post', ?, ?, NOW())`,
                [reactionId, user.id, postId, reaction_type]
            );

            return {
                status: 201,
                data: { success: true, action: 'added' }
            };
        } catch (error) {
            logger.error('[Community] Error reacting to post', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to react' }
            };
        }
    }

    // GET /api/community/leaderboard - Get top users
    if (method === 'GET' && path === '/leaderboard') {
        const { period = 'all', limit: rawLeaderLimit = 10 } = queryParams;
        const leaderLimit = Math.min(Math.max(1, parseInt(rawLeaderLimit) || 10), 50);

        try {
            let dateFilter = '';
            if (period === '30d') {
                dateFilter = `AND s.last_active_at >= NOW() - INTERVAL '30 days'`;
            } else if (period === '90d') {
                dateFilter = `AND s.last_active_at >= NOW() - INTERVAL '90 days'`;
            } else if (period === 'year') {
                dateFilter = `AND s.last_active_at >= NOW() - INTERVAL '1 year'`;
            }

            const leaderboard = await query.all(
                `SELECT
                    s.user_id,
                    u.username,
                    s.posts_count,
                    s.replies_count,
                    s.upvotes_received,
                    s.helpful_count,
                    s.total_sales_shared,
                    s.total_profit_shared,
                    (s.posts_count * 10 + s.replies_count * 5 + s.upvotes_received * 2 + s.helpful_count * 3) as total_score
                 FROM community_stats s
                 JOIN users u ON s.user_id = u.id
                 WHERE 1=1 ${dateFilter}
                 ORDER BY total_score DESC
                 LIMIT ?`,
                [leaderLimit]
            );

            return {
                status: 200,
                data: { leaderboard }
            };
        } catch (error) {
            logger.error('[Community] Error fetching leaderboard', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to fetch leaderboard' }
            };
        }
    }

    // POST /api/community/posts/:id/flag - Report post
    if (method === 'POST' && path.match(/^\/posts\/[^/]+\/flag$/)) {
        const postId = path.split('/')[2];
        const { reason } = body;

        if (!reason) {
            return {
                status: 400,
                data: { error: 'reason is required' }
            };
        }

        try {
            // Check for existing flag from this user
            const existing = await query.get(
                `SELECT id FROM community_flags WHERE user_id = ? AND target_type = 'post' AND target_id = ?`,
                [user.id, postId]
            );

            if (existing) {
                return {
                    status: 400,
                    data: { error: 'You have already flagged this post' }
                };
            }

            const flagId = `flag_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            await query.run(
                `INSERT INTO community_flags (id, user_id, target_type, target_id, reason)
                 VALUES (?, ?, 'post', ?, ?)`,
                [flagId, user.id, postId, reason]
            );

            return {
                status: 201,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Community] Error flagging post', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to flag post' }
            };
        }
    }

    // PATCH /api/community/replies/:id - Edit own reply
    if (method === 'PATCH' && path.match(/^\/replies\/[a-f0-9-]+$/)) {
        const replyId = path.split('/')[2];
        const { content } = body;

        if (!content || !content.trim()) {
            return {
                status: 400,
                data: { error: 'content is required' }
            };
        }

        try {
            // Verify reply exists
            const reply = await query.get(
                `SELECT id, user_id FROM community_replies WHERE id = ?`,
                [replyId]
            );

            if (!reply) {
                return {
                    status: 404,
                    data: { error: 'Reply not found' }
                };
            }

            // Verify ownership
            if (reply.user_id !== user.id) {
                return {
                    status: 403,
                    data: { error: 'You can only edit your own replies' }
                };
            }

            // Update the reply
            await query.run(
                `UPDATE community_replies SET body = ?, updated_at = NOW() WHERE id = ?`,
                [escapeHtml(content.trim()), replyId]
            );

            const updatedReply = await query.get(
                `SELECT r.*, u.username as author_name
                 FROM community_replies r
                 JOIN users u ON r.user_id = u.id
                 WHERE r.id = ?`,
                [replyId]
            );

            return {
                status: 200,
                data: { reply: updatedReply }
            };
        } catch (error) {
            logger.error('[Community] Error updating reply', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to update reply' }
            };
        }
    }

    // DELETE /api/community/posts/:id - Delete own post
    if (method === 'DELETE' && path.match(/^\/posts\/[a-f0-9-]+$/)) {
        const postId = path.split('/')[2];

        try {
            // Verify ownership
            const post = await query.get(
                `SELECT id FROM community_posts WHERE id = ? AND user_id = ?`,
                [postId, user.id]
            );

            if (!post) {
                return {
                    status: 404,
                    data: { error: 'Post not found or not owned by you' }
                };
            }

            // Soft delete (set is_hidden = 1)
            await query.run(
                `UPDATE community_posts SET is_hidden = 1 WHERE id = ? AND user_id = ?`,
                [postId, user.id]
            );

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Community] Error deleting post', user?.id, { detail: error.message });
            return {
                status: 500,
                data: { error: 'Failed to delete post' }
            };
        }
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
}
