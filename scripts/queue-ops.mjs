#!/usr/bin/env node
/**
 * VaultLister queue operations helper.
 *
 * Safe defaults:
 * - read-only unless a command requires --yes
 * - never prints database or Redis URLs
 * - only requeues explicit task IDs unless reset-stale is requested
 */

import postgres from 'postgres';
import { Queue } from 'bullmq';

const args = process.argv.slice(2);
const command = args.find(arg => !arg.startsWith('--')) || 'summary';
const JSON_MODE = args.includes('--json');
const YES = args.includes('--yes');
const LIMIT = readNumberFlag('--limit', 20);
const STALE_MINUTES = readNumberFlag('--minutes', 5);
const TASK_ID = readStringFlag('--id');
const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;

function readStringFlag(name) {
    const index = args.indexOf(name);
    return index === -1 ? null : args[index + 1] || null;
}

function readNumberFlag(name, fallback) {
    const raw = readStringFlag(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${name} must be a non-negative number`);
    }
    return Math.floor(parsed);
}

function log(message) {
    if (!JSON_MODE) {
        console.log(message);
    }
}

function emit(value) {
    if (JSON_MODE) {
        console.log(JSON.stringify(value, null, 2));
    } else {
        console.dir(value, { depth: null, colors: true });
    }
}

function makePostgresClient() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required');
    }
    const ssl = process.env.DATABASE_SSL === 'false' ? false : 'require';
    return postgres(process.env.DATABASE_URL, { ssl });
}

async function getBullMQCounts() {
    if (!redisUrl) {
        return null;
    }

    const queue = new Queue('automation-jobs', { connection: { url: redisUrl } });
    try {
        return await queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
    } finally {
        await queue.close();
    }
}

async function summary(sql) {
    const [statusCounts, pendingDue, staleProcessing, failed24h, bullmq] = await Promise.all([
        sql`
            SELECT status, COUNT(*)::int AS count
            FROM task_queue
            GROUP BY status
            ORDER BY status
        `,
        sql`
            SELECT COUNT(*)::int AS count
            FROM task_queue
            WHERE status = 'pending'
              AND scheduled_at <= NOW()
        `,
        sql`
            SELECT COUNT(*)::int AS count
            FROM task_queue
            WHERE status = 'processing'
              AND started_at < NOW() - (${String(STALE_MINUTES)} || ' minutes')::interval
        `,
        sql`
            SELECT COUNT(*)::int AS count
            FROM task_queue
            WHERE status = 'failed'
              AND updated_at > NOW() - INTERVAL '24 hours'
        `,
        getBullMQCounts()
    ]);

    return {
        taskQueue: {
            byStatus: Object.fromEntries(statusCounts.map(row => [row.status, row.count])),
            pendingDue: pendingDue[0]?.count || 0,
            staleProcessing: staleProcessing[0]?.count || 0,
            staleMinutes: STALE_MINUTES,
            failed24h: failed24h[0]?.count || 0
        },
        bullmq
    };
}

async function listTasks(sql, status) {
    return sql`
        SELECT
            id,
            type,
            status,
            attempts,
            max_attempts,
            priority,
            scheduled_at,
            started_at,
            completed_at,
            updated_at,
            LEFT(COALESCE(last_error, ''), 300) AS last_error
        FROM task_queue
        WHERE status = ${status}
        ORDER BY updated_at DESC
        LIMIT ${LIMIT}
    `;
}

async function listStale(sql) {
    return sql`
        SELECT
            id,
            type,
            status,
            attempts,
            max_attempts,
            priority,
            scheduled_at,
            started_at,
            updated_at,
            LEFT(COALESCE(last_error, ''), 300) AS last_error
        FROM task_queue
        WHERE status = 'processing'
          AND started_at < NOW() - (${String(STALE_MINUTES)} || ' minutes')::interval
        ORDER BY started_at ASC
        LIMIT ${LIMIT}
    `;
}

async function requeueFailed(sql) {
    requireYes('requeue-failed');
    requireTaskId();
    const rows = await sql`
        UPDATE task_queue
        SET status = 'pending',
            scheduled_at = NOW(),
            started_at = NULL,
            completed_at = NULL,
            last_error = NULL,
            updated_at = NOW()
        WHERE id = ${TASK_ID}
          AND status = 'failed'
          AND attempts < max_attempts
        RETURNING id, type, status, attempts, max_attempts, scheduled_at, updated_at
    `;
    if (!rows[0]) {
        throw new Error(`No retryable failed task found for id ${TASK_ID}`);
    }
    return rows[0];
}

async function requeueStale(sql) {
    requireYes('requeue-stale');
    requireTaskId();
    const rows = await sql`
        UPDATE task_queue
        SET status = 'pending',
            scheduled_at = NOW(),
            started_at = NULL,
            last_error = NULL,
            updated_at = NOW()
        WHERE id = ${TASK_ID}
          AND status = 'processing'
          AND started_at < NOW() - (${String(STALE_MINUTES)} || ' minutes')::interval
        RETURNING id, type, status, attempts, max_attempts, scheduled_at, updated_at
    `;
    if (!rows[0]) {
        throw new Error(`No stale processing task found for id ${TASK_ID}`);
    }
    return rows[0];
}

async function resetStale(sql) {
    requireYes('reset-stale');
    const rows = await sql`
        UPDATE task_queue
        SET status = 'pending',
            scheduled_at = NOW(),
            started_at = NULL,
            last_error = NULL,
            updated_at = NOW()
        WHERE status = 'processing'
          AND started_at < NOW() - (${String(STALE_MINUTES)} || ' minutes')::interval
        RETURNING id, type, status, attempts, max_attempts, scheduled_at, updated_at
    `;
    return { requeued: rows.length, tasks: rows };
}

async function listBullMQFailed() {
    if (!redisUrl) {
        throw new Error('REDIS_URL or REDIS_PUBLIC_URL is required for BullMQ inspection');
    }

    const queue = new Queue('automation-jobs', { connection: { url: redisUrl } });
    try {
        const jobs = await queue.getFailed(0, Math.max(0, LIMIT - 1));
        return jobs.map(job => ({
            id: job.id,
            name: job.name,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn
        }));
    } finally {
        await queue.close();
    }
}

function requireTaskId() {
    if (!TASK_ID) {
        throw new Error('--id is required');
    }
}

function requireYes(action) {
    if (!YES) {
        throw new Error(`${action} modifies production data; rerun with --yes after reviewing the target task(s)`);
    }
}

function printUsage() {
    log(`VaultLister queue ops

Usage:
  bun scripts/queue-ops.mjs summary [--minutes 5] [--json]
  bun scripts/queue-ops.mjs list-failed [--limit 20] [--json]
  bun scripts/queue-ops.mjs list-pending [--limit 20] [--json]
  bun scripts/queue-ops.mjs list-stale [--minutes 5] [--limit 20] [--json]
  bun scripts/queue-ops.mjs bullmq-failed [--limit 20] [--json]
  bun scripts/queue-ops.mjs requeue-failed --id TASK_ID --yes
  bun scripts/queue-ops.mjs requeue-stale --id TASK_ID --minutes 5 --yes
  bun scripts/queue-ops.mjs reset-stale --minutes 5 --yes

Environment:
  DATABASE_URL is required for task_queue commands.
  REDIS_PUBLIC_URL or REDIS_URL is required for BullMQ inspection.
`);
}

async function main() {
    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        return;
    }

    let sql = null;
    try {
        if (command === 'bullmq-failed') {
            emit(await listBullMQFailed());
            return;
        }

        sql = makePostgresClient();
        const result = await ({
            summary: () => summary(sql),
            'list-failed': () => listTasks(sql, 'failed'),
            'list-pending': () => listTasks(sql, 'pending'),
            'list-stale': () => listStale(sql),
            'requeue-failed': () => requeueFailed(sql),
            'requeue-stale': () => requeueStale(sql),
            'reset-stale': () => resetStale(sql)
        })[command]?.();

        if (!result) {
            throw new Error(`Unknown command: ${command}`);
        }
        emit(result);
    } finally {
        if (sql) {
            await sql.end();
        }
    }
}

main().catch(error => {
    console.error(`queue-ops failed: ${error.message}`);
    process.exit(1);
});
