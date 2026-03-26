// Outgoing Webhooks Service
// Send events to external endpoints (Zapier, Make, custom endpoints)

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Strip sensitive fields from webhook payload data
const SENSITIVE_FIELD_PATTERNS = ['password', 'secret', 'token', 'api_key', 'apikey', 'encryption_key', 'hash', 'oauth'];
function sanitizeWebhookData(data) {
    if (!data || typeof data !== 'object') return data;
    const result = {};
    for (const [k, v] of Object.entries(data)) {
        const lower = k.toLowerCase();
        if (SENSITIVE_FIELD_PATTERNS.some(p => lower.includes(p))) continue;
        result[k] = v;
    }
    return result;
}

// Event types
const EVENT_TYPES = {
    // Inventory events
    'inventory.created': { description: 'New inventory item created' },
    'inventory.updated': { description: 'Inventory item updated' },
    'inventory.deleted': { description: 'Inventory item deleted' },
    'inventory.low_stock': { description: 'Inventory item low on stock' },

    // Listing events
    'listing.created': { description: 'New listing created' },
    'listing.updated': { description: 'Listing updated' },
    'listing.sold': { description: 'Listing marked as sold' },
    'listing.expired': { description: 'Listing expired or ended' },

    // Sale events
    'sale.created': { description: 'New sale recorded' },
    'sale.shipped': { description: 'Sale marked as shipped' },
    'sale.delivered': { description: 'Sale marked as delivered' },
    'sale.cancelled': { description: 'Sale cancelled' },

    // Offer events
    'offer.received': { description: 'New offer received' },
    'offer.accepted': { description: 'Offer accepted' },
    'offer.declined': { description: 'Offer declined' },
    'offer.expired': { description: 'Offer expired' },

    // Automation events
    'automation.completed': { description: 'Automation task completed' },
    'automation.failed': { description: 'Automation task failed' },

    // Account events
    'account.login': { description: 'User logged in' },
    'account.settings_changed': { description: 'Account settings changed' },
};

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2
};

// Webhook delivery queue
const deliveryQueue = [];
const MAX_QUEUE_SIZE = 1000;
let isProcessing = false;

// Generate webhook signature
function generateSignature(payload, secret) {
    const timestamp = Date.now();
    const payloadString = JSON.stringify(payload);
    const signatureBase = `${timestamp}.${payloadString}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signatureBase)
        .digest('hex');

    return {
        signature: `v1=${signature}`,
        timestamp
    };
}

// Send webhook
async function sendWebhook(endpoint, event, payload, secret) {
    const { signature, timestamp } = generateSignature(payload, secret);

    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'VaultLister-Webhook/1.0',
        'X-Webhook-Event': event,
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-Delivery': payload.deliveryId
    };

    // Sanitize custom headers to prevent CRLF injection
    const sanitizedCustomHeaders = {};
    if (endpoint.headers && typeof endpoint.headers === 'object') {
        for (const [key, value] of Object.entries(endpoint.headers)) {
            const k = String(key);
            const v = String(value);
            if (/[\r\n]/.test(k) || /[\r\n]/.test(v)) continue; // Skip CRLF-tainted headers
            sanitizedCustomHeaders[k] = v;
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
        const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: { ...headers, ...sanitizedCustomHeaders },
            body: JSON.stringify(payload),
            signal: controller.signal,
            redirect: 'manual'   // Prevent SSRF via redirect chaining
        });

        clearTimeout(timeout);

        return {
            success: response.ok,
            statusCode: response.status,
            responseBody: await response.text().then(t => t.substring(0, 10000)).catch(() => '')
        };
    } catch (error) {
        clearTimeout(timeout);
        return {
            success: false,
            statusCode: 0,
            error: error.message
        };
    }
}

// Process delivery queue
async function processQueue() {
    if (isProcessing || deliveryQueue.length === 0) return;

    isProcessing = true;

    try {
        while (deliveryQueue.length > 0) {
            const delivery = deliveryQueue.shift();

            try {
                const result = await sendWebhook(
                    delivery.endpoint,
                    delivery.event,
                    delivery.payload,
                    delivery.secret
                );

                // Log delivery attempt
                query.run(`
                    INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status, status_code, response_body, attempt, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                `, [
                    uuidv4(),
                    delivery.webhookId,
                    delivery.event,
                    JSON.stringify(delivery.payload),
                    result.success ? 'delivered' : 'failed',
                    result.statusCode,
                    result.responseBody || result.error,
                    delivery.attempt
                ]);

                // Handle retry
                if (!result.success && delivery.attempt < RETRY_CONFIG.maxRetries) {
                    const delay = Math.min(
                        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, delivery.attempt),
                        RETRY_CONFIG.maxDelay
                    );

                    setTimeout(() => {
                        if (deliveryQueue.length < MAX_QUEUE_SIZE) {
                            deliveryQueue.push({
                                ...delivery,
                                attempt: delivery.attempt + 1
                            });
                            processQueue();
                        }
                    }, delay);
                }
            } catch (error) {
                logger.error('[OutgoingWebhooks] Webhook delivery error', null, { detail: error.message });
            }
        }
    } finally {
        isProcessing = false;
    }
}

// Main service
const outgoingWebhooks = {
    // Initialize service
    init() {
        logger.info('[OutgoingWebhooks] Outgoing webhook service initialized');
    },

    // Trigger an event
    async trigger(eventType, data, userId) {
        if (!EVENT_TYPES[eventType]) {
            logger.warn(`[OutgoingWebhooks] Unknown webhook event type: ${eventType}`);
            return;
        }

        // Get active webhooks for this event and user
        // Escape LIKE wildcards in eventType to prevent injection
        const escapedEvent = eventType.replace(/[%_]/g, '\\$&');
        const webhooks = query.all(`
            SELECT * FROM user_webhooks
            WHERE user_id = ? AND is_active = 1 AND (events LIKE ? ESCAPE '\\' OR events = '*')
        `, [userId, `%${escapedEvent}%`]);

        if (!webhooks || webhooks.length === 0) return;

        const deliveryId = uuidv4();
        const payload = {
            deliveryId,
            event: eventType,
            timestamp: new Date().toISOString(),
            data: sanitizeWebhookData(data)
        };

        // Queue deliveries (cap queue size to prevent memory exhaustion)
        for (const webhook of webhooks) {
            if (deliveryQueue.length >= MAX_QUEUE_SIZE) {
                logger.warn(`[OutgoingWebhooks] Queue full (${MAX_QUEUE_SIZE}), dropping delivery for ${eventType}`);
                break;
            }
            deliveryQueue.push({
                webhookId: webhook.id,
                endpoint: {
                    url: webhook.url,
                    headers: (() => { try { return webhook.headers ? JSON.parse(webhook.headers) : {}; } catch { return {}; } })()
                },
                event: eventType,
                payload,
                secret: webhook.secret,
                attempt: 1
            });
        }

        // Start processing
        processQueue();
    },

    // Get available event types
    getEventTypes() {
        return EVENT_TYPES;
    }
};

// Router for webhook management
export async function outgoingWebhooksRouter(ctx) {
    const { method, path, user, body } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/outgoing-webhooks - List user's webhooks
    if (method === 'GET' && (path === '/' || path === '')) {
        const webhooks = query.all(`
            SELECT id, name, url, events, is_active, created_at, updated_at
            FROM user_webhooks
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [user.id]);

        return {
            status: 200,
            data: {
                webhooks,
                availableEvents: EVENT_TYPES
            }
        };
    }

    // POST /api/outgoing-webhooks - Create webhook
    if (method === 'POST' && (path === '/' || path === '')) {
        const { name, url, events, headers } = body;

        if (!name || !url || !events) {
            return { status: 400, data: { error: 'Name, URL, and events are required' } };
        }

        // Validate URL — block private/internal targets (SSRF protection)
        try {
            const parsed = new URL(url);
            if (!['https:', 'http:'].includes(parsed.protocol)) {
                return { status: 400, data: { error: 'Only HTTP(S) URLs are allowed' } };
            }
            const hostname = parsed.hostname.toLowerCase();
            const blockedPatterns = [
                'localhost', '127.0.0.1', '::1', '0.0.0.0',
                '169.254.169.254', // cloud metadata
                'metadata.google.internal',
            ];
            if (blockedPatterns.includes(hostname) ||
                hostname.endsWith('.internal') ||
                hostname.endsWith('.local') ||
                /^10\./.test(hostname) ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
                /^192\.168\./.test(hostname)) {
                return { status: 400, data: { error: 'Internal/private URLs are not allowed' } };
            }
        } catch {
            return { status: 400, data: { error: 'Invalid URL' } };
        }

        // Generate secret for signing
        const secret = crypto.randomBytes(32).toString('hex');
        const id = uuidv4();

        query.run(`
            INSERT INTO user_webhooks (id, user_id, name, url, secret, events, headers, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `, [id, user.id, name, url, secret, Array.isArray(events) ? events.join(',') : events, headers ? JSON.stringify(headers) : null]);

        return {
            status: 201,
            data: {
                webhook: { id, name, url, events, secret },
                message: 'Webhook created. Save the secret - it will not be shown again.'
            }
        };
    }

    // GET /api/outgoing-webhooks/:id - Get webhook details
    if (method === 'GET' && path.length > 1) {
        const webhookId = path.replace('/', '');

        const webhook = query.get(`
            SELECT id, name, url, events, headers, is_active, created_at, updated_at
            FROM user_webhooks
            WHERE id = ? AND user_id = ?
        `, [webhookId, user.id]);

        if (!webhook) {
            return { status: 404, data: { error: 'Webhook not found' } };
        }

        // Get recent deliveries
        const deliveries = query.all(`
            SELECT id, event_type, status, status_code, attempt, created_at
            FROM webhook_deliveries
            WHERE webhook_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        `, [webhookId]);

        return {
            status: 200,
            data: { webhook, deliveries }
        };
    }

    // PUT /api/outgoing-webhooks/:id - Update webhook
    if (method === 'PUT' && path.length > 1) {
        const webhookId = path.replace('/', '');
        const { name, url, events, headers, is_active } = body;

        const existing = query.get('SELECT id FROM user_webhooks WHERE id = ? AND user_id = ?', [webhookId, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Webhook not found' } };
        }

        const updates = [];
        const values = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (url !== undefined) { updates.push('url = ?'); values.push(url); }
        if (events !== undefined) { updates.push('events = ?'); values.push(Array.isArray(events) ? events.join(',') : events); }
        if (headers !== undefined) { updates.push('headers = ?'); values.push(headers ? JSON.stringify(headers) : null); }
        if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

        if (updates.length > 0) {
            updates.push('updated_at = datetime("now")');
            values.push(webhookId);
            query.run(`UPDATE user_webhooks SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        return { status: 200, data: { message: 'Webhook updated' } };
    }

    // DELETE /api/outgoing-webhooks/:id - Delete webhook
    if (method === 'DELETE' && path.length > 1) {
        const webhookId = path.replace('/', '');

        query.run('DELETE FROM user_webhooks WHERE id = ? AND user_id = ?', [webhookId, user.id]);

        return { status: 200, data: { message: 'Webhook deleted' } };
    }

    // POST /api/outgoing-webhooks/:id/test - Test webhook
    if (method === 'POST' && path.endsWith('/test')) {
        const webhookId = path.split('/')[1];

        const webhook = query.get('SELECT * FROM user_webhooks WHERE id = ? AND user_id = ?', [webhookId, user.id]);
        if (!webhook) {
            return { status: 404, data: { error: 'Webhook not found' } };
        }

        // Send test event
        const result = await sendWebhook(
            { url: webhook.url, headers: webhook.headers ? JSON.parse(webhook.headers) : {} },
            'test',
            {
                deliveryId: uuidv4(),
                event: 'test',
                timestamp: new Date().toISOString(),
                data: { message: 'This is a test webhook from VaultLister' }
            },
            webhook.secret
        );

        return {
            status: 200,
            data: {
                success: result.success,
                statusCode: result.statusCode,
                response: result.responseBody || result.error
            }
        };
    }

    // POST /api/outgoing-webhooks/:id/rotate-secret - Rotate webhook secret
    if (method === 'POST' && path.endsWith('/rotate-secret')) {
        const webhookId = path.split('/')[1];

        const existing = query.get('SELECT id FROM user_webhooks WHERE id = ? AND user_id = ?', [webhookId, user.id]);
        if (!existing) {
            return { status: 404, data: { error: 'Webhook not found' } };
        }

        const newSecret = crypto.randomBytes(32).toString('hex');
        query.run('UPDATE user_webhooks SET secret = ?, updated_at = datetime("now") WHERE id = ?', [newSecret, webhookId]);

        return {
            status: 200,
            data: {
                secret: newSecret,
                message: 'Secret rotated. Update your integration with the new secret.'
            }
        };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Tables created by pg-schema.sql (managed by migration system)
export const migration = '';

export { outgoingWebhooks };
export default outgoingWebhooks;
