// poster.js — Cross-listing content script for VaultLister Extension
// Injected on platform create-listing pages. Receives job from service worker,
// fills the listing form, then lets the user review and submit manually.

function detectPlatform() {
    const h = window.location.hostname;
    if (h === 'poshmark.com' || h.endsWith('.poshmark.com')) return 'poshmark';
    if (h === 'depop.com' || h.endsWith('.depop.com')) return 'depop';
    if (h === 'facebook.com' || h.endsWith('.facebook.com')) return 'facebook';
    if (h === 'whatnot.com' || h.endsWith('.whatnot.com')) return 'whatnot';
    if (h === 'mercari.com' || h.endsWith('.mercari.com')) return 'mercari';
    if (h === 'grailed.com' || h.endsWith('.grailed.com')) return 'grailed';
    return null;
}

// Wait for a DOM element matching selector to appear
function waitForElement(selector, timeout = 12000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) { resolve(el); return; }

        const observer = new MutationObserver(() => {
            const found = document.querySelector(selector);
            if (found) {
                observer.disconnect();
                resolve(found);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for: ${selector}`));
        }, timeout);
    });
}

// Try multiple selectors — returns first match or null
async function findElement(selectors, timeout = 8000) {
    const combined = selectors.join(', ');
    try {
        return await waitForElement(combined, timeout);
    } catch {
        return null;
    }
}

// Set value on React-controlled input (bypasses synthetic event suppression)
function setReactInputValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(input, value);
    } else {
        input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setReactTextareaValue(textarea, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(textarea, value);
    } else {
        textarea.value = value;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

// Set value on a contenteditable div (Facebook uses these for description)
function setContentEditable(el, value) {
    el.focus();
    el.textContent = '';
    document.execCommand('insertText', false, value);
    if (!el.textContent) {
        el.textContent = value;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
}

// Upload images by fetching them and setting via DataTransfer
async function uploadImages(imageUrls, fileInputSelector) {
    if (!imageUrls || !imageUrls.length) return;
    const fileInput = document.querySelector(fileInputSelector);
    if (!fileInput) return;

    try {
        const files = await Promise.all(
            imageUrls.slice(0, 8).map(async (url, i) => {
                const resp = await fetch(url, { credentials: 'omit' });
                const blob = await resp.blob();
                const ext = blob.type === 'image/png' ? 'png' : 'jpg';
                return new File([blob], `photo_${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' });
            })
        );

        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));

        const nativeFilesSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files');
        if (nativeFilesSetter && nativeFilesSetter.set) {
            nativeFilesSetter.set.call(fileInput, dt.files);
        } else {
            Object.defineProperty(fileInput, 'files', { value: dt.files, writable: false });
        }
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
        console.warn('[VaultLister] Image upload failed:', err.message);
    }
}

// ── Platform fillers ──────────────────────────────────────────────────────────────────────────────

async function fillPoshmark(data) {
    // Title
    const titleEl = await findElement([
        'input[id="title"]',
        'input[name="title"]',
        'input[placeholder*="title" i]',
        'input[placeholder*="What are you selling" i]'
    ]);
    if (titleEl && data.title) setReactInputValue(titleEl, data.title);

    // Description
    const descEl = await findElement([
        'textarea[id="description"]',
        'textarea[name="description"]',
        'textarea[placeholder*="description" i]',
        'textarea[placeholder*="Describe" i]'
    ]);
    if (descEl && data.description) setReactTextareaValue(descEl, data.description);

    // Original price / List price
    const priceEl = await findElement([
        'input[id="listing-price"]',
        'input[id="price"]',
        'input[name="price"]',
        'input[placeholder*="Price" i]',
        'input[type="number"]'
    ]);
    if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));

    // Brand
    const brandEl = await findElement([
        'input[placeholder*="Brand" i]',
        'input[name="brand"]',
        'input[id="brand"]'
    ]);
    if (brandEl && data.brand) setReactInputValue(brandEl, data.brand);

    // Images — Poshmark uses a file input inside the photo upload area
    if (data.images && data.images.length) {
        await uploadImages(data.images, 'input[type="file"][accept*="image"]');
    }
}

async function fillDepop(data) {
    // Title (Depop calls it "description" in their form but it's the item name)
    const titleEl = await findElement([
        'input[data-testid="title-input"]',
        'input[name="itemDescription"]',
        'input[placeholder*="What are you selling" i]',
        'input[placeholder*="Title" i]'
    ]);
    if (titleEl && data.title) setReactInputValue(titleEl, data.title);

    // Description (longer text)
    const descEl = await findElement([
        'textarea[data-testid="description-input"]',
        'textarea[placeholder*="Describe" i]',
        'textarea[placeholder*="description" i]'
    ]);
    if (descEl && data.description) setReactTextareaValue(descEl, data.description);

    // Price
    const priceEl = await findElement([
        'input[data-testid="price-input"]',
        'input[name="price"]',
        'input[placeholder*="Price" i]',
        'input[type="number"]'
    ]);
    if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));

    // Brand
    const brandEl = await findElement([
        'input[data-testid="brand-input"]',
        'input[placeholder*="Brand" i]',
        'input[name="brand"]'
    ]);
    if (brandEl && data.brand) setReactInputValue(brandEl, data.brand);

    // Images
    if (data.images && data.images.length) {
        await uploadImages(data.images, 'input[type="file"][accept*="image"]');
    }
}

async function fillFacebook(data) {
    // Facebook Marketplace uses a mix of inputs and contenteditable divs

    // Title
    const titleEl = await findElement([
        'input[placeholder="What are you selling?"]',
        'input[aria-label="Title"]',
        'input[name="title"]'
    ]);
    if (titleEl && data.title) setReactInputValue(titleEl, data.title);

    // Price
    const priceEl = await findElement([
        'input[placeholder="Price"]',
        'input[aria-label="Price"]',
        'input[name="price"]'
    ]);
    if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));

    // Description — Facebook uses a contenteditable div
    const descEl = await findElement([
        'div[aria-label="Description"][role="textbox"]',
        'div[contenteditable="true"][data-lexical-editor]',
        'textarea[aria-label="Description"]'
    ]);
    if (descEl && data.description) {
        if (descEl.tagName === 'DIV') {
            setContentEditable(descEl, data.description);
        } else {
            setReactTextareaValue(descEl, data.description);
        }
    }

    // Images — click the photo upload button area
    if (data.images && data.images.length) {
        await uploadImages(data.images, 'input[type="file"][accept*="image"]');
    }
}

async function fillMercari(data) {
    // Title
    const titleEl = await findElement([
        'input[data-testid="Title"]',
        'input[name="name"]',
        'input[name="title"]',
        'input[placeholder*="title" i]',
        'input[placeholder*="Title" i]'
    ]);
    if (titleEl && data.title) setReactInputValue(titleEl, data.title);

    // Description
    const descEl = await findElement([
        'textarea[data-testid="Description"]',
        'textarea[name="description"]',
        'textarea[placeholder*="describe" i]',
        'textarea[placeholder*="description" i]'
    ]);
    if (descEl && data.description) setReactTextareaValue(descEl, data.description);

    // Price
    const priceEl = await findElement([
        'input[data-testid="Price"]',
        'input[name="price"]',
        'input[placeholder*="price" i]',
        'input[inputmode="decimal"]',
        'input[type="number"]'
    ]);
    if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));

    // Brand — Mercari uses a typeahead field
    const brandEl = await findElement([
        'input[data-testid="Brand"]',
        'input[name="brand"]',
        'input[placeholder*="brand" i]'
    ]);
    if (brandEl && data.brand) setReactInputValue(brandEl, data.brand);

    // Images
    if (data.images && data.images.length) {
        await uploadImages(data.images, 'input[type="file"][accept*="image"]');
    }
}

async function fillGrailed(data) {
    // Title
    const titleEl = await findElement([
        'input[name="title"]',
        'input[id="title"]',
        'input[placeholder*="title" i]',
        'input[placeholder*="What are you selling" i]'
    ]);
    if (titleEl && data.title) setReactInputValue(titleEl, data.title);

    // Designer/Brand — typeahead field
    const brandEl = await findElement([
        'input[name="designers"]',
        'input[name="designer"]',
        'input[placeholder*="designer" i]',
        'input[placeholder*="brand" i]'
    ]);
    if (brandEl && data.brand) setReactInputValue(brandEl, data.brand);

    // Description
    const descEl = await findElement([
        'textarea[name="description"]',
        'textarea[id="description"]',
        'textarea[placeholder*="describe" i]',
        'textarea[placeholder*="description" i]'
    ]);
    if (descEl && data.description) setReactTextareaValue(descEl, data.description);

    // Price
    const priceEl = await findElement([
        'input[name="price"]',
        'input[id="price"]',
        'input[placeholder*="price" i]',
        'input[type="number"]'
    ]);
    if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));

    // Images
    if (data.images && data.images.length) {
        await uploadImages(data.images, 'input[type="file"][accept*="image"]');
    }
}

async function fillWhatnot(data) {
    // Title
    const titleEl = await findElement([
        'input[placeholder*="title" i]',
        'input[name="title"]',
        'input[aria-label*="title" i]'
    ]);
    if (titleEl && data.title) setReactInputValue(titleEl, data.title);

    // Description
    const descEl = await findElement([
        'textarea[placeholder*="description" i]',
        'textarea[name="description"]',
        'textarea[aria-label*="description" i]'
    ]);
    if (descEl && data.description) setReactTextareaValue(descEl, data.description);

    // Starting price / buy now price
    const priceEl = await findElement([
        'input[placeholder*="starting price" i]',
        'input[placeholder*="price" i]',
        'input[name="startingBid"]',
        'input[name="price"]',
        'input[type="number"]'
    ]);
    if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));

    // Images
    if (data.images && data.images.length) {
        await uploadImages(data.images, 'input[type="file"][accept*="image"]');
    }
}

// ── Status overlay ──────────────────────────────────────────────────────────────────────────────

function showStatusOverlay(syncId, platform, status, message) {
    // Remove any existing overlay
    const existing = document.getElementById('vl-poster-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'vl-poster-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        background: #1f2937;
        color: white;
        border-radius: 12px;
        padding: 16px 20px;
        max-width: 340px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        border-left: 4px solid ${status === 'error' ? '#ef4444' : '#6366f1'};
    `;

    const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    // Build DOM explicitly so `message` (which may be an err.message from the marketplace
    // page's own error objects) is always set via textContent — never HTML-injected.
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:10px;';
    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icons/icon16.png');
    iconImg.width = 16; iconImg.height = 16; iconImg.alt = '';
    const titleStrong = document.createElement('strong');
    titleStrong.textContent = `VaultLister \u2192 ${cap(platform)}`;
    header.appendChild(iconImg);
    header.appendChild(titleStrong);

    const msgP = document.createElement('p');
    msgP.style.cssText = 'margin:0 0 12px;line-height:1.4;color:#d1d5db;';
    msgP.textContent = message;

    overlay.appendChild(header);
    overlay.appendChild(msgP);

    if (status !== 'error') {
        const markBtn = document.createElement('button');
        markBtn.id = 'vl-mark-listed';
        markBtn.style.cssText = 'width:100%;padding:8px 14px;background:#6366f1;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:6px;';
        markBtn.textContent = 'Mark as Listed';
        overlay.appendChild(markBtn);
    }

    const dismissBtn = document.createElement('button');
    dismissBtn.id = 'vl-dismiss-overlay';
    dismissBtn.style.cssText = 'width:100%;padding:8px 14px;background:transparent;color:#9ca3af;border:1px solid #374151;border-radius:8px;font-size:13px;cursor:pointer;';
    dismissBtn.textContent = 'Dismiss';
    overlay.appendChild(dismissBtn);

    document.body.appendChild(overlay);

    document.getElementById('vl-dismiss-overlay').addEventListener('click', () => overlay.remove());

    const markListedBtn = document.getElementById('vl-mark-listed');
    if (markListedBtn) {
        markListedBtn.addEventListener('click', () => {
            const listingUrl = window.location.href;
            chrome.runtime.sendMessage({
                action: 'crossListJobComplete',
                syncId,
                success: true,
                platform,
                listingUrl,
                error: null
            });
            overlay.remove();
        });
    }
}

// ── Orchestration ─────────────────────────────────────────────────────────────────────────────────

async function fillAndSubmit(job) {
    const { syncId, platform, listingData } = job;
    const data = listingData || {};

    showStatusOverlay(syncId, platform, 'filling', 'Filling form…');

    try {
        switch (platform) {
            case 'poshmark': await fillPoshmark(data); break;
            case 'depop':    await fillDepop(data);    break;
            case 'facebook': await fillFacebook(data); break;
            case 'whatnot':  await fillWhatnot(data);  break;
            case 'mercari':  await fillMercari(data);  break;
            case 'grailed':  await fillGrailed(data);  break;
            default: throw new Error(`Unsupported platform: ${platform}`);
        }

        showStatusOverlay(syncId, platform, 'filled',
            'Form filled! Review the details and click the platform\'s submit button. Then click "Mark as Listed" above.');

    } catch (err) {
        showStatusOverlay(syncId, platform, 'error', `Error: ${err.message}`);
        chrome.runtime.sendMessage({
            action: 'crossListJobComplete',
            syncId,
            success: false,
            platform,
            listingUrl: null,
            error: err.message
        });
    }
}

async function init() {
    const platform = detectPlatform();
    if (!platform) return;

    // Ask service worker if this tab has a pending cross-list job
    try {
        chrome.runtime.sendMessage({ action: 'getCrossListJob' }, (response) => {
            if (chrome.runtime.lastError) return; // Extension context invalidated
            if (response && response.job) {
                fillAndSubmit(response.job);
            }
        });
    } catch {
        // Extension context not available
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
