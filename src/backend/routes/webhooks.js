// Webhooks Router for VaultLister
// Manages webhook endpoints and processes incoming webhooks

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { processWebhookEvent, verifySignature } from '../services/webhookProcessor.js';
import { logger } from '../shared/logger.js';

/**
 * Safe JSON parse helper — returns fallback on malformed data instead of throwing
 */
function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

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

    // ===== PUBLIC: Incoming webhook handler =====
    // POST /webhooks/incoming/:source
    const incomingMatch = path.match(/^\/incoming\/([^/]+)$/);
    if (method === 'POST' && incomingMatch) {
        const source = incomingMatch[1];

        try {
            // Extract signature from headers
            const signature = ctx.headers?.['x-signature'] || ctx.headers?.['x-hub-signature'] || ctx.headers?.['x-vaultlister-signature'] || null;

            // Look up webhook configuration for this source (most recent if duplicates)
            const webhookConfig = query.get(`
                SELECT secret, user_id FROM webhook_endpoints
                WHERE name = ? AND is_enabled = 1
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
                return { status: 500, data: { error: 'Webhook endpoint misconfigured' } };
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

            query.run(`
                INSERT INTO webhook_events (id, user_id, source, event_type, payload, signature, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
            `, [eventId, webhookConfig.user_id, source, eventType, JSON.stringify(body), signature]);

            // Queue for async processing
            try {
                query.run(`
                    INSERT INTO tasks (id, type, payload, status, priority, created_at)
                    VALUES (?, 'process_webhook', ?, 'pending', 5, datetime('now'))
                `, [uuidv4(), JSON.stringify({ eventId })]);
            } catch (err) {
                // Fallback: process synchronously
                const event = query.get('SELECT * FROM webhook_events WHERE id = ?', [eventId]);
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

        const endpoints = query.all(`
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
        const existingEndpoint = query.get(
            'SELECT id FROM webhook_endpoints WHERE user_id = ? AND name = ? AND is_enabled = 1',
            [user.id, name]
        );

        // Generate secret for HMAC signing
        const secret = `whsec_${uuidv4().replace(/-/g, '')}`;
        let endpointId;

        if (existingEndpoint) {
            // Update existing endpoint (rotate secret, update URL/events)
            endpointId = existingEndpoint.id;
            query.run(`
                UPDATE webhook_endpoints SET url = ?, secret = ?, events = ?, updated_at = datetime('now')
                WHERE id = ? AND user_id = ?
            `, [url, secret, JSON.stringify(events), endpointId, user.id]);
        } else {
            endpointId = uuidv4();
            query.run(`
                INSERT INTO webhook_endpoints (id, user_id, name, url, secret, events, is_enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `, [endpointId, user.id, name, url, secret, JSON.stringify(events)]);
        }

        const endpoint = query.get('SELECT * FROM webhook_endpoints WHERE id = ?', [endpointId]);

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
        const endpoint = query.get(`
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
        const existing = query.get(
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

        query.run(`
            UPDATE webhook_endpoints SET
                name = COALESCE(?, name),
                url = COALESCE(?, url),
                events = COALESCE(?, events),
                is_enabled = COALESCE(?, is_enabled),
                updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
        `, [name, url, events ? JSON.stringify(events) : null, is_enabled, endpointId, user.id]);

        const updated = query.get('SELECT * FROM webhook_endpoints WHERE id = ?', [endpointId]);
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
        const existing = query.get(
            'SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?',
            [endpointId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Endpoint not found' } };
        }

        query.run('DELETE FROM webhook_endpoints WHERE id = ? AND user_id = ?', [endpointId, user.id]);

        return { status: 200, data: { deleted: true } };
    }

    // POST /webhooks/endpoints/:id/test - Send test webhook
    const testMatch = path.match(/^\/endpoints\/([^/]+)\/test$/);
    if (method === 'POST' && testMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const endpointId = testMatch[1];
        const endpoint = query.get(`
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
                headers: {
                    'Content-Type': 'application/json',
                    'X-VaultLister-Event': 'test',
                    'X-VaultLister-Signature': 'sha256=' + crypto.createHmac('sha256', endpoint.secret).update(JSON.stringify(testPayload)).digest('hex')
                },
                body: JSON.stringify(testPayload)
            });

            const success = response.ok;

            // Update endpoint
            query.run(`
                UPDATE webhook_endpoints SET
                    last_triggered_at = datetime('now'),
                    failure_count = CASE WHEN ? THEN 0 ELSE failure_count + 1 END,
                    updated_at = datetime('now')
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
            query.run(`
                UPDATE webhook_endpoints SET
                    failure_count = failure_count + 1,
                    updated_at = datetime('now')
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

        const events = query.all(sql, params);

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
        const event = query.get(`
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
        const event = query.get(`
            SELECT * FROM webhook_events WHERE id = ? AND user_id = ?
        `, [eventId, user.id]);

        if (!event) {
            return { status: 404, data: { error: 'Event not found' } };
        }

        // Requeue for processing
        query.run(`
            UPDATE webhook_events SET status = 'pending', error_message = NULL, updated_at = datetime('now')
            WHERE id = ? AND user_id = ?
        `, [eventId, user.id]);

        await processWebhookEvent({ ...event, payload: event.payload });

        const updated = query.get('SELECT * FROM webhook_events WHERE id = ?', [eventId]);

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

    return { status: 404, data: { error: 'Route not found' } };
}
