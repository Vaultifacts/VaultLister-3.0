// Notifications API Routes for VaultLister
// Handles user notification CRUD operations

import {
    getNotifications,
    getUnreadNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from '../services/notificationService.js';
import { logger } from '../shared/logger.js';
import { cacheForUser } from '../middleware/cache.js';

export async function notificationsRouter(ctx) {
    const { method, path, body, user, query: queryParams } = ctx;

    // GET /api/notifications - Get all notifications (paginated)
    if (method === 'GET' && path === '/') {
        try {
            const page = parseInt(queryParams.page) || 1;
            const limit = Math.min(parseInt(queryParams.limit) || 20, 100);

            const result = getNotifications(user.id, { page, limit });

            return {
                status: 200,
                data: result,
                cacheControl: cacheForUser(10)
            };
        } catch (error) {
            logger.error('[Notifications] Error fetching notifications', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/notifications/unread - Get unread notifications
    if (method === 'GET' && path === '/unread') {
        try {
            const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
            const notifications = getUnreadNotifications(user.id, limit);

            return {
                status: 200,
                data: { notifications }
            };
        } catch (error) {
            logger.error('[Notifications] Error fetching unread notifications', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/notifications/count - Get unread count
    if (method === 'GET' && path === '/count') {
        try {
            const count = getUnreadCount(user.id);

            return {
                status: 200,
                data: { unreadCount: count }
            };
        } catch (error) {
            logger.error('[Notifications] Error fetching unread count', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/notifications/:id/read - Mark single notification as read
    if (method === 'PUT' && path.match(/^\/[^/]+\/read$/)) {
        try {
            const notificationId = path.split('/')[1];

            const success = markAsRead(notificationId, user.id);

            if (!success) {
                return {
                    status: 404,
                    data: { error: 'Notification not found' }
                };
            }

            return {
                status: 200,
                data: { success: true, message: 'Notification marked as read' }
            };
        } catch (error) {
            logger.error('[Notifications] Error marking notification as read', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // PUT /api/notifications/read-all - Mark all notifications as read
    if (method === 'PUT' && path === '/read-all') {
        try {
            const count = markAllAsRead(user.id);

            return {
                status: 200,
                data: { success: true, markedAsRead: count }
            };
        } catch (error) {
            logger.error('[Notifications] Error marking all notifications as read', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // DELETE /api/notifications/:id - Delete a notification
    if (method === 'DELETE' && path.match(/^\/[a-f0-9-]+$/)) {
        try {
            const notificationId = path.split('/')[1];

            const success = deleteNotification(notificationId, user.id);

            if (!success) {
                return {
                    status: 404,
                    data: { error: 'Notification not found' }
                };
            }

            return {
                status: 200,
                data: { success: true, message: 'Notification deleted' }
            };
        } catch (error) {
            logger.error('[Notifications] Error deleting notification', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
