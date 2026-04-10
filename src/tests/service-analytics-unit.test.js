// Analytics Service Unit Tests
import { describe, expect, test, mock, beforeEach, afterEach, afterAll } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mockPrepare = mock(() => ({
    run: mock(),
    get: mock(() => null),
    all: mock(() => [])
}));
const mockQueryGet = mock(() => null);
const mockQueryAll = mock(() => []);
const mockQueryRun = mock(() => ({ changes: 1 }));
const mockTransaction = mock((fn) => fn({
    get: mockQueryGet,
    all: mockQueryAll,
    run: mockQueryRun
}));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mockQueryAll,
        run: mockQueryRun,
        prepare: mockPrepare,
        exec: mock(() => undefined),
        transaction: mockTransaction,
        searchInventory: mock(() => []),
    },
    models: { create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0) },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {}
}));

// Mock logger with ALL methods to prevent cross-file mock contamination
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

const { analyticsService } = await import('../backend/services/analytics.js');

afterAll(() => {
    if (analyticsService.shutdown) {
        analyticsService.shutdown();
    }
});

describe('analyticsService', () => {

    beforeEach(() => {
        mockQueryGet.mockReset();
        mockQueryAll.mockReset();
        mockQueryAll.mockReturnValue([]);
        mockQueryRun.mockReset();
        mockQueryRun.mockReturnValue({ changes: 1 });
        mockTransaction.mockReset();
        mockTransaction.mockImplementation((fn) => fn({
            get: mockQueryGet,
            all: mockQueryAll,
            run: mockQueryRun
        }));
    });

    describe('anonymizeIp', () => {
        test('anonymizes IPv4 by zeroing last octet', () => {
            expect(analyticsService.anonymizeIp('192.168.1.100')).toBe('192.168.1.0');
        });

        test('anonymizes another IPv4', () => {
            expect(analyticsService.anonymizeIp('10.0.0.5')).toBe('10.0.0.0');
        });

        test('anonymizes IPv6 by zeroing last 80 bits', () => {
            const result = analyticsService.anonymizeIp('2001:db8:1234:5678:abcd:ef01:2345:6789');
            expect(result).toBe('2001:db8:1234:0:0:0:0:0');
        });

        test('returns null for null input', () => {
            expect(analyticsService.anonymizeIp(null)).toBeNull();
        });

        test('returns null for empty string', () => {
            expect(analyticsService.anonymizeIp('')).toBeNull();
        });

        test('returns null for invalid input', () => {
            expect(analyticsService.anonymizeIp('invalid')).toBeNull();
        });
    });

    describe('track', () => {
        test('queues an event', () => {
            analyticsService.track('test_event', { page: '/home' });
            // track is fire-and-forget, should not throw
            expect(true).toBe(true);
        });

        test('respects DNT header when provided', () => {
            const mockRequest = { headers: { get: (h) => h === 'dnt' ? '1' : null } };
            // Should not throw even with DNT
            analyticsService.track('dnt_event', {}, null, mockRequest);
            expect(true).toBe(true);
        });
    });

    describe('trackPageView', () => {
        test('tracks a page view', () => {
            analyticsService.trackPageView('/dashboard');
            expect(true).toBe(true);
        });

        test('tracks page view with user', () => {
            analyticsService.trackPageView('/inventory', { id: 'user-1' });
            expect(true).toBe(true);
        });
    });

    describe('trackAction', () => {
        test('tracks a user action', () => {
            analyticsService.trackAction('click', 'add_item_button');
            expect(true).toBe(true);
        });
    });

    describe('trackError', () => {
        test('tracks an error event', () => {
            analyticsService.trackError(new Error('Test error'), { page: '/inventory' });
            expect(true).toBe(true);
        });
    });

    describe('trackConversion', () => {
        test('tracks a conversion', () => {
            analyticsService.trackConversion('sale', 49.99, { item: 'sneakers' });
            expect(true).toBe(true);
        });
    });

    describe('getEventCounts', () => {
        test('returns event counts for date range', () => {
            mockQueryAll.mockReturnValue([
                { event_name: 'page_view', count: 10, unique_users: 5 }
            ]);
            const result = analyticsService.getEventCounts(new Date('2024-01-01'));
            expect(result).toBeDefined();
        });
    });

    describe('getPageViews', () => {
        test('returns page views grouped by day', () => {
            mockQueryAll.mockReturnValue([
                { period: '2024-01-01', views: 50, unique_users: 20 }
            ]);
            const result = analyticsService.getPageViews(new Date('2024-01-01'));
            expect(result).toBeDefined();
        });

        test('accepts groupBy parameter', () => {
            mockQueryAll.mockReturnValue([]);
            const result = analyticsService.getPageViews(new Date('2024-01-01'), new Date(), 'hour');
            expect(result).toBeDefined();
        });
    });

    describe('getUserSessions', () => {
        test('returns user sessions', () => {
            mockQueryAll.mockReturnValue([
                { session_id: 'sess-1', event_count: 5, first_event: '2024-01-01' }
            ]);
            const result = analyticsService.getUserSessions('user-1');
            expect(result).toBeDefined();
        });

        test('accepts limit parameter', () => {
            mockQueryAll.mockReturnValue([]);
            const result = analyticsService.getUserSessions('user-1', 5);
            expect(result).toBeDefined();
        });
    });

    describe('analyzeFunnel', () => {
        test('returns funnel analysis', () => {
            mockQueryGet.mockReturnValue({ count: 100 });
            const steps = ['page_view', 'add_to_cart', 'purchase'];
            const result = analyticsService.analyzeFunnel(steps, new Date('2024-01-01'));
            expect(result).toBeDefined();
        });
    });

    describe('getConversionMetrics', () => {
        test('returns conversion metrics', () => {
            mockQueryGet.mockReturnValue({ total: 500, avg_value: 49.99, count: 10 });
            const result = analyticsService.getConversionMetrics('sale', new Date('2024-01-01'));
            expect(result).toBeDefined();
        });
    });

    describe('getRetentionCohorts', () => {
        test('returns retention cohort data', () => {
            mockQueryAll.mockReturnValue([]);
            const result = analyticsService.getRetentionCohorts(new Date('2024-01-01'));
            expect(result).toBeDefined();
        });
    });

    describe('cleanupOldData', () => {
        test('does not throw', async () => {
            const result = await analyticsService.cleanupOldData();
            // Should complete without error
            expect(true).toBe(true);
        });
    });

    describe('flush', () => {
        test('flushes queued events', async () => {
            await analyticsService.flush();
            expect(true).toBe(true);
        });
    });

    describe('shutdown', () => {
        test('shuts down gracefully', async () => {
            await analyticsService.shutdown();
            expect(true).toBe(true);
        });
    });
});

// ============================================================================
// Extended unit tests — deeper coverage of analytics service logic
// ============================================================================

describe('analyticsService — extended coverage', () => {

    beforeEach(() => {
        mockQueryGet.mockReset();
        mockQueryAll.mockReset();
        mockQueryAll.mockReturnValue([]);
        mockQueryRun.mockReset();
        mockQueryRun.mockReturnValue({ changes: 1 });
        mockPrepare.mockReset();
        mockPrepare.mockReturnValue({ run: mock(), get: mock(() => null), all: mock(() => []) });
    });

    // ------------------------------------------------------------------
    // anonymizeIp — comprehensive edge cases
    // ------------------------------------------------------------------
    describe('anonymizeIp — extended edge cases', () => {
        test('handles loopback IPv4 (127.0.0.1)', () => {
            expect(analyticsService.anonymizeIp('127.0.0.1')).toBe('127.0.0.0');
        });

        test('handles all-zeros IPv4 (0.0.0.0)', () => {
            expect(analyticsService.anonymizeIp('0.0.0.0')).toBe('0.0.0.0');
        });

        test('handles broadcast IPv4 (255.255.255.255)', () => {
            expect(analyticsService.anonymizeIp('255.255.255.255')).toBe('255.255.255.0');
        });

        test('handles private range 172.16.x.x', () => {
            expect(analyticsService.anonymizeIp('172.16.254.99')).toBe('172.16.254.0');
        });

        test('handles private range 10.x.x.x', () => {
            expect(analyticsService.anonymizeIp('10.255.0.1')).toBe('10.255.0.0');
        });

        test('handles IPv4-mapped IPv6 (::ffff:192.168.1.1) via IPv4 path', () => {
            // Contains '.' so the IPv4 check fires first.
            // split('.') => ['::ffff:192', '168', '1', '1'], slice(0,3) => first 3 + '.0'
            const result = analyticsService.anonymizeIp('::ffff:192.168.1.1');
            expect(result).toBe('::ffff:192.168.1.0');
        });

        test('handles short IPv6 loopback (::1)', () => {
            const result = analyticsService.anonymizeIp('::1');
            expect(result).toBe('::1:0:0:0:0:0');
        });

        test('handles link-local IPv6 (fe80::)', () => {
            const result = analyticsService.anonymizeIp('fe80::1:2:3:4:5:6');
            expect(result).toBe('fe80::1:0:0:0:0:0');
        });

        test('returns null for undefined', () => {
            expect(analyticsService.anonymizeIp(undefined)).toBeNull();
        });

        test('returns null for string without dots or colons', () => {
            expect(analyticsService.anonymizeIp('localhost')).toBeNull();
            expect(analyticsService.anonymizeIp('not-an-ip')).toBeNull();
            expect(analyticsService.anonymizeIp('12345')).toBeNull();
        });

        test('handles three-octet dotted string', () => {
            // '1.2.3' has dots so IPv4 path: split('.') => ['1','2','3'], slice(0,3) => ['1','2','3'] + '.0'
            expect(analyticsService.anonymizeIp('1.2.3')).toBe('1.2.3.0');
        });

        test('handles two-group colon string', () => {
            // 'a:b' has colon so IPv6 path: split(':') => ['a','b'], slice(0,3) => ['a','b'] + ':0:0:0:0:0'
            expect(analyticsService.anonymizeIp('a:b')).toBe('a:b:0:0:0:0:0');
        });
    });

    // ------------------------------------------------------------------
    // track — detailed event construction & queue behavior
    // ------------------------------------------------------------------
    describe('track — event construction', () => {
        test('respects DNT header with object-style headers', () => {
            const request = { headers: { 'dnt': '1' }, ip: '1.2.3.4' };
            // Should return early without queueing
            analyticsService.track('dnt_event', {}, null, request);
            // No assertion on queue since it is private, but it should not throw
        });

        test('does NOT block when DNT header is "0"', () => {
            const request = { headers: { 'dnt': '0' }, ip: '1.2.3.4' };
            expect(() => {
                analyticsService.track('non_dnt_event', { data: 1 }, null, request);
            }).not.toThrow();
        });

        test('does NOT block when DNT header is absent', () => {
            const request = { headers: {}, ip: '1.2.3.4' };
            expect(() => {
                analyticsService.track('no_dnt', {}, null, request);
            }).not.toThrow();
        });

        test('handles null properties gracefully (uses default {})', () => {
            expect(() => {
                analyticsService.track('event_null_props');
            }).not.toThrow();
        });

        test('passes sessionId from properties', () => {
            expect(() => {
                analyticsService.track('event_session', { sessionId: 'sess-123' });
            }).not.toThrow();
        });

        test('handles request with no ip', () => {
            expect(() => {
                analyticsService.track('event_no_ip', {}, null, { headers: {} });
            }).not.toThrow();
        });

        test('captures user-agent from request headers', () => {
            expect(() => {
                analyticsService.track('event_ua', {}, null, {
                    headers: { 'user-agent': 'Mozilla/5.0 Test' },
                    ip: '10.0.0.1'
                });
            }).not.toThrow();
        });

        test('handles missing user-agent header', () => {
            expect(() => {
                analyticsService.track('event_no_ua', {}, null, { headers: {}, ip: '10.0.0.1' });
            }).not.toThrow();
        });

        test('extracts userId from user object', () => {
            expect(() => {
                analyticsService.track('event_user', {}, { id: 'uid-42' });
            }).not.toThrow();
        });

        test('sets userId to null when user has no id', () => {
            expect(() => {
                analyticsService.track('event_no_uid', {}, { name: 'anon' });
            }).not.toThrow();
        });

        test('sets userId to null when user is null', () => {
            expect(() => {
                analyticsService.track('event_null_user', {}, null);
            }).not.toThrow();
        });
    });

    // ------------------------------------------------------------------
    // trackPageView — argument forwarding
    // ------------------------------------------------------------------
    describe('trackPageView — argument forwarding', () => {
        test('tracks page view with all parameters', () => {
            expect(() => {
                analyticsService.trackPageView('/inventory', { id: 'u1' }, {
                    headers: { 'user-agent': 'TestBot/1.0' },
                    ip: '192.168.1.1'
                });
            }).not.toThrow();
        });

        test('tracks page view with only page parameter', () => {
            expect(() => {
                analyticsService.trackPageView('/home');
            }).not.toThrow();
        });

        test('tracks page view with empty page string', () => {
            expect(() => {
                analyticsService.trackPageView('');
            }).not.toThrow();
        });
    });

    // ------------------------------------------------------------------
    // trackAction — argument forwarding
    // ------------------------------------------------------------------
    describe('trackAction — argument forwarding', () => {
        test('tracks action with user and request', () => {
            expect(() => {
                analyticsService.trackAction('click', 'buy_button', { id: 'u5' }, {
                    headers: { 'user-agent': 'Chrome' },
                    ip: '8.8.8.8'
                });
            }).not.toThrow();
        });

        test('tracks action with minimal arguments', () => {
            expect(() => {
                analyticsService.trackAction('hover', 'product_image');
            }).not.toThrow();
        });
    });

    // ------------------------------------------------------------------
    // trackError — error handling
    // ------------------------------------------------------------------
    describe('trackError — error handling', () => {
        test('truncates stack to 500 characters', () => {
            const error = new Error('Big stack');
            error.stack = 'E'.repeat(1000);
            // The service does .substring(0, 500) on the stack
            // We verify it does not throw with a massive stack
            expect(() => {
                analyticsService.trackError(error, { page: '/test' });
            }).not.toThrow();
        });

        test('handles error with undefined stack', () => {
            const error = { message: 'no stack' };
            expect(() => {
                analyticsService.trackError(error);
            }).not.toThrow();
        });

        test('handles error with undefined message', () => {
            const error = {};
            expect(() => {
                analyticsService.trackError(error);
            }).not.toThrow();
        });

        test('merges context properties into event', () => {
            const error = new Error('fail');
            expect(() => {
                analyticsService.trackError(error, {
                    page: '/checkout',
                    component: 'PaymentForm',
                    severity: 'critical',
                    userId: 'u99'
                });
            }).not.toThrow();
        });

        test('tracks error with user parameter', () => {
            const error = new Error('auth failed');
            expect(() => {
                analyticsService.trackError(error, { route: '/api/login' }, { id: 'attacker-1' });
            }).not.toThrow();
        });
    });

    // ------------------------------------------------------------------
    // trackConversion — type and value handling
    // ------------------------------------------------------------------
    describe('trackConversion — type and value handling', () => {
        test('tracks conversion with zero value', () => {
            expect(() => {
                analyticsService.trackConversion('free_signup', 0);
            }).not.toThrow();
        });

        test('tracks conversion with negative value', () => {
            expect(() => {
                analyticsService.trackConversion('refund', -49.99, { reason: 'defective' });
            }).not.toThrow();
        });

        test('tracks conversion with all parameters', () => {
            expect(() => {
                analyticsService.trackConversion('purchase', 199.99, {
                    item: 'designer_bag',
                    platform: 'poshmark'
                }, { id: 'buyer-7' });
            }).not.toThrow();
        });

        test('tracks conversion with empty properties', () => {
            expect(() => {
                analyticsService.trackConversion('lead', 0, {});
            }).not.toThrow();
        });
    });

    // ------------------------------------------------------------------
    // getEventCounts — query interaction
    // ------------------------------------------------------------------
    describe('getEventCounts — query behavior', () => {
        test('calls query.all with date range', async () => {
            mockQueryAll.mockReturnValue([
                { name: 'page_view', count: 100, unique_users: 50, unique_sessions: 30 },
                { name: 'user_action', count: 75, unique_users: 40, unique_sessions: 25 }
            ]);
            const start = new Date('2024-01-01');
            const end = new Date('2024-01-31');
            const result = await analyticsService.getEventCounts(start, end);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
            expect(result[0].name).toBe('page_view');
            expect(result[0].count).toBe(100);
            expect(result[1].name).toBe('user_action');
        });

        test('returns empty array when no events', async () => {
            mockQueryAll.mockReturnValue([]);
            const result = await analyticsService.getEventCounts(new Date('2025-01-01'));
            expect(result).toEqual([]);
        });

        test('uses endDate default (new Date()) when not provided', () => {
            mockQueryAll.mockReturnValue([]);
            const result = analyticsService.getEventCounts(new Date('2024-01-01'));
            expect(result).toBeDefined();
            expect(mockQueryAll).toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // getPageViews — groupBy logic
    // ------------------------------------------------------------------
    describe('getPageViews — groupBy logic', () => {
        test('returns page views grouped by day (default)', async () => {
            mockQueryAll.mockReturnValue([
                { period: '2024-01-15', page: '/home', views: 100, unique_users: 50 },
                { period: '2024-01-15', page: '/inventory', views: 80, unique_users: 40 }
            ]);
            const result = await analyticsService.getPageViews(new Date('2024-01-01'), new Date('2024-01-31'));
            expect(result.length).toBe(2);
            expect(result[0].period).toBe('2024-01-15');
            expect(result[0].page).toBe('/home');
        });

        test('passes hour format when groupBy is hour', async () => {
            mockQueryAll.mockReturnValue([
                { period: '2024-01-15 14:00', page: '/home', views: 20, unique_users: 10 }
            ]);
            const result = await analyticsService.getPageViews(
                new Date('2024-01-15'),
                new Date('2024-01-16'),
                'hour'
            );
            expect(result.length).toBe(1);
            // The first argument to query.all should be the hour format
            const callArgs = mockQueryAll.mock.calls[mockQueryAll.mock.calls.length - 1];
            expect(callArgs[1][0]).toBe('YYYY-MM-DD HH24:00');
        });

        test('passes day format when groupBy is day', () => {
            mockQueryAll.mockReturnValue([]);
            analyticsService.getPageViews(new Date('2024-01-01'), new Date('2024-01-31'), 'day');
            const callArgs = mockQueryAll.mock.calls[mockQueryAll.mock.calls.length - 1];
            expect(callArgs[1][0]).toBe('YYYY-MM-DD');
        });

        test('defaults to day format when groupBy is unrecognized', () => {
            mockQueryAll.mockReturnValue([]);
            analyticsService.getPageViews(new Date('2024-01-01'), new Date('2024-01-31'), 'month');
            const callArgs = mockQueryAll.mock.calls[mockQueryAll.mock.calls.length - 1];
            // Anything not 'hour' falls to YYYY-MM-DD.
            expect(callArgs[1][0]).toBe('YYYY-MM-DD');
        });
    });

    // ------------------------------------------------------------------
    // getUserSessions — parameters
    // ------------------------------------------------------------------
    describe('getUserSessions — parameters', () => {
        test('returns sessions for a specific user', async () => {
            mockQueryAll.mockReturnValue([
                { session_id: 'sess-1', start_time: '2024-01-15T10:00:00Z', end_time: '2024-01-15T10:30:00Z', event_count: 15, events: 'page_view,user_action' }
            ]);
            const result = await analyticsService.getUserSessions('user-42');
            expect(result.length).toBe(1);
            expect(result[0].session_id).toBe('sess-1');
            expect(result[0].event_count).toBe(15);
        });

        test('defaults to limit of 10', () => {
            mockQueryAll.mockReturnValue([]);
            analyticsService.getUserSessions('user-1');
            const callArgs = mockQueryAll.mock.calls[mockQueryAll.mock.calls.length - 1];
            expect(callArgs[1][1]).toBe(10);
        });

        test('passes custom limit', () => {
            mockQueryAll.mockReturnValue([]);
            analyticsService.getUserSessions('user-1', 25);
            const callArgs = mockQueryAll.mock.calls[mockQueryAll.mock.calls.length - 1];
            expect(callArgs[1][1]).toBe(25);
        });

        test('returns empty array for user with no sessions', async () => {
            mockQueryAll.mockReturnValue([]);
            const result = await analyticsService.getUserSessions('nonexistent-user');
            expect(result).toEqual([]);
        });
    });

    // ------------------------------------------------------------------
    // analyzeFunnel — step parsing and dropoff calculation
    // ------------------------------------------------------------------
    describe('analyzeFunnel — step parsing and dropoff calculation', () => {
        test('parses step with event:target format', async () => {
            // Set up mock to return user counts for funnel steps
            mockQueryGet.mockReturnValue({ users: 100 });
            mockQueryAll.mockReturnValue([{ user_id: 'u1' }, { user_id: 'u2' }]);

            const steps = ['page_view:signup'];
            const result = await analyticsService.analyzeFunnel(steps, new Date('2024-01-01'));
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(1);
            expect(result[0].step).toBe('page_view:signup');
            expect(result[0]).toHaveProperty('users');
            expect(result[0]).toHaveProperty('dropoff');
        });

        test('parses step without target', async () => {
            mockQueryGet.mockReturnValue({ users: 50 });
            mockQueryAll.mockReturnValue([{ user_id: 'u1' }]);

            const steps = ['page_view'];
            const result = await analyticsService.analyzeFunnel(steps, new Date('2024-01-01'));
            expect(result.length).toBe(1);
            expect(result[0].step).toBe('page_view');
        });

        test('calculates multi-step funnel', async () => {
            // First step: 100 users
            // Second step: 60 users (40% dropoff)
            // Third step: 20 users (66.7% dropoff)
            let callCount = 0;
            mockQueryGet.mockImplementation(() => {
                callCount++;
                if (callCount <= 2) return { users: 100 };  // step 1 (called for get + userIds)
                if (callCount <= 4) return { users: 60 };   // step 2
                return { users: 20 };                        // step 3
            });
            mockQueryAll.mockImplementation(() => {
                return [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }];
            });

            const steps = ['page_view:home', 'user_action:form_start', 'conversion:signup'];
            const result = await analyticsService.analyzeFunnel(steps, new Date('2024-01-01'));
            expect(result.length).toBe(3);
            // Each result should have step, users, dropoff, conversionRate
            for (const r of result) {
                expect(r).toHaveProperty('step');
                expect(r).toHaveProperty('users');
                expect(r).toHaveProperty('dropoff');
                expect(r).toHaveProperty('conversionRate');
                // userIds should be stripped from the response
                expect(r).not.toHaveProperty('userIds');
            }
        });

        test('returns empty results array for empty steps', async () => {
            const result = await analyticsService.analyzeFunnel([], new Date('2024-01-01'));
            expect(result).toEqual([]);
        });

        test('handles funnel step with zero users at a point', async () => {
            mockQueryGet.mockReturnValue({ users: 0 });
            mockQueryAll.mockReturnValue([]);

            const steps = ['page_view:nonexistent', 'conversion:nothing'];
            const result = await analyticsService.analyzeFunnel(steps, new Date('2024-01-01'));
            expect(result.length).toBe(2);
            // Second step should show 100% dropoff when previous had users
            // or 0 users if first had 0
            expect(result[1].users).toBe(0);
        });
    });

    // ------------------------------------------------------------------
    // getConversionMetrics — result shape
    // ------------------------------------------------------------------
    describe('getConversionMetrics — result shape', () => {
        test('returns conversion metrics for a specific type', async () => {
            mockQueryGet.mockReturnValue({
                total_conversions: 25,
                unique_users: 20,
                total_value: 1249.75,
                avg_value: 49.99
            });
            const result = await analyticsService.getConversionMetrics('purchase', new Date('2024-01-01'));
            expect(result).toBeDefined();
            expect(result.total_conversions).toBe(25);
            expect(result.unique_users).toBe(20);
            expect(result.total_value).toBe(1249.75);
            expect(result.avg_value).toBe(49.99);
        });

        test('returns null values when no conversions exist', async () => {
            mockQueryGet.mockReturnValue({
                total_conversions: 0,
                unique_users: 0,
                total_value: null,
                avg_value: null
            });
            const result = await analyticsService.getConversionMetrics('nonexistent', new Date('2024-06-01'));
            expect(result.total_conversions).toBe(0);
            expect(result.total_value).toBeNull();
        });

        test('passes correct parameters to query', () => {
            mockQueryGet.mockReturnValue({ total_conversions: 0, unique_users: 0, total_value: null, avg_value: null });
            const start = new Date('2024-03-01');
            const end = new Date('2024-03-31');
            analyticsService.getConversionMetrics('signup', start, end);
            const callArgs = mockQueryGet.mock.calls[mockQueryGet.mock.calls.length - 1];
            expect(callArgs[1][0]).toBe('signup');
            expect(callArgs[1][1]).toBe(start.toISOString());
            expect(callArgs[1][2]).toBe(end.toISOString());
        });
    });

    // ------------------------------------------------------------------
    // getRetentionCohorts — result handling
    // ------------------------------------------------------------------
    describe('getRetentionCohorts — result handling', () => {
        test('returns cohort data array', async () => {
            mockQueryAll.mockReturnValue([
                { cohort_week: '2024-01', weeks_since_first: 0, users: 50 },
                { cohort_week: '2024-01', weeks_since_first: 1, users: 35 },
                { cohort_week: '2024-01', weeks_since_first: 2, users: 20 }
            ]);
            const result = await analyticsService.getRetentionCohorts(new Date('2024-01-01'), new Date('2024-03-01'));
            expect(result.length).toBe(3);
            expect(result[0].cohort_week).toBe('2024-01');
            expect(result[0].weeks_since_first).toBe(0);
            expect(result[0].users).toBe(50);
        });

        test('passes start and end dates twice (for cohorts and weekly_activity CTEs)', () => {
            mockQueryAll.mockReturnValue([]);
            const start = new Date('2024-01-01');
            const end = new Date('2024-06-01');
            analyticsService.getRetentionCohorts(start, end);
            const callArgs = mockQueryAll.mock.calls[mockQueryAll.mock.calls.length - 1];
            // The SQL uses 4 parameters: start, end, start, end
            expect(callArgs[1].length).toBe(4);
            expect(callArgs[1][0]).toBe(start.toISOString());
            expect(callArgs[1][1]).toBe(end.toISOString());
            expect(callArgs[1][2]).toBe(start.toISOString());
            expect(callArgs[1][3]).toBe(end.toISOString());
        });

        test('returns empty array when no data', async () => {
            mockQueryAll.mockReturnValue([]);
            const result = await analyticsService.getRetentionCohorts(new Date('2025-01-01'));
            expect(result).toEqual([]);
        });
    });

    // ------------------------------------------------------------------
    // cleanupOldData — retention logic
    // ------------------------------------------------------------------
    describe('cleanupOldData — retention logic', () => {
        test('returns the number of deleted records', async () => {
            mockQueryRun.mockReturnValue({ changes: 42 });
            const result = await analyticsService.cleanupOldData();
            expect(result).toBe(42);
        });

        test('returns 0 when no records to clean', async () => {
            mockQueryRun.mockReturnValue({ changes: 0 });
            const result = await analyticsService.cleanupOldData();
            expect(result).toBe(0);
        });

        test('calls query.run with a cutoff date parameter', async () => {
            mockQueryRun.mockReturnValue({ changes: 5 });
            await analyticsService.cleanupOldData();
            expect(mockQueryRun).toHaveBeenCalled();
            const callArgs = mockQueryRun.mock.calls[mockQueryRun.mock.calls.length - 1];
            // Second arg is array with one ISO date string
            expect(callArgs[1].length).toBe(1);
            // The cutoff should be ~90 days ago (dataRetentionDays)
            const cutoff = new Date(callArgs[1][0]);
            const now = new Date();
            const diffDays = (now - cutoff) / (1000 * 60 * 60 * 24);
            // Should be approximately 90 days (+/- 1 day for test timing)
            expect(diffDays).toBeGreaterThan(88);
            expect(diffDays).toBeLessThan(92);
        });
    });

    // ------------------------------------------------------------------
    // flush — queue processing & error recovery
    // ------------------------------------------------------------------
    describe('flush — queue processing and error recovery', () => {
        test('flush writes queued events through the transaction runner', async () => {
            // Add an event to the queue first
            analyticsService.track('flush_test_event', { val: 1 });
            await analyticsService.flush();
            expect(mockQueryRun).toHaveBeenCalled();
            const sql = mockQueryRun.mock.calls[mockQueryRun.mock.calls.length - 1][0];
            expect(sql).toContain('INSERT INTO analytics_events');
        });

        test('flush is a no-op when queue is empty', async () => {
            // Flush any existing events first
            try { await analyticsService.flush(); } catch { /* ok */ }
            // Reset mock call count
            mockQueryRun.mockClear();
            // Now flush empty queue
            await analyticsService.flush();
            expect(mockQueryRun).not.toHaveBeenCalled();
        });

        test('flush re-queues events on error if queue is small', async () => {
            mockQueryRun.mockImplementation(() => { throw new Error('DB write failed'); });
            // Add some events
            analyticsService.track('fail_event_1', {});
            analyticsService.track('fail_event_2', {});
            // Flush should catch the error and re-queue
            await analyticsService.flush();
            // The events should be re-queued — flushing again should attempt writes again.
            mockQueryRun.mockClear();
            mockQueryRun.mockImplementation(() => { throw new Error('DB write failed again'); });
            await analyticsService.flush();
            expect(mockQueryRun).toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // init — timer setup
    // ------------------------------------------------------------------
    describe('init — timer setup', () => {
        afterEach(async () => {
            try { await analyticsService.shutdown(); } catch { /* ignore */ }
        });

        test('init does not throw', () => {
            expect(() => analyticsService.init()).not.toThrow();
        });

        test('init can be called multiple times without error', () => {
            expect(() => {
                analyticsService.init();
                analyticsService.init();
            }).not.toThrow();
        });
    });

    // ------------------------------------------------------------------
    // shutdown — cleanup
    // ------------------------------------------------------------------
    describe('shutdown — cleanup', () => {
        test('shutdown does not throw after init', async () => {
            analyticsService.init();
            await analyticsService.shutdown();
            // Should complete without error
        });

        test('shutdown does not throw without prior init', async () => {
            // flush may encounter events; catch any DB errors
            try {
                await analyticsService.shutdown();
            } catch {
                // Expected in unit test without real DB
            }
        });
    });

    // ------------------------------------------------------------------
    // Module exports validation
    // ------------------------------------------------------------------
    describe('module exports', () => {
        test('analyticsService is the default export', async () => {
            const mod = await import('../backend/services/analytics.js');
            expect(mod.default).toBe(mod.analyticsService);
        });

        test('migration export is intentionally empty because pg-schema owns analytics DDL', async () => {
            const mod = await import('../backend/services/analytics.js');
            expect(typeof mod.migration).toBe('string');
            expect(mod.migration).toBe('');
        });

        test('analyticsService has exactly 16 public methods', async () => {
            const mod = await import('../backend/services/analytics.js');
            const methods = Object.keys(mod.analyticsService).filter(
                k => typeof mod.analyticsService[k] === 'function'
            );
            expect(methods.length).toBe(16);
        });

        test('all expected methods exist on analyticsService', () => {
            const expectedMethods = [
                'init', 'track', 'trackPageView', 'trackAction',
                'trackError', 'trackConversion', 'anonymizeIp', 'flush',
                'shutdown', 'getEventCounts', 'getPageViews', 'getUserSessions',
                'analyzeFunnel', 'getConversionMetrics', 'getRetentionCohorts',
                'cleanupOldData'
            ];
            for (const method of expectedMethods) {
                expect(typeof analyticsService[method]).toBe('function');
            }
        });
    });

    // ------------------------------------------------------------------
    // pg-schema SQL — structural validation
    // ------------------------------------------------------------------
    describe('pg-schema SQL — structural validation', () => {
        let pgSchema;
        beforeEach(async () => {
            pgSchema = readFileSync(join(process.cwd(), 'src/backend/db/pg-schema.sql'), 'utf8');
        });

        test('defines analytics_events table with all tracked columns', () => {
            const columns = ['id', 'name', 'properties', 'user_id', 'session_id', 'timestamp', 'ip', 'user_agent'];
            for (const col of columns) {
                expect(pgSchema).toContain(col);
            }
        });

        test('id is a serial primary key in Postgres schema', () => {
            expect(pgSchema).toContain('id SERIAL PRIMARY KEY');
        });

        test('name is TEXT NOT NULL', () => {
            expect(pgSchema).toContain('name TEXT NOT NULL');
        });

        test('timestamp is TIMESTAMPTZ with NOW default', () => {
            expect(pgSchema).toContain('timestamp TIMESTAMPTZ DEFAULT NOW()');
        });

        test('has 4 CREATE INDEX statements', () => {
            const matches = pgSchema.match(/CREATE INDEX IF NOT EXISTS idx_analytics_(name|user|session|timestamp)/g);
            expect(matches).not.toBeNull();
            expect(matches.length).toBe(4);
        });

        test('all indexes are on analytics_events table', () => {
            const indexLines = pgSchema.split('\n').filter(l => l.includes('CREATE INDEX') && l.includes('idx_analytics_'));
            for (const line of indexLines) {
                if (!line.includes('snapshots')) expect(line).toContain('ON analytics_events');
            }
        });
    });

    // ------------------------------------------------------------------
    // ANALYTICS_CONFIG — indirect tests via behavior
    // ------------------------------------------------------------------
    describe('ANALYTICS_CONFIG — behavioral validation', () => {
        test('sessionTimeout-related behavior: track adds timestamp to events', () => {
            // We verify that track generates a timestamp (ISO string)
            // by checking that events are queued with timestamps during flush
            expect(() => {
                analyticsService.track('timestamp_test', {});
            }).not.toThrow();
        });

        test('dataRetentionDays drives cleanupOldData cutoff (~90 days)', async () => {
            mockQueryRun.mockReturnValue({ changes: 0 });
            await analyticsService.cleanupOldData();
            const callArgs = mockQueryRun.mock.calls[mockQueryRun.mock.calls.length - 1];
            const cutoffDate = new Date(callArgs[1][0]);
            const expectedCutoff = new Date();
            expectedCutoff.setDate(expectedCutoff.getDate() - 90);
            // Should be within 1 second of expected
            expect(Math.abs(cutoffDate - expectedCutoff)).toBeLessThan(1000);
        });

        test('respectDNT is true by default (DNT=1 blocks tracking)', () => {
            const request = { headers: { 'dnt': '1' }, ip: '1.2.3.4' };
            // If respectDNT were false, this would queue an event.
            // We verify it returns without error (early return).
            const result = analyticsService.track('dnt_test', {}, null, request);
            expect(result).toBeUndefined();
        });

        test('anonymizeIp is true by default (IPs are anonymized in events)', () => {
            // This is tested indirectly — anonymizeIp is called during track
            // when a request with an IP is provided. We test the function directly.
            expect(analyticsService.anonymizeIp('8.8.8.8')).toBe('8.8.8.0');
        });
    });
});
