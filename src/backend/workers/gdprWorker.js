// GDPR Deletion Worker
// Processes pending account deletions after the 30-day grace period

import { query } from '../db/database.js';
import emailService from '../services/email.js';
import { logger } from '../shared/logger.js';

let intervalId = null;
let lastRun = 0;

// Process pending deletions
async function processAccountDeletions() {
    const now = new Date().toISOString();

    // Find accounts scheduled for deletion that have passed the grace period
    const pendingDeletions = query.all(`
        SELECT adr.*, u.email, u.full_name, u.username
        FROM account_deletion_requests adr
        JOIN users u ON adr.user_id = u.id
        WHERE adr.status = 'pending'
        AND adr.scheduled_for <= ?
        LIMIT 10
    `, [now]);

    if (!pendingDeletions || pendingDeletions.length === 0) {
        return;
    }

    logger.info(`[GDPR Worker] Processing ${pendingDeletions.length} account deletion(s)`);

    for (const deletion of pendingDeletions) {
        try {
            await executeAccountDeletion(deletion);
            logger.info(`[GDPR Worker] Deleted account: ${deletion.user_id}`);
        } catch (error) {
            logger.error(`[GDPR Worker] Error deleting account ${deletion.user_id}:`, error.message);

            // Mark as failed
            query.run(`
                UPDATE account_deletion_requests
                SET status = 'failed', error = ?, updated_at = datetime('now')
                WHERE id = ?
            `, [error.message, deletion.id]);
        }
    }
}

// Execute account deletion
async function executeAccountDeletion(deletion) {
    const { user_id: userId, email, full_name, username } = deletion;

    // Tables containing user data
    const USER_DATA_TABLES = [
        { table: 'inventory', idColumn: 'user_id' },
        { table: 'listings', idColumn: 'user_id' },
        { table: 'sales', idColumn: 'user_id' },
        { table: 'shops', idColumn: 'user_id' },
        { table: 'automations', idColumn: 'user_id' },
        { table: 'sessions', idColumn: 'user_id' },
        { table: 'notifications', idColumn: 'user_id' },
        { table: 'oauth_accounts', idColumn: 'user_id' },
        { table: 'orders', idColumn: 'user_id' },
        { table: 'checklists', idColumn: 'user_id' },
        { table: 'templates', idColumn: 'user_id' },
        { table: 'user_webhooks', idColumn: 'user_id' },
        { table: 'email_queue', idColumn: 'user_id' },
        { table: 'email_log', idColumn: 'user_id' },
        { table: 'backup_codes', idColumn: 'user_id' },
        { table: 'webauthn_credentials', idColumn: 'user_id' },
        { table: 'sms_codes', idColumn: 'user_id' },
        { table: 'user_consents', idColumn: 'user_id' },
        { table: 'data_export_requests', idColumn: 'user_id' },
    ];

    // Anonymize sales data (keep for financial records)
    query.run(`
        UPDATE sales SET
            buyer_username = 'DELETED',
            buyer_address = NULL,
            notes = NULL
        WHERE user_id = ?
    `, [userId]);

    // Delete user data from all tables
    for (const { table, idColumn } of USER_DATA_TABLES) {
        try {
            query.run(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [userId]);
        } catch (e) {
            // Table might not exist, continue
        }
    }

    // Delete the user record
    query.run('DELETE FROM users WHERE id = ?', [userId]);

    // Mark deletion request as completed
    query.run(`
        UPDATE account_deletion_requests
        SET status = 'completed', completed_at = datetime('now')
        WHERE id = ?
    `, [deletion.id]);

    // Send confirmation email (to the email we still have in the deletion record)
    try {
        await emailService.send({
            to: email,
            subject: 'Your VaultLister Account Has Been Deleted',
            template: 'account-deleted',
            data: {
                name: full_name || username || 'User'
            }
        });
    } catch (e) {
        // Email send failure shouldn't stop the process
        logger.info('[GDPR Worker] Could not send deletion confirmation email');
    }

    // Log to audit
    try {
        query.run(`
            INSERT INTO audit_logs (id, user_id, action, category, severity, details, created_at)
            VALUES (?, NULL, 'account_deleted', 'security', 'info', ?, datetime('now'))
        `, [
            require('crypto').randomUUID(),
            JSON.stringify({ deletedUserId: userId, reason: deletion.reason })
        ]);
    } catch (e) {
        // Audit log failure shouldn't stop the process
    }
}

// Send reminder emails for accounts approaching deletion
async function sendDeletionReminders() {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Find accounts that will be deleted in the next 3 days
    const upcomingDeletions = query.all(`
        SELECT adr.*, u.email, u.full_name, u.username
        FROM account_deletion_requests adr
        JOIN users u ON adr.user_id = u.id
        WHERE adr.status = 'pending'
        AND adr.scheduled_for <= ?
        AND adr.scheduled_for > ?
        AND (adr.reminder_sent IS NULL OR adr.reminder_sent = 0)
    `, [threeDaysFromNow, now.toISOString()]);

    for (const deletion of upcomingDeletions || []) {
        try {
            await emailService.send({
                to: deletion.email,
                subject: 'Reminder: Your VaultLister Account Will Be Deleted Soon',
                template: 'account-deletion-reminder',
                data: {
                    name: deletion.full_name || deletion.username,
                    deletionDate: new Date(deletion.scheduled_for).toLocaleDateString(),
                    cancelUrl: '/settings?action=cancel-deletion'
                }
            });

            // Mark reminder as sent
            query.run(`
                UPDATE account_deletion_requests
                SET reminder_sent = 1, updated_at = datetime('now')
                WHERE id = ?
            `, [deletion.id]);

        } catch (e) {
            logger.error('[GDPR Worker] Failed to send deletion reminder:', e.message);
        }
    }
}

// Clean up old data export requests (older than 7 days)
async function cleanupExportRequests() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    query.run(`
        UPDATE data_export_requests
        SET export_data = NULL, status = 'expired'
        WHERE status = 'completed'
        AND completed_at < ?
    `, [sevenDaysAgo]);
}

// Start the worker
export function startGDPRWorker() {
    logger.info('[GDPR Worker] Starting...');

    // Run immediately on start
    processAccountDeletions().catch(e => logger.error('[GDPRWorker] processAccountDeletions failed', null, { detail: e.message }));
    sendDeletionReminders().catch(e => logger.error('[GDPRWorker] sendDeletionReminders failed', null, { detail: e.message }));
    cleanupExportRequests().catch(e => logger.error('[GDPRWorker] cleanupExportRequests failed', null, { detail: e.message }));

    // Run every hour
    intervalId = setInterval(async () => {
        lastRun = Date.now();
        await processAccountDeletions().catch(e => logger.error('[GDPRWorker] processAccountDeletions failed', null, { detail: e.message }));
        await sendDeletionReminders().catch(e => logger.error('[GDPRWorker] sendDeletionReminders failed', null, { detail: e.message }));
        await cleanupExportRequests().catch(e => logger.error('[GDPRWorker] cleanupExportRequests failed', null, { detail: e.message }));
    }, 60 * 60 * 1000); // 1 hour

    logger.info('[GDPR Worker] Started - running every hour');
}

// Stop the worker
export function stopGDPRWorker() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info('[GDPR Worker] Stopped');
    }
}

export function getGDPRWorkerStatus() {
    return {
        running: intervalId !== null,
        intervalMs: 60 * 60 * 1000,
        lastRun: lastRun ? new Date(lastRun).toISOString() : null
    };
}

export default { startGDPRWorker, stopGDPRWorker, getGDPRWorkerStatus };
