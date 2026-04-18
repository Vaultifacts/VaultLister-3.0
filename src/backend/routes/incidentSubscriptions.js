// Incident subscription endpoints (audit #39).
// Public: POST /api/incidents/subscribe, GET /api/incidents/confirm, GET /api/incidents/unsubscribe
// Double-opt-in flow: subscribe → confirm email → receive notifications until unsubscribed.

import crypto from 'crypto';
import { query } from '../db/database.js';
import { sendEmail } from '../services/email.js';
import { logger } from '../shared/logger.js';
import { SUPPORTED_PLATFORM_IDS } from '../../shared/supportedPlatforms.js';

// RFC 5321 local-part + domain, capped at 254 octets in practice
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PLATFORM_IDS = new Set(SUPPORTED_PLATFORM_IDS);

function makeToken() {
    return crypto.randomBytes(24).toString('hex');
}

function publicBaseUrl() {
    return process.env.PUBLIC_BASE_URL || 'https://vaultlister.com';
}

export async function incidentSubscriptionsRouter(ctx) {
    const { method, path, body, query: qp } = ctx;

    // POST /api/incidents/subscribe — create pending subscription, send confirmation email
    if (method === 'POST' && (path === '/subscribe' || path === '/subscribe/')) {
        const email = String((body && body.email) || '').trim().toLowerCase();
        const platformId = body && body.platform_id ? String(body.platform_id) : null;

        if (!EMAIL_RE.test(email) || email.length > 320) {
            return { status: 400, data: { error: 'Valid email required' } };
        }
        if (platformId && !VALID_PLATFORM_IDS.has(platformId)) {
            return { status: 400, data: { error: 'Unknown platform_id' } };
        }

        const confirmToken = makeToken();
        const unsubToken = makeToken();

        try {
            await query.run(
                `INSERT INTO incident_subscriptions (email, confirm_token, unsubscribe_token, platform_id)
                 VALUES (?, ?, ?, ?)`,
                [email, confirmToken, unsubToken, platformId]
            );
        } catch (err) {
            // Unique-index collision means either a pending-unconfirmed row or already-confirmed row exists
            if (String(err.message || '').includes('incident_subscriptions_active')) {
                return { status: 200, data: { message: 'If the email is valid, a confirmation link has been sent' } };
            }
            logger.error(`[IncidentSubs] Subscribe insert failed: ${err.message}`);
            return { status: 500, data: { error: 'Could not create subscription' } };
        }

        const base = publicBaseUrl();
        const confirmUrl = `${base}/api/incidents/confirm?token=${encodeURIComponent(confirmToken)}`;
        const scopeLabel = platformId ? `${platformId} incidents` : 'all platform incidents';
        const html = `<p>Please confirm your subscription to VaultLister status updates (${scopeLabel}).</p>
<p><a href="${confirmUrl}">Confirm subscription</a></p>
<p>If you didn't request this, ignore this email — no subscription will be activated.</p>`;
        const text = `Confirm your subscription to VaultLister status updates (${scopeLabel}): ${confirmUrl}\n\nIf you didn't request this, ignore this email.`;

        try {
            await sendEmail(email, 'Confirm your VaultLister status subscription', html, text);
        } catch (err) {
            logger.error(`[IncidentSubs] Failed to send confirmation to ${email}: ${err.message}`);
            // Don't leak to client whether the email exists
        }

        return { status: 200, data: { message: 'If the email is valid, a confirmation link has been sent' } };
    }

    // GET /api/incidents/confirm?token=... — confirm subscription
    if (method === 'GET' && (path === '/confirm' || path === '/confirm/')) {
        const token = String((qp && qp.token) || '');
        if (!token) return { status: 400, data: { error: 'Missing token' } };

        const sub = await query.get(
            'SELECT id, email FROM incident_subscriptions WHERE confirm_token = ? AND confirmed = FALSE AND unsubscribed_at IS NULL',
            [token]
        );
        if (!sub) return { status: 404, data: { error: 'Invalid or expired token' } };

        await query.run(
            'UPDATE incident_subscriptions SET confirmed = TRUE, confirmed_at = NOW(), confirm_token = NULL WHERE id = ?',
            [sub.id]
        );
        logger.info(`[IncidentSubs] Subscription #${sub.id} confirmed for ${sub.email}`);
        return { status: 200, data: { message: 'Subscription confirmed. You will receive incident notifications.' } };
    }

    // GET /api/incidents/unsubscribe?token=... — one-click unsubscribe
    if (method === 'GET' && (path === '/unsubscribe' || path === '/unsubscribe/')) {
        const token = String((qp && qp.token) || '');
        if (!token) return { status: 400, data: { error: 'Missing token' } };

        const result = await query.run(
            `UPDATE incident_subscriptions SET unsubscribed_at = NOW() WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL`,
            [token]
        );
        if (!result.changes) return { status: 404, data: { error: 'Invalid or already-used token' } };
        return { status: 200, data: { message: 'Unsubscribed. You will no longer receive incident notifications.' } };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Called by adminIncidents after an incident is created or its status changes
export async function notifyIncidentSubscribers(incident, eventType) {
    // eventType: 'created' | 'updated' | 'resolved'
    const scope = incident.platform_id === '_self' ? null : incident.platform_id;
    const subs = await query.all(
        `SELECT id, email, unsubscribe_token
         FROM incident_subscriptions
         WHERE confirmed = TRUE AND unsubscribed_at IS NULL
           AND (platform_id IS NULL OR platform_id = ?)`,
        [scope]
    );
    if (!subs.length) return { sent: 0 };

    const base = publicBaseUrl();
    const subject = eventType === 'resolved'
        ? `[Resolved] ${incident.title}`
        : eventType === 'created'
            ? `[New incident] ${incident.title}`
            : `[Update] ${incident.title}`;

    let sent = 0;
    for (const sub of subs) {
        const unsubUrl = `${base}/api/incidents/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`;
        const statusLine = incident.status ? `Status: <strong>${incident.status}</strong>` : '';
        const html = `<p>${subject}</p>
<p>${statusLine}</p>
<p>See full status at <a href="${base}/status.html">${base}/status.html</a></p>
<hr><p style="font-size:0.8em;color:#666;">To unsubscribe, click <a href="${unsubUrl}">here</a>.</p>`;
        const text = `${subject}\n\nSee full status: ${base}/status.html\n\nUnsubscribe: ${unsubUrl}`;
        try {
            await sendEmail(sub.email, subject, html, text);
            sent++;
        } catch (err) {
            logger.warn(`[IncidentSubs] Failed to notify ${sub.email}: ${err.message}`);
        }
    }
    logger.info(`[IncidentSubs] Notified ${sent}/${subs.length} subscribers about incident #${incident.id} (${eventType})`);
    return { sent };
}
