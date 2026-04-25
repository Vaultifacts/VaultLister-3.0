// Webhooks Router for VaultLister
// Manages webhook endpoints and processes incoming webhooks

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { processWebhookEvent, verifySignature } from '../services/webhookProcessor.js';
import { logger } from '../shared/logger.js';
import { constructWebhookEvent, TIER_FOR_PRICE } from '../services/stripeService.js';
import { safeJsonParse } from '../shared/utils.js';
import { syncShop } from '../services/platformSync/index.js';

// GA4 Measurement Protocol — fire server-side purchase events for renewals
async function ga4ServerEvent(clientId, eventName, params) {
    const secret = process.env.GA_MEASUREMENT_PROTOCOL_SECRET;
    if (!secret) return;
    try {
        await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-LXETN4PYRM&api_secret=${secret}`, {
            method: 'POST',
            body: JSON.stringify({
                client_id: clientId || 'server_' + Date.now(),
                events: [{ name: eventName, params }]
            })
        });
    } catch (err) {
        logger.warn('[GA4 MP] Failed to send event', { eventName, error: err.message });
    }
}

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */

// Helper: Block internal network addresses to prevent SSRF
function isInternalUrl(urlString) {
    try {
        const url = new URL(urlString);
        const hostname = url.hostname.toLowerCase();
        // Block localhost
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return true;
        // Block private IP ranges
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) return true;
        // Block link-local IPv6
        if (hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) return true;
        // Must be HTTPS in production
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return true;
        return false;
    } catch {
        return true;
    }
}

export async function webhooksRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Helper: require authentication
    const requireAuth = () => {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        return null;
    };

    // ===== PUBLIC: Stripe Webhook =====
    // POST /webhooks/stripe — handles Stripe billing events
    if (method === 'POST' && path === '/stripe') {
        const sig = ctx.headers?.['stripe-signature'];
        if (!sig) {
            logger.warn('[Webhooks/Stripe] Missing stripe-signature header');
            return { status: 400, data: { error: 'Missing stripe-signature header' } };
        }

        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            logger.error('[Webhooks/Stripe] STRIPE_WEBHOOK_SECRET not set in .env');
            return { status: 500, data: { error: 'Stripe webhook not configured' } };
        }

        let event;
        try {
            logger.info('[Webhooks/Stripe] Verifying signature', null, { rawBodyLength: (ctx.rawBody || '').length, sigLength: sig.length });
            event = constructWebhookEvent(ctx.rawBody || '', sig);
        } catch (err) {
            logger.warn('[Webhooks/Stripe] Signature verification failed', null, { detail: err?.message || String(err), rawBodyLength: (ctx.rawBody || '').length });
            return { status: 400, data: { error: `Webhook signature verification failed: ${err.message}` } };
        }

        // Idempotency check — prevent double-processing on Stripe retry
        try {
            const existing = await query.get('SELECT id FROM webhook_events WHERE id = ?', [event.id]);
            if (existing) {
                logger.info(`[Webhooks/Stripe] Duplicate event ${event.id} — skipping (already processed)`);
                return { status: 200, data: { received: true } };
            }
        } catch {
            // webhook_events table may not exist yet — proceed with processing
        }

        try {
            const STRIPE_SYSTEM_USER = '00000000-0000-0000-0000-000000000001';

            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    const vaultUserId = session.metadata?.vaultlister_user_id;
                    if (vaultUserId && session.subscription) {
                        // Determine tier from the subscription's price
                        const subObj = session.subscription;
                        // We only have the subscription ID here; price lookup happens on subscription.updated
                        // For now, mark as starter (lowest paid) — subscription.updated fires immediately after and sets the real tier
                        await query.run(
                            'UPDATE users SET stripe_subscription_id = ?, updated_at = NOW() WHERE id = ?',
                            [subObj, vaultUserId]
                        );
                        logger.info(`[Webhooks/Stripe] checkout.session.completed: user ${vaultUserId} subscription ${subObj}`);
                        // GA4 server-side purchase event
                        const gaClientId = await query.get('SELECT ga_client_id FROM users WHERE id = ?', [vaultUserId]);
                        ga4ServerEvent(gaClientId?.ga_client_id, 'purchase', {
                            transaction_id: session.id,
                            value: (session.amount_total || 0) / 100,
                            currency: (session.currency || 'cad').toUpperCase(),
                            items: [{ item_name: 'subscription' }]
                        });
                    }
                    break;
                }

                case 'invoice.paid': {
                    const invoice = event.data.object;
                    if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
                        const customerId = invoice.customer;
                        const dbUser = await query.get('SELECT id, ga_client_id FROM users WHERE stripe_customer_id = ?', [customerId]);
                        if (dbUser) {
                            ga4ServerEvent(dbUser.ga_client_id, 'purchase', {
                                transaction_id: invoice.id,
                                value: (invoice.amount_paid || 0) / 100,
                                currency: (invoice.currency || 'cad').toUpperCase(),
                                items: [{ item_name: dbUser.subscription_tier || 'subscription', item_category: 'renewal' }]
                            });
                            logger.info(`[Webhooks/Stripe] invoice.paid (renewal): user ${dbUser.id} amount ${invoice.amount_paid}`);
                        }
                    }
                    break;
                }

                case 'customer.subscription.updated': {
                    const sub = event.data.object;
                    const priceId = sub.items?.data?.[0]?.price?.id;
                    const tier = TIER_FOR_PRICE[priceId] || null;
                    if (tier && sub.customer) {
                        const dbUser = await query.get('SELECT id FROM users WHERE stripe_customer_id = ?', [sub.customer]);
                        if (dbUser) {
                            await query.run(
                                'UPDATE users SET subscription_tier = ?, stripe_subscription_id = ?, updated_at = NOW() WHERE id = ?',
                                [tier, sub.id, dbUser.id]
                            );
                            logger.info(`[Webhooks/Stripe] subscription.updated: user ${dbUser.id} → tier ${tier}`);
                        }
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const sub = event.data.object;
                    if (sub.customer) {
                        const dbUser = await query.get('SELECT id FROM users WHERE stripe_customer_id = ?', [sub.customer]);
                        if (dbUser) {
                            await query.run(
                                'UPDATE users SET subscription_tier = \'free\', stripe_subscription_id = NULL, subscription_expires_at = NULL, updated_at = NOW() WHERE id = ?',
                                [dbUser.id]
                            );
                            logger.info(`[Webhooks/Stripe] subscription.deleted: user ${dbUser.id} downgraded to free`);
                        }
                    }
                    break;
                }

                case 'invoice.payment_failed': {
                    const invoice = event.data.object;
                    if (invoice.customer) {
                        const dbUser = await query.get('SELECT id FROM users WHERE stripe_customer_id = ?', [invoice.customer]);
                        if (dbUser) {
                            // Insert notification for the user
                            try {
                                await query.run(
                                    'INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at) VALUES (?, ?, \'billing\', \'Payment Failed\', \'Your subscription payment failed. Please update your payment method to keep your plan active.\', 0, NOW())',
                                    [uuidv4(), dbUser.id]
                                );
                            } catch {
                                // notifications table schema may vary — log and continue
                            }
                            logger.warn(`[Webhooks/Stripe] invoice.payment_failed: user ${dbUser.id}`);
                        }
                    }
                    break;
                }

                default:
                    logger.info(`[Webhooks/Stripe] Unhandled event type: ${event.type}`);
            }

            // Store event for audit trail — use event.id as row ID for idempotency
            try {
                await query.run(
                    'INSERT INTO webhook_events (id, user_id, source, event_type, payload, status, created_at) VALUES (?, ?, \'stripe\', ?, ?, \'processed\', NOW())',
                    [event.id, STRIPE_SYSTEM_USER, event.type, JSON.stringify(event.data.object)]
                );
            } catch {
                // Don't fail the Stripe response if audit insert fails
            }

            return { status: 200, data: { received: true } };

        } catch (error) {
            logger.error('[Webhooks/Stripe] Error processing event', null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to process Stripe event' } };
        }
    }

    // ===== PUBLIC: eBay Marketplace Account Deletion =====
    // Required by eBay Developer Program compliance for production keysets.
    // Spec: https://developer.ebay.com/marketplace-account-deletion

    // GET /webhooks/ebay/account-deletion — challenge verification
    if (method === 'GET' && path === '/ebay/account-deletion') {
        const challengeCode = queryParams?.challenge_code;
        if (!challengeCode) {
            return { status: 400, data: { error: 'Missing challenge_code' } };
        }

        const verificationToken = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
        const endpoint = process.env.EBAY_DELETION_ENDPOINT;

        if (!verificationToken || !endpoint) {
            logger.error('[Webhooks/eBay] EBAY_DELETION_VERIFICATION_TOKEN or EBAY_DELETION_ENDPOINT not set in .env');
            return { status: 500, data: { error: 'Webhook not configured' } };
        }

        // eBay spec: SHA-256(challengeCode + verificationToken + endpoint)
        const hash = crypto.createHash('sha256')
            .update(challengeCode + verificationToken + endpoint)
            .digest('hex');

        logger.info('[Webhooks/eBay] Challenge verification successful');
        return { status: 200, data: { challengeResponse: hash } };
    }

    // POST /webhooks/ebay/account-deletion — deletion notification
    if (method === 'POST' && path === '/ebay/account-deletion') {
        const ebayVerifyToken = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
        if (!ebayVerifyToken) {
            logger.error('[Webhooks/eBay] EBAY_DELETION_VERIFICATION_TOKEN not set — cannot verify deletion notification');
            return { status: 500, data: { error: 'Webhook not configured' } };
        }
        const ebaySignature = ctx.headers?.['x-ebay-signature'] || null;
        if (!ebaySignature || !verifySignature(ctx.rawBody || '', ebaySignature, ebayVerifyToken)) {
            logger.warn('[Webhooks/eBay] Invalid or missing signature on deletion notification');
            return { status: 401, data: { error: 'Invalid webhook signature' } };
        }

        try {
            // Log raw event for compliance audit trail
            const payload = body || {};
            const ebayUserId = payload.data?.userId || payload.userId || null;
            const username = payload.data?.username || payload.username || null;

            logger.info('[Webhooks/eBay] Account deletion notification received', null, {
                ebayUserId,
                username,
                notificationId: payload.notificationId || null
            });

            // Store in webhook_events for audit — use a sentinel user_id for eBay system events
            const EBAY_SYSTEM_USER = '00000000-0000-0000-0000-000000000000';
            try {
                await query.run(`
                    INSERT INTO webhook_events (id, user_id, source, event_type, payload, status, created_at)
                    VALUES (?, ?, 'ebay', 'marketplace.account.deletion', ?, 'processed', NOW())
                `, [uuidv4(), EBAY_SYSTEM_USER, JSON.stringify(payload)]);
            } catch (dbErr) {
                // Don't fail the response — eBay requires 200 even if we have internal issues
                logger.error('[Webhooks/eBay] Failed to store deletion event', null, { detail: dbErr.message });
            }

            // If an eBay user is linked to a VaultLister account, revoke their OAuth token
            if (ebayUserId) {
                try {
                    await query.run(`
                        UPDATE oauth_tokens
                        SET access_token = NULL, refresh_token = NULL, revoked_at = NOW()
                        WHERE platform = 'ebay' AND platform_user_id = ?
                    `, [String(ebayUserId)]);
                } catch (revokeErr) {
                    logger.warn('[Webhooks/eBay] Could not revoke OAuth token for deleted user', null, { ebayUserId });
                }
            }

            // eBay requires an empty 200 response
            return { status: 200, data: {} };

        } catch (error) {
            logger.error('[Webhooks/eBay] Error processing deletion notification', null, { detail: error.message });
            // Still return 200 — eBay will retry on non-200; we don't want infinite retries for parse errors
            return { status: 200, data: {} };
        }
    }

    // ===== PUBLIC: Incoming webhook handler =====
    // POST /webhooks/incoming/:source
    const incomingMatch = path.match(/^\/incoming\/([^/]+)$/);
    if (method === 'POST' && incomingMatch) {
        const source = incomingMatch[1];

        try {
            // Extract signature from headers
            const signature = ctx.headers?.['x-signature'] || ctx.headers?.['x-hub-signature'] || ctx.headers?.['x-vaultlister-signature'] || null;

            // Look up webhook configuration for this source (most recent if duplicates)
            const webhookConfig = await query.get(`
                SELECT secret, user_id FROM webhook_endpoints
                WHERE name = ? AND is_enabled = TRUE
                ORDER BY rowid DESC
                LIMIT 1
            `, [source]);

            // Reject unregistered sources
            if (!webhookConfig) {
                logger.warn(`[Webhooks] Unknown webhook source: ${source}`);
                return { status: 404, data: { error: 'Webhook source not registered' } };
            }

            // All registered endpoints must have a secret — reject misconfigured ones
            if (!webhookConfig.secret) {
                logger.error(`[Webhooks] Endpoint for source "${source}" has no secret configured`);
                return { status: 403, data: { error: 'Webhook endpoint misconfigured — no secret' } };
            }

            // Verify the HMAC signature
            if (!signature) {
                logger.warn(`[Webhooks] Missing signature for source: ${source}`);
                return { status: 401, data: { error: 'Missing webhook signature' } };
            }
            const isValid = verifySignature(body, signature, webhookConfig.secret);
            if (!isValid) {
                logger.warn(`[Webhooks] Invalid signature for source: ${source}`);
                return { status: 401, data: { error: 'Invalid webhook signature' } };
            }

            // Create webhook event record
            const eventId = uuidv4();
            const eventType = body.type || body.event_type || 'unknown';

            await query.run(`
                INSERT INTO webhook_events (id, user_id, source, event_type, payload, signature, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
            `, [eventId, webhookConfig.user_id, source, eventType, JSON.stringify(body), signature]);

            // Queue for async processing
            try {
                await query.run(`
                    INSERT INTO tasks (id, type, payload, status, priority, created_at)
                    VALUES (?, 'process_webhook', ?, 'pending', 5, NOW())
                `, [uuidv4(), JSON.stringify({ eventId })]);
            } catch (err) {
                // Fallback: process synchronously
                const event = await query.get('SELECT * FROM webhook_events WHERE id = ?', [eventId]);
                if (event) {
                    await processWebhookEvent(event);
                }
            }

            return {
                status: 200,
                data: { received: true, event_id: eventId }
            };

        } catch (error) {
            logger.error('[Webhooks] Error processing incoming webhook', null, { detail: error?.message || 'Unknown error' });
            return { status: 500, data: { error: 'Failed to process webhook' } };
        }
    }

    // ===== PROTECTED ROUTES =====

    // GET /webhooks/endpoints - List user's webhook endpoints
    if (method === 'GET' && path === '/endpoints') {
        const authError = requireAuth();
        if (authError) return authError;

        const endpoints = await query.all(`
            SELECT id, name, url, events, is_enabled, last_triggered_at,
                   failure_count, created_at, updated_at
            FROM webhook_endpoints
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [user.id]);

        // Parse events JSON
        const parsed = endpoints.map(ep => ({
            ...ep,
            events: safeJsonParse(ep.events, [])
        }));

        return { status: 200, data: parsed };
    }

    // POST /webhooks/endpoints - Create webhook endpoint
    if (method === 'POST' && path === '/endpoints') {
        const authError = requireAuth();
        if (authError) return authError;

        const { name, url, events = [] } = body;

        if (!name || !url) {
            return { status: 400, data: { error: 'Name and URL are required' } };
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return { status: 400, data: { error: 'Invalid URL format' } };
        }

        // Block internal URLs to prevent SSRF
        if (isInternalUrl(url)) {
            return { status: 400, data: { error: 'Webhook URL must be a public HTTPS endpoint' } };
        }

        // Check for existing endpoint with same name for this user
        const existingEndpoint = await query.get(
            'SELECT id FROM webhook_endpoints WHERE user_id = ? AND name = ? AND is_enabled = TRUE',
            [user.id, name]
        );

        // Generate secret for HMAC signing
        const secret = `whsec_${uuidv4().replace(/-/g, '')}`;
        let endpointId;

        if (existingEndpoint) {
            // Update existing endpoint (rotate secret, update URL/events)
            endpointId = existingEndpoint.id;
            await query.run(`
                UPDATE webhook_endpoints SET url = ?, secret = ?, events = ?, updated_at = NOW()
                WHERE id = ? AND user_id = ?
            `, [url, secret, JSON.stringify(events), endpointId, user.id]);
        } else {
            endpointId = uuidv4();
            await query.run(`
                INSERT INTO webhook_endpoints (id, user_id, name, url, secret, events, is_enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
            `, [endpointId, user.id, name, url, secret, JSON.stringify(events)]);
        }

        const endpoint = await query.get('SELECT * FROM webhook_endpoints WHERE id = ?', [endpointId]);

        return {
            status: 201,
            data: {
                ...endpoint,
                events: safeJsonParse(endpoint.events, []),
                secret // Only return secret on creation
            }
        };
    }

    // GET /webhooks/endpoints/:id - Get endpoint details
    const endpointIdMatch = path.match(/^\/endpoints\/([^/]+)$/);
    if (method === 'GET' && endpointIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const endpointId = endpointIdMatch[1];
        const endpoint = await query.get(`
            SELECT * FROM webhook_endpoints WHERE id = ? AND user_id = ?
        `, [endpointId, user.id]);

        if (!endpoint) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }

        // Strip secret from response — never expose webhook secret via GET
        const { secret: _secret, ...safeEndpoint } = endpoint;
        return {
            status: 200,
            data: {
                ...safeEndpoint,
                events: safeJsonParse(endpoint.events, [])
            }
        };
    }

    // PUT /webhooks/endpoints/:id - Update endpoint
    if (method === 'PUT' && endpointIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const endpointId = endpointIdMatch[1];
        const existing = await query.get(
            'SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?',
            [endpointId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }

        const { name, url, events, is_enabled } = body;

        if (url) {
            try {
                new URL(url);
            } catch {
                return { status: 400, data: { error: 'Invalid URL format' } };
            }

            // Block internal URLs to prevent SSRF
            if (isInternalUrl(url)) {
                return { status: 400, data: { error: 'Webhook URL must be a public HTTPS endpoint' } };
            }
        }

        await query.run(`
            UPDATE webhook_endpoints SET
                name = COALESCE(?, name),
                url = COALESCE(?, url),
                events = COALESCE(?, events),
                is_enabled = COALESCE(?, is_enabled),
                updated_at = NOW()
            WHERE id = ? AND user_id = ?
        `, [name, url, events ? JSON.stringify(events) : null, is_enabled, endpointId, user.id]);

        const updated = await query.get('SELECT * FROM webhook_endpoints WHERE id = ?', [endpointId]);
        const { secret: _secret, ...safeUpdated } = updated;

        return {
            status: 200,
            data: {
                ...safeUpdated,
                events: safeJsonParse(updated.events, [])
            }
        };
    }

    // DELETE /webhooks/endpoints/:id - Delete endpoint
    if (method === 'DELETE' && endpointIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const endpointId = endpointIdMatch[1];
        const existing = await query.get(
            'SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?',
            [endpointId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }

        await query.run('DELETE FROM webhook_endpoints WHERE id = ? AND user_id = ?', [endpointId, user.id]);

        return { status: 200, data: { deleted: true } };
    }

    // POST /webhooks/endpoints/:id/test - Send test webhook
    const testMatch = path.match(/^\/endpoints\/([^/]+)\/test$/);
    if (method === 'POST' && testMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const endpointId = testMatch[1];
        const endpoint = await query.get(`
            SELECT * FROM webhook_endpoints WHERE id = ? AND user_id = ?
        `, [endpointId, user.id]);

        if (!endpoint) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }

        // Send test webhook
        const testPayload = {
            event: 'test',
            timestamp: new Date().toISOString(),
            payload: {
                message: 'This is a test webhook from VaultLister',
                endpoint_id: endpointId
            }
        };

        try {
            const response = await fetch(endpoint.url, {
                method: 'POST',
                redirect: 'manual', // Prevent SSRF via redirect
                signal: AbortSignal.timeout(10000),
                headers: {
                    'Content-Type': 'application/json',
                    'X-VaultLister-Event': 'test',
                    'X-VaultLister-Signature': 'sha256=' + crypto.createHmac('sha256', endpoint.secret).update(JSON.stringify(testPayload)).digest('hex')
                },
                body: JSON.stringify(testPayload)
            });

            const success = response.ok;

            // Update endpoint
            await query.run(`
                UPDATE webhook_endpoints SET
                    last_triggered_at = NOW(),
                    failure_count = CASE WHEN ? THEN 0 ELSE failure_count + 1 END,
                    updated_at = NOW()
                WHERE id = ? AND user_id = ?
            `, [success, endpointId, user.id]);

            return {
                status: 200,
                data: {
                    success,
                    status_code: response.status,
                    message: success ? 'Test webhook sent successfully' : 'Webhook delivery failed'
                }
            };

        } catch (error) {
            logger.error('[Webhooks] Webhook delivery error', null, { detail: error?.message || 'Unknown error' });
            await query.run(`
                UPDATE webhook_endpoints SET
                    failure_count = failure_count + 1,
                    updated_at = NOW()
                WHERE id = ? AND user_id = ?
            `, [endpointId, user.id]);

            return {
                status: 200,
                data: {
                    success: false,
                    error: 'Failed to reach webhook endpoint',
                    message: 'Failed to reach webhook endpoint'
                }
            };
        }
    }

    // GET /webhooks/events - List recent webhook events
    if (method === 'GET' && path === '/events') {
        const authError = requireAuth();
        if (authError) return authError;

        const limit = Math.min(Math.max(1, parseInt(queryParams.limit) || 50), 200);
        const offset = Math.max(0, parseInt(queryParams.offset) || 0);
        const status = queryParams.status;

        let sql = `
            SELECT * FROM webhook_events
            WHERE user_id = ?
        `;
        const params = [user.id];

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const events = await query.all(sql, params);

        // Parse payloads
        const parsed = events.map(ev => ({
            ...ev,
            payload: safeJsonParse(ev.payload, {})
        }));

        return { status: 200, data: parsed };
    }

    // GET /webhooks/events/:id - Get event details
    const eventIdMatch = path.match(/^\/events\/([^/]+)$/);
    if (method === 'GET' && eventIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const eventId = eventIdMatch[1];
        const event = await query.get(`
            SELECT * FROM webhook_events WHERE id = ? AND user_id = ?
        `, [eventId, user.id]);

        if (!event) {
            return { status: 404, data: { error: 'Event not found' } };
        }

        return {
            status: 200,
            data: {
                ...event,
                payload: safeJsonParse(event.payload, {})
            }
        };
    }

    // POST /webhooks/events/:id/retry - Retry processing event
    const retryMatch = path.match(/^\/events\/([^/]+)\/retry$/);
    if (method === 'POST' && retryMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const eventId = retryMatch[1];
        const event = await query.get(`
            SELECT * FROM webhook_events WHERE id = ? AND user_id = ?
        `, [eventId, user.id]);

        if (!event) {
            return { status: 404, data: { error: 'Event not found' } };
        }

        // Requeue for processing
        await query.run(`
            UPDATE webhook_events SET status = 'pending', error_message = NULL, updated_at = NOW()
            WHERE id = ? AND user_id = ?
        `, [eventId, user.id]);

        await processWebhookEvent({ ...event, payload: event.payload });

        const updated = await query.get('SELECT * FROM webhook_events WHERE id = ?', [eventId]);

        return {
            status: 200,
            data: {
                ...updated,
                payload: safeJsonParse(updated.payload, {})
            }
        };
    }

    // GET /webhooks/event-types - List supported event types
    if (method === 'GET' && path === '/event-types') {
        return {
            status: 200,
            data: [
                { type: 'listing.created', description: 'A new listing was created' },
                { type: 'listing.updated', description: 'A listing was updated' },
                { type: 'listing.sold', description: 'An item was sold' },
                { type: 'listing.ended', description: 'A listing has ended' },
                { type: 'order.created', description: 'A new order was placed' },
                { type: 'order.shipped', description: 'An order was shipped' },
                { type: 'order.delivered', description: 'An order was delivered' },
                { type: 'order.cancelled', description: 'An order was cancelled' },
                { type: 'offer.received', description: 'A new offer was received' },
                { type: 'offer.accepted', description: 'An offer was accepted' },
                { type: 'offer.declined', description: 'An offer was declined' },
                { type: 'inventory.low_stock', description: 'Item is running low' },
                { type: 'account.synced', description: 'Account sync completed' },
                { type: 'account.error', description: 'Account sync error' }
            ]
        };
    }

    // ===== PUBLIC: Depop Webhook =====
    // POST /webhooks/depop — handles v1:order.new events from Depop Selling API
    if (method === 'POST' && path === '/depop') {
        const sig = ctx.headers?.['x-depop-signature'];
        const timestamp = ctx.headers?.['x-depop-timestamp'];
        const secret = process.env.DEPOP_WEBHOOK_SECRET;
        if (!secret) {
            logger.error('[Webhooks/Depop] DEPOP_WEBHOOK_SECRET not set — rejecting request');
            return { status: 500, data: { error: 'Webhook not configured' } };
        }
        if (!sig || !timestamp) {
            logger.warn('[Webhooks/Depop] Missing signature headers');
            return { status: 401, data: { error: 'Missing signature' } };
        }
        const depopPayload = `${timestamp}.${ctx.rawBody || ''}`;
        const expected = crypto.createHmac('sha256', secret).update(depopPayload).digest('hex');
        if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
            logger.warn('[Webhooks/Depop] Signature mismatch');
            return { status: 401, data: { error: 'Invalid signature' } };
        }

        const event = safeJsonParse(ctx.rawBody || body, {});
        logger.info('[Webhooks/Depop] Event received', { type: event.type });

        if (event.type === 'v1:order.new') {
            const shopId = event.data?.shop_id;
            if (shopId) {
                query.get('SELECT * FROM shops WHERE id = ?', [shopId])
                    .then(shop => {
                        if (shop) syncShop(shop)
                            .catch(e => logger.error('[Webhooks/Depop] Sync failed', { err: e.message }));
                    }).catch(e => logger.error('[Webhooks/Depop] Shop lookup failed', { err: e.message }));
            }
        }

        return { status: 200, data: { received: true } };
    }

    return { status: 404, data: { error: 'Route not found' } };
}
