#!/usr/bin/env bun
// VaultLister Push Subscription Cleanup
// Probes every active push subscription and removes stale ones (410 / 404).
//
// Usage:
//   bun scripts/push-cleanup.js
//   bun scripts/push-cleanup.js --dry-run        # report only, no deletes
//   bun scripts/push-cleanup.js --batch-size 25  # concurrent probes per batch
//   bun scripts/push-cleanup.js --delay-ms 200   # ms between batches
//
// Required env: DATABASE_URL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// Optional env: VAPID_SUBJECT (defaults to mailto:admin@vaultlister.app)

import webpush from 'web-push';
import postgres from 'postgres';
import { appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const AUDIT_LOG = join(ROOT_DIR, 'data', 'automation-audit.log');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const batchArg = args.indexOf('--batch-size');
const BATCH_SIZE = batchArg !== -1 ? parseInt(args[batchArg + 1], 10) || 20 : 20;
const delayArg = args.indexOf('--delay-ms');
const DELAY_MS = delayArg !== -1 ? parseInt(args[delayArg + 1], 10) || 150 : 150;

// ── Validate env ──────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@vaultlister.app';

if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required.');
    process.exit(1);
}

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('Error: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are required.');
    process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ── Audit log helper ──────────────────────────────────────────────────────────
function auditLog(event, meta = {}) {
    try {
        mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
        appendFileSync(
            AUDIT_LOG,
            JSON.stringify({ ts: new Date().toISOString(), platform: 'push-cleanup', event, ...meta }) + '\n'
        );
    } catch (_) {}
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Silent payload — zero-byte push, browser SW receives but shows nothing ────
// web-push requires a non-empty buffer when sending encrypted payloads;
// passing null/undefined sends an empty (no-body) push which is valid for probe.
const SILENT_PAYLOAD = null;

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
    console.log('VaultLister Push Subscription Cleanup');
    console.log('======================================');
    if (DRY_RUN) console.log('DRY RUN — no changes will be written to the database.\n');

    const sql = postgres(DATABASE_URL, { ssl: 'prefer', max: 5, idle_timeout: 30 });

    let totalChecked = 0;
    let totalRemoved = 0;
    let totalActive = 0;
    let totalErrors = 0;

    try {
        // Fetch all active subscriptions
        const rows = await sql`
            SELECT id, user_id, endpoint, p256dh_key, auth_key
            FROM push_subscriptions
            WHERE is_active = TRUE
            ORDER BY last_used_at ASC NULLS FIRST
        `;

        const total = rows.length;
        console.log(`Found ${total} active push subscription(s) to check.`);
        console.log(`Batch size: ${BATCH_SIZE} | Inter-batch delay: ${DELAY_MS}ms\n`);

        if (total === 0) {
            console.log('Nothing to clean up.');
            auditLog('run_complete', { checked: 0, removed: 0, active: 0, dry_run: DRY_RUN });
            await sql.end();
            return;
        }

        // Process in batches to avoid overwhelming push services
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map((sub) => probeSub(sub))
            );

            for (let j = 0; j < batch.length; j++) {
                const sub = batch[j];
                const result = results[j];
                totalChecked++;

                if (result.status === 'rejected') {
                    totalErrors++;
                    console.log(`  [ERROR] id=${sub.id} — unexpected probe failure: ${result.reason?.message}`);
                    continue;
                }

                const { stale, statusCode } = result.value;

                if (stale) {
                    totalRemoved++;
                    console.log(`  [STALE] id=${sub.id} status=${statusCode} → ${DRY_RUN ? 'would delete' : 'deleted'}`);

                    if (!DRY_RUN) {
                        try {
                            await sql`
                                DELETE FROM push_subscriptions
                                WHERE id = ${sub.id}
                            `;
                        } catch (dbErr) {
                            console.error(`  [DB ERROR] Failed to delete id=${sub.id}: ${dbErr.message}`);
                            totalErrors++;
                        }
                    }

                    auditLog('stale_removed', { sub_id: sub.id, status_code: statusCode, dry_run: DRY_RUN });
                } else {
                    totalActive++;
                }
            }

            // Rate-limit: pause between batches (skip after the last batch)
            if (i + BATCH_SIZE < rows.length) {
                await sleep(DELAY_MS);
            }
        }

    } finally {
        await sql.end();
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    console.log('\n── Summary ─────────────────────────────────────────────');
    console.log(`  Total checked : ${totalChecked}`);
    console.log(`  Still active  : ${totalActive}`);
    console.log(`  Stale removed : ${totalRemoved}${DRY_RUN ? ' (dry run — not actually removed)' : ''}`);
    console.log(`  Probe errors  : ${totalErrors}`);
    console.log('────────────────────────────────────────────────────────');

    auditLog('run_complete', {
        checked: totalChecked,
        removed: totalRemoved,
        active: totalActive,
        errors: totalErrors,
        dry_run: DRY_RUN
    });
}

// ── Probe a single subscription ───────────────────────────────────────────────
// Returns { stale: boolean, statusCode: number|null }
async function probeSub(sub) {
    const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key }
    };

    try {
        // Send a silent (no payload) push. A healthy subscription returns 201.
        await webpush.sendNotification(pushSub, SILENT_PAYLOAD);
        return { stale: false, statusCode: 201 };
    } catch (err) {
        const code = err.statusCode;

        // 404 or 410 = subscription expired / revoked by the push service
        if (code === 404 || code === 410) {
            return { stale: true, statusCode: code };
        }

        // 429 = push service rate-limiting us — treat as still active
        if (code === 429) {
            console.warn(`  [RATE LIMITED] id=${sub.id} — treating as active`);
            return { stale: false, statusCode: code };
        }

        // 5xx from the push service — treat as still active, log for visibility
        if (code >= 500) {
            console.warn(`  [PUSH SVC ERROR] id=${sub.id} status=${code} — treating as active`);
            return { stale: false, statusCode: code };
        }

        // Any other error (network timeout, VAPID invalid, etc.) — not stale
        return { stale: false, statusCode: code ?? null };
    }
}

run().catch((err) => {
    console.error('Fatal error:', err.message);
    auditLog('fatal_error', { error: err.message });
    process.exit(1);
});
