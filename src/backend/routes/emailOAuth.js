// Email OAuth Routes for VaultLister
// Handles Gmail and Outlook OAuth flow and email account management

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { encryptToken, decryptToken, generateStateToken } from '../utils/encryption.js';
import { getUserEmail } from '../services/gmailService.js';
import { getUserEmail as getOutlookUserEmail } from '../services/outlookService.js';
import { DEFAULT_RECEIPT_SENDERS } from '../services/receiptDetector.js';
import { queueTask } from '../workers/taskWorker.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

// Gmail OAuth configuration
const GMAIL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
];

// Outlook/Microsoft OAuth configuration
const OUTLOOK_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const OUTLOOK_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const OUTLOOK_SCOPES = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/User.Read',
    'offline_access',
];

export async function emailOAuthRouter(ctx) {
    try {
        const { method, path, body, user, query: queryParams } = ctx;

        // Helper to require authentication
        const requireAuth = () => {
            if (!user) {
                return { status: 401, data: { error: 'Authentication required' } };
            }
            return null;
        };

        // GET /api/email/providers - List supported providers (public)
        if (method === 'GET' && path === '/providers') {
            const gmailConfigured = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
            const outlookConfigured = !!(process.env.OUTLOOK_CLIENT_ID && process.env.OUTLOOK_CLIENT_SECRET);

            return {
                status: 200,
                data: {
                    providers: [
                        {
                            id: 'gmail',
                            name: 'Gmail',
                            icon: 'gmail',
                            configured: gmailConfigured,
                            description: 'Connect your Gmail to automatically import receipts',
                        },
                        {
                            id: 'outlook',
                            name: 'Outlook',
                            icon: 'outlook',
                            configured: outlookConfigured,
                            description: 'Connect your Outlook/Microsoft account to import receipts',
                        },
                    ],
                    defaultSenders: DEFAULT_RECEIPT_SENDERS,
                },
            };
        }

        // GET /api/email/authorize/gmail - Start Gmail OAuth flow (requires auth)
        if (method === 'GET' && path === '/authorize/gmail') {
            const authError = requireAuth();
            if (authError) return authError;

            const clientId = process.env.GMAIL_CLIENT_ID;
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const redirectUri = `${baseUrl}/api/email/callback/gmail`;

            if (!clientId) {
                return {
                    status: 400,
                    data: { error: 'Gmail OAuth not configured. Set GMAIL_CLIENT_ID in environment.' },
                };
            }

            // Generate state token for CSRF protection
            const stateToken = generateStateToken();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            // Store state in database
            await query.run(
                `
            INSERT INTO email_oauth_states (id, user_id, provider, state_token, redirect_uri, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
                [uuidv4(), user.id, 'gmail', stateToken, redirectUri, expiresAt.toISOString()],
            );

            // Build authorization URL
            const authUrl = new URL(GMAIL_AUTH_URL);
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', GMAIL_SCOPES.join(' '));
            authUrl.searchParams.set('state', stateToken);
            authUrl.searchParams.set('access_type', 'offline');
            authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

            return {
                status: 200,
                data: {
                    authorizationUrl: authUrl.toString(),
                    state: stateToken,
                },
            };
        }

        // GET /api/email/callback/gmail - Handle Gmail OAuth callback
        if (method === 'GET' && path === '/callback/gmail') {
            const { code, state, error } = queryParams;

            if (error) {
                return {
                    status: 400,
                    data: { error: `OAuth error: ${error}` },
                };
            }

            if (!code || !state) {
                return {
                    status: 400,
                    data: { error: 'Missing authorization code or state' },
                };
            }

            // Verify state token
            const stateRecord = await query.get(
                `
            SELECT * FROM email_oauth_states
            WHERE state_token = ? AND expires_at > NOW()
        `,
                [state],
            );

            if (!stateRecord) {
                return {
                    status: 400,
                    data: { error: 'Invalid or expired state token' },
                };
            }

            // Clean up used state
            await query.run('DELETE FROM email_oauth_states WHERE id = ?', [stateRecord.id]);

            try {
                const clientId = process.env.GMAIL_CLIENT_ID;
                const clientSecret = process.env.GMAIL_CLIENT_SECRET;

                // Exchange code for tokens
                const tokenResponse = await fetch(GMAIL_TOKEN_URL, {
                    method: 'POST',
                    signal: AbortSignal.timeout(15000),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        code: code,
                        redirect_uri: stateRecord.redirect_uri,
                        grant_type: 'authorization_code',
                    }),
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    throw new Error(`Token exchange failed: ${errorText}`);
                }

                const tokens = await tokenResponse.json();

                // Get user's email address
                const emailAddress = await getUserEmail(tokens.access_token);

                // Check if account already exists
                const existing = await query.get(
                    `
                SELECT id FROM email_accounts
                WHERE user_id = ? AND email_address = ?
            `,
                    [stateRecord.user_id, emailAddress],
                );

                const accountId = existing?.id || uuidv4();
                const now = new Date().toISOString();
                const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

                // Encrypt tokens
                const encryptedAccessToken = encryptToken(tokens.access_token);
                const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

                if (existing) {
                    // Update existing account
                    await query.run(
                        `
                    UPDATE email_accounts SET
                        oauth_token = ?,
                        oauth_refresh_token = COALESCE(?, oauth_refresh_token),
                        oauth_token_expires_at = ?,
                        is_enabled = TRUE,
                        consecutive_failures = 0,
                        last_error = NULL,
                        updated_at = ?
                    WHERE id = ? AND user_id = ?
                `,
                        [encryptedAccessToken, encryptedRefreshToken, expiresAt, now, accountId, stateRecord.user_id],
                    );
                } else {
                    // Create new account
                    await query.run(
                        `
                    INSERT INTO email_accounts (
                        id, user_id, email_address, provider,
                        oauth_token, oauth_refresh_token, oauth_token_expires_at,
                        filter_senders, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                        [
                            accountId,
                            stateRecord.user_id,
                            emailAddress,
                            'gmail',
                            encryptedAccessToken,
                            encryptedRefreshToken,
                            expiresAt,
                            JSON.stringify(DEFAULT_RECEIPT_SENDERS.slice(0, 10)), // Default to top 10 senders
                            now,
                            now,
                        ],
                    );
                }

                // Return HTML that closes popup and notifies parent
                return {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                    data: `
                    <!DOCTYPE html>
                    <html>
                    <head><title>Gmail Connected</title></head>
                    <body>
                        <div id="oauth-data" data-provider="gmail" data-email="${emailAddress.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])}"></div>
                        <script>
                            if (window.opener) {
                                var d = document.getElementById('oauth-data');
                                window.opener.postMessage({
                                    type: 'email-oauth-success',
                                    provider: d.dataset.provider,
                                    email: d.dataset.email
                                }, window.location.origin);
                                window.close();
                            } else {
                                document.body.innerHTML = '<h2>Gmail Connected Successfully!</h2><p>You can close this window.</p>';  // nosemgrep: javascript.browser.security.insecure-document-method
                            }
                        </script>
                        <h2>Gmail Connected Successfully!</h2>
                        <p>You can close this window.</p>
                    </body>
                    </html>
                `,
                };
            } catch (error) {
                logger.error('[EmailOAuth] Gmail OAuth callback error', user?.id || null, { detail: error.message });
                return {
                    status: 500,
                    headers: { 'Content-Type': 'text/html' },
                    data: `
                    <!DOCTYPE html>
                    <html>
                    <head><title>Connection Failed</title></head>
                    <body>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({
                                    type: 'email-oauth-error',
                                    provider: 'gmail',
                                    error: 'Authentication failed'
                                }, window.location.origin);
                                window.close();
                            }
                        </script>
                        <h2>Connection Failed</h2>
                        <p>Authentication failed. Please try again.</p>
                    </body>
                    </html>
                `,
                };
            }
        }

        // GET /api/email/accounts - List connected email accounts (requires auth)
        if (method === 'GET' && path === '/accounts') {
            const authError = requireAuth();
            if (authError) return authError;

            const accounts = await query.all(
                `
            SELECT id, email_address, provider, last_sync_at, sync_status,
                   consecutive_failures, last_error, is_enabled, filter_senders,
                   created_at, updated_at
            FROM email_accounts
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        `,
                [user.id],
            );

            // Parse filter_senders JSON
            const parsed = accounts.map((a) => {
                return {
                    ...a,
                    filter_senders: safeJsonParse(a.filter_senders, []),
                    is_enabled: Boolean(a.is_enabled),
                };
            });

            return {
                status: 200,
                data: { accounts: parsed },
            };
        }

        // PUT /api/email/accounts/:id - Update account settings (requires auth)
        if (method === 'PUT' && path.match(/^\/accounts\/[^/]+$/)) {
            const authError = requireAuth();
            if (authError) return authError;

            const accountId = path.split('/')[2];
            const { filter_senders, is_enabled } = body;

            const account = await query.get(
                `
            SELECT id FROM email_accounts
            WHERE id = ? AND user_id = ?
        `,
                [accountId, user.id],
            );

            if (!account) {
                return { status: 404, data: { error: 'Account not found' } };
            }

            const updates = [];
            const params = [];

            if (filter_senders !== undefined) {
                updates.push('filter_senders = ?');
                params.push(JSON.stringify(filter_senders));
            }

            if (is_enabled !== undefined) {
                updates.push('is_enabled = ?');
                params.push(is_enabled ? 1 : 0);
            }

            if (updates.length > 0) {
                updates.push('updated_at = ?');
                params.push(new Date().toISOString());
                params.push(accountId);

                params.push(user.id);
                await query.run(
                    `
                UPDATE email_accounts SET ${updates.join(', ')}
                WHERE id = ? AND user_id = ?
            `,
                    params,
                );
            }

            return {
                status: 200,
                data: { success: true, message: 'Account updated' },
            };
        }

        // DELETE /api/email/accounts/:id - Disconnect email account (requires auth)
        if (method === 'DELETE' && path.match(/^\/accounts\/[^/]+$/)) {
            const authError = requireAuth();
            if (authError) return authError;

            const accountId = path.split('/')[2];

            const result = await query.run(
                `
            DELETE FROM email_accounts
            WHERE id = ? AND user_id = ?
        `,
                [accountId, user.id],
            );

            if (result.changes === 0) {
                return { status: 404, data: { error: 'Account not found' } };
            }

            return {
                status: 200,
                data: { success: true, message: 'Account disconnected' },
            };
        }

        // POST /api/email/accounts/:id/sync - Trigger manual sync (requires auth)
        if (method === 'POST' && path.match(/^\/accounts\/[^/]+\/sync$/)) {
            const authError = requireAuth();
            if (authError) return authError;

            const accountId = path.split('/')[2];

            const account = await query.get(
                `
            SELECT id, email_address, provider, sync_status
            FROM email_accounts
            WHERE id = ? AND user_id = ? AND is_enabled = TRUE
        `,
                [accountId, user.id],
            );

            if (!account) {
                return { status: 404, data: { error: 'Account not found or disabled' } };
            }

            if (account.sync_status === 'syncing') {
                return { status: 409, data: { error: 'Sync already in progress' } };
            }

            // Queue sync task
            const task = queueTask(
                'sync_email_account',
                {
                    accountId: account.id,
                    userId: user.id,
                    provider: account.provider,
                },
                { priority: 2 },
            );

            // Update sync status
            await query.run(
                `
            UPDATE email_accounts SET sync_status = 'syncing', updated_at = ?
            WHERE id = ? AND user_id = ?
        `,
                [new Date().toISOString(), accountId, user.id],
            );

            return {
                status: 202,
                data: {
                    success: true,
                    message: 'Sync started',
                    taskId: task.id,
                },
            };
        }

        // ===== OUTLOOK OAUTH ROUTES =====

        // GET /api/email/authorize/outlook - Start Outlook OAuth flow (requires auth)
        if (method === 'GET' && path === '/authorize/outlook') {
            const authError = requireAuth();
            if (authError) return authError;

            const clientId = process.env.OUTLOOK_CLIENT_ID;
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const redirectUri = `${baseUrl}/api/email/callback/outlook`;

            if (!clientId) {
                return {
                    status: 400,
                    data: { error: 'Outlook OAuth not configured. Set OUTLOOK_CLIENT_ID in environment.' },
                };
            }

            // Generate state token for CSRF protection
            const stateToken = generateStateToken();
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            // Store state in database
            await query.run(
                `
            INSERT INTO email_oauth_states (id, user_id, provider, state_token, redirect_uri, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `,
                [uuidv4(), user.id, 'outlook', stateToken, redirectUri, expiresAt.toISOString()],
            );

            // Build authorization URL
            const authUrl = new URL(OUTLOOK_AUTH_URL);
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('scope', OUTLOOK_SCOPES.join(' '));
            authUrl.searchParams.set('state', stateToken);
            authUrl.searchParams.set('response_mode', 'query');

            return {
                status: 200,
                data: {
                    authorizationUrl: authUrl.toString(),
                    state: stateToken,
                },
            };
        }

        // GET /api/email/callback/outlook - Handle Outlook OAuth callback
        if (method === 'GET' && path === '/callback/outlook') {
            const { code, state, error } = queryParams;

            if (error) {
                return {
                    status: 400,
                    data: { error: `OAuth error: ${error}` },
                };
            }

            if (!code || !state) {
                return {
                    status: 400,
                    data: { error: 'Missing authorization code or state' },
                };
            }

            // Verify state token
            const stateRecord = await query.get(
                `
            SELECT * FROM email_oauth_states
            WHERE state_token = ? AND expires_at > NOW()
        `,
                [state],
            );

            if (!stateRecord) {
                return {
                    status: 400,
                    data: { error: 'Invalid or expired state token' },
                };
            }

            // Clean up used state
            await query.run('DELETE FROM email_oauth_states WHERE id = ?', [stateRecord.id]);

            try {
                const clientId = process.env.OUTLOOK_CLIENT_ID;
                const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

                // Exchange code for tokens
                const tokenResponse = await fetch(OUTLOOK_TOKEN_URL, {
                    method: 'POST',
                    signal: AbortSignal.timeout(15000),
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        code: code,
                        redirect_uri: stateRecord.redirect_uri,
                        grant_type: 'authorization_code',
                        scope: OUTLOOK_SCOPES.join(' '),
                    }),
                });

                if (!tokenResponse.ok) {
                    const errorText = await tokenResponse.text();
                    throw new Error(`Token exchange failed: ${errorText}`);
                }

                const tokens = await tokenResponse.json();

                // Get user's email address
                const emailAddress = await getOutlookUserEmail(tokens.access_token);

                // Check if account already exists
                const existing = await query.get(
                    `
                SELECT id FROM email_accounts
                WHERE user_id = ? AND email_address = ?
            `,
                    [stateRecord.user_id, emailAddress],
                );

                const accountId = existing?.id || uuidv4();
                const now = new Date().toISOString();
                const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

                // Encrypt tokens
                const encryptedAccessToken = encryptToken(tokens.access_token);
                const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;

                if (existing) {
                    // Update existing account
                    await query.run(
                        `
                    UPDATE email_accounts SET
                        oauth_token = ?,
                        oauth_refresh_token = COALESCE(?, oauth_refresh_token),
                        oauth_token_expires_at = ?,
                        is_enabled = TRUE,
                        consecutive_failures = 0,
                        last_error = NULL,
                        updated_at = ?
                    WHERE id = ? AND user_id = ?
                `,
                        [encryptedAccessToken, encryptedRefreshToken, expiresAt, now, accountId, stateRecord.user_id],
                    );
                } else {
                    // Create new account
                    await query.run(
                        `
                    INSERT INTO email_accounts (
                        id, user_id, email_address, provider,
                        oauth_token, oauth_refresh_token, oauth_token_expires_at,
                        filter_senders, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                        [
                            accountId,
                            stateRecord.user_id,
                            emailAddress,
                            'outlook',
                            encryptedAccessToken,
                            encryptedRefreshToken,
                            expiresAt,
                            JSON.stringify(DEFAULT_RECEIPT_SENDERS.slice(0, 10)),
                            now,
                            now,
                        ],
                    );
                }

                // Return HTML that closes popup and notifies parent
                return {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                    data: `
                    <!DOCTYPE html>
                    <html>
                    <head><title>Outlook Connected</title></head>
                    <body>
                        <div id="oauth-data" data-provider="outlook" data-email="${emailAddress.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])}"></div>
                        <script>
                            if (window.opener) {
                                var d = document.getElementById('oauth-data');
                                window.opener.postMessage({
                                    type: 'email-oauth-success',
                                    provider: d.dataset.provider,
                                    email: d.dataset.email
                                }, window.location.origin);
                                window.close();
                            } else {
                                document.body.innerHTML = '<h2>Outlook Connected Successfully!</h2><p>You can close this window.</p>';  // nosemgrep: javascript.browser.security.insecure-document-method
                            }
                        </script>
                        <h2>Outlook Connected Successfully!</h2>
                        <p>You can close this window.</p>
                    </body>
                    </html>
                `,
                };
            } catch (error) {
                logger.error('[EmailOAuth] Outlook OAuth callback error', user?.id || null, { detail: error.message });
                return {
                    status: 500,
                    headers: { 'Content-Type': 'text/html' },
                    data: `
                    <!DOCTYPE html>
                    <html>
                    <head><title>Connection Failed</title></head>
                    <body>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({
                                    type: 'email-oauth-error',
                                    provider: 'outlook',
                                    error: 'Authentication failed'
                                }, window.location.origin);
                                window.close();
                            }
                        </script>
                        <h2>Connection Failed</h2>
                        <p>Authentication failed. Please try again.</p>
                    </body>
                    </html>
                `,
                };
            }
        }

        return { status: 404, data: { error: 'Route not found' } };
    } catch (error) {
        logger.error('[EmailOAuth] Unhandled route error', {
            path: ctx.path,
            method: ctx.method,
            error: error.message,
        });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
