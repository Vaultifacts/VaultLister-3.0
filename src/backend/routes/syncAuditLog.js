// Sync Audit Log Route — GET /api/sync/audit-log
// Returns recent sync operations (platform publishes, status syncs, shop syncs)
// for the authenticated user with pagination support.

import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, escapeLike } from '../db/database.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTOMATION_AUDIT_LOG = join(__dirname, '../../../data/automation-audit.log');

// Sync-related action prefixes stored in audit_logs
const SYNC_ACTION_PATTERNS = [
    'listing_published',
    'listing_publish_failed',
    'platform_sync',
    'sync_shop',
    'sync_status',
    'listing_status_sync',
    'listing_sold_sync',
    'listing_ended_sync',
    'sku_sync',
    'inventory_sync'
];

/**
 * Read recent lines from automation-audit.log for the given userId.
 * Returns up to maxLines JSON-parsed entries, newest first.
 */
async function readAutomationAuditLog(userId, maxLines = 200) {
    if (!existsSync(AUTOMATION_AUDIT_LOG)) return [];

    return new Promise((resolve) => {
        const entries = [];
        const rl = createInterface({ input: createReadStream(AUTOMATION_AUDIT_LOG, { encoding: 'utf8' }) });

        rl.on('line', (line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            try {
                const entry = JSON.parse(trimmed);
                // Filter to entries for this user (some entries may not have userId)
                if (!entry.userId || entry.userId === userId) {
                    entries.push(entry);
                }
            } catch {
                // Skip malformed lines
            }
        });

        rl.on('close', () => {
            // Newest first, limit to maxLines
            resolve(entries.reverse().slice(0, maxLines));
        });

        rl.on('error', () => resolve([]));
    });
}

export async function syncAuditLogRouter(ctx) {
    const { method, path, query: queryParams, user } = ctx;

    if (!user) return { status: 401, data: { error: 'Authentication required' } };

    // GET /api/sync/audit-log
    if (method === 'GET' && path === '/audit-log') {
        try {
            const { limit = 50, offset = 0, platform, status, source } = queryParams;

            const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
            const offsetNum = Math.max(parseInt(offset) || 0, 0);

            // ── DB: query audit_logs for sync-related actions ────────────────
            const actionFilter = SYNC_ACTION_PATTERNS.map(() => '?').join(', ');
            let dbSql = `
                SELECT
                    id,
                    action,
                    category,
                    severity,
                    resource_type,
                    resource_id,
                    details,
                    metadata,
                    created_at
                FROM audit_logs
                WHERE user_id = ?
                  AND action = ANY(ARRAY[${SYNC_ACTION_PATTERNS.map(() => '?').join(', ')}]::text[])
            `;
            const dbParams = [user.id, ...SYNC_ACTION_PATTERNS];

            if (platform) {
                dbSql += ` AND (details::text ILIKE ? OR metadata::text ILIKE ?)`;
                const platformPattern = `%${escapeLike(platform)}%`;
                dbParams.push(platformPattern, platformPattern);
            }

            dbSql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            dbParams.push(limitNum, offsetNum);

            const countSql = dbSql
                .replace(/SELECT[\s\S]+?FROM audit_logs/, 'SELECT COUNT(*) as count FROM audit_logs')
                .replace(/ ORDER BY[\s\S]+$/, '');
            const countParams = dbParams.slice(0, -2);

            const [dbRows, countRow] = await Promise.all([
                query.all(dbSql, dbParams),
                query.get(countSql, countParams)
            ]);

            // ── File: read automation-audit.log entries (publish events) ─────
            // Only include file entries when offset is 0 and no source filter excludes 'file'
            let fileEntries = [];
            if (offsetNum === 0 && source !== 'db') {
                const rawFileEntries = await readAutomationAuditLog(user.id, 100);
                fileEntries = rawFileEntries
                    .filter(e => {
                        if (platform && e.platform !== platform) return false;
                        if (status) {
                            // Map file event names to status: *_success -> success, *_failure -> error
                            const entryStatus = e.event?.includes('success') ? 'success'
                                : e.event?.includes('fail') ? 'error'
                                : 'info';
                            if (entryStatus !== status) return false;
                        }
                        return true;
                    })
                    .map(e => ({
                        id: null,
                        source: 'automation_log',
                        platform: e.platform || null,
                        action: e.event || 'unknown',
                        status: e.event?.includes('success') ? 'success'
                            : e.event?.includes('fail') ? 'error'
                            : 'info',
                        details: e,
                        error: e.error || null,
                        timestamp: e.ts || null
                    }));
            }

            // ── Normalise DB rows ─────────────────────────────────────────────
            const dbEntries = dbRows.map(row => {
                let details = null;
                try { details = row.details ? JSON.parse(row.details) : null; } catch { details = row.details; }
                let metadata = null;
                try { metadata = row.metadata ? JSON.parse(row.metadata) : null; } catch { metadata = row.metadata; }

                return {
                    id: row.id,
                    source: 'audit_log',
                    platform: details?.platform || metadata?.platform || null,
                    action: row.action,
                    status: row.severity === 'error' ? 'error'
                        : row.severity === 'warning' ? 'warning'
                        : 'success',
                    details,
                    error: details?.error || metadata?.error || null,
                    timestamp: row.created_at
                };
            });

            const entries = source === 'file' ? fileEntries
                : source === 'db' ? dbEntries
                : [...dbEntries, ...fileEntries];

            return {
                status: 200,
                data: {
                    entries,
                    total: parseInt(countRow?.count || 0),
                    limit: limitNum,
                    offset: offsetNum,
                    hasMore: offsetNum + dbEntries.length < parseInt(countRow?.count || 0)
                }
            };
        } catch (error) {
            logger.error('[SyncAuditLog] Error fetching sync audit log', user?.id, { detail: error.message });
            return { status: 500, data: { error: 'Internal server error' } };
        }
    }

    return { status: 404, data: { error: 'Route not found' } };
}
