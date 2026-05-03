// Affiliate Application Route
// Public endpoint — no authentication required

import { query } from '../db/database.js';
import { nanoid } from 'nanoid';
import { logger } from '../shared/logger.js';
import { applyRateLimit } from '../middleware/rateLimiter.js';
import { escapeHtml } from '../shared/utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_EMAIL_DOMAINS = new Set(['browserstack.com', 'example.com', 'test.com', 'mailinator.com', 'guerrillamail.com']);

export async function affiliateApplyRouter(ctx) {
    const { method, path, body, ip } = ctx;

    // POST /api/affiliate-apply — submit affiliate program application
    if (method === 'POST' && (path === '' || path === '/')) {
        const rlError = await applyRateLimit(ctx, 'mutation');
        if (rlError) return rlError;

        // Enforce 3-per-hour cap using DB count
        const now = Date.now();
        const windowMs = 60 * 60 * 1000; // 1 hour
        try {
            const hourAgo = new Date(now - windowMs).toISOString();
            const recent = await query.get(
                `SELECT COUNT(*) AS cnt FROM affiliate_applications WHERE ip = $1 AND created_at > $2`,
                [ip, hourAgo],
            );
            if (recent && Number(recent.cnt) >= 3) {
                return {
                    status: 429,
                    data: { error: 'Too many submissions. Please wait before sending another message.' },
                };
            }
        } catch (err) {
            logger.error('[AffiliateApply] rate-limit check failed', null, { detail: err?.message });
        }

        const { name, email, website, audience_size, promotion_plan } = body || {};

        if (!name || !String(name).trim()) {
            return { status: 400, data: { error: 'Name is required.' } };
        }
        if (!email || !String(email).trim()) {
            return { status: 400, data: { error: 'Email is required.' } };
        }
        if (!EMAIL_RE.test(String(email).trim())) {
            return { status: 400, data: { error: 'Please enter a valid email address.' } };
        }
        const emailDomain = String(email).trim().split('@')[1]?.toLowerCase();
        if (emailDomain && BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
            return { status: 400, data: { error: 'Please enter a valid email address.' } };
        }
        if (!promotion_plan || !String(promotion_plan).trim()) {
            return { status: 400, data: { error: 'Promotion plan is required.' } };
        }

        const safeName = escapeHtml(String(name).trim());
        const safeEmail = escapeHtml(String(email).trim());
        const safeWebsite = website ? escapeHtml(String(website).trim()) : null;
        const safeAudienceSize = audience_size ? escapeHtml(String(audience_size).trim()) : null;
        const safePromotionPlan = escapeHtml(String(promotion_plan).trim());

        // Check for duplicate email
        try {
            const existing = await query.get(`SELECT id FROM affiliate_applications WHERE email = $1`, [safeEmail]);
            if (existing) {
                return {
                    status: 400,
                    data: {
                        error: "An application from this email already exists. We'll be in touch within 2 business days.",
                    },
                };
            }
        } catch (err) {
            logger.error('[AffiliateApply] duplicate-check failed', null, { detail: err?.message });
            return { status: 500, data: { error: 'Failed to submit your application. Please try again.' } };
        }

        try {
            const id = nanoid();
            await query.run(
                `INSERT INTO affiliate_applications (id, name, email, website, audience_size, promotion_plan, ip)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [id, safeName, safeEmail, safeWebsite, safeAudienceSize, safePromotionPlan, ip || null],
            );

            logger.info('[AffiliateApply] application submitted', null, { id, email: safeEmail });

            return {
                status: 200,
                data: { message: "Application submitted! We'll review it within 1\u20132 business days." },
            };
        } catch (err) {
            logger.error('[AffiliateApply] failed to store application', null, { detail: err?.message });
            return { status: 500, data: { error: 'Failed to submit your application. Please try again.' } };
        }
    }

    return { status: 404, data: { error: 'Not found' } };
}
