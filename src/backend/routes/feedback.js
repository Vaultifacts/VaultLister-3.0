// Feedback Routes
// User feedback and feature suggestions

import { query, escapeLike } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';

/**
 * Feedback router
 */
export async function feedbackRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ============================================
    // FEEDBACK SUBMISSIONS
    // ============================================

    // GET /api/feedback/trending - Get top-voted feedback
    if (method === 'GET' && path === '/trending') {
        try {
            let sql = `SELECT f.*, COALESCE(u.full_name, u.username) as author_name
                FROM feedback_submissions f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE f.status != 'declined'
                ORDER BY (f.votes_up - f.votes_down) DESC, f.created_at DESC
                LIMIT 20`;

            const feedback = await query.all(sql);

            // If user is logged in, check their vote status
            if (user) {
                if (feedback.length > 0) {
                    const ids = feedback.map((f) => f.id);
                    const placeholders = ids.map(() => '?').join(',');
                    const votes = await query.all(
                        `SELECT feedback_id, vote_type FROM feedback_votes WHERE feedback_id IN (${placeholders}) AND user_id = ?`,
                        [...ids, user.id],
                    );
                    const voteMap = new Map(votes.map((v) => [v.feedback_id, v.vote_type]));
                    for (const item of feedback) {
                        item.user_vote = voteMap.get(item.id) || null;
                    }
                }
                for (const item of feedback) {
                    // Hide author for anonymous submissions
                    if (item.is_anonymous && item.user_id !== user.id) {
                        item.author_name = 'Anonymous';
                        item.user_id = null;
                    }
                }
            } else {
                feedback.forEach((item) => {
                    if (item.is_anonymous) {
                        item.author_name = 'Anonymous';
                        item.user_id = null;
                    }
                });
            }

            return { status: 200, data: { feedback } };
        } catch (error) {
            logger.error('[Feedback] error fetching trending feedback', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return { status: 500, data: { error: 'Failed to fetch trending feedback' } };
        }
    }

    // GET /api/feedback/analytics - Feedback analytics (admin only)
    if (method === 'GET' && path === '/analytics') {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }

        try {
            const byType = await query.all(
                `SELECT type, COUNT(*) as count FROM feedback_submissions GROUP BY type ORDER BY count DESC`,
            );
            const byStatus = await query.all(
                `SELECT status, COUNT(*) as count FROM feedback_submissions GROUP BY status ORDER BY count DESC`,
            );
            const byCategory = await query.all(
                `SELECT COALESCE(category, 'uncategorized') as category, COUNT(*) as count
                 FROM feedback_submissions GROUP BY category ORDER BY count DESC`,
            );
            const topVoted = await query.all(
                `SELECT f.id, f.title, f.type, f.status, f.votes_up, f.votes_down,
                        (f.votes_up - f.votes_down) as net_votes
                 FROM feedback_submissions f
                 ORDER BY net_votes DESC LIMIT 10`,
            );
            const recentActivity = await query.all(
                `SELECT f.id, f.title, f.type, f.status, f.created_at
                 FROM feedback_submissions f ORDER BY f.created_at DESC LIMIT 10`,
            );
            const totalCount = await query.get(`SELECT COUNT(*) as count FROM feedback_submissions`);
            const totalVotes = await query.get(
                `SELECT COALESCE(SUM(votes_up + votes_down), 0) as count FROM feedback_submissions`,
            );

            return {
                status: 200,
                data: {
                    analytics: {
                        byType,
                        byStatus,
                        byCategory,
                        topVoted,
                        recentActivity,
                        totalFeedback: totalCount.count,
                        totalVotes: totalVotes.count,
                    },
                },
            };
        } catch (error) {
            logger.error('[Feedback] error fetching feedback analytics', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return { status: 500, data: { error: 'Failed to fetch analytics' } };
        }
    }

    // GET /api/feedback/similar?q=text - Search similar feedback
    if (method === 'GET' && path === '/similar') {
        const searchQuery = queryParams.q;
        if (!searchQuery || searchQuery.trim().length < 3) {
            return { status: 200, data: { feedback: [] } };
        }

        try {
            const searchTerm = `%${escapeLike(searchQuery.trim())}%`;
            const feedback = await query.all(
                `SELECT id, title, type, status, votes_up, votes_down, created_at
                 FROM feedback_submissions
                 WHERE (title ILIKE ? ESCAPE '\\' OR description ILIKE ? ESCAPE '\\')
                 ORDER BY (votes_up - votes_down) DESC
                 LIMIT 5`,
                [searchTerm, searchTerm],
            );

            return { status: 200, data: { feedback } };
        } catch (error) {
            logger.error('[Feedback] error searching similar feedback', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return { status: 500, data: { error: 'Failed to search feedback' } };
        }
    }

    // GET /api/feedback - List all feedback (admin) or user's feedback
    if (method === 'GET' && (path === '' || path === '/')) {
        if (!user) {
            return {
                status: 401,
                data: { error: 'Authentication required' },
            };
        }

        const { status, type } = queryParams;

        try {
            let sql = `SELECT f.*, COALESCE(u.full_name, u.username) as author_name
                FROM feedback_submissions f
                LEFT JOIN users u ON f.user_id = u.id
                WHERE 1=1`;
            const params = [];

            // Non-admin users can only see their own feedback
            if (!user.is_admin) {
                sql += ` AND f.user_id = ?`;
                params.push(user.id);
            }

            if (status) {
                sql += ` AND f.status = ?`;
                params.push(status);
            }

            if (type) {
                sql += ` AND f.type = ?`;
                params.push(type);
            }

            sql += ` ORDER BY f.created_at DESC LIMIT 200`;

            const feedback = await query.all(sql, params);

            // Hide anonymous user info
            feedback.forEach((item) => {
                if (item.is_anonymous && item.user_id !== user.id) {
                    item.author_name = 'Anonymous';
                    item.user_id = null;
                }
            });

            return {
                status: 200,
                data: { feedback },
            };
        } catch (error) {
            logger.error('[Feedback] error fetching feedback', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch feedback' },
            };
        }
    }

    // GET /api/feedback/user - Get current user's feedback
    if (method === 'GET' && path === '/user') {
        if (!user) {
            return {
                status: 401,
                data: { error: 'Authentication required' },
            };
        }

        try {
            const feedback = await query.all(
                `SELECT * FROM feedback_submissions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
                [user.id],
            );

            return {
                status: 200,
                data: { feedback },
            };
        } catch (error) {
            logger.error('[Feedback] error fetching user feedback', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return {
                status: 500,
                data: { error: 'Failed to fetch feedback' },
            };
        }
    }

    // GET /api/feedback/:id/responses - Get thread responses
    if (method === 'GET' && path.match(/^\/[^\/]+\/responses$/)) {
        const feedbackId = path.split('/')[1];

        try {
            const responses = await query.all(
                `SELECT r.*, COALESCE(u.full_name, u.username) as author_name
                 FROM feedback_responses r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.feedback_id = ?
                 ORDER BY r.created_at ASC
                 LIMIT 500`,
                [feedbackId],
            );

            return { status: 200, data: { responses } };
        } catch (error) {
            logger.error('[Feedback] error fetching responses', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return { status: 500, data: { error: 'Failed to fetch responses' } };
        }
    }

    // POST /api/feedback/:id/responses - Add response to thread
    if (method === 'POST' && path.match(/^\/[^\/]+\/responses$/)) {
        const feedbackId = path.split('/')[1];

        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const { message } = body;
        if (!message || !message.trim()) {
            return { status: 400, data: { error: 'Message is required' } };
        }

        try {
            const feedback = await query.get(`SELECT * FROM feedback_submissions WHERE id = ?`, [feedbackId]);
            if (!feedback) {
                return { status: 404, data: { error: 'Feedback not found' } };
            }

            // Only feedback owner or admin can respond
            if (!user.is_admin && feedback.user_id !== user.id) {
                return { status: 403, data: { error: 'Only the author or admins can respond' } };
            }

            const responseId = nanoid();
            await query.run(
                `INSERT INTO feedback_responses (id, feedback_id, user_id, message, is_admin) VALUES (?, ?, ?, ?, ?)`,
                [responseId, feedbackId, user.id, message.trim(), user.is_admin ? 1 : 0],
            );

            const newResponse = await query.get(
                `SELECT r.*, COALESCE(u.full_name, u.username) as author_name
                 FROM feedback_responses r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.id = ?`,
                [responseId],
            );

            return { status: 201, data: { response: newResponse } };
        } catch (error) {
            logger.error('[Feedback] error adding response', user?.id, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to add response' } };
        }
    }

    // GET /api/feedback/:id - Get single feedback
    if (method === 'GET' && path.startsWith('/') && path.split('/').length === 2) {
        const feedbackId = path.split('/')[1];

        if (!user) {
            return {
                status: 401,
                data: { error: 'Authentication required' },
            };
        }

        try {
            const feedback = await query.get(
                `SELECT f.*, COALESCE(u.full_name, u.username) as author_name
                 FROM feedback_submissions f
                 LEFT JOIN users u ON f.user_id = u.id
                 WHERE f.id = ?`,
                [feedbackId],
            );

            if (!feedback) {
                return {
                    status: 404,
                    data: { error: 'Feedback not found' },
                };
            }

            // Users can only view their own feedback (unless admin)
            if (!user.is_admin && feedback.user_id !== user.id) {
                return {
                    status: 403,
                    data: { error: 'Access denied' },
                };
            }

            // Hide anonymous user info
            if (feedback.is_anonymous && feedback.user_id !== user.id) {
                feedback.author_name = 'Anonymous';
                feedback.user_id = null;
            }

            // Increment view count
            await query.run(`UPDATE feedback_submissions SET view_count = view_count + 1 WHERE id = ?`, [feedbackId]);

            // Get user's vote
            const vote = await query.get(`SELECT vote_type FROM feedback_votes WHERE feedback_id = ? AND user_id = ?`, [
                feedbackId,
                user.id,
            ]);
            feedback.user_vote = vote ? vote.vote_type : null;

            // Get response count
            const responseCount = await query.get(
                `SELECT COUNT(*) as count FROM feedback_responses WHERE feedback_id = ?`,
                [feedbackId],
            );
            feedback.response_count = responseCount.count;

            return {
                status: 200,
                data: { feedback },
            };
        } catch (error) {
            logger.error('[Feedback] error fetching feedback', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch feedback' },
            };
        }
    }

    // POST /api/feedback/vote/:id - Vote on feedback (up/down toggle)
    if (method === 'POST' && path.match(/^\/vote\/[^\/]+$/)) {
        const feedbackId = path.split('/')[2];

        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const { vote_type } = body;
        if (!vote_type || !['up', 'down'].includes(vote_type)) {
            return { status: 400, data: { error: 'vote_type must be "up" or "down"' } };
        }

        try {
            const feedback = await query.get(`SELECT * FROM feedback_submissions WHERE id = ?`, [feedbackId]);
            if (!feedback) {
                return { status: 404, data: { error: 'Feedback not found' } };
            }

            const result = await query.transaction(async () => {
                const existingVote = await query.get(
                    `SELECT id, vote_type FROM feedback_votes WHERE feedback_id = ? AND user_id = ?`,
                    [feedbackId, user.id],
                );

                if (existingVote) {
                    if (existingVote.vote_type === vote_type) {
                        // Same vote = toggle off (remove vote)
                        await query.run(`DELETE FROM feedback_votes WHERE id = ? AND user_id = ?`, [
                            existingVote.id,
                            user.id,
                        ]);
                        if (vote_type === 'up') {
                            await query.run(
                                `UPDATE feedback_submissions SET votes_up = MAX(0, votes_up - 1) WHERE id = ?`,
                                [feedbackId],
                            );
                        } else {
                            await query.run(
                                `UPDATE feedback_submissions SET votes_down = MAX(0, votes_down - 1) WHERE id = ?`,
                                [feedbackId],
                            );
                        }
                        const updated = await query.get(
                            `SELECT votes_up, votes_down FROM feedback_submissions WHERE id = ?`,
                            [feedbackId],
                        );
                        return {
                            voted: false,
                            vote_type: null,
                            votes_up: updated.votes_up,
                            votes_down: updated.votes_down,
                        };
                    } else {
                        // Different vote = switch vote
                        await query.run(`UPDATE feedback_votes SET vote_type = ? WHERE id = ? AND user_id = ?`, [
                            vote_type,
                            existingVote.id,
                            user.id,
                        ]);
                        if (vote_type === 'up') {
                            await query.run(
                                `UPDATE feedback_submissions SET votes_up = votes_up + 1, votes_down = MAX(0, votes_down - 1) WHERE id = ?`,
                                [feedbackId],
                            );
                        } else {
                            await query.run(
                                `UPDATE feedback_submissions SET votes_down = votes_down + 1, votes_up = MAX(0, votes_up - 1) WHERE id = ?`,
                                [feedbackId],
                            );
                        }
                        const updated = await query.get(
                            `SELECT votes_up, votes_down FROM feedback_submissions WHERE id = ?`,
                            [feedbackId],
                        );
                        return { voted: true, vote_type, votes_up: updated.votes_up, votes_down: updated.votes_down };
                    }
                } else {
                    // New vote
                    const voteId = nanoid();
                    await query.run(
                        `INSERT INTO feedback_votes (id, feedback_id, user_id, vote_type) VALUES (?, ?, ?, ?)`,
                        [voteId, feedbackId, user.id, vote_type],
                    );
                    if (vote_type === 'up') {
                        await query.run(`UPDATE feedback_submissions SET votes_up = votes_up + 1 WHERE id = ?`, [
                            feedbackId,
                        ]);
                    } else {
                        await query.run(`UPDATE feedback_submissions SET votes_down = votes_down + 1 WHERE id = ?`, [
                            feedbackId,
                        ]);
                    }
                    const updated = await query.get(
                        `SELECT votes_up, votes_down FROM feedback_submissions WHERE id = ?`,
                        [feedbackId],
                    );
                    return { voted: true, vote_type, votes_up: updated.votes_up, votes_down: updated.votes_down };
                }
            });
            return { status: 200, data: result };
        } catch (error) {
            logger.error('[Feedback] error voting on feedback', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return { status: 500, data: { error: 'Failed to vote' } };
        }
    }

    // POST /api/feedback - Submit new feedback
    if (method === 'POST' && (path === '' || path === '/')) {
        if (!user) {
            return {
                status: 401,
                data: { error: 'Authentication required' },
            };
        }

        const { type, category, title, description, is_anonymous, screenshot_data, screenshot_mime } = body;

        // Validation
        if (!type || !title || !description) {
            return {
                status: 400,
                data: { error: 'Type, title, and description are required' },
            };
        }

        const validTypes = ['feature', 'improvement', 'bug', 'general'];
        if (!validTypes.includes(type)) {
            return {
                status: 400,
                data: { error: 'Invalid feedback type' },
            };
        }

        // Validate screenshot size (~1.5MB decoded = ~2MB base64)
        if (body.screenshot_data && body.screenshot_data.length > 2 * 1024 * 1024) {
            return {
                status: 413,
                data: { error: 'Screenshot too large. Maximum 1.5MB.' },
            };
        }

        if (screenshot_data && screenshot_mime) {
            const validMimes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
            if (!validMimes.includes(screenshot_mime)) {
                return {
                    status: 400,
                    data: { error: 'Invalid screenshot format. Use PNG, JPEG, GIF, or WebP.' },
                };
            }
        }

        try {
            const feedbackId = nanoid();
            await query.run(
                `INSERT INTO feedback_submissions (id, user_id, type, category, title, description, is_anonymous, screenshot_data, screenshot_mime)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    feedbackId,
                    user.id,
                    type,
                    category || null,
                    title,
                    description,
                    is_anonymous ? 1 : 0,
                    screenshot_data || null,
                    screenshot_mime || null,
                ],
            );

            const feedback = await query.get(`SELECT * FROM feedback_submissions WHERE id = ?`, [feedbackId]);

            return {
                status: 201,
                data: { feedback },
            };
        } catch (error) {
            logger.error('[Feedback] error submitting feedback', user?.id, {
                detail: error?.message || 'Unknown error',
            });
            return {
                status: 500,
                data: { error: 'Failed to submit feedback' },
            };
        }
    }

    // PUT /api/feedback/:id - Update feedback status (admin only)
    if (method === 'PUT' && path.startsWith('/') && path.split('/').length === 2) {
        const feedbackId = path.split('/')[1];

        if (!user || !user.is_admin) {
            return {
                status: 403,
                data: { error: 'Admin access required' },
            };
        }

        const { status, admin_response, roadmap_feature_id } = body;

        const validStatuses = ['pending', 'reviewing', 'planned', 'completed', 'declined'];
        if (status && !validStatuses.includes(status)) {
            return {
                status: 400,
                data: { error: 'Invalid status' },
            };
        }

        try {
            const feedback = await query.get(`SELECT * FROM feedback_submissions WHERE id = ?`, [feedbackId]);

            if (!feedback) {
                return {
                    status: 404,
                    data: { error: 'Feedback not found' },
                };
            }

            await query.run(
                `UPDATE feedback_submissions SET status = ?, admin_response = ?, roadmap_feature_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [
                    status || feedback.status,
                    admin_response || feedback.admin_response,
                    roadmap_feature_id !== undefined ? roadmap_feature_id : feedback.roadmap_feature_id,
                    feedbackId,
                ],
            );

            const updatedFeedback = await query.get(`SELECT * FROM feedback_submissions WHERE id = ?`, [feedbackId]);

            return {
                status: 200,
                data: { feedback: updatedFeedback },
            };
        } catch (error) {
            logger.error('[Feedback] error updating feedback', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update feedback' },
            };
        }
    }

    // DELETE /api/feedback/:id - Delete feedback
    if (method === 'DELETE' && path.startsWith('/') && path.split('/').length === 2) {
        const feedbackId = path.split('/')[1];

        if (!user) {
            return {
                status: 401,
                data: { error: 'Authentication required' },
            };
        }

        try {
            const feedback = await query.get(`SELECT * FROM feedback_submissions WHERE id = ?`, [feedbackId]);

            if (!feedback) {
                return {
                    status: 404,
                    data: { error: 'Feedback not found' },
                };
            }

            // Users can only delete their own feedback (unless admin)
            if (!user.is_admin && feedback.user_id !== user.id) {
                return {
                    status: 403,
                    data: { error: 'Access denied' },
                };
            }

            // Admin can delete any feedback; regular users can only delete their own
            if (user.is_admin) {
                await query.run(`DELETE FROM feedback_submissions WHERE id = ?`, [feedbackId]);
            } else {
                await query.run(`DELETE FROM feedback_submissions WHERE id = ? AND user_id = ?`, [feedbackId, user.id]);
            }

            return {
                status: 200,
                data: { message: 'Feedback deleted successfully' },
            };
        } catch (error) {
            logger.error('[Feedback] error deleting feedback', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to delete feedback' },
            };
        }
    }

    // 404
    return {
        status: 404,
        data: { error: 'Endpoint not found' },
    };
}
