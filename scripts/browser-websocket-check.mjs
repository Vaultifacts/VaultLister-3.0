#!/usr/bin/env node
/**
 * VaultLister browser WebSocket check.
 *
 * Opens the target URL in Chromium and verifies that the browser can connect to
 * /ws and receive the initial "connected" message. This exercises the real
 * user-facing path through Cloudflare and Railway.
 *
 * Usage:
 *   node scripts/browser-websocket-check.mjs https://vaultlister.com
 *   node scripts/browser-websocket-check.mjs https://vaultlister.com --json
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const baseArg = args.find(arg => arg.startsWith('http'));
const BASE_URL = (baseArg || process.env.BASE_URL || 'https://vaultlister.com').replace(/\/$/, '');
const JSON_MODE = args.includes('--json');
const TIMEOUT_MS = Number(process.env.BROWSER_WS_TIMEOUT_MS || 10000);

function log(message) {
    if (!JSON_MODE) {
        process.stdout.write(message);
    }
}

async function runBrowserCheck(baseUrl) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        const response = await page.goto(baseUrl, {
            waitUntil: 'domcontentloaded',
            timeout: TIMEOUT_MS
        });

        const pageTitle = await page.title();
        const websocketResult = await page.evaluate(async timeoutMs => {
            return await new Promise(resolve => {
                const events = [];
                const websocketUrl = `${location.origin.replace(/^http/, 'ws')}/ws`;
                const socket = new WebSocket(websocketUrl);

                const finish = (final, extra = {}) => {
                    try { socket.close(); } catch {}
                    resolve({
                        final,
                        websocketUrl,
                        events,
                        ...extra
                    });
                };

                const timer = setTimeout(() => finish('timeout'), timeoutMs);

                socket.addEventListener('open', () => {
                    events.push({ type: 'open' });
                });

                socket.addEventListener('message', event => {
                    events.push({ type: 'message', data: event.data });
                    clearTimeout(timer);
                    finish('message');
                });

                socket.addEventListener('error', () => {
                    events.push({ type: 'error' });
                    clearTimeout(timer);
                    finish('error');
                });

                socket.addEventListener('close', event => {
                    events.push({
                        type: 'close',
                        code: event.code,
                        reason: event.reason,
                        wasClean: event.wasClean
                    });
                });
            });
        }, TIMEOUT_MS);

        const ok = websocketResult.final === 'message'
            && websocketResult.events.some(event => event.type === 'open')
            && websocketResult.events.some(event => event.type === 'message');

        return {
            ok,
            details: {
                target: baseUrl,
                status: response?.status() ?? 0,
                finalUrl: page.url(),
                pageTitle,
                websocket: websocketResult
            }
        };
    } finally {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
    }
}

async function main() {
    log('VaultLister Browser WebSocket Check\n');
    log(`Target: ${BASE_URL}\n\n`);

    let result;
    try {
        result = await runBrowserCheck(BASE_URL);
    } catch (error) {
        result = {
            ok: false,
            error: error.message,
            details: {
                target: BASE_URL
            }
        };
    }

    if (result.ok) {
        log('PASS Browser WebSocket connected and received initial message\n');
    } else {
        log(`FAIL Browser WebSocket check failed: ${result.error || result.details?.websocket?.final || 'unknown error'}\n`);
        if (result.details) {
            log(`${JSON.stringify(result.details)}\n`);
        }
    }

    if (JSON_MODE) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            ok: result.ok,
            target: BASE_URL,
            error: result.error ?? null,
            details: result.details ?? {}
        }, null, 2));
    }

    process.exit(result.ok ? 0 : 1);
}

main();
