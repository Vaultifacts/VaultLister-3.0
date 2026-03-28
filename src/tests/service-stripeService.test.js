// Issue #172: Unit tests for stripeService.js (untested service)
// Tests STRIPE_PRICE_IDS, TIER_FOR_PRICE, and all exported functions.
// Stripe SDK and database are fully mocked — no real API calls.
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ============================================
// Mocks — must come before imports
// ============================================

const mockCustomersCreate = mock(() => Promise.resolve({ id: 'cus_mock123', email: 'test@example.com' }));
const mockSessionsCreate = mock(() => Promise.resolve({ id: 'cs_mock123', url: 'https://checkout.stripe.com/mock' }));
const mockPortalCreate = mock(() => Promise.resolve({ id: 'bps_mock123', url: 'https://billing.stripe.com/mock' }));
const mockSubsCancel = mock(() => Promise.resolve({ id: 'sub_mock123', status: 'canceled' }));
const mockSubsRetrieve = mock(() => Promise.resolve({ id: 'sub_mock123', status: 'active' }));
const mockConstructEvent = mock((body, sig, secret) => ({ type: 'payment_intent.succeeded', data: { object: {} } }));

const MockStripe = mock(() => ({
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
    subscriptions: { cancel: mockSubsCancel, retrieve: mockSubsRetrieve },
    webhooks: { constructEvent: mockConstructEvent }
}));

mock.module('stripe', () => ({ default: MockStripe }));

const mockQueryGet = mock(() => null);
const mockQueryRun = mock(() => ({ changes: 1 }));

mock.module('../backend/db/database.js', () => ({
    query: {
        get: mockQueryGet,
        all: mock(() => []),
        run: mockQueryRun,
        prepare: mock(() => ({ run: mock(), get: mock(() => null), all: mock(() => []) })),
        exec: mock(() => undefined),
        transaction: mock((fn) => fn()),
    },
    models: {
        create: mock(), findById: mock(), findOne: mock(), findMany: mock(() => []),
        update: mock(), delete: mock(), count: mock(() => 0)
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => Promise.resolve()),
    closeDatabase: mock(() => Promise.resolve()),
    default: {}
}));

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), error: mock(), warn: mock(), debug: mock() },
    default: { info: mock(), error: mock(), warn: mock(), debug: mock() }
}));

// ============================================
// Set STRIPE_SECRET_KEY so stripe instance is initialized
// ============================================
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_unit_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_for_unit_tests';

// ============================================
// Import module under test
// ============================================

const {
    STRIPE_PRICE_IDS,
    TIER_FOR_PRICE,
    createCustomer,
    createCheckoutSession,
    createPortalSession,
    cancelSubscription,
    getSubscription,
    constructWebhookEvent
} = await import('../backend/services/stripeService.js');

// ============================================
// Tests
// ============================================

describe('stripeService — STRIPE_PRICE_IDS', () => {
    test('should have starter, pro, and business price IDs', () => {
        expect(STRIPE_PRICE_IDS).toHaveProperty('starter');
        expect(STRIPE_PRICE_IDS).toHaveProperty('pro');
        expect(STRIPE_PRICE_IDS).toHaveProperty('business');
    });

    test('should use placeholder values when env vars are not set', () => {
        expect(typeof STRIPE_PRICE_IDS.starter).toBe('string');
        expect(STRIPE_PRICE_IDS.starter.length).toBeGreaterThan(0);
    });
});

describe('stripeService — TIER_FOR_PRICE', () => {
    test('should be the inverse mapping of STRIPE_PRICE_IDS', () => {
        for (const [tier, priceId] of Object.entries(STRIPE_PRICE_IDS)) {
            expect(TIER_FOR_PRICE[priceId]).toBe(tier);
        }
    });

    test('should have the same number of entries as STRIPE_PRICE_IDS', () => {
        expect(Object.keys(TIER_FOR_PRICE).length).toBe(Object.keys(STRIPE_PRICE_IDS).length);
    });
});

describe('stripeService — createCustomer()', () => {
    beforeEach(() => {
        mockCustomersCreate.mockClear();
        mockQueryRun.mockClear();
        mockQueryGet.mockClear();
        mockCustomersCreate.mockReturnValue(Promise.resolve({ id: 'cus_mock123', email: 'test@example.com' }));
    });

    test('should call stripe.customers.create with correct email and metadata', async () => {
        const result = await createCustomer('user-1', 'user@example.com');
        expect(mockCustomersCreate).toHaveBeenCalledTimes(1);
        const callArgs = mockCustomersCreate.mock.calls[0][0];
        expect(callArgs.email).toBe('user@example.com');
        expect(callArgs.metadata.vaultlister_user_id).toBe('user-1');
    });

    test('should update user stripe_customer_id in the database', async () => {
        await createCustomer('user-1', 'user@example.com');
        expect(mockQueryRun).toHaveBeenCalled();
        const sql = mockQueryRun.mock.calls[0][0];
        expect(sql).toContain('UPDATE users');
        expect(sql).toContain('stripe_customer_id');
    });

    test('should return the customer object from Stripe', async () => {
        const result = await createCustomer('user-1', 'user@example.com');
        expect(result).toHaveProperty('id', 'cus_mock123');
        expect(result).toHaveProperty('email', 'test@example.com');
    });

    test('should throw when Stripe API returns an error', async () => {
        mockCustomersCreate.mockReturnValue(Promise.reject(new Error('Stripe API error')));
        await expect(createCustomer('user-1', 'user@example.com')).rejects.toThrow('Stripe API error');
    });
});

describe('stripeService — createCheckoutSession()', () => {
    beforeEach(() => {
        mockQueryGet.mockClear();
        mockCustomersCreate.mockClear();
        mockSessionsCreate.mockClear();
        mockQueryGet.mockReturnValue({ id: 'user-1', email: 'user@example.com', stripe_customer_id: 'cus_existing123' });
        mockSessionsCreate.mockReturnValue(Promise.resolve({ id: 'cs_mock123', url: 'https://checkout.stripe.com/mock' }));
    });

    test('should return a checkout session', async () => {
        const session = await createCheckoutSession('user-1', 'price_pro', 'https://success.com', 'https://cancel.com');
        expect(session).toHaveProperty('id', 'cs_mock123');
    });

    test('should throw when user is not found', async () => {
        mockQueryGet.mockReturnValue(null);
        await expect(
            createCheckoutSession('unknown-user', 'price_pro', 'https://success.com', 'https://cancel.com')
        ).rejects.toThrow('User not found');
    });

    test('should create a new customer when user has no stripe_customer_id', async () => {
        mockQueryGet.mockReturnValue({ id: 'user-2', email: 'new@example.com', stripe_customer_id: null });
        mockCustomersCreate.mockReturnValue(Promise.resolve({ id: 'cus_new456', email: 'new@example.com' }));
        await createCheckoutSession('user-2', 'price_starter', 'https://success.com', 'https://cancel.com');
        expect(mockCustomersCreate).toHaveBeenCalledTimes(1);
    });

    test('should use existing customer ID when user already has stripe_customer_id', async () => {
        await createCheckoutSession('user-1', 'price_pro', 'https://success.com', 'https://cancel.com');
        expect(mockCustomersCreate).not.toHaveBeenCalled();
    });
});

describe('stripeService — createPortalSession()', () => {
    beforeEach(() => {
        mockPortalCreate.mockClear();
        mockPortalCreate.mockReturnValue(Promise.resolve({ id: 'bps_mock123', url: 'https://billing.stripe.com/mock' }));
    });

    test('should return a billing portal session', async () => {
        const session = await createPortalSession('cus_123', 'https://return.com');
        expect(session).toHaveProperty('id', 'bps_mock123');
    });

    test('should call billingPortal.sessions.create with correct args', async () => {
        await createPortalSession('cus_abc', 'https://return.example.com');
        expect(mockPortalCreate).toHaveBeenCalledWith({
            customer: 'cus_abc',
            return_url: 'https://return.example.com'
        });
    });

    test('should throw when Stripe API fails', async () => {
        mockPortalCreate.mockReturnValue(Promise.reject(new Error('Portal session error')));
        await expect(createPortalSession('cus_abc', 'https://return.com')).rejects.toThrow('Portal session error');
    });
});

describe('stripeService — cancelSubscription()', () => {
    beforeEach(() => {
        mockSubsCancel.mockClear();
        mockSubsCancel.mockReturnValue(Promise.resolve({ id: 'sub_mock123', status: 'canceled' }));
    });

    test('should cancel a subscription and return it', async () => {
        const result = await cancelSubscription('sub_123');
        expect(result).toHaveProperty('status', 'canceled');
    });

    test('should call subscriptions.cancel with the correct subscription ID', async () => {
        await cancelSubscription('sub_abc');
        expect(mockSubsCancel).toHaveBeenCalledWith('sub_abc');
    });

    test('should throw when Stripe API fails', async () => {
        mockSubsCancel.mockReturnValue(Promise.reject(new Error('Subscription not found')));
        await expect(cancelSubscription('sub_bad')).rejects.toThrow('Subscription not found');
    });
});

describe('stripeService — getSubscription()', () => {
    beforeEach(() => {
        mockSubsRetrieve.mockClear();
        mockSubsRetrieve.mockReturnValue(Promise.resolve({ id: 'sub_mock123', status: 'active' }));
    });

    test('should retrieve a subscription', async () => {
        const result = await getSubscription('sub_123');
        expect(result).toHaveProperty('id', 'sub_mock123');
        expect(result).toHaveProperty('status', 'active');
    });

    test('should expand items.data.price.product', async () => {
        await getSubscription('sub_123');
        const callArgs = mockSubsRetrieve.mock.calls[0];
        expect(callArgs[1]).toEqual({ expand: ['items.data.price.product'] });
    });
});

describe('stripeService — constructWebhookEvent()', () => {
    beforeEach(() => {
        mockConstructEvent.mockClear();
        mockConstructEvent.mockReturnValue({ type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } });
    });

    test('should construct a webhook event from raw body and signature', () => {
        const event = constructWebhookEvent('raw-body', 'sig-header');
        expect(event).toHaveProperty('type', 'checkout.session.completed');
    });

    test('should pass raw body, signature, and STRIPE_WEBHOOK_SECRET to Stripe', () => {
        constructWebhookEvent('raw-body', 'sig-header');
        const [body, sig, secret] = mockConstructEvent.mock.calls[0];
        expect(body).toBe('raw-body');
        expect(sig).toBe('sig-header');
        expect(secret).toBe('whsec_mock_for_unit_tests');
    });

    test('should throw when signature verification fails', () => {
        mockConstructEvent.mockImplementation(() => { throw new Error('Webhook signature verification failed'); });
        expect(() => constructWebhookEvent('bad-body', 'bad-sig')).toThrow('Webhook signature verification failed');
    });
});
