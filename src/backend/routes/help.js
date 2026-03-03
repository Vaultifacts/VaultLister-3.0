// Help & Support Routes
// Video tutorials, FAQ, knowledge base, support tickets

import crypto from 'crypto';
import { query, escapeLike } from '../db/database.js';
import { logger } from '../shared/logger.js';

const ALLOWED_TICKET_FIELDS = new Set(['status', 'priority']);
// TECH-DEBT: Migrate error responses to AppError classes (errorHandler.js)

/**
 * Help router
 */
export async function helpRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // ============================================
    // VIDEO TUTORIALS
    // ============================================

    // GET /api/help/videos - List all videos
    if (method === 'GET' && path === '/videos') {
        const { category } = queryParams;

        try {
            let sql = `SELECT * FROM help_videos WHERE 1=1`;
            const params = [];

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            sql += ` ORDER BY position ASC, created_at DESC LIMIT 200`;

            const videos = query.all(sql, params);

            return {
                status: 200,
                data: { videos }
            };
        } catch (error) {
            logger.error('[Help] error fetching videos', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch videos' }
            };
        }
    }

    // GET /api/help/videos/:id - Get single video
    if (method === 'GET' && path.startsWith('/videos/') && path.split('/').length === 3) {
        const videoId = path.split('/')[2];

        try {
            const video = query.get(`SELECT * FROM help_videos WHERE id = ?`, [videoId]);

            if (!video) {
                return {
                    status: 404,
                    data: { error: 'Video not found' }
                };
            }

            return {
                status: 200,
                data: { video }
            };
        } catch (error) {
            logger.error('[Help] error fetching video', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch video' }
            };
        }
    }

    // ============================================
    // FAQ
    // ============================================

    // GET /api/help/faq - List all FAQ items
    if (method === 'GET' && path === '/faq') {
        const { category, search } = queryParams;

        try {
            let sql = `SELECT * FROM help_faq WHERE 1=1`;
            const params = [];

            if (category) {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (search) {
                sql += ` AND (question LIKE ? ESCAPE '\\' OR answer LIKE ? ESCAPE '\\')`;
                params.push(`%${escapeLike(search)}%`, `%${escapeLike(search)}%`);
            }

            sql += ` ORDER BY position ASC, helpful_count DESC LIMIT 200`;

            const faqs = query.all(sql, params);

            return {
                status: 200,
                data: { faqs }
            };
        } catch (error) {
            logger.error('[Help] error fetching FAQs', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch FAQs' }
            };
        }
    }

    // GET /api/help/faq/:id - Get single FAQ
    if (method === 'GET' && path.startsWith('/faq/') && path.split('/').length === 3) {
        const faqId = path.split('/')[2];

        try {
            const faq = query.get(`SELECT * FROM help_faq WHERE id = ?`, [faqId]);

            if (!faq) {
                return {
                    status: 404,
                    data: { error: 'FAQ not found' }
                };
            }

            return {
                status: 200,
                data: { faq }
            };
        } catch (error) {
            logger.error('[Help] error fetching FAQ', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch FAQ' }
            };
        }
    }

    // POST /api/help/faq/:id/helpful - Mark FAQ as helpful/not helpful
    if (method === 'POST' && path.match(/^\/faq\/[^\/]+\/helpful$/)) {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }

        const faqId = path.split('/')[2];
        const { helpful } = body;

        if (typeof helpful !== 'boolean') {
            return {
                status: 400,
                data: { error: 'helpful must be true or false' }
            };
        }

        try {
            // Check if FAQ exists
            const faq = query.get(`SELECT id FROM help_faq WHERE id = ?`, [faqId]);

            if (!faq) {
                return {
                    status: 404,
                    data: { error: 'FAQ not found' }
                };
            }

            // Check if already voted
            const existing = query.get(
                `SELECT * FROM help_faq_votes WHERE faq_id = ? AND user_id = ?`,
                [faqId, user.id]
            );

            if (existing) {
                return {
                    status: 400,
                    data: { error: 'You have already voted on this FAQ' }
                };
            }

            // Record vote
            const voteId = `vote_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            query.run(
                `INSERT INTO help_faq_votes (id, faq_id, user_id, is_helpful, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [voteId, faqId, user.id, helpful ? 1 : 0]
            );

            // Update counts
            if (helpful) {
                query.run(`UPDATE help_faq SET helpful_count = helpful_count + 1 WHERE id = ?`, [faqId]);
            } else {
                query.run(`UPDATE help_faq SET not_helpful_count = not_helpful_count + 1 WHERE id = ?`, [faqId]);
            }

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Help] error voting on FAQ', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to record vote' }
            };
        }
    }

    // ============================================
    // KNOWLEDGE BASE ARTICLES
    // ============================================

    // GET /api/help/articles - List articles
    if (method === 'GET' && path === '/articles') {
        const { category, search, limit = 20 } = queryParams;

        try {
            let sql, params;

            if (search) {
                // Limit search length to prevent CPU exhaustion
                if (search.length > 500) {
                    return { status: 400, data: { error: 'Search query too long (max 500 characters)' } };
                }

                // FTS search
                sql = `
                    SELECT a.* FROM help_articles a
                    JOIN help_articles_fts fts ON a.rowid = fts.rowid
                    WHERE help_articles_fts MATCH ?
                    AND a.is_published = 1
                    ORDER BY a.view_count DESC
                    LIMIT ?
                `;
                // Sanitize: strip quotes, operators, special chars
                params = [search.replace(/['"*(){}[\]^~\\]/g, '').replace(/\b(AND|OR|NOT|NEAR)\b/gi, ''), parseInt(limit)];
            } else {
                sql = `SELECT * FROM help_articles WHERE is_published = 1`;
                params = [];

                if (category) {
                    sql += ` AND category = ?`;
                    params.push(category);
                }

                sql += ` ORDER BY view_count DESC, created_at DESC LIMIT ?`;
                params.push(parseInt(limit));
            }

            const articles = query.all(sql, params);

            // Parse tags
            articles.forEach(article => {
                try {
                    article.tags = JSON.parse(article.tags || '[]');
                } catch (e) {
                    article.tags = [];
                }
            });

            return {
                status: 200,
                data: { articles }
            };
        } catch (error) {
            logger.error('[Help] error fetching articles', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch articles' }
            };
        }
    }

    // GET /api/help/articles/:slug - Get single article by slug
    if (method === 'GET' && path.startsWith('/articles/') && path.split('/').length === 3) {
        const slug = path.split('/')[2];

        try {
            const article = query.get(`SELECT * FROM help_articles WHERE slug = ? AND is_published = 1`, [slug]);

            if (!article) {
                return {
                    status: 404,
                    data: { error: 'Article not found' }
                };
            }

            // Parse tags
            try {
                article.tags = JSON.parse(article.tags || '[]');
            } catch (e) {
                article.tags = [];
            }

            return {
                status: 200,
                data: { article }
            };
        } catch (error) {
            logger.error('[Help] error fetching article', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch article' }
            };
        }
    }

    // POST /api/help/articles/:id/helpful - Vote on article
    if (method === 'POST' && path.match(/^\/articles\/[^\/]+\/helpful$/)) {
        const articleId = path.split('/')[2];
        const { helpful } = body;

        if (typeof helpful !== 'boolean') {
            return {
                status: 400,
                data: { error: 'helpful must be true or false' }
            };
        }

        try {
            // Check if article exists
            const article = query.get(`SELECT id FROM help_articles WHERE id = ?`, [articleId]);

            if (!article) {
                return {
                    status: 404,
                    data: { error: 'Article not found' }
                };
            }

            // Check if already voted
            const existing = query.get(
                `SELECT * FROM help_article_votes WHERE article_id = ? AND user_id = ?`,
                [articleId, user.id]
            );

            if (existing) {
                return {
                    status: 400,
                    data: { error: 'You have already voted on this article' }
                };
            }

            // Record vote
            const voteId = `vote_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
            query.run(
                `INSERT INTO help_article_votes (id, article_id, user_id, is_helpful, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [voteId, articleId, user.id, helpful ? 1 : 0]
            );

            // Update counts
            if (helpful) {
                query.run(`UPDATE help_articles SET helpful_count = helpful_count + 1 WHERE id = ?`, [articleId]);
            }

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Help] error voting on article', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to record vote' }
            };
        }
    }

    // ============================================
    // SUPPORT TICKETS
    // ============================================

    // POST /api/help/tickets - Create support ticket
    if (method === 'POST' && path === '/tickets') {
        const { type, subject, description, screenshots, page_context, browser_info } = body;

        if (!type || !subject || !description) {
            return {
                status: 400,
                data: { error: 'type, subject, and description are required' }
            };
        }

        if (!['contact', 'bug', 'feature_request'].includes(type)) {
            return {
                status: 400,
                data: { error: 'type must be contact, bug, or feature_request' }
            };
        }

        try {
            const ticketId = `ticket_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            query.run(
                `INSERT INTO support_tickets (id, user_id, type, subject, description, screenshots, page_context, browser_info, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [
                    ticketId,
                    user.id,
                    type,
                    subject,
                    description,
                    screenshots ? JSON.stringify(screenshots) : '[]',
                    page_context || null,
                    browser_info || null
                ]
            );

            const ticket = query.get(`SELECT * FROM support_tickets WHERE id = ?`, [ticketId]);

            return {
                status: 201,
                data: { success: true, ticket }
            };
        } catch (error) {
            logger.error('[Help] error creating ticket', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to create ticket' }
            };
        }
    }

    // GET /api/help/tickets - List user's tickets
    if (method === 'GET' && path === '/tickets') {
        const { status } = queryParams;

        try {
            let sql = `SELECT * FROM support_tickets WHERE user_id = ?`;
            const params = [user.id];

            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY created_at DESC`;

            const tickets = query.all(sql, params);

            // Parse JSON fields
            tickets.forEach(ticket => {
                try {
                    ticket.screenshots = JSON.parse(ticket.screenshots || '[]');
                } catch (e) {
                    ticket.screenshots = [];
                }
            });

            return {
                status: 200,
                data: { tickets }
            };
        } catch (error) {
            logger.error('[Help] error fetching tickets', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch tickets' }
            };
        }
    }

    // GET /api/help/tickets/:id - Get ticket with replies
    if (method === 'GET' && path.startsWith('/tickets/') && path.split('/').length === 3) {
        const ticketId = path.split('/')[2];

        try {
            const ticket = query.get(
                `SELECT * FROM support_tickets WHERE id = ? AND user_id = ?`,
                [ticketId, user.id]
            );

            if (!ticket) {
                return {
                    status: 404,
                    data: { error: 'Ticket not found' }
                };
            }

            // Parse screenshots
            try {
                ticket.screenshots = JSON.parse(ticket.screenshots || '[]');
            } catch (e) {
                ticket.screenshots = [];
            }

            // Get replies
            const replies = query.all(
                `SELECT r.*, u.email as user_email
                 FROM support_ticket_replies r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.ticket_id = ?
                 ORDER BY r.created_at ASC`,
                [ticketId]
            );

            return {
                status: 200,
                data: { ticket, replies }
            };
        } catch (error) {
            logger.error('[Help] error fetching ticket', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to fetch ticket' }
            };
        }
    }

    // POST /api/help/tickets/:id/replies - Add reply to ticket
    if (method === 'POST' && path.endsWith('/replies')) {
        const ticketId = path.split('/')[2];
        const { message } = body;

        if (!message || !message.trim()) {
            return {
                status: 400,
                data: { error: 'message is required' }
            };
        }

        try {
            // Verify ticket ownership
            const ticket = query.get(
                `SELECT id FROM support_tickets WHERE id = ? AND user_id = ?`,
                [ticketId, user.id]
            );

            if (!ticket) {
                return {
                    status: 404,
                    data: { error: 'Ticket not found' }
                };
            }

            const replyId = `reply_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;

            query.run(
                `INSERT INTO support_ticket_replies (id, ticket_id, user_id, message, is_staff_reply, created_at)
                 VALUES (?, ?, ?, ?, 0, datetime('now'))`,
                [replyId, ticketId, user.id, message]
            );

            // Update ticket timestamp
            query.run(
                `UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?`,
                [ticketId]
            );

            const reply = query.get(
                `SELECT r.*, u.email as user_email
                 FROM support_ticket_replies r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.id = ?`,
                [replyId]
            );

            return {
                status: 201,
                data: { success: true, reply }
            };
        } catch (error) {
            logger.error('[Help] error adding reply', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to add reply' }
            };
        }
    }

    // PATCH /api/help/tickets/:id - Update ticket status
    if (method === 'PATCH' && path.startsWith('/tickets/') && path.split('/').length === 3) {
        const ticketId = path.split('/')[2];
        const { status: newStatus, priority } = body;

        try {
            // Verify ticket ownership
            const ticket = query.get(
                `SELECT id FROM support_tickets WHERE id = ? AND user_id = ?`,
                [ticketId, user.id]
            );

            if (!ticket) {
                return {
                    status: 404,
                    data: { error: 'Ticket not found' }
                };
            }

            const updates = [];
            const params = [];

            if (newStatus && ['open', 'in_progress', 'resolved', 'closed'].includes(newStatus)) {
                updates.push('status = ?');
                params.push(newStatus);

                if (newStatus === 'resolved' || newStatus === 'closed') {
                    updates.push('resolved_at = datetime("now")');
                }
            }

            if (priority && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
                updates.push('priority = ?');
                params.push(priority);
            }

            if (updates.length === 0) {
                return {
                    status: 400,
                    data: { error: 'No valid updates provided' }
                };
            }

            updates.push('updated_at = datetime("now")');
            params.push(ticketId);

            query.run(
                `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            const updatedTicket = query.get(`SELECT * FROM support_tickets WHERE id = ?`, [ticketId]);
            try {
                updatedTicket.screenshots = JSON.parse(updatedTicket.screenshots || '[]');
            } catch (e) {
                updatedTicket.screenshots = [];
            }

            return {
                status: 200,
                data: { success: true, ticket: updatedTicket }
            };
        } catch (error) {
            logger.error('[Help] error updating ticket', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to update ticket' }
            };
        }
    }

    // GET /api/help/search - Search all help content
    if (method === 'GET' && path === '/search') {
        const { q: searchQuery } = queryParams;

        if (!searchQuery || searchQuery.trim().length < 2) {
            return {
                status: 400,
                data: { error: 'Search query must be at least 2 characters' }
            };
        }

        try {
            // Limit search length
            if (searchQuery.length > 500) {
                return { status: 400, data: { error: 'Search query too long (max 500 characters)' } };
            }

            // Sanitize and wrap query for FTS5 (handle hyphens, operators, special chars)
            const query_safe = searchQuery.replace(/['"*(){}[\]^~\\]/g, '').replace(/-/g, ' ').replace(/\b(AND|OR|NOT|NEAR)\b/gi, '');

            // Search articles using FTS (wrap in quotes to treat as phrase)
            const articles = query.all(
                `SELECT a.id, a.title, a.slug, a.category, a.tags
                 FROM help_articles a
                 JOIN help_articles_fts fts ON a.rowid = fts.rowid
                 WHERE help_articles_fts MATCH '"' || ? || '"' AND a.is_published = 1
                 LIMIT 10`,
                [query_safe]
            );

            // Search FAQs
            const escapedSearch = escapeLike(searchQuery);
            const faqs = query.all(
                `SELECT id, question, answer, category
                 FROM help_faq
                 WHERE question LIKE ? ESCAPE '\\' OR answer LIKE ? ESCAPE '\\'
                 LIMIT 10`,
                [`%${escapedSearch}%`, `%${escapedSearch}%`]
            );

            // Search videos
            const videos = query.all(
                `SELECT id, title, description, category, video_url
                 FROM help_videos
                 WHERE title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
                 LIMIT 5`,
                [`%${escapedSearch}%`, `%${escapedSearch}%`]
            );

            // Parse tags for articles
            articles.forEach(article => {
                try {
                    article.tags = JSON.parse(article.tags || '[]');
                } catch (e) {
                    article.tags = [];
                }
            });

            return {
                status: 200,
                data: {
                    results: {
                        articles,
                        faqs,
                        videos
                    },
                    total: articles.length + faqs.length + videos.length
                }
            };
        } catch (error) {
            logger.error('[Help] error searching help content', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Search failed' }
            };
        }
    }

    // POST /api/help/videos/:id/view - Increment video view count
    if (method === 'POST' && path.match(/^\/videos\/[^\/]+\/view$/)) {
        const videoId = path.split('/')[2];

        try {
            const video = query.get(`SELECT id FROM help_videos WHERE id = ?`, [videoId]);

            if (!video) {
                return {
                    status: 404,
                    data: { error: 'Video not found' }
                };
            }

            query.run(`UPDATE help_videos SET view_count = view_count + 1 WHERE id = ?`, [videoId]);

            return {
                status: 200,
                data: { success: true }
            };
        } catch (error) {
            logger.error('[Help] error incrementing view count', user?.id, { detail: error?.message || 'Unknown error' });
            return {
                status: 500,
                data: { error: 'Failed to increment view count' }
            };
        }
    }

    return {
        status: 404,
        data: { error: 'Not found' }
    };
}
