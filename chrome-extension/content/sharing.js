// sharing.js — Poshmark closet sharing content script for VaultLister Extension
// Runs on poshmark.com/closet/* pages. Triggered by a share_closet job from the service worker.
// Iterates visible listing cards, clicks Share -> To Followers on each, respects delays.
//
// Selector notes: Poshmark updates their UI periodically.
// If sharing stops working, inspect https://poshmark.com/closet/{username} and look for:
//   - Listing card:   [data-et-name="listing_tile"], .m__listing-card, .card--small
//   - Share button:   [data-et-name="share"], .social-action-bar__share, button[aria-label*="Share"]
//   - To Followers:   [data-et-name="share_modal_to_followers_btn"], button containing "Followers"
//   - CAPTCHA:        .h-captcha, #captcha-box, text "Are you human"

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForElement(selector, timeout) {
    timeout = timeout || 8000;
    return new Promise(function(resolve, reject) {
        var el = document.querySelector(selector);
        if (el) { resolve(el); return; }

        var observer = new MutationObserver(function() {
            var found = document.querySelector(selector);
            if (found) {
                observer.disconnect();
                resolve(found);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(function() {
            observer.disconnect();
            reject(new Error('Timeout waiting for: ' + selector));
        }, timeout);
    });
}

function findFirst(selectors) {
    for (var i = 0; i < selectors.length; i++) {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
    }
    return null;
}

// ── CAPTCHA detection ─────────────────────────────────────────────────────────────────────────────

function detectCaptcha() {
    var indicators = ['.h-captcha', '#captcha-box', '[data-sitekey]',
        'iframe[src*="hcaptcha"]', 'iframe[src*="recaptcha"]'];
    for (var i = 0; i < indicators.length; i++) {
        if (document.querySelector(indicators[i])) return true;
    }
    var body = (document.body && document.body.innerText) || '';
    return /are you human|bot detection|verify you are/i.test(body);
}

// ── Listing card discovery ────────────────────────────────────────────────────────────────────────

var CARD_SELECTORS = [
    '[data-test="tile"]',
    '[data-et-name="listing_tile"]',
    '.m__listing-card',
    '.card--small',
    '.grid__item[data-id]',
    '.tiles_container .col-x3'
];

function getAllCards() {
    for (var i = 0; i < CARD_SELECTORS.length; i++) {
        var found = Array.from(document.querySelectorAll(CARD_SELECTORS[i]));
        if (found.length > 0) return found;
    }
    return [];
}

function getUnprocessedCards() {
    return getAllCards().filter(function(card) {
        return !card.dataset.vlShareDone;
    });
}

// ── Share one card ────────────────────────────────────────────────────────────────────────────────

var SHARE_BTN_SELECTORS = [
    '[data-test="tile-share"]',
    '[data-et-name="share"]',
    '.social-action-bar__share',
    '.social-action-bar button[aria-label*="share" i]',
    'button[aria-label*="share" i]',
    'button[title*="share" i]',
    '.icon-share-gray'
];

var MODAL_CLOSE_SELECTORS = [
    '.modal__close',
    '.modal-header__close',
    'button[aria-label="Close"]',
    '[data-et-name="close_share_modal"]'
];

async function shareCard(card) {
    var shareBtn = null;

    // Look inside the card
    for (var i = 0; i < SHARE_BTN_SELECTORS.length; i++) {
        shareBtn = card.querySelector(SHARE_BTN_SELECTORS[i]);
        if (shareBtn) break;
    }

    // If not inside the card, try the nearest parent tile
    if (!shareBtn) {
        var parent = card.closest('[data-et-name="listing_tile"], .tiles_container .col-x3, .m__listing-card')
            || card.parentElement;
        if (parent) {
            for (var j = 0; j < SHARE_BTN_SELECTORS.length; j++) {
                shareBtn = parent.querySelector(SHARE_BTN_SELECTORS[j]);
                if (shareBtn) break;
            }
        }
    }

    if (!shareBtn) return false;

    shareBtn.click();

    // Wait for "To Followers" option in share modal
    var toFollowersBtn = null;
    var modalSelectors = [
        '[data-test="share-to-followers"]',
        '[data-et-name="share_modal_to_followers_btn"]',
        '[data-et-name="to_followers"]',
        '.share-wrapper__btn--followers',
        '.btn__followers'
    ].join(', ');

    try {
        toFollowersBtn = await waitForElement(modalSelectors, 4000);
    } catch (e) {
        // Text scan fallback
        var allBtns = Array.from(document.querySelectorAll('button'));
        toFollowersBtn = allBtns.find(function(b) {
            return /to my followers|to followers/i.test(b.textContent);
        }) || null;
    }

    if (!toFollowersBtn) {
        var closeOnFail = findFirst(MODAL_CLOSE_SELECTORS);
        if (closeOnFail) closeOnFail.click();
        return false;
    }

    toFollowersBtn.click();
    await delay(600);

    // Dismiss modal
    var closeBtn = findFirst(MODAL_CLOSE_SELECTORS);
    if (closeBtn) {
        closeBtn.click();
        await delay(300);
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    return true;
}

// ── Scroll to load more ───────────────────────────────────────────────────────────────────────────

async function scrollToLoadMore() {
    var before = getAllCards().length;
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    await delay(1500);
    return getAllCards().length > before;
}

// ── Status overlay ────────────────────────────────────────────────────────────────────────────────

var overlayEl = null;
var overlayMsgEl = null;

function showOverlay(message, status) {
    status = status || 'running';
    var color = status === 'error' ? '#ef4444' : status === 'success' ? '#22c55e' : '#6366f1';

    if (overlayEl) {
        if (overlayMsgEl) overlayMsgEl.textContent = message;
        overlayEl.style.borderLeftColor = color;
        return;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = 'vl-share-overlay';
    overlayEl.style.cssText = [
        'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
        'background:#1f2937', 'color:white', 'border-radius:12px',
        'padding:16px 20px', 'max-width:320px',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'font-size:14px', 'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
        'border-left:4px solid ' + color
    ].join(';');

    // Header row
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    var icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon16.png');
    icon.width = 16; icon.height = 16; icon.alt = '';

    var title = document.createElement('strong');
    title.textContent = 'VaultLister \u2014 Sharing Closet';

    header.appendChild(icon);
    header.appendChild(title);

    // Message paragraph
    overlayMsgEl = document.createElement('p');
    overlayMsgEl.style.cssText = 'margin:0 0 10px;line-height:1.4;color:#d1d5db;';
    overlayMsgEl.textContent = message;

    // Stop button
    var stopBtn = document.createElement('button');
    stopBtn.style.cssText = [
        'width:100%', 'padding:7px 12px', 'background:transparent', 'color:#9ca3af',
        'border:1px solid #374151', 'border-radius:8px', 'font-size:12px', 'cursor:pointer'
    ].join(';');
    stopBtn.textContent = 'Stop';
    stopBtn.addEventListener('click', function() {
        stopRequested = true;
        showOverlay('Stopping after current listing\u2026', 'running');
    });

    overlayEl.appendChild(header);
    overlayEl.appendChild(overlayMsgEl);
    overlayEl.appendChild(stopBtn);

    document.body.appendChild(overlayEl);
}

function dismissOverlay() {
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
        overlayMsgEl = null;
    }
}

// ── Main share loop ───────────────────────────────────────────────────────────────────────────────

var stopRequested = false;

async function runShareSession(job) {
    var syncId = job.syncId;
    var maxListings = job.maxListings || 50;
    var delayMs = job.delayMs || 3000;

    var sharedCount = 0;
    var skippedCount = 0;
    var noProgressRounds = 0;
    stopRequested = false;

    showOverlay('Starting\u2026 (0 / ' + maxListings + ' shared)');

    while (sharedCount < maxListings && !stopRequested) {
        if (detectCaptcha()) {
            showOverlay('CAPTCHA detected \u2014 please solve it to continue.', 'error');
            chrome.runtime.sendMessage({
                action: 'shareClosetJobComplete',
                syncId: syncId,
                success: false,
                sharedCount: sharedCount,
                skippedCount: skippedCount,
                error: 'CAPTCHA detected'
            });
            return;
        }

        var cards = getUnprocessedCards();

        if (!cards.length) {
            var loaded = await scrollToLoadMore();
            noProgressRounds++;
            if (!loaded && noProgressRounds >= 3) break;
            continue;
        }

        noProgressRounds = 0;
        var card = cards[0];

        var success = await shareCard(card);
        if (success) {
            // Only mark on success so retries aren't blocked for transient DOM races.
            card.dataset.vlShareDone = 'true';
            sharedCount++;
            showOverlay('Shared ' + sharedCount + ' / ' + maxListings + (skippedCount ? ' (' + skippedCount + ' skipped)' : '') + '\u2026');
        } else {
            // Mark with a distinct flag so getUnprocessedCards skips it for this session
            // but it remains distinguishable from successfully-shared cards.
            card.dataset.vlShareDone = 'skipped';
            skippedCount++;
        }

        await delay(delayMs + Math.floor(Math.random() * 800));
    }

    var finalMsg = stopRequested
        ? 'Stopped. Shared ' + sharedCount + ', skipped ' + skippedCount + '.'
        : 'Done! Shared ' + sharedCount + ', skipped ' + skippedCount + '.';

    showOverlay(finalMsg, 'success');

    chrome.runtime.sendMessage({
        action: 'shareClosetJobComplete',
        syncId: syncId,
        success: true,
        sharedCount: sharedCount,
        error: null
    });

    setTimeout(dismissOverlay, 4000);
}

// ── Entry point ───────────────────────────────────────────────────────────────────────────────────

function isClosetPage() {
    return /^\/closet\//.test(window.location.pathname);
}

function init() {
    if (!isClosetPage()) return;

    try {
        chrome.runtime.sendMessage({ action: 'getShareClosetJob' }, function(response) {
            if (chrome.runtime.lastError) return;
            if (response && response.job) {
                runShareSession(response.job);
            }
        });
    } catch (e) {
        // Extension context not available
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
