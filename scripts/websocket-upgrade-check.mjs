#!/usr/bin/env node
/**
 * VaultLister WebSocket upgrade check.
 *
 * Verifies that a target base URL accepts a WebSocket upgrade on /ws.
 * This catches edge-layer regressions where the custom domain returns a
 * challenge page or other non-101 response before traffic reaches Railway.
 *
 * Usage:
 *   node scripts/websocket-upgrade-check.mjs https://vaultlister.com
 *   node scripts/websocket-upgrade-check.mjs https://vaultlister.com --json
 */

import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';

const args = process.argv.slice(2);
const baseArg = args.find(arg => arg.startsWith('http'));
const BASE_URL = (baseArg || process.env.BASE_URL || 'https://vaultlister.com').replace(/\/$/, '');
const JSON_MODE = args.includes('--json');
const TIMEOUT_MS = Number(process.env.WS_UPGRADE_TIMEOUT_MS || 10000);
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function log(message) {
    if (!JSON_MODE) {
        process.stdout.write(message);
    }
}

function getDisplayHeader(headers, name) {
    const value = headers[name.toLowerCase()];
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    return value ?? null;
}

function summarizeHeaders(headers) {
    const summary = {};
    for (const name of ['server', 'cf-mitigated', 'upgrade', 'connection', 'sec-websocket-accept', 'content-type']) {
        const value = getDisplayHeader(headers, name);
        if (value) {
            summary[name] = value;
        }
    }
    return summary;
}

function normalizeBody(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function readResponseBody(response, limit = 2048) {
    return new Promise((resolve, reject) => {
        let body = '';

        response.setEncoding('utf8');
        response.on('data', chunk => {
            if (body.length < limit) {
                body += chunk.slice(0, limit - body.length);
            }
        });
        response.on('end', () => resolve(normalizeBody(body)));
        response.on('error', reject);
    });
}

function makeWebSocketUrl(baseUrl) {
    const url = new URL('/ws', baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.toString();
}

async function checkWebSocketUpgrade(baseUrl) {
    const url = new URL('/ws', baseUrl);
    const client = url.protocol === 'https:' ? https : http;
    const key = crypto.randomBytes(16).toString('base64');
    const expectedAccept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');

    return await new Promise((resolve, reject) => {
        const request = client.request({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                Connection: 'Upgrade',
                Upgrade: 'websocket',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Key': key
            }
        });

        const timer = setTimeout(() => {
            request.destroy(new Error(`timed out after ${TIMEOUT_MS}ms`));
        }, TIMEOUT_MS);

        request.on('upgrade', (response, socket) => {
            clearTimeout(timer);

            try {
                const actualAccept = getDisplayHeader(response.headers, 'sec-websocket-accept');
                const details = {
                    target: baseUrl,
                    websocketUrl: makeWebSocketUrl(baseUrl),
                    status: response.statusCode ?? 0,
                    headers: summarizeHeaders(response.headers)
                };

                socket.destroy();

                if (response.statusCode !== 101) {
                    resolve({
                        ok: false,
                        error: `expected 101 Switching Protocols, got ${response.statusCode ?? 'unknown'}`,
                        details
                    });
                    return;
                }

                if (actualAccept !== expectedAccept) {
                    resolve({
                        ok: false,
                        error: 'server returned an invalid Sec-WebSocket-Accept header',
                        details: {
                            ...details,
                            expectedAccept,
                            actualAccept
                        }
                    });
                    return;
                }

                resolve({ ok: true, details });
            } catch (error) {
                reject(error);
            }
        });

        request.on('response', async response => {
            clearTimeout(timer);

            try {
                const bodyPreview = await readResponseBody(response);
                resolve({
                    ok: false,
                    error: `expected 101 Switching Protocols, got ${response.statusCode ?? 'unknown'}`,
                    details: {
                        target: baseUrl,
                        websocketUrl: makeWebSocketUrl(baseUrl),
                        status: response.statusCode ?? 0,
                        headers: summarizeHeaders(response.headers),
                        bodyPreview
                    }
                });
            } catch (error) {
                reject(error);
            }
        });

        request.on('error', error => {
            clearTimeout(timer);
            reject(error);
        });

        request.end();
    });
}

async function main() {
    log('VaultLister WebSocket Upgrade Check\n');
    log(`Target: ${BASE_URL}\n`);
    log(`WebSocket URL: ${makeWebSocketUrl(BASE_URL)}\n\n`);

    let result;
    try {
        result = await checkWebSocketUpgrade(BASE_URL);
    } catch (error) {
        result = {
            ok: false,
            error: error.message,
            details: {
                target: BASE_URL,
                websocketUrl: makeWebSocketUrl(BASE_URL)
            }
        };
    }

    if (result.ok) {
        log('PASS WebSocket upgrade accepted\n');
    } else {
        log(`FAIL WebSocket upgrade rejected: ${result.error}\n`);
        if (result.details?.headers && Object.keys(result.details.headers).length > 0) {
            log(`Headers: ${JSON.stringify(result.details.headers)}\n`);
        }
        if (result.details?.bodyPreview) {
            log(`Body preview: ${result.details.bodyPreview}\n`);
        }
    }

    if (JSON_MODE) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            ok: result.ok,
            target: BASE_URL,
            websocketUrl: makeWebSocketUrl(BASE_URL),
            error: result.error ?? null,
            details: result.details ?? {}
        }, null, 2));
    }

    process.exit(result.ok ? 0 : 1);
}

main();
