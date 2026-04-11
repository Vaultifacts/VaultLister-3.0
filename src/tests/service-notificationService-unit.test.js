import { describe, expect, test, mock, beforeEach } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock();
const mockQueryRun = mock();

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  default: {}
}));

const {
  createNotification,
  getUnreadNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupOldNotifications,
  getUnreadCount,
  NotificationTypes,
  createOAuthNotification
} = await import('../backend/services/notificationService.js');

describe('notificationService', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryRun.mockReset();
  });

  describe('NotificationTypes', () => {
    test('has all 6 expected type constants', () => {
      expect(NotificationTypes.TOKEN_REFRESH_SUCCESS).toBe('token_refresh_success');
      expect(NotificationTypes.TOKEN_REFRESH_FAILED).toBe('token_refresh_failed');
      expect(NotificationTypes.OAUTH_DISCONNECTED).toBe('oauth_disconnected');
      expect(NotificationTypes.SYNC_COMPLETED).toBe('sync_completed');
      expect(NotificationTypes.SYNC_FAILED).toBe('sync_failed');
      expect(NotificationTypes.PLATFORM_ERROR).toBe('platform_error');
    });
  });

  describe('createNotification', () => {
    test('returns correct shape with all fields', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      const result = await createNotification('user-1', {
        type: 'info', title: 'Test', message: 'Hello'
      });
      expect(result).toHaveProperty('id');
      expect(result.user_id).toBe('user-1');
      expect(result.type).toBe('info');
      expect(result.title).toBe('Test');
      expect(result.message).toBe('Hello');
      expect(result.is_read).toBe(false);
      expect(result).toHaveProperty('created_at');
    });

    test('stringifies data when provided', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      await createNotification('user-1', {
        type: 'info', title: 'T', message: 'M', data: { key: 'val' }
      });
      expect(mockQueryRun.mock.calls[0][1][5]).toBe(JSON.stringify({ key: 'val' }));
    });

    test('passes null for data when not provided', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      await createNotification('user-1', { type: 'info', title: 'T', message: 'M' });
      expect(mockQueryRun.mock.calls[0][1][5]).toBeNull();
    });

    test('propagates DB errors', async () => {
      mockQueryRun.mockImplementation(() => { throw new Error('DB error'); });
      await expect(createNotification('user-1', {
        type: 'info', title: 'T', message: 'M'
      })).rejects.toThrow('DB error');
    });
  });

  describe('getUnreadNotifications', () => {
    test('returns parsed notifications with JSON data', async () => {
      mockQueryAll.mockReturnValue([
        { id: '1', type: 'info', is_read: 0, data: '{"key":"value"}' },
        { id: '2', type: 'warning', is_read: 0, data: null }
      ]);
      const notifs = await getUnreadNotifications('user-1');
      expect(notifs).toHaveLength(2);
      expect(notifs[0].data).toEqual({ key: 'value' });
      expect(notifs[0].is_read).toBe(false);
      expect(notifs[1].data).toBeNull();
    });

    test('returns empty array on DB error', async () => {
      mockQueryAll.mockImplementation(() => { throw new Error('DB error'); });
      expect(await getUnreadNotifications('user-1')).toEqual([]);
    });
  });

  describe('getNotifications', () => {
    test('returns paginated result', async () => {
      mockQueryAll.mockReturnValue([{ id: '1', type: 'info', is_read: 1, data: null }]);
      mockQueryGet.mockReturnValue({ count: 5 });
      const result = await getNotifications('user-1', { page: 1, limit: 20 });
      expect(result.notifications).toHaveLength(1);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.pages).toBe(1);
    });

    test('returns fallback on error', async () => {
      mockQueryAll.mockImplementation(() => { throw new Error('DB error'); });
      const result = await getNotifications('user-1');
      expect(result.notifications).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('markAsRead', () => {
    test('returns true when notification updated', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      expect(await markAsRead('n1', 'user-1')).toBe(true);
    });

    test('returns false when not found', async () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      expect(await markAsRead('nonexistent', 'user-1')).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    test('returns count of marked notifications', async () => {
      mockQueryRun.mockReturnValue({ changes: 3 });
      expect(await markAllAsRead('user-1')).toBe(3);
    });

    test('returns 0 on error', async () => {
      mockQueryRun.mockImplementation(() => { throw new Error('DB error'); });
      expect(await markAllAsRead('user-1')).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    test('returns true on success', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      expect(await deleteNotification('n1', 'user-1')).toBe(true);
    });

    test('returns false when not found', async () => {
      mockQueryRun.mockReturnValue({ changes: 0 });
      expect(await deleteNotification('x', 'user-1')).toBe(false);
    });
  });

  describe('cleanupOldNotifications', () => {
    test('returns deleted count', async () => {
      mockQueryRun.mockReturnValue({ changes: 10 });
      expect(await cleanupOldNotifications(30)).toBe(10);
    });

    test('defaults to 30 days', async () => {
      mockQueryRun.mockReturnValue({ changes: 5 });
      await cleanupOldNotifications();
      expect(mockQueryRun.mock.calls[0][1][0]).toBe(30);
    });
  });

  describe('getUnreadCount', () => {
    test('returns count from DB', async () => {
      mockQueryGet.mockReturnValue({ count: 7 });
      expect(await getUnreadCount('user-1')).toBe(7);
    });

    test('returns 0 on error', async () => {
      mockQueryGet.mockImplementation(() => { throw new Error('DB error'); });
      expect(await getUnreadCount('user-1')).toBe(0);
    });
  });

  describe('createOAuthNotification', () => {
    test('generates success message for TOKEN_REFRESH_SUCCESS', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      const result = await createOAuthNotification(
        'user-1', 'eBay', NotificationTypes.TOKEN_REFRESH_SUCCESS
      );
      expect(result.type).toBe('success');
      expect(result.title).toContain('eBay');
      expect(result.title).toContain('refreshed');
    });

    test('generates error message for TOKEN_REFRESH_FAILED', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      const result = await createOAuthNotification(
        'user-1', 'Poshmark', NotificationTypes.TOKEN_REFRESH_FAILED
      );
      expect(result.type).toBe('error');
      expect(result.title).toContain('failed');
    });

    test('sanitizes platform name against XSS', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      const result = await createOAuthNotification(
        'user-1', '<script>alert("xss")</script>', NotificationTypes.SYNC_COMPLETED
      );
      expect(result.title).not.toContain('<');
      expect(result.title).not.toContain('>');
    });

    test('falls back to generic for unknown type', async () => {
      mockQueryRun.mockReturnValue({ changes: 1 });
      const result = await createOAuthNotification('user-1', 'eBay', 'unknown_type');
      expect(result.type).toBe('info');
    });
  });
});
