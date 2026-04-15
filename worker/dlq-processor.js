// Dead Letter Queue (DLQ) Processor for VaultLister
// Periodically checks all BullMQ queues for failed/dead jobs and either retries
// or permanently removes them based on attempt count.
//
// Retry policy:
//   - failedCount < 5  → retry the job
//   - failedCount >= 5 → log to automation-audit.log and remove

import { Queue } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { logger } from '../src/backend/shared/logger.js';

const DLQ_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TOTAL_ATTEMPTS = 5;
const AUDIT_LOG = path.join(process.cwd(), 'data', 'automation-audit.log');

// All BullMQ queue names managed by this worker
const QUEUE_NAMES = ['automation-jobs'];

let dlqInterval = null;

function writeAuditLog(event, metadata = {}) {
    try {
        const entry = JSON.stringify({ ts: new Date().toISOString(), source: 'dlq-processor', event, ...metadata });
        fs.appendFileSync(AUDIT_LOG, entry + '\n');
    } catch (e) {
        logger.error('[DLQProcessor] Failed to write audit log:', e.message);
    }
}

async function processDLQForQueue(connection, queueName) {
    const queue = new Queue(queueName, { connection });

    try {
        const failedJobs = await queue.getJobs(['failed'], 0, 200);

        if (failedJobs.length === 0) {
            logger.info(`[DLQProcessor] Queue "${queueName}": no failed jobs`);
            return;
        }

        logger.info(`[DLQProcessor] Queue "${queueName}": found ${failedJobs.length} failed job(s)`);

        for (const job of failedJobs) {
            const failedCount = (job.attemptsMade ?? 0);
            const jobMeta = {
                queueName,
                jobId: job.id,
                jobName: job.name,
                failedCount,
                failedReason: job.failedReason ?? 'unknown',
                data: job.data,
            };

            if (failedCount < MAX_TOTAL_ATTEMPTS) {
                try {
                    await job.retry('failed');
                    logger.info(`[DLQProcessor] Retried job ${job.id} (${failedCount} prior failures)`);
                    writeAuditLog('dlq_job_retried', jobMeta);
                } catch (retryErr) {
                    logger.error(`[DLQProcessor] Failed to retry job ${job.id}:`, retryErr.message);
                    writeAuditLog('dlq_job_retry_error', { ...jobMeta, error: retryErr.message });
                }
            } else {
                try {
                    await job.remove();
                    logger.warn(`[DLQProcessor] Removed dead job ${job.id} after ${failedCount} failures`);
                    writeAuditLog('dlq_job_removed', jobMeta);
                } catch (removeErr) {
                    logger.error(`[DLQProcessor] Failed to remove job ${job.id}:`, removeErr.message);
                    writeAuditLog('dlq_job_remove_error', { ...jobMeta, error: removeErr.message });
                }
            }
        }
    } finally {
        await queue.close();
    }
}

async function runDLQProcessing(connection) {
    logger.info('[DLQProcessor] Starting DLQ sweep');

    for (const queueName of QUEUE_NAMES) {
        try {
            await processDLQForQueue(connection, queueName);
        } catch (err) {
            logger.error(`[DLQProcessor] Error processing queue "${queueName}":`, err.message);
            writeAuditLog('dlq_sweep_error', { queueName, error: err.message });
        }
    }

    logger.info('[DLQProcessor] DLQ sweep complete');
}

export function startDLQProcessor(connection) {
    if (dlqInterval) {
        logger.info('[DLQProcessor] Already running');
        return;
    }

    logger.info('[DLQProcessor] Starting DLQ processor (30-minute interval)');

    // Run immediately on start (delay 60s to let workers settle)
    setTimeout(() => {
        runDLQProcessing(connection).catch(err => {
            logger.error('[DLQProcessor] Initial sweep failed:', err.message);
        });
    }, 60 * 1000);

    dlqInterval = setInterval(() => {
        runDLQProcessing(connection).catch(err => {
            logger.error('[DLQProcessor] Sweep failed:', err.message);
        });
    }, DLQ_INTERVAL_MS);
}

export function stopDLQProcessor() {
    if (dlqInterval) {
        clearInterval(dlqInterval);
        dlqInterval = null;
        logger.info('[DLQProcessor] Stopped');
    }
}
