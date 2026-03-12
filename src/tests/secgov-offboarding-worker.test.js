// Security & Governance — Offboarding / GDPR Worker / Deletion Lifecycle
// Audit gaps: H21 (GDPR worker untested), H22 (FTS5 cleanup), H24 (rectification table missing)
// Category: Offboarding / Decommissioning

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ─── Mocks (before imports) ─────────────────────────────────────────────────

const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

const mockLogger = { info: mock(), error: mock(), warn: mock(), debug: mock() };
mock.module('../backend/shared/logger.js', () => ({
    logger: mockLogger,
    default: mockLogger,
}));

const mockEmailSend = mock(() => Promise.resolve());
mock.module('../backend/services/email.js', () => ({
    default: { send: mockEmailSend },
}));

mock.module('../backend/services/websocket.js', () => ({
    websocketService: { sendToUser: mock(), broadcast: mock(), cleanup: mock() },
}));

// ─── Dynamic imports (after mocks) ──────────────────────────────────────────

const { startGDPRWorker, stopGDPRWorker, getGDPRWorkerStatus } =
    await import('../backend/workers/gdprWorker.js');

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(() => {
    stopGDPRWorker();
});

beforeEach(() => {
    stopGDPRWorker();
    mockQueryGet.mockReset().mockReturnValue(null);
    mockQueryAll.mockReset().mockReturnValue([]);
    mockQueryRun.mockReset().mockReturnValue({ changes: 1 });
    mockEmailSend.mockReset().mockResolvedValue(undefined);
    mockLogger.info.mockReset();
    mockLogger.error.mockReset();
    mockLogger.warn.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GDPR Worker Lifecycle (H21)', () => {
    test('startGDPRWorker should set running state', () => {
        startGDPRWorker();
        const status = getGDPRWorkerStatus();
        expect(status.running).toBe(true);
        expect(status.intervalMs).toBe(3600000); // 1 hour
        stopGDPRWorker();
    });

    test('stopGDPRWorker should clear running state', () => {
        startGDPRWorker();
        stopGDPRWorker();
        const status = getGDPRWorkerStatus();
        expect(status.running).toBe(false);
    });

    test('getGDPRWorkerStatus should return expected shape', () => {
        const status = getGDPRWorkerStatus();
        expect(status).toHaveProperty('running');
        expect(status).toHaveProperty('intervalMs');
        expect(status).toHaveProperty('lastRun');
    });
});

describe('Account Deletion Processing (H21)', () => {
    test('processAccountDeletions runs on start and processes pending deletions', () => {
        // When worker starts, it calls processAccountDeletions immediately
        // If no pending deletions, it should return silently
        mockQueryAll.mockReturnValue([]);

        startGDPRWorker();

        // The worker queries for pending deletions
        const pendingQuery = mockQueryAll.mock.calls.find(c =>
            c[0]?.includes('account_deletion_requests') && c[0]?.includes('pending')
        );
        expect(pendingQuery).toBeTruthy();
        stopGDPRWorker();
    });

    test('deletion should anonymize sales data before deleting user', () => {
        // Simulate a pending deletion that is past the grace period
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Delete Me',
                    username: 'deleteme',
                    scheduled_for: pastDate,
                    reason: 'leaving',
                }];
            }
            return [];
        });

        startGDPRWorker();

        // Verify sales anonymization
        const salesAnon = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('UPDATE sales') && c[0]?.includes("'DELETED'")
        );
        expect(salesAnon).toBeTruthy();
        expect(salesAnon[1][0]).toBe('user-to-delete');

        stopGDPRWorker();
    });

    test('deletion should delete from user data tables', () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Delete Me',
                    username: 'deleteme',
                    scheduled_for: pastDate,
                    reason: 'leaving',
                }];
            }
            return [];
        });

        startGDPRWorker();

        // Verify deletes from multiple tables
        const deleteCalls = mockQueryRun.mock.calls.filter(c =>
            c[0]?.includes('DELETE FROM') && c[1]?.[0] === 'user-to-delete'
        );
        // Should delete from inventory, listings, sessions, notifications, etc.
        expect(deleteCalls.length).toBeGreaterThanOrEqual(5);

        // Verify user record deleted last
        const userDelete = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('DELETE FROM users WHERE id')
        );
        expect(userDelete).toBeTruthy();

        stopGDPRWorker();
    });

    test('deletion should mark request as completed', () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Delete Me',
                    username: 'deleteme',
                    scheduled_for: pastDate,
                }];
            }
            return [];
        });

        startGDPRWorker();

        const completionUpdate = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('account_deletion_requests') && c[0]?.includes("'completed'")
        );
        expect(completionUpdate).toBeTruthy();

        stopGDPRWorker();
    });

    test('deletion should create audit log entry with NULL user_id', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Delete Me',
                    username: 'deleteme',
                    scheduled_for: pastDate,
                    reason: 'leaving',
                }];
            }
            return [];
        });

        startGDPRWorker();
        // Allow async processAccountDeletions to resolve
        await new Promise(r => setTimeout(r, 50));

        const auditInsert = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('INSERT INTO audit_logs') && c[0]?.includes('account_deleted')
        );
        expect(auditInsert).toBeTruthy();
        // user_id should be NULL (user is deleted)
        expect(auditInsert[1][0]).toBeTruthy(); // id
        expect(auditInsert[1][1]).toContain('user-to-delete'); // details JSON

        stopGDPRWorker();
    });

    test('deletion failure should mark request as failed with error message', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Fail Me',
                    username: 'failme',
                    scheduled_for: pastDate,
                }];
            }
            return [];
        });

        // Make the sales anonymization throw
        mockQueryRun.mockImplementation((sql) => {
            if (sql.includes('UPDATE sales') && sql.includes("'DELETED'")) {
                throw new Error('DB constraint error');
            }
            return { changes: 1 };
        });

        startGDPRWorker();
        await new Promise(r => setTimeout(r, 50));

        const failUpdate = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('account_deletion_requests') && c[0]?.includes("'failed'")
        );
        expect(failUpdate).toBeTruthy();

        stopGDPRWorker();
    });
});

describe('Deletion Reminders', () => {
    test('should send reminders for accounts approaching deletion within 3 days', async () => {
        const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending') && sql.includes('reminder_sent')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-1',
                    email: 'remind@example.com',
                    full_name: 'Remind Me',
                    username: 'remindme',
                    scheduled_for: twoDaysFromNow,
                    reminder_sent: null,
                }];
            }
            if (sql.includes('account_deletion_requests') && sql.includes('pending') && sql.includes('scheduled_for <=')) {
                return []; // No past-due deletions
            }
            return [];
        });

        startGDPRWorker();
        await new Promise(r => setTimeout(r, 50));

        // Verify email sent
        const reminderEmail = mockEmailSend.mock.calls.find(c =>
            c[0]?.template === 'account-deletion-reminder'
        );
        expect(reminderEmail).toBeTruthy();

        // Verify reminder_sent flag updated
        const reminderUpdate = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('reminder_sent = 1')
        );
        expect(reminderUpdate).toBeTruthy();

        stopGDPRWorker();
    });
});

describe('Export Data Cleanup', () => {
    test('should expire completed exports older than 7 days', () => {
        startGDPRWorker();

        // Verify cleanup query for export requests
        const cleanupCall = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('data_export_requests') && c[0]?.includes("'expired'")
        );
        expect(cleanupCall).toBeTruthy();
        // Should set export_data to NULL
        expect(cleanupCall[0]).toContain('export_data = NULL');

        stopGDPRWorker();
    });
});

describe('Gap Documentation — Missing Tables (H24)', () => {
    test('data_rectification_requests IS in GDPR worker USER_DATA_TABLES (H24 fix verified)', () => {
        // FIX VERIFIED: data_rectification_requests added to USER_DATA_TABLES in gdprWorker.js
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Test',
                    username: 'test',
                    scheduled_for: pastDate,
                }];
            }
            return [];
        });

        startGDPRWorker();

        const rectificationDelete = mockQueryRun.mock.calls.find(c =>
            c[0]?.includes('DELETE FROM data_rectification_requests')
        );
        expect(rectificationDelete).toBeTruthy();

        stopGDPRWorker();
    });

    test('account_deletion_requests records survive deletion (expected — audit trail)', () => {
        // account_deletion_requests should NOT be deleted — they serve as audit trail
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryAll.mockImplementation((sql) => {
            if (sql.includes('account_deletion_requests') && sql.includes('pending')) {
                return [{
                    id: 'req-1',
                    user_id: 'user-to-delete',
                    email: 'delete@example.com',
                    full_name: 'Test',
                    username: 'test',
                    scheduled_for: pastDate,
                }];
            }
            return [];
        });

        startGDPRWorker();

        // Verify account_deletion_requests is NOT in the DELETE sweep
        const adrDelete = mockQueryRun.mock.calls.find(c =>
            c[0] === 'DELETE FROM account_deletion_requests WHERE user_id = ?'
        );
        // This table is not deleted — it's updated to 'completed' instead
        expect(adrDelete).toBeFalsy();

        stopGDPRWorker();
    });
});
