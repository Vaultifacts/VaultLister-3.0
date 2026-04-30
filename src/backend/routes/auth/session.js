import { v4 as uuidv4 } from 'uuid';
import { query } from '../../db/database.js';
import { generateToken, generateRefreshToken, verifyToken } from '../../middleware/auth.js';
import { applyRateLimit } from '../../middleware/rateLimiter.js';
import websocketService from '../../services/websocket.js';
import { logger } from '../../shared/logger.js';
import { enforceSessionLimit, authCookies, clearAuthCookies } from './helpers.js';

export async function handleRefresh(ctx) {
    const { body } = ctx;
    const ip = ctx.ip || 'unknown';
    const userAgent = ctx.userAgent || 'unknown';
    try {
        const refreshRateError = await applyRateLimit(ctx, 'auth');
        if (refreshRateError) return refreshRateError;

        const { refreshToken } = body;

        if (!refreshToken) {
            return { status: 400, data: { error: 'Refresh token required' } };
        }

        const decoded = verifyToken(refreshToken);
        if (!decoded || decoded.type !== 'refresh') {
            return { status: 401, data: { error: 'Invalid refresh token' } };
        }

        // Check session exists and is still valid
        const session = await query.get(
            'SELECT * FROM sessions WHERE refresh_token = ? AND is_valid = 1 AND expires_at > NOW()',
            [refreshToken],
        );

        if (!session) {
            return { status: 401, data: { error: 'Session expired' } };
        }

        const user = await query.get(
            'SELECT id, email, username, full_name, is_active, email_verified, mfa_enabled, created_at FROM users WHERE id = ? AND is_active = TRUE',
            [decoded.userId],
        );
        if (!user) {
            return { status: 401, data: { error: 'User not found' } };
        }

        // SECURITY: Refresh token rotation — invalidate the old session immediately
        // to prevent replay attacks. A new session with a fresh refresh token is issued.
        await query.run('UPDATE sessions SET is_valid = 0 WHERE id = ?', [session.id]);

        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        // SECURITY: Cap concurrent sessions before inserting the new one
        await enforceSessionLimit(user.id);

        await query.run(
            `
            INSERT INTO sessions (id, user_id, refresh_token, device_info, ip_address, expires_at)
            VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '7 days')
        `,
            [uuidv4(), user.id, newRefreshToken, session.device_info || userAgent, session.ip_address || ip],
        );

        return {
            status: 200,
            data: { token: newToken, refreshToken: newRefreshToken },
            cookies: authCookies(newToken, newRefreshToken),
        };
    } catch (error) {
        logger.error('[Auth] Error during token refresh', null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

export async function handleLogout(ctx) {
    const { body } = ctx;
    try {
        const { refreshToken } = body;

        if (refreshToken) {
            // Verify the refresh token belongs to the requesting user (if authenticated)
            // before invalidating. This prevents cross-user session invalidation.
            if (ctx.user) {
                await query.run(
                    'UPDATE sessions SET is_valid = 0 WHERE refresh_token = ? AND user_id = ? AND is_valid = 1',
                    [refreshToken, ctx.user.id],
                );
            } else {
                // Unauthenticated logout (expired access token) — refresh token is bearer credential
                await query.run('UPDATE sessions SET is_valid = 0 WHERE refresh_token = ? AND is_valid = 1', [
                    refreshToken,
                ]);
            }
        } else if (ctx.user) {
            // No refresh token provided but user is authenticated — invalidate all their sessions
            await query.run('UPDATE sessions SET is_valid = 0 WHERE user_id = ? AND is_valid = 1', [ctx.user.id]);
        }

        // Close any active WebSocket connections for this user
        if (ctx.user) {
            try {
                websocketService.disconnectAllForUser(ctx.user.id);
            } catch {
                /* non-fatal */
            }
        }

        return {
            status: 200,
            data: { message: 'Logged out successfully' },
            cookies: clearAuthCookies(),
        };
    } catch (error) {
        logger.error('[Auth] Error during logout', null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

export async function handleMe(ctx) {
    const authHeader = ctx.request.headers.get('Authorization');
    if (!authHeader) {
        return { status: 401, data: { error: 'Not authenticated' } };
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return { status: 401, data: { error: 'Invalid token' } };
    }

    const user = await query.get(
        'SELECT id, email, username, full_name, is_active, email_verified, mfa_enabled, subscription_tier, subscription_expires_at, is_affiliate, affiliate_applied_at, created_at, last_login_at FROM users WHERE id = ?',
        [decoded.userId],
    );
    if (!user) {
        return { status: 404, data: { error: 'User not found' } };
    }
    return { status: 200, data: { user } };
}

export async function handleOauthSession(ctx) {
    const ott = ctx.query?.ott;
    if (!ott) {
        return { status: 400, data: { error: 'Missing one-time token' } };
    }
    const session = await query.get(
        `SELECT id, user_id, refresh_token FROM sessions WHERE id = ? AND is_valid = 1 AND created_at > NOW() - INTERVAL '5 minutes'`,
        [ott],
    );
    if (!session) {
        return { status: 401, data: { error: 'Invalid or expired sign-in link. Please try again.' } };
    }
    const freshUser = await query.get(
        'SELECT id, email, username, full_name, avatar_url, subscription_tier, is_active, email_verified, created_at, updated_at, last_login_at FROM users WHERE id = ?',
        [session.user_id],
    );
    if (!freshUser) {
        return { status: 401, data: { error: 'User not found' } };
    }
    const token = generateToken(freshUser);
    return {
        status: 200,
        data: { token, refreshToken: session.refresh_token, user: freshUser },
    };
}

export async function handleSessionStatus(ctx) {
    const { user } = ctx;
    if (!user) return { status: 401, data: { error: 'Not authenticated' } };

    const authHeader = ctx.request.headers.get('Authorization');
    const cookieHeader = ctx.request.headers.get('Cookie') || '';
    let token;
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else {
        const match = cookieHeader.match(/(?:^|;\s*)vl_access=([^;]+)/);
        token = match?.[1];
    }

    const decoded = token ? verifyToken(token) : null;

    const rawExpiry = parseInt(process.env.MFA_SESSION_EXPIRY_SECONDS || '3600', 10);
    const MFA_EXPIRY_SECONDS = Number.isFinite(rawExpiry) ? rawExpiry : 3600;
    const INACTIVITY_TIMEOUT_SECONDS = parseInt(process.env.INACTIVITY_TIMEOUT_SECONDS || '1800', 10);

    const now = Math.floor(Date.now() / 1000);
    const mfaVerifiedAt = decoded?.mfa_verified_at || null;
    const mfaExpired = mfaVerifiedAt ? now - mfaVerifiedAt > MFA_EXPIRY_SECONDS : false;

    return {
        status: 200,
        data: {
            mfaVerifiedAt,
            mfaExpired,
            mfaExpirySeconds: MFA_EXPIRY_SECONDS,
            inactivityTimeoutSeconds: INACTIVITY_TIMEOUT_SECONDS,
            tokenExp: decoded?.exp || null,
            serverTime: now,
        },
    };
}

export async function handleSessions(ctx) {
    const authHeader = ctx.request.headers.get('Authorization');
    if (!authHeader) return { status: 401, data: { error: 'Authentication required' } };
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) return { status: 401, data: { error: 'Invalid token' } };

    const sessions = await query.all(
        `SELECT id, device_info, ip_address, created_at, expires_at,
                CASE WHEN refresh_token = ? THEN 1 ELSE 0 END as current
         FROM sessions
         WHERE user_id = ? AND is_valid = 1 AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [ctx.refreshToken || '', decoded.userId],
    );

    return { status: 200, data: sessions };
}

export async function handleDeleteSession(ctx) {
    const { path } = ctx;
    const authHeader = ctx.request.headers.get('Authorization');
    if (!authHeader) return { status: 401, data: { error: 'Authentication required' } };
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) return { status: 401, data: { error: 'Invalid token' } };

    const sessionId = path.split('/')[2];

    const result = await query.run('UPDATE sessions SET is_valid = 0 WHERE id = ? AND user_id = ?', [
        sessionId,
        decoded.userId,
    ]);

    if (result.changes === 0) {
        return { status: 404, data: { error: 'Session not found' } };
    }

    return { status: 200, data: { message: 'Session revoked' } };
}

export async function handleRevokeAllSessions(ctx) {
    const authHeader = ctx.request.headers.get('Authorization');
    if (!authHeader) return { status: 401, data: { error: 'Authentication required' } };
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (!decoded) return { status: 401, data: { error: 'Invalid token' } };

    const result = await query.run(
        `UPDATE sessions SET is_valid = 0
         WHERE user_id = ? AND is_valid = 1
         AND refresh_token != ?`,
        [decoded.userId, ctx.refreshToken || ''],
    );

    return { status: 200, data: { message: 'All other sessions revoked', count: result.changes } };
}
