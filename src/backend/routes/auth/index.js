import { handleRegister, handleVerifyEmail, handleResendVerification } from './register.js';
import { handleLogin, handleDemoLogin, handleMfaVerify } from './login.js';
import {
    handleRefresh,
    handleLogout,
    handleMe,
    handleOauthSession,
    handleSessionStatus,
    handleSessions,
    handleDeleteSession,
    handleRevokeAllSessions,
} from './session.js';
import { handleProfile, handlePassword, handlePasswordReset, handlePasswordResetConfirm } from './account.js';

export async function authRouter(ctx) {
    const { method, path } = ctx;
    if (method === 'POST' && path === '/register') return handleRegister(ctx);
    if (method === 'POST' && path === '/login') return handleLogin(ctx);
    if (process.env.NODE_ENV !== 'production' && method === 'POST' && path === '/demo-login')
        return handleDemoLogin(ctx);
    if (method === 'POST' && path === '/mfa-verify') return handleMfaVerify(ctx);
    if (method === 'POST' && path === '/refresh') return handleRefresh(ctx);
    if (method === 'POST' && path === '/logout') return handleLogout(ctx);
    if (method === 'GET' && path === '/me') return handleMe(ctx);
    if (method === 'GET' && path === '/oauth-session') return handleOauthSession(ctx);
    if (method === 'GET' && path === '/session-status') return handleSessionStatus(ctx);
    if (method === 'PUT' && path === '/profile') return handleProfile(ctx);
    if (method === 'PUT' && path === '/password') return handlePassword(ctx);
    if (method === 'GET' && path === '/sessions') return handleSessions(ctx);
    if (method === 'DELETE' && path.match(/^\/sessions\/[^/]+$/)) return handleDeleteSession(ctx);
    if (method === 'POST' && path === '/sessions/revoke-all') return handleRevokeAllSessions(ctx);
    if (method === 'POST' && path === '/password-reset') return handlePasswordReset(ctx);
    if (method === 'POST' && path === '/password-reset/confirm') return handlePasswordResetConfirm(ctx);
    if (method === 'GET' && path === '/verify-email') return handleVerifyEmail(ctx);
    if (method === 'POST' && path === '/resend-verification') return handleResendVerification(ctx);
    return { status: 404, data: { error: 'Route not found' } };
}
