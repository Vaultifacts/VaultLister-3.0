// GDPR Compliance Routes
// Data export, account deletion, and consent management

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import emailService from '../services/email.js';
import { logger } from '../shared/logger.js';

// Tables containing user data — explicit DELETE on erasure
// (tables with ON DELETE CASCADE are handled automatically by SQLite FK constraint)
// (tables with ON DELETE SET NULL — audit_logs, error_logs, request_logs, security_logs,
//  webhook_events — are intentionally anonymized rather than deleted)
const USER_DATA_TABLES = [
    // Core user data (CASCADE not set — explicit delete required)
    { table: 'inventory', idColumn: 'user_id' },
    { table: 'listings', idColumn: 'user_id' },
    { table: 'orders', idColumn: 'user_id' },
    { table: 'sessions', idColumn: 'user_id' },
    { table: 'notifications', idColumn: 'user_id' },
    { table: 'shops', idColumn: 'user_id' },
    { table: 'checklists', idColumn: 'user_id' },

    // Auth / security tokens
    { table: 'email_verifications', idColumn: 'user_id' },
    { table: 'password_resets', idColumn: 'user_id' },

    // PII — shipping and address data
    { table: 'return_addresses', idColumn: 'user_id' },
    { table: 'shipping_labels', idColumn: 'user_id' },
    { table: 'shipping_rates', idColumn: 'user_id' },
    { table: 'label_batches', idColumn: 'user_id' },

    // Automation and relisting
    { table: 'relisting_rules', idColumn: 'user_id' },
    { table: 'relisting_queue', idColumn: 'user_id' },
    { table: 'relisting_performance', idColumn: 'user_id' },
    { table: 'poshmark_monitoring_log', idColumn: 'user_id' },
    { table: 'whatnot_events', idColumn: 'user_id' },
    { table: 'whatnot_cohosts', idColumn: 'user_id' },

    // Import / export history
    { table: 'import_jobs', idColumn: 'user_id' },
    { table: 'import_mappings', idColumn: 'user_id' },

    // Analytics and metrics
    { table: 'rum_metrics', idColumn: 'user_id' },
    { table: 'duplicate_detections', idColumn: 'user_id' },

    // Reports and preferences
    { table: 'custom_reports', idColumn: 'user_id' },
    { table: 'categorization_rules', idColumn: 'user_id' },
    { table: 'recurring_transaction_templates', idColumn: 'user_id' },

    // Marketing
    { table: 'email_unsubscribes', idColumn: 'user_id' },

    // Team activity
    { table: 'team_activity_log', idColumn: 'user_id' },

    // Deleted last
    { table: 'users', idColumn: 'id' },
];

// Export all user data
async function exportUserData(userId) {
    const data = {
        exportDate: new Date().toISOString(),
        userId,
        data: {}
    };

    // Columns to strip from exports (secrets, tokens, hashes)
    const REDACTED_COLUMNS = new Set([
        'password_hash', 'mfa_secret', 'mfa_backup_codes', 'oauth_token',
        'oauth_refresh_token', 'oauth_token_expires_at', 'secret',
        'phone_verification_code', 'token', 'code'
    ]);

    const EXPORT_ROW_LIMIT = 10000;
    for (const { table, idColumn } of USER_DATA_TABLES) {
        try {
            const rows = await query.all(`SELECT * FROM ${table} WHERE ${idColumn} = ? LIMIT ?`, [userId, EXPORT_ROW_LIMIT]);
            if (rows && rows.length > 0) {
                // Strip sensitive columns from exported data
                data.data[table] = rows.map(row => {
                    const cleaned = { ...row };
                    for (const col of REDACTED_COLUMNS) {
                        if (col in cleaned) delete cleaned[col];
                    }
                    return cleaned;
                });
                if (rows.length === EXPORT_ROW_LIMIT) {
                    data.data[`${table}__truncated`] = true;
                }
            }
        } catch (e) {
            // Table might not exist, skip
        }
    }

    return data;
}

// Schedule account deletion
async function scheduleAccountDeletion(userId, reason) {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30-day grace period

    await query.run(`
        INSERT INTO account_deletion_requests (id, user_id, reason, scheduled_for, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
    `, [uuidv4(), userId, reason, deletionDate.toISOString()]);

    // Mark user as pending deletion
    await query.run(`
        UPDATE users SET
            deletion_scheduled_at = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `, [deletionDate.toISOString(), userId]);

    return deletionDate;
}

// Cancel account deletion
async function cancelAccountDeletion(userId) {
    await query.run(`
        UPDATE account_deletion_requests
        SET status = 'cancelled', updated_at = datetime('now')
        WHERE user_id = ? AND status = 'pending'
    `, [userId]);

    await query.run(`
        UPDATE users SET
            deletion_scheduled_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
    `, [userId]);
}

// Execute account deletion
async function executeAccountDeletion(userId) {
    await query.transaction(async (tx) => {
        // Anonymize data that must be retained for legal/financial reasons
        // sales records kept for financial/tax compliance; buyer PII stripped
        await tx.run(`
            UPDATE sales SET
                buyer_username = 'DELETED',
                buyer_address = NULL,
                notes = NULL
            WHERE user_id = ?
        `, [userId]);

        // transaction_audit_log — financial audit trail (legal retention); anonymize user reference
        try {
            await tx.run(`UPDATE transaction_audit_log SET user_id = NULL WHERE user_id = ?`, [userId]);
        } catch (e) { /* table may not exist */ }

        // Delete user data from all tables
        for (const { table, idColumn } of USER_DATA_TABLES) {
            if (table === 'users') continue; // Delete last
            try {
                await tx.run(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [userId]);
            } catch (e) {
                // Table might not exist — skip silently
            }
        }

        // Finally, delete the user record
        await tx.run('DELETE FROM users WHERE id = ?', [userId]);

        // Mark deletion request as completed
        await tx.run(`
            UPDATE account_deletion_requests
            SET status = 'completed', completed_at = datetime('now')
            WHERE user_id = ?
        `, [userId]);
    });
}

export async function gdprRouter(ctx) {
    const { method, path, user, body } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // ========================================
    // Data Export
    // ========================================

    // POST /api/gdpr/export - Request data export
    if (method === 'POST' && path === '/export') {
        try {
            // Create export request
            const requestId = uuidv4();

            await query.run(`
                INSERT INTO data_export_requests (id, user_id, status, created_at)
                VALUES (?, ?, 'processing', datetime('now'))
            `, [requestId, user.id]);

            // Export data
            const exportData = await exportUserData(user.id);

            // Store export
            await query.run(`
                UPDATE data_export_requests
                SET status = 'completed', export_data = ?, completed_at = datetime('now')
                WHERE id = ?
            `, [JSON.stringify(exportData), requestId]);

            // Send email notification
            await emailService.send({
                to: user.email,
                subject: 'Your VaultLister Data Export is Ready',
                template: 'data-export-ready',
                data: { name: user.full_name || user.username, requestId }
            });

            return {
                status: 200,
                data: {
                    requestId,
                    message: 'Data export completed. You will receive an email with download instructions.',
                    downloadUrl: `/api/gdpr/export/${requestId}/download`
                }
            };
        } catch (error) {
            logger.error('[GDPR] Data export error', user?.id || null, { detail: error.message });
            return { status: 500, data: { error: 'Failed to export data' } };
        }
    }

    // GET /api/gdpr/export/:requestId/download - Download data export
    if (method === 'GET' && path.startsWith('/export/') && path.endsWith('/download')) {
        const requestId = path.split('/')[2];

        const request = await query.get(`
            SELECT * FROM data_export_requests
            WHERE id = ? AND user_id = ? AND status = 'completed'
        `, [requestId, user.id]);

        if (!request) {
            return { status: 404, data: { error: 'Export not found or not ready' } };
        }

        let exportData;
        try {
            exportData = JSON.parse(request.export_data);
        } catch (e) {
            logger.error('[GDPR] Failed to parse export data', user?.id || null, { detail: e.message });
            exportData = {};
        }

        return {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="vaultlister-data-${user.id}-${new Date().toISOString().split('T')[0]}.json"`
            },
            data: exportData
        };
    }

    // ========================================
    // Account Deletion
    // ========================================

    // POST /api/gdpr/delete-account - Request account deletion
    if (method === 'POST' && path === '/delete-account') {
        const { reason, password } = body;

        // Verify password if user has one
        const userRecord = await query.get('SELECT password_hash FROM users WHERE id = ?', [user.id]);

        if (userRecord.password_hash) {
            const bcrypt = await import('bcryptjs');
            const isValid = await bcrypt.compare(password || '', userRecord.password_hash);
            if (!isValid) {
                return { status: 401, data: { error: 'Invalid password' } };
            }
        }

        // Check for existing pending request
        const existingRequest = await query.get(`
            SELECT * FROM account_deletion_requests
            WHERE user_id = ? AND status = 'pending'
        `, [user.id]);

        if (existingRequest) {
            return {
                status: 400,
                data: {
                    error: 'Account deletion already scheduled',
                    scheduledFor: existingRequest.scheduled_for
                }
            };
        }

        const deletionDate = await scheduleAccountDeletion(user.id, reason);

        // Send confirmation email
        await emailService.send({
            to: user.email,
            subject: 'Account Deletion Scheduled - VaultLister',
            template: 'account-deletion-scheduled',
            data: {
                name: user.full_name || user.username,
                deletionDate: deletionDate.toLocaleDateString(),
                cancelUrl: '/settings?action=cancel-deletion'
            }
        });

        return {
            status: 200,
            data: {
                message: 'Account deletion scheduled',
                deletionDate: deletionDate.toISOString(),
                note: 'You can cancel this request within 30 days by logging in.'
            }
        };
    }

    // POST /api/gdpr/cancel-deletion - Cancel account deletion
    if (method === 'POST' && path === '/cancel-deletion') {
        await cancelAccountDeletion(user.id);

        return {
            status: 200,
            data: { message: 'Account deletion cancelled' }
        };
    }

    // GET /api/gdpr/deletion-status - Check deletion status
    if (method === 'GET' && path === '/deletion-status') {
        const request = await query.get(`
            SELECT * FROM account_deletion_requests
            WHERE user_id = ? AND status = 'pending'
        `, [user.id]);

        if (!request) {
            return { status: 200, data: { scheduled: false } };
        }

        return {
            status: 200,
            data: {
                scheduled: true,
                scheduledFor: request.scheduled_for,
                reason: request.reason
            }
        };
    }

    // ========================================
    // Consent Management
    // ========================================

    // GET /api/gdpr/consents - Get user consents
    if (method === 'GET' && path === '/consents') {
        const consents = await query.all(`
            SELECT consent_type, granted, granted_at, updated_at
            FROM user_consents
            WHERE user_id = ?
        `, [user.id]);

        return {
            status: 200,
            data: {
                consents: consents || [],
                availableConsents: [
                    { type: 'marketing_emails', description: 'Receive marketing emails and newsletters' },
                    { type: 'analytics', description: 'Allow anonymous usage analytics' },
                    { type: 'third_party_sharing', description: 'Share data with integrated platforms' },
                    { type: 'personalization', description: 'Personalized recommendations and content' }
                ]
            }
        };
    }

    // PUT /api/gdpr/consents - Update consents
    if (method === 'PUT' && path === '/consents') {
        const { consents } = body;

        if (!consents || typeof consents !== 'object') {
            return { status: 400, data: { error: 'consents object required' } };
        }

        const VALID_CONSENT_TYPES = new Set([
            'marketing_emails', 'analytics', 'third_party_sharing', 'personalization'
        ]);

        for (const [type, granted] of Object.entries(consents)) {
            if (!VALID_CONSENT_TYPES.has(type)) continue;
            await query.run(`
                INSERT INTO user_consents (id, user_id, consent_type, granted, granted_at, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(user_id, consent_type) DO UPDATE SET
                    granted = excluded.granted,
                    updated_at = datetime('now')
            `, [uuidv4(), user.id, type, granted ? 1 : 0]);
        }

        return { status: 200, data: { message: 'Consents updated' } };
    }

    // ========================================
    // Data Rectification
    // ========================================

    // PUT /api/gdpr/rectify - Request data correction
    if (method === 'PUT' && path === '/rectify') {
        const { corrections } = body;

        // Log the rectification request
        await query.run(`
            INSERT INTO data_rectification_requests (id, user_id, corrections, status, created_at)
            VALUES (?, ?, ?, 'pending', datetime('now'))
        `, [uuidv4(), user.id, JSON.stringify(corrections)]);

        // Apply corrections to user profile with strict field mapping
        const FIELD_MAP = {
            'full_name': 'full_name',
            'username': 'username',
            'timezone': 'timezone',
            'locale': 'locale'
        };
        const updates = [];
        const values = [];

        for (const [field, value] of Object.entries(corrections)) {
            const dbField = FIELD_MAP[field];
            if (dbField) {
                updates.push(`${dbField} = ?`);
                values.push(value);
            }
        }

        if (updates.length > 0) {
            values.push(user.id);
            await query.run(`UPDATE users SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`, values);
        }

        return { status: 200, data: { message: 'Profile updated' } };
    }

    return { status: 404, data: { error: 'Not found' } };
}

// Database migration
// Tables created by pg-schema.sql (managed by migration system)
export const migration = '';

export default gdprRouter;
