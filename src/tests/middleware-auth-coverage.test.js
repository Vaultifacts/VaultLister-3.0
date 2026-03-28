// middleware-auth-coverage.test.js — Coverage-focused tests for auth.js
// Tests authenticateToken (cookie, refresh rejection, expired sub, user not found),
// checkTierPermission (platforms, bulkActions, analytics, unknown tier), and edge cases.
// Uses real jsonwebtoken — no mock.module for jwt.
import { describe, expect, test, mock, beforeEach } from 'bun:test';
import jwt from 'jsonwebtoken';

// ── Mocks (only database.js and logger.js) ──────────────────────────────────

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
    models: {
        create: mock(), findById: mock(), findOne: mock(),
        findMany: mock(() => []), update: mock(), delete: mock(), count: mock(() => 0),
    },
    escapeLike: (str) => String(str).replace(/[%_\\]/g, '\\$&'),
    cleanupExpiredData: mock(() => ({})),
    initializeDatabase: mock(() => true),
    default: {},
}));

mock.module('../backend/shared/logger.js', () => {
    const l = {
        info: mock(), warn: mock(), error: mock(), debug: mock(),
        request: mock(), db: mock(), automation: mock(), bot: mock(),
        security: mock(), performance: mock(),
    };
    return { ...l, logger: l, createLogger: mock(() => l), default: l };
});

// ── Import module under test ────────────────────────────────────────────────

const {
    generateToken,
    generateRefreshToken,
    verifyToken,
    authenticateToken,
    checkTierPermission,
} = await import('../backend/middleware/auth.js');

// ── Test secret ─────────────────────────────────────────────────────────────

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests-only';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(headers = {}) {
    const h = new Map(Object.entries(headers));
    return { headers: { get: (name) => h.get(name) || null } };
}

function makeAccessToken(payload = {}, secret = TEST_SECRET) {
    return jwt.sign(
        {
            userId: payload.userId || 'user-1',
            email: payload.email || 'test@example.com',
            tier: payload.tier || 'pro',
            type: 'access',
            iss: 'vaultlister',
            aud: 'vaultlister-api',
            ...payload,
        },
        secret,
        { expiresIn: payload.expiresIn || '15m', algorithm: 'HS256' }
    );
}

function makeRefreshToken(payload = {}, secret = TEST_SECRET) {
    return jwt.sign(
        {
            userId: payload.userId || 'user-1',
            type: 'refresh',
            jti: 'test-jti',
            iss: 'vaultlister',
            aud: 'vaultlister-api',
            ...payload,
        },
        secret,
        { expiresIn: payload.expiresIn || '7d', algorithm: 'HS256' }
    );
}

const activeUser = {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    username: 'testuser',
    subscription_tier: 'pro',
    subscription_expires_at: null,
    avatar_url: null,
    is_active: 1,
    email_verified: 1,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
};

// ── Reset mocks ─────────────────────────────────────────────────────────────

beforeEach(() => {
    mockQueryGet.mockReset();
    mockQueryGet.mockReturnValue(null);
    mockQueryAll.mockReset();
    mockQueryAll.mockReturnValue([]);
    mockQueryRun.mockReset();
    mockQueryRun.mockReturnValue({ changes: 1 });
});

// ═══════════════════════════════════════════════════════════════════════════
// authenticateToken
// ═══════════════════════════════════════════════════════════════════════════

describe('authenticateToken — Bearer header', () => {
    test('returns success with valid Bearer token', async () => {
        const token = makeAccessToken({ userId: 'user-1' });
        mockQueryGet.mockReturnValue({ ...activeUser });

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(true);
        expect(result.user.id).toBe('user-1');
    });

    test('returns error when no Authorization header', async () => {
        const result = await authenticateToken(makeRequest({}));
        expect(result.success).toBe(false);
        expect(result.error).toBe('No token provided');
    });

    test('returns error for Authorization header without Bearer prefix', async () => {
        const token = makeAccessToken();
        const result = await authenticateToken(makeRequest({ Authorization: `Basic ${token}` }));
        // Falls through to cookie check, no cookie either
        expect(result.success).toBe(false);
        expect(result.error).toBe('No token provided');
    });

    test('returns error for empty Bearer token', async () => {
        const result = await authenticateToken(makeRequest({ Authorization: 'Bearer ' }));
        // token will be empty string, jwt.verify will fail
        expect(result.success).toBe(false);
    });
});

describe('authenticateToken — Cookie-based token', () => {
    test('extracts token from vl_access cookie', async () => {
        const token = makeAccessToken({ userId: 'user-1' });
        mockQueryGet.mockReturnValue({ ...activeUser });

        const result = await authenticateToken(makeRequest({ Cookie: `vl_access=${token}` }));
        expect(result.success).toBe(true);
        expect(result.user.id).toBe('user-1');
    });

    test('extracts token from cookie among multiple cookies', async () => {
        const token = makeAccessToken({ userId: 'user-1' });
        mockQueryGet.mockReturnValue({ ...activeUser });

        const result = await authenticateToken(
            makeRequest({ Cookie: `session=abc; vl_access=${token}; theme=dark` })
        );
        expect(result.success).toBe(true);
        expect(result.user.id).toBe('user-1');
    });

    test('returns error when cookie header is empty', async () => {
        const result = await authenticateToken(makeRequest({ Cookie: '' }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('No token provided');
    });

    test('returns error when cookie header has no vl_access cookie', async () => {
        const result = await authenticateToken(makeRequest({ Cookie: 'session=abc; theme=dark' }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('No token provided');
    });

    test('Bearer header takes precedence over cookie', async () => {
        const bearerToken = makeAccessToken({ userId: 'user-bearer' });
        const cookieToken = makeAccessToken({ userId: 'user-cookie' });
        mockQueryGet.mockReturnValue({ ...activeUser, id: 'user-bearer' });

        const result = await authenticateToken(
            makeRequest({
                Authorization: `Bearer ${bearerToken}`,
                Cookie: `vl_access=${cookieToken}`,
            })
        );
        expect(result.success).toBe(true);
        expect(result.user.id).toBe('user-bearer');
    });
});

describe('authenticateToken — Token validation', () => {
    test('returns error for expired token', async () => {
        const token = jwt.sign(
            { userId: 'user-1', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            TEST_SECRET,
            { expiresIn: '-1s', algorithm: 'HS256' }
        );

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid or expired token');
    });

    test('returns error for token signed with wrong secret', async () => {
        const token = jwt.sign(
            { userId: 'user-1', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            'wrong-secret', // nosemgrep: javascript.jsonwebtoken.security.jwt-hardcode.hardcoded-jwt-secret -- intentional wrong secret for invalid-token test
            { expiresIn: '15m', algorithm: 'HS256' }
        );

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid or expired token');
    });

    test('returns error for tampered token', async () => {
        const token = makeAccessToken();
        const tampered = token.slice(0, -5) + 'XXXXX';

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${tampered}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid or expired token');
    });

    test('rejects refresh token used as access token', async () => {
        const token = makeRefreshToken({ userId: 'user-1' });
        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid token type');
    });

    test('returns error for token with wrong issuer', async () => {
        const token = jwt.sign(
            { userId: 'user-1', type: 'access', iss: 'other-app', aud: 'vaultlister-api' },
            TEST_SECRET,
            { expiresIn: '15m', algorithm: 'HS256' }
        );

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid or expired token');
    });

    test('returns error for token with wrong audience', async () => {
        const token = jwt.sign(
            { userId: 'user-1', type: 'access', iss: 'vaultlister', aud: 'other-api' },
            TEST_SECRET,
            { expiresIn: '15m', algorithm: 'HS256' }
        );

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid or expired token');
    });
});

describe('authenticateToken — User lookup', () => {
    test('returns error when user not found in database', async () => {
        mockQueryGet.mockReturnValue(null);
        const token = makeAccessToken({ userId: 'nonexistent' });

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('User not found');
    });

    test('queries database with decoded userId', async () => {
        const token = makeAccessToken({ userId: 'user-42' });
        mockQueryGet.mockReturnValue({ ...activeUser, id: 'user-42' });

        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));
        expect(result.success).toBe(true);

        // Verify query.get was called with the userId
        const call = mockQueryGet.mock.calls[0];
        expect(call[0]).toContain('WHERE id = ?');
        expect(call[1]).toEqual(['user-42']);
    });
});

describe('authenticateToken — Subscription expiry downgrade', () => {
    test('downgrades expired pro subscription to free', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
        mockQueryGet.mockReturnValue({
            ...activeUser,
            subscription_tier: 'pro',
            subscription_expires_at: pastDate,
        });

        const token = makeAccessToken({ userId: 'user-1' });
        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));

        expect(result.success).toBe(true);
        expect(result.user.subscription_tier).toBe('free');
    });

    test('downgrades expired starter subscription to free', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryGet.mockReturnValue({
            ...activeUser,
            subscription_tier: 'starter',
            subscription_expires_at: pastDate,
        });

        const token = makeAccessToken({ userId: 'user-1' });
        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));

        expect(result.success).toBe(true);
        expect(result.user.subscription_tier).toBe('free');
    });

    test('does NOT downgrade when subscription is still active', async () => {
        const futureDate = new Date(Date.now() + 86400000 * 30).toISOString(); // 30 days ahead
        mockQueryGet.mockReturnValue({
            ...activeUser,
            subscription_tier: 'pro',
            subscription_expires_at: futureDate,
        });

        const token = makeAccessToken({ userId: 'user-1' });
        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));

        expect(result.success).toBe(true);
        expect(result.user.subscription_tier).toBe('pro');
    });

    test('does NOT downgrade free tier even with expired date', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        mockQueryGet.mockReturnValue({
            ...activeUser,
            subscription_tier: 'free',
            subscription_expires_at: pastDate,
        });

        const token = makeAccessToken({ userId: 'user-1' });
        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));

        expect(result.success).toBe(true);
        expect(result.user.subscription_tier).toBe('free');
    });

    test('does NOT downgrade when subscription_expires_at is null', async () => {
        mockQueryGet.mockReturnValue({
            ...activeUser,
            subscription_tier: 'pro',
            subscription_expires_at: null,
        });

        const token = makeAccessToken({ userId: 'user-1' });
        const result = await authenticateToken(makeRequest({ Authorization: `Bearer ${token}` }));

        expect(result.success).toBe(true);
        expect(result.user.subscription_tier).toBe('pro');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// generateToken & generateRefreshToken — edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('generateToken — additional edge cases', () => {
    test('includes issuer and audience claims', () => {
        const token = generateToken({ id: 'u1', email: 'a@b.com', subscription_tier: 'free' });
        const decoded = jwt.decode(token);
        expect(decoded.iss).toBe('vaultlister');
        expect(decoded.aud).toBe('vaultlister-api');
        expect(decoded.type).toBe('access');
    });

    test('includes subscription_tier in token payload', () => {
        const token = generateToken({ id: 'u1', email: 'a@b.com', subscription_tier: 'starter' });
        const decoded = jwt.decode(token);
        expect(decoded.tier).toBe('starter');
    });
});

describe('generateRefreshToken — additional edge cases', () => {
    test('includes jti (unique identifier) claim', () => {
        const token = generateRefreshToken({ id: 'u1' });
        const decoded = jwt.decode(token);
        expect(decoded.jti).toBeDefined();
        expect(typeof decoded.jti).toBe('string');
        expect(decoded.jti.length).toBeGreaterThan(0);
    });

    test('generates unique jti for each call', () => {
        const t1 = generateRefreshToken({ id: 'u1' });
        const t2 = generateRefreshToken({ id: 'u1' });
        const d1 = jwt.decode(t1);
        const d2 = jwt.decode(t2);
        expect(d1.jti).not.toBe(d2.jti);
    });

    test('includes issuer and audience claims', () => {
        const token = generateRefreshToken({ id: 'u1' });
        const decoded = jwt.decode(token);
        expect(decoded.iss).toBe('vaultlister');
        expect(decoded.aud).toBe('vaultlister-api');
        expect(decoded.type).toBe('refresh');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// checkTierPermission — comprehensive branch coverage
// ═══════════════════════════════════════════════════════════════════════════

describe('checkTierPermission — listings feature', () => {
    test('pro tier gets unlimited listings (maxListings = -1)', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'pro' }, 'listings');
        expect(result.allowed).toBe(true);
        // unlimited = no limit/current fields
    });

    test('free tier checks listing count against limit', () => {
        mockQueryGet.mockReturnValue({ count: 10 });
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'listings');
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(25);
        expect(result.current).toBe(10);
    });

    test('free tier disallowed when at listing limit', () => {
        mockQueryGet.mockReturnValue({ count: 25 });
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'listings');
        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(25);
        expect(result.current).toBe(25);
    });

    test('starter tier has 150 listing limit', () => {
        mockQueryGet.mockReturnValue({ count: 100 });
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'starter' }, 'listings');
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(150);
        expect(result.current).toBe(100);
    });

    test('handles null count from database', () => {
        mockQueryGet.mockReturnValue(null);
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'listings');
        expect(result.allowed).toBe(true);
        expect(result.current).toBe(0);
    });
});

describe('checkTierPermission — platforms feature', () => {
    test('pro tier gets unlimited platforms', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'pro' }, 'platforms');
        expect(result.allowed).toBe(true);
    });

    test('free tier checks platform count against limit of 2', () => {
        mockQueryGet.mockReturnValue({ count: 1 });
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'platforms');
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(2);
        expect(result.current).toBe(1);
    });

    test('free tier disallowed when at platform limit', () => {
        mockQueryGet.mockReturnValue({ count: 2 });
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'platforms');
        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(2);
        expect(result.current).toBe(2);
    });

    test('starter tier has 5 platform limit', () => {
        mockQueryGet.mockReturnValue({ count: 3 });
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'starter' }, 'platforms');
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(5);
        expect(result.current).toBe(3);
    });

    test('handles null count from database for platforms', () => {
        mockQueryGet.mockReturnValue(null);
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'platforms');
        expect(result.allowed).toBe(true);
        expect(result.current).toBe(0);
    });
});

describe('checkTierPermission — bulkActions feature', () => {
    test('free tier cannot use bulk actions', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'bulkActions');
        expect(result.allowed).toBe(false);
    });

    test('starter tier can use bulk actions', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'starter' }, 'bulkActions');
        expect(result.allowed).toBe(true);
    });

    test('pro tier can use bulk actions', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'pro' }, 'bulkActions');
        expect(result.allowed).toBe(true);
    });
});

describe('checkTierPermission — analytics feature', () => {
    test('free tier gets basic analytics', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'analytics');
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('basic');
    });

    test('starter tier gets standard analytics', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'starter' }, 'analytics');
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('standard');
    });

    test('pro tier gets advanced analytics', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'pro' }, 'analytics');
        expect(result.allowed).toBe(true);
        expect(result.level).toBe('advanced');
    });
});

describe('checkTierPermission — unknown tier fallback', () => {
    test('unknown tier falls back to free tier limits', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'enterprise' }, 'automations');
        expect(result.allowed).toBe(false); // free tier does not allow automations
    });

    test('undefined tier falls back to free tier limits', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: undefined }, 'aiFeatures');
        expect(result.allowed).toBe(false); // free tier does not allow AI features
    });

    test('null tier falls back to free tier limits', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: null }, 'bulkActions');
        expect(result.allowed).toBe(false); // free tier does not allow bulk actions
    });
});

describe('checkTierPermission — default case', () => {
    test('unknown feature returns allowed true', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'free' }, 'unknownFeature');
        expect(result.allowed).toBe(true);
    });

    test('empty string feature returns allowed true', () => {
        const result = checkTierPermission({ id: 'u1', subscription_tier: 'pro' }, '');
        expect(result.allowed).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// verifyToken — additional edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe('verifyToken — additional edge cases', () => {
    test('returns null for completely invalid string', () => {
        expect(verifyToken('not.a.jwt')).toBeNull();
    });

    test('returns null for random garbage', () => {
        expect(verifyToken('xyzabc123')).toBeNull();
    });

    test('rejects token with HS384 algorithm', () => {
        const token = jwt.sign(
            { userId: 'u1', type: 'access', iss: 'vaultlister', aud: 'vaultlister-api' },
            TEST_SECRET,
            { expiresIn: '15m', algorithm: 'HS384' }
        );
        // verifyToken only allows HS256
        expect(verifyToken(token)).toBeNull();
    });
});
