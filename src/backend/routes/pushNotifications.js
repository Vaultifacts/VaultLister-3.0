// Push Notification Routes
// Device registration, sending, and management

import webpush from 'web-push';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// Configure VAPID for Web Push delivery
(function configureVapid() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@vaultlister.app';

    if (publicKey && privateKey) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
        logger.warn('[PushNotifications] VAPID keys not configured — web push delivery disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
    }
})();

export async function pushNotificationsRouter(ctx) {
    const { method, path, user, body } = ctx;

    // POST /api/notifications/register-device - Register device for push notifications
    if (method === 'POST' && path === '/register-device') {
        try {
            const { token, platform, deviceId, deviceName } = body;

            if (!token || !platform) {
                return { status: 400, data: { error: 'Token and platform are required' } };
            }

            // Validate platform
            const validPlatforms = ['ios', 'android', 'web'];
            if (!validPlatforms.includes(platform)) {
                return { status: 400, data: { error: 'Invalid platform' } };
            }

            // Check if device already registered
            const existing = query.get(
                'SELECT id FROM push_devices WHERE token = ?',
                [token]
            );

            if (existing) {
                // Only update if device belongs to current user (prevent takeover)
                const ownedDevice = query.get(
                    'SELECT id FROM push_devices WHERE token = ? AND user_id = ?',
                    [token, user?.id]
                );
                if (!ownedDevice) {
                    return { status: 409, data: { error: 'Device token already registered to another user' } };
                }
                query.run(`
                    UPDATE push_devices SET
                        device_name = COALESCE(?, device_name),
                        updated_at = datetime('now'),
                        last_active_at = datetime('now')
                    WHERE id = ? AND user_id = ?
                `, [deviceName, existing.id, user?.id]);

                return {
                    status: 200,
                    data: { message: 'Device updated', deviceId: existing.id }
                };
            }

            // Register new device
            const id = uuidv4();
            query.run(`
                INSERT INTO push_devices (id, user_id, token, platform, device_id, device_name, created_at, updated_at, last_active_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
            `, [id, user?.id || null, token, platform, deviceId, deviceName]);

            return {
                status: 201,
                data: { message: 'Device registered', deviceId: id }
            };
        } catch (error) {
            logger.error('[PushNotifications] Error registering device', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/notifications/unregister-device - Unregister device
    if (method === 'POST' && path === '/unregister-device') {
        try {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }

            const { token } = body;

            if (!token) {
                return { status: 400, data: { error: 'Token is required' } };
            }

            query.run('DELETE FROM push_devices WHERE token = ? AND user_id = ?', [token, user.id]);

            return { status: 200, data: { message: 'Device unregistered' } };
        } catch (error) {
            logger.error('[PushNotifications] Error unregistering device', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // Protected routes require authentication
    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // GET /api/notifications/devices - List user's registered devices
    if (method === 'GET' && path === '/devices') {
        try {
            const devices = query.all(`
                SELECT id, platform, device_name, created_at, last_active_at
                FROM push_devices
                WHERE user_id = ?
                ORDER BY last_active_at DESC
            `, [user.id]);

            return { status: 200, data: { devices: devices || [] } };
        } catch (error) {
            logger.error('[PushNotifications] Error listing devices', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/notifications/devices/:id - Remove a device
    if (method === 'DELETE' && path.match(/^\/devices\/[a-f0-9-]+$/)) {
        try {
            const deviceId = path.split('/')[2];

            query.run(
                'DELETE FROM push_devices WHERE id = ? AND user_id = ?',
                [deviceId, user.id]
            );

            return { status: 200, data: { message: 'Device removed' } };
        } catch (error) {
            logger.error('[PushNotifications] Error removing device', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/notifications/preferences - Get notification preferences
    if (method === 'GET' && path === '/preferences') {
        try {
            const prefs = query.get(`
                SELECT * FROM notification_preferences WHERE user_id = ?
            `, [user.id]);

            // Default preferences if none exist
            const defaults = {
                sales: true,
                offers: true,
                messages: true,
                inventory_alerts: true,
                marketing: false,
                weekly_digest: true,
                quiet_hours_enabled: false,
                quiet_hours_start: '22:00',
                quiet_hours_end: '08:00'
            };

            return {
                status: 200,
                data: { preferences: prefs || defaults }
            };
        } catch (error) {
            logger.error('[PushNotifications] Error fetching notification preferences', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/notifications/preferences - Update notification preferences
    if (method === 'PUT' && path === '/preferences') {
        try {
            const {
                sales, offers, messages, inventory_alerts, marketing,
                weekly_digest, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
            } = body;

            // Upsert preferences
            query.run(`
                INSERT INTO notification_preferences (
                    id, user_id, sales, offers, messages, inventory_alerts, marketing,
                    weekly_digest, quiet_hours_enabled, quiet_hours_start, quiet_hours_end,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET
                    sales = excluded.sales,
                    offers = excluded.offers,
                    messages = excluded.messages,
                    inventory_alerts = excluded.inventory_alerts,
                    marketing = excluded.marketing,
                    weekly_digest = excluded.weekly_digest,
                    quiet_hours_enabled = excluded.quiet_hours_enabled,
                    quiet_hours_start = excluded.quiet_hours_start,
                    quiet_hours_end = excluded.quiet_hours_end,
                    updated_at = datetime('now')
            `, [
                uuidv4(), user.id,
                sales ? 1 : 0, offers ? 1 : 0, messages ? 1 : 0,
                inventory_alerts ? 1 : 0, marketing ? 1 : 0, weekly_digest ? 1 : 0,
                quiet_hours_enabled ? 1 : 0, quiet_hours_start, quiet_hours_end
            ]);

            return { status: 200, data: { message: 'Preferences updated' } };
        } catch (error) {
            logger.error('[PushNotifications] Error updating notification preferences', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/notifications/send - Send web push notification to authenticated user
    if (method === 'POST' && path === '/send') {
        try {
            if (!user.is_admin) {
                return { status: 403, data: { error: 'Admin access required' } };
            }

            const { title, body: notificationBody, data, channel } = body;

            if (!title || !notificationBody) {
                return { status: 400, data: { error: 'title and body are required' } };
            }

            if (title.length > 200) {
                return { status: 400, data: { error: 'Title must be 200 characters or less' } };
            }
            if (notificationBody.length > 1000) {
                return { status: 400, data: { error: 'Body must be 1000 characters or less' } };
            }

            // SECURITY: IDOR fix — always send to the authenticated user only.
            const targetUserId = user.id;

            const subscriptions = query.all(
                'SELECT * FROM push_subscriptions WHERE user_id = ? AND is_active = 1',
                [targetUserId]
            );

            if (!subscriptions || subscriptions.length === 0) {
                return { status: 404, data: { error: 'No active push subscriptions for user' } };
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
                    query.run(
                        'UPDATE push_subscriptions SET last_used_at = datetime(\'now\') WHERE id = ?',
                        [sub.id]
                    );
                    sent++;
                } catch (pushError) {
                    logger.error('[PushNotifications] Delivery failed', targetUserId, { detail: pushError.message });
                    if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                        query.run(
                            'UPDATE push_subscriptions SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?',
                            [sub.id]
                        );
                    }
                }
            }

            const notificationId = uuidv4();
            query.run(`
                INSERT INTO push_notification_log (id, user_id, title, body, data, channel, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [notificationId, targetUserId, title, notificationBody, JSON.stringify(data || {}), channel || 'general', sent > 0 ? 'sent' : 'failed']);

            logger.info(`[Push] Notification dispatched to ${sent}/${subscriptions.length} subscription(s) for user ${targetUserId}`);

            return {
                status: 200,
                data: {
                    message: `Notification sent to ${sent} subscription(s)`,
                    notificationId,
                    sent,
                    total: subscriptions.length
                }
            };
        } catch (error) {
            logger.error('[PushNotifications] Error sending push notification', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // POST /api/notifications/send-batch - Send to multiple users (admin only)
    if (method === 'POST' && path === '/send-batch') {
        try {
            if (!user.is_admin) {
                return { status: 403, data: { error: 'Admin access required' } };
            }

            const { userIds, title, body: notificationBody, data, channel } = body;

            if (!userIds || !Array.isArray(userIds) || !title || !notificationBody) {
                return { status: 400, data: { error: 'userIds array, title, and body are required' } };
            }

            // Restrict to own user ID only — prevent cross-user notification injection
            const allowedIds = userIds.filter(id => id === user.id);
            if (allowedIds.length === 0) {
                return { status: 403, data: { error: 'Can only send notifications to your own devices' } };
            }

            const payload = JSON.stringify({
                title,
                body: notificationBody,
                data: data || {},
                timestamp: Date.now()
            });

            let usersNotified = 0;
            for (const userId of allowedIds) {
                const subscriptions = query.all(
                    'SELECT * FROM push_subscriptions WHERE user_id = ? AND is_active = 1 LIMIT 20',
                    [userId]
                );

                if (!subscriptions || subscriptions.length === 0) continue;

                let userSent = 0;
                for (const sub of subscriptions) {
                    try {
                        await webpush.sendNotification(
                            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                            payload
                        );
                        query.run(
                            'UPDATE push_subscriptions SET last_used_at = datetime(\'now\') WHERE id = ?',
                            [sub.id]
                        );
                        userSent++;
                    } catch (pushError) {
                        logger.error('[PushNotifications] Batch delivery failed', userId, { detail: pushError.message });
                        if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                            query.run(
                                'UPDATE push_subscriptions SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?',
                                [sub.id]
                            );
                        }
                    }
                }

                if (userSent > 0) {
                    const notificationId = uuidv4();
                    query.run(`
                        INSERT INTO push_notification_log (id, user_id, title, body, data, channel, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'sent', datetime('now'))
                    `, [notificationId, userId, title, notificationBody, JSON.stringify(data || {}), channel || 'general']);
                    usersNotified++;
                }
            }

            return {
                status: 200,
                data: { message: `Notifications sent to ${usersNotified} user(s)` }
            };
        } catch (error) {
            logger.error('[PushNotifications] Error sending batch push notifications', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Database migration
export const migration = `
-- Push notification devices
CREATE TABLE IF NOT EXISTS push_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    device_id TEXT,
    device_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_active_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_token ON push_devices(token);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    sales INTEGER DEFAULT 1,
    offers INTEGER DEFAULT 1,
    messages INTEGER DEFAULT 1,
    inventory_alerts INTEGER DEFAULT 1,
    marketing INTEGER DEFAULT 0,
    weekly_digest INTEGER DEFAULT 1,
    quiet_hours_enabled INTEGER DEFAULT 0,
    quiet_hours_start TEXT DEFAULT '22:00',
    quiet_hours_end TEXT DEFAULT '08:00',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Push notification log
CREATE TABLE IF NOT EXISTS push_notification_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    channel TEXT DEFAULT 'general',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON push_notification_log(user_id, created_at DESC);
`;

export default pushNotificationsRouter;
