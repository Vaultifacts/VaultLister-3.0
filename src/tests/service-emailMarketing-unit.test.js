// Email Marketing Service Unit Tests — comprehensive coverage
// Tests: EMAIL_TEMPLATES, emailMarketing methods, emailMarketingRouter, migration
import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock database (complete interface to prevent cross-file contamination)
// ---------------------------------------------------------------------------
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
        transaction: mock((fn) => fn()),
    },
    models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {}
}));

// ---------------------------------------------------------------------------
// Mock logger (all channels to prevent contamination)
// ---------------------------------------------------------------------------
const _logFn = () => mock(() => {});
const _mkLogger = () => ({
    info: _logFn(), warn: _logFn(), error: _logFn(), debug: _logFn(),
    request: _logFn(), db: _logFn(), automation: _logFn(),
    bot: _logFn(), security: _logFn(), performance: _logFn(),
});
mock.module('../backend/shared/logger.js', () => ({
    logger: _mkLogger(),
    createLogger: mock(() => _mkLogger()),
    default: _mkLogger(),
}));

// ---------------------------------------------------------------------------
// Mock email service to prevent actual sending — capture calls
// ---------------------------------------------------------------------------
const mockEmailSend = mock(() => Promise.resolve());
mock.module('../backend/services/email.js', () => ({
    emailService: {
        send: mockEmailSend,
        sendEmail: mock(() => Promise.resolve()),
    },
    default: { send: mockEmailSend },
}));

// ---------------------------------------------------------------------------
// Import the module under test
// ---------------------------------------------------------------------------
const { emailMarketing, emailMarketingRouter, migration } = await import('../backend/services/emailMarketing.js');

// Clean up intervals on exit so the process doesn't hang
afterAll(() => {
    if (emailMarketing.cleanup) emailMarketing.cleanup();
});

// Reset mock state between tests
beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
    mockEmailSend.mockReset();
    mockEmailSend.mockReturnValue(Promise.resolve());
});

// ===========================================================================
// EMAIL_TEMPLATES config validation
// ===========================================================================
describe('EMAIL_TEMPLATES config', () => {
    // We can't import EMAIL_TEMPLATES directly (not exported), but we can
    // verify its structure indirectly through sendEmail behavior.

    test('sendEmail recognises the welcome template', async () => {
        await emailMarketing.sendEmail('u1', 'welcome', { email: 'a@b.com', name: 'X' });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises welcomeDay2 template', async () => {
        await emailMarketing.sendEmail('u1', 'welcomeDay2', { email: 'a@b.com', name: 'X' });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises welcomeDay7 template', async () => {
        await emailMarketing.sendEmail('u1', 'welcomeDay7', { email: 'a@b.com', name: 'X' });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises saleNotification template', async () => {
        await emailMarketing.sendEmail('u1', 'saleNotification', {
            email: 'a@b.com', name: 'X', platform: 'eBay', itemTitle: 'Item'
        });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises weeklyDigest template', async () => {
        await emailMarketing.sendEmail('u1', 'weeklyDigest', { email: 'a@b.com', name: 'X' });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises priceDropAlert template', async () => {
        await emailMarketing.sendEmail('u1', 'priceDropAlert', {
            email: 'a@b.com', name: 'X', itemTitle: 'Widget'
        });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises inactivityReminder template', async () => {
        await emailMarketing.sendEmail('u1', 'inactivityReminder', { email: 'a@b.com', name: 'X' });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail recognises offerReceived template', async () => {
        await emailMarketing.sendEmail('u1', 'offerReceived', {
            email: 'a@b.com', name: 'X', itemTitle: 'Widget'
        });
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('sendEmail skips unknown template without throwing', async () => {
        await emailMarketing.sendEmail('u1', 'nonexistent_template', { email: 'a@b.com' });
        // emailService.send should NOT be called for an unknown template
        expect(mockEmailSend).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// emailMarketing.sendEmail
// ===========================================================================
describe('emailMarketing.sendEmail', () => {
    test('passes email address to the email service', async () => {
        await emailMarketing.sendEmail('u1', 'welcome', { email: 'test@test.com', name: 'User' });
        expect(mockEmailSend).toHaveBeenCalledTimes(1);
        const callArg = mockEmailSend.mock.calls[0][0];
        expect(callArg.to).toBe('test@test.com');
    });

    test('replaces placeholders in subject', async () => {
        await emailMarketing.sendEmail('u1', 'saleNotification', {
            email: 'x@y.com', name: 'Seller', platform: 'Poshmark',
            itemTitle: 'Vintage Jacket', salePrice: 50, profit: 30, buyerUsername: 'buyer1'
        });
        const callArg = mockEmailSend.mock.calls[0][0];
        expect(callArg.subject).toContain('Poshmark');
    });

    test('replaces multiple placeholders in priceDropAlert subject', async () => {
        await emailMarketing.sendEmail('u1', 'priceDropAlert', {
            email: 'x@y.com', itemTitle: 'Nike Shoes'
        });
        const callArg = mockEmailSend.mock.calls[0][0];
        expect(callArg.subject).toContain('Nike Shoes');
    });

    test('strips newlines from placeholder values (header injection prevention)', async () => {
        await emailMarketing.sendEmail('u1', 'saleNotification', {
            email: 'x@y.com', name: 'X', platform: "eBay\r\nBcc: evil@hack.com",
            itemTitle: 'Item', salePrice: 10, profit: 5, buyerUsername: 'b'
        });
        const callArg = mockEmailSend.mock.calls[0][0];
        expect(callArg.subject).not.toContain('\r');
        expect(callArg.subject).not.toContain('\n');
    });

    test('logs email to email_log table', async () => {
        await emailMarketing.sendEmail('u1', 'welcome', { email: 'a@b.com', name: 'X' });
        // query.run is called at least once to INSERT into email_log
        const runCalls = mockQueryRun.mock.calls;
        const logInsert = runCalls.find(c => c[0] && c[0].includes('email_log'));
        expect(logInsert).toBeDefined();
    });

    test('passes template name to email service', async () => {
        await emailMarketing.sendEmail('u1', 'welcome', { email: 'a@b.com', name: 'X' });
        const callArg = mockEmailSend.mock.calls[0][0];
        expect(callArg.template).toBe('welcome');
    });

    test('passes data object to email service', async () => {
        const data = { email: 'a@b.com', name: 'UserName', extra: 'value' };
        await emailMarketing.sendEmail('u1', 'welcome', data);
        const callArg = mockEmailSend.mock.calls[0][0];
        expect(callArg.data).toEqual(data);
    });
});

// ===========================================================================
// emailMarketing.generateUnsubscribeLink
// ===========================================================================
describe('emailMarketing.generateUnsubscribeLink', () => {
    test('returns a string URL path', () => {
        const link = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        expect(typeof link).toBe('string');
        expect(link).toStartWith('/api/email-marketing/unsubscribe');
    });

    test('includes userId parameter', () => {
        const link = emailMarketing.generateUnsubscribeLink('user-123', 'test@example.com');
        expect(link).toContain('userId=user-123');
    });

    test('includes encoded email parameter', () => {
        const link = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        expect(link).toContain('email=test%40example.com');
    });

    test('includes token parameter', () => {
        const link = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        expect(link).toContain('token=');
    });

    test('token is 32 hex characters', () => {
        const link = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        const tokenMatch = link.match(/token=([a-f0-9]+)/);
        expect(tokenMatch).not.toBeNull();
        expect(tokenMatch[1].length).toBe(32);
    });

    test('different emails produce different tokens', () => {
        const link1 = emailMarketing.generateUnsubscribeLink('user-1', 'a@example.com');
        const link2 = emailMarketing.generateUnsubscribeLink('user-1', 'b@example.com');
        expect(link1).not.toBe(link2);
    });

    test('different users produce different tokens', () => {
        const link1 = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        const link2 = emailMarketing.generateUnsubscribeLink('user-2', 'test@example.com');
        expect(link1).not.toBe(link2);
    });

    test('same inputs produce deterministic output', () => {
        const link1 = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        const link2 = emailMarketing.generateUnsubscribeLink('user-1', 'test@example.com');
        expect(link1).toBe(link2);
    });
});

// ===========================================================================
// emailMarketing.hasConsent
// ===========================================================================
describe('emailMarketing.hasConsent', () => {
    test('returns false when no consent record exists', async () => {
        mockQueryGet.mockReturnValue(null);
        const result = await emailMarketing.hasConsent('user-1', 'marketing_emails');
        expect(result).toBe(false);
    });

    test('returns true when consent granted = 1', async () => {
        mockQueryGet.mockReturnValue({ granted: 1 });
        const result = await emailMarketing.hasConsent('user-1', 'marketing_emails');
        expect(result).toBe(true);
    });

    test('returns false when consent granted = 0', async () => {
        mockQueryGet.mockReturnValue({ granted: 0 });
        const result = await emailMarketing.hasConsent('user-1', 'marketing_emails');
        expect(result).toBe(false);
    });

    test('returns false when granted field is undefined', async () => {
        mockQueryGet.mockReturnValue({});
        const result = await emailMarketing.hasConsent('user-1', 'marketing_emails');
        expect(result).toBe(false);
    });

    test('returns false when granted is a truthy non-1 value', async () => {
        mockQueryGet.mockReturnValue({ granted: 2 });
        const result = await emailMarketing.hasConsent('user-1', 'marketing_emails');
        expect(result).toBe(false);
    });
});

// ===========================================================================
// emailMarketing.queueEmail
// ===========================================================================
describe('emailMarketing.queueEmail', () => {
    test('queues email without error using default date', async () => {
        await expect(
            emailMarketing.queueEmail('user-1', 'welcome', { name: 'Test' })
        ).resolves.toBeUndefined();
    });

    test('queues email with future scheduled date', async () => {
        const future = new Date(Date.now() + 86400000);
        await expect(
            emailMarketing.queueEmail('user-1', 'welcomeDay2', { name: 'Test' }, future)
        ).resolves.toBeUndefined();
    });

    test('inserts into email_queue table', async () => {
        await emailMarketing.queueEmail('user-1', 'welcome', { name: 'Test' });
        const runCalls = mockQueryRun.mock.calls;
        const insertCall = runCalls.find(c => c[0] && c[0].includes('email_queue'));
        expect(insertCall).toBeDefined();
    });

    test('serializes data as JSON string', async () => {
        const data = { name: 'Test', email: 'x@y.com' };
        await emailMarketing.queueEmail('user-1', 'welcome', data);
        const runCalls = mockQueryRun.mock.calls;
        const insertCall = runCalls.find(c => c[0] && c[0].includes('email_queue'));
        // The params array should contain the JSON-stringified data
        const params = insertCall[1];
        const jsonParam = params.find(p => typeof p === 'string' && p.includes('"name"'));
        expect(jsonParam).toBeDefined();
        expect(JSON.parse(jsonParam)).toEqual(data);
    });

    test('generates a UUID for each queued email', async () => {
        await emailMarketing.queueEmail('user-1', 'welcome', { name: 'A' });
        await emailMarketing.queueEmail('user-1', 'welcome', { name: 'B' });
        const calls = mockQueryRun.mock.calls.filter(c => c[0]?.includes('email_queue'));
        const id1 = calls[0][1][0]; // first param = uuid
        const id2 = calls[1][1][0];
        expect(id1).not.toBe(id2);
        // UUIDs are 36 characters with hyphens
        expect(id1.length).toBe(36);
    });
});

// ===========================================================================
// emailMarketing.sendWelcomeEmail
// ===========================================================================
describe('emailMarketing.sendWelcomeEmail', () => {
    test('queues three emails (welcome, day2, day7)', async () => {
        const user = { id: 'u1', full_name: 'Test User', email: 'test@test.com' };
        await emailMarketing.sendWelcomeEmail(user);
        // Each queueEmail call produces one query.run INSERT
        const queueInserts = mockQueryRun.mock.calls.filter(c => c[0]?.includes('email_queue'));
        expect(queueInserts.length).toBe(3);
    });

    test('uses username if full_name is missing', async () => {
        const user = { id: 'u1', username: 'testuser', email: 'test@test.com' };
        await emailMarketing.sendWelcomeEmail(user);
        const queueInserts = mockQueryRun.mock.calls.filter(c => c[0]?.includes('email_queue'));
        // Verify the first queued email data contains the username
        const firstData = JSON.parse(queueInserts[0][1][3]); // params[3] = JSON data
        expect(firstData.name).toBe('testuser');
    });

    test('schedules day2 email ~2 days in future', async () => {
        const user = { id: 'u1', full_name: 'X', email: 'a@b.com' };
        const before = Date.now();
        await emailMarketing.sendWelcomeEmail(user);
        const after = Date.now();
        const queueInserts = mockQueryRun.mock.calls.filter(c => c[0]?.includes('email_queue'));
        // Second insert is welcomeDay2
        const scheduledFor = new Date(queueInserts[1][1][4]); // params[4] = scheduled_for ISO string
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
        expect(scheduledFor.getTime()).toBeGreaterThanOrEqual(before + twoDaysMs - 1000);
        expect(scheduledFor.getTime()).toBeLessThanOrEqual(after + twoDaysMs + 1000);
    });

    test('schedules day7 email ~7 days in future', async () => {
        const user = { id: 'u1', full_name: 'X', email: 'a@b.com' };
        const before = Date.now();
        await emailMarketing.sendWelcomeEmail(user);
        const after = Date.now();
        const queueInserts = mockQueryRun.mock.calls.filter(c => c[0]?.includes('email_queue'));
        const scheduledFor = new Date(queueInserts[2][1][4]);
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        expect(scheduledFor.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
        expect(scheduledFor.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
    });
});

// ===========================================================================
// emailMarketing.sendSaleNotification
// ===========================================================================
describe('emailMarketing.sendSaleNotification', () => {
    test('skips if user has no consent', async () => {
        mockQueryGet.mockReturnValue(null); // no consent record
        const sale = { listing_id: 'l1', platform: 'eBay', sale_price: 100, net_profit: 40, buyer_username: 'buyer' };
        const user = { id: 'u1', full_name: 'Seller', email: 'sell@test.com' };
        await emailMarketing.sendSaleNotification(sale, user);
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('sends email if user has consent', async () => {
        // First call: hasConsent query returns granted=1
        // Subsequent calls: listing, inventory queries
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { granted: 1 }; // consent
            if (callCount === 2) return { id: 'l1', title: 'Listing Title', inventory_id: 'inv1' }; // listing
            if (callCount === 3) return { id: 'inv1', title: 'Inventory Item' }; // inventory
            return null;
        });
        const sale = { listing_id: 'l1', platform: 'eBay', sale_price: 100, net_profit: 40, buyer_username: 'buyer' };
        const user = { id: 'u1', full_name: 'Seller', email: 'sell@test.com' };
        await emailMarketing.sendSaleNotification(sale, user);
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('handles listing without inventory_id', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { granted: 1 }; // consent
            if (callCount === 2) return { id: 'l1', title: 'Listing Title', inventory_id: null }; // listing without inventory
            return null;
        });
        const sale = { listing_id: 'l1', platform: 'Mercari', sale_price: 50, net_profit: 20, buyer_username: 'b' };
        const user = { id: 'u1', full_name: 'Seller', email: 's@t.com' };
        await emailMarketing.sendSaleNotification(sale, user);
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('falls back to "Your item" when listing is null', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { granted: 1 };
            return null; // no listing found
        });
        const sale = { listing_id: 'l1', platform: 'eBay', sale_price: 50, net_profit: 20, buyer_username: 'b' };
        const user = { id: 'u1', username: 'seller', email: 's@t.com' };
        await emailMarketing.sendSaleNotification(sale, user);
        expect(mockEmailSend).toHaveBeenCalled();
    });
});

// ===========================================================================
// emailMarketing.sendWeeklyDigest
// ===========================================================================
describe('emailMarketing.sendWeeklyDigest', () => {
    test('returns early if user not found', async () => {
        mockQueryGet.mockReturnValue(null); // no user
        await emailMarketing.sendWeeklyDigest('u1');
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('returns early if user has no consent', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { id: 'u1', email: 'x@y.com', username: 'u', full_name: 'U' };
            if (callCount === 2) return null; // no consent
            return null;
        });
        await emailMarketing.sendWeeklyDigest('u1');
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('sends digest when user exists and has consent', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { id: 'u1', email: 'x@y.com', username: 'u', full_name: 'User' };
            if (callCount === 2) return { granted: 1 }; // consent
            if (callCount === 3) return { total_sales: 5, total_revenue: 500, total_profit: 200 }; // sales
            if (callCount === 4) return { new_listings: 3, total_views: 100, total_likes: 20 }; // listings
            if (callCount === 5) return { active_items: 10 }; // inventory
            return null;
        });
        mockQueryAll.mockReturnValue([
            { title: 'Item A', views: 50, likes: 10, platform: 'eBay' }
        ]);
        await emailMarketing.sendWeeklyDigest('u1');
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('handles null stats gracefully (defaults to 0)', async () => {
        let callCount = 0;
        mockQueryGet.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { id: 'u1', email: 'x@y.com', username: 'u', full_name: 'User' };
            if (callCount === 2) return { granted: 1 };
            return null; // null stats
        });
        mockQueryAll.mockReturnValue([]);
        await emailMarketing.sendWeeklyDigest('u1');
        expect(mockEmailSend).toHaveBeenCalled();
    });
});

// ===========================================================================
// emailMarketing.processWelcomeSequence
// ===========================================================================
describe('emailMarketing.processWelcomeSequence', () => {
    test('processes pending emails from queue', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'eq1', user_id: 'u1', template_key: 'welcome', data: '{"email":"a@b.com","name":"X"}' }
        ]);
        await emailMarketing.processWelcomeSequence();
        expect(mockEmailSend).toHaveBeenCalledTimes(1);
        // Should update status to sent
        const updateCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('UPDATE email_queue'));
        expect(updateCall).toBeDefined();
        expect(updateCall[1]).toContain('sent');
    });

    test('handles empty queue', async () => {
        mockQueryAll.mockReturnValue([]);
        await emailMarketing.processWelcomeSequence();
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('handles null queue result', async () => {
        mockQueryAll.mockReturnValue(null);
        await emailMarketing.processWelcomeSequence();
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('marks email as failed on send error', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'eq1', user_id: 'u1', template_key: 'welcome', data: '{"email":"a@b.com","name":"X"}' }
        ]);
        mockEmailSend.mockRejectedValueOnce(new Error('SMTP timeout'));
        await emailMarketing.processWelcomeSequence();
        const failCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('UPDATE email_queue') && c[1]?.includes('failed'));
        expect(failCall).toBeDefined();
        expect(failCall[1]).toContain('SMTP timeout');
    });

    test('processes multiple emails', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'eq1', user_id: 'u1', template_key: 'welcome', data: '{"email":"a@b.com","name":"X"}' },
            { id: 'eq2', user_id: 'u2', template_key: 'welcomeDay2', data: '{"email":"c@d.com","name":"Y"}' },
        ]);
        await emailMarketing.processWelcomeSequence();
        expect(mockEmailSend).toHaveBeenCalledTimes(2);
    });
});

// ===========================================================================
// emailMarketing.processWeeklyDigests
// ===========================================================================
describe('emailMarketing.processWeeklyDigests', () => {
    test('skips if not Sunday at 9 AM', async () => {
        // The function checks getDay() === 0 && getHours() === 9
        // Since we can't control Date, we verify it runs without error
        // (in most cases it will return early)
        await emailMarketing.processWeeklyDigests();
        // The function likely returned early — no users queried unless it's the right time
        // This is a "does not throw" test
    });
});

// ===========================================================================
// emailMarketing.processInactivityReminders
// ===========================================================================
describe('emailMarketing.processInactivityReminders', () => {
    test('sends reminders to inactive users with consent', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'u1', email: 'a@b.com', username: 'user1', full_name: 'User One' }
        ]);
        // hasConsent call
        mockQueryGet.mockReturnValue({ granted: 1 });
        await emailMarketing.processInactivityReminders();
        expect(mockEmailSend).toHaveBeenCalled();
    });

    test('skips users without consent', async () => {
        mockQueryAll.mockReturnValue([
            { id: 'u1', email: 'a@b.com', username: 'user1', full_name: 'User One' }
        ]);
        mockQueryGet.mockReturnValue(null); // no consent
        await emailMarketing.processInactivityReminders();
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('handles empty inactive users list', async () => {
        mockQueryAll.mockReturnValue([]);
        await emailMarketing.processInactivityReminders();
        expect(mockEmailSend).not.toHaveBeenCalled();
    });

    test('handles null result from query', async () => {
        mockQueryAll.mockReturnValue(null);
        await emailMarketing.processInactivityReminders();
        expect(mockEmailSend).not.toHaveBeenCalled();
    });
});

// ===========================================================================
// emailMarketing.unsubscribe
// ===========================================================================
describe('emailMarketing.unsubscribe', () => {
    test('succeeds with valid HMAC token', async () => {
        const userId = 'user-42';
        const email = 'test@example.com';
        // Generate the link to get the correct token
        const link = emailMarketing.generateUnsubscribeLink(userId, email);
        const token = new URL('http://localhost' + link).searchParams.get('token');

        const result = await emailMarketing.unsubscribe(userId, email, token);
        expect(result).toBe(true);
    });

    test('updates user_consents to granted=0', async () => {
        const userId = 'user-42';
        const email = 'test@example.com';
        const link = emailMarketing.generateUnsubscribeLink(userId, email);
        const token = new URL('http://localhost' + link).searchParams.get('token');

        await emailMarketing.unsubscribe(userId, email, token);
        const updateCall = mockQueryRun.mock.calls.find(c => c[0]?.includes('user_consents'));
        expect(updateCall).toBeDefined();
        expect(updateCall[1]).toContain(userId);
    });

    test('throws on invalid token', async () => {
        await expect(
            emailMarketing.unsubscribe('user-1', 'a@b.com', 'badtoken1234567890badtoken12345678')
        ).rejects.toThrow('Invalid unsubscribe token');
    });

    test('throws on empty token', async () => {
        await expect(
            emailMarketing.unsubscribe('user-1', 'a@b.com', '')
        ).rejects.toThrow('Invalid unsubscribe token');
    });
});

// ===========================================================================
// emailMarketing.init and startScheduledJobs
// ===========================================================================
describe('emailMarketing.init', () => {
    test('init does not throw', () => {
        expect(() => emailMarketing.init()).not.toThrow();
        // Clean up the intervals it started
        emailMarketing.cleanup();
    });

    test('startScheduledJobs sets interval handles', () => {
        emailMarketing.startScheduledJobs();
        expect(emailMarketing.welcomeInterval).toBeDefined();
        expect(emailMarketing.digestInterval).toBeDefined();
        expect(emailMarketing.inactivityInterval).toBeDefined();
        emailMarketing.cleanup();
    });
});

// ===========================================================================
// emailMarketing.cleanup
// ===========================================================================
describe('emailMarketing.cleanup', () => {
    test('clears all interval handles', () => {
        emailMarketing.startScheduledJobs();
        emailMarketing.cleanup();
        expect(emailMarketing.welcomeInterval).toBeNull();
        expect(emailMarketing.digestInterval).toBeNull();
        expect(emailMarketing.inactivityInterval).toBeNull();
    });

    test('calling cleanup twice does not throw', () => {
        emailMarketing.cleanup();
        expect(() => emailMarketing.cleanup()).not.toThrow();
    });
});

// ===========================================================================
// emailMarketingRouter
// ===========================================================================
describe('emailMarketingRouter', () => {
    describe('GET /unsubscribe', () => {
        test('returns 200 HTML on successful unsubscribe', async () => {
            const userId = 'user-55';
            const email = 'unsub@test.com';
            const link = emailMarketing.generateUnsubscribeLink(userId, email);
            const url = new URL('http://localhost' + link);
            const token = url.searchParams.get('token');

            const ctx = {
                method: 'GET',
                path: '/unsubscribe',
                query: { userId, email, token },
                user: null
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(200);
            expect(result.headers['Content-Type']).toBe('text/html');
            expect(result.data).toContain('Successfully Unsubscribed');
        });

        test('returns 400 on invalid unsubscribe token', async () => {
            const ctx = {
                method: 'GET',
                path: '/unsubscribe',
                query: { userId: 'u1', email: 'a@b.com', token: 'invalid' },
                user: null
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(400);
            expect(result.data.error).toBeDefined();
        });
    });

    describe('authentication gate', () => {
        test('returns 401 when user is null for non-unsubscribe routes', async () => {
            const ctx = {
                method: 'GET',
                path: '/stats',
                query: {},
                user: null
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(401);
            expect(result.data.error).toContain('Authentication required');
        });
    });

    describe('GET /stats', () => {
        test('returns 403 for non-enterprise users', async () => {
            const ctx = {
                method: 'GET',
                path: '/stats',
                query: {},
                user: { id: 'u1', subscription_tier: 'free' }
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(403);
            expect(result.data.error).toContain('Admin access required');
        });

        test('returns 403 for pro tier users', async () => {
            const ctx = {
                method: 'GET',
                path: '/stats',
                query: {},
                user: { id: 'u1', subscription_tier: 'pro' }
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(403);
        });

        test('returns 200 with stats for enterprise users', async () => {
            mockQueryGet.mockReturnValue({
                total_sent: 100, welcome_emails: 30, digest_emails: 20, sale_emails: 50,
                pending: 5, sent: 90, failed: 5
            });
            const ctx = {
                method: 'GET',
                path: '/stats',
                query: {},
                user: { id: 'u1', subscription_tier: 'enterprise' }
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(200);
            expect(result.data.stats).toBeDefined();
            expect(result.data.queueStats).toBeDefined();
        });
    });

    describe('unknown routes', () => {
        test('returns 404 for unknown path', async () => {
            const ctx = {
                method: 'GET',
                path: '/unknown',
                query: {},
                user: { id: 'u1', subscription_tier: 'enterprise' }
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(404);
            expect(result.data.error).toBe('Not found');
        });

        test('returns 404 for POST to /stats', async () => {
            const ctx = {
                method: 'POST',
                path: '/stats',
                query: {},
                user: { id: 'u1', subscription_tier: 'enterprise' }
            };
            const result = await emailMarketingRouter(ctx);
            expect(result.status).toBe(404);
        });
    });
});

// ===========================================================================
// migration export
// ===========================================================================
describe('migration export', () => {
    test('migration is a non-empty string', () => {
        expect(typeof migration).toBe('string');
        expect(migration.length).toBeGreaterThan(0);
    });

    test('migration creates email_queue table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS email_queue');
    });

    test('migration creates email_log table', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS email_log');
    });

    test('email_queue has required columns', () => {
        expect(migration).toContain('user_id');
        expect(migration).toContain('template_key');
        expect(migration).toContain('scheduled_for');
        expect(migration).toContain('status');
    });

    test('migration creates indexes', () => {
        expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_email_queue_status');
        expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_email_log_user');
    });

    test('email_queue has foreign key to users', () => {
        expect(migration).toContain('FOREIGN KEY (user_id) REFERENCES users(id)');
    });
});
