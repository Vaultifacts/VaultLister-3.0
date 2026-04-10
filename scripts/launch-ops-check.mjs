#!/usr/bin/env node
/**
 * VaultLister launch operations check.
 *
 * Default mode checks public health endpoints only.
 * Optional smoke checks require production secrets in the local environment:
 *   --task-queue  requires DATABASE_URL
 *   --websocket   requires JWT_SECRET and REDIS_URL or REDIS_PUBLIC_URL
 */

import crypto from 'node:crypto';
import postgres from 'postgres';
import Redis from 'ioredis';
import { Queue } from 'bullmq';
import jwt from 'jsonwebtoken';

const args = process.argv.slice(2);
const baseArg = args.find(arg => arg.startsWith('http'));
const BASE_URL = (baseArg || process.env.BASE_URL || 'https://vaultlister.com').replace(/\/$/, '');
const RUN_TASK_QUEUE = args.includes('--task-queue') || args.includes('--all');
const RUN_WEBSOCKET = args.includes('--websocket') || args.includes('--all');
const RUN_QUEUE_METRICS = args.includes('--queue-metrics') || args.includes('--all');
const JSON_MODE = args.includes('--json');
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
const TASK_QUEUE_PENDING_MAX = Number(process.env.TASK_QUEUE_PENDING_MAX || 50);
const TASK_QUEUE_FAILED_24H_MAX = Number(process.env.TASK_QUEUE_FAILED_24H_MAX || 10);
const TASK_QUEUE_STALE_PROCESSING_MAX = Number(process.env.TASK_QUEUE_STALE_PROCESSING_MAX || 0);
const BULLMQ_WAITING_MAX = Number(process.env.BULLMQ_WAITING_MAX || 50);
const BULLMQ_FAILED_MAX = Number(process.env.BULLMQ_FAILED_MAX || 10);
const results = [];

function log(message) {
    if (!JSON_MODE) {
        process.stdout.write(message);
    }
}

async function check(name, fn) {
    const started = Date.now();
    try {
        const details = await fn();
        const ms = Date.now() - started;
        results.push({ name, status: 'pass', ms, details });
        log(`PASS ${name} (${ms}ms)\n`);
    } catch (error) {
        const ms = Date.now() - started;
        results.push({ name, status: 'fail', ms, error: error.message });
        log(`FAIL ${name} (${ms}ms): ${error.message}\n`);
    }
}

async function fetchJson(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        const body = await response.json().catch(() => null);
        return { status: response.status, body };
    } finally {
        clearTimeout(timeout);
    }
}

function makePostgresClient() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for --task-queue');
    }

    const ssl = process.env.DATABASE_SSL === 'false' ? false : 'require';
    return postgres(process.env.DATABASE_URL, { ssl });
}

function websocketUrl() {
    const url = new URL(BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    return url.toString();
}

async function checkReady() {
    const { status, body } = await fetchJson('/api/health/ready');
    if (status !== 200) {
        throw new Error(`expected 200, got ${status}: ${JSON.stringify(body)}`);
    }
    if (body?.status !== 'ok') {
        throw new Error(`expected status ok, got ${JSON.stringify(body)}`);
    }
    if (body.checks?.database !== 'ok') {
        throw new Error(`database check is ${body.checks?.database}`);
    }
    if (body.checks?.redis !== 'ok') {
        throw new Error(`redis check is ${body.checks?.redis}`);
    }
    return body;
}

async function checkWorkersHealth() {
    const { status, body } = await fetchJson('/api/workers/health');
    if (status !== 200) {
        throw new Error(`expected 200, got ${status}: ${JSON.stringify(body)}`);
    }
    if (body?.overall !== 'ok') {
        throw new Error(`expected overall ok, got ${JSON.stringify(body)}`);
    }
    return body;
}

async function checkTaskQueueSmoke() {
    const sql = makePostgresClient();
    const taskId = `smoke-worker-${crypto.randomUUID().replaceAll('-', '')}`;
    const payload = JSON.stringify({ ruleId: `smoke-nonexistent-rule-${Date.now()}` });

    try {
        await sql`
            INSERT INTO task_queue (id, type, payload, status, priority, max_attempts, scheduled_at)
            VALUES (${taskId}, ${'run_automation'}, ${payload}, ${'pending'}, ${1000}, ${1}, NOW())
        `;

        const deadline = Date.now() + TIMEOUT_MS;
        let row = null;
        while (Date.now() < deadline) {
            const rows = await sql`
                SELECT id, type, status, attempts, last_error, started_at, completed_at, updated_at
                FROM task_queue
                WHERE id = ${taskId}
            `;
            row = rows[0] || null;
            if (row && ['completed', 'failed'].includes(row.status)) {
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (!row) {
            throw new Error(`smoke task disappeared before completion: ${taskId}`);
        }
        if (row.status !== 'completed') {
            throw new Error(`expected completed task, got ${JSON.stringify(row)}`);
        }
        if (Number(row.attempts) !== 1) {
            throw new Error(`expected attempts=1, got ${row.attempts}`);
        }
        if (row.last_error) {
            throw new Error(`expected no last_error, got ${row.last_error}`);
        }

        return { taskId, status: row.status, attempts: row.attempts };
    } finally {
        await sql`DELETE FROM task_queue WHERE id = ${taskId}`.catch(() => {});
        await sql.end();
    }
}

async function checkQueueMetrics() {
    const sql = makePostgresClient();
    const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;

    try {
        const [pendingRows, staleRows, failedRows] = await Promise.all([
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
                  AND started_at < NOW() - INTERVAL '5 minutes'
            `,
            sql`
                SELECT COUNT(*)::int AS count
                FROM task_queue
                WHERE status = 'failed'
                  AND updated_at > NOW() - INTERVAL '24 hours'
            `
        ]);

        const metrics = {
            taskQueue: {
                pendingDue: pendingRows[0].count,
                staleProcessing: staleRows[0].count,
                failed24h: failedRows[0].count
            }
        };

        if (metrics.taskQueue.pendingDue > TASK_QUEUE_PENDING_MAX) {
            throw new Error(`task_queue pending due ${metrics.taskQueue.pendingDue} > ${TASK_QUEUE_PENDING_MAX}`);
        }
        if (metrics.taskQueue.staleProcessing > TASK_QUEUE_STALE_PROCESSING_MAX) {
            throw new Error(`task_queue stale processing ${metrics.taskQueue.staleProcessing} > ${TASK_QUEUE_STALE_PROCESSING_MAX}`);
        }
        if (metrics.taskQueue.failed24h > TASK_QUEUE_FAILED_24H_MAX) {
            throw new Error(`task_queue failed 24h ${metrics.taskQueue.failed24h} > ${TASK_QUEUE_FAILED_24H_MAX}`);
        }

        if (redisUrl) {
            const queue = new Queue('automation-jobs', { connection: { url: redisUrl } });
            try {
                const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
                metrics.bullmq = counts;
                if ((counts.waiting || 0) > BULLMQ_WAITING_MAX) {
                    throw new Error(`BullMQ waiting ${counts.waiting} > ${BULLMQ_WAITING_MAX}`);
                }
                if ((counts.failed || 0) > BULLMQ_FAILED_MAX) {
                    throw new Error(`BullMQ failed ${counts.failed} > ${BULLMQ_FAILED_MAX}`);
                }
            } finally {
                await queue.close();
            }
        }

        return metrics;
    } finally {
        await sql.end();
    }
}

async function checkWebSocketSmoke() {
    const secret = process.env.JWT_SECRET;
    const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
    if (!secret) {
        throw new Error('JWT_SECRET is required for --websocket');
    }
    if (!redisUrl) {
        throw new Error('REDIS_URL or REDIS_PUBLIC_URL is required for --websocket');
    }

    const userId = `ws-smoke-${crypto.randomUUID().replaceAll('-', '')}`;
    const token = jwt.sign({ userId, type: 'access' }, secret, {
        algorithm: 'HS256',
        expiresIn: '2m'
    });
    const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 10000,
        lazyConnect: false
    });
    redis.on('error', () => {});

    const ws = new WebSocket(websocketUrl());
    const smokeId = `ws-smoke-${Date.now()}`;
    let connectionId = null;
    let sawConnected = false;
    let sawAuth = false;
    let sawSmoke = false;

    try {
        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error('timed out waiting for WebSocket smoke message')),
                TIMEOUT_MS
            );

            ws.onopen = () => {
                ws.send(JSON.stringify({ type: 'auth', token }));
            };

            ws.onmessage = async (event) => {
                const message = JSON.parse(event.data);
                if (message.type === 'connected') {
                    sawConnected = true;
                    connectionId = message.connectionId;
                }
                if (message.type === 'auth_success') {
                    sawAuth = true;
                    await redis.publish('vaultlister:ws:broadcast', JSON.stringify({
                        topic: `user.${userId}`,
                        data: { type: 'smoke.ws', smokeId, userId },
                        excludeConnectionId: null
                    }));
                }
                if (message.type === 'smoke.ws' && message.smokeId === smokeId) {
                    sawSmoke = true;
                    clearTimeout(timeout);
                    resolve({ sawConnected, sawAuth, sawSmoke, connectionId, userId });
                }
                if (message.type === 'auth_failed') {
                    clearTimeout(timeout);
                    reject(new Error(`auth failed: ${message.message}`));
                }
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('WebSocket error'));
            };
        });

        return result;
    } finally {
        try { ws.close(); } catch {}
        try { await redis.quit(); } catch { redis.disconnect(); }
    }
}

async function main() {
    log(`VaultLister Launch Ops Check\nTarget: ${BASE_URL}\n\n`);

    await check('app readiness', checkReady);
    await check('worker heartbeat health', checkWorkersHealth);

    if (RUN_TASK_QUEUE) {
        await check('safe task_queue smoke', checkTaskQueueSmoke);
    } else {
        log('SKIP safe task_queue smoke (pass --task-queue or --all)\n');
    }

    if (RUN_QUEUE_METRICS) {
        await check('queue backlog and failure thresholds', checkQueueMetrics);
    } else {
        log('SKIP queue backlog and failure thresholds (pass --queue-metrics or --all)\n');
    }

    if (RUN_WEBSOCKET) {
        await check('WebSocket Redis pub/sub smoke', checkWebSocketSmoke);
    } else {
        log('SKIP WebSocket Redis pub/sub smoke (pass --websocket or --all)\n');
    }

    const passed = results.filter(result => result.status === 'pass').length;
    const failed = results.filter(result => result.status === 'fail').length;

    if (JSON_MODE) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            target: BASE_URL,
            passed,
            failed,
            checks: results
        }, null, 2));
    } else {
        log(`\n${passed} passed, ${failed} failed\n`);
    }

    process.exit(failed === 0 ? 0 : 1);
}

main().catch(error => {
    console.error(`Launch ops check failed: ${error.message}`);
    process.exit(1);
});
