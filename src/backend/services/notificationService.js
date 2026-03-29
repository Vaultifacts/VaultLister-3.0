// Notification Service for VaultLister
// Creates and manages user notifications for OAuth events, sync status, etc.

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

/**
 * Create a notification for a user
 * @param {string} userId - User ID
 * @param {Object} options - Notification options
 * @param {string} options.type - Notification type (info, warning, error, success)
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {Object} [options.data] - Additional data to store
 * @returns {Object} Created notification
 */
export async function createNotification(userId, { type, title, message, data = null }) {
    const id = uuidv4();

    try {
        await query.run(`
            INSERT INTO notifications (id, user_id, type, title, message, data)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, userId, type, title, message, data ? JSON.stringify(data) : null]);

        return {
            id,
            user_id: userId,
            type,
            title,
            message,
            data,
            is_read: false,
            created_at: new Date().toISOString()
        };
    } catch (error) {
        logger.error('[NotificationService] Failed to create notification', null, { detail: error.message });
        throw error;
    }
}

/**
 * Get unread notifications for a user
 * @param {string} userId - User ID
 * @param {number} [limit=50] - Maximum notifications to return
 * @returns {Array} Unread notifications
 */
export async function getUnreadNotifications(userId, limit = 50) {
    try {
        const notifications = await query.all(`
            SELECT * FROM notifications
            WHERE user_id = ? AND is_read = FALSE
            ORDER BY created_at DESC
            LIMIT ?
        `, [userId, limit]);

        return notifications.map(n => ({
            ...n,
            data: n.data ? JSON.parse(n.data) : null,
            is_read: Boolean(n.is_read)
        }));
    } catch (error) {
        logger.error('[NotificationService] Failed to get notifications', null, { detail: error.message });
        return [];
    }
}

/**
 * Get all notifications for a user (paginated)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Object} Paginated notifications
 */
export async function getNotifications(userId, { page = 1, limit = 20 } = {}) {
    try {
        const offset = (page - 1) * limit;

        const notifications = await query.all(`
            SELECT * FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, limit, offset]);

        const total = Number((await query.get(`
            SELECT COUNT(*) as count FROM notifications WHERE user_id = ?
        `, [userId]))?.count) || 0;

        return {
            notifications: notifications.map(n => ({
                ...n,
                data: n.data ? JSON.parse(n.data) : null,
                is_read: Boolean(n.is_read)
            })),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('[NotificationService] Failed to get notifications', null, { detail: error.message });
        return { notifications: [], pagination: { page, limit, total: 0, pages: 0 } };
    }
}

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for validation)
 * @returns {boolean} Success status
 */
export async function markAsRead(notificationId, userId) {
    try {
        const result = await query.run(`
            UPDATE notifications
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `, [notificationId, userId]);

        return result.changes > 0;
    } catch (error) {
        logger.error('[NotificationService] Failed to mark notification as read', null, { detail: error.message });
        return false;
    }
}

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {number} Number of notifications marked as read
 */
export async function markAllAsRead(userId) {
    try {
        const result = await query.run(`
            UPDATE notifications
            SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND is_read = FALSE
        `, [userId]);

        return result.changes;
    } catch (error) {
        logger.error('[NotificationService] Failed to mark all notifications as read', null, { detail: error.message });
        return 0;
    }
}

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for validation)
 * @returns {boolean} Success status
 */
export async function deleteNotification(notificationId, userId) {
    try {
        const result = await query.run(`
            DELETE FROM notifications WHERE id = ? AND user_id = ?
        `, [notificationId, userId]);

        return result.changes > 0;
    } catch (error) {
        logger.error('[NotificationService] Failed to delete notification', null, { detail: error.message });
        return false;
    }
}

/**
 * Delete old read notifications (cleanup job)
 * @param {number} [daysOld=30] - Delete notifications older than this many days
 * @returns {number} Number of deleted notifications
 */
export async function cleanupOldNotifications(daysOld = 30) {
    try {
        const result = await query.run(`
            DELETE FROM notifications
            WHERE is_read = TRUE AND created_at < NOW() - (?::text || ' days')::interval
        `, [daysOld]);

        return result.changes;
    } catch (error) {
        logger.error('[NotificationService] Failed to cleanup old notifications', null, { detail: error.message });
        return 0;
    }
}

/**
 * Get unread count for a user
 * @param {string} userId - User ID
 * @returns {number} Unread notification count
 */
export async function getUnreadCount(userId) {
    try {
        const result = await query.get(`
            SELECT COUNT(*) as count FROM notifications
            WHERE user_id = ? AND is_read = FALSE
        `, [userId]);

        return result?.count || 0;
    } catch (error) {
        logger.error('[NotificationService] Failed to get unread count', null, { detail: error.message });
        return 0;
    }
}

// Pre-defined notification types for OAuth events
export const NotificationTypes = {
    TOKEN_REFRESH_SUCCESS: 'token_refresh_success',
    TOKEN_REFRESH_FAILED: 'token_refresh_failed',
    OAUTH_DISCONNECTED: 'oauth_disconnected',
    SYNC_COMPLETED: 'sync_completed',
    SYNC_FAILED: 'sync_failed',
    PLATFORM_ERROR: 'platform_error',
    AUTOMATION_COMPLETED: 'automation_completed',
    AUTOMATION_FAILED: 'automation_failed',
    AUTOMATION_PARTIAL: 'automation_partial'
};

/**
 * Create OAuth-related notification
 * @param {string} userId - User ID
 * @param {string} platform - Platform name
 * @param {string} notificationType - Type from NotificationTypes
 * @param {Object} [extraData] - Additional data
 */
export async function createOAuthNotification(userId, platform, notificationType, extraData = {}) {
    // Sanitize external values to prevent injection
    const safePlatform = String(platform || '').replace(/[<>&"']/g, '').substring(0, 50);
    const safeError = extraData.error ? String(extraData.error).replace(/[<>&"']/g, '').substring(0, 200) : '';
    const safeMessage = extraData.message ? String(extraData.message).replace(/[<>&"']/g, '').substring(0, 200) : '';

    const messages = {
        [NotificationTypes.TOKEN_REFRESH_SUCCESS]: {
            type: 'success',
            title: `${safePlatform} token refreshed`,
            message: `Your ${safePlatform} connection has been automatically refreshed.`
        },
        [NotificationTypes.TOKEN_REFRESH_FAILED]: {
            type: 'error',
            title: `${safePlatform} token refresh failed`,
            message: `We couldn't refresh your ${safePlatform} connection. Please reconnect.`
        },
        [NotificationTypes.OAUTH_DISCONNECTED]: {
            type: 'warning',
            title: `${safePlatform} disconnected`,
            message: `Your ${safePlatform} connection was disconnected due to repeated failures.`
        },
        [NotificationTypes.SYNC_COMPLETED]: {
            type: 'success',
            title: `${safePlatform} sync completed`,
            message: `Successfully synced data from ${safePlatform}.`
        },
        [NotificationTypes.SYNC_FAILED]: {
            type: 'error',
            title: `${safePlatform} sync failed`,
            message: `Failed to sync data from ${safePlatform}. ${safeError}`
        },
        [NotificationTypes.PLATFORM_ERROR]: {
            type: 'error',
            title: `${safePlatform} error`,
            message: safeMessage || `An error occurred with your ${safePlatform} connection.`
        },
        [NotificationTypes.AUTOMATION_COMPLETED]: {
            type: 'success',
            title: `Automation completed`,
            message: safeMessage || `Automation ran successfully.`
        },
        [NotificationTypes.AUTOMATION_FAILED]: {
            type: 'error',
            title: `Automation failed`,
            message: safeMessage || `An automation failed. ${safeError}`
        },
        [NotificationTypes.AUTOMATION_PARTIAL]: {
            type: 'warning',
            title: `Automation partially completed`,
            message: safeMessage || `An automation completed with some failures.`
        }
    };

    const notification = messages[notificationType] || {
        type: 'info',
        title: `${safePlatform} notification`,
        message: 'Platform notification'
    };

    return createNotification(userId, {
        ...notification,
        data: { platform, notificationType, ...extraData }
    });
}
