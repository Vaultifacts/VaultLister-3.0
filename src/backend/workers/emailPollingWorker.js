// Email Polling Worker for VaultLister
// Periodically fetches emails from connected accounts and queues receipts for parsing

import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/database.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';
import {
    refreshGmailToken,
    fetchRecentEmails as fetchGmailEmails,
    getEmailContent as getGmailContent,
    getAttachment as getGmailAttachment,
    base64UrlToBase64
} from '../services/gmailService.js';
import {
    refreshOutlookToken,
    fetchRecentEmails as fetchOutlookEmails,
    getEmailContent as getOutlookContent
} from '../services/outlookService.js';
import { detectReceipt, extractVendorName, inferReceiptType } from '../services/receiptDetector.js';
import { createNotification } from '../services/notificationService.js';
import { set as setRedisValue } from '../services/redis.js';
import { acquireRedisLock } from '../services/redisLock.js';
import { logger } from '../shared/logger.js';

// Truncate account IDs in logs for PII safety
const redactId = (id) => id ? id.slice(0, 8) + '...' : 'unknown';


// Configuration
const POLL_INTERVAL_MS = parseInt(process.env.EMAIL_POLL_INTERVAL) || 5 * 60 * 1000; // 5 minutes
const MAX_ACCOUNTS_PER_CYCLE = 5;
const MAX_EMAILS_PER_SYNC = 50;
const MAX_CONSECUTIVE_FAILURES = parseInt(process.env.EMAIL_MAX_FAILURES) || 5;
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // Refresh tokens expiring in 5 minutes
const HEARTBEAT_KEY = 'worker:health:emailPollingWorker';
const HEARTBEAT_TTL_SECONDS = 1800;
const EMAIL_POLLING_LOCK_KEY = 'worker:lock:emailPollingWorker';
const EMAIL_POLLING_LOCK_TTL_MS = 30 * 60 * 1000;

let pollingInterval = null;
let isRunning = false;
let lastRun = 0;

async function writeHeartbeat() {
    const heartbeatTime = lastRun || Date.now();
    await setRedisValue(
        HEARTBEAT_KEY,
        JSON.stringify({ lastRun: new Date(heartbeatTime).toISOString(), status: 'running' }),
        HEARTBEAT_TTL_SECONDS
    );
}

function scheduleStartupHeartbeats() {
    lastRun = Date.now();
    const writeStartupHeartbeat = () => {
        writeHeartbeat().catch(heartbeatError => {
            logger.warn('[EmailPolling] Failed to write startup heartbeat', null, { detail: heartbeatError.message });
        });
    };
    writeStartupHeartbeat();
    for (const delayMs of [5000, 15000]) {
        const timer = setTimeout(writeStartupHeartbeat, delayMs);
        timer.unref?.();
    }
}

/**
 * Start the email polling worker
 */
export function startEmailPollingWorker() {
    if (pollingInterval) {
        logger.info('[EmailPolling] Worker already running');
        return;
    }

    logger.info('[EmailPolling] Starting email polling worker...');
    logger.info(`[EmailPolling] Interval: ${POLL_INTERVAL_MS / 1000}s, Max accounts: ${MAX_ACCOUNTS_PER_CYCLE}`);
    scheduleStartupHeartbeats();

    // Run immediately on start
    pollEmailAccounts();

    // Then run on interval
    pollingInterval = setInterval(pollEmailAccounts, POLL_INTERVAL_MS);

    logger.info('[EmailPolling] Worker started');
}

/**
 * Stop the email polling worker
 */
export function stopEmailPollingWorker() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
        logger.info('[EmailPolling] Worker stopped');
    }
}

/**
 * Poll all enabled email accounts
 */
async function pollEmailAccounts() {
    if (isRunning) {
        logger.info('[EmailPolling] Previous poll cycle still running, skipping...');
        return;
    }

    isRunning = true;
    lastRun = Date.now();
    const lock = await acquireRedisLock(
        EMAIL_POLLING_LOCK_KEY,
        EMAIL_POLLING_LOCK_TTL_MS,
        { name: 'email polling worker' }
    );

    if (!lock.acquired) {
        isRunning = false;
        return;
    }

    try {
        // Find accounts due for sync (not syncing, enabled, with refresh token)
        const accounts = await query.all(`
            SELECT * FROM email_accounts
            WHERE is_enabled = TRUE
            AND sync_status != 'syncing'
            AND oauth_refresh_token IS NOT NULL
            AND consecutive_failures < ?
            ORDER BY last_sync_at ASC NULLS FIRST
            LIMIT ?
        `, [MAX_CONSECUTIVE_FAILURES, MAX_ACCOUNTS_PER_CYCLE]);

        if (accounts.length === 0) {
            return;
        }

        logger.info(`[EmailPolling] Polling ${accounts.length} account(s)`);

        // Process accounts sequentially to avoid rate limits
        for (const account of accounts) {
            try {
                await syncEmailAccount(account);
            } catch (error) {
                logger.error(`[EmailPolling] Error syncing account ${redactId(account.id)}:`, error.message);
            }

            // Small delay between accounts
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

    } catch (error) {
        logger.error('[EmailPolling] Error in poll cycle:', error);
    } finally {
        try {
            await writeHeartbeat();
        } catch (heartbeatError) {
            logger.warn('[EmailPolling] Failed to write heartbeat', null, { detail: heartbeatError.message });
        }
        await lock.release();
        isRunning = false;
    }
}

/**
 * Sync a single email account
 * @param {Object} account - Email account record
 */
export async function syncEmailAccount(account) {
    const now = new Date().toISOString();

    // Mark as syncing
    await query.run(`
        UPDATE email_accounts SET sync_status = 'syncing', updated_at = ?
        WHERE id = ?
    `, [now, account.id]);

    try {
        // Refresh token if needed
        let accessToken = decryptToken(account.oauth_token);
        const tokenExpiry = account.oauth_token_expires_at
            ? new Date(account.oauth_token_expires_at)
            : new Date(0);

        const provider = account.provider || 'gmail';

        if (tokenExpiry.getTime() < Date.now() + TOKEN_EXPIRY_BUFFER_MS) {
            logger.info(`[EmailPolling] Refreshing ${provider} token for account ${redactId(account.id)}`);
            const refreshToken = decryptToken(account.oauth_refresh_token);

            let newTokens;
            if (provider === 'outlook') {
                newTokens = await refreshOutlookToken(refreshToken);
            } else {
                newTokens = await refreshGmailToken(refreshToken);
            }

            accessToken = newTokens.access_token;
            const newExpiry = new Date(Date.now() + (newTokens.expires_in || 3600) * 1000);

            await query.run(`
                UPDATE email_accounts SET
                    oauth_token = ?,
                    oauth_token_expires_at = ?,
                    updated_at = ?
                WHERE id = ?
            `, [
                encryptToken(accessToken),
                newExpiry.toISOString(),
                new Date().toISOString(),
                account.id
            ]);
        }

        // Parse filter senders
        const filterSenders = JSON.parse(account.filter_senders || '[]');

        // Fetch recent emails based on provider
        let messages;
        if (provider === 'outlook') {
            messages = await fetchOutlookEmails(accessToken, {
                sinceMessageId: account.last_message_id,
                senderFilters: filterSenders,
                maxResults: MAX_EMAILS_PER_SYNC
            });
        } else {
            messages = await fetchGmailEmails(accessToken, {
                sinceMessageId: account.last_message_id,
                senderFilters: filterSenders,
                maxResults: MAX_EMAILS_PER_SYNC
            });
        }

        logger.info(`[EmailPolling] Found ${messages.length} new ${provider} email(s) for account ${redactId(account.id)}`);

        let receiptsFound = 0;
        let lastMessageId = account.last_message_id;

        // Process each email
        for (const msg of messages) {
            try {
                // Get full email content based on provider
                let email;
                if (provider === 'outlook') {
                    email = await getOutlookContent(accessToken, msg.id);
                } else {
                    email = await getGmailContent(accessToken, msg.id);
                }

                // Track the newest message ID
                if (!lastMessageId || msg.id > lastMessageId) {
                    lastMessageId = msg.id;
                }

                // Check if it's a receipt
                const detection = detectReceipt(email, filterSenders);

                if (detection.isReceipt) {
                    // Queue for processing
                    await queueEmailReceipt(account, email, detection, accessToken);
                    receiptsFound++;
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (emailError) {
                logger.error(`[EmailPolling] Error processing email ${msg.id}:`, emailError.message);
            }
        }

        // Update account with success
        await query.run(`
            UPDATE email_accounts SET
                sync_status = 'idle',
                last_sync_at = ?,
                last_message_id = ?,
                consecutive_failures = 0,
                last_error = NULL,
                updated_at = ?
            WHERE id = ?
        `, [now, lastMessageId, now, account.id]);

        // Notify user if receipts found
        if (receiptsFound > 0) {
            createNotification(account.user_id, {
                type: 'email_receipts_found',
                title: 'New Receipts Found',
                message: `Found ${receiptsFound} receipt(s) in your ${account.provider} inbox`,
                data: { accountId: account.id, count: receiptsFound }
            });
        }

        return { success: true, receiptsFound };

    } catch (error) {
        // Record failure
        const failures = (account.consecutive_failures || 0) + 1;

        await query.run(`
            UPDATE email_accounts SET
                sync_status = 'error',
                consecutive_failures = ?,
                last_error = ?,
                last_error_at = ?,
                updated_at = ?
            WHERE id = ?
        `, [failures, error.message, now, now, account.id]);

        // Disable account after too many failures
        if (failures >= MAX_CONSECUTIVE_FAILURES) {
            logger.info(`[EmailPolling] Disabling account ${redactId(account.id)} after ${failures} failures`);

            await query.run(`
                UPDATE email_accounts SET is_enabled = FALSE, updated_at = ?
                WHERE id = ?
            `, [now, account.id]);

            createNotification(account.user_id, {
                type: 'email_account_disabled',
                title: 'Email Account Disabled',
                message: `Your ${account.provider} account was disabled due to repeated sync failures. Please reconnect.`,
                data: { accountId: account.id, error: error.message }
            });
        }

        throw error;
    }
}

/**
 * Queue an email as a receipt for AI parsing
 */
async function queueEmailReceipt(account, email, detection, accessToken) {
    const receiptId = uuidv4();
    const now = new Date().toISOString();

    // Determine receipt type
    const receiptType = detection.receiptType || inferReceiptType(email);

    // Extract vendor name
    const vendorName = extractVendorName(email);

    // Get image attachments if any
    let imageData = null;
    const imageAttachments = email.attachments?.filter(a =>
        a.mimeType?.startsWith('image/') ||
        a.mimeType === 'application/pdf'
    ) || [];

    if (imageAttachments.length > 0) {
        // Get the first image/PDF attachment
        const attachment = imageAttachments[0];

        if (attachment.data) {
            // Inline attachment - already have data
            imageData = base64UrlToBase64(attachment.data);
        } else if (attachment.attachmentId) {
            // Need to fetch attachment
            try {
                const data = await getGmailAttachment(accessToken, email.id, attachment.attachmentId);
                imageData = base64UrlToBase64(data);
            } catch (err) {
                logger.error(`[EmailPolling] Failed to fetch attachment:`, err.message);
            }
        }
    }

    // Build parsed data structure for consistency with manual uploads
    const parsedData = {
        receiptType,
        vendor: {
            name: vendorName,
            email: email.fromEmail
        },
        date: email.dateISO?.split('T')[0] || now.split('T')[0],
        items: [],
        subtotal: null,
        tax: null,
        shipping: null,
        total: null,
        paymentMethod: null,
        platform: detection.platform,
        orderNumber: null,
        confidence: detection.confidence >= 80 ? 'high' : detection.confidence >= 60 ? 'medium' : 'low',
        rawEmailSubject: email.subject,
        rawEmailBody: email.body?.text?.substring(0, 5000) // Limit body size
    };

    // Insert into email_parse_queue
    await query.run(`
        INSERT INTO email_parse_queue (
            id, user_id, email_subject, email_from, email_body, email_date,
            parsed_data, status, receipt_type, confidence_score, source_file,
            file_type, image_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        receiptId,
        account.user_id,
        email.subject,
        email.from,
        email.body?.text?.substring(0, 10000) || '',
        email.dateISO,
        JSON.stringify(parsedData),
        imageData ? 'pending' : 'parsed', // If has image, needs AI parsing
        receiptType,
        detection.confidence / 100,
        `${email.id}@${account.provider || 'gmail'}`,
        'email',
        imageData,
        now
    ]);

    logger.info(`[EmailPolling] Queued receipt: ${email.subject} (${receiptType})`);

    return receiptId;
}

/**
 * Get email polling worker status
 */
export async function getEmailPollingStatus() {
    const stats = await query.get(`
        SELECT
            COUNT(*) as total_accounts,
            SUM(CASE WHEN is_enabled = TRUE THEN 1 ELSE 0 END) as enabled_accounts,
            SUM(CASE WHEN sync_status = 'syncing' THEN 1 ELSE 0 END) as syncing_accounts,
            SUM(CASE WHEN sync_status = 'error' THEN 1 ELSE 0 END) as error_accounts
        FROM email_accounts
    `);

    return {
        running: pollingInterval !== null,
        intervalMs: POLL_INTERVAL_MS,
        lastRun: lastRun ? new Date(lastRun).toISOString() : null,
        ...stats
    };
}
