import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

const mockQueryGet = mock();
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
  query: {
        get: mockQueryGet, all: mockQueryAll, run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
  models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
  escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
  cleanupExpiredData: mock(() => ({})),
  initializeDatabase: mock(() => true),
  default: {}
}));

// Mock external email services — include ALL exports to prevent cross-file contamination
mock.module('../backend/services/gmailService.js', () => ({
  refreshGmailToken: mock(() => Promise.resolve({ access_token: 'refreshed', expires_in: 3600 })),
  fetchRecentEmails: mock(() => Promise.resolve([])),
  getEmailContent: mock(() => Promise.resolve({})),
  parseGmailMessage: mock(() => ({ from: '', subject: '', date: '', body: '' })),
  getAttachment: mock(() => Promise.resolve('')),
  getUserEmail: mock(() => Promise.resolve('mock@test.com')),
  base64UrlToBase64: mock((d) => d)
}));

mock.module('../backend/services/outlookService.js', () => ({
  refreshOutlookToken: mock(() => Promise.resolve({ access_token: 'refreshed', expires_in: 3600 })),
  fetchRecentEmails: mock(() => Promise.resolve([])),
  getEmailContent: mock(() => Promise.resolve({})),
  parseOutlookMessage: mock(() => ({ from: '', subject: '', date: '', body: '' })),
  getUserEmail: mock(() => Promise.resolve('mock@test.com')),
  getMockOutlookEmails: mock(() => [])
}));

mock.module('../backend/services/receiptDetector.js', () => ({
  DEFAULT_RECEIPT_SENDERS: [],
  RECEIPT_SUBJECT_PATTERNS: [],
  detectReceipt: mock(() => ({ isReceipt: false, confidence: 0 })),
  buildSenderQuery: mock(() => ''),
  extractVendorName: mock(() => 'Unknown'),
  inferReceiptType: mock(() => 'purchase')
}));

// Do NOT mock encryption.js or notificationService.js — contamination risk

import { encryptToken } from '../backend/utils/encryption.js';

const {
  startEmailPollingWorker,
  stopEmailPollingWorker,
  syncEmailAccount,
  getEmailPollingStatus
} = await import('../backend/workers/emailPollingWorker.js');

afterAll(() => { stopEmailPollingWorker(); });

describe('emailPollingWorker (unit)', () => {

  beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
  });

  describe('getEmailPollingStatus', () => {
    test('returns expected shape', async () => {
      mockQueryGet.mockReturnValue({
        total_accounts: 3, enabled_accounts: 2,
        syncing_accounts: 0, error_accounts: 1
      });
      const status = await getEmailPollingStatus();
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('intervalMs');
      expect(status).toHaveProperty('lastRun');
      expect(status.total_accounts).toBe(3);
      expect(status.enabled_accounts).toBe(2);
    });

    test('running false when stopped', async () => {
      stopEmailPollingWorker();
      mockQueryGet.mockReturnValue({ total_accounts: 0 });
      expect((await getEmailPollingStatus()).running).toBe(false);
    });

    test('intervalMs defaults to 5 minutes', async () => {
      mockQueryGet.mockReturnValue({});
      const status = await getEmailPollingStatus();
      expect(status.intervalMs).toBe(5 * 60 * 1000);
    });
  });

  describe('syncEmailAccount', () => {
    test('syncs account with no new emails', async () => {
      const encryptedToken = encryptToken('test-access-token');
      const account = {
        id: 'acc-1', user_id: 'user-1',
        oauth_token: encryptedToken,
        oauth_refresh_token: encryptedToken,
        oauth_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        provider: 'gmail', filter_senders: '[]',
        last_message_id: null, consecutive_failures: 0
      };

      const result = await syncEmailAccount(account);
      expect(result.success).toBe(true);
      expect(result.receiptsFound).toBe(0);
    });

    test('marks account as syncing then idle', async () => {
      const encryptedToken = encryptToken('test-token');
      const account = {
        id: 'acc-2', user_id: 'user-1',
        oauth_token: encryptedToken,
        oauth_refresh_token: encryptedToken,
        oauth_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        provider: 'gmail', filter_senders: '[]',
        last_message_id: null, consecutive_failures: 0
      };

      await syncEmailAccount(account);
      const calls = mockQueryRun.mock.calls;
      // First call: mark syncing
      expect(calls[0][0]).toContain('syncing');
      // Last call: mark idle
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain('idle');
    });

    test('records failure on decrypt error', async () => {
      const account = {
        id: 'acc-3', user_id: 'user-1',
        oauth_token: 'invalid-not-encrypted',
        oauth_refresh_token: 'invalid',
        oauth_token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        provider: 'gmail', filter_senders: '[]',
        last_message_id: null, consecutive_failures: 0
      };

      try {
        await syncEmailAccount(account);
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeDefined();
      }
      // Should have recorded error status
      const errorCall = mockQueryRun.mock.calls.find(c => c[0].includes('error'));
      expect(errorCall).toBeTruthy();
    });
  });
});
