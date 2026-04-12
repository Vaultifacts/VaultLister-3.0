// offers.js — Poshmark Offer to Likers (OTL) content script for VaultLister Extension
// Runs on poshmark.com/listing/* pages. Triggered by an offer_to_likers job from the
// service worker. Opens the listing's OTL modal, enters discount + shipping values,
// submits, and reports result back.
//
// Selector notes: verify against live Poshmark if OTL breaks:
//   - OTL entry button:  [data-et-name="offer_to_likers"], button containing "Offer" + "Likers"
//   - Discount field:    input[name="price"], input[aria-label*="Offer"]
//   - Shipping field:    input[name="shippingAmount"], select[name="shippingDiscount"]
//   - Submit button:     button[type="submit"], [data-et-name="submit_offer"]
//   - Close modal:       .modal__close, button[aria-label="Close"]

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
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

function setReactInputValue(input, value) {
    var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findByText(tag, text) {
    var els = Array.from(document.querySelectorAll(tag));
    var re = new RegExp(text, 'i');
    return els.find(function(el) { return re.test(el.textContent); }) || null;
}

// ── CAPTCHA detection ─────────────────────────────────────────────────────────────────────────────

function detectCaptcha() {
    var indicators = ['.h-captcha', '#captcha-box', '[data-sitekey]',
        'iframe[src*="hcaptcha"]', 'iframe[src*="recaptcha"]'];
    for (var i = 0; i < indicators.length; i++) {
        if (document.querySelector(indicators[i])) return true;
    }
    return false;
}

// ── Status overlay ────────────────────────────────────────────────────────────────────────────────

var overlayEl = null;
var overlayMsgEl = null;

function showOverlay(message, status) {
    status = status || 'running';
    var color = status === 'error' ? '#ef4444' : status === 'success' ? '#22c55e' : '#f59e0b';

    if (overlayEl) {
        if (overlayMsgEl) overlayMsgEl.textContent = message;
        overlayEl.style.borderLeftColor = color;
        return;
    }

    overlayEl = document.createElement('div');
    overlayEl.id = 'vl-otl-overlay';
    overlayEl.style.cssText = [
        'position:fixed', 'top:16px', 'right:16px', 'z-index:2147483647',
        'background:#1f2937', 'color:white', 'border-radius:12px',
        'padding:16px 20px', 'max-width:320px',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'font-size:14px', 'box-shadow:0 8px 32px rgba(0,0,0,0.4)',
        'border-left:4px solid ' + color
    ].join(';');

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    var icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon16.png');
    icon.width = 16; icon.height = 16; icon.alt = '';

    var title = document.createElement('strong');
    title.textContent = 'VaultLister \u2014 Offer to Likers';

    header.appendChild(icon);
    header.appendChild(title);

    overlayMsgEl = document.createElement('p');
    overlayMsgEl.style.cssText = 'margin:0;line-height:1.4;color:#d1d5db;';
    overlayMsgEl.textContent = message;

    overlayEl.appendChild(header);
    overlayEl.appendChild(overlayMsgEl);

    document.body.appendChild(overlayEl);
}

function dismissOverlay() {
    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
        overlayMsgEl = null;
    }
}

// ── Main OTL flow ─────────────────────────────────────────────────────────────────────────────────

async function runOfferToLikers(job) {
    var syncId = job.syncId;
    var offerPrice = job.offer_price;
    var shippingDiscount = job.shipping_discount || 'standard'; // 'standard' | 'free' | 'reduced'

    try {
        if (detectCaptcha()) {
            showOverlay('CAPTCHA detected \u2014 cannot proceed.', 'error');
            reportComplete(syncId, false, 'CAPTCHA detected');
            return;
        }

        showOverlay('Looking for Offer to Likers button\u2026');

        // Find the OTL entry button (only appears on owned listings with likers)
        var otlBtn = document.querySelector('[data-et-name="offer_to_likers"]')
            || findByText('button', 'offer\\s+to\\s+likers')
            || findByText('button', 'send\\s+offer');

        if (!otlBtn) {
            showOverlay('No "Offer to Likers" button found. Listing may have no likers yet.', 'error');
            reportComplete(syncId, false, 'OTL button not present');
            return;
        }

        showOverlay('Opening offer modal\u2026');
        otlBtn.click();

        // Wait for the OTL modal (price input)
        var priceInput;
        try {
            priceInput = await waitForElement(
                'input[name="price"], input[aria-label*="offer" i], input[placeholder*="offer" i], input[data-et-name="offer_price"]',
                5000
            );
        } catch (e) {
            showOverlay('Offer modal did not open.', 'error');
            reportComplete(syncId, false, 'Modal timeout');
            return;
        }

        // Enter offer price
        if (offerPrice) {
            setReactInputValue(priceInput, String(offerPrice));
            showOverlay('Set offer price to $' + offerPrice + '\u2026');
        }

        // Shipping discount selector
        await delay(400);
        if (shippingDiscount && shippingDiscount !== 'none') {
            var shippingSelect = document.querySelector(
                'select[name="shippingAmount"], select[data-et-name="shipping_discount"], select[name="shippingDiscount"]'
            );
            if (shippingSelect) {
                var target = shippingDiscount === 'free' ? 'free'
                    : shippingDiscount === 'reduced' ? 'reduced'
                    : 'standard';
                var options = Array.from(shippingSelect.options);
                var match = options.find(function(o) {
                    return new RegExp(target, 'i').test(o.textContent) || new RegExp(target, 'i').test(o.value);
                });
                if (match) {
                    shippingSelect.value = match.value;
                    shippingSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        await delay(500);

        // Submit the offer
        var submitBtn = document.querySelector(
            '[data-et-name="submit_offer"], [data-et-name="submit_otl"], button[type="submit"]'
        ) || findByText('button', 'submit\\s+offer')
          || findByText('button', 'send\\s+offer');

        if (!submitBtn) {
            showOverlay('Submit button not found.', 'error');
            reportComplete(syncId, false, 'Submit button missing');
            return;
        }

        submitBtn.click();
        await delay(1200);

        showOverlay('Offer sent to likers!', 'success');
        reportComplete(syncId, true, null);
        setTimeout(dismissOverlay, 3500);
    } catch (err) {
        showOverlay('Error: ' + err.message, 'error');
        reportComplete(syncId, false, err.message);
    }
}

function reportComplete(syncId, success, error) {
    try {
        chrome.runtime.sendMessage({
            action: 'offerToLikersJobComplete',
            syncId: syncId,
            success: success,
            error: error
        });
    } catch (e) {
        // Extension context not available
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────────────────────────

function isListingPage() {
    return /^\/listing\//.test(window.location.pathname);
}

function init() {
    if (!isListingPage()) return;

    try {
        chrome.runtime.sendMessage({ action: 'getOfferToLikersJob' }, function(response) {
            if (chrome.runtime.lastError) return;
            if (response && response.job) {
                runOfferToLikers(response.job);
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
