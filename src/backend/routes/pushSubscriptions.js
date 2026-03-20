// Push Subscriptions Router for VaultLister
// Manages Web Push API subscriptions

import webpush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

function safeJsonParse(str, fallback = null) {
    if (str == null) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

// Configure VAPID — generate keys with: npx web-push generate-vapid-keys
// Required env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
(function configureVapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@vaultlister.app';

    if (publicKey && privateKey) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
        logger.warn('[Push] VAPID keys not configured — push notifications will not be sent. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
    }
})();

const PUSH_SETTINGS_KEY = 'push_notifications';
const DEFAULT_PUSH_SETTINGS = {
    enabled: true,
    categories: {
        sales: true,
        offers: true,
        orders: true,
        sync: false,
        marketing: false
    }
};

export async function pushSubscriptionsRouter(ctx) {
    const { method, path, body, query: queryParams, user } = ctx;

    // Helper: require authentication
    const requireAuth = () => {
        if (!user) {
            return { status: 401, data: { error: 'Authentication required' } };
        }
        return null;
    };

    // GET /push/vapid-public-key - Get VAPID public key
    if (method === 'GET' && path === '/vapid-public-key') {
        const publicKey = process.env.VAPID_PUBLIC_KEY || 'mock_vapid_public_key_for_development';

        return {
            status: 200,
            data: { publicKey }
        };
    }

    // POST /push/subscribe - Subscribe to push notifications
    if (method === 'POST' && path === '/subscribe') {
        const authError = requireAuth();
        if (authError) return authError;

        const { subscription, userAgent } = body;

        if (!subscription || !subscription.endpoint) {
            return { status: 400, data: { error: 'Valid subscription object required' } };
        }

        const { endpoint, keys } = subscription;

        if (!keys || !keys.p256dh || !keys.auth) {
            return { status: 400, data: { error: 'Subscription keys (p256dh, auth) required' } };
        }

        try {
            // Check if subscription already exists
            const existing = query.get(
                'SELECT id FROM push_subscriptions WHERE endpoint = ?',
                [endpoint]
            );

            if (existing) {
                // Update existing subscription
                query.run(`
                    UPDATE push_subscriptions SET
                        user_id = ?,
                        p256dh_key = ?,
                        auth_key = ?,
                        user_agent = ?,
                        is_active = 1,
                        updated_at = datetime('now')
                    WHERE endpoint = ?
                `, [user.id, keys.p256dh, keys.auth, userAgent || null, endpoint]);

                return {
                    status: 200,
                    data: { subscribed: true, updated: true, id: existing.id }
                };
            }

            // Create new subscription
            const subscriptionId = uuidv4();
            query.run(`
                INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, user_agent, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `, [subscriptionId, user.id, endpoint, keys.p256dh, keys.auth, userAgent || null]);

            return {
                status: 201,
                data: { subscribed: true, id: subscriptionId }
            };

        } catch (error) {
            logger.error('[Push] Subscription error', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to save subscription' } };
        }
    }

    // DELETE /push/subscribe - Unsubscribe from push notifications
    if (method === 'DELETE' && path === '/subscribe') {
        const authError = requireAuth();
        if (authError) return authError;

        const { endpoint } = body;

        if (!endpoint) {
            return { status: 400, data: { error: 'Endpoint required' } };
        }

        query.run(`
            UPDATE push_subscriptions SET is_active = 0, updated_at = datetime('now')
            WHERE endpoint = ? AND user_id = ?
        `, [endpoint, user.id]);

        return {
            status: 200,
            data: { unsubscribed: true }
        };
    }

    // GET /push/status - Get subscription status
    if (method === 'GET' && path === '/status') {
        const authError = requireAuth();
        if (authError) return authError;

        const subscriptions = query.all(`
            SELECT id, endpoint, user_agent, is_active, created_at, last_used_at
            FROM push_subscriptions
            WHERE user_id = ? AND is_active = 1
            ORDER BY created_at DESC
        `, [user.id]);

        return {
            status: 200,
            data: {
                subscribed: subscriptions.length > 0,
                subscription_count: subscriptions.length,
                subscriptions: subscriptions.map(s => ({
                    id: s.id,
                    user_agent: s.user_agent,
                    created_at: s.created_at,
                    last_used_at: s.last_used_at
                }))
            }
        };
    }

    // POST /push/test - Send test notification
    if (method === 'POST' && path === '/test') {
        const authError = requireAuth();
        if (authError) return authError;

        const subscriptions = query.all(`
            SELECT * FROM push_subscriptions
            WHERE user_id = ? AND is_active = 1
        `, [user.id]);

        if (subscriptions.length === 0) {
            return { status: 400, data: { error: 'No active push subscriptions' } };
        }

        const testPayload = JSON.stringify({
            title: 'VaultLister Test',
            body: 'Push notifications are working!',
            data: { type: 'test' },
            timestamp: Date.now()
        });

        const sent = [];

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                    testPayload
                );

                query.run(`
                    UPDATE push_subscriptions SET last_used_at = datetime('now')
                    WHERE id = ?
                `, [sub.id]);

                sent.push(sub.id);

            } catch (error) {
                logger.error('[Push] Test notification failed', user?.id || null, { detail: error.message });

                if (error.statusCode === 410 || error.statusCode === 404) {
                    query.run(`
                        UPDATE push_subscriptions SET is_active = 0, updated_at = datetime('now')
                        WHERE id = ?
                    `, [sub.id]);
                }
            }
        }

        return {
            status: 200,
            data: {
                sent: sent.length,
                total: subscriptions.length,
                message: 'Test notification sent (check your device)'
            }
        };
    }

    // POST /push/send - Send notification to user (internal/admin use)
    if (method === 'POST' && path === '/send') {
        const authError = requireAuth();
        if (authError) return authError;

        const { title, body: notificationBody, data, targetUserId } = body;

        if (!title || !notificationBody) {
            return { status: 400, data: { error: 'Title and body required' } };
        }

        // Admin can send to any user, regular users can only send to themselves
        const userId = (user.role === 'admin' && targetUserId) ? targetUserId : user.id;

        const subscriptions = query.all(`
            SELECT * FROM push_subscriptions
            WHERE user_id = ? AND is_active = 1
        `, [userId]);

        if (subscriptions.length === 0) {
            return { status: 200, data: { sent: 0, message: 'No active subscriptions' } };
        }

        const payload = JSON.stringify({
            title,
            body: notificationBody,
            data: data || {},
            timestamp: Date.now()
        });

        let sent = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                    payload
                );

                query.run(`
                    UPDATE push_subscriptions SET last_used_at = datetime('now')
                    WHERE id = ?
                `, [sub.id]);

                sent++;

            } catch (error) {
                logger.error('[Push] Send notification failed', user?.id || null, { detail: error.message });

                if (error.statusCode === 410 || error.statusCode === 404) {
                    query.run(`
                        UPDATE push_subscriptions SET is_active = 0, updated_at = datetime('now')
                        WHERE id = ?
                    `, [sub.id]);
                }
            }
        }

        return {
            status: 200,
            data: { sent, total: subscriptions.length }
        };
    }

    // DELETE /push/subscription/:id - Delete specific subscription
    const subIdMatch = path.match(/^\/subscription\/([^/]+)$/);
    if (method === 'DELETE' && subIdMatch) {
        const authError = requireAuth();
        if (authError) return authError;

        const subId = subIdMatch[1];

        const existing = query.get(
            'SELECT id FROM push_subscriptions WHERE id = ? AND user_id = ?',
            [subId, user.id]
        );

        if (!existing) {
            return { status: 404, data: { error: 'Subscription not found' } };
        }

        query.run('DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?', [subId, user.id]);

        return {
            status: 200,
            data: { deleted: true }
        };
    }

    // GET /push/settings - Get notification preferences
    if (method === 'GET' && path === '/settings') {
        const authError = requireAuth();
        if (authError) return authError;

        try {
            const row = query.get(
                'SELECT settings FROM user_preferences WHERE user_id = ? AND key = ?',
                [user.id, PUSH_SETTINGS_KEY]
            );

            const settings = safeJsonParse(row?.settings, DEFAULT_PUSH_SETTINGS);

            return { status: 200, data: settings };
        } catch (error) {
            logger.error('[Push] Get settings failed', user?.id || null, { detail: error.message });
            return { status: 200, data: DEFAULT_PUSH_SETTINGS };
        }
    }

    // PUT /push/settings - Update notification preferences
    if (method === 'PUT' && path === '/settings') {
        const authError = requireAuth();
        if (authError) return authError;

        const { enabled, categories } = body;

        const updated = {
            enabled: enabled !== undefined ? enabled : DEFAULT_PUSH_SETTINGS.enabled,
            categories: { ...DEFAULT_PUSH_SETTINGS.categories, ...(categories || {}) }
        };

        try {
            query.run(`
                INSERT INTO user_preferences (id, user_id, key, settings, created_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(user_id, key) DO UPDATE SET
                    settings = excluded.settings,
                    updated_at = datetime('now')
            `, [uuidv4(), user.id, PUSH_SETTINGS_KEY, JSON.stringify(updated)]);

            return { status: 200, data: { updated: true, ...updated } };
        } catch (error) {
            logger.error('[Push] Save settings failed', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to save notification settings' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
