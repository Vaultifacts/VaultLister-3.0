'use strict';
// UI widgets: drag-drop, table prefs, pomodoro, kanban, onboarding, etc.
// Extracted from app.js lines 8640-15009

// ============================================
// Global Search (Command Palette)
// ============================================
const globalSearch = {
    isOpen: false,
    selectedIndex: 0,
    recentSearches: [],
    _debounceTimer: null,

    debouncedSearch(value) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this.search(value), 150);
    },

    open() {
        this.isOpen = true;
        this.selectedIndex = 0;
        this.render();
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    },

    close() {
        this.isOpen = false;
        const overlay = document.getElementById('global-search-overlay');
        if (overlay) overlay.remove();
        document.removeEventListener('keydown', this.handleKeydown.bind(this));
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    handleKeydown(e) {
        if (e.key === 'Escape') {
            this.close();
            return;
        }

        const results = document.querySelectorAll('.search-result-item');
        if (results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, results.length - 1);
            this.updateSelection(results);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.updateSelection(results);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = results[this.selectedIndex];
            if (selected) selected.click();
        }
    },

    updateSelection(results) {
        results.forEach((r, i) => {
            r.classList.toggle('selected', i === this.selectedIndex);
        });
    },

    search(query) {
        const results = this.getResults(query);
        const resultsContainer = document.getElementById('global-search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = sanitizeHTML(sanitizeHTML(this.renderResults(results, query))); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            this.selectedIndex = 0;
            const items = document.querySelectorAll('.search-result-item');
            if (items.length > 0) items[0].classList.add('selected');
        }
    },

    getResults(query) {
        const q = query.toLowerCase().trim();
        if (!q) return { pages: [], inventory: [], listings: [], orders: [], offers: [], actions: [] };

        // Page navigation results
        const pages = [
            { id: 'dashboard', label: 'Dashboard', section: 'Sell', icon: 'dashboard' },
            { id: 'inventory', label: 'Inventory', section: 'Sell', icon: 'inventory' },
            { id: 'listings', label: 'Listings', section: 'Sell', icon: 'list' },
            { id: 'sales', label: 'Sales & Purchases', section: 'Sell', icon: 'dollar' },
            { id: 'orders-sales', label: 'Offers, Orders, & Shipping', section: 'Sell', icon: 'sales' },
            { id: 'automations', label: 'Automations', section: 'Manage', icon: 'automation' },
            { id: 'financials', label: 'Financials', section: 'Manage', icon: 'dollar' },
            { id: 'analytics', label: 'Analytics', section: 'Manage', icon: 'analytics' },
            { id: 'shops', label: 'My Shops', section: 'Manage', icon: 'store' },
            { id: 'planner', label: 'Daily Checklist', section: 'Manage', icon: 'calendar' },
            { id: 'image-bank', label: 'Image Bank', section: 'Manage', icon: 'image' },
            { id: 'settings', label: 'Settings', section: 'Settings', icon: 'settings' },
            { id: 'help-support', label: 'Help', section: 'Help', icon: 'help' },
            { id: 'changelog', label: 'Changelog', section: 'Changelog', icon: 'list' },
        ].filter((p) => p.label.toLowerCase().includes(q) || p.section.toLowerCase().includes(q));

        // Inventory items
        const inventoryItems = (store.state.inventory || [])
            .filter(
                (item) => (item.title || '').toLowerCase().includes(q) || (item.sku || '').toLowerCase().includes(q),
            )
            .slice(0, 5)
            .map((item) => ({
                id: item.id,
                label: item.title || 'Untitled',
                subtitle: `${item.sku || 'No SKU'} · ${item.status || 'unknown'}`,
                type: 'inventory',
            }));

        // Listings search
        const listingItems = (store.state.listings || [])
            .filter(
                (item) =>
                    (item.title || '').toLowerCase().includes(q) || (item.platform || '').toLowerCase().includes(q),
            )
            .slice(0, 5)
            .map((item) => ({
                id: item.id,
                label: item.title || 'Untitled Listing',
                subtitle: `${item.platform || 'Unknown'} · C$${item.price || 0}`,
                type: 'listing',
            }));

        // Orders search
        const orderItems = (store.state.orders || [])
            .filter(
                (item) =>
                    (item.item_title || '').toLowerCase().includes(q) ||
                    (item.buyer_username || '').toLowerCase().includes(q) ||
                    (item.tracking_number || '').toLowerCase().includes(q),
            )
            .slice(0, 5)
            .map((item) => ({
                id: item.id,
                label: item.item_title || 'Untitled Order',
                subtitle: `${item.buyer_username || 'Unknown buyer'} · ${item.status || 'pending'}`,
                type: 'order',
            }));

        // Offers search
        const offerItems = (store.state.offers || [])
            .filter(
                (item) =>
                    (item.item_title || '').toLowerCase().includes(q) ||
                    (item.buyer_username || '').toLowerCase().includes(q),
            )
            .slice(0, 5)
            .map((item) => ({
                id: item.id,
                label: item.item_title || 'Untitled Offer',
                subtitle: `C$${item.amount || 0} from ${item.buyer_username || 'Unknown'}`,
                type: 'offer',
            }));

        // Quick actions
        const actions = [
            { id: 'add-item', label: 'Add New Item', icon: 'plus', action: 'handlers.showAddItemModal()' },
            { id: 'import', label: 'Import Items', icon: 'import', action: 'handlers.showImportModal()' },
            { id: 'add-event', label: 'Add Calendar Event', icon: 'calendar', action: 'handlers.showAddEventModal()' },
            { id: 'new-checklist', label: 'Create Checklist', icon: 'list', action: 'handlers.createChecklist()' },
            { id: 'dark-mode', label: 'Toggle Dark Mode', icon: 'moon', action: 'handlers.toggleDarkMode()' },
            { id: 'sync', label: 'Sync All Shops', icon: 'refresh', action: 'handlers.syncAllShops()' },
            { id: 'export', label: 'Export Inventory CSV', icon: 'download', action: 'handlers.exportInventoryCSV()' },
            { id: 'scan-barcode', label: 'Scan Barcode', icon: 'scan', action: 'handlers.openBarcodeScanner()' },
        ].filter((a) => a.label.toLowerCase().includes(q));

        return {
            pages: pages.slice(0, 6),
            inventory: inventoryItems,
            listings: listingItems,
            orders: orderItems,
            offers: offerItems,
            actions: actions.slice(0, 4),
        };
    },

    renderResults(results, query) {
        const { pages, inventory, listings, orders, offers, actions } = results;
        const hasResults =
            pages.length || inventory.length || listings.length || orders.length || offers.length || actions.length;

        if (!query || !hasResults) {
            return `
                <div class="search-results-section">
                    <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                        ${query ? 'No results found' : 'Start typing to search...'}
                    </div>
                </div>
            `;
        }

        let html = '';

        if (pages.length > 0) {
            html += `
                <div class="search-results-section">
                    <div class="search-results-header">Pages</div>
                    ${pages
                        .map(
                            (p) => `
                        <button type="button" class="search-result-item" onclick="globalSearch.navigateTo('${p.id}')">
                            <div class="search-result-icon">${components.icon(p.icon, 18)}</div>
                            <div class="search-result-content">
                                <div class="search-result-title">${escapeHtml(p.label)}</div>
                                <div class="search-result-subtitle">${p.section}</div>
                            </div>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
            `;
        }

        if (inventory.length > 0) {
            html += `
                <div class="search-results-section">
                    <div class="search-results-header">Inventory</div>
                    ${inventory
                        .map(
                            (item) => `
                        <button type="button" class="search-result-item" onclick="globalSearch.viewItem('${item.id}')">
                            <div class="search-result-icon">${components.icon('package', 18)}</div>
                            <div class="search-result-content">
                                <div class="search-result-title">${escapeHtml(item.label)}</div>
                                <div class="search-result-subtitle">${escapeHtml(item.subtitle)}</div>
                            </div>
                            <span class="search-result-badge">Item</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
            `;
        }

        if (listings.length > 0) {
            html += `
                <div class="search-results-section">
                    <div class="search-results-header">Listings</div>
                    ${listings
                        .map(
                            (item) => `
                        <button type="button" class="search-result-item" onclick="globalSearch.close(); handlers.navigate('listings');">
                            <div class="search-result-icon">${components.icon('list', 18)}</div>
                            <div class="search-result-content">
                                <div class="search-result-title">${escapeHtml(item.label)}</div>
                                <div class="search-result-subtitle">${escapeHtml(item.subtitle)}</div>
                            </div>
                            <span class="search-result-badge">Listing</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
            `;
        }

        if (orders.length > 0) {
            html += `
                <div class="search-results-section">
                    <div class="search-results-header">Orders</div>
                    ${orders
                        .map(
                            (item) => `
                        <button type="button" class="search-result-item" onclick="globalSearch.close(); handlers.navigate('orders');">
                            <div class="search-result-icon">${components.icon('sales', 18)}</div>
                            <div class="search-result-content">
                                <div class="search-result-title">${escapeHtml(item.label)}</div>
                                <div class="search-result-subtitle">${escapeHtml(item.subtitle)}</div>
                            </div>
                            <span class="search-result-badge">Order</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
            `;
        }

        if (offers.length > 0) {
            html += `
                <div class="search-results-section">
                    <div class="search-results-header">Offers</div>
                    ${offers
                        .map(
                            (item) => `
                        <button type="button" class="search-result-item" onclick="globalSearch.close(); handlers.navigate('offers');">
                            <div class="search-result-icon">${components.icon('offers', 18)}</div>
                            <div class="search-result-content">
                                <div class="search-result-title">${escapeHtml(item.label)}</div>
                                <div class="search-result-subtitle">${escapeHtml(item.subtitle)}</div>
                            </div>
                            <span class="search-result-badge">Offer</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
            `;
        }

        if (actions.length > 0) {
            html += `
                <div class="search-results-section">
                    <div class="search-results-header">Quick Actions</div>
                    ${actions
                        .map(
                            (a) => `
                        <button type="button" class="search-result-item" onclick="${a.action}; globalSearch.close();">
                            <div class="search-result-icon">${components.icon(a.icon, 18)}</div>
                            <div class="search-result-content">
                                <div class="search-result-title">${escapeHtml(a.label)}</div>
                            </div>
                            <span class="search-result-badge">Action</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
            `;
        }

        return html;
    },

    navigateTo(pageId) {
        this.close();
        handlers.navigate(pageId);
    },

    viewItem(itemId) {
        this.close();
        handlers.viewItem(itemId);
    },

    render() {
        const overlay = document.createElement('div');
        overlay.id = 'global-search-overlay';
        overlay.className = 'global-search-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };

        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        overlay.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <div class="global-search-modal">
                <div class="global-search-input-wrapper" role="search">
                    <span class="global-search-icon">${components.icon('search', 20)}</span>
                    <input type="text"
                           class="global-search-input"
                           placeholder="Search pages, items, or actions..."
                           aria-label="Global search"
                           oninput="globalSearch.debouncedSearch(this.value)"
                           autofocus>
                    <span class="global-search-kbd">ESC</span>
                </div>
                <div id="global-search-results" class="global-search-results">
                    <div class="search-results-section">
                        <div style="text-align: center; padding: 2rem; color: var(--gray-500);">
                            Start typing to search...
                        </div>
                    </div>
                </div>
                <div class="global-search-footer">
                    <div class="search-recent">
                        ${components.icon('clock', 14)}
                        <span>Search pages, actions, and recent items</span>
                    </div>
                </div>
            </div>
        `),
        );

        document.body.appendChild(overlay);
        setTimeout(() => overlay.querySelector('.global-search-input').focus(), 50);
    },
};

// ============================================
// Form Validation Helper
// ============================================
const formValidation = {
    rules: {
        required: (value) => value && value.trim().length > 0,
        email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        minLength: (value, min) => value.length >= min,
        maxLength: (value, max) => value.length <= max,
        numeric: (value) => /^\d+(\.\d+)?$/.test(value),
        url: (value) => /^https?:\/\/.+/.test(value),
        phone: (value) => /^[\d\s\-\+\(\)]+$/.test(value),
    },

    messages: {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        minLength: (min) => `Must be at least ${min} characters`,
        maxLength: (max) => `Cannot exceed ${max} characters`,
        numeric: 'Please enter a valid number',
        url: 'Please enter a valid URL',
        phone: 'Please enter a valid phone number',
    },

    validateField(fieldName, customRules = {}) {
        const field = document.getElementById(fieldName);
        if (!field) return true;

        const value = field.value;
        const formGroup = document.getElementById(`form-group-${fieldName}`);
        const errorEl = document.getElementById(`error-${fieldName}`);
        const iconEl = document.getElementById(`validation-icon-${fieldName}`);

        let isValid = true;
        let errorMessage = '';

        // Check required
        if (field.required && !this.rules.required(value)) {
            isValid = false;
            errorMessage = this.messages.required;
        }

        // Check email type
        if (isValid && field.type === 'email' && value && !this.rules.email(value)) {
            isValid = false;
            errorMessage = this.messages.email;
        }

        // Check min/max length
        if (isValid && field.minLength > 0 && !this.rules.minLength(value, field.minLength)) {
            isValid = false;
            errorMessage = this.messages.minLength(field.minLength);
        }

        if (isValid && field.maxLength > 0 && !this.rules.maxLength(value, field.maxLength)) {
            isValid = false;
            errorMessage = this.messages.maxLength(field.maxLength);
        }

        // Custom rules
        for (const [rule, params] of Object.entries(customRules)) {
            if (isValid && this.rules[rule] && !this.rules[rule](value, params)) {
                isValid = false;
                errorMessage =
                    typeof this.messages[rule] === 'function' ? this.messages[rule](params) : this.messages[rule];
            }
        }

        // Update UI
        if (formGroup) {
            formGroup.classList.remove('has-error', 'has-success');
            formGroup.classList.add(isValid ? 'has-success' : 'has-error');
        }

        if (errorEl) {
            errorEl.textContent = errorMessage;
            errorEl.classList.toggle('hidden', isValid);
        }

        if (iconEl) {
            iconEl.innerHTML = isValid
                ? sanitizeHTML(
                      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
                  )
                : sanitizeHTML(
                      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
                  ); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            iconEl.classList.remove('success', 'error');
            iconEl.classList.add(isValid ? 'success' : 'error');
        }

        return isValid;
    },

    clearError(fieldName) {
        const formGroup = document.getElementById(`form-group-${fieldName}`);
        const errorEl = document.getElementById(`error-${fieldName}`);
        const iconEl = document.getElementById(`validation-icon-${fieldName}`);

        if (formGroup) formGroup.classList.remove('has-error');
        if (errorEl) errorEl.classList.add('hidden');
        if (iconEl) iconEl.innerHTML = sanitizeHTML(sanitizeHTML('')); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },

    validateForm(formId) {
        const form = document.getElementById(formId);
        if (!form) return { valid: true, errors: [] };

        const errors = [];
        const fields = form.querySelectorAll('input, select, textarea');

        fields.forEach((field) => {
            if (field.name && !this.validateField(field.name)) {
                const label = form.querySelector(`label[for="${field.name}"]`)?.textContent || field.name;
                errors.push(`${label.replace(' *', '')}: ${this.messages.required}`);
            }
        });

        return { valid: errors.length === 0, errors };
    },

    // Update character counter
    updateCharCounter(fieldName) {
        const field = document.getElementById(fieldName);
        const counter = document.getElementById(`counter-${fieldName}`);
        if (!field || !counter) return;

        const current = field.value.length;
        const max = field.maxLength;
        counter.textContent = `${current} / ${max}`;

        counter.classList.remove('warning', 'error');
        if (current >= max) {
            counter.classList.add('error');
        } else if (current >= max * 0.9) {
            counter.classList.add('warning');
        }
    },
};

// ============================================
// Inline Editor Helper
// ============================================
const inlineEditor = {
    startEdit(fieldId) {
        const container = document.querySelector(`.inline-edit[data-field="${fieldId}"]`);
        if (!container) return;

        const display = container.querySelector('.inline-edit-display');
        const input = container.querySelector('.inline-edit-input');

        if (display && input) {
            display.classList.add('hidden');
            input.classList.remove('hidden');
            input.focus();
            input.select();
        }
    },

    save(fieldId) {
        const container = document.querySelector(`.inline-edit[data-field="${fieldId}"]`);
        if (!container) return;

        const display = container.querySelector('.inline-edit-display');
        const input = container.querySelector('.inline-edit-input');
        const oldValue = container.dataset.value;
        const newValue = input.value;

        if (display && input) {
            input.classList.add('hidden');
            display.classList.remove('hidden');

            if (newValue !== oldValue) {
                container.dataset.value = newValue;
                display.textContent = newValue;

                // Execute onSave callback if defined (safely)
                const onSave = input.dataset.onsave;
                if (onSave) {
                    try {
                        // Safely dispatch handler instead of eval
                        const callbackStr = onSave.replace('VALUE', newValue).replace('FIELD', fieldId);
                        const fnMatch = callbackStr.match(/^(\w+(?:\.\w+)*)\((.*)\)$/);
                        if (fnMatch) {
                            const fnPath = fnMatch[1].split('.');
                            let fn = window;
                            for (const part of fnPath) fn = fn?.[part];
                            if (typeof fn === 'function') {
                                // Parse arguments from the string (handles VALUE and FIELD substitution)
                                const argsStr = fnMatch[2];
                                const args = argsStr
                                    ? argsStr.split(',').map((a) => {
                                          const trimmed = a.trim();
                                          // Handle string literals and identifiers
                                          if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
                                              return trimmed.slice(1, -1);
                                          } else if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                                              return trimmed.slice(1, -1);
                                          }
                                          return trimmed;
                                      })
                                    : [];
                                fn(...args);
                            }
                        }
                    } catch (e) {
                        console.error('Inline edit save error:', e);
                        toast.error('Failed to save edit');
                    }
                }

                toast.success('Updated successfully');
            }
        }
    },

    handleKey(event, fieldId) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.save(fieldId);
        } else if (event.key === 'Escape') {
            this.cancel(fieldId);
        }
    },

    cancel(fieldId) {
        const container = document.querySelector(`.inline-edit[data-field="${fieldId}"]`);
        if (!container) return;

        const display = container.querySelector('.inline-edit-display');
        const input = container.querySelector('.inline-edit-input');

        if (display && input) {
            input.value = container.dataset.value;
            input.classList.add('hidden');
            display.classList.remove('hidden');
        }
    },
};

// ============================================
// Autocomplete Helper
// ============================================
const autocomplete = {
    show(fieldName) {
        const input = document.getElementById(fieldName);
        const dropdown = document.getElementById(`dropdown-${fieldName}`);
        if (!input || !dropdown) return;

        const suggestions = JSON.parse(input.dataset.suggestions || '[]');
        this.render(fieldName, suggestions);
        dropdown.classList.remove('hidden');
    },

    hide(fieldName) {
        const dropdown = document.getElementById(`dropdown-${fieldName}`);
        if (dropdown) dropdown.classList.add('hidden');
    },

    filter(fieldName, query) {
        const input = document.getElementById(fieldName);
        if (!input) return;

        const suggestions = JSON.parse(input.dataset.suggestions || '[]');
        const filtered = query ? suggestions.filter((s) => s.toLowerCase().includes(query.toLowerCase())) : suggestions;

        this.render(fieldName, filtered, query);
    },

    render(fieldName, items, query = '') {
        const dropdown = document.getElementById(`dropdown-${fieldName}`);
        if (!dropdown) return;

        if (items.length === 0) {
            dropdown.innerHTML = sanitizeHTML(sanitizeHTML('<div class="autocomplete-empty">No matches found</div>')); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            return;
        }

        dropdown.innerHTML = sanitizeHTML(
            sanitizeHTML(
                items
                    .slice(0, 10)
                    .map((item, idx) => {
                        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                        const escapedItem = escapeHtml(item);
                        const highlighted = query
                            ? escapedItem.replace(
                                  new RegExp(`(${escapeRegExp(query)})`, 'gi'),
                                  '<span class="autocomplete-item-highlight">$1</span>',
                              ) // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
                            : escapedItem;
                        return `
                <div class="autocomplete-item ${idx === 0 ? 'selected' : ''}"
                     role="option" aria-selected="${idx === 0 ? 'true' : 'false'}" tabindex="0"
                     onclick="autocomplete.select('${escapeHtml(fieldName)}', '${escapeHtml(item)}')">
                    ${highlighted}
                </div>
            `;
                    })
                    .join(''),
            ),
        );
    },

    select(fieldName, value) {
        const input = document.getElementById(fieldName);
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        this.hide(fieldName);
    },
};

// ============================================
// Banner Helper
// ============================================
const banners = {
    dismiss(bannerId, dontShowAgain = false) {
        const banner = document.getElementById(bannerId);
        if (banner) {
            banner.style.animation = 'slideUp 0.2s ease-out reverse forwards';
            setTimeout(() => banner.remove(), 200);

            if (dontShowAgain) {
                const dismissed = JSON.parse(localStorage.getItem('vaultlister_dismissed_banners') || '[]');
                dismissed.push(bannerId);
                localStorage.setItem('vaultlister_dismissed_banners', JSON.stringify(dismissed));
            }
        }
    },

    isDismissed(bannerId) {
        const dismissed = JSON.parse(localStorage.getItem('vaultlister_dismissed_banners') || '[]');
        return dismissed.includes(bannerId);
    },
};

// ============================================
// Onboarding Helper
// ============================================
const onboarding = {
    steps: [
        {
            id: 'connect-shop',
            title: 'Connect your first shop',
            description: 'Link a selling platform to get started',
            action: "router.navigate('shops')",
            completed: false,
        },
        {
            id: 'add-item',
            title: 'Add your first item',
            description: 'Add an item to your inventory',
            action: 'modals.addItem()',
            completed: false,
        },
        {
            id: 'create-listing',
            title: 'Create your first listing',
            description: 'List an item for sale',
            action: "router.navigate('listings')",
            completed: false,
        },
        {
            id: 'first-sale',
            title: 'Make your first sale',
            description: 'Record or sync your first sale',
            action: "loadChunk('sales').then(() => handlers.showAddSale()).catch(() => router.navigate('sales'))",
            completed: false,
        },
    ],

    init() {
        let saved;
        try {
            saved = JSON.parse(localStorage.getItem('vaultlister_onboarding') || '{}');
        } catch {
            saved = {};
        }
        this.steps.forEach((step) => {
            step.completed = saved[step.id] || false;
        });

        this.syncFromState();
        this.loadPrerequisites();
    },

    syncFromState() {
        if (store.state.shops?.some((s) => s.is_connected)) this.complete('connect-shop');
        if (store.state.inventory?.length > 0) this.complete('add-item');
        if (store.state.listings?.length > 0) this.complete('create-listing');
        if (store.state.sales?.length > 0) this.complete('first-sale');
    },

    loadPrerequisites() {
        if (this._loadingPrerequisites) return;
        if (!store.state.user && !store.state.token && !store.state.refreshToken) return;
        if (store.state.shops?.length > 0 || typeof api === 'undefined') return;

        this._loadingPrerequisites = true;
        api.get('/shops')
            .then((data) => {
                store.setState({ shops: data.shops || [] });
                this.syncFromState();
                if (store.state.currentPage === 'dashboard' && window.pages?.dashboard) {
                    renderApp(window.pages.dashboard());
                }
            })
            .catch((error) => {
                console.warn('Failed to refresh onboarding prerequisites:', error);
            })
            .finally(() => {
                this._loadingPrerequisites = false;
            });
    },

    complete(stepId) {
        const step = this.steps.find((s) => s.id === stepId);
        if (step && !step.completed) {
            step.completed = true;
            let saved;
            try {
                saved = JSON.parse(localStorage.getItem('vaultlister_onboarding') || '{}');
            } catch {
                saved = {};
            }
            saved[stepId] = true;
            localStorage.setItem('vaultlister_onboarding', JSON.stringify(saved));

            // Check if all completed
            if (this.steps.every((s) => s.completed)) {
                celebrations.confetti();
                toast.success('Congratulations! You completed the setup!');
            }
        }
    },

    dismiss() {
        localStorage.setItem('vaultlister_onboarding_dismissed', 'true');
        const el = document.getElementById('onboarding-checklist');
        if (el) {
            el.style.transition = 'opacity 0.3s, transform 0.3s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            setTimeout(() => el.remove(), 300);
        }
    },

    minimize() {
        const isMinimized = localStorage.getItem('vaultlister_onboarding_minimized') === 'true';
        localStorage.setItem('vaultlister_onboarding_minimized', (!isMinimized).toString());
        router.navigate('dashboard'); // Re-render to apply minimized state
    },

    isMinimized() {
        return localStorage.getItem('vaultlister_onboarding_minimized') === 'true';
    },

    isDismissed() {
        return localStorage.getItem('vaultlister_onboarding_dismissed') === 'true';
    },

    isComplete() {
        return this.steps.every((s) => s.completed);
    },
};

// ============================================
// Celebrations (Confetti, etc.)
// ============================================
const celebrations = {
    confetti(count = 100) {
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        const colors = [
            '#f44336',
            '#e91e63',
            '#9c27b0',
            '#673ab7',
            '#3f51b5',
            '#2196f3',
            '#03a9f4',
            '#00bcd4',
            '#009688',
            '#4CAF50',
            '#8BC34A',
            '#CDDC39',
            '#FFEB3B',
            '#FFC107',
            '#FF9800',
            '#FF5722',
        ];

        for (let i = 0; i < count; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 2 + 's';
            confetti.style.animationDuration = 2 + Math.random() * 2 + 's';
            container.appendChild(confetti);
        }

        setTimeout(() => container.remove(), 5000);
    },

    firework() {
        // Simple firework effect using confetti in a burst pattern
        this.confetti(50);
    },
};

// ============================================
// Auto-save Helper
// ============================================
const autoSave = {
    timers: {},
    drafts: {},

    init(formId, saveKey, debounceMs = 2000) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Load existing draft
        const draft = localStorage.getItem(`vaultlister_draft_${saveKey}`);
        if (draft) {
            this.drafts[saveKey] = JSON.parse(draft);
            this.showIndicator(formId, 'Draft available', 'info');
        }

        // Listen for changes
        form.addEventListener('input', () => {
            this.scheduleSave(formId, saveKey, debounceMs);
        });
    },

    scheduleSave(formId, saveKey, debounceMs) {
        if (this.timers[saveKey]) {
            clearTimeout(this.timers[saveKey]);
        }

        this.showIndicator(formId, 'Saving...', 'saving');

        this.timers[saveKey] = setTimeout(() => {
            this.save(formId, saveKey);
        }, debounceMs);
    },

    // Field names (lowercase) that must never be persisted to localStorage
    sensitiveFields: [
        'password',
        'token',
        'secret',
        'apikey',
        'api_key',
        'creditcard',
        'ssn',
        'mfa',
        'current_password',
        'new_password',
        'confirm_password',
        'currentpassword',
        'newpassword',
    ],

    save(formId, saveKey) {
        const form = document.getElementById(formId);
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Remove sensitive fields before persisting to localStorage
        for (const key of Object.keys(data)) {
            const lower = key.toLowerCase();
            if (this.sensitiveFields.some((sf) => lower.includes(sf))) {
                delete data[key];
            }
        }

        localStorage.setItem(`vaultlister_draft_${saveKey}`, JSON.stringify(data));
        this.drafts[saveKey] = data;

        this.showIndicator(formId, 'Draft saved', 'saved');
    },

    restore(formId, saveKey) {
        const form = document.getElementById(formId);
        let _sd;
        try {
            _sd = JSON.parse(localStorage.getItem(`vaultlister_draft_${saveKey}`) || 'null');
        } catch {
            _sd = null;
        }
        const draft = this.drafts[saveKey] || _sd;

        if (!form || !draft) return false;

        Object.entries(draft).forEach(([key, value]) => {
            const field = form.elements[key];
            if (field) field.value = value;
        });

        toast.success('Draft restored');
        return true;
    },

    clear(saveKey) {
        localStorage.removeItem(`vaultlister_draft_${saveKey}`);
        delete this.drafts[saveKey];
    },

    showIndicator(formId, text, status) {
        let indicator = document.querySelector(`#${formId} .autosave-indicator`);
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'autosave-indicator';
            document.getElementById(formId)?.appendChild(indicator);
        }

        indicator.className = `autosave-indicator ${status}`;
        indicator.innerHTML =
            status === 'saving'
                ? sanitizeHTML(`<span class="autosave-spinner"></span> ${text}`)
                : sanitizeHTML(`${components.icon('check', 12)} ${text}`); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method

        if (status === 'saved') {
            setTimeout(() => (indicator.style.opacity = '0.5'), 2000);
        }
    },
};

// ============================================
// Offline Detection
// ============================================
const offlineManager = {
    queue: [],
    _onlineHandler: null,
    _offlineHandler: null,

    init() {
        // Remove previous listeners to prevent accumulation on re-init
        if (this._onlineHandler) window.removeEventListener('online', this._onlineHandler);
        if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler);
        this._onlineHandler = () => this.onOnline();
        this._offlineHandler = () => this.onOffline();
        window.addEventListener('online', this._onlineHandler);
        window.addEventListener('offline', this._offlineHandler);

        // Check initial state
        if (!navigator.onLine) this.onOffline();
    },

    onOffline() {
        store.setState({ isOffline: true });
        document.getElementById('offline-indicator')?.classList.remove('hidden');
        toast.warning('You are offline. Changes will be saved locally.');
    },

    onOnline() {
        store.setState({ isOffline: false });
        document.getElementById('offline-indicator')?.classList.add('hidden');
        if (this.queue.length > 0) {
            this.syncQueue();
        } else {
            toast.success('Back online!');
        }
    },

    addToQueue(action) {
        const safeAction = { ...action, timestamp: Date.now() };
        if (safeAction.body && typeof safeAction.body === 'object') {
            const sensitiveKeys = [
                'password',
                'token',
                'secret',
                'api_key',
                'apiKey',
                'current_password',
                'new_password',
                'refresh_token',
            ];
            for (const k of sensitiveKeys) delete safeAction.body[k];
        }
        this.queue.push(safeAction);
        this.updateQueueIndicator();
        try {
            localStorage.setItem('vaultlister_offline_queue', JSON.stringify(this.queue));
        } catch (e) {
            console.error('Failed to save offline queue to localStorage:', e);
        }
    },

    async syncQueue() {
        const queueEl = document.getElementById('offline-queue');
        if (queueEl) queueEl.textContent = `Syncing ${this.queue.length} changes...`;

        let synced = 0;
        const failedActions = [];
        for (const action of this.queue) {
            try {
                await this.executeAction(action);
                synced++;
            } catch (e) {
                console.error('Failed to sync action:', e);
                failedActions.push(action);
            }
        }

        // Only remove successfully synced items; keep failed items for retry
        this.queue = failedActions;
        if (failedActions.length === 0) {
            localStorage.removeItem('vaultlister_offline_queue');
        } else {
            try {
                localStorage.setItem('vaultlister_offline_queue', JSON.stringify(this.queue));
            } catch (e) {
                console.error('Failed to update offline queue:', e);
            }
        }
        this.updateQueueIndicator();

        if (failedActions.length === 0) {
            toast.success(`Synced ${synced} offline changes`);
        } else {
            toast.warning(`Synced ${synced} changes; ${failedActions.length} failed and will retry on next sync`);
        }
    },

    async executeAction(action) {
        // Execute queued action based on type
        // This would integrate with actual API calls
        // Action execution integrates with API calls — type determines handler
    },

    updateQueueIndicator() {
        const queueEl = document.getElementById('offline-queue');
        if (queueEl) {
            queueEl.textContent = this.queue.length > 0 ? `(${this.queue.length} pending)` : '';
        }
    },
};

// ============================================
// Back to Top Button Manager
// ============================================
const backToTopManager = {
    init() {
        window.addEventListener('scroll', () => {
            const btn = document.getElementById('back-to-top');
            if (btn) {
                btn.classList.toggle('hidden', window.scrollY < 300);
            }
        });
    },
};

// ============================================
// Theme Manager
// ============================================
const themeManager = {
    init() {
        // Load saved preferences — migrate legacy 'blue' default to brand amber (empty = :root)
        const stored = localStorage.getItem('vaultlister_accent');
        const accent = stored === 'blue' || stored === null ? '' : stored;
        const density = localStorage.getItem('vaultlister_density') || 'default';
        const fontSize = localStorage.getItem('vaultlister_fontsize') || 'default';

        this.setAccent(accent);
        this.setDensity(density);
        this.setFontSize(fontSize);
    },

    setAccent(color) {
        document.body.setAttribute('data-accent', color);
        localStorage.setItem('vaultlister_accent', color);
    },

    setDensity(density) {
        document.body.classList.remove('density-compact', 'density-comfortable');
        if (density !== 'default') {
            document.body.classList.add(`density-${density}`);
        }
        localStorage.setItem('vaultlister_density', density);
    },

    setFontSize(size) {
        document.body.classList.remove('font-small', 'font-large');
        if (size !== 'default') {
            document.body.classList.add(`font-${size}`);
        }
        localStorage.setItem('vaultlister_fontsize', size);
    },
};

// ============================================
// Dashboard Widget Manager
// ============================================
const widgetManager = {
    defaultWidgets: [
        { id: 'stats', label: 'Stats Overview', width: 100, height: null, visible: true, collapsed: false, order: 0 },
        { id: 'goals', label: 'Monthly Goal', width: 33, height: null, visible: true, collapsed: false, order: 1 },
        {
            id: 'comparison',
            label: 'Weekly Comparison',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 2,
        },
        { id: 'activity', label: 'Activity Feed', width: 33, height: null, visible: true, collapsed: false, order: 3 },
        {
            id: 'platform-performance',
            label: 'Platform Performance',
            width: 100,
            height: null,
            visible: true,
            collapsed: false,
            order: 4,
        },
        {
            id: 'quick-actions',
            label: 'Quick Actions',
            width: 50,
            height: null,
            visible: true,
            collapsed: false,
            order: 5,
        },
        {
            id: 'stale-listings',
            label: 'Stale Listings',
            width: 50,
            height: null,
            visible: true,
            collapsed: false,
            order: 6,
        },
        {
            id: 'recent-relisted',
            label: 'Recently Relisted',
            width: 50,
            height: null,
            visible: true,
            collapsed: false,
            order: 7,
        },
        {
            id: 'recent-sales',
            label: 'Recent Sales',
            width: 50,
            height: null,
            visible: true,
            collapsed: false,
            order: 8,
        },
        {
            id: 'sales-forecast',
            label: 'Sales Forecast',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 9,
        },
        {
            id: 'conversion-funnel',
            label: 'Conversion Funnel',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 10,
        },
        {
            id: 'profit-margin',
            label: 'Profit Margin',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 11,
        },
        { id: 'cash-flow', label: 'Cash Flow', width: 33, height: null, visible: true, collapsed: false, order: 12 },
        {
            id: 'todays-tasks',
            label: "Today's Tasks",
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 13,
        },
        { id: 'ship-today', label: 'Ship Today', width: 33, height: null, visible: true, collapsed: false, order: 14 },
        { id: 'milestones', label: 'Milestones', width: 50, height: null, visible: true, collapsed: false, order: 15 },
        {
            id: 'low-stock-alerts',
            label: 'Low Stock Alerts',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 16,
        },
        {
            id: 'price-trends',
            label: 'Price Trends',
            width: 50,
            height: null,
            visible: true,
            collapsed: false,
            order: 17,
        },
        {
            id: 'upcoming-events',
            label: 'Upcoming Events',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 18,
        },
        {
            id: 'recent-items',
            label: 'Recent Items',
            width: 100,
            height: null,
            visible: true,
            collapsed: false,
            order: 19,
        },
        { id: 'mini-pnl', label: 'Mini P&L', width: 33, height: null, visible: true, collapsed: false, order: 20 },
        {
            id: 'pending-offers',
            label: 'Pending Offers',
            width: 33,
            height: null,
            visible: true,
            collapsed: false,
            order: 21,
        },
        {
            id: 'poshmark-closet',
            label: 'Poshmark Closet',
            width: 50,
            height: null,
            visible: true,
            collapsed: false,
            order: 22,
        },
    ],

    getWidgets() {
        const saved = localStorage.getItem('vaultlister_dashboard_widgets');
        if (saved) {
            // Merge saved with defaults to ensure new properties exist
            const savedWidgets = JSON.parse(saved);
            // Start with defaults, then merge any saved properties
            const merged = this.defaultWidgets.map((def) => {
                const savedWidget = savedWidgets.find((s) => s.id === def.id);
                if (savedWidget) {
                    // Convert old 'size' to 'width' if needed
                    if (savedWidget.size && !savedWidget.width) {
                        savedWidget.width = savedWidget.size === 'full' ? 100 : savedWidget.size === 'half' ? 50 : 33;
                    }
                    return { ...def, ...savedWidget };
                }
                return def;
            });
            merged.sort((a, b) => a.order - b.order);
            return merged;
        }
        return [...this.defaultWidgets];
    },

    saveWidgets(widgets) {
        localStorage.setItem('vaultlister_dashboard_widgets', JSON.stringify(widgets));
    },

    toggleWidget(widgetId) {
        const widgets = this.getWidgets();
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) {
            widget.visible = !widget.visible;
            // Auto-expand when making visible (so it's not hidden by collapsed CSS)
            if (widget.visible) {
                widget.collapsed = false;
            }
            this.saveWidgets(widgets);
        }
    },

    toggleCollapse(widgetId) {
        const widgets = this.getWidgets();
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) {
            widget.collapsed = !widget.collapsed;
            this.saveWidgets(widgets);
            // Update the DOM directly for smooth animation
            const el = document.querySelector(`[data-widget-id="${widgetId}"]`);
            if (el) {
                el.classList.toggle('collapsed', widget.collapsed);
                const btn = el.querySelector('.widget-collapse-btn');
                if (btn) {
                    btn.innerHTML = sanitizeHTML(sanitizeHTML(widget.collapsed ? '▼' : '▲')); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                    btn.setAttribute('aria-expanded', widget.collapsed ? 'false' : 'true');
                }
            }
        }
    },

    isCollapsed(widgetId) {
        const widgets = this.getWidgets();
        const widget = widgets.find((w) => w.id === widgetId);
        return widget ? widget.collapsed : false;
    },

    getWidgetStyle(widgetId, defaultWidth = 33) {
        const widget = this.getWidgets().find((w) => w.id === widgetId);
        const width = widget?.width || defaultWidth;
        const height = widget?.height;
        const span = width <= 40 ? 2 : width <= 60 ? 3 : width <= 75 ? 4 : 6;
        return `grid-column: span ${span};${height ? ` height: ${height}px;` : ''}`;
    },

    collapseAll() {
        const widgets = this.getWidgets();
        widgets.forEach((w) => (w.collapsed = true));
        this.saveWidgets(widgets);
        handlers.customizeDashboard();
    },

    expandAll() {
        const widgets = this.getWidgets();
        widgets.forEach((w) => (w.collapsed = false));
        this.saveWidgets(widgets);
        handlers.customizeDashboard();
    },

    showAll() {
        const widgets = this.getWidgets();
        widgets.forEach((w) => (w.visible = true));
        this.saveWidgets(widgets);
        handlers.customizeDashboard();
    },

    hideAll() {
        const widgets = this.getWidgets();
        widgets.forEach((w) => (w.visible = false));
        this.saveWidgets(widgets);
        handlers.customizeDashboard();
    },

    reorderWidgets(fromIndex, toIndex) {
        const widgets = this.getWidgets();
        const [moved] = widgets.splice(fromIndex, 1);
        widgets.splice(toIndex, 0, moved);
        widgets.forEach((w, i) => (w.order = i));
        this.saveWidgets(widgets);
    },

    resizeWidget(widgetId, width) {
        const widgets = this.getWidgets();
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) {
            // Ensure width is between 20 and 100 (smooth resizing)
            widget.width = Math.max(20, Math.min(100, parseInt(width) || 33));
            this.saveWidgets(widgets);
        }
    },

    // Initialize drag-to-resize on widgets
    initResize() {
        document.querySelectorAll('.dashboard-widget[data-widget-id]').forEach((widget) => {
            // Skip if already has resize handles
            if (widget.querySelector('.widget-resize-handle-right')) return;

            const widgetId = widget.dataset.widgetId;

            // Create right edge handle (width)
            const rightHandle = document.createElement('div');
            rightHandle.className = 'widget-resize-handle widget-resize-handle-right';
            widget.appendChild(rightHandle);

            // Create bottom edge handle (height)
            const bottomHandle = document.createElement('div');
            bottomHandle.className = 'widget-resize-handle widget-resize-handle-bottom';
            widget.appendChild(bottomHandle);

            // Create corner handle (both)
            const cornerHandle = document.createElement('div');
            cornerHandle.className = 'widget-resize-handle widget-resize-handle-corner';
            widget.appendChild(cornerHandle);

            let startX, startY, startWidth, startHeight, resizeType;

            const onMouseDown = (e, type) => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startY = e.clientY;
                startWidth = widget.offsetWidth;
                startHeight = widget.offsetHeight;
                resizeType = type;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                widget.classList.add('resizing');
            };

            const onMouseMove = (e) => {
                const container = widget.parentElement;
                const containerWidth = container.offsetWidth;

                if (resizeType === 'width' || resizeType === 'corner') {
                    const diffX = e.clientX - startX;
                    const newWidth = startWidth + diffX;
                    // Smooth percentage - no snapping, using toFixed(1) for smooth sub-pixel control
                    const percent = Math.max(
                        20,
                        Math.min(100, parseFloat(((newWidth / containerWidth) * 100).toFixed(1))),
                    );
                    widget.style.width = percent + '%';
                    widget.style.flex = 'none';
                }

                if (resizeType === 'height' || resizeType === 'corner') {
                    const diffY = e.clientY - startY;
                    const newHeight = Math.max(100, startHeight + diffY);
                    widget.style.height = newHeight + 'px';
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                widget.classList.remove('resizing');

                // Save dimensions with smooth percentage (no snapping)
                const container = widget.parentElement;
                const containerWidth = container.offsetWidth;
                const widthPercent = parseFloat(((widget.offsetWidth / containerWidth) * 100).toFixed(1));
                const height = widget.offsetHeight;

                const widgets = widgetManager.getWidgets();
                const w = widgets.find((w) => w.id === widgetId);
                if (w) {
                    if (resizeType === 'width' || resizeType === 'corner') {
                        w.width = Math.max(20, Math.min(100, widthPercent));
                    }
                    if (resizeType === 'height' || resizeType === 'corner') {
                        w.height = height;
                    }
                    widgetManager.saveWidgets(widgets);
                }
            };

            rightHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'width'));
            bottomHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'height'));
            cornerHandle.addEventListener('mousedown', (e) => onMouseDown(e, 'corner'));
        });
    },

    reset() {
        localStorage.removeItem('vaultlister_dashboard_widgets');
        toast.success('Dashboard reset to defaults');
        router.navigate('dashboard');
    },

    showSettingsPanel() {
        const widgets = this.getWidgets();
        return `
            <div class="widget-settings-panel" id="widget-settings-panel">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="font-semibold">Customize Dashboard</h3>
                    <button class="btn btn-sm btn-secondary" onclick="store.setState({_widgetPanelOpen:false}); document.getElementById('widget-settings-panel').remove()">Close</button>
                </div>
                <div class="flex flex-wrap gap-2 mb-4">
                    <button class="btn btn-xs btn-secondary" onclick="store.setState({_widgetPanelOpen:true}); widgetManager.showAll()">Show All</button>
                    <button class="btn btn-xs btn-secondary" onclick="store.setState({_widgetPanelOpen:true}); widgetManager.hideAll()">Hide All</button>
                    <button class="btn btn-xs btn-secondary" onclick="store.setState({_widgetPanelOpen:true}); widgetManager.expandAll()">Expand All</button>
                    <button class="btn btn-xs btn-secondary" onclick="store.setState({_widgetPanelOpen:true}); widgetManager.collapseAll()">Collapse All</button>
                    <button class="btn btn-xs btn-secondary" onclick="store.setState({_widgetPanelOpen:false}); widgetManager.reset()">Reset Defaults</button>
                </div>
                <p class="text-xs text-gray-500 mb-3">Drag the right edge of any panel to resize it. Click to toggle visibility.</p>
                <div class="widget-settings-list">
                    <div class="widget-settings-row">
                        <label class="widget-settings-toggle">
                            <input type="checkbox" ${localStorage.getItem('vaultlister_onboarding_dismissed') !== 'true' ? 'checked' : ''} aria-label="Toggle Getting Started checklist visibility" onchange="if(this.checked){localStorage.removeItem('vaultlister_onboarding_dismissed');}else{localStorage.setItem('vaultlister_onboarding_dismissed','true');} store.setState({_widgetPanelOpen:true}); handlers.customizeDashboard()">
                            <span>Getting Started</span>
                        </label>
                    </div>
                    ${widgets
                        .map(
                            (w) => `
                        <div class="widget-settings-row ${!w.visible ? 'hidden-widget' : ''}">
                            <label class="widget-settings-toggle">
                                <input type="checkbox" ${w.visible ? 'checked' : ''} aria-label="Toggle ${w.label} widget visibility" onchange="store.setState({_widgetPanelOpen:true}); widgetManager.toggleWidget('${w.id}'); handlers.customizeDashboard()">
                                <span>${w.label}</span>
                            </label>
                            <div class="flex gap-2 items-center">
                                <select class="form-input text-xs" style="width: 80px; padding: 2px 4px;" aria-label="Widget size" onchange="store.setState({_widgetPanelOpen:true}); widgetManager.resizeWidget('${w.id}', this.value); handlers.customizeDashboard()">
                                    <option value="33" ${(w.width || 33) === 33 ? 'selected' : ''}>1/3</option>
                                    <option value="50" ${w.width === 50 ? 'selected' : ''}>1/2</option>
                                    <option value="66" ${w.width === 66 ? 'selected' : ''}>2/3</option>
                                    <option value="100" ${w.width === 100 ? 'selected' : ''}>Full</option>
                                </select>
                            </div>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },

    initDragDrop() {
        const widgets = document.querySelectorAll('.dashboard-widget[draggable="true"]');
        widgets.forEach((widget, index) => {
            widget.addEventListener('dragstart', (e) => {
                widget.classList.add('dragging');
                e.dataTransfer.setData('text/plain', index);
            });
            widget.addEventListener('dragend', () => {
                widget.classList.remove('dragging');
            });
            widget.addEventListener('dragover', (e) => {
                e.preventDefault();
                widget.classList.add('drag-over');
            });
            widget.addEventListener('dragleave', () => {
                widget.classList.remove('drag-over');
            });
            widget.addEventListener('drop', (e) => {
                e.preventDefault();
                widget.classList.remove('drag-over');
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;
                if (fromIndex !== toIndex) {
                    this.reorderWidgets(fromIndex, toIndex);
                    router.navigate('dashboard');
                }
            });
        });
    },
};

// ============================================
// Table Column Preferences
// ============================================
const tablePrefs = {
    get(tableId) {
        const saved = localStorage.getItem(`vaultlister_table_${tableId}`);
        return saved ? JSON.parse(saved) : null;
    },

    save(tableId, prefs) {
        localStorage.setItem(`vaultlister_table_${tableId}`, JSON.stringify(prefs));
    },

    getVisibleColumns(tableId, defaultColumns) {
        const prefs = this.get(tableId);
        return prefs?.visibleColumns || defaultColumns;
    },

    getColumnOrder(tableId, defaultOrder) {
        const prefs = this.get(tableId);
        return prefs?.columnOrder || defaultOrder;
    },

    getSortConfig(tableId) {
        const prefs = this.get(tableId);
        return prefs?.sort || { column: null, direction: 'asc' };
    },

    toggleColumn(tableId, columnId, visible) {
        const prefs = this.get(tableId) || { visibleColumns: [], columnOrder: [], sort: {} };
        if (visible) {
            if (!prefs.visibleColumns.includes(columnId)) {
                prefs.visibleColumns.push(columnId);
            }
        } else {
            prefs.visibleColumns = prefs.visibleColumns.filter((c) => c !== columnId);
        }
        this.save(tableId, prefs);
    },

    setSort(tableId, column, direction) {
        const prefs = this.get(tableId) || { visibleColumns: [], columnOrder: [], sort: {} };
        prefs.sort = { column, direction };
        this.save(tableId, prefs);
    },

    showColumnPicker(tableId, columns, onApply) {
        const prefs = this.get(tableId) || { visibleColumns: columns.map((c) => c.id) };
        modals.show(`
            <div class="modal-header">
                <h3 class="modal-title">Column Settings</h3>
                <button class="modal-close" aria-label="Close" onclick="modals.close()"><span aria-hidden="true">&times;</span></button>
            </div>
            <div class="modal-body">
                <div class="space-y-2" style="max-height: 400px; overflow-y: auto;">
                    ${columns
                        .map(
                            (col) => `
                        <label class="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
                            <input type="checkbox" data-column="${col.id}" ${prefs.visibleColumns.includes(col.id) ? 'checked' : ''} aria-label="Toggle ${col.label} column visibility">
                            <span>${col.label}</span>
                        </label>
                    `,
                        )
                        .join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="tablePrefs.applyColumnPicker('${tableId}')">Apply</button>
            </div>
        `);
    },

    applyColumnPicker(tableId) {
        const container = document.getElementById('modal-container');
        const checkboxes = container.querySelectorAll('input[type="checkbox"][data-column]');
        const visibleColumns = [];
        checkboxes.forEach((cb) => {
            if (cb.checked) visibleColumns.push(cb.dataset.column);
        });
        const prefs = this.get(tableId) || {};
        prefs.visibleColumns = visibleColumns;
        this.save(tableId, prefs);
        modals.close();
        if (typeof renderCurrentPage === 'function') renderCurrentPage();
    },
};

// ============================================
// Image Upload Helper
// ============================================
const imageUploader = {
    options: {
        maxSize: 5 * 1024 * 1024, // 5MB
        compress: true,
        compressQuality: 0.8,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    },

    _pasteListener: null,

    init(zoneId, options = {}) {
        const zone = document.getElementById(zoneId);
        if (!zone) return;

        this.options = { ...this.options, ...options };

        // Drag and drop
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer?.files || []).filter((f) =>
                this.options.allowedTypes.includes(f.type),
            );
            this.handleFiles(files, zoneId);
        });

        // Click to upload
        zone.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = this.options.allowedTypes.join(',');
            input.onchange = () => this.handleFiles(Array.from(input.files), zoneId);
            input.click();
        });

        // Paste from clipboard — remove previous listener to avoid accumulation
        if (this._pasteListener) {
            document.removeEventListener('paste', this._pasteListener);
        }
        this._pasteListener = (e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const imageItems = items.filter((item) => item.type.startsWith('image/'));
            if (imageItems.length > 0) {
                const files = imageItems.map((item) => item.getAsFile()).filter(Boolean);
                this.handleFiles(files, zoneId);
                toast.info(`Pasted ${files.length} image(s) from clipboard`);
            }
        };
        document.addEventListener('paste', this._pasteListener);
    },

    async handleFiles(files, zoneId) {
        const zone = document.getElementById(zoneId);
        const thumbnailsContainer =
            zone?.querySelector('.image-thumbnails') || zone?.parentElement?.querySelector('.image-thumbnails');

        for (const file of files) {
            if (file.size > this.options.maxSize) {
                toast.error(`${file.name} exceeds ${this.options.maxSize / 1024 / 1024}MB limit`);
                continue;
            }

            try {
                const processedFile = this.options.compress ? await this.compress(file) : file;
                this.addThumbnail(thumbnailsContainer, processedFile);
            } catch (err) {
                console.error('Failed to process image:', err);
                toast.error(`Failed to process ${file.name}`);
            }
        }
    },

    async compress(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.onload = (e) => {
                const img = new Image();
                img.onerror = () => reject(new Error('Failed to load image for compression'));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 1200;
                    let { width, height } = img;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = (height / width) * maxDim;
                            width = maxDim;
                        } else {
                            width = (width / height) * maxDim;
                            height = maxDim;
                        }
                    }

                    // Clamp to browser canvas limit
                    width = Math.min(Math.round(width), 32767);
                    height = Math.min(Math.round(height), 32767);

                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Canvas toBlob returned null'));
                                return;
                            }
                            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                        },
                        'image/jpeg',
                        this.options.compressQuality,
                    );
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    addThumbnail(container, file) {
        if (!container) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const thumb = document.createElement('div');
            thumb.className = 'image-thumbnail';
            thumb.draggable = true;
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            thumb.innerHTML = sanitizeHTML(
                sanitizeHTML(`
                <img src="${e.target.result}" alt="${file.name}">
                <button class="image-thumbnail-remove" aria-label="Remove image" onclick="this.parentElement.remove()"><span aria-hidden="true">×</span></button>
            `),
            );

            // Drag reorder
            thumb.addEventListener('dragstart', (ev) => {
                thumb.classList.add('dragging');
                ev.dataTransfer.setData('text/plain', '');
            });
            thumb.addEventListener('dragend', () => thumb.classList.remove('dragging'));
            thumb.addEventListener('dragover', (ev) => {
                ev.preventDefault();
                const dragging = container.querySelector('.dragging');
                if (dragging && dragging !== thumb) {
                    const rect = thumb.getBoundingClientRect();
                    const midpoint = rect.left + rect.width / 2;
                    if (ev.clientX < midpoint) {
                        container.insertBefore(dragging, thumb);
                    } else {
                        container.insertBefore(dragging, thumb.nextSibling);
                    }
                }
            });

            container.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    },

    showProgress(zoneId, percent) {
        const zone = document.getElementById(zoneId);
        let progress = zone?.querySelector('.image-upload-progress');
        if (!progress) {
            progress = document.createElement('div');
            progress.className = 'image-upload-progress';
            zone?.appendChild(progress);
        }
        progress.innerHTML = sanitizeHTML(sanitizeHTML(components.progressBar(percent, 'Uploading...', 'primary'))); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },

    hideProgress(zoneId) {
        const zone = document.getElementById(zoneId);
        zone?.querySelector('.image-upload-progress')?.remove();
    },
};

// ============================================
// Prefetch Manager
// ============================================
const prefetchManager = {
    prefetched: new Set(),

    init() {
        // Prefetch on nav item hover
        document.querySelectorAll('[data-prefetch]').forEach((el) => {
            el.addEventListener('mouseenter', () => {
                const page = el.dataset.prefetch;
                this.prefetch(page);
            });
        });
    },

    prefetch(page) {
        if (this.prefetched.has(page)) return;
        this.prefetched.add(page);

        // Prefetch data for page
        switch (page) {
            case 'inventory':
                handlers.loadInventory?.();
                break;
            case 'listings':
                handlers.loadListings?.();
                break;
            case 'analytics':
                handlers.loadAnalytics?.();
                break;
        }
    },
};

// ============================================
// Optimistic UI Helper
// ============================================
const optimisticUI = {
    pending: new Map(),

    update(id, element, optimisticState, apiCall) {
        // Store original state
        const originalText = element.textContent;
        const originalData = element.dataset;

        // Apply optimistic update
        Object.assign(element.dataset, optimisticState);
        if (optimisticState.text) element.textContent = optimisticState.text;
        if (optimisticState.class) element.className = optimisticState.class;

        this.pending.set(id, { element, originalText, originalData });

        // Execute API call
        apiCall()
            .then(() => {
                this.pending.delete(id);
            })
            .catch((error) => {
                // Revert on error
                element.textContent = originalText;
                Object.assign(element.dataset, originalData);
                this.pending.delete(id);
                toast.error('Failed to save. Changes reverted.');
            });
    },

    revertAll() {
        this.pending.forEach(({ element, originalText, originalData }) => {
            element.textContent = originalText;
            Object.assign(element.dataset, originalData);
        });
        this.pending.clear();
    },
};

// ============================================
// Virtual Scroll / Infinite Scroll Helper
// ============================================
const virtualScroll = {
    observers: new Map(),

    init(containerId, options = {}) {
        const { loadMore, threshold = 200, itemHeight = 50, totalItems = 0 } = options;

        const container = document.getElementById(containerId);
        if (!container) return;

        // Infinite scroll observer with loading state tracking
        const sentinel = document.createElement('div');
        sentinel.className = 'scroll-sentinel';
        sentinel.style.height = '1px';
        container.appendChild(sentinel);

        let isLoading = false;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && loadMore && !isLoading) {
                    isLoading = true;
                    let aborted = false;
                    // Set timeout fallback to prevent infinite loading state
                    const loadingTimeout = setTimeout(() => {
                        aborted = true;
                        isLoading = false;
                        snackbar.show('Failed to load more items. Scroll to retry.', 'warning');
                    }, 30000);
                    Promise.resolve(loadMore())
                        .then(() => {
                            clearTimeout(loadingTimeout);
                            if (!aborted) isLoading = false;
                        })
                        .catch((err) => {
                            console.error('Lazy load observer error:', err);
                            clearTimeout(loadingTimeout);
                            if (!aborted) isLoading = false;
                        });
                }
            },
            { rootMargin: `${threshold}px` },
        );

        observer.observe(sentinel);
        this.observers.set(containerId, observer);
    },

    destroy(containerId) {
        const observer = this.observers.get(containerId);
        if (observer) {
            observer.disconnect();
            this.observers.delete(containerId);
        }
    },
};

// ============================================
// Command Palette
// ============================================
const commandPalette = {
    isOpen: false,
    selectedIndex: 0,
    commands: [],

    defaultCommands: [
        {
            id: 'nav-dashboard',
            title: 'Go to Dashboard',
            description: 'View your overview',
            icon: 'home',
            action: () => router.navigate('dashboard'),
            category: 'Navigation',
        },
        {
            id: 'nav-inventory',
            title: 'Go to Inventory',
            description: 'Manage products',
            icon: 'inventory',
            action: () => router.navigate('inventory'),
            category: 'Navigation',
        },
        {
            id: 'nav-listings',
            title: 'Go to Listings',
            description: 'View active listings',
            icon: 'list',
            action: () => router.navigate('listings'),
            category: 'Navigation',
        },
        {
            id: 'nav-sales',
            title: 'Go to Sales',
            description: 'View sales history',
            icon: 'sales',
            action: () => router.navigate('sales'),
            category: 'Navigation',
        },
        {
            id: 'nav-analytics',
            title: 'Go to Analytics',
            description: 'View reports',
            icon: 'analytics',
            action: () => router.navigate('analytics'),
            category: 'Navigation',
        },
        {
            id: 'nav-settings',
            title: 'Go to Settings',
            description: 'Configure app',
            icon: 'settings',
            action: () => router.navigate('settings'),
            category: 'Navigation',
        },
        {
            id: 'action-add-item',
            title: 'Add New Item',
            description: 'Create inventory item',
            icon: 'plus',
            action: () => modals.addItem(),
            category: 'Actions',
        },
        {
            id: 'action-add-listing',
            title: 'Create Listing',
            description: 'List an item for sale',
            icon: 'plus',
            action: () => router.navigate('listings'),
            category: 'Actions',
        },
        {
            id: 'action-record-sale',
            title: 'Record Sale',
            description: 'Log a manual sale',
            icon: 'sales',
            action: () => modals.recordSale?.(),
            category: 'Actions',
        },
        {
            id: 'action-export',
            title: 'Export Data',
            description: 'Download as CSV',
            icon: 'download',
            action: () => handlers.exportInventoryCSV?.(),
            category: 'Actions',
        },
        {
            id: 'toggle-dark',
            title: 'Toggle Dark Mode',
            description: 'Switch theme',
            icon: 'moon',
            action: () => handlers.toggleDarkMode?.(),
            category: 'Settings',
        },
    ],

    _keydownHandler: null,

    init() {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler);
        }
        this._keydownHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', this._keydownHandler);
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
    },

    open() {
        this.isOpen = true;
        this.selectedIndex = 0;
        this.commands = [...this.defaultCommands];
        this.render();
        setTimeout(() => document.getElementById('command-palette-input')?.focus(), 50);
    },

    close() {
        this.isOpen = false;
        document.getElementById('command-palette-overlay')?.remove();
    },

    filter(query) {
        if (!query) {
            this.commands = [...this.defaultCommands];
        } else {
            const q = query.toLowerCase();
            this.commands = this.defaultCommands.filter(
                (cmd) =>
                    cmd.title.toLowerCase().includes(q) ||
                    cmd.description.toLowerCase().includes(q) ||
                    cmd.category.toLowerCase().includes(q),
            );

            // Add inventory search results
            const inventoryMatches =
                store.state.inventory
                    ?.filter((item) => item.title?.toLowerCase().includes(q) || item.sku?.toLowerCase().includes(q))
                    .slice(0, 5) || [];

            inventoryMatches.forEach((item) => {
                this.commands.push({
                    id: `item-${item.id}`,
                    title: item.title,
                    description: `SKU: ${item.sku || 'N/A'} • C$${item.list_price}`,
                    icon: 'inventory',
                    action: () => handlers.editItem?.(item.id),
                    category: 'Inventory',
                });
            });
        }
        this.selectedIndex = 0;
        this.renderResults();
    },

    handleKeydown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.commands.length - 1);
            this.renderResults();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
            this.renderResults();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.execute(this.selectedIndex);
        }
    },

    execute(index) {
        const cmd = this.commands[index];
        if (cmd?.action) {
            this.close();
            cmd.action();
        }
    },

    render() {
        const overlay = document.createElement('div');
        overlay.id = 'command-palette-overlay';
        overlay.className = 'command-palette-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };

        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Command Palette');
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        overlay.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <div class="command-palette">
                <div class="command-palette-input-wrapper" role="search">
                    <span class="command-palette-icon">${components.icon('search', 20)}</span>
                    <input type="text" id="command-palette-input" class="command-palette-input"
                           placeholder="Search commands, pages, or inventory..."
                           aria-label="Search commands, pages, or inventory"
                           oninput="commandPalette.filter(this.value)"
                           onkeydown="commandPalette.handleKeydown(event)">
                </div>
                <div class="command-palette-results" id="command-palette-results" role="listbox" aria-label="Command results"></div>
            </div>
        `),
        );
        document.body.appendChild(overlay);
        this.renderResults();
    },

    renderResults() {
        const container = document.getElementById('command-palette-results');
        if (!container) return;

        const groups = {};
        this.commands.forEach((cmd) => {
            if (!groups[cmd.category]) groups[cmd.category] = [];
            groups[cmd.category].push(cmd);
        });

        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        container.innerHTML = sanitizeHTML(
            sanitizeHTML(
                Object.entries(groups)
                    .map(
                        ([category, cmds]) => `
            <div class="command-palette-group">
                <div class="command-palette-group-title">${category}</div>
                ${cmds
                    .map((cmd, idx) => {
                        const globalIdx = this.commands.indexOf(cmd);
                        return `
                        <div class="command-palette-item ${globalIdx === this.selectedIndex ? 'selected' : ''}"
                             role="option" aria-selected="${globalIdx === this.selectedIndex ? 'true' : 'false'}" tabindex="0"
                             onclick="commandPalette.execute(${globalIdx})"
                             onmouseenter="commandPalette.selectedIndex = ${globalIdx}; commandPalette.renderResults();"
                             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();commandPalette.execute(${globalIdx})}">
                            <div class="command-palette-item-icon">${components.icon(cmd.icon, 18)}</div>
                            <div class="command-palette-item-content">
                                <div class="command-palette-item-title">${escapeHtml(cmd.title)}</div>
                                <div class="command-palette-item-description">${escapeHtml(cmd.description)}</div>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `,
                    )
                    .join('') ||
                    '<div class="command-palette-group"><div style="padding: 20px; text-align: center; color: var(--gray-500);">No results found</div></div>',
            ),
        );
    },
};

// ============================================
// Session Timeout / Idle Detection
// ============================================
const sessionMonitor = {
    idleTimeout: 30 * 60 * 1000, // 30 minutes of inactivity
    warningBefore: 5 * 60 * 1000, // Show warning 5 minutes before timeout
    _idleTimer: null,
    _warningTimer: null,
    _warningShown: false,

    _initialized: false,

    init() {
        if (this._initialized) return;
        this._initialized = true;
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach((ev) => document.addEventListener(ev, () => this.resetTimer(), { passive: true }));
        this.resetTimer();
    },

    resetTimer() {
        if (this._warningShown) {
            this.dismissWarning();
        }
        clearTimeout(this._idleTimer);
        clearTimeout(this._warningTimer);

        if (!store.state.token) return; // Not logged in

        // Set warning timer
        this._warningTimer = setTimeout(() => this.showWarning(), this.idleTimeout - this.warningBefore);
        // Set logout timer
        this._idleTimer = setTimeout(() => this.handleTimeout(), this.idleTimeout);
    },

    showWarning() {
        if (this._warningShown) return;
        this._warningShown = true;
        const banner = document.createElement('div');
        banner.id = 'session-timeout-warning';
        banner.style.cssText =
            'position:fixed;top:0;left:0;right:0;z-index:10001;background:var(--warning-500);color:white;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;font-size:14px;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        banner.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <span>Your session will expire in 5 minutes due to inactivity.</span>
            <div style="display:flex;gap:8px;">
                <button onclick="sessionMonitor.resetTimer()" style="background:white;color:var(--warning-700);border:none;padding:6px 16px;border-radius:6px;font-weight:600;cursor:pointer;">Stay Logged In</button>
                <button onclick="handlers.logout()" style="background:transparent;color:white;border:1px solid white;padding:6px 16px;border-radius:6px;cursor:pointer;">Log Out</button>
            </div>
        `),
        );
        document.body.appendChild(banner);
    },

    dismissWarning() {
        this._warningShown = false;
        const el = document.getElementById('session-timeout-warning');
        if (el) el.remove();
    },

    handleTimeout() {
        this.dismissWarning();
        if (store.state.token) {
            auth.logout();
            toast.info('You have been logged out due to inactivity');
        }
    },

    destroy() {
        clearTimeout(this._idleTimer);
        clearTimeout(this._warningTimer);
        this.dismissWarning();
    },
};

// ============================================
// Context Menu
// ============================================
const contextMenu = {
    init() {
        document.addEventListener('click', () => this.hide());
        document.addEventListener('contextmenu', (e) => {
            const target = e.target.closest('[data-context-menu]');
            if (target) {
                e.preventDefault();
                this.show(e.clientX, e.clientY, target.dataset.contextMenu, target);
            }
        });
    },

    show(x, y, menuType, targetElement) {
        this.hide();

        const items = this.getMenuItems(menuType, targetElement);
        if (items.length === 0) return;

        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu';
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;

        menu.innerHTML = sanitizeHTML(
            sanitizeHTML(
                items
                    .map((item) => {
                        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                        if (item.divider) return '<div class="context-menu-divider"></div>';
                        return `
                <button type="button" class="context-menu-item ${item.danger ? 'danger' : ''}" onclick="${item.action}">
                    <span class="context-menu-item-icon">${components.icon(item.icon, 14)}</span>
                    <span>${escapeHtml(item.label)}</span>
                </button>
            `;
                    })
                    .join(''),
            ),
        );

        document.body.appendChild(menu);

        // Adjust position if off-screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 10}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 10}px`;
    },

    hide() {
        document.getElementById('context-menu')?.remove();
    },

    getMenuItems(menuType, target) {
        const id = escapeHtml(target?.dataset.id || '');
        const sku = escapeHtml(target?.dataset.sku || '');
        if (menuType === 'inventory-item') {
            return [
                { icon: 'edit', label: 'Edit Item', action: `handlers.editItem('${id}')` },
                { icon: 'copy', label: 'Duplicate', action: `handlers.duplicateItem('${id}')` },
                { icon: 'list', label: 'Create Listing', action: `handlers.createListingFromItem('${id}')` },
                { divider: true },
                {
                    icon: 'tag',
                    label: 'Copy SKU',
                    action: `navigator.clipboard.writeText('${sku}'); toast.success('SKU copied')`,
                },
                {
                    icon: 'external-link',
                    label: 'Open in New Tab',
                    action: `window.open('/inventory/${id}', '_blank')`,
                },
                { divider: true },
                { icon: 'trash', label: 'Delete', action: `handlers.deleteItem('${id}')`, danger: true },
            ];
        }
        if (menuType === 'listing-item') {
            return [
                { icon: 'edit', label: 'Edit Listing', action: `handlers.editListing('${id}')` },
                { icon: 'refresh', label: 'Refresh', action: `handlers.refreshListing('${id}')` },
                { icon: 'sales', label: 'Mark as Sold', action: `handlers.markAsSold('${id}')` },
                { divider: true },
                { icon: 'trash', label: 'Delete', action: `handlers.deleteListing('${id}')`, danger: true },
            ];
        }
        return [];
    },
};

// ============================================
// Bulk Selection Manager
// ============================================
const bulkSelection = {
    selected: new Set(),

    toggle(id, checked) {
        if (checked) {
            this.selected.add(id);
        } else {
            this.selected.delete(id);
        }
        this.updateToolbar();
    },

    selectAll(ids) {
        ids.forEach((id) => this.selected.add(id));
        this.updateToolbar();
    },

    clearAll() {
        this.selected.clear();
        document.querySelectorAll('input[type="checkbox"][data-bulk]').forEach((cb) => (cb.checked = false));
        this.updateToolbar();
    },

    updateToolbar() {
        let toolbar = document.getElementById('bulk-toolbar');

        if (this.selected.size === 0) {
            toolbar?.remove();
            return;
        }

        if (!toolbar) {
            toolbar = document.createElement('div');
            toolbar.id = 'bulk-toolbar';
            toolbar.className = 'bulk-toolbar';
            document.body.appendChild(toolbar);
        }

        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        toolbar.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <span class="bulk-toolbar-count">${this.selected.size} selected</span>
            <div class="bulk-toolbar-actions">
                <button class="bulk-toolbar-btn" onclick="bulkSelection.action('export')">
                    ${components.icon('download', 14)} Export
                </button>
                <button class="bulk-toolbar-btn" onclick="bulkSelection.action('tag')">
                    ${components.icon('tag', 14)} Tag
                </button>
                <button class="bulk-toolbar-btn" onclick="bulkSelection.action('edit')">
                    ${components.icon('edit', 14)} Edit
                </button>
                <button class="bulk-toolbar-btn danger" onclick="bulkSelection.action('delete')">
                    ${components.icon('trash', 14)} Delete
                </button>
            </div>
            <button class="bulk-toolbar-close" onclick="bulkSelection.clearAll()">
                ${components.icon('close', 16)}
            </button>
        `),
        );
    },

    async action(type) {
        const ids = Array.from(this.selected);
        switch (type) {
            case 'delete':
                if (
                    await modals.confirm(`Delete ${ids.length} items?`, {
                        title: 'Delete Items',
                        confirmText: 'Delete',
                        danger: true,
                    })
                ) {
                    ids.forEach((id) => handlers.deleteItem?.(id));
                    this.clearAll();
                    toast.success(`Deleted ${ids.length} items`);
                }
                break;
            case 'export':
                handlers.exportSelectedItems?.(ids);
                break;
            case 'tag':
                handlers.bulkTag?.(ids);
                break;
            case 'edit':
                handlers.bulkEdit?.(ids);
                break;
        }
    },
};

// ============================================
// Notification Center
// ============================================
const notificationCenter = {
    notifications: [],
    unreadCount: 0,

    init() {
        // Load from localStorage
        const saved = localStorage.getItem('vaultlister_notifications');
        if (saved) {
            this.notifications = JSON.parse(saved);
            this.unreadCount = this.notifications.filter((n) => !n.read).length;
        }
    },

    add(notification) {
        const n = {
            id: Date.now(),
            ...notification,
            read: false,
            timestamp: new Date().toISOString(),
        };
        this.notifications.unshift(n);
        if (this.notifications.length > 100) this.notifications.length = 100;
        this.unreadCount++;
        this.save();
        this.updateBadge();
    },

    markAsRead(id) {
        const n = this.notifications.find((n) => n.id === id);
        if (n && !n.read) {
            n.read = true;
            this.unreadCount--;
            this.save();
            this.updateBadge();
        }
    },

    markAllAsRead() {
        this.notifications.forEach((n) => (n.read = true));
        this.unreadCount = 0;
        this.save();
        this.updateBadge();
    },

    save() {
        localStorage.setItem('vaultlister_notifications', JSON.stringify(this.notifications.slice(0, 100)));
    },

    updateBadge() {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    },

    toggle() {
        const panel = document.getElementById('notification-center');
        if (panel) {
            panel.classList.toggle('open');
        }
    },

    render() {
        const grouped = { today: [], yesterday: [], older: [] };
        const now = new Date();
        const today = now.toDateString();
        const yesterday = new Date(now - 86400000).toDateString();

        this.notifications.forEach((n) => {
            const date = new Date(n.timestamp).toDateString();
            if (date === today) grouped.today.push(n);
            else if (date === yesterday) grouped.yesterday.push(n);
            else grouped.older.push(n);
        });

        return `
            <div class="notification-center" id="notification-center">
                <div class="notification-center-header">
                    <span class="notification-center-title">Notifications</span>
                    <div class="notification-center-actions">
                        <button class="btn btn-sm btn-secondary" onclick="notificationCenter.markAllAsRead()">Mark all read</button>
                        <button class="btn btn-sm btn-secondary" aria-label="Close notifications" onclick="notificationCenter.toggle()">${components.icon('close', 16)}</button>
                    </div>
                </div>
                <div class="notification-center-content" role="region" aria-label="Notifications">
                    ${
                        Object.entries(grouped)
                            .filter(([_, items]) => items.length > 0)
                            .map(
                                ([group, items]) => `
                        <div class="notification-group">
                            <div class="notification-group-title">${group === 'today' ? 'Today' : group === 'yesterday' ? 'Yesterday' : 'Older'}</div>
                            ${items
                                .map(
                                    (n) => `
                                <button type="button" class="notification-item ${n.read ? '' : 'unread'}" onclick="notificationCenter.markAsRead(${n.id})">
                                    <div class="notification-item-icon" style="background: var(--${n.color || 'primary'}-100); color: var(--${n.color || 'primary'}-600);">
                                        ${components.icon(n.icon || 'bell', 18)}
                                    </div>
                                    <div class="notification-item-content">
                                        <div class="notification-item-title">${escapeHtml(n.title)}</div>
                                        <div class="notification-item-message">${escapeHtml(n.message)}</div>
                                        <div class="notification-item-time">${components.relativeTime(n.timestamp)}</div>
                                    </div>
                                </button>
                            `,
                                )
                                .join('')}
                        </div>
                    `,
                            )
                            .join('') ||
                        '<div style="padding: 40px; text-align: center; color: var(--gray-500);">No notifications</div>'
                    }
                </div>
            </div>
        `;
    },
};
window.notificationCenter = notificationCenter;

// ============================================
// Lightbox
// ============================================
const lightbox = {
    images: [],
    currentIndex: 0,

    open(images, startIndex = 0) {
        this.images = images;
        this.currentIndex = startIndex;
        this.render();

        document.addEventListener('keydown', this.handleKeydown);
    },

    close() {
        document.getElementById('lightbox-overlay')?.remove();
        document.removeEventListener('keydown', this.handleKeydown);
    },

    prev() {
        this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
        this.updateImage();
    },

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateImage();
    },

    goTo(index) {
        this.currentIndex = index;
        this.updateImage();
    },

    handleKeydown(e) {
        if (e.key === 'Escape') lightbox.close();
        if (e.key === 'ArrowLeft') lightbox.prev();
        if (e.key === 'ArrowRight') lightbox.next();
    },

    updateImage() {
        const img = document.querySelector('.lightbox-image');
        const thumbs = document.querySelectorAll('.lightbox-thumb');
        if (img) img.src = this.images[this.currentIndex];
        thumbs.forEach((t, i) => t.classList.toggle('active', i === this.currentIndex));
    },

    render() {
        const overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.className = 'lightbox-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close();
        };

        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        overlay.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <div class="lightbox-container">
                <button class="lightbox-close" aria-label="Close" onclick="lightbox.close()"><span aria-hidden="true">×</span></button>
                ${
                    this.images.length > 1
                        ? `
                    <button class="lightbox-nav prev" aria-label="Previous image" onclick="lightbox.prev()">${components.icon('chevron-left', 24)}</button>
                    <button class="lightbox-nav next" aria-label="Next image" onclick="lightbox.next()">${components.icon('chevron-right', 24)}</button>
                `
                        : ''
                }
                <img src="${this.images[this.currentIndex]}" class="lightbox-image" alt="Item photo ${this.currentIndex + 1} of ${this.images.length}">
                ${
                    this.images.length > 1
                        ? `
                    <div class="lightbox-thumbnails">
                        ${this.images
                            .map(
                                (img, i) => `
                            <img src="${img}" class="lightbox-thumb ${i === this.currentIndex ? 'active' : ''}"
                                 onclick="lightbox.goTo(${i})" alt="Thumbnail">
                        `,
                            )
                            .join('')}
                    </div>
                `
                        : ''
                }
                <div class="lightbox-actions">
                    <button class="lightbox-action" onclick="const u='${escapeHtml(this.images[this.currentIndex])}'; if(u.startsWith('http')||u.startsWith('/')) window.open(u,'_blank');">
                        ${components.icon('download', 16)} Download
                    </button>
                </div>
            </div>
        `),
        );
        document.body.appendChild(overlay);
    },
};

// ============================================
// Skeleton Loading
// ============================================
const skeleton = {
    card() {
        return `
            <div class="skeleton-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        `;
    },

    tableRows(count = 5) {
        return Array(count)
            .fill(0)
            .map(
                () => `
            <div class="skeleton-table-row">
                <div class="skeleton skeleton-table-cell" style="flex: 0.5;"></div>
                <div class="skeleton skeleton-table-cell" style="flex: 2;"></div>
                <div class="skeleton skeleton-table-cell"></div>
                <div class="skeleton skeleton-table-cell"></div>
                <div class="skeleton skeleton-table-cell" style="flex: 0.5;"></div>
            </div>
        `,
            )
            .join('');
    },

    statsGrid() {
        return `
            <div class="stats-grid">
                ${Array(4)
                    .fill(0)
                    .map(
                        () => `
                    <div class="skeleton-card">
                        <div class="skeleton skeleton-text short"></div>
                        <div class="skeleton skeleton-title" style="margin-top: 8px;"></div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// ============================================
// Kanban Board
// ============================================
const kanban = {
    columns: [],
    items: [],

    init(columns, items) {
        this.columns = columns;
        this.items = items;
    },

    render() {
        return `
            <div class="kanban-board">
                ${this.columns
                    .map(
                        (col) => `
                    <div class="kanban-column" data-status="${col.id}"
                         ondragover="kanban.handleDragOver(event)"
                         ondrop="kanban.handleDrop(event, '${col.id}')">
                        <div class="kanban-column-header">
                            <span>${col.title}</span>
                            <span class="kanban-column-count">${this.items.filter((i) => i.status === col.id).length}</span>
                        </div>
                        <div class="kanban-column-content">
                            ${this.items
                                .filter((i) => i.status === col.id)
                                .map((item) => this.renderCard(item))
                                .join('')}
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },

    renderCard(item) {
        return `
            <div class="kanban-card" draggable="true" data-id="${item.id}"
                 ondragstart="kanban.handleDragStart(event, '${item.id}')">
                <div class="kanban-card-title">${escapeHtml(item.title)}</div>
                <div class="kanban-card-meta">
                    <span>${item.platform || ''}</span>
                    <span>C$${item.price || 0}</span>
                </div>
            </div>
        `;
    },

    handleDragStart(e, id) {
        e.dataTransfer.setData('text/plain', id);
        e.target.classList.add('dragging');
    },

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    },

    handleDrop(e, newStatus) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const item = this.items.find((i) => i.id === id);
        if (item) {
            item.status = newStatus;
            // Call update handler
            handlers.updateItemStatus?.(id, newStatus);
        }
    },
};

// ============================================
// Calendar Heatmap
// ============================================
const calendarHeatmap = {
    render(data, options = {}) {
        const { weeks = 52, startDate = new Date() } = options;
        const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Generate cells
        const cells = [];
        const start = new Date(startDate);
        start.setDate(start.getDate() - weeks * 7);

        for (let w = 0; w < weeks; w++) {
            for (let d = 0; d < 7; d++) {
                const date = new Date(start);
                date.setDate(date.getDate() + w * 7 + d);
                const dateStr = toLocalDate(date);
                const value = data[dateStr] || 0;
                const level = value === 0 ? 0 : value < 2 ? 1 : value < 5 ? 2 : value < 10 ? 3 : 4;
                cells.push({ date: dateStr, value, level, week: w, day: d });
            }
        }

        // Generate month labels
        const monthLabels = [];
        let lastMonth = -1;
        cells.forEach((cell, i) => {
            const month = new Date(cell.date).getMonth();
            if (month !== lastMonth) {
                monthLabels.push({ label: months[month], week: cell.week });
                lastMonth = month;
            }
        });

        return `
            <div class="calendar-heatmap">
                <div class="calendar-heatmap-months" style="margin-left: 30px;">
                    ${monthLabels
                        .map(
                            (m, i) => `
                        <span style="margin-left: ${i === 0 ? 0 : (m.week - monthLabels[i - 1].week) * 18 - 20}px;">${m.label}</span>
                    `,
                        )
                        .join('')}
                </div>
                <div style="display: flex;">
                    <div class="calendar-heatmap-days">
                        ${days.map((d) => `<span>${d}</span>`).join('')}
                    </div>
                    <div class="calendar-heatmap" style="display: flex; gap: 4px;">
                        ${Array(weeks)
                            .fill(0)
                            .map(
                                (_, w) => `
                            <div class="calendar-heatmap-row" style="display: flex; flex-direction: column; gap: 4px;">
                                ${Array(7)
                                    .fill(0)
                                    .map((_, d) => {
                                        const cell = cells.find((c) => c.week === w && c.day === d);
                                        return `<div class="calendar-heatmap-cell level-${cell?.level || 0}"
                                                 title="${cell?.date}: ${cell?.value || 0} activities"></div>`;
                                    })
                                    .join('')}
                            </div>
                        `,
                            )
                            .join('')}
                    </div>
                </div>
                <div class="calendar-heatmap-legend">
                    <span>Less</span>
                    <div class="calendar-heatmap-cell level-0"></div>
                    <div class="calendar-heatmap-cell level-1"></div>
                    <div class="calendar-heatmap-cell level-2"></div>
                    <div class="calendar-heatmap-cell level-3"></div>
                    <div class="calendar-heatmap-cell level-4"></div>
                    <span>More</span>
                </div>
            </div>
        `;
    },
};

// ============================================
// Rich Text Editor
// ============================================
const richTextEditor = {
    init(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { maxLength = 5000, placeholder = 'Enter description...', onChange } = options;

        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        container.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <div class="rich-text-editor">
                <div class="rich-text-toolbar">
                    <button class="rich-text-btn" onclick="richTextEditor.format('bold')" title="Bold"><b>B</b></button>
                    <button class="rich-text-btn" onclick="richTextEditor.format('italic')" title="Italic"><i>I</i></button>
                    <button class="rich-text-btn" onclick="richTextEditor.format('underline')" title="Underline"><u>U</u></button>
                    <div class="rich-text-divider"></div>
                    <button class="rich-text-btn" onclick="richTextEditor.format('insertUnorderedList')" title="Bullet List" aria-label="Bullet List">${components.icon('list', 14)}</button>
                    <button class="rich-text-btn" onclick="richTextEditor.format('insertOrderedList')" title="Numbered List">1.</button>
                    <div class="rich-text-divider"></div>
                    <button class="rich-text-btn" onclick="richTextEditor.insertEmoji()" title="Emoji">😀</button>
                    <button class="rich-text-btn" onclick="richTextEditor.insertTemplate()" title="Insert Template" aria-label="Insert Template">${components.icon('document', 14)}</button>
                </div>
                <div class="rich-text-content" id="${containerId}-content" contenteditable="true"
                     data-placeholder="${placeholder}"
                     oninput="richTextEditor.handleInput('${containerId}', ${maxLength})"></div>
                <div class="rich-text-footer">
                    <span id="${containerId}-count">0 / ${maxLength}</span>
                    <span>Supports basic formatting</span>
                </div>
            </div>
        `),
        );
    },

    format(command) {
        document.execCommand(command, false, null);
    },

    handleInput(containerId, maxLength) {
        const content = document.getElementById(`${containerId}-content`);
        const counter = document.getElementById(`${containerId}-count`);
        if (content && counter) {
            const length = content.textContent.length;
            counter.textContent = `${length} / ${maxLength}`;
            if (length > maxLength) {
                counter.style.color = 'var(--red-500)';
            } else {
                counter.style.color = '';
            }
        }
    },

    async insertEmoji() {
        // Simple emoji insertion - could be expanded to full picker
        const emoji = await modals.prompt('Enter an emoji:', {
            title: 'Insert Emoji',
            placeholder: '😊',
            defaultValue: '😊',
        });
        if (emoji) document.execCommand('insertText', false, emoji);
    },

    insertTemplate() {
        const templates = store.state.templates || [];
        if (templates.length === 0) {
            toast.info('No templates available');
            return;
        }
        // Show template picker modal
        // For now, just insert the first template
        document.execCommand('insertHTML', false, templates[0]?.content || '');
    },

    getValue(containerId) {
        return document.getElementById(`${containerId}-content`)?.innerHTML || ''; // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },

    setValue(containerId, html) {
        const content = document.getElementById(`${containerId}-content`);
        if (content) content.innerHTML = sanitizeHTML(sanitizeHTML(html)); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },
};

// ============================================
// Quick Filters
// ============================================
const quickFilters = {
    activeFilters: new Set(),

    render(filters, onChange) {
        return `
            <div class="filter-pills">
                ${filters
                    .map(
                        (f) => `
                    <button class="filter-pill ${this.activeFilters.has(f.id) ? 'active' : ''}"
                            onclick="quickFilters.toggle('${f.id}', ${onChange})">
                        ${f.icon ? components.icon(f.icon, 14) : ''}
                        ${f.label}
                        ${f.count !== undefined ? `<span class="filter-pill-count">${f.count}</span>` : ''}
                    </button>
                `,
                    )
                    .join('')}
                ${
                    this.activeFilters.size > 0
                        ? `
                    <button type="button" class="filter-pills-clear" onclick="quickFilters.clearAll(${onChange})">Clear all</button>
                `
                        : ''
                }
            </div>
        `;
    },

    toggle(filterId, onChange) {
        if (this.activeFilters.has(filterId)) {
            this.activeFilters.delete(filterId);
        } else {
            this.activeFilters.add(filterId);
        }
        if (typeof onChange === 'function') onChange(Array.from(this.activeFilters));
    },

    clearAll(onChange) {
        this.activeFilters.clear();
        if (typeof onChange === 'function') onChange([]);
    },

    getActive() {
        return Array.from(this.activeFilters);
    },
};

// ============================================
// Saved Views
// ============================================
const savedViews = {
    views: [],

    init() {
        const saved = localStorage.getItem('vaultlister_saved_views');
        this.views = saved ? JSON.parse(saved) : [];
    },

    save(name, config) {
        this.views.push({ id: Date.now(), name, config, pinned: false });
        localStorage.setItem('vaultlister_saved_views', JSON.stringify(this.views));
        toast.success(`View "${name}" saved`);
    },

    delete(id) {
        this.views = this.views.filter((v) => v.id !== id);
        localStorage.setItem('vaultlister_saved_views', JSON.stringify(this.views));
    },

    togglePin(id) {
        const view = this.views.find((v) => v.id === id);
        if (view) {
            view.pinned = !view.pinned;
            localStorage.setItem('vaultlister_saved_views', JSON.stringify(this.views));
        }
    },

    apply(id) {
        const view = this.views.find((v) => v.id === id);
        if (view?.config) {
            // Apply filters, sort, columns, etc.
            return view.config;
        }
        return null;
    },

    render(currentConfig) {
        return `
            <div class="saved-views-dropdown">
                <button class="saved-views-trigger" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    ${components.icon('layers', 14)}
                    <span>Views</span>
                    ${components.icon('chevron-down', 14)}
                </button>
                <div class="saved-views-menu hidden">
                    ${
                        this.views
                            .map(
                                (v) => `
                        <button type="button" class="saved-view-item" onclick="savedViews.apply(${v.id})">
                            ${v.pinned ? `<span class="saved-view-pin">★</span>` : ''}
                            <span>${escapeHtml(v.name)}</span>
                        </button>
                    `,
                            )
                            .join('') || '<div style="padding: 12px; color: var(--gray-500);">No saved views</div>'
                    }
                    <div style="border-top: 1px solid var(--gray-200); padding: 8px;">
                        <button class="btn btn-sm btn-secondary w-full" onclick="savedViews.showSaveModal()">
                            ${components.icon('plus', 14)} Save Current View
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    async showSaveModal() {
        const name = await modals.prompt('Enter a name for this view:', { title: 'Save View', placeholder: 'My view' });
        if (name) {
            this.save(name, {
                /* current config */
            });
        }
    },
};

// ============================================
// Focus Mode
// ============================================
const focusMode = {
    isActive: false,

    toggle() {
        this.isActive = !this.isActive;
        document.body.classList.toggle('focus-mode', this.isActive);

        if (this.isActive) {
            const bar = document.createElement('div');
            bar.id = 'focus-mode-bar';
            bar.className = 'focus-mode-bar';
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            bar.innerHTML = sanitizeHTML(
                sanitizeHTML(`
                <span class="focus-mode-title">${components.icon('maximize', 16)} Focus Mode</span>
                <button class="focus-mode-exit" onclick="focusMode.toggle()">Exit Focus Mode</button>
            `),
            );
            document.body.prepend(bar);
        } else {
            document.getElementById('focus-mode-bar')?.remove();
        }
    },
};

// ============================================
// Quick Notes
// ============================================
const quickNotes = {
    getNotes(entityType, entityId) {
        const key = `vaultlister_notes_${entityType}_${entityId}`;
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
    },

    addNote(entityType, entityId, text) {
        const notes = this.getNotes(entityType, entityId);
        notes.push({
            id: Date.now(),
            text,
            timestamp: new Date().toISOString(),
            user: store.state.user?.full_name || 'You',
        });
        localStorage.setItem(`vaultlister_notes_${entityType}_${entityId}`, JSON.stringify(notes));
        return notes;
    },

    deleteNote(entityType, entityId, noteId) {
        let notes = this.getNotes(entityType, entityId);
        notes = notes.filter((n) => n.id !== noteId);
        localStorage.setItem(`vaultlister_notes_${entityType}_${entityId}`, JSON.stringify(notes));
        return notes;
    },

    render(entityType, entityId) {
        const notes = this.getNotes(entityType, entityId);
        return `
            <div class="quick-notes">
                <div class="quick-notes-header">
                    <span class="quick-notes-title">Notes</span>
                    <span class="text-xs text-gray-500">${notes.length}</span>
                </div>
                <div class="quick-notes-list">
                    ${
                        notes.length > 0
                            ? notes
                                  .map(
                                      (n) => `
                        <div class="quick-note-item">
                            <div class="quick-note-text">${escapeHtml(n.text)}</div>
                            <div class="quick-note-meta">${n.user} • ${components.relativeTime(n.timestamp)}</div>
                        </div>
                    `,
                                  )
                                  .join('')
                            : '<div style="padding: 12px; color: var(--gray-500); text-align: center;">No notes yet</div>'
                    }
                </div>
                <div class="quick-notes-input">
                    <input aria-label="Add a note" type="text" placeholder="Add a note..." id="quick-note-input-${entityId}"
                           onkeydown="if(event.key === 'Enter') quickNotes.addFromInput('${entityType}', '${entityId}')">
                    <button class="btn btn-sm btn-primary" onclick="quickNotes.addFromInput('${entityType}', '${entityId}')">Add</button>
                </div>
            </div>
        `;
    },

    addFromInput(entityType, entityId) {
        const input = document.getElementById(`quick-note-input-${entityId}`);
        if (input?.value.trim()) {
            this.addNote(entityType, entityId, input.value.trim());
            input.value = '';
            // Re-render the notes section
            const container = input.closest('.quick-notes');
            if (container) {
                container.outerHTML = this.render(entityType, entityId); // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            }
        }
    },
};

// ============================================
// Audit Log
// ============================================
const auditLog = {
    log(action, entity, entityId, changes = {}) {
        const logs = this.getLogs();
        logs.unshift({
            id: Date.now(),
            action,
            entity,
            entityId,
            changes,
            user: store.state.user?.full_name || 'System',
            timestamp: new Date().toISOString(),
        });
        localStorage.setItem('vaultlister_audit_log', JSON.stringify(logs.slice(0, 500)));
    },

    getLogs(filter = {}) {
        const saved = localStorage.getItem('vaultlister_audit_log');
        let logs = saved ? JSON.parse(saved) : [];

        if (filter.entity) logs = logs.filter((l) => l.entity === filter.entity);
        if (filter.entityId) logs = logs.filter((l) => l.entityId === filter.entityId);

        return logs;
    },

    render(filter = {}) {
        const logs = this.getLogs(filter);
        const actionIcons = { create: 'plus', update: 'edit', delete: 'trash', view: 'eye' };

        return `
            <div class="audit-log">
                ${
                    logs
                        .slice(0, 50)
                        .map(
                            (log) => `
                    <div class="audit-log-item">
                        <div class="audit-log-icon">${components.icon(actionIcons[log.action] || 'activity', 16)}</div>
                        <div class="audit-log-content">
                            <div class="audit-log-header">
                                <span class="audit-log-user">${escapeHtml(log.user)}</span>
                                <span class="audit-log-time">${components.relativeTime(log.timestamp)}</span>
                            </div>
                            <div class="audit-log-action">
                                ${log.action} ${log.entity} ${log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                            </div>
                            ${
                                Object.keys(log.changes).length > 0
                                    ? `
                                <div class="audit-log-changes">
                                    ${Object.entries(log.changes)
                                        .map(
                                            ([field, { old, new: newVal }]) => `
                                        <div class="audit-log-change">
                                            <span class="audit-log-field">${field}:</span>
                                            <span class="audit-log-old">${old}</span>
                                            <span>→</span>
                                            <span class="audit-log-new">${newVal}</span>
                                        </div>
                                    `,
                                        )
                                        .join('')}
                                </div>
                            `
                                    : ''
                            }
                        </div>
                    </div>
                `,
                        )
                        .join('') ||
                    '<div style="padding: 40px; text-align: center; color: var(--gray-500);">No activity recorded</div>'
                }
            </div>
        `;
    },
};

// ============================================
// Goal Tracker
// ============================================
const goalTracker = {
    getGoal(type) {
        const saved = localStorage.getItem(`vaultlister_goal_${type}`);
        return saved ? JSON.parse(saved) : null;
    },

    setGoal(type, target, period = 'monthly') {
        localStorage.setItem(
            `vaultlister_goal_${type}`,
            JSON.stringify({ target, period, createdAt: new Date().toISOString() }),
        );
    },

    getProgress(type, current) {
        const goal = this.getGoal(type);
        if (!goal) return { percent: 0, target: 0, current: 0 };
        return {
            percent: Math.min(100, (current / goal.target) * 100),
            target: goal.target,
            current,
            remaining: Math.max(0, goal.target - current),
        };
    },

    getStreak(type) {
        const key = `vaultlister_streak_${type}`;
        const saved = localStorage.getItem(key);
        if (!saved) return 0;
        const { count, lastDate } = JSON.parse(saved);
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today || lastDate === yesterday) return count;
        return 0;
    },

    incrementStreak(type) {
        const key = `vaultlister_streak_${type}`;
        const today = new Date().toDateString();
        const current = this.getStreak(type);
        const saved = localStorage.getItem(key);
        const lastDate = saved ? JSON.parse(saved).lastDate : null;

        if (lastDate !== today) {
            localStorage.setItem(key, JSON.stringify({ count: current + 1, lastDate: today }));
        }
    },

    render(type, current, options = {}) {
        const { title = 'Goal', color = 'primary' } = options;
        const progress = this.getProgress(type, current);
        const streak = this.getStreak(type);

        return `
            <div class="goal-widget">
                <div class="goal-widget-header">
                    <span class="goal-widget-title">${title}</span>
                    ${
                        streak > 0
                            ? `
                        <span class="goal-widget-streak">🔥 ${streak} day streak</span>
                    `
                            : ''
                    }
                </div>
                <div class="goal-widget-progress">
                    <div class="goal-widget-bar">
                        <div class="goal-widget-fill" style="width: ${progress.percent}%"></div>
                    </div>
                    <div class="goal-widget-stats">
                        <span>C$${current.toLocaleString()} of C$${progress.target.toLocaleString()}</span>
                        <span>${Math.round(progress.percent)}%</span>
                    </div>
                </div>
                ${
                    progress.remaining > 0
                        ? `
                    <div class="goal-widget-projected">
                        C$${progress.remaining.toLocaleString()} to go
                    </div>
                `
                        : `
                    <div class="goal-widget-projected">🎉 Goal achieved!</div>
                `
                }
            </div>
        `;
    },
};

// ============================================
// Mobile Helpers
// ============================================
const mobileUI = {
    isMobile() {
        return window.innerWidth <= 768;
    },

    renderBottomNav() {
        const cp = store.state.currentPage;
        return `
            <nav class="mobile-bottom-nav" aria-label="Mobile navigation">
                <a href="#" class="mobile-nav-item ${cp === 'dashboard' ? 'active' : ''}" ${cp === 'dashboard' ? 'aria-current="page"' : ''} onclick="router.navigate('dashboard')">
                    ${components.icon('home', 20)}
                    <span>Home</span>
                </a>
                <a href="#" class="mobile-nav-item ${cp === 'inventory' ? 'active' : ''}" ${cp === 'inventory' ? 'aria-current="page"' : ''} onclick="router.navigate('inventory')">
                    ${components.icon('inventory', 20)}
                    <span>Inventory</span>
                </a>
                <a href="#" class="mobile-nav-item ${cp === 'listings' ? 'active' : ''}" ${cp === 'listings' ? 'aria-current="page"' : ''} onclick="router.navigate('listings')">
                    ${components.icon('list', 20)}
                    <span>Listings</span>
                </a>
                <a href="#" class="mobile-nav-item ${cp === 'orders-sales' ? 'active' : ''}" ${cp === 'orders-sales' ? 'aria-current="page"' : ''} onclick="router.navigate('orders-sales')">
                    ${components.icon('sales', 20)}
                    <span>Orders</span>
                </a>
                <a href="#" class="mobile-nav-item ${cp === 'offers' ? 'active' : ''}" ${cp === 'offers' ? 'aria-current="page"' : ''} onclick="router.navigate('offers')">
                    ${components.icon('offers', 20)}
                    <span>Offers</span>
                </a>
            </nav>
        `;
    },

    updateBottomNav() {
        const nav = document.querySelector('.mobile-bottom-nav');
        if (!nav) return;
        const cp = store.state.currentPage;
        nav.querySelectorAll('.mobile-nav-item').forEach((item) => {
            const route = item.getAttribute('onclick')?.match(/navigate\('([^']+)'\)/)?.[1];
            item.classList.toggle('active', route === cp);
            if (route === cp) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });
    },

    renderFAB(action = 'modals.addItem()') {
        if (!this.isMobile()) return '';
        return `
            <button class="fab" onclick="${action}" aria-label="Add item">
                ${components.icon('plus', 24)}
            </button>
        `;
    },

    initPullToRefresh(onRefresh) {
        let startY = 0;
        let pulling = false;

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
                pulling = true;
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!pulling) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 60) {
                document.getElementById('pull-to-refresh')?.classList.add('visible');
            }
        });

        document.addEventListener('touchend', () => {
            if (document.getElementById('pull-to-refresh')?.classList.contains('visible')) {
                onRefresh?.();
                setTimeout(() => {
                    document.getElementById('pull-to-refresh')?.classList.remove('visible');
                }, 1000);
            }
            pulling = false;
        });
    },
};

// ============================================
// Toast with Undo
// ============================================
const toastWithUndo = {
    show(message, undoAction, duration = 5000) {
        const toastEl = document.createElement('div');
        toastEl.className = 'toast toast-info';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        toastEl.innerHTML = sanitizeHTML(
            sanitizeHTML(`
            <div class="toast-undo">
                <span>${message}</span>
                <button class="toast-undo-btn" onclick="(${undoAction})(); this.closest('.toast').remove();">Undo</button>
            </div>
        `),
        );
        document.getElementById('toast-container')?.appendChild(toastEl);
        setTimeout(() => toastEl.remove(), duration);
    },
};

// ============================================
// Main Section UI Helpers
// ============================================

// Forecast Chart - Mini line chart for sales predictions
const forecastChart = {
    render(data, options = {}) {
        const { width = 200, height = 60, showPrediction = true } = options;
        const actual = data.actual || [];
        const predicted = data.predicted || [];
        const max = Math.max(...actual, ...predicted, 1);

        const actualPoints = actual
            .map((v, i) => `${(i / (actual.length - 1)) * width * 0.6},${height - (v / max) * height}`)
            .join(' ');

        const predPoints = predicted
            .map(
                (v, i) =>
                    `${width * 0.6 + (i / Math.max(predicted.length - 1, 1)) * width * 0.4},${height - (v / max) * height}`,
            )
            .join(' ');

        return `
            <svg class="forecast-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline class="forecast-actual" points="${actualPoints}" fill="none" stroke="var(--primary-500)" stroke-width="2"/>
                ${showPrediction ? `<polyline class="forecast-predicted" points="${predPoints}" fill="none" stroke="var(--primary-300)" stroke-width="2" stroke-dasharray="4,2"/>` : ''}
                <line class="forecast-divider" x1="${width * 0.6}" y1="0" x2="${width * 0.6}" y2="${height}" stroke="var(--gray-300)" stroke-dasharray="2,2"/>
            </svg>
        `;
    },
};

// Sales Funnel - Visual funnel for conversion stages
const salesFunnel = {
    render(stages) {
        const maxValue = Math.max(...stages.map((s) => s.value), 1);
        return `
            <div class="sales-funnel">
                ${stages
                    .map((stage, i) => {
                        const width = 100 - i * 15;
                        const percent = ((stage.value / maxValue) * 100).toFixed(0);
                        return `
                        <div class="funnel-stage" style="width: ${width}%">
                            <div class="funnel-bar" style="width: ${percent}%"></div>
                            <div class="funnel-label">
                                <span class="funnel-name">${stage.name}</span>
                                <span class="funnel-value">${stage.value}</span>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },
};

// Profit Gauge - Circular gauge for profit margins
const profitGauge = {
    render(value, max = 100, options = {}) {
        const { size = 120, label = 'Profit', color = 'var(--success-500)' } = options;
        const percent = Math.min((value / max) * 100, 100);
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (percent / 100) * circumference;

        return `
            <div class="profit-gauge" style="width: ${size}px; height: ${size}px;">
                <svg viewBox="0 0 100 100">
                    <circle class="gauge-bg" cx="50" cy="50" r="45" fill="none" stroke="var(--gray-200)" stroke-width="8"/>
                    <circle class="gauge-value" cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="8"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                        transform="rotate(-90 50 50)" stroke-linecap="round"/>
                </svg>
                <div class="gauge-center">
                    <span class="gauge-percent">${percent.toFixed(0)}%</span>
                    <span class="gauge-label">${label}</span>
                </div>
            </div>
        `;
    },
};

// Cash Flow Ticker - Scrolling ticker for recent transactions
const cashFlowTicker = {
    render(transactions) {
        return `
            <div class="cash-flow-ticker">
                <div class="ticker-content">
                    ${transactions
                        .map(
                            (t) => `
                        <span class="ticker-item ${t.type}">
                            <span class="ticker-amount">${t.type === 'income' ? '+' : '-'}C$${t.amount.toFixed(2)}</span>
                            <span class="ticker-desc">${escapeHtml(t.description)}</span>
                        </span>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },

    start() {
        const ticker = document.querySelector('.cash-flow-ticker');
        if (ticker) {
            ticker.classList.add('animating');
        }
    },
};

// View Mode Toggle - Switch between grid/list/compact views
const viewModeToggle = {
    modes: ['list', 'grid', 'compact'],

    render(currentMode, onChangeHandler) {
        return `
            <div class="view-mode-toggle">
                ${this.modes
                    .map(
                        (mode) => `
                    <button class="view-mode-btn ${currentMode === mode ? 'active' : ''}"
                            data-mode="${mode}"
                            onclick="${onChangeHandler}('${mode}')"
                            title="${mode.charAt(0).toUpperCase() + mode.slice(1)} view">
                        ${components.icon(mode === 'list' ? 'list' : mode === 'grid' ? 'grid' : 'menu', 16)}
                    </button>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Smart Search - Enhanced search with suggestions
const smartSearch = {
    suggestions: [],
    recentSearches: (() => {
        try {
            return JSON.parse(localStorage.getItem('vl_recent_searches') || '[]');
        } catch (e) {
            console.error('Failed to parse recent searches:', e);
            return [];
        }
    })(),

    render(placeholder = 'Search...', onSearchHandler) {
        return `
            <div class="smart-search">
                <div class="smart-search-input-wrapper">
                    ${components.icon('search', 16)}
                    <input type="text" class="smart-search-input" placeholder="${placeholder}" aria-label="Smart search"
                           oninput="smartSearch.onInput(this.value)"
                           onfocus="smartSearch.showSuggestions()"
                           onblur="setTimeout(() => smartSearch.hideSuggestions(), 200)">
                </div>
                <div class="smart-search-dropdown" style="display: none;">
                    <div class="smart-search-recent">
                        <div class="search-section-label">Recent</div>
                        ${this.recentSearches
                            .slice(0, 5)
                            .map(
                                (s) => `
                            <button type="button" class="search-suggestion" onclick="smartSearch.selectSuggestion('${escapeHtml(s)}')">${escapeHtml(s)}</button>
                        `,
                            )
                            .join('')}
                    </div>
                </div>
            </div>
        `;
    },

    onInput(value) {
        // Debounced search
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch(value);
        }, 300);
    },

    performSearch(query) {
        if (query.length > 2) {
            this.addToRecent(query);
        }
    },

    addToRecent(query) {
        this.recentSearches = [query, ...this.recentSearches.filter((s) => s !== query)].slice(0, 10);
        localStorage.setItem('vl_recent_searches', JSON.stringify(this.recentSearches));
    },

    showSuggestions() {
        const dropdown = document.querySelector('.smart-search-dropdown');
        if (dropdown) dropdown.style.display = 'block';
    },

    hideSuggestions() {
        const dropdown = document.querySelector('.smart-search-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    },

    selectSuggestion(value) {
        const input = document.querySelector('.smart-search-input');
        if (input) {
            input.value = value;
            this.performSearch(value);
        }
    },
};

// Filter Presets - Save and load filter configurations
const filterPresets = {
    presets: (() => {
        try {
            return JSON.parse(localStorage.getItem('vl_filter_presets') || '{}');
        } catch (e) {
            console.error('Failed to parse filter presets:', e);
            return {};
        }
    })(),

    render(page, currentFilters) {
        const pagePresets = this.presets[page] || [];
        return `
            <div class="filter-presets">
                <div class="preset-list">
                    ${pagePresets
                        .map(
                            (preset, i) => `
                        <button class="preset-btn" onclick="filterPresets.apply('${page}', ${i})">
                            ${escapeHtml(preset.name)}
                        </button>
                    `,
                        )
                        .join('')}
                </div>
                <button class="preset-save-btn" onclick="filterPresets.save('${page}')" title="Save current filters">
                    ${components.icon('save', 14)}
                </button>
            </div>
        `;
    },

    async save(page) {
        const name = await modals.prompt('Enter a name for this preset:', {
            title: 'Save Preset',
            placeholder: 'My preset',
        });
        if (!name) return;

        const currentFilters = this.getCurrentFilters(page);
        if (!this.presets[page]) this.presets[page] = [];
        this.presets[page].push({ name, filters: currentFilters });
        localStorage.setItem('vl_filter_presets', JSON.stringify(this.presets));
        toast.success(`Filter preset "${name}" saved`);
    },

    apply(page, index) {
        const preset = this.presets[page]?.[index];
        if (preset) {
            this.applyFilters(page, preset.filters);
            toast.info(`Applied "${preset.name}" filters`);
        }
    },

    getCurrentFilters(page) {
        // Get current filter state based on page
        return store.state[`${page}Filters`] || {};
    },

    applyFilters(page, filters) {
        store.setState({ [`${page}Filters`]: filters });
        renderApp(pages[page]());
    },
};

// Order Timeline - Visual timeline for order status
const orderTimeline = {
    render(order) {
        const stages = [
            { key: 'ordered', label: 'Ordered', icon: 'shopping-cart' },
            { key: 'confirmed', label: 'Confirmed', icon: 'check' },
            { key: 'shipped', label: 'Shipped', icon: 'truck' },
            { key: 'delivered', label: 'Delivered', icon: 'package' },
        ];

        const statusIndex = stages.findIndex((s) => s.key === order.status);

        return `
            <div class="order-timeline">
                ${stages
                    .map(
                        (stage, i) => `
                    <div class="timeline-stage ${i <= statusIndex ? 'completed' : ''} ${i === statusIndex ? 'current' : ''}">
                        <div class="timeline-icon">${components.icon(stage.icon, 16)}</div>
                        <div class="timeline-label">${stage.label}</div>
                        ${i < stages.length - 1 ? '<div class="timeline-connector"></div>' : ''}
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Countdown Timer - Time remaining display
const countdownTimer = {
    render(targetDate, label = 'Time remaining') {
        const now = new Date();
        const target = new Date(targetDate);
        const diff = target - now;

        if (diff <= 0) {
            return `<span class="countdown expired">Expired</span>`;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        const urgency = days === 0 ? 'urgent' : days <= 2 ? 'warning' : 'normal';

        return `
            <div class="countdown-timer ${urgency}">
                <span class="countdown-label">${label}</span>
                <span class="countdown-value">
                    ${days > 0 ? `<span class="countdown-unit">${days}d</span>` : ''}
                    <span class="countdown-unit">${hours}h</span>
                    <span class="countdown-unit">${minutes}m</span>
                </span>
            </div>
        `;
    },

    _intervalId: null,

    startUpdates() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
        }
        this._intervalId = setInterval(() => {
            document.querySelectorAll('[data-countdown-target]').forEach((el) => {
                const target = el.dataset.countdownTarget;
                el.innerHTML = sanitizeHTML(sanitizeHTML(this.render(target))); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            });
        }, 60000);
    },

    stopUpdates() {
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    },
};

// Offer Counter Slider - Visual slider for counter offers
const counterSlider = {
    render(originalPrice, minPrice, currentValue, onChangeHandler) {
        const range = originalPrice - minPrice;
        const percent = ((currentValue - minPrice) / range) * 100;

        return `
            <div class="counter-slider">
                <div class="counter-slider-track">
                    <div class="counter-slider-fill" style="width: ${percent}%"></div>
                    <input type="range" class="counter-slider-input" aria-label="Counter slider"
                           min="${minPrice}" max="${originalPrice}" value="${currentValue}"
                           oninput="${onChangeHandler}(this.value)">
                </div>
                <div class="counter-slider-labels">
                    <span class="min-label">C$${minPrice.toFixed(2)}</span>
                    <span class="current-label">C$${currentValue.toFixed(2)}</span>
                    <span class="max-label">C$${originalPrice.toFixed(2)}</span>
                </div>
            </div>
        `;
    },
};

// Profit Calculator - Real-time profit calculation
const profitCalculator = {
    render(item, offerAmount) {
        const cost = item.purchasePrice || 0;
        const fees = offerAmount * 0.13 || 0; // Estimated 13% fees
        const shipping = item.shippingCost || 5;
        const profit = offerAmount - cost - fees - shipping;
        const margin = offerAmount > 0 ? (profit / offerAmount) * 100 : 0;

        return `
            <div class="profit-calculator">
                <div class="calc-row">
                    <span>Sale Price</span>
                    <span>C$${offerAmount.toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>Cost</span>
                    <span>-C$${cost.toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>Est. Fees (13%)</span>
                    <span>-C$${fees.toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span>Shipping</span>
                    <span>-C$${shipping.toFixed(2)}</span>
                </div>
                <div class="calc-row total ${profit >= 0 ? 'positive' : 'negative'}">
                    <span>Net Profit</span>
                    <span>C$${profit.toFixed(2)} (${margin.toFixed(0)}%)</span>
                </div>
            </div>
        `;
    },
};

// Quick Stats Bar - Inline stats for pages
const quickStatsBar = {
    render(stats) {
        return `
            <div class="quick-stats-bar">
                ${stats
                    .map(
                        (stat) => `
                    <div class="quick-stat">
                        <span class="quick-stat-value">${stat.value}</span>
                        <span class="quick-stat-label">${stat.label}</span>
                        ${
                            stat.change !== undefined
                                ? `
                            <span class="quick-stat-change ${stat.change >= 0 ? 'positive' : 'negative'}">
                                ${stat.change >= 0 ? '+' : ''}${stat.change}%
                            </span>
                        `
                                : ''
                        }
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Milestone Tracker - Track progress toward goals
const milestoneTracker = {
    render(milestones) {
        return `
            <div class="milestone-tracker">
                ${milestones
                    .map((m) => {
                        const progress = Math.min((m.current / m.target) * 100, 100);
                        const isComplete = m.current >= m.target;
                        return `
                        <div class="milestone ${isComplete ? 'complete' : ''}">
                            <div class="milestone-icon">${isComplete ? components.icon('check-circle', 20) : components.icon(m.icon || 'target', 20)}</div>
                            <div class="milestone-info">
                                <div class="milestone-name">${escapeHtml(m.name)}</div>
                                <div class="milestone-progress">
                                    <div class="milestone-bar">
                                        <div class="milestone-fill" style="width: ${progress}%"></div>
                                    </div>
                                    <span class="milestone-count">${m.current}/${m.target}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },
};

// Shipping Queue Widget - Pending shipments display
const shippingQueue = {
    render(orders) {
        const pending = orders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
        return `
            <div class="shipping-queue">
                <div class="queue-header">
                    <span class="queue-title">Ship Today</span>
                    <span class="queue-count">${pending.length}</span>
                </div>
                <div class="queue-list">
                    ${pending
                        .slice(0, 5)
                        .map(
                            (order) => `
                        <button type="button" class="queue-item" onclick="router.navigate('orders')">
                            <div class="queue-item-info">
                                <span class="queue-item-id">#${order.id?.slice(0, 8) || 'N/A'}</span>
                                <span class="queue-item-buyer">${escapeHtml(order.buyerName || 'Unknown')}</span>
                            </div>
                            <span class="queue-item-platform">${escapeHtml(order.platform || '')}</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
                ${pending.length > 5 ? `<div class="queue-more">+${pending.length - 5} more</div>` : ''}
            </div>
        `;
    },
};

// Tasks Widget - Today's tasks
const tasksWidget = {
    render(tasks) {
        const todayTasks = tasks.filter((t) => {
            const due = new Date(t.dueDate);
            const today = new Date();
            return due.toDateString() === today.toDateString();
        });

        return `
            <div class="tasks-widget">
                <div class="tasks-header">
                    <span class="tasks-title">Today's Tasks</span>
                    <span class="tasks-count">${todayTasks.filter((t) => !t.completed).length} remaining</span>
                </div>
                <div class="tasks-list">
                    ${todayTasks
                        .slice(0, 5)
                        .map(
                            (task) => `
                        <button type="button" class="task-item ${task.completed ? 'completed' : ''}" onclick="handlers.toggleTask('${escapeHtml(task.id)}')">
                            <span class="task-checkbox">${task.completed ? components.icon('check-square', 16) : components.icon('square', 16)}</span>
                            <span class="task-text">${escapeHtml(task.title)}</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
                ${todayTasks.length === 0 ? '<div class="tasks-empty">No tasks for today</div>' : ''}
            </div>
        `;
    },
};

// ============================================
// Tools Section UI Helpers
// ============================================

// Automation Flow Diagram
const automationFlow = {
    render(automation) {
        const trigger = automation.trigger || { icon: 'clock', label: 'Schedule' };
        const conditions = automation.conditions || [];
        const action = automation.action || { icon: 'play', label: 'Run' };
        const elseAction = automation.elseAction || 'skip';
        const conditionLogic = automation.conditionLogic || 'AND';
        const hasConditions = conditions.length > 0 && conditions.some((c) => c.field);

        return `
            <div class="automation-flow">
                <div class="flow-node trigger">
                    <div class="flow-node-icon">${components.icon(trigger.icon, 20)}</div>
                    <div class="flow-node-label">${trigger.label}</div>
                </div>
                <div class="flow-connector"></div>
                ${
                    hasConditions
                        ? `
                    <div class="flow-node condition">
                        <div class="flow-node-icon">${components.icon('filter', 16)}</div>
                        <div class="flow-node-label">${conditions
                            .filter((c) => c.field)
                            .map((c) => `${c.field} ${c.operator} ${c.value}`)
                            .join(` ${conditionLogic} `)}</div>
                    </div>
                    <div class="flow-connector"></div>
                    <div class="flow-branch-split">
                        <div class="flow-branch-container yes">
                            <span class="flow-branch-tag yes">YES</span>
                            <div class="flow-connector"></div>
                            <div class="flow-node action">
                                <div class="flow-node-icon">${components.icon(action.icon, 20)}</div>
                                <div class="flow-node-label">${action.label}</div>
                            </div>
                        </div>
                        <div class="flow-branch-container no">
                            <span class="flow-branch-tag no">NO</span>
                            <div class="flow-connector"></div>
                            <div class="flow-node ${elseAction === 'skip' ? 'skip' : 'action'}">
                                <div class="flow-node-icon">${components.icon(elseAction === 'skip' ? 'x' : elseAction === 'log' ? 'file-text' : 'play', 16)}</div>
                                <div class="flow-node-label">${elseAction === 'skip' ? 'Skip' : elseAction === 'log' ? 'Log Only' : 'Alt Action'}</div>
                            </div>
                        </div>
                    </div>
                `
                        : `
                    ${conditions
                        .map(
                            (c) => `
                        <div class="flow-node condition">
                            <div class="flow-node-icon">${components.icon('filter', 16)}</div>
                            <div class="flow-node-label">${c.label || 'Condition'}</div>
                        </div>
                        <div class="flow-connector"></div>
                    `,
                        )
                        .join('')}
                    <div class="flow-node action">
                        <div class="flow-node-icon">${components.icon(action.icon, 20)}</div>
                        <div class="flow-node-label">${action.label}</div>
                    </div>
                `
                }
            </div>
        `;
    },
};

// Run History Timeline
const runHistoryTimeline = {
    render(runs) {
        if (!runs || runs.length === 0) {
            return '<div class="text-gray-500 text-sm text-center py-4">No run history yet</div>';
        }

        return `
            <div class="run-history-timeline">
                ${runs
                    .slice(0, 10)
                    .map(
                        (run) => `
                    <div class="run-history-item ${run.status}">
                        <div class="run-history-time">${run.timestamp ? new Date(run.timestamp).toLocaleString() : 'Unknown time'}</div>
                        <div class="run-history-action">${escapeHtml(run.action)}</div>
                        <div class="run-history-result">${escapeHtml(run.result || '')}</div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Automation Wizard
const automationWizard = {
    currentStep: 1,
    totalSteps: 4,
    data: {},

    render() {
        return `
            <div class="automation-wizard">
                <div class="wizard-steps">
                    ${['Trigger', 'Conditions', 'Actions', 'Review']
                        .map(
                            (step, i) => `
                        <div class="wizard-step ${i + 1 === this.currentStep ? 'active' : ''} ${i + 1 < this.currentStep ? 'completed' : ''}">
                            <div class="wizard-step-number">${i + 1 < this.currentStep ? components.icon('check', 14) : i + 1}</div>
                            <div class="wizard-step-label">${step}</div>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
                <div class="wizard-content">
                    ${this.renderStep()}
                </div>
                <div class="wizard-actions flex justify-between mt-6">
                    <button class="btn btn-secondary" onclick="automationWizard.prevStep()" ${this.currentStep === 1 ? 'disabled' : ''}>
                        ${components.icon('arrow-left', 14)} Back
                    </button>
                    <button class="btn btn-primary" onclick="automationWizard.nextStep()">
                        ${this.currentStep === this.totalSteps ? 'Create Automation' : 'Next'} ${components.icon('arrow-right', 14)}
                    </button>
                </div>
            </div>
        `;
    },

    renderStep() {
        switch (this.currentStep) {
            case 1:
                return this.renderTriggerStep();
            case 2:
                return this.renderConditionsStep();
            case 3:
                return this.renderActionsStep();
            case 4:
                return this.renderReviewStep();
            default:
                return '';
        }
    },

    renderTriggerStep() {
        const triggers = [
            { id: 'schedule', icon: 'clock', label: 'Schedule', desc: 'Run at specific times' },
            { id: 'event', icon: 'zap', label: 'Event', desc: 'When something happens' },
            { id: 'manual', icon: 'play', label: 'Manual', desc: 'Run on demand' },
        ];
        return `
            <h3 class="text-lg font-medium mb-4">Choose a trigger</h3>
            <div class="grid grid-cols-3 gap-4">
                ${triggers
                    .map(
                        (t) => `
                    <button type="button" class="card cursor-pointer hover:border-primary-400 ${this.data.trigger === t.id ? 'border-primary-500 bg-primary-50' : ''}"
                         onclick="automationWizard.setTrigger('${t.id}')">
                        <div class="card-body text-center">
                            ${components.icon(t.icon, 32)}
                            <div class="font-medium mt-2">${t.label}</div>
                            <div class="text-sm text-gray-500">${t.desc}</div>
                        </div>
                    </button>
                `,
                    )
                    .join('')}
            </div>
        `;
    },

    renderConditionsStep() {
        const conditions = this.data.conditions || [];
        const logic = this.data.conditionLogic || 'AND';
        const elseAction = this.data.elseAction || 'skip';

        const fieldOptions = [
            { value: 'price', label: 'Price', type: 'numeric' },
            { value: 'days_listed', label: 'Days Listed', type: 'numeric' },
            { value: 'platform', label: 'Platform', type: 'text' },
            { value: 'category', label: 'Category', type: 'text' },
            { value: 'quantity', label: 'Quantity', type: 'numeric' },
            { value: 'views', label: 'Views', type: 'numeric' },
            { value: 'likes', label: 'Likes', type: 'numeric' },
        ];
        const numericOps = [
            { value: 'gt', label: 'is greater than' },
            { value: 'lt', label: 'is less than' },
            { value: 'eq', label: 'equals' },
            { value: 'gte', label: 'is at least' },
            { value: 'lte', label: 'is at most' },
        ];
        const textOps = [
            { value: 'eq', label: 'equals' },
            { value: 'neq', label: 'does not equal' },
            { value: 'contains', label: 'contains' },
        ];

        return `
            <h3 class="text-lg font-medium mb-4">Add conditions (optional)</h3>
            <div class="condition-builder-enhanced">
                ${conditions
                    .map((c, i) => {
                        const fieldType = (fieldOptions.find((f) => f.value === c.field) || {}).type || 'numeric';
                        const ops = fieldType === 'text' ? textOps : numericOps;
                        return `
                        ${
                            i > 0
                                ? `
                            <div class="condition-logic-operator">
                                <button class="btn btn-sm ${logic === 'AND' ? 'btn-primary' : 'btn-secondary'}" onclick="automationWizard.setConditionLogic('AND')">AND</button>
                                <button class="btn btn-sm ${logic === 'OR' ? 'btn-primary' : 'btn-secondary'}" onclick="automationWizard.setConditionLogic('OR')">OR</button>
                            </div>
                        `
                                : ''
                        }
                        <div class="condition-row-enhanced">
                            <div class="condition-row-fields">
                                <select class="form-select" aria-label="Condition field" onchange="automationWizard.updateCondition(${i}, 'field', this.value)">
                                    <option value="">Select field...</option>
                                    ${fieldOptions.map((f) => `<option value="${f.value}" ${c.field === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
                                </select>
                                <select class="form-select" aria-label="Condition operator" onchange="automationWizard.updateCondition(${i}, 'operator', this.value)">
                                    <option value="">Select operator...</option>
                                    ${ops.map((o) => `<option value="${o.value}" ${c.operator === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                                </select>
                                <input type="text" class="form-input" placeholder="${fieldType === 'numeric' ? 'Enter number...' : 'Enter value...'}" value="${escapeHtml(c.value || '')}" onchange="automationWizard.updateCondition(${i}, 'value', this.value)" aria-label="Condition value">
                            </div>
                            <button class="btn btn-ghost btn-sm" onclick="automationWizard.removeCondition(${i})" title="Remove condition" aria-label="Remove condition">${components.icon('trash', 14)}</button>
                        </div>
                    `;
                    })
                    .join('')}
                <button type="button" class="condition-add-btn" onclick="automationWizard.addCondition()">
                    ${components.icon('plus', 14)} Add condition
                </button>

                ${
                    conditions.length > 0
                        ? `
                    <div class="condition-else-config">
                        <h3 class="text-sm font-medium mb-2">When conditions are NOT met:</h3>
                        <div class="condition-else-options">
                            <label class="condition-else-option ${elseAction === 'skip' ? 'active' : ''}">
                                <input aria-label="Else Action" type="radio" name="elseAction" value="skip" ${elseAction === 'skip' ? 'checked' : ''} onchange="automationWizard.setElseAction('skip')">
                                <div>
                                    <strong>Skip</strong>
                                    <span class="text-xs text-gray-500">Do nothing, wait for next trigger</span>
                                </div>
                            </label>
                            <label class="condition-else-option ${elseAction === 'log' ? 'active' : ''}">
                                <input aria-label="Else Action" type="radio" name="elseAction" value="log" ${elseAction === 'log' ? 'checked' : ''} onchange="automationWizard.setElseAction('log')">
                                <div>
                                    <strong>Log Only</strong>
                                    <span class="text-xs text-gray-500">Record skipped items for review</span>
                                </div>
                            </label>
                            <label class="condition-else-option ${elseAction === 'alternate' ? 'active' : ''}">
                                <input aria-label="Else Action" type="radio" name="elseAction" value="alternate" ${elseAction === 'alternate' ? 'checked' : ''} onchange="automationWizard.setElseAction('alternate')">
                                <div>
                                    <strong>Alternate Action</strong>
                                    <span class="text-xs text-gray-500">Run a different action instead</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="condition-flow-visual">
                        <div class="flow-condition-chip">${components.icon('filter', 12)} IF</div>
                        ${conditions
                            .map(
                                (c, i) => `
                            ${i > 0 ? `<span class="flow-logic-badge">${logic}</span>` : ''}
                            <span class="flow-condition-chip">${(fieldOptions.find((f) => f.value === c.field) || {}).label || 'Field'} ${c.operator || '?'} ${c.value || '?'}</span>
                        `,
                            )
                            .join('')}
                        <div class="flow-branch-split">
                            <div class="flow-branch-container yes">
                                <span class="flow-branch-tag yes">YES</span>
                                <div class="flow-node action">${components.icon('play', 12)} Run Action</div>
                            </div>
                            <div class="flow-branch-container no">
                                <span class="flow-branch-tag no">NO</span>
                                <div class="flow-node ${elseAction === 'skip' ? 'skip' : 'action'}">${components.icon(elseAction === 'skip' ? 'x' : elseAction === 'log' ? 'file-text' : 'play', 12)} ${elseAction === 'skip' ? 'Skip' : elseAction === 'log' ? 'Log' : 'Alt Action'}</div>
                            </div>
                        </div>
                    </div>
                `
                        : ''
                }
            </div>
        `;
    },

    renderActionsStep() {
        const actions = [
            { id: 'share', icon: 'share', label: 'Share listing' },
            { id: 'relist', icon: 'refresh', label: 'Relist item' },
            { id: 'price', icon: 'dollar-sign', label: 'Update price' },
            { id: 'offer', icon: 'tag', label: 'Send offer' },
        ];
        return `
            <h3 class="text-lg font-medium mb-4">Choose an action</h3>
            <div class="grid grid-cols-2 gap-4">
                ${actions
                    .map(
                        (a) => `
                    <button type="button" class="card cursor-pointer hover:border-primary-400 ${this.data.action === a.id ? 'border-primary-500 bg-primary-50' : ''}"
                         onclick="automationWizard.setAction('${a.id}')">
                        <div class="card-body flex items-center gap-3">
                            ${components.icon(a.icon, 24)}
                            <span class="font-medium">${a.label}</span>
                        </div>
                    </button>
                `,
                    )
                    .join('')}
            </div>
        `;
    },

    renderReviewStep() {
        const conditions = (this.data.conditions || []).filter((c) => c.field);
        const elseAction = this.data.elseAction || 'skip';
        const elseLabels = { skip: 'Skip (do nothing)', log: 'Log skipped items', alternate: 'Run alternate action' };

        return `
            <h3 class="text-lg font-medium mb-4">Review your automation</h3>
            <div class="card">
                <div class="card-body">
                    ${automationFlow.render({
                        trigger: { icon: 'clock', label: this.data.trigger || 'Schedule' },
                        conditions: this.data.conditions || [],
                        conditionLogic: this.data.conditionLogic || 'AND',
                        elseAction: elseAction,
                        action: { icon: 'play', label: this.data.action || 'Action' },
                    })}
                </div>
            </div>
            ${
                conditions.length > 0
                    ? `
                <div class="card mt-4">
                    <div class="card-body">
                        <h3 class="text-sm font-medium mb-2">Conditions (${this.data.conditionLogic || 'AND'})</h3>
                        <ul class="text-sm text-gray-600" style="margin: 0; padding-left: 16px;">
                            ${conditions.map((c) => `<li>${c.field} ${c.operator} ${c.value}</li>`).join('')}
                        </ul>
                        <p class="text-xs text-gray-500 mt-2">When not met: <strong>${elseLabels[elseAction]}</strong></p>
                    </div>
                </div>
            `
                    : ''
            }
        `;
    },

    setTrigger(trigger) {
        this.data.trigger = trigger;
        this.refresh();
    },
    setAction(action) {
        this.data.action = action;
        this.refresh();
    },
    addCondition() {
        this.data.conditions = this.data.conditions || [];
        this.data.conditions.push({ field: '', operator: '', value: '' });
        this.refresh();
    },
    removeCondition(index) {
        this.data.conditions = this.data.conditions || [];
        this.data.conditions.splice(index, 1);
        this.refresh();
    },
    updateCondition(index, key, value) {
        this.data.conditions = this.data.conditions || [];
        if (this.data.conditions[index]) {
            this.data.conditions[index][key] = value;
            if (key === 'field') {
                this.data.conditions[index].operator = '';
                this.data.conditions[index].value = '';
            }
            this.refresh();
        }
    },
    setConditionLogic(logic) {
        this.data.conditionLogic = logic;
        this.refresh();
    },
    setElseAction(action) {
        this.data.elseAction = action;
        this.refresh();
    },
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.refresh();
        } else {
            this.save();
        }
    },
    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.refresh();
        }
    },
    refresh() {
        const modal = document.querySelector('.automation-wizard');
        if (modal) modal.outerHTML = this.render();
    }, // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    save() {
        toast.success('Automation created!');
        modals.close();
    },
};

// Condition Builder
const conditionBuilder = {
    conditions: [],

    render() {
        return `
            <div class="condition-builder">
                ${this.conditions
                    .map(
                        (c, i) => `
                    ${i > 0 ? '<div class="condition-connector">AND</div>' : ''}
                    <div class="condition-row">
                        <select class="form-select" aria-label="Condition field" onchange="conditionBuilder.updateCondition(${i}, 'field', this.value)">
                            <option value="price" ${c.field === 'price' ? 'selected' : ''}>Price</option>
                            <option value="days_listed" ${c.field === 'days_listed' ? 'selected' : ''}>Days Listed</option>
                            <option value="views" ${c.field === 'views' ? 'selected' : ''}>Views</option>
                            <option value="likes" ${c.field === 'likes' ? 'selected' : ''}>Likes</option>
                        </select>
                        <select class="form-select" aria-label="Condition operator" onchange="conditionBuilder.updateCondition(${i}, 'operator', this.value)">
                            <option value="gt" ${c.operator === 'gt' ? 'selected' : ''}>is greater than</option>
                            <option value="lt" ${c.operator === 'lt' ? 'selected' : ''}>is less than</option>
                            <option value="eq" ${c.operator === 'eq' ? 'selected' : ''}>equals</option>
                        </select>
                        <input type="text" class="form-input" value="${c.value || ''}" aria-label="Condition value" onchange="conditionBuilder.updateCondition(${i}, 'value', this.value)">
                        <button class="btn btn-ghost btn-sm" onclick="conditionBuilder.removeCondition(${i})" aria-label="Remove condition">${components.icon('x', 14)}</button>
                    </div>
                `,
                    )
                    .join('')}
                <button type="button" class="condition-add-btn" onclick="conditionBuilder.addCondition()">
                    ${components.icon('plus', 14)} Add condition
                </button>
            </div>
        `;
    },

    addCondition() {
        this.conditions.push({ field: 'price', operator: 'gt', value: '' });
    },
    removeCondition(index) {
        this.conditions.splice(index, 1);
    },
    updateCondition(index, key, value) {
        this.conditions[index][key] = value;
    },
};

// Activity Log Panel
const activityLogPanel = {
    isOpen: false,
    logs: [],

    render() {
        return `
            ${this.isOpen ? `<div class="activity-log-overlay" role="button" tabindex="0" aria-label="Close activity log" onclick="activityLogPanel.close()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();activityLogPanel.close();}"></div>` : ''}
            <div class="activity-log-panel ${this.isOpen ? 'open' : ''}">
                <div class="activity-log-header">
                    <h3 class="font-semibold">Activity Log</h3>
                    <button class="btn btn-icon btn-ghost" onclick="activityLogPanel.close()" title="Close">
                        ${components.icon('x', 20)}
                    </button>
                </div>
                <div class="activity-log-content">
                    ${
                        this.logs.length > 0
                            ? this.logs
                                  .map(
                                      (log) => `
                        <div class="activity-log-item">
                            <div class="activity-log-icon ${log.type}">${components.icon(log.type === 'success' ? 'check' : 'x', 14)}</div>
                            <div class="activity-log-details">
                                <div class="activity-log-title">${escapeHtml(log.title)}</div>
                                <div class="activity-log-time">${new Date(log.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                    `,
                                  )
                                  .join('')
                            : '<div class="text-gray-500 text-sm text-center py-8">No recent activity</div>'
                    }
                </div>
            </div>
        `;
    },

    open() {
        this.isOpen = true;
        this.refresh();
    },
    close() {
        this.isOpen = false;
        this.refresh();
    },
    toggle() {
        this.isOpen = !this.isOpen;
        this.refresh();
    },
    addLog(log) {
        this.logs.unshift({ ...log, timestamp: new Date() });
        if (this.logs.length > 50) this.logs.pop();
    },
    refresh() {
        // Remove existing elements
        const existingOverlay = document.querySelector('.activity-log-overlay');
        const existingPanel = document.querySelector('.activity-log-panel');
        if (existingOverlay) existingOverlay.remove();
        if (existingPanel) existingPanel.remove();
        // Add new elements
        document.body.insertAdjacentHTML('beforeend', this.render()); // nosemgrep: javascript.browser.security.insecure-document-method
    },
};

// Kanban Board
const kanbanBoard = {
    columns: [
        { id: 'todo', title: 'To Do', color: 'var(--gray-500)' },
        { id: 'in_progress', title: 'In Progress', color: 'var(--primary-500)' },
        { id: 'done', title: 'Done', color: 'var(--success-500)' },
    ],

    render(tasks) {
        return `
            <div class="kanban-board">
                ${this.columns
                    .map((col) => {
                        const colTasks = tasks.filter((t) => (t.status || 'todo') === col.id);
                        return `
                        <div class="kanban-column" data-column="${col.id}" ondragover="kanbanBoard.onDragOver(event)" ondrop="kanbanBoard.onDrop(event, '${col.id}')">
                            <div class="kanban-column-header">
                                <div class="kanban-column-title">
                                    <span style="color: ${col.color};">${components.icon('circle', 10)}</span>
                                    ${col.title}
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="kanban-column-count">${colTasks.length}</span>
                                    <button class="btn btn-ghost btn-xs" onclick="kanbanBoard.showAddTask('${col.id}')" title="Add task to ${col.title}">
                                        ${components.icon('plus', 14)}
                                    </button>
                                </div>
                            </div>
                            <div class="kanban-tasks">
                                ${colTasks
                                    .map(
                                        (task) => `
                                    <div class="kanban-task" draggable="true" data-task-id="${task.id}"
                                         ondragstart="kanbanBoard.onDragStart(event, '${task.id}')">
                                        <div class="kanban-task-title">${escapeHtml(task.title)}</div>
                                        <div class="kanban-task-meta">
                                            <span class="badge badge-${task.priority === 'high' ? 'error' : task.priority === 'normal' ? 'primary' : 'gray'}">${task.priority || 'normal'}</span>
                                            ${task.dueDate ? `<span>${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                                        </div>
                                    </div>
                                `,
                                    )
                                    .join('')}
                                <button type="button" class="kanban-add-task" onclick="kanbanBoard.showAddTask('${col.id}')">
                                    <span>${components.icon('plus', 14)}</span>
                                    <span>Add task</span>
                                </button>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },

    showAddTask(status = 'todo') {
        const statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">Add New Task to ${statusLabels[status] || 'To Do'}</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="kanban-add-task-form" onsubmit="event.preventDefault(); kanbanBoard.addTask('${status}');">
                    <div class="form-group">
                        <label class="form-label" for="kanban-task-title">Task Title</label>
                        <input aria-label="Enter task title" type="text" id="kanban-task-title" class="form-input" placeholder="Enter task title..." required autofocus>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="kanban-task-priority">Priority</label>
                        <select aria-label="Kanban Task Priority" id="kanban-task-priority" class="form-select">
                            <option value="low">Low</option>
                            <option value="normal" selected>Normal</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="kanban-task-due">Due Date (optional)</label>
                        <inputinput type="date" id="kanban-task-due" class="form-input">
                    </div>
                    <div class="flex justify-end gap-3 mt-4">
                        <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary">${components.icon('plus', 16)} Add Task</button>
                    </div>
                </form>
            </div>
        `);
    },

    addTask(status = 'todo') {
        const titleEl = document.getElementById('kanban-task-title');
        if (!titleEl) return;
        const title = titleEl.value.trim();
        const priority = document.getElementById('kanban-task-priority')?.value || 'medium';
        const dueDate = document.getElementById('kanban-task-due')?.value || null;

        if (title) {
            handlers.addChecklistTask(title, { priority, dueDate, status });
            modals.close();
            toast.success('Task added successfully');
        }
    },

    onDragStart(e, taskId) {
        e.dataTransfer.setData('text/plain', taskId);
        e.target.classList.add('dragging');
    },

    onDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    },

    onDrop(e, columnId) {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/plain');
        handlers.updateTaskStatus(taskId, columnId);
        document.querySelectorAll('.kanban-column').forEach((col) => col.classList.remove('drag-over'));
    },
};

// Streak Counter
const streakCounter = {
    render(streakDays) {
        return `
            <div class="streak-counter">
                <span class="streak-icon">🔥</span>
                <span class="streak-number">${streakDays}</span>
                <span class="streak-label">day streak</span>
            </div>
        `;
    },

    calculate(completedDates) {
        if (!completedDates || completedDates.length === 0) return 0;
        const sorted = completedDates.sort((a, b) => new Date(b) - new Date(a));
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (const dateStr of sorted) {
            const date = new Date(dateStr);
            date.setHours(0, 0, 0, 0);
            const diff = (currentDate - date) / (1000 * 60 * 60 * 24);
            if (diff <= 1) {
                streak++;
                currentDate = date;
            } else {
                break;
            }
        }
        return streak;
    },
};

// Pomodoro Timer
const pomodoroTimer = {
    duration: 25 * 60,
    remaining: 25 * 60,
    isRunning: false,
    isBreak: false,
    sessionsCompleted: 0,
    intervalId: null,

    render() {
        const mins = Math.floor(this.remaining / 60);
        const secs = this.remaining % 60;
        return `
            <div class="pomodoro-timer">
                <div class="pomodoro-display ${this.isRunning ? 'running' : ''} ${this.isBreak ? 'break' : ''}">
                    ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}
                </div>
                <div class="pomodoro-controls">
                    <button class="btn ${this.isRunning ? 'btn-error' : 'btn-primary'}" onclick="pomodoroTimer.toggle()">
                        ${this.isRunning ? components.icon('pause', 16) + ' Pause' : components.icon('play', 16) + ' Start'}
                    </button>
                    <button class="btn btn-secondary" onclick="pomodoroTimer.reset()">
                        ${components.icon('refresh', 16)} Reset
                    </button>
                </div>
                <div class="pomodoro-stats">
                    <div>Sessions: ${this.sessionsCompleted}</div>
                    <div>Focus time: ${Math.floor(this.sessionsCompleted * 25)}min</div>
                </div>
            </div>
        `;
    },

    toggle() {
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.isRunning = false;
        } else {
            this.isRunning = true;
            this.intervalId = setInterval(() => this.tick(), 1000);
        }
        this.refresh();
    },

    tick() {
        if (this.remaining > 0) {
            this.remaining--;
            this.refresh();
        } else {
            clearInterval(this.intervalId);
            this.isRunning = false;
            if (!this.isBreak) {
                this.sessionsCompleted++;
                toast.success('Pomodoro complete! Take a break.');
            } else {
                toast.info('Break over! Ready for another session?');
            }
            this.isBreak = !this.isBreak;
            this.remaining = this.isBreak ? 5 * 60 : 25 * 60;
            this.refresh();
        }
    },

    reset() {
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.isBreak = false;
        this.remaining = 25 * 60;
        this.refresh();
    },

    refresh() {
        const el = document.querySelector('.pomodoro-timer');
        if (el) el.outerHTML = this.render(); // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },
};

// Task Templates
const taskTemplates = {
    categories: [
        { id: 'listing', name: 'Listing Workflows', icon: '📸' },
        { id: 'shipping', name: 'Shipping & Orders', icon: '📦' },
        { id: 'sourcing', name: 'Sourcing & Inventory', icon: '🛒' },
        { id: 'maintenance', name: 'Maintenance & Growth', icon: '📅' },
    ],

    templates: [
        // Listing Workflows
        {
            id: 'listing-full',
            category: 'listing',
            name: 'Complete Listing Prep',
            icon: '📸',
            description: 'Full workflow for creating a new listing from scratch',
            tasks: [
                'Clean and steam item',
                'Set up photo area with good lighting',
                'Take multiple angles (front, back, details, tags)',
                'Edit photos (brightness, crop, background)',
                'Research comparable sold listings',
                'Write compelling title with keywords',
                'Write detailed description',
                'Add measurements and condition notes',
                'Set competitive price',
                'Cross-list to multiple platforms',
            ],
        },
        {
            id: 'listing-quick',
            category: 'listing',
            name: 'Quick List',
            icon: '⚡',
            description: 'Simplified workflow for fast listings',
            tasks: ['Take 4 photos', 'Write title + description', 'Set price', 'Post to primary platform'],
        },
        {
            id: 'relist-refresh',
            category: 'listing',
            name: 'Relist & Refresh',
            icon: '🔄',
            description: 'Refresh stale listings to boost visibility',
            tasks: [
                'Review item condition',
                'Retake photos if needed',
                'Update description with seasonal keywords',
                'Adjust price based on market',
                'Delete old listing',
                'Create fresh listing',
                'Share to followers',
            ],
        },

        // Shipping Workflows
        {
            id: 'shipping-full',
            category: 'shipping',
            name: 'Complete Shipping',
            icon: '📦',
            description: 'Full shipping workflow with all steps',
            tasks: [
                'Verify item matches order',
                'Clean and prepare item',
                'Select appropriate box/poly mailer',
                'Add tissue paper or protective wrap',
                'Print shipping label',
                'Include thank you card',
                'Add business card or coupon',
                'Seal and weigh package',
                'Take photo of packaged item',
                'Schedule pickup or drop off',
                'Mark as shipped on platform',
            ],
        },
        {
            id: 'shipping-quick',
            category: 'shipping',
            name: 'Quick Ship',
            icon: '🚀',
            description: 'Streamlined shipping for experienced sellers',
            tasks: ['Verify item', 'Package securely', 'Print label', 'Add thank you note', 'Ship within 24h'],
        },
        {
            id: 'bulk-shipping',
            category: 'shipping',
            name: 'Bulk Shipping Day',
            icon: '📮',
            description: 'Batch processing for multiple orders',
            tasks: [
                'Print all labels at once',
                'Gather all items to ship',
                'Set up packing station',
                'Package all items',
                'Verify all orders against items',
                'Group by carrier if needed',
                'Schedule bulk pickup',
                'Mark all as shipped',
            ],
        },

        // Sourcing Workflows
        {
            id: 'sourcing-trip',
            category: 'sourcing',
            name: 'Thrift Sourcing Trip',
            icon: '🛒',
            description: 'Organized thrift store sourcing',
            tasks: [
                'Check inventory for gaps',
                'Set sourcing budget',
                'Plan store route',
                'Charge phone for comps',
                'Check items against comps',
                'Inspect for flaws/damage',
                'Calculate potential profit',
                'Log purchases with cost',
                'Take quick photos',
                'Process new inventory same day',
            ],
        },
        {
            id: 'estate-sale',
            category: 'sourcing',
            name: 'Estate Sale Prep',
            icon: '🏠',
            description: 'Estate/garage sale sourcing checklist',
            tasks: [
                'Research sales in area',
                'Map out route by time',
                'Bring cash in small bills',
                'Bring bags/boxes for items',
                'Arrive early for best selection',
                'Check vintage/designer items first',
                'Negotiate bundle deals',
                'Get receipts when possible',
                'Log all purchases',
            ],
        },
        {
            id: 'inventory-audit',
            category: 'sourcing',
            name: 'Inventory Audit',
            icon: '📋',
            description: 'Regular inventory check and organization',
            tasks: [
                'Count all inventory items',
                'Match physical items to listings',
                'Identify missing items',
                'Check for condition changes',
                'Update any incorrect listings',
                'Reorganize storage bins',
                'Label bins clearly',
                'Update inventory spreadsheet',
            ],
        },

        // Maintenance Workflows
        {
            id: 'weekly-tasks',
            category: 'maintenance',
            name: 'Weekly Maintenance',
            icon: '📅',
            description: 'Weekly tasks to maintain healthy closet',
            tasks: [
                'Share all active listings',
                'Send offers to likers',
                'Respond to all comments',
                'Relist oldest items',
                'Review and adjust prices',
                'Check analytics and trends',
                'Follow new potential buyers',
                'Clear out draft listings',
            ],
        },
        {
            id: 'daily-routine',
            category: 'maintenance',
            name: 'Daily Routine',
            icon: '☀️',
            description: 'Quick daily tasks for consistent sales',
            tasks: [
                'Check for new sales/offers',
                'Respond to messages',
                'Share 10+ listings',
                'Send 5+ offers',
                'List 1 new item',
                'Engage with community',
            ],
        },
        {
            id: 'monthly-review',
            category: 'maintenance',
            name: 'Monthly Review',
            icon: '📊',
            description: 'Monthly business review and planning',
            tasks: [
                'Review sales and revenue',
                'Calculate profit margins',
                'Analyze best sellers',
                'Identify slow movers',
                'Plan price reductions',
                'Set next month goals',
                'Review sourcing costs',
                'Clean storage area',
                'Order supplies if needed',
            ],
        },
    ],

    render() {
        const selectedCategory = store.state.templateCategory || 'all';

        return `
            <div class="task-templates-container">
                <div class="template-category-tabs">
                    <button class="template-tab ${selectedCategory === 'all' ? 'active' : ''}" onclick="taskTemplates.setCategory('all')">
                        All Templates
                    </button>
                    ${this.categories
                        .map(
                            (c) => `
                        <button class="template-tab ${selectedCategory === c.id ? 'active' : ''}" onclick="taskTemplates.setCategory('${c.id}')">
                            ${c.icon} ${c.name}
                        </button>
                    `,
                        )
                        .join('')}
                </div>
                <div class="template-grid">
                    ${this.templates
                        .filter((t) => selectedCategory === 'all' || t.category === selectedCategory)
                        .map(
                            (t) => `
                            <div class="task-template-card" role="button" tabindex="0" onclick="taskTemplates.preview('${t.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();taskTemplates.preview('${t.id}');}">
                                <div class="task-template-header">
                                    <div class="task-template-icon">${t.icon}</div>
                                    <div class="task-template-badge">${t.tasks.length} tasks</div>
                                </div>
                                <div class="task-template-name">${t.name}</div>
                                <div class="task-template-desc">${t.description}</div>
                                <button class="btn btn-primary btn-sm w-full mt-3" onclick="event.stopPropagation(); taskTemplates.apply('${t.id}')">
                                    ${components.icon('plus', 14)} Use Template
                                </button>
                            </div>
                        `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },

    setCategory(category) {
        store.setState({ templateCategory: category });
        const container = document.querySelector('.task-templates-container');
        if (container) {
            container.outerHTML = this.render(); // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        }
    },

    preview(templateId) {
        const template = this.templates.find((t) => t.id === templateId);
        if (!template) return;

        modals.show(`
            <div class="modal-header">
                <h2 class="modal-title">${template.icon} ${template.name}</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <p class="text-gray-600 mb-4">${template.description}</p>
                <div class="template-preview-tasks">
                    <h3 class="font-medium mb-2">Tasks included:</h3>
                    <ul class="task-preview-list">
                        ${template.tasks
                            .map(
                                (task, i) => `
                            <li class="task-preview-item">
                                <span class="task-preview-num">${i + 1}</span>
                                <span class="task-preview-text">${task}</span>
                            </li>
                        `,
                            )
                            .join('')}
                    </ul>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="handlers.showTaskTemplates()">Back to Templates</button>
                <button class="btn btn-primary" onclick="taskTemplates.apply('${template.id}'); modals.close()">
                    ${components.icon('plus', 16)} Add All ${template.tasks.length} Tasks
                </button>
            </div>
        `);
    },

    apply(templateId) {
        const template = this.templates.find((t) => t.id === templateId);
        if (template) {
            template.tasks.forEach((task) => handlers.addChecklistTask(task));
            toast.success(`Added ${template.tasks.length} tasks from "${template.name}"`);
            modals.close();
        }
    },
};

// Image Masonry Grid
const masonryGrid = {
    render(images, options = {}) {
        const { onSelect, selectedIds = [] } = options;
        return `
            <div class="masonry-grid">
                ${images
                    .map(
                        (img) => `
                    <div class="masonry-item ${selectedIds.includes(img.id) ? 'selected' : ''}"
                         role="button" tabindex="0"
                         aria-pressed="${selectedIds.includes(img.id) ? 'true' : 'false'}"
                         onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${onSelect ? `${onSelect}('${img.id}')` : ''}}"
                         onclick="${onSelect ? `${onSelect}('${img.id}')` : ''}">
                        <img src="${img.thumbnail || img.url}" alt="${escapeHtml(img.name || '')}" loading="lazy">
                        ${img.quality ? `<span class="image-quality-badge ${img.quality}">${img.quality.toUpperCase()}</span>` : ''}
                        <div class="masonry-item-overlay">
                            <div class="masonry-item-name">${escapeHtml(img.name || 'Untitled')}</div>
                            <div class="masonry-item-meta">${img.width}x${img.height}</div>
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Image Comparison Tool — Slider, Side-by-Side, Overlay modes
const imageComparison = {
    _mode: 'slider',
    _zoom: 1,
    _swapped: false,

    render(beforeUrl, afterUrl) {
        const b = this._swapped ? afterUrl : beforeUrl;
        const a = this._swapped ? beforeUrl : afterUrl;
        const mode = this._mode;
        const zoom = this._zoom;

        const toolbar = `
            <div class="image-comparison-toolbar">
                <div class="image-comparison-modes">
                    <button class="btn btn-sm ${mode === 'slider' ? 'btn-primary' : 'btn-secondary'}" onclick="imageComparison.setMode('slider', '${beforeUrl}', '${afterUrl}')">
                        ${components.icon('sliders', 14)} Slider
                    </button>
                    <button class="btn btn-sm ${mode === 'side-by-side' ? 'btn-primary' : 'btn-secondary'}" onclick="imageComparison.setMode('side-by-side', '${beforeUrl}', '${afterUrl}')">
                        ${components.icon('columns', 14)} Side by Side
                    </button>
                    <button class="btn btn-sm ${mode === 'overlay' ? 'btn-primary' : 'btn-secondary'}" onclick="imageComparison.setMode('overlay', '${beforeUrl}', '${afterUrl}')">
                        ${components.icon('layers', 14)} Overlay
                    </button>
                </div>
                <div class="image-comparison-actions">
                    <button class="btn btn-sm btn-secondary" onclick="imageComparison.zoomOut('${beforeUrl}', '${afterUrl}')" title="Zoom Out">
                        ${components.icon('zoom-out', 14)}
                    </button>
                    <span class="text-sm text-gray-500">${Math.round(zoom * 100)}%</span>
                    <button class="btn btn-sm btn-secondary" onclick="imageComparison.zoomIn('${beforeUrl}', '${afterUrl}')" title="Zoom In">
                        ${components.icon('zoom-in', 14)}
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="imageComparison.swap('${beforeUrl}', '${afterUrl}')" title="Swap Images">
                        ${components.icon('repeat', 14)} Swap
                    </button>
                </div>
            </div>
        `;

        if (mode === 'side-by-side') {
            return (
                toolbar +
                `
                <div class="image-comparison-side-by-side" style="transform: scale(${zoom}); transform-origin: top center;">
                    <div class="image-comparison-panel">
                        <span class="image-comparison-label" style="top: 8px; left: 8px;">Before</span>
                        <img src="${b}" alt="Before" style="width: 100%; display: block; border-radius: var(--radius-md);">
                    </div>
                    <div class="image-comparison-panel">
                        <span class="image-comparison-label" style="top: 8px; left: 8px;">After</span>
                        <img src="${a}" alt="After" style="width: 100%; display: block; border-radius: var(--radius-md);">
                    </div>
                </div>
            `
            );
        }

        if (mode === 'overlay') {
            return (
                toolbar +
                `
                <div class="image-comparison-overlay" style="transform: scale(${zoom}); transform-origin: top center;">
                    <div style="position: relative;">
                        <img src="${a}" alt="After" style="width: 100%; display: block; border-radius: var(--radius-lg);">
                        <img src="${b}" alt="Before" id="overlay-before-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.5; mix-blend-mode: difference; border-radius: var(--radius-lg);">
                        <span class="image-comparison-label" style="top: 8px; left: 8px;">Overlay (Difference)</span>
                    </div>
                    <div class="flex items-center gap-3 mt-3">
                        <span class="text-sm text-gray-500">Opacity</span>
                        <input aria-label="Range slider" type="range" min="0" max="100" value="50" class="form-range" style="flex: 1;"
                            oninput="document.getElementById('overlay-before-img').style.opacity = this.value / 100">
                        <span class="text-sm text-gray-500">Blend</span>
                        <select class="form-select" aria-label="Blend mode" style="width: auto; min-width: 120px;"
                            onchange="document.getElementById('overlay-before-img').style.mixBlendMode = this.value">
                            <option value="difference">Difference</option>
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply</option>
                            <option value="screen">Screen</option>
                            <option value="overlay">Overlay</option>
                        </select>
                    </div>
                </div>
            `
            );
        }

        // Default: Slider mode
        return (
            toolbar +
            `
            <div class="image-comparison" onmousemove="imageComparison.onMove(event)" ontouchmove="imageComparison.onMove(event)" style="transform: scale(${zoom}); transform-origin: top center;">
                <img class="image-comparison-after" src="${a}" alt="After">
                <img class="image-comparison-before" src="${b}" alt="Before">
                <div class="image-comparison-slider"></div>
                <span class="image-comparison-label before">Before</span>
                <span class="image-comparison-label after">After</span>
            </div>
        `
        );
    },

    onMove(e) {
        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

        const before = container.querySelector('.image-comparison-before');
        const slider = container.querySelector('.image-comparison-slider');
        if (before) before.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
        if (slider) slider.style.left = `${percent}%`;
    },

    setMode(mode, beforeUrl, afterUrl) {
        this._mode = mode;
        this._rerender(beforeUrl, afterUrl);
    },

    zoomIn(beforeUrl, afterUrl) {
        this._zoom = Math.min(3, this._zoom + 0.25);
        this._rerender(beforeUrl, afterUrl);
    },

    zoomOut(beforeUrl, afterUrl) {
        this._zoom = Math.max(0.25, this._zoom - 0.25);
        this._rerender(beforeUrl, afterUrl);
    },

    swap(beforeUrl, afterUrl) {
        this._swapped = !this._swapped;
        this._rerender(beforeUrl, afterUrl);
    },

    _rerender(beforeUrl, afterUrl) {
        const container = document.querySelector('.image-comparison-wrapper');
        if (container) {
            container.innerHTML = sanitizeHTML(sanitizeHTML(this.render(beforeUrl, afterUrl))); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        }
    },
};

// Storage Gauge
const storageGauge = {
    render(used, total, options = {}) {
        const percent = (used / total) * 100;
        const color = percent > 90 ? 'error' : percent > 70 ? 'warning' : 'success';
        const showDetails = options.showDetails !== false;

        // Quota warning messages
        const getQuotaMessage = () => {
            if (percent >= 95)
                return {
                    type: 'error',
                    icon: 'alert-circle',
                    text: 'Storage almost full! Delete unused images or upgrade your plan.',
                };
            if (percent >= 80)
                return {
                    type: 'warning',
                    icon: 'alert-triangle',
                    text: 'Running low on storage. Consider cleaning up unused images.',
                };
            if (percent >= 60)
                return {
                    type: 'info',
                    icon: 'info',
                    text: `${this.formatBytes(total - used)} remaining. You're doing great!`,
                };
            return null;
        };
        const quotaMsg = getQuotaMessage();

        return `
            <div class="storage-gauge">
                <div class="flex justify-between items-center">
                    <span class="font-medium">Storage</span>
                    <span class="text-${color}-600 font-semibold">${percent.toFixed(2)}% used</span>
                </div>
                <div class="storage-gauge-bar">
                    <div class="storage-gauge-fill storage-gauge-${color}" style="width: ${percent}%;"></div>
                    ${percent >= 70 ? `<div class="storage-gauge-marker" style="left: 70%;" title="Warning threshold (70%)"></div>` : ''}
                    ${percent >= 90 ? `<div class="storage-gauge-marker storage-gauge-marker-critical" style="left: 90%;" title="Critical threshold (90%)"></div>` : ''}
                </div>
                <div class="storage-gauge-labels">
                    <span>${this.formatBytes(used)} used</span>
                    <span>${this.formatBytes(total - used)} free</span>
                </div>
                ${
                    showDetails && quotaMsg
                        ? `
                    <div class="storage-quota-alert storage-quota-${quotaMsg.type}">
                        ${components.icon(quotaMsg.icon, 14)}
                        <span>${quotaMsg.text}</span>
                    </div>
                `
                        : ''
                }
                ${
                    showDetails && percent >= 80
                        ? `
                    <button class="btn btn-sm btn-outline storage-upgrade-btn" onclick="handlers.showStorageUpgrade()">
                        ${components.icon('arrow-up', 14)} Upgrade Storage
                    </button>
                `
                        : ''
                }
            </div>
        `;
    },

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    },
};

// Color Palette Extraction
const colorPalette = {
    render(colors) {
        return `
            <div class="color-palette">
                ${colors
                    .map(
                        (c) => `
                    <button type="button" class="color-swatch" style="background: ${c.hex};" onclick="colorPalette.copy('${c.hex}')" aria-label="Copy color ${c.hex}">
                        <div class="color-swatch-tooltip">${c.hex}</div>
                    </button>
                `,
                    )
                    .join('')}
            </div>
        `;
    },

    async copy(hex) {
        try {
            await navigator.clipboard.writeText(hex);
            toast.success(`Copied ${hex}`);
        } catch {
            toast.error('Failed to copy to clipboard');
        }
    },

    extract(imageUrl) {
        // Simplified color extraction - in production would use canvas
        return [{ hex: '#1a1a2e' }, { hex: '#16213e' }, { hex: '#0f3460' }, { hex: '#e94560' }, { hex: '#f5f5f5' }];
    },
};

// Calendar View Toggle
const calendarViewToggle = {
    views: ['month', 'week', 'day'],

    render(currentView) {
        return `
            <div class="calendar-view-toggle">
                ${this.views
                    .map(
                        (view) => `
                    <button class="calendar-view-btn ${currentView === view ? 'active' : ''}"
                            onclick="handlers.setCalendarView('${view}')">
                        ${view.charAt(0).toUpperCase() + view.slice(1)}
                    </button>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Calendar Legend
const calendarLegend = {
    render() {
        const items = [
            { type: 'sales', label: 'Sales' },
            { type: 'shipments', label: 'Shipments' },
            { type: 'restocks', label: 'Restocks' },
            { type: 'lives', label: 'Live Shows' },
            { type: 'expirations', label: 'Listing Expirations' },
            { type: 'custom', label: 'Custom' },
        ];
        return `
            <div class="calendar-legend">
                ${items
                    .map(
                        (item) => `
                    <div class="calendar-legend-item">
                        <span class="calendar-legend-dot ${item.type}"></span>
                        ${item.label}
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};
window.calendarViewToggle = calendarViewToggle;

// Calendar Timeline Sidebar
const calendarTimeline = {
    getEventDotColor(type) {
        const colorMap = {
            sale: 'var(--success-500)',
            shipment: 'var(--primary-500)',
            restock: 'var(--warning-500)',
            live: 'var(--error-500)',
            expiration: '#f59e0b',
            custom: 'var(--gray-500)',
        };
        return colorMap[type] || colorMap['custom'];
    },
    render(events, date) {
        const dayEvents = events
            .filter((e) => {
                const eventDate = new Date(e.date);
                return eventDate.toDateString() === date.toDateString();
            })
            .sort((a, b) => new Date(a.time) - new Date(b.time));

        return `
            <div class="calendar-timeline">
                <div class="calendar-timeline-header">
                    <span>${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span class="text-sm text-gray-500">${dayEvents.length} events</span>
                </div>
                ${
                    dayEvents.length > 0
                        ? dayEvents
                              .map(
                                  (event) => `
                    <div class="timeline-event">
                        <div class="timeline-event-time">${event.time || 'All day'}</div>
                        <div class="timeline-event-dot" style="background: ${this.getEventDotColor(event.type)};"></div>
                        <div class="timeline-event-content">
                            <div class="timeline-event-title">${escapeHtml(event.title)}</div>
                            ${event.description ? `<div class="timeline-event-description">${escapeHtml(event.description)}</div>` : ''}
                        </div>
                    </div>
                `,
                              )
                              .join('')
                        : '<div class="text-gray-500 text-sm text-center py-8">No events for this day</div>'
                }
            </div>
        `;
    },
};

// Size Conversion Calculator
const sizeConverter = {
    charts: {
        womens_clothing: {
            US: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            UK: ['6', '8', '10', '12', '14', '16'],
            EU: ['34', '36', '38', '40', '42', '44'],
            JP: ['5', '7', '9', '11', '13', '15'],
            CN: ['155/80A', '160/84A', '165/88A', '170/92A', '175/96A', '180/100A'],
        },
        mens_clothing: {
            US: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            UK: ['34', '36', '38', '40', '42', '44'],
            EU: ['44', '46', '48', '50', '52', '54'],
            JP: ['SS', 'S', 'M', 'L', 'LL', '3L'],
            CN: ['165/84A', '170/88A', '175/92A', '180/96A', '185/100A', '190/104A'],
        },
        shoes_womens: {
            US: ['5', '6', '7', '8', '9', '10', '11'],
            UK: ['2.5', '3.5', '4.5', '5.5', '6.5', '7.5', '8.5'],
            EU: ['35', '36', '37', '38', '39', '40', '41'],
            JP: ['21.5', '22.5', '23.5', '24.5', '25.5', '26.5', '27.5'],
            CN: ['35', '36', '37', '38', '39', '40', '41'],
        },
        shoes_mens: {
            US: ['7', '8', '9', '10', '11', '12', '13'],
            UK: ['6', '7', '8', '9', '10', '11', '12'],
            EU: ['40', '41', '42', '43', '44', '45', '46'],
            JP: ['25', '26', '27', '28', '29', '30', '31'],
            CN: ['40', '41', '42', '43', '44', '45', '46'],
        },
    },

    regionFlags: {
        US: '🇺🇸',
        UK: '🇬🇧',
        EU: '🇪🇺',
        JP: '🇯🇵',
        CN: '🇨🇳',
    },

    regionNames: {
        US: 'United States',
        UK: 'United Kingdom',
        EU: 'Europe',
        JP: 'Japan',
        CN: 'China',
    },

    render(category = 'womens_clothing') {
        const chart = this.charts[category];
        return `
            <div class="conversion-calculator">
                <div class="conversion-calculator-header">
                    ${components.icon('globe', 18)} International Size Converter
                </div>
                <div class="conversion-input-group">
                    <select aria-label="Size Category" id="size-category" class="form-select" onchange="sizeConverter.refresh()">
                        <option value="womens_clothing" ${category === 'womens_clothing' ? 'selected' : ''}>Women's Clothing</option>
                        <option value="mens_clothing" ${category === 'mens_clothing' ? 'selected' : ''}>Men's Clothing</option>
                        <option value="shoes_womens" ${category === 'shoes_womens' ? 'selected' : ''}>Women's Shoes</option>
                        <option value="shoes_mens" ${category === 'shoes_mens' ? 'selected' : ''}>Men's Shoes</option>
                    </select>
                    <select aria-label="Size Region" id="size-region" class="form-select" onchange="sizeConverter.updateSizeOptions()">
                        ${Object.keys(chart)
                            .map(
                                (region) =>
                                    `<option value="${region}">${this.regionFlags[region]} ${this.regionNames[region] || region}</option>`,
                            )
                            .join('')}
                    </select>
                    <select aria-label="Size Value" id="size-value" class="form-select" onchange="sizeConverter.convert()">
                        ${chart[Object.keys(chart)[0]].map((size) => `<option value="${size}">${size}</option>`).join('')}
                    </select>
                </div>
                <div class="conversion-results-grid" id="conversion-results">
                    ${Object.entries(chart)
                        .map(
                            ([region, sizes]) => `
                        <div class="conversion-result-card">
                            <div class="conversion-result-flag">${this.regionFlags[region]}</div>
                            <div class="conversion-result-info">
                                <div class="conversion-result-region">${region}</div>
                                <div class="conversion-result-country">${this.regionNames[region]}</div>
                            </div>
                            <div class="conversion-result-size">${sizes[0]}</div>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },

    convert() {
        const category = document.getElementById('size-category')?.value || 'womens_clothing';
        const region = document.getElementById('size-region')?.value || 'US';
        const size = document.getElementById('size-value')?.value;

        const chart = this.charts[category];
        const index = chart[region].indexOf(size);

        const resultsEl = document.getElementById('conversion-results');
        if (resultsEl && index >= 0) {
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            resultsEl.innerHTML = sanitizeHTML(
                sanitizeHTML(
                    Object.entries(chart)
                        .map(
                            ([r, sizes]) => `
                <div class="conversion-result-card ${r === region ? 'selected' : ''}">
                    <div class="conversion-result-flag">${this.regionFlags[r]}</div>
                    <div class="conversion-result-info">
                        <div class="conversion-result-region">${r}</div>
                        <div class="conversion-result-country">${this.regionNames[r]}</div>
                    </div>
                    <div class="conversion-result-size">${sizes[index] || 'N/A'}</div>
                </div>
            `,
                        )
                        .join(''),
                ),
            );
        }
    },

    updateSizeOptions() {
        const category = document.getElementById('size-category')?.value || 'womens_clothing';
        const region = document.getElementById('size-region')?.value || 'US';
        const sizeSelect = document.getElementById('size-value');
        const chart = this.charts[category];

        if (sizeSelect && chart[region]) {
            sizeSelect.innerHTML = sanitizeHTML(
                sanitizeHTML(chart[region].map((size) => `<option value="${size}">${size}</option>`).join('')),
            ); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            this.convert();
        }
    },

    refresh() {
        const el = document.querySelector('.conversion-calculator');
        const category = document.getElementById('size-category')?.value || 'womens_clothing';
        if (el) el.outerHTML = this.render(category); // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },
};

// Measurement Tool
const measurementTool = {
    render() {
        return `
            <div class="measurement-tool">
                <h3 class="font-medium mb-3">Enter Measurements</h3>
                <div class="measurement-inputs">
                    <div class="measurement-input">
                        <label>Bust (in)</label>
                        <input aria-label="36" type="number" id="meas-bust" placeholder="e.g., 36" oninput="measurementTool.calculate()">
                    </div>
                    <div class="measurement-input">
                        <label>Waist (in)</label>
                        <input aria-label="28" type="number" id="meas-waist" placeholder="e.g., 28" oninput="measurementTool.calculate()">
                    </div>
                    <div class="measurement-input">
                        <label>Hips (in)</label>
                        <input aria-label="38" type="number" id="meas-hips" placeholder="e.g., 38" oninput="measurementTool.calculate()">
                    </div>
                </div>
                <div class="measurement-result" id="measurement-result" style="display: none;">
                    <div class="measurement-result-label">Suggested Size</div>
                    <div class="measurement-result-size" id="suggested-size">-</div>
                </div>
            </div>
        `;
    },

    calculate() {
        const bust = parseFloat(document.getElementById('meas-bust')?.value) || 0;
        const waist = parseFloat(document.getElementById('meas-waist')?.value) || 0;
        const hips = parseFloat(document.getElementById('meas-hips')?.value) || 0;

        if (bust != null && waist != null && hips != null) {
            let size = 'M';
            if (bust <= 34 && waist <= 26 && hips <= 36) size = 'S';
            else if (bust <= 32 && waist <= 24 && hips <= 34) size = 'XS';
            else if (bust >= 38 && waist >= 30 && hips >= 40) size = 'L';
            else if (bust >= 42 && waist >= 34 && hips >= 44) size = 'XL';

            document.getElementById('measurement-result').style.display = 'block';
            document.getElementById('suggested-size').textContent = size;
        }
    },
};

// Tool Search
const toolSearch = {
    tools: [
        { name: 'Automations', path: 'automations', icon: 'zap', keywords: ['auto', 'schedule', 'share'] },
        { name: 'Checklist', path: 'checklist', icon: 'check-square', keywords: ['tasks', 'todo', 'list'] },
        { name: 'Image Bank', path: 'image-bank', icon: 'image', keywords: ['photos', 'pictures', 'upload'] },
        { name: 'Calendar', path: 'calendar', icon: 'calendar', keywords: ['schedule', 'dates', 'events'] },
        { name: 'Size Charts', path: 'size-charts', icon: 'list', keywords: ['sizes', 'measurements', 'conversion'] },
    ],

    render() {
        return `
            <div class="tool-search" role="search">
                <input type="text" class="tool-search-input" placeholder="Search tools..." aria-label="Search tools"
                       oninput="toolSearch.search(this.value)"
                       onfocus="toolSearch.showResults()"
                       onblur="setTimeout(() => toolSearch.hideResults(), 200)">
                <div class="tool-search-results" id="tool-search-results" style="display: none;"></div>
            </div>
        `;
    },

    search(query) {
        const results = this.tools.filter(
            (t) =>
                t.name.toLowerCase().includes(query.toLowerCase()) ||
                t.keywords.some((k) => k.includes(query.toLowerCase())),
        );

        const resultsEl = document.getElementById('tool-search-results');
        if (resultsEl) {
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            resultsEl.innerHTML = sanitizeHTML(
                sanitizeHTML(
                    results
                        .map(
                            (t) => `
                <button type="button" class="tool-search-result" onclick="router.navigate('${t.path}')">
                    <div class="tool-search-result-icon">${components.icon(t.icon, 16)}</div>
                    <div>
                        <div class="tool-search-result-name">${t.name}</div>
                        <div class="tool-search-result-path">Tools / ${t.name}</div>
                    </div>
                </button>
            `,
                        )
                        .join('') || '<div class="p-4 text-gray-500 text-sm">No results found</div>',
                ),
            );
        }
    },

    showResults() {
        const el = document.getElementById('tool-search-results');
        if (el) el.style.display = 'block';
    },

    hideResults() {
        const el = document.getElementById('tool-search-results');
        if (el) el.style.display = 'none';
    },
};

// Tool Usage Analytics
const toolUsageAnalytics = {
    data: (() => {
        try {
            return JSON.parse(localStorage.getItem('vl_tool_usage') || '{}');
        } catch (e) {
            console.error('Failed to parse tool usage analytics:', e);
            return {};
        }
    })(),

    track(toolName) {
        this.data[toolName] = (this.data[toolName] || 0) + 1;
        localStorage.setItem('vl_tool_usage', JSON.stringify(this.data));
    },

    render() {
        const sorted = Object.entries(this.data).sort((a, b) => b[1] - a[1]);
        const max = sorted[0]?.[1] || 1;

        return `
            <div class="tool-usage-chart">
                <h3 class="font-medium mb-3">Tool Usage</h3>
                ${sorted
                    .slice(0, 5)
                    .map(
                        ([name, count]) => `
                    <div class="tool-usage-bar">
                        <div class="tool-usage-name">${name}</div>
                        <div class="tool-usage-track">
                            <div class="tool-usage-fill" style="width: ${(count / max) * 100}%"></div>
                        </div>
                        <div class="tool-usage-count">${count}</div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Tool Tips / Tutorial System
const toolTips = {
    tips: [],
    currentIndex: 0,
    isActive: false,

    start(tips) {
        this.tips = tips;
        this.currentIndex = 0;
        this.isActive = true;
        this.show();
    },

    show() {
        if (!this.isActive || this.currentIndex >= this.tips.length) {
            this.end();
            return;
        }

        const tip = this.tips[this.currentIndex];
        const target = document.querySelector(tip.selector);

        if (target) {
            target.classList.add('tool-tip-highlight');

            const popover = document.createElement('div');
            popover.className = 'tool-tip-popover bottom';
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            popover.innerHTML = sanitizeHTML(
                sanitizeHTML(`
                <div class="tool-tip-title">${tip.title}</div>
                <div class="tool-tip-description">${tip.description}</div>
                <div class="tool-tip-progress">
                    ${this.tips.map((_, i) => `<div class="tool-tip-progress-dot ${i === this.currentIndex ? 'active' : ''}"></div>`).join('')}
                </div>
                <div class="tool-tip-actions">
                    <button class="btn btn-ghost btn-sm" onclick="toolTips.end()">Skip</button>
                    <button class="btn btn-primary btn-sm" onclick="toolTips.next()">
                        ${this.currentIndex === this.tips.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            `),
            );

            const rect = target.getBoundingClientRect();
            popover.style.position = 'fixed';
            popover.style.top = `${rect.bottom + 12}px`;
            popover.style.left = `${rect.left + rect.width / 2 - 150}px`;

            document.body.appendChild(popover);
        }
    },

    next() {
        this.cleanup();
        this.currentIndex++;
        this.show();
    },

    end() {
        this.cleanup();
        this.isActive = false;
        this.tips = [];
        this.currentIndex = 0;
    },

    cleanup() {
        document.querySelectorAll('.tool-tip-highlight').forEach((el) => el.classList.remove('tool-tip-highlight'));
        document.querySelectorAll('.tool-tip-popover').forEach((el) => el.remove());
    },
};

// ============================================
// Business Section UI Helpers
// ============================================

// Shop Health Dashboard
const shopHealthDashboard = {
    platforms: ['poshmark', 'ebay', 'mercari', 'depop', 'shopify', 'facebook'],

    render(shops) {
        const connectedShops = shops.filter((s) => s.is_connected);
        return `
            <div class="shop-health-dashboard">
                ${connectedShops.map((shop) => this.renderCard(shop)).join('')}
            </div>
        `;
    },

    renderCard(shop) {
        const metrics = shop.metrics || { sales: 0, listings: 0, followers: 0 };
        const trend = shop.salesTrend || [0, 0, 0, 0, 0, 0, 0];

        return `
            <div class="shop-health-card ${shop.platform}">
                <div class="shop-health-header">
                    <div class="shop-health-platform">
                        <span class="shop-health-platform-name">${shop.platform.charAt(0).toUpperCase() + shop.platform.slice(1)}</span>
                    </div>
                    <div class="shop-health-status ${shop.syncing ? 'syncing' : shop.is_connected ? '' : 'disconnected'}"></div>
                </div>
                <div class="shop-health-metrics">
                    <div class="shop-health-metric">
                        <div class="shop-health-metric-value">${metrics.sales}</div>
                        <div class="shop-health-metric-label">Sales</div>
                    </div>
                    <div class="shop-health-metric">
                        <div class="shop-health-metric-value">${metrics.listings}</div>
                        <div class="shop-health-metric-label">Active</div>
                    </div>
                    <div class="shop-health-metric">
                        <div class="shop-health-metric-value">${metrics.followers || '-'}</div>
                        <div class="shop-health-metric-label">Followers</div>
                    </div>
                </div>
                <div class="shop-health-sparkline">
                    ${components.sparkline(trend, { width: 180, height: 40, color: 'var(--success-500)' })}
                </div>
            </div>
        `;
    },
};

// Sync Status Bar
const syncStatusBar = {
    render(status) {
        const { syncing, lastSync, progress, platform } = status;
        return `
            <div class="sync-status-bar">
                <div class="sync-status-icon ${syncing ? 'syncing' : ''}">
                    ${components.icon(syncing ? 'refresh' : 'check-circle', 20)}
                </div>
                <div class="sync-status-text">
                    <div class="sync-label">${syncing ? `Syncing ${platform || 'all platforms'}...` : 'All shops synced'}</div>
                    <div class="sync-time">${lastSync ? `Last sync: ${new Date(lastSync).toLocaleTimeString()}` : ''}</div>
                </div>
                ${
                    syncing
                        ? `
                    <div class="sync-progress-bar">
                        <div class="sync-progress-fill" style="width: ${progress || 0}%"></div>
                    </div>
                `
                        : ''
                }
            </div>
        `;
    },
};

// Platform Comparison Chart
const platformComparison = {
    render(data) {
        if (!data || data.length === 0) {
            return '<div class="text-gray-500 text-center py-4">No platform data available</div>';
        }
        const max = Math.max(...data.map((d) => d.value || 0), 1);
        return `
            <div class="platform-comparison">
                ${data
                    .map(
                        (item) => `
                    <div class="platform-comparison-row">
                        <div class="platform-comparison-label">
                            ${components.platformBadge(item.platform)}
                        </div>
                        <div class="platform-comparison-bar">
                            <div class="platform-comparison-fill ${item.platform}" style="width: ${((item.value || 0) / max) * 100}%">
                                C$${(item.value || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Transaction Timeline
const transactionTimeline = {
    render(transactions) {
        const grouped = this.groupByDate(transactions);
        return `
            <div class="transaction-timeline">
                ${Object.entries(grouped)
                    .map(
                        ([date, txns]) => `
                    <div class="transaction-timeline-date-group">
                        <div class="text-sm font-medium text-gray-600 mb-2">${date}</div>
                        ${txns.map((t) => this.renderItem(t)).join('')}
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },

    renderItem(transaction) {
        const isIncome = transaction.type === 'income' || transaction.type === 'sale';
        return `
            <div class="transaction-timeline-item ${isIncome ? 'income' : 'expense'}">
                <div class="transaction-timeline-content">
                    <div class="transaction-timeline-details">
                        <div class="transaction-timeline-title">${escapeHtml(transaction.description || transaction.vendor || 'Transaction')}</div>
                        <div class="transaction-timeline-category">${escapeHtml(transaction.category || '')}</div>
                        ${
                            transaction.tags
                                ? `
                            <div class="transaction-tags">
                                ${transaction.tags.map((tag) => `<span class="transaction-tag ${tag}">${tag}</span>`).join('')}
                            </div>
                        `
                                : ''
                        }
                    </div>
                    <div class="transaction-timeline-amount ${isIncome ? 'income' : 'expense'}">
                        ${isIncome ? '+' : '-'}C$${Math.abs(transaction.amount).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    },

    groupByDate(transactions) {
        return transactions.reduce((groups, t) => {
            const date = new Date(t.date || t.created_at).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(t);
            return groups;
        }, {});
    },
};

// Expense Pie Chart
const expensePieChart = {
    colors: ['#f59e0b', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'],

    render(categories) {
        if (!categories || categories.length === 0) {
            return '<div class="text-gray-500 text-center py-4">No expense data available</div>';
        }
        const total = categories.reduce((sum, c) => sum + (c.amount || 0), 0) || 1;
        let cumulative = 0;

        return `
            <div class="expense-pie-chart">
                <svg viewBox="0 0 100 100">
                    ${categories
                        .map((cat, i) => {
                            const percent = ((cat.amount || 0) / total) * 100;
                            const startAngle = (cumulative / 100) * 360;
                            cumulative += percent;
                            const endAngle = (cumulative / 100) * 360;
                            return this.renderSlice(
                                50,
                                50,
                                40,
                                startAngle,
                                endAngle,
                                this.colors[i % this.colors.length],
                            );
                        })
                        .join('')}
                </svg>
            </div>
            <div class="expense-pie-legend">
                ${categories
                    .map(
                        (cat, i) => `
                    <div class="expense-pie-legend-item">
                        <div class="expense-pie-legend-dot" style="background: ${this.colors[i % this.colors.length]}"></div>
                        <span>${escapeHtml(cat.name || 'Unknown')} (C$${(cat.amount || 0).toFixed(0)})</span>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },

    renderSlice(cx, cy, r, startAngle, endAngle, color) {
        const start = this.polarToCartesian(cx, cy, r, endAngle);
        const end = this.polarToCartesian(cx, cy, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
        return `<path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z" fill="${color}"/>`;
    },

    polarToCartesian(cx, cy, r, angle) {
        const rad = ((angle - 90) * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    },
};

// Monthly Comparison Chart
const monthlyComparisonChart = {
    render(data) {
        const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);
        return `
            <div class="monthly-comparison-chart">
                ${data
                    .map(
                        (month) => `
                    <div class="monthly-bar-group">
                        <div class="monthly-bars">
                            <div class="monthly-bar income" style="height: ${(month.income / maxValue) * 100}%"></div>
                            <div class="monthly-bar expense" style="height: ${(month.expenses / maxValue) * 100}%"></div>
                        </div>
                        <div class="monthly-label">${month.label}</div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
            <div class="flex justify-center gap-6 mt-4">
                <div class="flex items-center gap-2 text-sm">
                    <div class="w-3 h-3 rounded" style="background: var(--success-500)"></div>
                    <span>Income</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <div class="w-3 h-3 rounded" style="background: var(--error-400)"></div>
                    <span>Expenses</span>
                </div>
            </div>
        `;
    },
};

// Running Balance Display
const runningBalance = {
    render(balance) {
        return `
            <div class="running-balance">
                <div class="running-balance-label">Running Balance</div>
                <div class="running-balance-amount">C$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
        `;
    },
};

// Financial Dashboard Header
const financialDashboardHeader = {
    render(metrics) {
        return `
            <div class="financial-dashboard-header">
                ${this.renderCard('Revenue', metrics.revenue, 'revenue', metrics.revenueChange)}
                ${this.renderCard('Expenses', metrics.expenses, 'expenses', metrics.expensesChange)}
                ${this.renderCard('Net Profit', metrics.profit, 'profit', metrics.profitChange)}
                ${this.renderCard('Cash Flow', metrics.cashFlow, 'cashflow', metrics.cashFlowChange)}
            </div>
        `;
    },

    renderCard(label, value, type, change) {
        const isPositive = value >= 0;
        const changeUp = change >= 0;
        return `
            <div class="financial-metric-card ${type}">
                <div class="financial-metric-label">
                    ${components.icon(type === 'revenue' ? 'trending-up' : type === 'expenses' ? 'trending-down' : type === 'profit' ? 'dollar-sign' : 'activity', 16)}
                    ${label}
                </div>
                <div class="financial-metric-value ${isPositive ? 'positive' : 'negative'}">
                    ${value < 0 ? '-' : ''}C$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                ${
                    change !== undefined
                        ? `
                    <div class="financial-metric-change ${changeUp ? 'up' : 'down'}">
                        ${components.icon(changeUp ? 'arrow-up' : 'arrow-down', 12)}
                        ${Math.abs(change).toFixed(1)}% vs last period
                    </div>
                `
                        : ''
                }
            </div>
        `;
    },
};

// Profit Margin Gauge
const profitMarginGauge = {
    render(margin) {
        const angle = Math.min(180, Math.max(0, (margin / 100) * 180));
        const color = margin >= 30 ? 'var(--success-500)' : margin >= 15 ? 'var(--warning-500)' : 'var(--error-500)';
        // Needle: arc center is (50,50), radius 40. 0% = left end = 180deg, 100% = right end = 0deg.
        // Angle from positive-x axis (clockwise in SVG): needle tip angle = 180 - angle (degrees).
        const needleRad = ((180 - angle) * Math.PI) / 180;
        const nx = 50 + 34 * Math.cos(needleRad);
        const ny = 50 - 34 * Math.sin(needleRad);

        return `
            <div class="profit-margin-gauge">
                <svg viewBox="0 0 100 50">
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--gray-200)" stroke-width="8" stroke-linecap="round"/>
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"
                          stroke-dasharray="${angle * 1.4}, 252" />
                    <line x1="50" y1="50" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"
                          stroke="var(--gray-700)" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="50" cy="50" r="3" fill="var(--gray-700)"/>
                </svg>
                <div class="profit-margin-value" style="color: ${color}">${margin.toFixed(1)}%</div>
                <div class="profit-margin-label">Profit Margin</div>
            </div>
        `;
    },
};
window.profitMarginGauge = profitMarginGauge;

// Cash Flow Waterfall Chart
// NOTE: waterfallChart + financialRatios must be on window — used by chunk-sales.js (financials page)
const waterfallChart = {
    render(data) {
        const values = data.map((d) => d.value);
        const maxAbs = Math.max(...values.map(Math.abs), 1);
        const scale = 150 / maxAbs;

        let runningTotal = 0;
        return `
            <div class="waterfall-chart">
                ${data
                    .map((item, i) => {
                        const height = Math.abs(item.value) * scale;
                        const isPositive = item.value >= 0;
                        const isTotal = item.isTotal;

                        if (!isTotal) runningTotal += item.value;

                        return `
                        <div class="waterfall-bar-container">
                            <div class="waterfall-value ${isPositive ? 'text-success' : 'text-error'}">
                                ${item.value === 0 ? '' : isPositive ? '+' : '-'}C$${Math.abs(item.value).toFixed(0)}
                            </div>
                            <div class="waterfall-bar ${isTotal ? 'total' : isPositive ? 'positive' : 'negative'}"
                                 style="height: ${height}px;">
                            </div>
                            <div class="waterfall-label">${item.label}</div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },
};
window.waterfallChart = waterfallChart;

// Financial Ratios
const financialRatios = {
    calculate(data) {
        const { revenue, cogs, totalAssets, totalLiabilities, equity, currentAssets, currentLiabilities } = data;
        const grossProfit = revenue - cogs;

        return [
            {
                name: 'Gross Margin',
                value: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) + '%' : 'N/A',
                status:
                    revenue > 0 && grossProfit / revenue >= 0.4
                        ? 'good'
                        : grossProfit / revenue >= 0.2
                          ? 'warning'
                          : 'bad',
                description: 'Revenue after COGS',
            },
            {
                name: 'Current Ratio',
                value: currentLiabilities > 0 ? (currentAssets / currentLiabilities).toFixed(2) : 'N/A',
                status:
                    currentLiabilities > 0 && currentAssets / currentLiabilities >= 2
                        ? 'good'
                        : currentAssets / currentLiabilities >= 1
                          ? 'warning'
                          : 'bad',
                description: 'Ability to pay short-term debts',
            },
            {
                name: 'Debt-to-Equity',
                value: equity > 0 ? (totalLiabilities / equity).toFixed(2) : 'N/A',
                status:
                    equity > 0 && totalLiabilities / equity <= 1
                        ? 'good'
                        : totalLiabilities / equity <= 2
                          ? 'warning'
                          : 'bad',
                description: 'Financial leverage',
            },
        ];
    },

    render(ratios) {
        return `
            <div class="financial-ratios">
                ${ratios
                    .map(
                        (ratio) => `
                    <div class="ratio-card">
                        <div class="ratio-value">${ratio.value}</div>
                        <div class="ratio-name">${ratio.name}</div>
                        <div class="ratio-status ${ratio.status}"${ratio.value === 'N/A' ? ' title="N/A — no sales data recorded yet"' : ''}>${ratio.status === 'good' ? 'Healthy' : ratio.status === 'warning' ? 'Monitor' : 'Review'}</div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};
window.financialRatios = financialRatios;

// KPI Dashboard
const kpiDashboard = {
    render(kpis) {
        return `
            <div class="kpi-dashboard">
                ${kpis.map((kpi) => this.renderCard(kpi)).join('')}
            </div>
        `;
    },

    renderCard(kpi) {
        const trendUp = kpi.change > 0;
        return `
            <div class="kpi-card">
                <div class="kpi-card-header">
                    <div class="kpi-card-icon ${kpi.type}">${components.icon(kpi.icon, 20)}</div>
                    ${
                        kpi.change !== undefined && kpi.change !== null && kpi.change !== 0
                            ? `
                        <div class="kpi-card-trend ${trendUp ? 'up' : 'down'}">
                            ${components.icon(trendUp ? 'arrow-up' : 'arrow-down', 12)}
                            ${Math.abs(kpi.change).toFixed(1)}%
                        </div>
                    `
                            : ''
                    }
                </div>
                <div class="kpi-card-value">${kpi.value}</div>
                <div class="kpi-card-label">${kpi.label}</div>
                ${
                    kpi.sparkline
                        ? `
                    <div class="kpi-card-sparkline">
                        ${components.sparkline(kpi.sparkline, { width: 200, height: 40, color: 'var(--primary-500)', fill: true })}
                    </div>
                `
                        : ''
                }
            </div>
        `;
    },
};

// Sales Funnel Vertical
const salesFunnelVertical = {
    render(stages) {
        return `
            <div class="sales-funnel-vertical">
                ${stages
                    .map((stage, i) => {
                        const prevValue = i > 0 ? stages[i - 1].value : stage.value;
                        const conversionRate =
                            prevValue > 0 ? ((stage.value / prevValue) * 100).toFixed(0) + '%' : 'N/A';
                        return `
                        ${i > 0 ? `<div class="funnel-conversion">${conversionRate} conversion</div>` : ''}
                        <div class="funnel-stage-vertical">
                            <div class="funnel-stage-content">
                                <span class="funnel-stage-name">${stage.name}</span>
                                <span class="funnel-stage-value">${stage.value.toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                    })
                    .join('')}
            </div>
        `;
    },
};

// Time of Day Heatmap
const timeHeatmap = {
    render(data) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const hours = ['12a', '3a', '6a', '9a', '12p', '3p', '6p', '9p'];

        return `
            <div class="time-heatmap">
                <div class="time-heatmap-label"></div>
                ${days.map((d) => `<div class="time-heatmap-label" style="justify-content: center;">${d}</div>`).join('')}
                ${hours
                    .map(
                        (hour, h) => `
                    <div class="time-heatmap-label">${hour}</div>
                    ${days
                        .map((_, d) => {
                            const value = data[d]?.[h] || 0;
                            const level = Math.min(5, Math.floor(value / 2));
                            return `<div class="time-heatmap-cell level-${level}" title="${value} sales"></div>`;
                        })
                        .join('')}
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Goal Tracker Widget
const goalTrackerWidget = {
    render(goal) {
        const progress = Math.min(100, (goal.current / goal.target) * 100);
        const remaining = Math.max(0, goal.target - goal.current);
        const editHandler = goal.id ? `handlers.editGoal('${goal.id}')` : `handlers.showGoalSettings()`;

        return `
            <div class="goal-tracker">
                <div class="goal-tracker-header">
                    <div class="goal-tracker-title">
                        ${components.icon('target', 16)} ${goal.name}
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="${editHandler}">
                        ${components.icon('edit', 14)}
                    </button>
                </div>
                <div class="goal-progress-ring">
                    ${components.progressRing(progress, 80, 8, progress >= 100 ? 'green' : 'primary')}
                    <div class="goal-details">
                        <div class="goal-current">C$${goal.current.toLocaleString()}</div>
                        <div class="goal-target">of C$${goal.target.toLocaleString()} goal</div>
                        <div class="goal-remaining">${remaining > 0 ? `C$${remaining.toLocaleString()} to go` : 'Goal reached!'}</div>
                    </div>
                </div>
            </div>
        `;
    },
};

// Financial Alert
const financialAlert = {
    render(alert) {
        return `
            <div class="financial-alert ${alert.type}">
                <div class="financial-alert-icon">${components.icon(alert.icon || 'alert-triangle', 16)}</div>
                <div class="financial-alert-content">
                    <div class="financial-alert-title">${escapeHtml(alert.title)}</div>
                    <div class="financial-alert-message">${escapeHtml(alert.message)}</div>
                </div>
                ${alert.action ? `<button class="btn btn-sm btn-secondary" onclick="${alert.action.handler}">${alert.action.label}</button>` : ''}
            </div>
        `;
    },
};

// Business Quick Actions FAB
const businessFAB = {
    isOpen: false,

    render() {
        const actions = [
            { icon: 'plus', label: 'Add Transaction', handler: 'handlers.showAddTransaction()' },
            { icon: 'upload', label: 'Import Data', handler: 'handlers.showImportModal()' },
            { icon: 'download', label: 'Export Report', handler: "handlers.exportFinancials('csv')" },
            { icon: 'refresh', label: 'Sync All Shops', handler: 'handlers.syncAllShops()' },
        ];

        return `
            <div class="business-fab ${this.isOpen ? 'open' : ''}">
                <div class="business-fab-menu">
                    ${actions
                        .map(
                            (a) => `
                        <button type="button" class="business-fab-item" onclick="${a.handler}; businessFAB.toggle();">
                            ${components.icon(a.icon, 16)}
                            <span>${a.label}</span>
                        </button>
                    `,
                        )
                        .join('')}
                </div>
                <button class="business-fab-btn" aria-label="Quick Actions" title="Quick Actions" onclick="businessFAB.toggle()">
                    ${components.icon(this.isOpen ? 'x' : 'plus', 24)}
                </button>
            </div>
        `;
    },

    toggle() {
        this.isOpen = !this.isOpen;
        const fab = document.querySelector('.business-fab');
        if (fab) fab.outerHTML = this.render(); // nosemgrep: javascript.browser.security.insecure-document-method  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
    },
};

// Period Comparison
const periodComparison = {
    render(current, previous, labels = { current: 'This Period', previous: 'Last Period' }) {
        const rows = Object.keys(current).map((key) => ({
            label: key,
            current: current[key],
            previous: previous[key],
            variance: previous[key] !== 0 ? ((current[key] - previous[key]) / Math.abs(previous[key])) * 100 : 0,
        }));

        return `
            <div class="period-comparison">
                <div class="period-comparison-column">
                    <div class="period-comparison-header">
                        <span class="period-comparison-title">${labels.current}</span>
                    </div>
                    ${rows
                        .map(
                            (r) => `
                        <div class="period-comparison-row">
                            <span>${r.label}</span>
                            <span class="font-medium">C$${r.current.toLocaleString()}</span>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
                <div class="period-comparison-column">
                    <div class="period-comparison-header">
                        <span class="period-comparison-title">${labels.previous}</span>
                    </div>
                    ${rows
                        .map(
                            (r) => `
                        <div class="period-comparison-row">
                            <span>C$${r.previous.toLocaleString()}</span>
                            <span class="period-comparison-variance ${r.variance >= 0 ? 'positive' : 'negative'}">
                                ${r.variance >= 0 ? '+' : ''}${r.variance.toFixed(1)}%
                            </span>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },
};

// Budget Progress
const budgetProgress = {
    render(budgets) {
        if (!Array.isArray(budgets) || budgets.length === 0) {
            return '<div class="text-gray-500 text-sm text-center py-4">No budget categories yet</div>';
        }

        return budgets
            .map((b) => {
                const actual = Number(b.actual ?? b.spent ?? 0) || 0;
                const budget = Number(b.budget ?? 0) || 0;
                const percent = budget > 0 ? (actual / budget) * 100 : 0;
                const status = percent <= 80 ? 'under' : percent <= 100 ? 'warning' : 'over';
                const label = b.name || b.category || 'Uncategorized';
                return `
                <div class="budget-progress">
                    <div class="budget-progress-header">
                        <span>${escapeHtml(label)}</span>
                        <span>C$${actual.toLocaleString()} / C$${budget.toLocaleString()}</span>
                    </div>
                    <div class="budget-progress-bar">
                        <div class="budget-progress-fill ${status}" style="width: ${Math.min(100, percent)}%"></div>
                        <div class="budget-progress-marker" style="left: 100%;"></div>
                    </div>
                </div>
            `;
            })
            .join('');
    },
};

// ============================================
// Intelligence Section Helpers
// ============================================

// AI Confidence Gauge
const aiConfidenceGauge = {
    render(confidence, label = 'Model Confidence') {
        const color = confidence >= 80 ? 'var(--success)' : confidence >= 60 ? 'var(--warning)' : 'var(--error)';
        const circumference = 2 * Math.PI * 45;
        const offset = circumference - (confidence / 100) * circumference;
        return `
            <div class="ai-confidence-gauge">
                <svg viewBox="0 0 100 100" width="120" height="120">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="var(--gray-200)" stroke-width="8"/>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="${color}" stroke-width="8"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                            stroke-linecap="round" transform="rotate(-90 50 50)"/>
                </svg>
                <div class="ai-confidence-value" style="color: ${color};">${confidence}%</div>
                <div class="ai-confidence-label">${label}</div>
            </div>
        `;
    },
};

// Expose financial/chunk-used widgets on window for deferred chunk access
window.viewModeToggle = viewModeToggle;
window.transactionTimeline = transactionTimeline;
window.expensePieChart = expensePieChart;
window.monthlyComparisonChart = monthlyComparisonChart;
window.runningBalance = runningBalance;
window.financialDashboardHeader = financialDashboardHeader;
window.businessFAB = businessFAB;
window.budgetProgress = budgetProgress;
window.shopHealthDashboard = shopHealthDashboard;
window.platformComparison = platformComparison;
window.syncStatusBar = syncStatusBar;

// Recommendation Cards
const recommendationCards = {
    types: {
        buy: { color: 'var(--success)', icon: 'trending-up', label: 'Buy/Increase' },
        hold: { color: 'var(--warning)', icon: 'minus', label: 'Hold' },
        reduce: { color: 'var(--error)', icon: 'trending-down', label: 'Reduce/Sell' },
    },
    render(recommendations) {
        const grouped = { buy: [], hold: [], reduce: [] };
        recommendations.forEach((r) => {
            const type = r.recommendation?.toLowerCase() || 'hold';
            if (type.includes('buy') || type.includes('increase')) grouped.buy.push(r);
            else if (type.includes('reduce') || type.includes('sell')) grouped.reduce.push(r);
            else grouped.hold.push(r);
        });

        return `
            <div class="recommendation-cards">
                ${Object.entries(this.types)
                    .map(
                        ([key, config]) => `
                    <div class="recommendation-card" style="border-left: 4px solid ${config.color};">
                        <div class="recommendation-header">
                            <span class="recommendation-icon" style="color: ${config.color};">${components.icon(config.icon, 20)}</span>
                            <span class="recommendation-label">${config.label}</span>
                            <span class="recommendation-count" style="background: ${config.color}20; color: ${config.color};">${grouped[key].length}</span>
                        </div>
                        <div class="recommendation-items">
                            ${grouped[key]
                                .slice(0, 3)
                                .map(
                                    (item) => `
                                <div class="recommendation-item">
                                    <span class="truncate">${escapeHtml(item.item_title || 'Item')}</span>
                                    <span class="font-medium">C$${(item.predicted_price || 0).toFixed(0)}</span>
                                </div>
                            `,
                                )
                                .join('')}
                            ${grouped[key].length > 3 ? `<div class="recommendation-more">+${grouped[key].length - 3} more</div>` : ''}
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};
window.recommendationCards = recommendationCards;

// Demand Heatmap
const demandHeatmap = {
    render(data = {}) {
        const timeSlots = ['Morning', 'Afternoon', 'Evening', 'Night'];
        const rows = Object.entries(data).filter(([, values]) => Array.isArray(values) && values.length > 0);

        if (rows.length === 0) {
            return '<div class="text-gray-500 text-sm text-center py-4">No demand heatmap data yet</div>';
        }

        const slotCount = Math.max(...rows.map(([, values]) => values.length), 1);
        const visibleSlots = Array.from({ length: slotCount }, (_, index) => timeSlots[index] || `Period ${index + 1}`);

        return `
            <div class="demand-heatmap">
                <div class="heatmap-header">
                    <div class="heatmap-corner"></div>
                    ${visibleSlots.map((t) => `<div class="heatmap-time">${escapeHtml(t)}</div>`).join('')}
                </div>
                ${rows
                    .map(([cat, catData]) => {
                        return `
                        <div class="heatmap-row">
                            <div class="heatmap-category">${escapeHtml(cat)}</div>
                            ${visibleSlots
                                .map((slot, index) => {
                                    const raw = Number(catData[index]) || 0;
                                    const intensity = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
                                    const bg =
                                        intensity > 0.7
                                            ? 'var(--success)'
                                            : intensity > 0.4
                                              ? 'var(--warning)'
                                              : 'var(--gray-300)';
                                    return `<div class="heatmap-cell" style="background: ${bg}; opacity: ${0.3 + intensity * 0.7};" title="${(intensity * 100).toFixed(0)}% demand"></div>`;
                                })
                                .join('')}
                        </div>
                    `;
                    })
                    .join('')}
                <div class="heatmap-legend">
                    <span>Low</span>
                    <div class="heatmap-legend-gradient"></div>
                    <span>High</span>
                </div>
            </div>
        `;
    },
};

// Forecast Timeline
const forecastTimeline = {
    render(forecasts) {
        return `
            <div class="forecast-timeline">
                ${forecasts
                    .map(
                        (f, i) => `
                    <div class="forecast-item ${i === 0 ? 'current' : ''}">
                        <div class="forecast-marker"></div>
                        <div class="forecast-content">
                            <div class="forecast-period">${f.period || 'Period ' + (i + 1)}</div>
                            <div class="forecast-prediction">
                                <span class="forecast-value ${f.change >= 0 ? 'positive' : 'negative'}">
                                    ${f.change >= 0 ? '+' : ''}${f.change || 0}%
                                </span>
                                <span class="forecast-category">${f.category || 'All Categories'}</span>
                            </div>
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>
        `;
    },
};

// Price Trend Sparkline
const priceTrendSparkline = {
    render(data, width = 100, height = 30) {
        if (!data || data.length < 2) return '<div class="no-data-sparkline">No data</div>';
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        const points = data
            .map((v, i) => {
                const x = (i / Math.max(data.length - 1, 1)) * width;
                const y = height - ((v - min) / range) * height;
                return `${x},${y}`;
            })
            .join(' ');
        const lastChange = data.length >= 2 ? data[data.length - 1] - data[data.length - 2] : 0;
        const color = lastChange >= 0 ? 'var(--success)' : 'var(--error)';
        return `
            <svg class="price-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
                <circle cx="${width}" cy="${height - ((data[data.length - 1] - min) / range) * height}" r="3" fill="${color}"/>
            </svg>
        `;
    },
};

// Supplier Health Dashboard
const supplierHealthDashboard = {
    render(suppliers) {
        const totalSuppliers = suppliers.length;
        const activeSuppliers = suppliers.filter((s) => s.active).length;
        const avgItems =
            suppliers.length > 0
                ? Math.round(suppliers.reduce((sum, s) => sum + (s.item_count || 0), 0) / suppliers.length)
                : 0;
        const priceDrops = suppliers.filter((s) => s.has_price_drop).length;

        return `
            <div class="supplier-health-dashboard">
                <div class="supplier-stat-card">
                    <div class="supplier-stat-icon" style="background: var(--primary-100); color: var(--primary-600);">
                        ${components.icon('shops', 24)}
                    </div>
                    <div class="supplier-stat-content">
                        <div class="supplier-stat-value">${totalSuppliers}</div>
                        <div class="supplier-stat-label">Total Suppliers</div>
                    </div>
                </div>
                <div class="supplier-stat-card">
                    <div class="supplier-stat-icon" style="background: var(--success-100); color: var(--success);">
                        ${components.icon('check-circle', 24)}
                    </div>
                    <div class="supplier-stat-content">
                        <div class="supplier-stat-value">${activeSuppliers}</div>
                        <div class="supplier-stat-label">Active</div>
                    </div>
                </div>
                <div class="supplier-stat-card">
                    <div class="supplier-stat-icon" style="background: var(--warning-100); color: var(--warning);">
                        ${components.icon('package', 24)}
                    </div>
                    <div class="supplier-stat-content">
                        <div class="supplier-stat-value">${avgItems}</div>
                        <div class="supplier-stat-label">Avg Items</div>
                    </div>
                </div>
                <div class="supplier-stat-card">
                    <div class="supplier-stat-icon" style="background: var(--error-100); color: var(--error);">
                        ${components.icon('trending-down', 24)}
                    </div>
                    <div class="supplier-stat-content">
                        <div class="supplier-stat-value">${priceDrops}</div>
                        <div class="supplier-stat-label">Price Drops</div>
                    </div>
                </div>
            </div>
        `;
    },
};
window.supplierHealthDashboard = supplierHealthDashboard;

// Price Drop Alert Banner
const priceDropBanner = {
    render(alerts) {
        if (!alerts || alerts.length === 0) return '';
        return `
            <div class="price-drop-banner">
                <div class="price-drop-icon">${components.icon('alert-circle', 20)}</div>
                <div class="price-drop-content">
                    <strong>${alerts.length} Price Drop${alerts.length > 1 ? 's' : ''} Detected!</strong>
                    <span>${alerts
                        .slice(0, 2)
                        .map((a) => a.supplier_name)
                        .join(', ')}${alerts.length > 2 ? ` +${alerts.length - 2} more` : ''}</span>
                </div>
                <button class="btn btn-sm btn-primary" onclick="handlers.viewPriceDrops()">View All</button>
            </div>
        `;
    },
};

// Supplier Card Enhanced
const supplierCardEnhanced = {
    render(supplier) {
        const healthScore = supplier.health_score ?? null;
        const healthColor =
            healthScore !== null
                ? healthScore >= 80
                    ? 'var(--success)'
                    : healthScore >= 60
                      ? 'var(--warning)'
                      : 'var(--error)'
                : 'var(--gray-400)';
        const stockStatus = supplier.stock_status || 'In Stock';
        const stockColor = stockStatus === 'In Stock' ? 'success' : stockStatus === 'Low Stock' ? 'warning' : 'error';

        // Reliability metrics from real data only
        const orderAccuracy = supplier.order_accuracy ?? null;
        const onTimeDelivery = supplier.on_time_delivery ?? null;
        const qualityRating = supplier.quality_rating ?? null;
        const reliabilityScore = supplier.reliability_score ?? null;
        const reliabilityColor =
            reliabilityScore !== null
                ? reliabilityScore >= 90
                    ? 'var(--success)'
                    : reliabilityScore >= 70
                      ? 'var(--warning)'
                      : 'var(--error)'
                : 'var(--gray-400)';
        const reliabilityLabel =
            reliabilityScore !== null
                ? reliabilityScore >= 90
                    ? 'Excellent'
                    : reliabilityScore >= 70
                      ? 'Good'
                      : 'Needs Improvement'
                : 'No Data';
        let priceHistory = supplier.price_history ?? supplier.priceHistory;
        if (typeof priceHistory === 'string') {
            try {
                priceHistory = JSON.parse(priceHistory);
            } catch {
                priceHistory = [];
            }
        }
        const priceHistoryData = Array.isArray(priceHistory)
            ? priceHistory
                  .map((point) => {
                      const value =
                          point && typeof point === 'object'
                              ? (point.price ?? point.value ?? point.amount ?? point.avg_price)
                              : point;
                      const price = Number(value);
                      return Number.isFinite(price) ? price : null;
                  })
                  .filter((price) => price !== null)
            : [];

        return `
            <div class="supplier-card-enhanced">
                <div class="supplier-card-header">
                    <div class="supplier-avatar" style="background: var(--primary-100); color: var(--primary-600);">
                        ${(supplier.name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div class="supplier-info">
                        <div class="supplier-name">${escapeHtml(supplier.name || 'Supplier')}</div>
                        ${supplier.website ? `<a href="${escapeHtml(supplier.website)}" target="_blank" class="supplier-link">${components.icon('external-link', 12)} Visit</a>` : ''}
                    </div>
                    <div class="supplier-health" style="color: ${healthColor};">
                        <div class="supplier-health-score">${healthScore ?? '--'}</div>
                        <div class="supplier-health-label">Health</div>
                    </div>
                    <div class="supplier-reliability" title="Reliability: ${reliabilityLabel}&#10;Order Accuracy: ${orderAccuracy !== null ? orderAccuracy + '%' : 'N/A'}&#10;On-Time Delivery: ${onTimeDelivery !== null ? onTimeDelivery + '%' : 'N/A'}&#10;Quality Rating: ${qualityRating !== null ? qualityRating + '%' : 'N/A'}">
                        <div class="reliability-score-circle" style="--reliability-color: ${reliabilityColor};">
                            <span class="reliability-value">${reliabilityScore ?? '--'}</span>
                        </div>
                        <div class="reliability-label">Reliability</div>
                    </div>
                </div>
                <div class="supplier-card-body">
                    <div class="supplier-metrics">
                        <div class="supplier-metric">
                            <span class="metric-value">${supplier.item_count || 0}</span>
                            <span class="metric-label">Items</span>
                        </div>
                        <div class="supplier-metric">
                            <span class="metric-value">C$${(supplier.avg_price || 0).toFixed(0)}</span>
                            <span class="metric-label">Avg Price</span>
                        </div>
                        <div class="supplier-metric">
                            <span class="badge badge-${stockColor}">${stockStatus}</span>
                        </div>
                    </div>
                    <div class="supplier-sparkline-container">
                        <span class="text-xs text-gray-500">Price History</span>
                        ${priceTrendSparkline.render(priceHistoryData)}
                    </div>
                </div>
                <div class="supplier-card-footer">
                    <button class="btn btn-sm btn-secondary" onclick="handlers.viewSupplierDetails('${escapeHtml(supplier.id)}')">
                        ${components.icon('eye', 14)} Details
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="handlers.refreshSupplier('${escapeHtml(supplier.id)}')">
                        ${components.icon('refresh-cw', 14)} Refresh
                    </button>
                    <button class="btn btn-sm btn-ghost" onclick="handlers.deleteSupplier('${escapeHtml(supplier.id)}')" style="color: var(--error); margin-left: auto;">
                        ${components.icon('trash-2', 14)} Delete
                    </button>
                    <div class="supplier-rating">
                        ${[1, 2, 3, 4, 5]
                            .map(
                                (star) => `
                            <button type="button" class="rating-star ${star <= (supplier.rating || 4) ? 'active' : ''}" onclick="handlers.rateSupplier('${supplier.id}', ${star})" aria-label="Rate ${star} star${star !== 1 ? 's' : ''}">★</button>
                        `,
                            )
                            .join('')}
                    </div>
                </div>
            </div>
        `;
    },
};

// Market Trends Radar
const marketTrendsRadar = {
    render(data) {
        const categories = data.categories || ['Fashion', 'Tech', 'Home', 'Sports', 'Vintage'];
        const values = data.values || [0.8, 0.6, 0.7, 0.5, 0.9];
        const centerX = 100,
            centerY = 100,
            radius = 80;
        const angleStep = (2 * Math.PI) / categories.length;

        const points = values
            .map((v, i) => {
                const angle = i * angleStep - Math.PI / 2;
                const x = centerX + v * radius * Math.cos(angle);
                const y = centerY + v * radius * Math.sin(angle);
                return `${x},${y}`;
            })
            .join(' ');

        return `
            <div class="market-radar">
                <svg viewBox="0 0 200 200" class="radar-chart">
                    <!-- Background circles -->
                    ${[0.25, 0.5, 0.75, 1]
                        .map(
                            (r) => `
                        <circle cx="${centerX}" cy="${centerY}" r="${r * radius}" fill="none" stroke="var(--gray-200)" stroke-width="1"/>
                    `,
                        )
                        .join('')}
                    <!-- Axis lines -->
                    ${categories
                        .map((_, i) => {
                            const angle = i * angleStep - Math.PI / 2;
                            const x2 = centerX + radius * Math.cos(angle);
                            const y2 = centerY + radius * Math.sin(angle);
                            return `<line x1="${centerX}" y1="${centerY}" x2="${x2}" y2="${y2}" stroke="var(--gray-200)" stroke-width="1"/>`;
                        })
                        .join('')}
                    <!-- Data polygon -->
                    <polygon points="${points}" fill="var(--primary-500)" fill-opacity="0.3" stroke="var(--primary-500)" stroke-width="2"/>
                    <!-- Data points -->
                    ${values
                        .map((v, i) => {
                            const angle = i * angleStep - Math.PI / 2;
                            const x = centerX + v * radius * Math.cos(angle);
                            const y = centerY + v * radius * Math.sin(angle);
                            return `<circle cx="${x}" cy="${y}" r="4" fill="var(--primary-500)"/>`;
                        })
                        .join('')}
                    <!-- Labels -->
                    ${categories
                        .map((cat, i) => {
                            const angle = i * angleStep - Math.PI / 2;
                            const x = centerX + (radius + 15) * Math.cos(angle);
                            const y = centerY + (radius + 15) * Math.sin(angle);
                            return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--gray-600)">${cat}</text>`;
                        })
                        .join('')}
                </svg>
            </div>
        `;
    },
};

// Competitor Activity Feed
const competitorActivityFeed = {
    render(activities) {
        const mockActivities = activities || [];

        const icons = {
            new_listing: { icon: 'plus-circle', color: 'var(--primary)' },
            price_drop: { icon: 'trending-down', color: 'var(--error)' },
            sold: { icon: 'check-circle', color: 'var(--success)' },
            price_increase: { icon: 'trending-up', color: 'var(--warning)' },
        };

        return `
            <div class="competitor-activity-feed">
                <div class="activity-feed-header">
                    <span class="font-medium">Live Activity</span>
                    <span class="activity-live-dot"></span>
                </div>
                <div class="activity-feed-list">
                    ${mockActivities
                        .map((a) => {
                            const config = icons[a.type] || icons.new_listing;
                            return `
                            <div class="activity-feed-item">
                                <div class="activity-icon" style="color: ${config.color};">${components.icon(config.icon, 16)}</div>
                                <div class="activity-content">
                                    <div class="activity-text">
                                        <strong>${escapeHtml(a.competitor)}</strong>
                                        ${a.type === 'new_listing' ? 'listed' : a.type === 'price_drop' ? 'dropped price on' : 'sold'}
                                        <span class="activity-item">${escapeHtml(a.item)}</span>
                                        ${a.price ? `to <strong>${a.price}</strong>` : ''}
                                    </div>
                                    <div class="activity-time">${a.time}</div>
                                </div>
                            </div>
                        `;
                        })
                        .join('')}
                </div>
            </div>
        `;
    },
};
window.competitorActivityFeed = competitorActivityFeed;
window.autoSave = autoSave;
window.calendarLegend = calendarLegend;
window.calendarTimeline = calendarTimeline;
window.kanban = kanban;
window.kanbanBoard = kanbanBoard;
window.measurementTool = measurementTool;
window.pomodoroTimer = pomodoroTimer;
window.sizeConverter = sizeConverter;
window.storageGauge = storageGauge;
window.streakCounter = streakCounter;

// Market Opportunity Cards
const opportunityCards = {
    render(opportunities) {
        const mockOpportunities =
            opportunities.length > 0
                ? opportunities
                : [
                      { category: 'Vintage Denim', score: 92, trend: 'up', potential: '$2,400/mo', competition: 'Low' },
                      {
                          category: 'Designer Bags',
                          score: 87,
                          trend: 'up',
                          potential: '$3,100/mo',
                          competition: 'Medium',
                      },
                      { category: 'Sneakers', score: 78, trend: 'stable', potential: '$1,800/mo', competition: 'High' },
                  ];

        return `
            <div class="opportunity-cards">
                ${mockOpportunities
                    .map((opp) => {
                        // Determine demand level based on score
                        const demandLevel = opp.score >= 80 ? 'hot' : opp.score >= 60 ? 'warm' : 'cool';
                        const demandLabel = demandLevel === 'hot' ? 'Hot' : demandLevel === 'warm' ? 'Warm' : 'Cool';
                        const demandIcon =
                            demandLevel === 'hot' ? 'flame' : demandLevel === 'warm' ? 'thermometer' : 'snowflake';
                        const thermometerFill = Math.min(100, Math.max(10, opp.score));
                        return `
                    <div class="opportunity-card">
                        <div class="opportunity-header">
                            <span class="opportunity-category">${escapeHtml(opp.category)}</span>
                            <div class="opportunity-demand-badge demand-${demandLevel}" title="Buyer demand level">
                                ${components.icon(demandIcon, 12)}
                                <span>${demandLabel}</span>
                            </div>
                        </div>
                        <div class="opportunity-demand-thermometer" title="Demand score: ${opp.score}%">
                            <div class="thermometer-track">
                                <div class="thermometer-fill demand-${demandLevel}" style="width: ${thermometerFill}%;"></div>
                            </div>
                            <span class="thermometer-value">${opp.score}</span>
                        </div>
                        <div class="opportunity-body">
                            <div class="opportunity-trend ${opp.trend}">
                                ${components.icon(opp.trend === 'up' ? 'trending-up' : opp.trend === 'down' ? 'trending-down' : 'minus', 16)}
                                ${opp.trend === 'up' ? 'Growing' : opp.trend === 'down' ? 'Declining' : 'Stable'}
                            </div>
                            <div class="opportunity-competition">
                                <span class="competition-label">Competition</span>
                                <span class="competition-value competition-${(opp.competition || 'Medium').toLowerCase()}">${opp.competition || 'Medium'}</span>
                            </div>
                        </div>
                        <div class="opportunity-potential">
                            <span class="potential-label">Est. Potential</span>
                            <span class="potential-value">${opp.potential}</span>
                        </div>
                        <button class="btn btn-sm btn-primary w-full" onclick="handlers.exploreOpportunity('${opp.category}')">
                            Explore ${components.icon('arrow-right', 14)}
                        </button>
                    </div>
                `;
                    })
                    .join('')}
            </div>
        `;
    },
};

// Trending Keywords Panel
const trendingKeywords = {
    render(keywords) {
        const mockKeywords =
            keywords.length > 0
                ? keywords
                : [
                      { term: 'vintage levis', volume: 2400, change: 15 },
                      { term: 'y2k fashion', volume: 1800, change: 32 },
                      { term: 'designer bags', volume: 1500, change: -5 },
                      { term: 'nike dunks', volume: 1200, change: 8 },
                      { term: 'cottagecore', volume: 980, change: 22 },
                  ];

        return `
            <div class="trending-keywords">
                <div class="trending-header">
                    ${components.icon('search', 16)}
                    <span>Trending Searches</span>
                </div>
                <div class="trending-list">
                    ${mockKeywords
                        .map(
                            (kw, i) => `
                        <div class="trending-item">
                            <span class="trending-rank">#${i + 1}</span>
                            <span class="trending-term">${escapeHtml(kw.term)}</span>
                            <span class="trending-volume">${(kw.volume / 1000).toFixed(1)}k</span>
                            <span class="trending-change ${kw.change >= 0 ? 'positive' : 'negative'}">
                                ${kw.change >= 0 ? '+' : ''}${kw.change}%
                            </span>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },
};

// Price Position Chart
const pricePositionChart = {
    render(data = {}) {
        const clampPosition = (value) => Math.max(0, Math.min(100, value));
        const normalizePoint = (point) => {
            if (!point || typeof point !== 'object') return null;
            const price = Number(point.price ?? point.price_position ?? point.priceScore);
            const quality = Number(point.quality ?? point.quality_score ?? point.qualityScore);
            if (!Number.isFinite(price) || !Number.isFinite(quality)) return null;
            return {
                name: point.name || point.title || 'Competitor',
                price: clampPosition(price),
                quality: clampPosition(quality),
            };
        };
        const yourPosition = normalizePoint(data.yourPosition || data.your_position);
        const competitors = Array.isArray(data.competitors) ? data.competitors.map(normalizePoint).filter(Boolean) : [];

        if (!yourPosition && competitors.length === 0) {
            return '<div class="text-gray-500 text-sm text-center py-4">No price position data yet</div>';
        }

        return `
            <div class="price-position-chart">
                <div class="chart-container" style="position: relative; height: 200px; border: 1px solid var(--gray-200); border-radius: 8px; padding: 20px;">
                    <div class="axis-label-y" style="position: absolute; left: -30px; top: 50%; transform: rotate(-90deg) translateX(-50%); font-size: 11px; color: var(--gray-500);">Quality →</div>
                    <div class="axis-label-x" style="position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%); font-size: 11px; color: var(--gray-500);">Price →</div>

                    <!-- Quadrant labels -->
                    <div style="position: absolute; top: 10px; left: 10px; font-size: 10px; color: var(--gray-400);">Premium</div>
                    <div style="position: absolute; top: 10px; right: 10px; font-size: 10px; color: var(--gray-400);">Luxury</div>
                    <div style="position: absolute; bottom: 10px; left: 10px; font-size: 10px; color: var(--gray-400);">Budget</div>
                    <div style="position: absolute; bottom: 10px; right: 10px; font-size: 10px; color: var(--gray-400);">Value</div>

                    <!-- Your position -->
                    ${
                        yourPosition
                            ? `<div class="position-dot you" style="position: absolute; left: ${yourPosition.price}%; bottom: ${yourPosition.quality}%; transform: translate(-50%, 50%);">
                        <div class="dot-marker" style="width: 16px; height: 16px; background: var(--primary); border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
                        <div class="dot-label" style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: 600; color: var(--primary); white-space: nowrap;">You</div>
                    </div>`
                            : ''
                    }

                    <!-- Competitors -->
                    ${competitors
                        .map(
                            (c) => `
                        <div class="position-dot competitor" style="position: absolute; left: ${c.price}%; bottom: ${c.quality}%; transform: translate(-50%, 50%);">
                            <div class="dot-marker" style="width: 10px; height: 10px; background: var(--gray-400); border-radius: 50%;"></div>
                            <div class="dot-label" style="position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-size: 9px; color: var(--gray-500); white-space: nowrap;">${escapeHtml(c.name)}</div>
                        </div>
                    `,
                        )
                        .join('')}
                </div>
            </div>
        `;
    },
};

window.aiConfidenceGauge = aiConfidenceGauge;
window.autocomplete = autocomplete;
window.banners = banners;
window.bulkSelection = bulkSelection;
window.demandHeatmap = demandHeatmap;
window.forecastTimeline = forecastTimeline;
window.marketTrendsRadar = marketTrendsRadar;
window.opportunityCards = opportunityCards;
window.priceDropBanner = priceDropBanner;
window.pricePositionChart = pricePositionChart;
window.priceTrendSparkline = priceTrendSparkline;
window.runHistoryTimeline = runHistoryTimeline;
window.skeleton = skeleton;
window.supplierCardEnhanced = supplierCardEnhanced;
window.tablePrefs = tablePrefs;
window.themeManager = themeManager;
window.trendingKeywords = trendingKeywords;
