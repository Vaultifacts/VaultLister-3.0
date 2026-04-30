// Feature Requests Routes
// Public board: submit feature requests and vote on them (no auth required)

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { escapeHtml } from '../shared/utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeJsonParse(str, fallback) {
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}

function getClientIp(ctx) {
    const forwarded = ctx.headers?.['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return ctx.ip || '0.0.0.0';
}

export async function featureRequestsRouter(ctx) {
    const { method, path, body, query: queryParams } = ctx;
    const ip = getClientIp(ctx);

    // =========================================================
    // GET /api/feature-requests?sort=votes|recent
    // =========================================================
    if (method === 'GET' && (path === '' || path === '/')) {
        const sort = queryParams?.sort === 'recent' ? 'recent' : 'votes';
        const orderBy = sort === 'recent' ? 'fr.created_at DESC' : 'fr.vote_count DESC, fr.created_at DESC';

        try {
            const rows = await query.all(
                `SELECT
                    fr.id,
                    fr.title,
                    fr.description,
                    fr.status,
                    fr.vote_count,
                    fr.created_at,
                    EXISTS (
                        SELECT 1 FROM feature_request_votes frv
                        WHERE frv.feature_request_id = fr.id AND frv.voter_ip = ?
                    ) AS user_voted
                FROM feature_requests fr
                WHERE fr.hidden IS NOT TRUE
                ORDER BY ${orderBy}`,
                [ip],
            );

            const requests = rows.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description,
                status: r.status,
                vote_count: Number(r.vote_count),
                created_at: r.created_at,
                user_voted: Boolean(r.user_voted),
            }));

            return { status: 200, data: { requests } };
        } catch (error) {
            logger.error('[FeatureRequests] GET list failed', null, { detail: error?.message });
            return { status: 500, data: { error: 'Failed to fetch feature requests' } };
        }
    }

    // =========================================================
    // POST /api/feature-requests
    // =========================================================
    if (method === 'POST' && (path === '' || path === '/')) {
        // Burst protection
        const rlError = await applyRateLimit(ctx, 'mutation');
        if (rlError) return rlError;

        // 3 submissions per IP per 24h — enforced at DB level
        try {
            const recent = await query.get(
                `SELECT COUNT(*) AS cnt FROM feature_requests
                 WHERE submitter_ip = ? AND created_at > NOW() - INTERVAL '24 hours'`,
                [ip],
            );
            if (recent && Number(recent.cnt) >= 3) {
                return {
                    status: 429,
                    data: { error: 'Too many submissions. Please wait 24 hours before submitting again.' },
                };
            }
        } catch (err) {
            logger.error('[FeatureRequests] rate-limit DB check failed', null, { detail: err?.message });
            // Non-fatal — proceed rather than block legitimate users on DB hiccup
        }

        const { name, email, title, description } = body || {};

        if (!name || !String(name).trim()) {
            return { status: 400, data: { error: 'Name is required.' } };
        }
        if (!email || !String(email).trim()) {
            return { status: 400, data: { error: 'Email is required.' } };
        }
        if (!EMAIL_RE.test(String(email).trim())) {
            return { status: 400, data: { error: 'Please enter a valid email address.' } };
        }
        if (!title || !String(title).trim()) {
            return { status: 400, data: { error: 'Title is required.' } };
        }
        if (!description || !String(description).trim()) {
            return { status: 400, data: { error: 'Description is required.' } };
        }

        const safeName = escapeHtml(String(name).trim());
        const safeEmail = escapeHtml(String(email).trim());
        const safeTitle = escapeHtml(String(title).trim());
        const safeDescription = escapeHtml(String(description).trim());

        try {
            const id = nanoid();
            await query.run(
                `INSERT INTO feature_requests
                    (id, title, description, submitter_name, submitter_email, submitter_ip, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'under_consideration')`,
                [id, safeTitle, safeDescription, safeName, safeEmail, ip || null],
            );

            logger.info('[FeatureRequests] submission stored', null, { id, email: safeEmail });

            return {
                status: 201,
                data: {
                    id,
                    message: "Thanks! We've received your feature request.",
                },
            };
        } catch (err) {
            logger.error('[FeatureRequests] POST failed', null, { detail: err?.message });
            return { status: 500, data: { error: 'Failed to submit feature request' } };
        }
    }

    // =========================================================
    // POST /api/feature-requests/:id/vote
    // =========================================================
    if (method === 'POST' && path.match(/^\/[^/]+\/vote$/)) {
        const id = path.split('/')[1];

        // Reasonable burst protection on votes too
        const rlError = await applyRateLimit(ctx, 'mutation');
        if (rlError) return rlError;

        try {
            const fr = await query.get(
                `SELECT id, vote_count FROM feature_requests WHERE id = ? AND hidden IS NOT TRUE`,
                [id],
            );
            if (!fr) {
                return { status: 404, data: { error: 'Feature request not found' } };
            }

            // Insert vote — UNIQUE(feature_request_id, voter_ip) enforces one-per-IP atomically
            const voteId = nanoid();
            try {
                await query.run(
                    `INSERT INTO feature_request_votes (id, feature_request_id, voter_ip) VALUES (?, ?, ?)`,
                    [voteId, id, ip],
                );
            } catch (insertErr) {
                // PostgreSQL unique violation code 23505
                const code = insertErr?.code || insertErr?.cause?.code || '';
                if (String(code) === '23505' || String(insertErr?.message).includes('unique constraint')) {
                    return { status: 409, data: { error: 'You have already voted for this feature request.' } };
                }
                throw insertErr;
            }

            // Atomically increment vote_count
            const updated = await query.get(
                `UPDATE feature_requests SET vote_count = vote_count + 1 WHERE id = ? RETURNING vote_count`,
                [id],
            );

            return {
                status: 200,
                data: {
                    vote_count: Number(updated?.vote_count ?? fr.vote_count + 1),
                    voted: true,
                },
            };
        } catch (err) {
            logger.error('[FeatureRequests] vote failed', null, { detail: err?.message });
            return { status: 500, data: { error: 'Failed to record vote' } };
        }
    }

    return { status: 404, data: { error: 'Endpoint not found' } };
}
