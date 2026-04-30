// Account Routes
// GDPR data export with async job tracking and download.
// Endpoints:
//   POST   /api/account/data-export          — initiate a data export job
//   GET    /api/account/data-export/status   — check export progress
//   GET    /api/account/data-export/download — download the completed export file

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { logger } from '../shared/logger.js';
import { safeJsonParse } from '../shared/utils.js';

// Tables to include in the user data export (excludes secrets and tokens)
const EXPORT_TABLES = [
    { table: 'users', idColumn: 'id' },
    { table: 'inventory', idColumn: 'user_id' },
    { table: 'listings', idColumn: 'user_id' },
    { table: 'sales', idColumn: 'user_id' },
    { table: 'orders', idColumn: 'user_id' },
    { table: 'offers', idColumn: 'user_id' },
    { table: 'notifications', idColumn: 'user_id' },
    { table: 'shops', idColumn: 'user_id' },
];

const REDACTED_COLUMNS = new Set([
    'password_hash',
    'mfa_secret',
    'mfa_backup_codes',
    'oauth_token',
    'oauth_refresh_token',
    'oauth_token_expires_at',
    'secret',
    'phone_verification_code',
    'token',
    'code',
]);

const EXPORT_ROW_LIMIT = 10000;

const VALID_ID = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function validateIdentifier(name) {
    if (!VALID_ID.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
}

async function buildExportPayload(userId) {
    const payload = {
        exportDate: new Date().toISOString(),
        userId,
        data: {},
    };

    for (const { table, idColumn } of EXPORT_TABLES) {
        try {
            validateIdentifier(table);
            validateIdentifier(idColumn);
            const rows = await query.all(`SELECT * FROM ${table} WHERE ${idColumn} = ? LIMIT ?`, [
                userId,
                EXPORT_ROW_LIMIT,
            ]);
            if (rows && rows.length > 0) {
                payload.data[table] = rows.map((row) => {
                    const cleaned = { ...row };
                    for (const col of REDACTED_COLUMNS) {
                        if (col in cleaned) delete cleaned[col];
                    }
                    return cleaned;
                });
                if (rows.length === EXPORT_ROW_LIMIT) {
                    payload.data[`${table}__truncated`] = true;
                }
            }
        } catch (_) {
            // Table may not exist yet — skip silently
        }
    }

    return payload;
}

export async function accountRouter(ctx) {
    const { method, path, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // POST /api/account/data-export — initiate export job (async)
    if (method === 'POST' && path === '/data-export') {
        try {
            // Check for an already-pending or recent completed export to avoid duplicate jobs
            const recent = await query.get(
                `
                SELECT id, status, created_at FROM data_export_requests
                WHERE user_id = ? AND status IN ('pending', 'processing')
                ORDER BY created_at DESC LIMIT 1
            `,
                [user.id],
            );

            if (recent) {
                return {
                    status: 409,
                    data: {
                        error: 'An export is already in progress',
                        requestId: recent.id,
                        status: recent.status,
                    },
                };
            }

            const requestId = uuidv4();

            await query.run(
                `
                INSERT INTO data_export_requests (id, user_id, status, created_at)
                VALUES (?, ?, 'processing', NOW())
            `,
                [requestId, user.id],
            );

            // Run export synchronously — data sets are bounded by EXPORT_ROW_LIMIT per table.
            // For very large accounts this could be made async via task_queue, but synchronous
            // execution keeps the implementation simple and avoids a background worker dependency.
            try {
                const exportPayload = await buildExportPayload(user.id);

                await query.run(
                    `
                    UPDATE data_export_requests
                    SET status = 'completed', export_data = ?, completed_at = NOW(), updated_at = NOW()
                    WHERE id = ?
                `,
                    [JSON.stringify(exportPayload), requestId],
                );
            } catch (buildErr) {
                await query.run(
                    `
                    UPDATE data_export_requests
                    SET status = 'failed', updated_at = NOW()
                    WHERE id = ?
                `,
                    [requestId],
                );
                throw buildErr;
            }

            return {
                status: 202,
                data: {
                    requestId,
                    status: 'completed',
                    message: 'Data export ready for download',
                    statusUrl: `/api/account/data-export/status?requestId=${requestId}`,
                    downloadUrl: `/api/account/data-export/download?requestId=${requestId}`,
                },
            };
        } catch (error) {
            logger.error('[Account] data-export initiation error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Failed to initiate data export' } };
        }
    }

    // GET /api/account/data-export/status — check export job progress
    if (method === 'GET' && path === '/data-export/status') {
        try {
            const { requestId } = ctx.query || {};

            let exportRequest;
            if (requestId) {
                exportRequest = await query.get(
                    `
                    SELECT id, status, created_at, completed_at
                    FROM data_export_requests
                    WHERE id = ? AND user_id = ?
                `,
                    [requestId, user.id],
                );
            } else {
                // Return most recent export for this user
                exportRequest = await query.get(
                    `
                    SELECT id, status, created_at, completed_at
                    FROM data_export_requests
                    WHERE user_id = ?
                    ORDER BY created_at DESC LIMIT 1
                `,
                    [user.id],
                );
            }

            if (!exportRequest) {
                return { status: 404, data: { error: 'No data export request found' } };
            }

            const response = {
                requestId: exportRequest.id,
                status: exportRequest.status,
                createdAt: exportRequest.created_at,
                completedAt: exportRequest.completed_at || null,
            };

            if (exportRequest.status === 'completed') {
                response.downloadUrl = `/api/account/data-export/download?requestId=${exportRequest.id}`;
            }

            return { status: 200, data: response };
        } catch (error) {
            logger.error('[Account] data-export status error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    // GET /api/account/data-export/download — download completed export as JSON file
    if (method === 'GET' && path === '/data-export/download') {
        try {
            const { requestId } = ctx.query || {};

            if (!requestId) {
                return { status: 400, data: { error: 'requestId query parameter required' } };
            }

            const exportRequest = await query.get(
                `
                SELECT id, export_data, completed_at
                FROM data_export_requests
                WHERE id = ? AND user_id = ? AND status = 'completed'
            `,
                [requestId, user.id],
            );

            if (!exportRequest) {
                return { status: 404, data: { error: 'Export not found or not ready' } };
            }

            const exportData = safeJsonParse(
                typeof exportRequest.export_data === 'string'
                    ? exportRequest.export_data
                    : JSON.stringify(exportRequest.export_data),
                {},
            );

            const dateStamp = new Date().toISOString().split('T')[0];

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="vaultlister-export-${user.id}-${dateStamp}.json"`,
                },
                data: exportData,
            };
        } catch (error) {
            logger.error('[Account] data-export download error', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
