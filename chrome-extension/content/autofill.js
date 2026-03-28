// Autofill Helper for Marketplace Platforms
// Assists with filling out listing forms on Poshmark, eBay, Mercari, Depop, Grailed, Etsy, Shopify

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Detect platform
const platform = detectPlatform();

function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname === 'poshmark.com' || hostname.endsWith('.poshmark.com')) return 'poshmark';
    if (hostname === 'ebay.com' || hostname.endsWith('.ebay.com')) return 'ebay';
    if (hostname === 'mercari.com' || hostname.endsWith('.mercari.com')) return 'mercari';
    if (hostname === 'depop.com' || hostname.endsWith('.depop.com')) return 'depop';
    if (hostname === 'grailed.com' || hostname.endsWith('.grailed.com')) return 'grailed';
    if (hostname === 'etsy.com' || hostname.endsWith('.etsy.com')) return 'etsy';
    if (hostname === 'myshopify.com' || hostname.endsWith('.myshopify.com') || document.querySelector('meta[name="shopify-checkout-api-token"]')) return 'shopify';
    return null;
}

// Platform-specific field mappings
const fieldMappings = {
    poshmark: {
        title: 'input[name="title"], #title',
        description: 'textarea[name="description"], #description',
        price: 'input[name="price"], #price',
        brand: 'input[name="brand"], #brand',
        size: 'select[name="size"], #size',
        condition: 'select[name="condition"], #condition',
        category: 'select[name="category"], #category'
    },
    ebay: {
        title: 'input[name="title"], #title',
        description: 'textarea[name="description"], #description, .textarea-wrapper textarea',
        price: 'input[name="price"], input[name="startPrice"]',
        condition: 'select[name="condition"]',
        category: 'input[name="category"]'
    },
    mercari: {
        title: 'input[data-testid="title"], input[name="name"]',
        description: 'textarea[data-testid="description"], textarea[name="description"]',
        price: 'input[data-testid="price"], input[name="price"]',
        brand: 'input[data-testid="brand"], input[name="brand"]',
        condition: 'select[data-testid="condition"], select[name="item_condition"]',
        category: 'input[data-testid="category"]'
    },
    depop: {
        title: 'input[name="itemDescription"], input[placeholder*="title"], input[placeholder*="Title"]',
        description: 'textarea[name="description"], textarea[placeholder*="description"]',
        price: 'input[name="price"], input[placeholder*="price"], input[placeholder*="Price"]',
        brand: 'input[name="brand"], input[placeholder*="brand"]',
        size: 'select[name="size"], button[data-testid="size-selector"]',
        condition: 'select[name="condition"]',
        category: 'select[name="category"]'
    },
    grailed: {
        title: 'input[name="listing[title]"], input[placeholder*="title"]',
        description: 'textarea[name="listing[description]"], textarea[placeholder*="description"]',
        price: 'input[name="listing[price]"], input[placeholder*="price"]',
        brand: 'input[name="listing[designer_names][]"], input[placeholder*="designer"]',
        size: 'select[name="listing[size]"], input[placeholder*="size"]',
        condition: 'select[name="listing[condition]"]',
        category: 'select[name="listing[category]"]'
    },
    etsy: {
        title: 'input#listing-edit-form-title, input[name="title"]',
        description: 'textarea#listing-edit-form-description, textarea[name="description"]',
        price: 'input#listing-edit-form-price, input[name="price"]',
        brand: 'input[name="brand"]',
        condition: 'select[name="item_condition"]',
        category: 'input[name="category"]'
    },
    shopify: {
        title: 'input#title, input[name="title"]',
        description: 'textarea#description, [contenteditable][aria-label*="description"]',
        price: 'input#price, input[name="price"]',
        brand: 'input[name="vendor"], input#vendor',
        condition: 'select[name="condition"]',
        category: 'input[name="type"], input#type'
    }
};

// Add VaultLister import button
function addImportButton() {
    if (!platform || document.getElementById('vaultlister-import-btn')) return;

    const button = document.createElement('button');
    button.id = 'vaultlister-import-btn';
    // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        Import from VaultLister
    `;
    button.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        padding: 10px 16px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.3s;
    `;

    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
    });

    button.addEventListener('click', showItemSelector);

    document.body.appendChild(button);
}

// Show item selector modal
function showItemSelector() {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'vaultlister-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #1f2937; margin: 0;">
                Import from VaultLister
            </h2>
            <button id="vaultlister-close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">
                ×
            </button>
        </div>
        <div id="vaultlister-items-list" style="min-height: 200px;">
            <p style="text-align: center; color: #6b7280;">Loading items...</p>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close button
    document.getElementById('vaultlister-close-modal').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    // Load items
    loadVaultListerItems();
}

// Load items from VaultLister
async function loadVaultListerItems() {
    try {
        // Request items from background script (which has api.js)
        chrome.runtime.sendMessage({ action: 'getInventoryItems' }, (response) => {
            if (response.success) {
                displayItems(response.data.items || []);
            } else {
                displayError('Failed to load items. Make sure you\'re logged in.');
            }
        });
    } catch (error) {
        displayError('Failed to connect to VaultLister');
    }
}

// Display items in modal
function displayItems(items) {
    const container = document.getElementById('vaultlister-items-list');

    if (items.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6b7280;">No items found</p>';  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        return;
    }

    container.innerHTML = items.map(item => {  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        const safeItem = escapeHtml(JSON.stringify(item));
        const imgSrc = escapeHtml(item.images && item.images[0] ? item.images[0] : '');
        const imgAlt = escapeHtml(item.title || item.name || '');
        const displayName = escapeHtml(item.title || item.name || 'Untitled');
        const brandText = escapeHtml(item.brand || 'No brand');
        const costText = escapeHtml(((item.list_price || item.cost || 0)).toFixed(2));
        return `<div class="vaultlister-item" data-item="${safeItem}" style="
            display: flex;
            gap: 12px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
        " onmouseover="this.style.borderColor='#6366f1'; this.style.background='#f9fafb'"
           onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white'"
           onclick="window.fillFormWithItem(this.dataset.item)">
            ${imgSrc ? `
                <img src="${imgSrc}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px;" alt="${imgAlt}">
            ` : `
                <div style="width: 60px; height: 60px; background: #e5e7eb; border-radius: 6px;"></div>
            `}
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${displayName}</div>
                <div style="font-size: 13px; color: #6b7280;">
                    ${brandText} &bull; $${costText}
                </div>
            </div>
        </div>`;
    }).join('');
}

// Display error
function displayError(message) {
    const container = document.getElementById('vaultlister-items-list');
    container.innerHTML = `<p style="text-align: center; color: #ef4444;">${escapeHtml(message)}</p>`;  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
}

// Fill form with item data
window.fillFormWithItem = function(itemDataString) {
    try {
        const item = JSON.parse(itemDataString);
        const fields = fieldMappings[platform];

        if (!fields) return;

        // Fill each field
        if (fields.title && item.name) {
            setFieldValue(fields.title, item.name);
        }

        if (fields.description && item.description) {
            setFieldValue(fields.description, item.description);
        }

        if (fields.price && item.cost) {
            setFieldValue(fields.price, item.cost.toString());
        }

        if (fields.brand && item.brand) {
            setFieldValue(fields.brand, item.brand);
        }

        if (fields.condition && item.condition) {
            setFieldValue(fields.condition, item.condition);
        }

        // Close modal
        document.getElementById('vaultlister-modal-overlay').remove();

        // Show success message
        showSuccessMessage();
    } catch (error) {
        console.error('Failed to fill form:', error);
    }
};

// Set field value (handles input, textarea, select)
function setFieldValue(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return;

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.tagName === 'SELECT') {
        // Find matching option
        const options = Array.from(element.options);
        const match = options.find(opt =>
            opt.value.toLowerCase() === value.toLowerCase() ||
            opt.text.toLowerCase() === value.toLowerCase()
        );
        if (match) {
            element.value = match.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
}

// Show success message
function showSuccessMessage() {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000000;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideIn 0.3s ease-out;
    `;
    message.textContent = 'Form filled successfully!';
    document.body.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 3000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return;
    if (request.action === 'fillForm' && request.data) {
        window.fillFormWithItem(JSON.stringify(request.data));
        sendResponse({ success: true });
    }
});

// Initialize
if (platform) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addImportButton);
    } else {
        addImportButton();
    }
}
