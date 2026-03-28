// JWT Authentication Middleware
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';

// SECURITY: Require JWT_SECRET from environment - fail if not set in production
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_OLD = process.env.JWT_SECRET_OLD || null; // For key rotation window
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!JWT_SECRET && IS_PRODUCTION) {
    logger.error('[Auth] FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
}

if (JWT_SECRET && JWT_SECRET.length < 32) {
    if (IS_PRODUCTION) {
        logger.error('[Auth] FATAL: JWT_SECRET must be at least 32 characters long');
        process.exit(1);
    } else {
        logger.warn('[Auth] WARNING: JWT_SECRET is shorter than 32 characters — use a stronger secret in production');
    }
}

if (JWT_SECRET_OLD) {
    logger.info('[Auth] JWT_SECRET_OLD is set — dual-key verification enabled for rotation window');
}

// Use fallback only in development/test with warning
const EFFECTIVE_SECRET = JWT_SECRET || (() => {
    logger.warn('[Auth] WARNING: Using default JWT secret. Set JWT_SECRET in production!');
    return 'dev-only-secret-not-for-production';
})();

// JWT algorithm - explicitly set to prevent algorithm confusion attacks
const JWT_ALGORITHM = 'HS256';

// Token expiry times - shorter access tokens for security
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes (was 7 days)
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 days (was 30 days)

export function generateToken(user, expiresIn = ACCESS_TOKEN_EXPIRY, extra = {}) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            tier: user.subscription_tier,
            type: 'access',
            iss: 'vaultlister',
            aud: 'vaultlister-api',
            ...extra
        },
        EFFECTIVE_SECRET,
        { expiresIn, algorithm: JWT_ALGORITHM }
    );
}

export function generateRefreshToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            type: 'refresh',
            jti: uuidv4(),
            iss: 'vaultlister',
            aud: 'vaultlister-api'
        },
        EFFECTIVE_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: JWT_ALGORITHM }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, EFFECTIVE_SECRET, {
            algorithms: [JWT_ALGORITHM],
            issuer: 'vaultlister',
            audience: 'vaultlister-api'
        });
    } catch (error) {
        // During key rotation: try the old secret before rejecting
        if (JWT_SECRET_OLD) {
            try {
                return jwt.verify(token, JWT_SECRET_OLD, {
                    algorithms: [JWT_ALGORITHM],
                    issuer: 'vaultlister',
                    audience: 'vaultlister-api'
                });
            } catch {
                return null;
            }
        }
        return null;
    }
}

export async function authenticateToken(request) {
    const authHeader = request.headers.get('Authorization');

    // Accept token from Authorization: Bearer header OR the vl_access HttpOnly cookie.
    // Cookie is preferred when present (XSS-safe); header stays supported for API clients.
    let token;
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else {
        const cookieHeader = request.headers.get('Cookie') || '';
        const match = cookieHeader.match(/(?:^|;\s*)vl_access=([^;]+)/);
        token = match?.[1];
    }

    if (!token) {
        return { success: false, error: 'No token provided' };
    }
    const decoded = verifyToken(token);

    if (!decoded) {
        return { success: false, error: 'Invalid or expired token' };
    }

    // Reject refresh tokens used as access tokens
    if (decoded.type === 'refresh') {
        return { success: false, error: 'Invalid token type' };
    }

    // Get user from database (exclude password_hash for security)
    const user = await query.get(
        'SELECT id, email, full_name, username, subscription_tier, subscription_expires_at, avatar_url, is_active, is_admin, email_verified, created_at, updated_at FROM users WHERE id = ? AND is_active = TRUE',
        [decoded.userId]
    );

    if (!user) {
        return { success: false, error: 'User not found' };
    }

    // SECURITY: Subscription expiry check — if the user's paid subscription has expired,
    // downgrade the effective tier to 'free' in the returned object without blocking access.
    // The original DB row is not modified; only the in-memory user object is adjusted.
    if (
        user.subscription_expires_at &&
        user.subscription_tier !== 'free' &&
        new Date(user.subscription_expires_at) < new Date()
    ) {
        logger.info(`[Auth] Subscription expired for user ${user.id} (was ${user.subscription_tier}), downgrading to free`);
        user.subscription_tier = 'free';
    }

    return { success: true, user };
}

// Check subscription tier permissions
export async function checkTierPermission(user, feature) {
    const tierLimits = {
        free: {
            maxListings: 25,
            maxPlatforms: 2,
            automations: false,
            analytics: 'basic',
            bulkActions: false,
            aiFeatures: false
        },
        starter: {
            maxListings: 150,
            maxPlatforms: 5,
            automations: true,
            analytics: 'standard',
            bulkActions: true,
            aiFeatures: true
        },
        pro: {
            maxListings: -1,
            maxPlatforms: -1,
            automations: true,
            analytics: 'advanced',
            bulkActions: true,
            aiFeatures: true
        }
    };

    const limits = tierLimits[user.subscription_tier] || tierLimits.free;

    switch (feature) {
        case 'listings':
            if (limits.maxListings === -1) return { allowed: true };
            const currentListings = (await query.get(
                'SELECT COUNT(*) as count FROM inventory WHERE user_id = ?',
                [user.id]
            ))?.count || 0;
            return {
                allowed: currentListings < limits.maxListings,
                limit: limits.maxListings,
                current: currentListings
            };

        case 'platforms':
            if (limits.maxPlatforms === -1) return { allowed: true };
            const currentPlatforms = (await query.get(
                'SELECT COUNT(*) as count FROM shops WHERE user_id = ? AND is_connected = TRUE',
                [user.id]
            ))?.count || 0;
            return {
                allowed: currentPlatforms < limits.maxPlatforms,
                limit: limits.maxPlatforms,
                current: currentPlatforms
            };

        case 'automations':
            return { allowed: limits.automations };

        case 'bulkActions':
            return { allowed: limits.bulkActions };

        case 'aiFeatures':
            return { allowed: limits.aiFeatures };

        case 'analytics':
            return { allowed: true, level: limits.analytics };

        default:
            return { allowed: true };
    }
}
