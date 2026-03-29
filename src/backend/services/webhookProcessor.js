// Webhook Processor Service for VaultLister
// Maps incoming webhook events to internal actions

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../db/database.js';
import { createNotification } from './notificationService.js';
import { logger } from '../shared/logger.js';
import { fetchWithTimeout } from '../shared/fetchWithTimeout.js';
import { circuitBreaker } from '../shared/circuitBreaker.js';

// Retry configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 4000, 16000]; // exponential: 1s, 4s, 16s

// Query timeout wrapper — rejects if a DB query takes longer than timeoutMs
function queryWithTimeout(fn, timeoutMs = 5000) {
    return Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Webhook DB query timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// Supported event types and their handlers
const EVENT_HANDLERS = {
    // Listing events
    'listing.created': handleListingCreated,
    'listing.updated': handleListingUpdated,
    'listing.sold': handleListingSold,
    'listing.ended': handleListingEnded,
    'listing.views': handleListingViews,

    // Order events
    'order.created': handleOrderCreated,
    'order.shipped': handleOrderShipped,
    'order.delivered': handleOrderDelivered,
    'order.cancelled': handleOrderCancelled,

    // Offer events
    'offer.received': handleOfferReceived,
    'offer.accepted': handleOfferAccepted,
    'offer.declined': handleOfferDeclined,
    'offer.expired': handleOfferExpired,

    // Account events
    'account.synced': handleAccountSynced,
    'account.error': handleAccountError,

    // Inventory events
    'inventory.low_stock': handleLowStock,
    'inventory.out_of_stock': handleOutOfStock
};

/**
 * Process a webhook event with retry logic and dead-letter queue on max failures
 * @param {Object} event - Webhook event record
 * @returns {Object} Processing result
 */
export async function processWebhookEvent(event) {
    const eventType = event.event_type;
    const handler = EVENT_HANDLERS[eventType];

    if (!handler) {
        logger.info(`[WebhookProcessor] Unknown event type: ${eventType}`);
        return { success: false, error: `Unknown event type: ${eventType}` };
    }

    const currentRetry = event.retry_count || 0;

    try {
        const payload = typeof event.payload === 'string'
            ? JSON.parse(event.payload)
            : event.payload;

        const result = await circuitBreaker('webhook-processing', () => handler(event, payload), {
            failureThreshold: 5,
            cooldownMs: 60000 // pause webhook processing for 60s after 5 consecutive failures
        });

        // Update event status with query timeout
        await queryWithTimeout(() => query.run(`
            UPDATE webhook_events SET
                status = 'processed',
                processed_at = NOW()
            WHERE id = ?
        `, [event.id]));

        return { success: true, result };

    } catch (error) {
        logger.error(`[WebhookProcessor] Error processing event ${event.id} (attempt ${currentRetry + 1}/${MAX_RETRY_ATTEMPTS}):`, error);

        const nextRetry = currentRetry + 1;

        if (nextRetry >= MAX_RETRY_ATTEMPTS) {
            // Move to dead-letter queue — log full context and mark permanently failed
            logger.error(`[WebhookProcessor] Event ${event.id} moved to dead-letter queue after ${MAX_RETRY_ATTEMPTS} attempts`, {
                eventId: event.id,
                eventType,
                userId: event.user_id,
                lastError: error.message,
                retryCount: nextRetry
            });

            await queryWithTimeout(() => query.run(`
                UPDATE webhook_events SET
                    status = 'dead_letter',
                    error_message = ?,
                    retry_count = ?,
                    processed_at = NOW()
                WHERE id = ?
            `, [error.message, nextRetry, event.id]));
        } else {
            // Schedule retry with exponential backoff delay
            const delayMs = RETRY_DELAYS_MS[currentRetry] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            const retryAt = new Date(Date.now() + delayMs).toISOString();

            logger.info(`[WebhookProcessor] Scheduling event ${event.id} retry ${nextRetry} in ${delayMs}ms`);

            await queryWithTimeout(() => query.run(`
                UPDATE webhook_events SET
                    status = 'pending',
                    error_message = ?,
                    retry_count = ?,
                    retry_after = ?
                WHERE id = ?
            `, [error.message, nextRetry, retryAt, event.id]));
        }

        return { success: false, error: error.message, retryCount: nextRetry };
    }
}

/**
 * Dispatch event to user's registered webhook endpoints
 * @param {string} userId - User ID
 * @param {string} eventType - Event type
 * @param {Object} payload - Event payload
 */
export async function dispatchToUserEndpoints(userId, eventType, payload) {
    // Escape ILIKE wildcards to prevent injection
    const escapedEvent = eventType.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
    const endpoints = await queryWithTimeout(() => query.all(`
        SELECT * FROM webhook_endpoints
        WHERE user_id = ? AND is_enabled = 1
        AND (events ILIKE '%"' || ? || '"%' ESCAPE '\\' OR events = '[]')
    `, [userId, escapedEvent]));

    for (const endpoint of endpoints) {
        try {
            const signature = generateSignature(payload, endpoint.secret);

            const response = await circuitBreaker(`webhook-${endpoint.id}`, () =>
                fetchWithTimeout(endpoint.url, {
                    method: 'POST',
                    redirect: 'manual', // Prevent SSRF via public→private redirect
                    timeoutMs: 30000,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-VaultLister-Signature': signature,
                        'X-VaultLister-Event': eventType
                    },
                    body: JSON.stringify({
                        event: eventType,
                        timestamp: new Date().toISOString(),
                        payload
                    })
                }),
                { failureThreshold: 5, cooldownMs: 30000 }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Update success
            await queryWithTimeout(() => query.run(`
                UPDATE webhook_endpoints SET
                    last_triggered_at = NOW(),
                    failure_count = 0,
                    updated_at = NOW()
                WHERE id = ?
            `, [endpoint.id]));

        } catch (error) {
            logger.error(`[WebhookProcessor] Failed to dispatch to ${endpoint.url}:`, error.message);

            // Update failure count
            await queryWithTimeout(() => query.run(`
                UPDATE webhook_endpoints SET
                    failure_count = failure_count + 1,
                    updated_at = NOW()
                WHERE id = ?
            `, [endpoint.id]));

            // Disable after too many failures
            const failures = await queryWithTimeout(() => query.get(
                'SELECT failure_count FROM webhook_endpoints WHERE id = ?',
                [endpoint.id]
            ));

            if (failures && failures.failure_count >= 10) {
                await queryWithTimeout(() => query.run(`
                    UPDATE webhook_endpoints SET is_enabled = 0, updated_at = NOW()
                    WHERE id = ?
                `, [endpoint.id]));

                createNotification(userId, {
                    type: 'webhook_disabled',
                    title: 'Webhook Disabled',
                    message: `Webhook endpoint "${endpoint.name}" was disabled due to repeated failures.`,
                    data: { endpointId: endpoint.id }
                });
            }
        }
    }
}

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload, secret) {
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    const signature = hmac.digest('hex');

    return `sha256=${signature}`;
}

/**
 * Verify incoming webhook signature using timing-safe comparison
 */
export function verifySignature(payload, signature, secret) {
    if (!signature || !secret) return false;

    try {
        const expectedSignature = generateSignature(payload, secret);

        // Use timing-safe comparison to prevent timing attacks
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        // Ensure both buffers are same length before comparison
        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (error) {
        logger.error('[WebhookProcessor] Signature verification error:', error);
        return false;
    }
}

// ===== Event Handlers =====

async function handleListingCreated(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'listing_created',
            title: 'Listing Created',
            message: `Your listing "${payload.title}" is now live on ${payload.platform}.`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleListingUpdated(event, payload) {
    // Sync updated data to local listing
    if (payload.listingId && event.user_id) {
        try {
            await query.run(`
                UPDATE listings SET
                    price = COALESCE(?, price),
                    title = COALESCE(?, title),
                    updated_at = NOW()
                WHERE platform_listing_id = ? AND user_id = ?
            `, [payload.price, payload.title, payload.listingId, event.user_id]);
        } catch (err) {
            logger.info('[WebhookProcessor] Could not update listing:', err.message);
        }
    }
    return { action: 'listing_updated' };
}

async function handleListingSold(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'sale',
            title: 'Item Sold!',
            message: `Congratulations! "${payload.title}" sold for $${payload.price} on ${payload.platform}.`,
            data: payload,
            important: true
        });

        // Dispatch to user's webhooks
        await dispatchToUserEndpoints(event.user_id, 'listing.sold', payload);
    }
    return { action: 'sale_notification_sent' };
}

async function handleListingEnded(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'listing_ended',
            title: 'Listing Ended',
            message: `Your listing "${payload.title}" has ended on ${payload.platform}.`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleListingViews(event, payload) {
    // Track engagement
    if (payload.listingId && event.user_id) {
        const now = new Date();
        try {
            await query.run(`
                INSERT INTO listing_engagement (id, user_id, listing_id, event_type, platform, hour_of_day, day_of_week, created_at)
                VALUES (?, ?, ?, 'view', ?, ?, ?, NOW())
            `, [uuidv4(), event.user_id, payload.listingId, payload.platform || 'unknown', now.getHours(), now.getDay()]);
        } catch (err) {
            // Table might not exist yet
        }
    }
    return { action: 'engagement_tracked' };
}

async function handleOrderCreated(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'order_created',
            title: 'New Order',
            message: `New order for "${payload.itemTitle}" from ${payload.buyerUsername}.`,
            data: payload,
            important: true
        });

        await dispatchToUserEndpoints(event.user_id, 'order.created', payload);
    }
    return { action: 'order_notification_sent' };
}

async function handleOrderShipped(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'order_shipped',
            title: 'Order Shipped',
            message: `Order for "${payload.itemTitle}" has been marked as shipped.`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleOrderDelivered(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'order_delivered',
            title: 'Order Delivered',
            message: `Order for "${payload.itemTitle}" has been delivered!`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleOrderCancelled(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'order_cancelled',
            title: 'Order Cancelled',
            message: `Order for "${payload.itemTitle}" has been cancelled.`,
            data: payload,
            important: true
        });
    }
    return { action: 'notification_sent' };
}

async function handleOfferReceived(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'offer_received',
            title: 'New Offer',
            message: `You received a $${payload.amount} offer on "${payload.itemTitle}" from ${payload.buyerUsername}.`,
            data: payload,
            important: true
        });

        await dispatchToUserEndpoints(event.user_id, 'offer.received', payload);
    }
    return { action: 'offer_notification_sent' };
}

async function handleOfferAccepted(event, payload) {
    return { action: 'logged' };
}

async function handleOfferDeclined(event, payload) {
    return { action: 'logged' };
}

async function handleOfferExpired(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'offer_expired',
            title: 'Offer Expired',
            message: `An offer on "${payload.itemTitle}" has expired.`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleAccountSynced(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'sync_complete',
            title: 'Sync Complete',
            message: `${payload.platform} sync completed. ${payload.itemsSynced || 0} items synced.`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleAccountError(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'sync_error',
            title: 'Sync Error',
            message: `Error syncing ${payload.platform}: ${payload.error}`,
            data: payload,
            important: true
        });
    }
    return { action: 'error_notification_sent' };
}

async function handleLowStock(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'low_stock',
            title: 'Low Stock Warning',
            message: `"${payload.itemTitle}" is running low (${payload.quantity} remaining).`,
            data: payload
        });
    }
    return { action: 'notification_sent' };
}

async function handleOutOfStock(event, payload) {
    if (event.user_id) {
        createNotification(event.user_id, {
            type: 'out_of_stock',
            title: 'Out of Stock',
            message: `"${payload.itemTitle}" is now out of stock.`,
            data: payload,
            important: true
        });
    }
    return { action: 'notification_sent' };
}

export default {
    processWebhookEvent,
    dispatchToUserEndpoints,
    verifySignature,
    EVENT_HANDLERS
};
