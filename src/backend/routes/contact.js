// Contact Routes
// Public contact form submission — no authentication required

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { escapeHtml } from '../shared/utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contactRouter(ctx) {
    const { method, path, body, ip } = ctx;

    // POST /api/contact — submit contact form
    if (method === 'POST' && (path === '' || path === '/')) {
        // Rate limit: max 3 submissions per IP per hour (auth tier: 10/15min is too loose;
        // use a dedicated key scoped to this endpoint for tighter control)
        const rlKey = `contact:${ip}`;
        const now = Date.now();
        const windowMs = 60 * 60 * 1000; // 1 hour

        // Simple Redis-free in-process rate limiter keyed on ip via the rateLimiter service.
        // We use the existing 'mutation' tier (30/min) as a first line, then enforce our own
        // 3/hour cap using the database to stay stateless across restarts.
        const rlError = await applyRateLimit(ctx, 'mutation');
        if (rlError) return rlError;

        // Enforce 3-per-hour cap using DB count
        try {
            const hourAgo = new Date(now - windowMs).toISOString();
            const recent = await query.get(
                `SELECT COUNT(*) AS cnt FROM contact_submissions WHERE ip = $1 AND created_at > $2`,
                [ip, hourAgo],
            );
            if (recent && Number(recent.cnt) >= 3) {
                return {
                    status: 429,
                    data: { error: 'Too many submissions. Please wait before sending another message.' },
                };
            }
        } catch (err) {
            logger.error('[Contact] rate-limit check failed', null, { detail: err?.message });
            // Non-fatal — proceed rather than block legitimate users on a DB hiccup
        }

        const { name, email, message } = body || {};

        if (!name || !String(name).trim()) {
            return { status: 400, data: { error: 'Name is required.' } };
        }
        if (!email || !String(email).trim()) {
            return { status: 400, data: { error: 'Email is required.' } };
        }
        if (!EMAIL_RE.test(String(email).trim())) {
            return { status: 400, data: { error: 'Please enter a valid email address.' } };
        }
        if (!message || !String(message).trim()) {
            return { status: 400, data: { error: 'Message is required.' } };
        }

        const safeName = escapeHtml(String(name).trim());
        const safeEmail = escapeHtml(String(email).trim());
        const safeMessage = escapeHtml(String(message).trim());

        try {
            const id = nanoid();
            await query.run(
                `INSERT INTO contact_submissions (id, name, email, message, ip) VALUES ($1, $2, $3, $4, $5)`,
                [id, safeName, safeEmail, safeMessage, ip || null],
            );

            logger.info('[Contact] submission stored', null, { id, email: safeEmail });

            return {
                status: 200,
                data: { message: "Thank you for your message. We'll get back to you soon." },
            };
        } catch (err) {
            logger.error('[Contact] failed to store submission', null, { detail: err?.message });
            return { status: 500, data: { error: 'Failed to submit your message. Please try again.' } };
        }
    }

    return { status: 404, data: { error: 'Not found' } };
}
