#!/usr/bin/env node
/**
 * poshmark-offer-sync.mjs — Poshmark Offer Detection + Auto-Counter
 * Scrapes Poshmark /offers page, syncs pending buyer offers to the DB,
 * applies the auto-offer rule (80% min / 90% counter), and sends counters
 * directly on Poshmark via Playwright.
 *
 * Run:  node scripts/poshmark-offer-sync.mjs [--dry-run] [--headful]
 *
 * --dry-run   Scrape and log offers but don't send counters or update DB
 * --headful   Show browser window (useful for debugging selectors)
 */

import { stealthChromium, randomChromeUA, randomViewport, STEALTH_ARGS, STEALTH_IGNORE_DEFAULTS, mouseWiggle } from '../src/shared/automations/stealth.js';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT        = join(__dirname, '..');
const COOKIE_FILE = join(ROOT, 'data', 'poshmark-cookies.json');
const AUDIT_LOG   = join(ROOT, 'data', 'automation-audit.log');
const DB_PATH     = join(ROOT, 'data', 'vaultlister.db');
const SCREENSHOT  = join(ROOT, 'data', 'offers-page-debug.png');

const POSHMARK_DOMAINS = { us: 'https://poshmark.com', ca: 'https://poshmark.ca', au: 'https://poshmark.com.au', in: 'https://poshmark.in' };
const POSHMARK_URL = POSHMARK_DOMAINS[(process.env.POSHMARK_COUNTRY || 'us').toLowerCase()] || POSHMARK_DOMAINS.us;

// Rule params — match the DB automation rule
const MIN_PCT     = 80;  // ignore offers below this % of list price
const COUNTER_PCT = 90;  // counter at this % of list price

const isDryRun  = process.argv.includes('--dry-run');
const isHeadful = process.argv.includes('--headful');

function log(msg, data) {
    const extra = data !== undefined ? ' ' + JSON.stringify(data) : '';
    process.stderr.write(`[${new Date().toISOString()}] [OfferSync] ${msg}${extra}\n`);
}

function writeAuditLog(event, meta = {}) {
    try {
        appendFileSync(AUDIT_LOG, JSON.stringify({ ts: new Date().toISOString(), platform: 'poshmark', event, ...meta }) + '\n');
    } catch (_) {}
}

function parseDollar(str) {
    if (!str) return null;
    const n = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
}

function delay(min = 1500, max = 3500) {
    return Math.floor(Math.random() * ((max) - (min) + 1)) + (min);
}

async function humanType(page, selector, text) {
    await page.click(selector);
    await page.waitForTimeout(200);
    for (const ch of text) {
        await page.keyboard.type(ch);
        await page.waitForTimeout(Math.floor(Math.random() * 100) + 50);
    }
}

let browser, page, db;

try {
    log('Starting' + (isDryRun ? ' [DRY RUN]' : '') + (isHeadful ? ' [HEADFUL]' : ''));

    if (!existsSync(COOKIE_FILE)) {
        log('ERROR: Cookie file not found: ' + COOKIE_FILE);
        process.exit(1);
    }

    // ── Launch browser (stealth Chromium instead of plain Firefox) ─────────
    browser = await stealthChromium.launch({
        headless: !isHeadful,
        slowMo: 50,
        args: STEALTH_ARGS,
        ignoreDefaultArgs: STEALTH_IGNORE_DEFAULTS,
    });

    const context = await browser.newContext({
        userAgent: randomChromeUA(),
        viewport: randomViewport(),
        locale: 'en-US',
        timezoneId: 'America/New_York',
    });
    page = await context.newPage();

    // ── Load cookies ──────────────────────────────────────────────────────────
    const cookies = JSON.parse(readFileSync(COOKIE_FILE, 'utf8'));
    await context.addCookies(cookies);
    log('Cookies loaded', { count: cookies.length });

    // ── Verify session ────────────────────────────────────────────────────────
    await page.goto(`${POSHMARK_URL}/feed`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const loggedIn = await page.$('.user-image, .header__account-info-list, [data-et="my_closet"], .header__nav--user');
    log(loggedIn ? 'Session valid' : 'WARN: Could not verify session (cookies may be expired, continuing)');

    // ── Navigate to offers ────────────────────────────────────────────────────
    let navigated = false;
    for (const url of [`${POSHMARK_URL}/offers/my_offers`, `${POSHMARK_URL}/offers`]) {
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(delay(2000, 3000));
            navigated = true;
            log('Navigated to offers', { url });
            break;
        } catch (e) {
            log('WARN: ' + url + ' failed', { error: e.message });
        }
    }

    await page.screenshot({ path: SCREENSHOT });
    log('Debug screenshot saved', { path: SCREENSHOT });

    if (!navigated) { log('ERROR: Could not reach offers page'); await browser.close(); process.exit(1); }

    // ── Scrape offer cards ────────────────────────────────────────────────────
    const raw = await page.evaluate(() => {
        // Strategy A: data-test attributes
        let cards = [...document.querySelectorAll('[data-test="offer-card"]')];
        if (cards.length) {
            return { strategy: 'data-test', items: cards.map((c, i) => ({
                index: i,
                itemTitle:      c.querySelector('[data-test="item-title"]')?.textContent?.trim() || null,
                offerAmountStr: c.querySelector('[data-test="offer-amount"]')?.textContent?.trim() || null,
                listPriceStr:   c.querySelector('[data-test="list-price"]')?.textContent?.trim() || null,
                buyerUsername:  c.querySelector('[data-test="buyer-username"]')?.textContent?.trim() || null
            })) };
        }
        // Strategy B: generic class matching
        cards = [...document.querySelectorAll('.offer-card, .offer__card, [class*="offer-card"]')];
        if (cards.length) {
            return { strategy: 'class-match', items: cards.map((c, i) => ({ index: i, rawText: c.innerText?.substring(0, 400) || '' })) };
        }
        return { strategy: 'empty', pageText: document.body.innerText.substring(0, 600) };
    });

    log('Page scraped', { strategy: raw.strategy, count: raw.items?.length ?? 0 });

    if (raw.strategy === 'empty') {
        log('No offer cards found.');
        if (raw.pageText) log('Page preview', { text: raw.pageText.substring(0, 200) });
        log('TIP: Use --headful to visually inspect, or check screenshot at ' + SCREENSHOT);
        await browser.close();
        process.exit(0);
    }

    if (raw.strategy === 'class-match') {
        log('WARN: Fallback selectors — cannot auto-process. Update selectors in this script.');
        raw.items.forEach(o => log('Card ' + o.index, { rawText: o.rawText }));
        await browser.close();
        process.exit(1);
    }

    // ── Parse + classify ──────────────────────────────────────────────────────
    const parsed = raw.items.map(o => {
        const offerAmount = parseDollar(o.offerAmountStr);
        const listPrice   = parseDollar(o.listPriceStr);
        const pct         = (offerAmount && listPrice) ? (offerAmount / listPrice) * 100 : null;
        const counterAmt  = (pct !== null && pct >= MIN_PCT && listPrice)
            ? Math.round(listPrice * (COUNTER_PCT / 100) * 100) / 100
            : null;
        const action = pct === null           ? 'skip_no_price'
                     : pct < MIN_PCT          ? 'skip_too_low'
                     : (counterAmt && counterAmt > offerAmount) ? 'counter'
                     : 'accept';
        return { ...o, offerAmount, listPrice, pct: pct ? +pct.toFixed(1) : null, counterAmt, action };
    });

    log('--- Offer summary ---');
    parsed.forEach(o => log(
        `  [${o.index}] "${o.itemTitle}" buyer=${o.buyerUsername} offer=$${o.offerAmount} list=$${o.listPrice} ${o.pct}% → ${o.action}${o.counterAmt ? ' ($' + o.counterAmt + ')' : ''}`
    ));

    if (isDryRun) {
        log('DRY RUN — no actions taken. Remove --dry-run to process.');
        await browser.close();
        process.exit(0);
    }

    // ── DB ────────────────────────────────────────────────────────────────────
    db = new Database(DB_PATH);
    const userId = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;

    let countered = 0, skipped = 0, errors = 0;

    for (const offer of parsed) {
        if (offer.action === 'skip_no_price' || offer.action === 'skip_too_low') {
            log(`Skip [${offer.index}]: ${offer.action} (pct=${offer.pct}%)`);
            skipped++;
            continue;
        }

        try {
            if (offer.action === 'counter') {
                log(`Countering [${offer.index}] with $${offer.counterAmt}...`);

                await page.goto(`${POSHMARK_URL}/offers/my_offers`, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(delay(2000, 3000));

                const cards = await page.$$('[data-test="offer-card"]');
                const card  = cards[offer.index];
                if (!card) { log(`WARN: Card [${offer.index}] gone — already handled?`); skipped++; continue; }

                const counterBtn = await card.$('[data-test="counter-offer"]');
                if (!counterBtn) {
                    const btns = await card.$$eval('button', bs => bs.map(b => b.textContent?.trim()));
                    log(`WARN: counter-offer btn not found. Buttons:`, btns);
                    skipped++; continue;
                }

                await counterBtn.click();
                await page.waitForTimeout(delay(800, 1500));

                const inputEl = await page.$('[data-test="counter-amount-input"]');
                if (!inputEl) { log('WARN: counter input not found'); skipped++; continue; }

                await humanType(page, '[data-test="counter-amount-input"]', offer.counterAmt.toFixed(2));
                await page.waitForTimeout(delay(500, 1000));

                const submitBtn = await page.$('[data-test="submit-counter"]');
                if (!submitBtn) { log('WARN: submit-counter not found'); skipped++; continue; }

                await submitBtn.click();
                await page.waitForTimeout(delay(1500, 2500));

                log(`Counter sent: $${offer.counterAmt} on "${offer.itemTitle}"`);
                writeAuditLog('counter_offer_sent', {
                    buyer: offer.buyerUsername, item: offer.itemTitle,
                    offerAmount: offer.offerAmount, counterAmount: offer.counterAmt, pct: offer.pct
                });
                countered++;

                // Sync to DB
                if (userId) {
                    const listing = db.prepare("SELECT id FROM listings WHERE title LIKE ? AND platform='poshmark' LIMIT 1")
                                      .get('%' + (offer.itemTitle || '').substring(0, 20) + '%');
                    const existing = db.prepare("SELECT id FROM offers WHERE buyer_username=? AND platform='poshmark' AND status='pending' LIMIT 1")
                                       .get(offer.buyerUsername);
                    if (!existing) {
                        db.prepare(`INSERT INTO offers (id,user_id,listing_id,platform,buyer_username,offer_amount,counter_amount,status,auto_action,responded_at,created_at,updated_at)
                                    VALUES (?,?,?,'poshmark',?,?,?,'countered','auto_counter',datetime('now'),datetime('now'),datetime('now'))`)
                          .run(randomUUID(), userId, listing?.id || null, offer.buyerUsername, offer.offerAmount, offer.counterAmt);
                    } else {
                        db.prepare("UPDATE offers SET status='countered',counter_amount=?,auto_action='auto_counter',responded_at=datetime('now'),updated_at=CURRENT_TIMESTAMP WHERE id=?")
                          .run(offer.counterAmt, existing.id);
                    }
                    log('DB synced');
                }

            } else if (offer.action === 'accept') {
                log(`Accepting [${offer.index}] (counter would not exceed offer)...`);
                await page.goto(`${POSHMARK_URL}/offers/my_offers`, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(delay(2000, 3000));
                const cards = await page.$$('[data-test="offer-card"]');
                const card  = cards[offer.index];
                if (card) {
                    const acceptBtn = await card.$('[data-test="accept-offer"]');
                    if (acceptBtn) {
                        await acceptBtn.click();
                        await page.waitForTimeout(delay(1000, 2000));
                        const confirmBtn = await page.$('[data-test="confirm-accept"]');
                        if (confirmBtn) {
                            await confirmBtn.click();
                            writeAuditLog('accept_offer_sent', { buyer: offer.buyerUsername, item: offer.itemTitle, offerAmount: offer.offerAmount });
                            countered++;
                            log(`Accepted offer from ${offer.buyerUsername}`);
                        }
                    }
                }
            }

        } catch (err) {
            log(`ERROR on offer [${offer.index}]: ${err.message}`);
            writeAuditLog('offer_error', { index: offer.index, error: err.message });
            errors++;
        }
    }

    log('Done.', { countered, skipped, errors });
    writeAuditLog('offer_sync_complete', { countered, skipped, errors });

    if (db) db.close();
    await browser.close();
    process.exit(errors > 0 ? 1 : 0);

} catch (err) {
    log('Fatal: ' + err.message);
    if (page) await page.screenshot({ path: SCREENSHOT }).catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (db) db.close();
    process.exit(1);
}
