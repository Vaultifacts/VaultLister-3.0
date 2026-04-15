// Integrations Routes — Google Drive
// Handles OAuth flow and Drive file operations for VaultLister data backup
//
// Routes mounted at /api/integrations
//   GET  /google/drive/authorize  — start OAuth, redirect to Google
//   GET  /google/callback          — shared Google OAuth callback (Drive + Calendar)
//   GET  /google/drive/status      — connection status (no token exposure)
//   GET  /google/drive/files       — list Drive files created by VaultLister
//   POST /google/drive/backup      — export VaultLister data to Drive
//   DELETE /google/drive/revoke    — disconnect Drive

import {
    isGoogleConfigured,
    buildGoogleAuthUrl,
    exchangeGoogleCode,
    getAccessToken,
    revokeGoogleToken,
    getConnectionStatus
} from '../services/googleOAuth.js';
import { query } from '../db/database.js';
import { validateCSRF } from '../middleware/csrf.js';
import { logger } from '../shared/logger.js';
import { escapeHtml } from '../shared/utils.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export async function integrationsRouter(ctx) {
    const { method, path, user, query: queryParams } = ctx;

    const requireAuth = () => {
        if (!user) return { status: 401, data: { error: 'Authentication required' } };
        return null;
    };

    // ----------------------------------------------------------------
    // Feature flag guard — returns 503 when FEATURE_GOOGLE_DRIVE=false
    // ----------------------------------------------------------------
    const driveEnabled = process.env.FEATURE_GOOGLE_DRIVE !== 'false';

    // ============================================================
    // GET /api/integrations/google/drive/authorize
    // ============================================================
    if (method === 'GET' && path === '/google/drive/authorize') {
        const authError = requireAuth();
        if (authError) return authError;

        if (!driveEnabled) {
            return { status: 503, data: { error: 'Google Drive integration is not enabled.' } };
        }

        if (!isGoogleConfigured()) {
            return {
                status: 400,
                data: {
                    error: 'Google Drive not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.',
                    configured: false
                }
            };
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const { authorizationUrl, state } = buildGoogleAuthUrl(user.id, 'drive', baseUrl);

        logger.info('[Integrations] Drive OAuth initiated', user.id);
        return { status: 200, data: { authorizationUrl, state } };
    }

    // ============================================================
    // GET /api/integrations/google/callback
    // Shared callback for Drive and Calendar OAuth flows
    // ============================================================
    if (method === 'GET' && path === '/google/callback') {
        const { code, state, error } = queryParams;

        if (error) {
            return {
                status: 400,
                headers: { 'Content-Type': 'text/html' },
                data: buildCallbackHtml('error', null, 'Authorization denied or failed.')
            };
        }

        if (!code || !state) {
            return {
                status: 400,
                headers: { 'Content-Type': 'text/html' },
                data: buildCallbackHtml('error', null, 'Missing authorization code or state.')
            };
        }

        try {
            const { email, userId, scope } = await exchangeGoogleCode(code, state);
            logger.info('[Integrations] Google OAuth callback success', userId, { scope });
            return {
                status: 200,
                headers: { 'Content-Type': 'text/html' },
                data: buildCallbackHtml('success', escapeHtml(email), null, scope)
            };
        } catch (err) {
            logger.error('[Integrations] Google OAuth callback error', null, { detail: err.message });
            return {
                status: err.status === 400 ? 400 : 500,
                headers: { 'Content-Type': 'text/html' },
                data: buildCallbackHtml('error', null, 'Authentication failed. Please try again.')
            };
        }
    }

    // ============================================================
    // GET /api/integrations/google/drive/status
    // ============================================================
    if (method === 'GET' && path === '/google/drive/status') {
        const authError = requireAuth();
        if (authError) return authError;

        const status = getConnectionStatus(user.id, 'drive');
        return {
            status: 200,
            data: {
                ...status,
                configured: isGoogleConfigured(),
                featureEnabled: driveEnabled
            }
        };
    }

    // ============================================================
    // GET /api/integrations/google/drive/files
    // List files in the VaultLister app folder on Drive
    // ============================================================
    if (method === 'GET' && path === '/google/drive/files') {
        const authError = requireAuth();
        if (authError) return authError;

        if (!driveEnabled) {
            return { status: 503, data: { error: 'Google Drive integration is not enabled.' } };
        }

        const accessToken = await getAccessToken(user.id, 'drive');
        if (!accessToken) {
            return { status: 401, data: { error: 'Google Drive not connected. Authorize first via /google/drive/authorize.' } };
        }

        try {
            const pageToken = queryParams.pageToken || '';
            const pageSize = Math.min(parseInt(queryParams.pageSize) || 20, 100);

            const params = new URLSearchParams({
                q: "name contains 'VaultLister' and trashed = false",
                fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)',
                pageSize: String(pageSize),
                orderBy: 'modifiedTime desc'
            });
            if (pageToken) params.set('pageToken', pageToken);

            const resp = await fetch(`${DRIVE_API}/files?${params}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
                signal: AbortSignal.timeout(15000)
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Drive API error ${resp.status}: ${text}`);
            }

            const data = await resp.json();
            return {
                status: 200,
                data: {
                    files: data.files || [],
                    nextPageToken: data.nextPageToken || null
                }
            };
        } catch (err) {
            logger.error('[Integrations] Drive files list error', user.id, { detail: err.message });
            return { status: 500, data: { error: 'Failed to list Drive files.' } };
        }
    }

    // ============================================================
    // POST /api/integrations/google/drive/backup
    // Export VaultLister inventory snapshot to Google Drive as JSON
    // ============================================================
    if (method === 'POST' && path === '/google/drive/backup') {
        const authError = requireAuth();
        if (authError) return authError;

        const csrf = await validateCSRF(ctx);
        if (!csrf.valid) return { status: csrf.status || 403, data: { error: csrf.error } };

        if (!driveEnabled) {
            return { status: 503, data: { error: 'Google Drive integration is not enabled.' } };
        }

        const accessToken = await getAccessToken(user.id, 'drive');
        if (!accessToken) {
            return { status: 401, data: { error: 'Google Drive not connected.' } };
        }

        try {
            const items = await query.all(
                `SELECT id, title, sku, description, price, quantity, status, condition, brand,
                        category, tags, created_at, updated_at
                 FROM inventory_items
                 WHERE user_id = ? AND deleted_at IS NULL
                 ORDER BY updated_at DESC`,
                [user.id]
            );

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `VaultLister-backup-${timestamp}.json`;
            const fileContent = JSON.stringify(
                { exportedAt: new Date().toISOString(), itemCount: items.length, items },
                null,
                2
            );

            const metadata = { name: fileName, mimeType: 'application/json' };
            const boundary = 'vaultlister_boundary';
            const body = [
                `--${boundary}`,
                'Content-Type: application/json; charset=UTF-8',
                '',
                JSON.stringify(metadata),
                `--${boundary}`,
                'Content-Type: application/json',
                '',
                fileContent,
                `--${boundary}--`
            ].join('\r\n');

            const uploadResp = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body,
                signal: AbortSignal.timeout(60000)
            });

            if (!uploadResp.ok) {
                const text = await uploadResp.text();
                throw new Error(`Drive upload failed ${uploadResp.status}: ${text}`);
            }

            const file = await uploadResp.json();
            logger.info('[Integrations] Drive backup created', user.id, { fileId: file.id, itemCount: items.length });

            return {
                status: 201,
                data: {
                    success: true,
                    fileId: file.id,
                    fileName,
                    itemCount: items.length,
                    webViewLink: file.webViewLink || null
                }
            };
        } catch (err) {
            logger.error('[Integrations] Drive backup error', user.id, { detail: err.message });
            return { status: 500, data: { error: 'Backup to Google Drive failed.' } };
        }
    }

    // ============================================================
    // DELETE /api/integrations/google/drive/revoke
    // ============================================================
    if (method === 'DELETE' && path === '/google/drive/revoke') {
        const authError = requireAuth();
        if (authError) return authError;

        const csrf = await validateCSRF(ctx);
        if (!csrf.valid) return { status: csrf.status || 403, data: { error: csrf.error } };

        try {
            await revokeGoogleToken(user.id, 'drive');
            logger.info('[Integrations] Drive token revoked', user.id);
            return { status: 200, data: { success: true, message: 'Google Drive disconnected.' } };
        } catch (err) {
            logger.error('[Integrations] Drive revoke error', user.id, { detail: err.message });
            return { status: 500, data: { error: 'Failed to revoke Google Drive connection.' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function buildCallbackHtml(outcome, email, errorMessage, scope) {
    const isSuccess = outcome === 'success';
    const messageType = isSuccess ? 'google-oauth-success' : 'google-oauth-error';
    const title = isSuccess ? 'Google Connected' : 'Connection Failed';
    const heading = isSuccess ? 'Google account connected!' : 'Connection failed';
    const body = isSuccess
        ? `<p>Connected as ${email}. You can close this window.</p>`
        : `<p>${escapeHtml(errorMessage || 'Unknown error')}. You can close this window.</p>`;

    return `<!DOCTYPE html>
<html>
<head><title>${title}</title></head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: '${messageType}',
        email: '${isSuccess ? email : ''}',
        scope: '${scope || ''}'
      }, window.location.origin);
      window.close();
    }
  </script>
  <h2>${heading}</h2>
  ${body}
</body>
</html>`;
}
