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
const ALLOW_CLOUDFLARE_CHALLENGE = args.includes('--allow-cloudflare-challenge');
const TIMEOUT_MS = Number(process.env.BROWSER_WS_TIMEOUT_MS || 10000);

function log(message) {
    if (!JSON_MODE) {
        process.stdout.write(message);
    }
}

function normalizeText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function isCloudflareChallenge({ status, pageTitle, bodyPreview }) {
    const text = `${pageTitle || ''} ${bodyPreview || ''}`;
    const challengeText = /just a moment|cf-challenge|challenge-platform|cloudflare/i.test(text);
    return challengeText && (status === 403 || normalizeText(pageTitle).toLowerCase() === 'just a moment...');
}

async function runBrowserCheck(baseUrl) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        let response;
        let navigationError = null;
        try {
            response = await page.goto(baseUrl, {
                waitUntil: 'domcontentloaded',
                timeout: TIMEOUT_MS
            });
        } catch (error) {
            navigationError = error;
        }

        const status = response?.status() ?? 0;
        const pageTitle = await page.title().catch(() => '');
        const bodyPreview = normalizeText(await page.locator('body').innerText({ timeout: 1000 }).catch(() => '')).slice(0, 500);
        const challengeStatus = status || (/ERR_HTTP_RESPONSE_CODE_FAILURE|403/.test(navigationError?.message || '') ? 403 : 0);

        if (isCloudflareChallenge({ status: challengeStatus, pageTitle, bodyPreview })) {
            return {
                ok: false,
                classification: 'cloudflare_challenge',
                error: 'Cloudflare challenge intercepted the browser check before the app loaded',
                details: {
                    target: baseUrl,
                    status: challengeStatus,
                    finalUrl: page.url(),
                    pageTitle,
                    bodyPreview,
                    navigationError: navigationError?.message || null
                }
            };
        }

        if (navigationError) {
            return {
                ok: false,
                classification: 'navigation_failed',
                error: navigationError.message,
                details: {
                    target: baseUrl,
                    status,
                    finalUrl: page.url(),
                    pageTitle,
                    bodyPreview
                }
            };
        }

        if (!response || status >= 400) {
            return {
                ok: false,
                classification: 'navigation_failed',
                error: `expected app document, got ${status || 'no response'}`,
                details: {
                    target: baseUrl,
                    status,
                    finalUrl: page.url(),
                    pageTitle,
                    bodyPreview
                }
            };
        }

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

        const classification = ok
            ? 'ok'
            : websocketResult.final === 'timeout'
                ? 'timeout'
                : 'app_loaded_ws_failed';

        return {
            ok,
            classification,
            error: ok ? null : `browser websocket check failed: ${websocketResult.final}`,
            details: {
                target: baseUrl,
                status,
                finalUrl: page.url(),
                pageTitle,
                bodyPreview,
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
            classification: 'navigation_failed',
            error: error.message,
            details: {
                target: BASE_URL
            }
        };
    }

    if (result.ok) {
        log('PASS Browser WebSocket connected and received initial message\n');
    } else if (result.classification === 'cloudflare_challenge') {
        log(`WARN Browser WebSocket check hit Cloudflare challenge: ${result.error}\n`);
        if (result.details) {
            log(`${JSON.stringify(result.details)}\n`);
        }
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
            classification: result.classification || (result.ok ? 'ok' : 'unknown'),
            target: BASE_URL,
            error: result.error ?? null,
            details: result.details ?? {}
        }, null, 2));
    }

    const allowedChallenge = ALLOW_CLOUDFLARE_CHALLENGE && result.classification === 'cloudflare_challenge';
    process.exit(result.ok || allowedChallenge ? 0 : 1);
}

main();
