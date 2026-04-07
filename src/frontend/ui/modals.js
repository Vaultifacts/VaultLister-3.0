'use strict';
// All modal dialogs
// Extracted from app.js lines 37529-41318

// ============================================
// Modals
// ============================================
const modals = {
    _escapeHandler: null,
    _focusTrapHandler: null,
    _previouslyFocused: null,

    show(content, sizeClass = '') {
        this._previouslyFocused = document.activeElement;
        const container = document.getElementById('modal-container');
        const modalClass = sizeClass ? `modal ${sizeClass}` : 'modal';
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        container.innerHTML =sanitizeHTML( sanitizeHTML(`
            <div class="modal-overlay" onclick="modals.close()" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="${modalClass}" onclick="event.stopPropagation()" role="document">
                    ${content}
                </div>
            </div>
        `));
        // Set id on first modal-title for aria-labelledby reference
        const titleEl = container.querySelector('.modal-title');
        if (titleEl) titleEl.id = 'modal-title';
        // Add escape key handler and focus trap
        this._escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        this._focusTrapHandler = (e) => {
            if (e.key !== 'Tab') return;
            const modal = container.querySelector('.modal');
            if (!modal) return;
            const focusableElements = modal.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            );
            if (focusableElements.length === 0) return;
            // Filter to only visible focusable elements
            const visibleFocusable = Array.from(focusableElements).filter(el => {
                return el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
            });
            if (visibleFocusable.length === 0) return;
            const firstElement = visibleFocusable[0];
            const lastElement = visibleFocusable[visibleFocusable.length - 1];
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        };
        document.addEventListener('keydown', this._escapeHandler);
        document.addEventListener('keydown', this._focusTrapHandler);
        // Prevent screen readers from escaping modal
        document.getElementById('main-content')?.setAttribute('inert', '');
        // Focus first focusable element
        const focusable = container.querySelector('button, input, select, textarea, a[href]');
        if (focusable) focusable.focus();
    },

    close() {
        // Remove inert BEFORE focus restore (element must be interactive first)
        document.getElementById('main-content')?.removeAttribute('inert');
        document.getElementById('modal-container').innerHTML =sanitizeHTML( sanitizeHTML(''));  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        // Remove keyboard handlers
        if (this._escapeHandler) {
            document.removeEventListener('keydown', this._escapeHandler);
            this._escapeHandler = null;
        }
        if (this._focusTrapHandler) {
            document.removeEventListener('keydown', this._focusTrapHandler);
            this._focusTrapHandler = null;
        }
        if (this._confirmReject) {
            this._confirmReject();
            this._confirmReject = null;
            this._confirmResolve = null;
        }
        if (this._promptResolve) {
            this._promptResolve(null);
            this._promptResolve = null;
        }
        // Restore focus to the element that triggered the modal
        if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
            this._previouslyFocused.focus();
            this._previouslyFocused = null;
        }
    },

    confirm(message, { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
        return new Promise((resolve, reject) => {
            this._previouslyFocused = document.activeElement;
            this._confirmResolve = resolve;
            this._confirmReject = () => resolve(false);
            const btnClass = danger ? 'btn btn-danger' : 'btn btn-primary';
            const container = document.getElementById('modal-container');
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            container.innerHTML =sanitizeHTML( sanitizeHTML(`
                <div class="modal-overlay" id="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title" onclick="${danger ? '' : 'modals._confirmReject(); modals.close();'}">
                    <div class="modal" onclick="event.stopPropagation()" style="max-width: 440px;">
                        <div class="modal-header">
                            <h2 class="modal-title" id="confirm-modal-title">${escapeHtml(title)}</h2>
                            <button class="modal-close" aria-label="Close" onclick="modals._confirmReject(); modals.close();">${components.icon('close')}</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 20px; line-height: 1.5;">${escapeHtml(message)}</p>
                            <div class="flex gap-3 justify-end">
                                <button class="btn btn-secondary" id="confirm-cancel-btn">${escapeHtml(cancelText)}</button>
                                <button class="${btnClass}" id="confirm-ok-btn">${escapeHtml(confirmText)}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `));
            document.getElementById('main-content')?.setAttribute('inert', '');
            this._escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this._confirmResolve = null;
                    this._confirmReject = null;
                    resolve(false);
                    this.close();
                }
            };
            this._focusTrapHandler = (e) => {
                if (e.key !== 'Tab') return;
                const modal = container.querySelector('.modal');
                if (!modal) return;
                const focusable = Array.from(modal.querySelectorAll('button:not([disabled])')).filter(el => el.offsetParent !== null);
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            };
            document.addEventListener('keydown', this._escapeHandler);
            document.addEventListener('keydown', this._focusTrapHandler);
            document.getElementById('confirm-cancel-btn').onclick = () => {
                this._confirmResolve = null;
                this._confirmReject = null;
                resolve(false);
                this.close();
            };
            document.getElementById('confirm-ok-btn').onclick = () => {
                this._confirmResolve = null;
                this._confirmReject = null;
                resolve(true);
                this.close();
            };
            document.getElementById('confirm-cancel-btn').focus();
        });
    },

    prompt(message, { title = 'Input', placeholder = '', defaultValue = '', inputType = 'text', selectOptions = null, submitText = 'OK', cancelText = 'Cancel' } = {}) {
        return new Promise((resolve) => {
            this._promptResolve = resolve;
            const container = document.getElementById('modal-container');

            let inputHTML;
            if (selectOptions) {
                inputHTML = `<select id="prompt-input" class="form-select" style="width:100%;">
                    ${selectOptions.map(o => `<option value="${escapeHtml(o.value)}"${o.value === defaultValue ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
                </select>`;
            } else if (inputType === 'textarea') {
                inputHTML = `<textarea id="prompt-input" class="form-input" placeholder="${escapeHtml(placeholder)}" rows="3" style="width:100%;resize:vertical;">${escapeHtml(defaultValue)}</textarea>`;
            } else {
                inputHTML = `<input id="prompt-input" type="${inputType}" class="form-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" style="width:100%;">`;
            }

            const cleanupPrompt = () => {
                document.getElementById('main-content')?.removeAttribute('inert');
                if (this._escapeHandler) { document.removeEventListener('keydown', this._escapeHandler); this._escapeHandler = null; }
                if (this._focusTrapHandler) { document.removeEventListener('keydown', this._focusTrapHandler); this._focusTrapHandler = null; }
                container.innerHTML =sanitizeHTML( sanitizeHTML(''));  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') { this._previouslyFocused.focus(); this._previouslyFocused = null; }
            };
            const submitFn = () => {
                const val = document.getElementById('prompt-input')?.value || '';
                this._promptResolve = null;
                cleanupPrompt();
                resolve(val);
            };
            const cancelFn = () => {
                this._promptResolve = null;
                cleanupPrompt();
                resolve(null);
            };

            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            container.innerHTML =sanitizeHTML( sanitizeHTML(`
                <div class="modal-overlay" id="prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="prompt-title">
                    <div class="modal" onclick="event.stopPropagation()" style="max-width: 440px;">
                        <div class="modal-header">
                            <h2 class="modal-title" id="prompt-title">${escapeHtml(title)}</h2>
                            <button class="modal-close" id="prompt-close-btn" aria-label="Close">${components.icon('close')}</button>
                        </div>
                        <div class="modal-body">
                            <p style="margin-bottom: 12px; line-height: 1.5;">${escapeHtml(message)}</p>
                            <div style="margin-bottom: 16px;">${inputHTML}</div>
                            <div class="flex gap-3 justify-end">
                                <button class="btn btn-secondary" id="prompt-cancel-btn">${escapeHtml(cancelText)}</button>
                                <button class="btn btn-primary" id="prompt-ok-btn">${escapeHtml(submitText)}</button>
                            </div>
                        </div>
                    </div>
                </div>
            `));

            document.getElementById('prompt-overlay').onclick = (e) => { if (e.target === e.currentTarget) cancelFn(); };
            document.getElementById('prompt-close-btn').onclick = cancelFn;
            document.getElementById('prompt-cancel-btn').onclick = cancelFn;
            document.getElementById('prompt-ok-btn').onclick = submitFn;
            document.getElementById('main-content')?.setAttribute('inert', '');
            this._escapeHandler = (e) => { if (e.key === 'Escape') cancelFn(); };
            this._focusTrapHandler = (e) => {
                if (e.key !== 'Tab') return;
                const modal = container.querySelector('.modal');
                if (!modal) return;
                const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')).filter(el => el.offsetParent !== null);
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            };
            document.addEventListener('keydown', this._escapeHandler);
            document.addEventListener('keydown', this._focusTrapHandler);

            const input = document.getElementById('prompt-input');
            if (!selectOptions) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && inputType !== 'textarea') submitFn();
                });
            }

            setTimeout(() => { input.focus(); if (defaultValue && !selectOptions) input.select(); }, 50);
        });
    },

    addItem() {
        this.show(`
            <div class="modal-header">
                <div class="flex items-center gap-3">
                    <h2 class="modal-title">Add New Item</h2>
                    <button class="btn btn-primary btn-sm" onclick="modals.aiGenerateWizard()" title="Generate listing from image using AI">
                        ✨ AI Generate
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="modals.barcodeScanner()" title="Scan barcode to auto-fill">
                        ${components.icon('search', 16)} Scan Barcode
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="modals.selectTemplate()" title="Use a template">
                        ${components.icon('edit', 16)} Use Template
                    </button>
                </div>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="add-item-form" onsubmit="(function(e){var t=e.target.querySelector('[name=title]');var p=e.target.querySelector('[name=listPrice]');if(!t||!t.value.trim()){e.preventDefault();toast.error('Title is required');t&&t.focus();return;}if(!p||!(parseFloat(p.value)>0)){e.preventDefault();toast.error('List Price must be greater than 0');p&&p.focus();return;}handlers.addItem(e);})(event)">
                    <div class="form-group" style="margin-bottom: 24px;">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label">Product Images & Video</label>
                            <select class="form-select" name="imageCropRatio" style="width: auto; font-size: 13px; padding: 4px 8px;">
                                <option value="1:1">Square (1:1)</option>
                                <option value="4:5">Portrait (4:5)</option>
                                <option value="16:9">Landscape (16:9)</option>
                                <option value="auto">Auto-adjust</option>
                            </select>
                        </div>

                        <!-- Image Upload Tabs -->
                        <div class="tabs-container" style="margin-bottom: 12px;">
                            <div class="tabs-header" role="tablist" style="display: flex; border-bottom: 2px solid var(--gray-200); flex-wrap: wrap; gap: 4px;">
                                <button type="button" class="tab-btn active" role="tab" aria-selected="true" data-tab="upload" onclick="handlers.switchImageUploadTab('upload')" style="padding: 10px 16px; background: none; border: none; border-bottom: 2px solid var(--primary-600); color: var(--primary-600); font-weight: 600; cursor: pointer; margin-bottom: -2px;">
                                    ${components.icon('upload', 14)} Upload Files
                                </button>
                                <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="imagebank" onclick="handlers.switchImageUploadTab('imagebank')" style="padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--gray-600); font-weight: 500; cursor: pointer; margin-bottom: -2px;">
                                    ${components.icon('folder', 14)} Image Bank
                                </button>
                                <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="url" onclick="handlers.switchImageUploadTab('url')" style="padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--gray-600); font-weight: 500; cursor: pointer; margin-bottom: -2px;">
                                    ${components.icon('link', 14)} URL
                                </button>
                                <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="clipboard" onclick="handlers.switchImageUploadTab('clipboard')" style="padding: 10px 16px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--gray-600); font-weight: 500; cursor: pointer; margin-bottom: -2px;">
                                    📋 Clipboard
                                </button>
                            </div>

                            <div class="tabs-content">
                                <!-- Tab 1: Upload Files -->
                                <div class="tab-pane active" data-tab="upload">
                                    <div id="dropzone-add" class="dropzone" onclick="document.getElementById('item-images-input').click()" ondrop="handlers.handleDrop(event, 'add')" ondragover="handlers.handleDragOver(event)" ondragleave="handlers.handleDragLeave(event)">
                                        <div class="dropzone-content">
                                            ${components.icon('upload', 32)}
                                            <p style="font-weight: 500; margin-top: 8px;">Drag & drop files here or click to browse</p>
                                            <p style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">
                                                Supports up to 24 photos (PNG, JPEG) + 1 video (MP4)<br>
                                                Max 10MB per photo, 50MB for video
                                            </p>
                                        </div>
                                        <input type="file" class="hidden" id="item-images-input" accept="image/png,image/jpeg,video/mp4" multiple onchange="handlers.handleFileSelect(event, 'add')">
                                    </div>
                                </div>

                                <!-- Tab 2: Add by URL -->
                                <div class="tab-pane" data-tab="url" style="display: none; padding: 16px; background: var(--gray-50); border-radius: 8px;">
                                    <div style="display: flex; gap: 8px;">
                                        <input type="url" id="image-url-input" class="form-input" placeholder="https://example.com/image.jpg" style="flex: 1;">
                                        <button type="button" class="btn btn-primary" onclick="handlers.addImageFromURL()">
                                            ${components.icon('plus', 16)} Add
                                        </button>
                                    </div>
                                    <p style="font-size: 12px; color: var(--gray-500); margin-top: 8px;">Enter a direct image URL (must end with .jpg, .jpeg, or .png)</p>
                                </div>

                                <!-- Tab 3: Paste from Clipboard -->
                                <div class="tab-pane" data-tab="clipboard" style="display: none; padding: 24px; background: var(--gray-50); border-radius: 8px; text-align: center;">
                                    <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
                                    <p style="font-weight: 500; margin-bottom: 8px;">Press Ctrl+V (or Cmd+V on Mac) to paste an image</p>
                                    <p style="font-size: 13px; color: var(--gray-600);">Copy an image to your clipboard, then paste it here</p>
                                </div>

                                <!-- Tab 4: Image Bank -->
                                <div class="tab-pane" data-tab="imagebank" style="display: none; padding: 16px; background: var(--gray-50); border-radius: 8px;">
                                    <div id="imagebank-picker-add" class="imagebank-picker-container">
                                        <div class="imagebank-picker-toolbar" style="display: flex; gap: 8px; margin-bottom: 12px;">
                                            <input type="text" class="form-input" id="imagebank-search-add" placeholder="Search images..." style="flex: 1;" onkeyup="handlers.searchImageBankInline('add', this.value)">
                                            <button type="button" class="btn btn-secondary btn-sm" onclick="router.navigate('image-bank')" title="Go to Image Bank">
                                                ${components.icon('external-link', 14)} Open Image Bank
                                            </button>
                                        </div>
                                        <div id="imagebank-grid-add" class="imagebank-picker-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-height: 200px; overflow-y: auto; padding: 4px;">
                                            <div class="text-center text-gray-500 py-4" style="grid-column: 1 / -1;">Loading images...</div>
                                        </div>
                                        <p style="font-size: 12px; color: var(--gray-500); margin-top: 8px;">Click images to select them. Selected images will be added to your listing.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div id="media-preview-add" class="media-preview-grid"></div>
                    </div>
                    <div class="form-group">
                        <label for="add-item-title" class="form-label">Title *</label>
                        <input type="text" class="form-input" name="title" id="add-item-title" data-testid="add-item-title" required maxlength="80" placeholder="Item title (required)" oninput="(function(el){var c=el.value.length;var s=el.closest('.form-group').querySelector('.title-char-counter');if(s){s.textContent=c+'/80 chars (eBay/Poshmark limit)';s.style.color=c>80?'var(--error)':c>50?'var(--warning-600)':'var(--gray-500)'}})(this)">
                        <p class="title-char-counter text-xs mt-1" style="color: var(--gray-500);">0/80 chars (eBay/Poshmark limit)</p>
                    </div>
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label" style="margin-bottom: 0;">SKU (Stock Keeping Unit)</label>
                            <button type="button" class="btn btn-xs btn-secondary" onclick="handlers.autoGenerateSkuInModal('add')">
                                Auto-Generate
                            </button>
                        </div>
                        <input type="text" class="form-input" name="sku" id="add-item-sku" placeholder="Leave blank to auto-generate" maxlength="50" pattern="[A-Za-z0-9\-_./]+" title="Letters, numbers, hyphens, underscores, dots, and slashes only">
                        <p class="text-xs text-gray-500 mt-1">Unique identifier for this item. Will be auto-generated if left blank and a default rule exists.</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label for="add-item-brand" class="form-label">Brand</label>
                            <input type="text" class="form-input" name="brand" id="add-item-brand" data-testid="add-item-brand" maxlength="50">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select class="form-select" name="category" id="category-select" onchange="handlers.toggleCustomCategory(this.value)">
                                <option value="">Select...</option>
                                <option>Tops</option>
                                <option>Bottoms</option>
                                <option>Dresses</option>
                                <option>Outerwear</option>
                                <option>Footwear</option>
                                <option>Bags</option>
                                <option>Accessories</option>
                                <option value="other">Other</option>
                            </select>
                            <input type="text" class="form-input mt-2 hidden" name="customCategory" id="custom-category-input" placeholder="Enter custom category">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Size Type</label>
                            <select class="form-select" name="sizeType" id="size-type-select" onchange="handlers.updateSizeOptions(this.value)">
                                <option value="clothing">Clothing (XS-5XL)</option>
                                <option value="shoes_us">Shoes (US)</option>
                                <option value="shoes_eu">Shoes (EU)</option>
                                <option value="pants">Pants (Waist)</option>
                                <option value="numeric">Numeric</option>
                                <option value="one_size">One Size</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Size</label>
                            <select class="form-select" name="size" id="size-select">
                                <option value="">Select size...</option>
                                <option value="XXS">XXS</option>
                                <option value="XS">XS</option>
                                <option value="S">S</option>
                                <option value="M">M</option>
                                <option value="L">L</option>
                                <option value="XL">XL</option>
                                <option value="XXL">XXL</option>
                                <option value="3XL">3XL</option>
                                <option value="4XL">4XL</option>
                                <option value="5XL">5XL</option>
                            </select>
                            <input type="text" class="form-input mt-2 hidden" name="customSize" id="custom-size-input" placeholder="Enter custom size (e.g. 32, XL, 10W)" maxlength="20" pattern="[A-Za-z0-9/.\\- ]+" oninput="handlers.validateCustomSize(this)">
                            <div id="custom-size-error" class="text-error" style="font-size: 11px; color: var(--error); display: none; margin-top: 4px;"></div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label for="add-item-color" class="form-label">Color</label>
                            <input type="text" class="form-input" name="color" id="add-item-color" data-testid="add-item-color" maxlength="50">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Condition</label>
                            <select class="form-select" name="condition" required>
                                <option value="new">New with Tags</option>
                                <option value="like_new">Like New</option>
                                <option value="good" selected>Good</option>
                                <option value="fair">Fair</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label">Variations</label>
                            <button type="button" class="btn btn-sm btn-outline" onclick="handlers.addVariation()">
                                ${components.icon('plus', 14)} Add Variation
                            </button>
                        </div>
                        <div id="variations-list" style="display: grid; gap: 8px;">
                            <!-- Variations will be added here dynamically -->
                        </div>
                        <p style="font-size: 12px; color: var(--gray-500); margin-top: 8px;">Add color variants, patterns, or other options (e.g., Blue, Striped)</p>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Cost Price</label>
                            <input type="number" class="form-input" name="costPrice" step="0.01" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">List Price *</label>
                            <input type="number" class="form-input" name="listPrice" step="0.01" min="0" required id="base-list-price" oninput="handlers.syncPlatformPrices(this.value)">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Purchase Date</label>
                            <input type="date" class="form-input" name="purchaseDate">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Supplier</label>
                            <input type="text" class="form-input" name="supplier" placeholder="e.g., Goodwill, Estate Sale">
                        </div>
                    </div>

                    <!-- Platform-Specific Pricing -->
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label" style="margin-bottom: 0;">Platform Pricing</label>
                            <label class="flex items-center gap-2 text-sm" style="cursor: pointer;">
                                <input type="checkbox" id="custom-platform-pricing" onchange="handlers.togglePlatformPricing(this.checked)">
                                <span>Set custom prices per platform</span>
                            </label>
                        </div>
                        <div id="platform-pricing-section" class="hidden">
                            <div class="grid grid-cols-3 gap-3 p-3 rounded" style="background: var(--gray-50);">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs flex items-center gap-1">
                                        <span style="color: #AC1A2F;">●</span> Poshmark
                                    </label>
                                    <input type="number" class="form-input" id="price-poshmark" name="pricePoshmark" step="0.01" min="0" placeholder="Use base price" onfocus="handlers.markPriceCustomized('poshmark')">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs flex items-center gap-1">
                                        <span style="color: #E53238;">●</span> eBay
                                    </label>
                                    <input type="number" class="form-input" id="price-ebay" name="priceEbay" step="0.01" min="0" placeholder="Use base price" onfocus="handlers.markPriceCustomized('ebay')">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs flex items-center gap-1">
                                        <span style="color: #FF3B58;">●</span> Mercari
                                    </label>
                                    <input type="number" class="form-input" id="price-mercari" name="priceMercari" step="0.01" min="0" placeholder="Use base price" onfocus="handlers.markPriceCustomized('whatnot')">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs flex items-center gap-1">
                                        <span style="color: #FF2300;">●</span> Depop
                                    </label>
                                    <input type="number" class="form-input" id="price-depop" name="priceDepop" step="0.01" min="0" placeholder="Use base price" onfocus="handlers.markPriceCustomized('depop')">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs flex items-center gap-1">
                                        <span style="color: #000000;">●</span> Grailed
                                    </label>
                                    <input type="number" class="form-input" id="price-grailed" name="priceGrailed" step="0.01" min="0" placeholder="Use base price" onfocus="handlers.markPriceCustomized('shopify')">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs flex items-center gap-1">
                                        <span style="color: #1877F2;">●</span> Facebook
                                    </label>
                                    <input type="number" class="form-input" id="price-facebook" name="priceFacebook" step="0.01" min="0" placeholder="Use base price" onfocus="handlers.markPriceCustomized('facebook')">
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Leave blank to use the base list price. Account for platform fees when setting prices.</p>
                        </div>
                    </div>

                    <!-- eBay Promotion Settings -->
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label" style="margin-bottom: 0;">eBay Promoted Listings</label>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-gray-500">Mode:</span>
                                <button type="button" class="btn btn-xs ${!store.state.ebayPromoAdvanced ? 'btn-primary' : 'btn-secondary'}" onclick="handlers.toggleEbayPromoMode(false)">Simple</button>
                                <button type="button" class="btn btn-xs ${store.state.ebayPromoAdvanced ? 'btn-primary' : 'btn-secondary'}" onclick="handlers.toggleEbayPromoMode(true)">Advanced</button>
                            </div>
                        </div>
                        <div id="ebay-promo-simple" class="${store.state.ebayPromoAdvanced ? 'hidden' : ''}">
                            <div class="flex items-center gap-3 p-3 rounded" style="background: var(--gray-50);">
                                <label class="flex items-center gap-2" style="cursor: pointer;">
                                    <input type="checkbox" name="ebayPromoEnabled" onchange="handlers.toggleEbayPromoSlider(this.checked)">
                                    <span class="text-sm font-medium">Enable Promoted Listing</span>
                                </label>
                                <div id="ebay-promo-slider" class="hidden flex items-center gap-2" style="flex: 1;">
                                    <input type="range" name="ebayPromotionRate" min="1" max="20" value="2" class="form-range" style="flex: 1;" oninput="document.getElementById('promo-rate-display').textContent = this.value + '%'">
                                    <span id="promo-rate-display" class="text-sm font-bold" style="min-width: 40px;">2%</span>
                                </div>
                            </div>
                            <p class="text-xs text-gray-500 mt-1">Suggested rate: 2-5% for standard items, 5-10% for competitive categories</p>
                        </div>
                        <div id="ebay-promo-advanced" class="${!store.state.ebayPromoAdvanced ? 'hidden' : ''}">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs">Ad Rate (%)</label>
                                    <input type="number" class="form-input" name="ebayPromotionRateAdv" min="0" max="100" step="0.01" placeholder="0">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs">Campaign Type</label>
                                    <select class="form-select" name="ebayPromotionType">
                                        <option value="">No Promotion</option>
                                        <option value="standard">Standard (Cost per Sale)</option>
                                        <option value="express">Express (Priority Placement)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-4 mt-2">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs">Daily Budget ($)</label>
                                    <input type="number" class="form-input" name="ebayDailyBudget" min="0" step="1" placeholder="No limit">
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label class="form-label text-xs">End Date</label>
                                    <input type="date" class="form-input" name="ebayPromoEndDate">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Quantity on Hand *</label>
                            <input type="number" class="form-input" name="quantity" min="0" value="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Low Stock Threshold</label>
                            <input type="number" class="form-input" name="lowStockThreshold" min="1" value="5" placeholder="Alert when stock falls below this number">
                        </div>
                    </div>

                    <!-- Warehouse Location Section -->
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label" style="margin-bottom: 0;">Warehouse Location</label>
                            <button type="button" class="btn btn-xs btn-secondary" onclick="handlers.showQuickLocationPicker('add')">
                                ${components.icon('map-pin', 12)} Quick Select
                            </button>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <input type="text" class="form-input" name="location" id="add-item-location" placeholder="e.g., Warehouse A, Storage Room" maxlength="100">
                                <p class="text-xs text-gray-500 mt-1">General location or area</p>
                            </div>
                            <div>
                                <input type="text" class="form-input" name="binLocation" id="add-item-bin" placeholder="e.g., A1-03-B, Shelf 2 Bin 4" maxlength="50">
                                <p class="text-xs text-gray-500 mt-1">Specific bin/shelf position</p>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <div id="add-item-rich-editor"></div>
                        <input type="hidden" name="description" id="add-item-description">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <div style="display: flex; gap: 8px;">
                    <div class="dropdown" style="position: relative;">
                        <button type="button" class="btn btn-outline" onclick="event.stopPropagation(); this.parentElement.classList.toggle('open')">
                            Save as Draft ${components.icon('chevron-down', 14)}
                        </button>
                        <div class="dropdown-menu" style="min-width: 200px; bottom: 100%; top: auto; margin-bottom: 4px;">
                            <button class="dropdown-item" onclick="handlers.saveItemAsDraft(event, 'vaultlister')">
                                ${components.icon('database', 14)} VaultLister Only
                                <span class="text-xs text-gray-500 block">Save locally, don't publish</span>
                            </button>
                            <button class="dropdown-item" onclick="handlers.saveItemAsDraft(event, 'platforms')">
                                ${components.icon('upload', 14)} Platforms as Draft
                                <span class="text-xs text-gray-500 block">Push as draft to marketplaces</span>
                            </button>
                            <button class="dropdown-item" onclick="handlers.saveItemAsDraft(event, 'both')">
                                ${components.icon('check', 14)} Both (Recommended)
                                <span class="text-xs text-gray-500 block">Save locally + draft on platforms</span>
                            </button>
                        </div>
                    </div>
                    <button class="btn btn-outline" onclick="handlers.saveListingAsTemplate()" title="Save current form as a reusable template">
                        ${components.icon('save', 14)} Save Template
                    </button>
                    <button class="btn btn-primary" onclick="document.getElementById('add-item-form').requestSubmit()">
                        Add & Publish
                    </button>
                </div>
            </div>
        `, 'modal-xl');
        // Wire rich text editor for description field + auto-save
        setTimeout(() => {
            richTextEditor.init('add-item-rich-editor', { onInput: (html) => { document.getElementById('add-item-description').value = html; } });
            autoSave.init('add-item-form', 'add-item', 1500);
        }, 100);
    },

    async showItemHistory(itemId) {
        // Find the item in store
        const item = (store.state.inventory || []).find(i => i.id === itemId);
        if (!item) {
            toast.error('Item not found');
            return;
        }

        // Show loading state
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Item History</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary-500"></div>
                    <p class="mt-2 text-gray-600">Loading history...</p>
                </div>
            </div>
        `, 'modal-lg');

        try {
            // Fetch item history from API
            const historyData = await api.get(`/inventory/${itemId}/history`);
            const purchases = historyData.purchases || [];
            const sales = historyData.sales || [];
            const priceHistory = historyData.priceHistory || [];

            // Calculate summary stats
            const totalPurchaseCost = purchases.reduce((sum, p) => sum + (p.total_cost || p.unit_cost || 0), 0);
            const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
            const totalProfit = totalSalesRevenue - totalPurchaseCost;

            // Get item image
            const images = typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []);
            const imageUrl = images[0] || null;

            this.show(`
                <div class="modal-header">
                    <h2 class="modal-title">Item History</h2>
                    <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    <!-- Item Summary -->
                    <div class="flex gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.title)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-md);">` :
                        `<div style="width: 80px; height: 80px; border-radius: var(--radius-md); background: var(--primary-100); display: flex; align-items: center; justify-content: center;">
                            ${components.icon('package', 32)}
                        </div>`}
                        <div class="flex-1">
                            <h3 class="font-semibold text-lg">${escapeHtml(item.title)}</h3>
                            <p class="text-sm text-gray-600">${escapeHtml(item.brand || '')} ${item.size ? '• Size: ' + escapeHtml(item.size) : ''}</p>
                            <p class="text-sm text-gray-500">SKU: ${escapeHtml(item.sku || 'N/A')}</p>
                            <div class="flex gap-4 mt-2">
                                <span class="text-sm"><strong>List Price:</strong> $${(item.list_price || 0).toFixed(2)}</span>
                                <span class="text-sm"><strong>Cost:</strong> $${(item.cost_price || 0).toFixed(2)}</span>
                                <span class="text-sm"><strong>Qty:</strong> ${item.quantity || 1}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Summary Stats -->
                    <div class="grid grid-cols-3 gap-4 mb-6">
                        <div class="stat-card" style="padding: 16px; background: var(--gray-50); border-radius: var(--radius-md); text-align: center;">
                            <div class="text-2xl font-bold text-gray-700">$${totalPurchaseCost.toFixed(2)}</div>
                            <div class="text-xs text-gray-500">Total Cost</div>
                        </div>
                        <div class="stat-card" style="padding: 16px; background: var(--gray-50); border-radius: var(--radius-md); text-align: center;">
                            <div class="text-2xl font-bold text-success">$${totalSalesRevenue.toFixed(2)}</div>
                            <div class="text-xs text-gray-500">Total Revenue</div>
                        </div>
                        <div class="stat-card" style="padding: 16px; background: var(--gray-50); border-radius: var(--radius-md); text-align: center;">
                            <div class="text-2xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-error'}">$${totalProfit.toFixed(2)}</div>
                            <div class="text-xs text-gray-500">Net Profit</div>
                        </div>
                    </div>

                    <!-- Tabs for Purchases and Sales -->
                    <div class="tabs-container">
                        <div class="tabs-header" role="tablist" style="display: flex; border-bottom: 2px solid var(--gray-200); margin-bottom: 16px;">
                            <button type="button" class="tab-btn active" role="tab" aria-selected="true" data-tab="purchases" onclick="handlers.switchItemHistoryTab('purchases')" style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid var(--primary-600); color: var(--primary-600); font-weight: 600; cursor: pointer; margin-bottom: -2px;">
                                ${components.icon('shopping-cart', 14)} Purchases (${purchases.length})
                            </button>
                            <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="sales" onclick="handlers.switchItemHistoryTab('sales')" style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--gray-600); font-weight: 500; cursor: pointer; margin-bottom: -2px;">
                                ${components.icon('dollar-sign', 14)} Sales (${sales.length})
                            </button>
                            ${priceHistory.length > 0 ? `
                            <button type="button" class="tab-btn" role="tab" aria-selected="false" data-tab="price-history" onclick="handlers.switchItemHistoryTab('price-history')" style="padding: 10px 20px; background: none; border: none; border-bottom: 2px solid transparent; color: var(--gray-600); font-weight: 500; cursor: pointer; margin-bottom: -2px;">
                                ${components.icon('trending-up', 14)} Price History
                            </button>
                            ` : ''}
                        </div>

                        <!-- Purchases Tab -->
                        <div class="tab-pane active" data-tab="purchases">
                            ${purchases.length > 0 ? `
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Vendor</th>
                                            <th>Qty</th>
                                            <th>Unit Cost</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${purchases.map(p => `
                                            <tr>
                                                <td>${new Date(p.purchase_date || p.created_at).toLocaleDateString()}</td>
                                                <td>${escapeHtml(p.vendor_name || 'Unknown')}</td>
                                                <td>${p.quantity || 1}</td>
                                                <td>$${(p.unit_cost || 0).toFixed(2)}</td>
                                                <td>$${(p.total_cost || p.unit_cost || 0).toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="text-center py-8 text-gray-500">
                                    ${components.icon('shopping-cart', 32)}
                                    <p class="mt-2">No purchase records found</p>
                                </div>
                            `}
                        </div>

                        <!-- Sales Tab -->
                        <div class="tab-pane" data-tab="sales" style="display: none;">
                            ${sales.length > 0 ? `
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Platform</th>
                                            <th>Buyer</th>
                                            <th>Sale Price</th>
                                            <th>Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sales.map(s => `
                                            <tr>
                                                <td>${new Date(s.sale_date || s.created_at).toLocaleDateString()}</td>
                                                <td>${components.platformBadge(s.platform || 'other')}</td>
                                                <td>${escapeHtml(s.buyer_username || 'N/A')}</td>
                                                <td>$${(s.sale_price || 0).toFixed(2)}</td>
                                                <td class="${(s.net_profit || 0) >= 0 ? 'text-success' : 'text-error'}">$${(s.net_profit || 0).toFixed(2)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            ` : `
                                <div class="text-center py-8 text-gray-500">
                                    ${components.icon('dollar-sign', 32)}
                                    <p class="mt-2">No sales records found</p>
                                </div>
                            `}
                        </div>

                        <!-- Price History Tab -->
                        ${priceHistory.length > 0 ? `
                        <div class="tab-pane" data-tab="price-history" style="display: none;">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Old Price</th>
                                        <th>New Price</th>
                                        <th>Change</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${priceHistory.map(p => {
                                        const change = (p.new_price || 0) - (p.old_price || 0);
                                        return `
                                            <tr>
                                                <td>${new Date(p.changed_at || p.created_at).toLocaleDateString()}</td>
                                                <td>$${(p.old_price || 0).toFixed(2)}</td>
                                                <td>$${(p.new_price || 0).toFixed(2)}</td>
                                                <td class="${change >= 0 ? 'text-success' : 'text-error'}">${change >= 0 ? '+' : ''}$${change.toFixed(2)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="modals.close()">Close</button>
                    <button class="btn btn-primary" onclick="modals.close(); handlers.editItem('${itemId}')">
                        ${components.icon('edit', 14)} Edit Item
                    </button>
                </div>
            `, 'modal-lg');
        } catch (error) {
            console.error('Error loading item history:', error);
            this.show(`
                <div class="modal-header">
                    <h2 class="modal-title">Item History</h2>
                    <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
                </div>
                <div class="modal-body">
                    <div class="text-center py-8">
                        ${components.icon('alert-circle', 48)}
                        <p class="mt-2 text-gray-600">Failed to load item history</p>
                        <p class="text-sm text-gray-500">${escapeHtml(error.message || 'Unknown error')}</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="modals.close()">Close</button>
                </div>
            `, 'modal-lg');
        }
    },

    editItem(item) {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Edit Item</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="edit-item-form-${item.id}" onsubmit="handlers.updateItem(event, '${item.id}')">
                    <div class="form-group" style="margin-bottom: 24px;">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label">Product Images & Video</label>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="handlers.openImageBankPicker('edit')">
                                ${components.icon('folder', 16)} Browse Image Bank
                            </button>
                        </div>
                        <div id="existing-images-container" class="media-preview-grid" style="margin-bottom: 12px;">
                            ${(() => {
                                try {
                                    const images = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                                    return images.map((img, idx) => `
                                        <div class="media-preview-item" data-image-index="${idx}">
                                            <img src="${escapeHtml(img)}" alt="Product image ${idx + 1}">
                                            <button type="button" class="media-remove-btn" onclick="handlers.removeExistingImage('${item.id}', ${idx})" title="Remove image">×</button>
                                        </div>
                                    `).join('');
                                } catch (e) {
                                    console.error('Error parsing item images:', e); // nosemgrep: javascript.lang.security.audit.unsafe-formatstring
                                    return '';
                                }
                            })()}
                        </div>
                        <div id="dropzone-edit" class="dropzone" onclick="document.getElementById('edit-item-images-input').click()" ondrop="handlers.handleDrop(event, 'edit')" ondragover="handlers.handleDragOver(event)" ondragleave="handlers.handleDragLeave(event)">
                            <div class="dropzone-content">
                                ${components.icon('upload', 24)}
                                <p style="font-weight: 500; font-size: 14px; margin-top: 8px;">Add more files</p>
                                <p style="font-size: 11px; color: var(--gray-500); margin-top: 4px;">Up to 24 photos + 1 video</p>
                            </div>
                            <input type="file" class="hidden" id="edit-item-images-input" accept="image/png,image/jpeg,video/mp4" multiple onchange="handlers.handleFileSelect(event, 'edit')">
                        </div>
                        <div id="media-preview-edit" class="media-preview-grid"></div>
                        <input type="hidden" id="removed-images" name="removedImages" value="">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Title *</label>
                        <input type="text" class="form-input" name="title" value="${escapeHtml(item.title)}" required>
                    </div>
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label" style="margin-bottom: 0;">SKU (Stock Keeping Unit)</label>
                            <button type="button" class="btn btn-xs btn-secondary" onclick="handlers.autoGenerateSkuInModal('edit', '${item.id}')">
                                Regenerate
                            </button>
                        </div>
                        <input type="text" class="form-input" name="sku" id="edit-item-sku" value="${escapeHtml(item.sku || '')}">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Brand</label>
                            <input type="text" class="form-input" name="brand" value="${escapeHtml(item.brand || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <input type="text" class="form-input" name="category" value="${escapeHtml(item.category || '')}">
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-4">
                        <div class="form-group">
                            <label class="form-label">Size</label>
                            <input type="text" class="form-input" name="size" value="${escapeHtml(item.size || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Color</label>
                            <input type="text" class="form-input" name="color" value="${escapeHtml(item.color || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Condition</label>
                            <select class="form-select" name="condition">
                                <option value="new" ${item.condition === 'new' ? 'selected' : ''}>New with Tags</option>
                                <option value="like_new" ${item.condition === 'like_new' ? 'selected' : ''}>Like New</option>
                                <option value="good" ${item.condition === 'good' ? 'selected' : ''}>Good</option>
                                <option value="fair" ${item.condition === 'fair' ? 'selected' : ''}>Fair</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Cost Price</label>
                            <input type="number" class="form-input" name="costPrice" step="0.01" value="${item.cost_price || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">List Price *</label>
                            <input type="number" class="form-input" name="listPrice" step="0.01" value="${item.list_price}" required>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Quantity on Hand *</label>
                            <input type="number" class="form-input" name="quantity" min="0" value="${item.quantity != null ? item.quantity : 1}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Low Stock Threshold</label>
                            <input type="number" class="form-input" name="lowStockThreshold" min="1" value="${item.low_stock_threshold || 5}" placeholder="Alert when stock falls below this number">
                        </div>
                    </div>

                    <!-- Warehouse Location Section -->
                    <div class="form-group">
                        <div class="flex justify-between items-center mb-2">
                            <label class="form-label" style="margin-bottom: 0;">Warehouse Location</label>
                            <button type="button" class="btn btn-xs btn-secondary" onclick="handlers.showQuickLocationPicker('edit')">
                                ${components.icon('map-pin', 12)} Quick Select
                            </button>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <input type="text" class="form-input" name="location" id="edit-item-location" value="${escapeHtml(item.location || '')}" placeholder="e.g., Warehouse A, Storage Room">
                                <p class="text-xs text-gray-500 mt-1">General location or area</p>
                            </div>
                            <div>
                                <input type="text" class="form-input" name="binLocation" id="edit-item-bin" value="${escapeHtml(item.bin_location || '')}" placeholder="e.g., A1-03-B, Shelf 2 Bin 4">
                                <p class="text-xs text-gray-500 mt-1">Specific bin/shelf position</p>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select class="form-select" name="status" required>
                            <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Archived</option>
                            <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Draft</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-textarea" name="description" rows="3">${escapeHtml(item.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Seller Notes</label>
                        <textarea class="form-textarea" name="notes" rows="3">${escapeHtml(item.notes || '')}</textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('edit-item-form-${item.id}').requestSubmit()">Save Changes</button>
            </div>
        `);
    },

    bulkEdit(ids) {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Bulk Edit (${ids.length} items)</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <form id="bulk-edit-form" onsubmit="handlers.submitBulkEdit(event, ${JSON.stringify(ids).replace(/"/g, '&quot;')})">
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Action</label>
                        <select class="form-select" name="action" required onchange="handlers.showBulkFields(this.value)">
                            <option value="">Select action...</option>
                            <option value="updateStatus">Update Status</option>
                            <option value="updatePrice">Update Price</option>
                        </select>
                    </div>
                    <div id="bulk-fields"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Apply</button>
                </div>
            </form>
        `);
    },

    addAutomation() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">New Automation</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <p class="text-gray-600 mb-4">Select an automation type to get started:</p>
                <div class="flex flex-col gap-3">
                    ${[
                        { id: 'closet-share', name: 'Daily Closet Share', desc: 'Share all items 3x daily' },
                        { id: 'party-share', name: 'Party Share', desc: 'Auto-share during Posh parties' },
                        { id: 'follow-back', name: 'Follow Back', desc: 'Automatically follow new followers' },
                        { id: 'auto-accept-90', name: 'Auto Accept 90%+ Offers', desc: 'Accept offers above 90%' },
                        { id: 'auto-decline-50', name: 'Decline Lowball Offers', desc: 'Decline offers below 50%' },
                        { id: 'price-drop-weekly', name: 'Weekly Price Drop', desc: 'Reduce prices weekly' },
                        { id: 'relist-stale', name: 'Relist Stale Items', desc: 'Relist items not sold in 60 days' }
                    ].map(a => `
                        <button class="flex items-center gap-4 p-4 border rounded-lg text-left hover:bg-gray-50 w-full"
                                style="border-color: var(--gray-200)"
                                onclick="handlers.createFromPreset('${a.id}')">
                            <div class="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
                                ${components.icon('automation', 20)}
                            </div>
                            <div class="flex-1">
                                <div class="font-semibold">${a.name}</div>
                                <div class="text-sm text-gray-500">${a.desc}</div>
                            </div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `);
    },

    crosslistItems(itemIds) {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Cross-List ${itemIds.length} Item(s)</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="crosslist-form" onsubmit="handlers.submitCrosslist(event, '${itemIds.join(',')}')">
                    <p style="margin-bottom: 16px;">Select platforms to list on:</p>
                    <div style="display: grid; gap: 12px;">
                        ${['poshmark', 'ebay', 'mercari', 'depop', 'grailed', 'etsy', 'shopify', 'facebook', 'whatnot'].map(platform => {
                            const isLaunch = (window.LAUNCH_PLATFORMS || new Set(['poshmark', 'ebay', 'depop', 'facebook', 'whatnot'])).has(platform);
                            return `
                            <label style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 2px solid var(--gray-200); border-radius: 8px; ${isLaunch ? 'cursor: pointer;' : 'cursor: not-allowed; opacity: 0.55;'}" ${isLaunch ? '' : 'title="Coming soon"'}>
                                <input type="checkbox" name="platforms" value="${platform}" ${isLaunch ? '' : 'disabled'}>
                                ${components.platformBadge(platform)}
                                <span style="flex: 1; font-weight: 500;">${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                                ${isLaunch ? '' : '<span class="coming-soon-badge">Coming Soon</span>'}
                            </label>`;
                        }).join('')}
                    </div>
                    <div style="margin-top: 16px;">
                        <label class="form-label">Price Adjustment (%)</label>
                        <input type="number" name="priceAdjust" class="form-input" value="0" step="5" placeholder="e.g., +10 for 10% increase">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('crosslist-form').requestSubmit()">
                    Cross-List Now
                </button>
            </div>
        `);
    },

    showInventoryImport() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${components.icon('import', 20)} Import Inventory</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <p class="text-gray-600 mb-4">Import inventory from CSV, Excel, TSV, or JSON files.</p>

                <!-- File Upload Zone -->
                <div class="import-dropzone" id="import-modal-dropzone"
                     ondragover="event.preventDefault(); this.classList.add('dragover')"
                     ondragleave="this.classList.remove('dragover')"
                     ondrop="event.preventDefault(); this.classList.remove('dragover'); handlers.handleImportDrop(event)"
                     style="border: 2px dashed var(--gray-300); border-radius: 12px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s;"
                     onclick="document.getElementById('import-modal-file').click()">
                    <div style="color: var(--gray-400); margin-bottom: 12px;">${components.icon('upload', 48)}</div>
                    <p class="font-medium">Drop your file here or click to browse</p>
                    <p class="text-sm text-gray-500 mt-2">Supports CSV, XLSX, TSV, JSON</p>
                    <input type="file" id="import-modal-file" accept=".csv,.xlsx,.xls,.tsv,.json" style="display: none;"
                           onchange="handlers.handleImportFile(this.files[0]); modals.close();">
                </div>

                <!-- Quick Paste Option -->
                <div class="mt-4">
                    <div class="text-center text-gray-500 mb-3">— or paste data directly —</div>
                    <textarea id="import-modal-paste" class="form-input" rows="4"
                              placeholder="Paste CSV data here (header row required)..."
                              style="font-family: monospace; font-size: 12px;"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-outline" onclick="modals.close(); router.navigate('inventory-import');">
                    ${components.icon('settings', 14)} Advanced Import
                </button>
                <button class="btn btn-primary" onclick="const data = document.getElementById('import-modal-paste').value; if(data.trim()) { handlers.startImportFromPasteModal(data); } else { toast.info('Please upload a file or paste data'); }">
                    ${components.icon('import', 14)} Import
                </button>
            </div>
        `, 'modal-lg');
    },

    chooseListingMode() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Create New Listing</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <p class="text-gray-600 mb-6">Choose how you'd like to create your listing:</p>
                <div class="grid grid-cols-2 gap-4">
                    <div class="listing-mode-card" onclick="modals.close(); modals.addItem()">
                        <div class="listing-mode-card-icon">
                            ${components.icon('crosslist', 32)}
                        </div>
                        <h3 class="font-semibold text-lg mb-2">Quick Cross List</h3>
                        <p class="text-sm text-gray-500">Create a single listing and optionally list on multiple platforms. Same details for all platforms. Best for simple, fast listings.</p>
                    </div>
                    <div class="listing-mode-card" onclick="modals.close(); router.navigate('crosslist')">
                        <div class="listing-mode-card-icon">
                            ${components.icon('settings', 32)}
                        </div>
                        <h3 class="font-semibold text-lg mb-2">Advanced Cross List</h3>
                        <p class="text-sm text-gray-500">Customize your listing for each platform individually. Set platform-specific titles, descriptions, pricing, and fields. Best for maximizing visibility and sales.</p>
                    </div>
                </div>
            </div>
        `, 'modal-xl');
    },

    createTemplate(fromCurrentItem = null) {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Create Listing Template</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="create-template-form" onsubmit="handlers.submitCreateTemplate(event)">
                    <div class="form-group">
                        <label class="form-label">Template Name *</label>
                        <input type="text" name="name" class="form-input" required placeholder="e.g., Designer Handbag Template">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <input type="text" name="description" class="form-input" placeholder="Optional description">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select name="category" class="form-select">
                                <option value="">Select category...</option>
                                <option value="Tops">Tops</option>
                                <option value="Bottoms">Bottoms</option>
                                <option value="Dresses">Dresses</option>
                                <option value="Outerwear">Outerwear</option>
                                <option value="Shoes">Shoes</option>
                                <option value="Bags">Bags</option>
                                <option value="Accessories">Accessories</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Default Condition</label>
                            <select name="conditionDefault" class="form-select">
                                <option value="">Select condition...</option>
                                <option value="new">New with Tags</option>
                                <option value="like_new">Like New</option>
                                <option value="good">Good</option>
                                <option value="fair">Fair</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Title Pattern</label>
                        <input type="text" name="titlePattern" class="form-input" placeholder="e.g., {Brand} {Category} - {Color}">
                        <p class="text-xs text-gray-500 mt-1">Use {Brand}, {Category}, {Color}, {Size} as placeholders</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description Template</label>
                        <textarea name="descriptionTemplate" class="form-input" rows="4" placeholder="Enter your default description template..."></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Default Tags</label>
                        <input type="text" name="tags" class="form-input" placeholder="Comma-separated tags">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Pricing Strategy</label>
                            <select name="pricingStrategy" class="form-select">
                                <option value="fixed">Fixed Price</option>
                                <option value="cost_plus">Cost Plus Markup</option>
                                <option value="market">Market Based</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Markup %</label>
                            <input type="number" name="markupPercentage" class="form-input" value="0" min="0" max="500" step="5">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" name="isFavorite">
                            <span class="text-sm">Mark as favorite</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('create-template-form').requestSubmit()">
                    Create Template
                </button>
            </div>
        `);
    },

    editTemplate(templateId) {
        const template = store.state.templates.find(t => t.id === templateId);
        if (!template) {
            toast.info('Please navigate to the Templates page to edit this template.');
            return;
        }

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Edit Template</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="edit-template-form" onsubmit="handlers.submitEditTemplate(event, '${templateId}')">
                    <div class="form-group">
                        <label class="form-label">Template Name *</label>
                        <input type="text" name="name" class="form-input" required value="${escapeHtml(template.name)}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <input type="text" name="description" class="form-input" value="${escapeHtml(template.description || '')}">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select name="category" class="form-select">
                                <option value="">Select category...</option>
                                <option value="Tops" ${template.category === 'Tops' ? 'selected' : ''}>Tops</option>
                                <option value="Bottoms" ${template.category === 'Bottoms' ? 'selected' : ''}>Bottoms</option>
                                <option value="Dresses" ${template.category === 'Dresses' ? 'selected' : ''}>Dresses</option>
                                <option value="Outerwear" ${template.category === 'Outerwear' ? 'selected' : ''}>Outerwear</option>
                                <option value="Shoes" ${template.category === 'Shoes' ? 'selected' : ''}>Shoes</option>
                                <option value="Bags" ${template.category === 'Bags' ? 'selected' : ''}>Bags</option>
                                <option value="Accessories" ${template.category === 'Accessories' ? 'selected' : ''}>Accessories</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Default Condition</label>
                            <select name="conditionDefault" class="form-select">
                                <option value="">Select condition...</option>
                                <option value="new" ${template.condition_default === 'new' ? 'selected' : ''}>New with Tags</option>
                                <option value="like_new" ${template.condition_default === 'like_new' ? 'selected' : ''}>Like New</option>
                                <option value="good" ${template.condition_default === 'good' ? 'selected' : ''}>Good</option>
                                <option value="fair" ${template.condition_default === 'fair' ? 'selected' : ''}>Fair</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Title Pattern</label>
                        <input type="text" name="titlePattern" class="form-input" value="${escapeHtml(template.title_pattern || '')}" placeholder="e.g., {Brand} {Category} - {Color}">
                        <p class="text-xs text-gray-500 mt-1">Use {Brand}, {Category}, {Color}, {Size} as placeholders</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description Template</label>
                        <textarea name="descriptionTemplate" class="form-input" rows="4">${escapeHtml(template.description_template || '')}</textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Default Tags</label>
                        <input type="text" name="tags" class="form-input" value="${template.tags ? template.tags.join(', ') : ''}">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Pricing Strategy</label>
                            <select name="pricingStrategy" class="form-select">
                                <option value="fixed" ${template.pricing_strategy === 'fixed' ? 'selected' : ''}>Fixed Price</option>
                                <option value="cost_plus" ${template.pricing_strategy === 'cost_plus' ? 'selected' : ''}>Cost Plus Markup</option>
                                <option value="market" ${template.pricing_strategy === 'market' ? 'selected' : ''}>Market Based</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Markup %</label>
                            <input type="number" name="markupPercentage" class="form-input" value="${template.markup_percentage || 0}" min="0" max="500" step="5">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" name="isFavorite" ${template.is_favorite ? 'checked' : ''}>
                            <span class="text-sm">Mark as favorite</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('edit-template-form').requestSubmit()">
                    Save Changes
                </button>
            </div>
        `);
    },

    selectTemplate() {
        const templates = store.state.templates || [];

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Select a Template</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                ${templates.length > 0 ? `
                    <div class="flex flex-col gap-3">
                        ${templates.map(template => `
                            <button class="text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors" style="border-color: var(--gray-200)" onclick="handlers.applyTemplate('${template.id}')">
                                <div class="flex items-start justify-between">
                                    <div class="flex-1">
                                        <div class="font-semibold">${escapeHtml(template.name)}</div>
                                        ${template.description ? `<div class="text-sm text-gray-600 mt-1">${escapeHtml(template.description)}</div>` : ''}
                                        <div class="flex gap-2 mt-2">
                                            ${template.category ? `<span class="badge badge-gray text-xs">${escapeHtml(template.category)}</span>` : ''}
                                            ${template.is_favorite ? `<span class="badge badge-warning text-xs">⭐ Favorite</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="text-xs text-gray-500">Used ${template.use_count || 0}x</div>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                ` : `
                    <div class="text-center text-gray-500 py-8">
                        <p>No templates yet.</p>
                        <p class="text-sm mt-2">Create templates from the Listing Templates page.</p>
                    </div>
                `}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
            </div>
        `);
    },

    advancedCrosslist(itemIds) {
        const items = store.state.inventory.filter(i => itemIds.includes(i.id));
        if (items.length === 0) {
            toast.error('Selected items not found in inventory');
            return;
        }

        // Get first item as base
        const baseItem = items[0];

        // Safely parse tags
        let tagsString = '';
        try {
            if (baseItem.tags) {
                const parsedTags = JSON.parse(baseItem.tags);
                tagsString = Array.isArray(parsedTags) ? parsedTags.join(', ') : '';
            }
        } catch (e) {
            console.warn('Failed to parse tags:', e);
            tagsString = '';
        }

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Advanced Cross-List: ${items.length} Item(s)</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <form id="advanced-crosslist-form" onsubmit="handlers.submitAdvancedCrosslist(event, '${itemIds.join(',')}')">
                    <!-- Workflow Mode Selection -->
                    <div class="mb-6">
                        <label class="form-label">Choose Workflow Mode</label>
                        <div class="grid grid-cols-1 gap-3">
                            <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-primary-500 transition-colors" style="border-color: var(--gray-200)">
                                <input type="radio" name="workflowMode" value="unified" checked onchange="handlers.toggleCrosslistMode(this.value)">
                                <div class="flex-1">
                                    <div class="font-semibold">Use Base Listing for All Platforms</div>
                                    <div class="text-sm text-gray-600 mt-1">Apply the same title, description, and pricing across all platforms. Fast and consistent.</div>
                                </div>
                            </label>

                            <label class="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:border-primary-500 transition-colors" style="border-color: var(--gray-200)">
                                <input type="radio" name="workflowMode" value="customized" onchange="handlers.toggleCrosslistMode(this.value)">
                                <div class="flex-1">
                                    <div class="font-semibold">Customize for Each Platform</div>
                                    <div class="text-sm text-gray-600 mt-1">Start with base listing details, then optimize title, description, and pricing for each platform.</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Platform Selection -->
                    <div class="mb-6">
                        <label class="form-label">Select Platforms</label>
                        <div class="grid grid-cols-3 gap-3">
                            ${['poshmark', 'ebay', 'depop', 'whatnot', 'facebook'].map(platform => `
                                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" style="border-color: var(--gray-200)">
                                    <input type="checkbox" class="platform-checkbox" name="platforms" value="${platform}">
                                    ${components.platformBadge(platform)}
                                    <span class="font-medium">${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Base Listing Details (Unified Mode) -->
                    <div id="unified-mode-section">
                        <div class="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                            <div class="text-sm text-blue-900">
                                <div class="font-semibold mb-1">Base Listing Details</div>
                                <div class="text-xs">These details will be used for all selected platforms</div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Title *</label>
                            <input type="text" name="baseTitle" class="form-input" value="${escapeHtml(baseItem.title)}" required maxlength="80">
                            <p class="text-xs text-gray-500 mt-1">Maximum 80 characters</p>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Description *</label>
                            <textarea name="baseDescription" class="form-input" rows="6" required>${escapeHtml(baseItem.description || '')}</textarea>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">Price *</label>
                                <input type="number" name="basePrice" class="form-input" value="${baseItem.list_price}" step="0.01" min="0" required>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Shipping</label>
                                <select name="baseShipping" class="form-select">
                                    <option value="seller">Seller Pays</option>
                                    <option value="buyer">Buyer Pays</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Tags</label>
                            <input type="text" name="baseTags" class="form-input" value="${escapeHtml(tagsString)}" placeholder="Comma-separated tags">
                        </div>
                    </div>

                    <!-- Platform-Specific Customization (Customized Mode) -->
                    <div id="customized-mode-section" class="hidden">
                        <div class="mb-4 p-4 bg-purple-50 border-l-4 border-purple-500 rounded">
                            <div class="text-sm text-purple-900">
                                <div class="font-semibold mb-1">Platform-Specific Customization</div>
                                <div class="text-xs">Customize listings for each platform after selecting them above</div>
                            </div>
                        </div>

                        <div id="platform-customization-container">
                            ${['poshmark', 'ebay', 'depop', 'whatnot', 'facebook'].map(platform => `
                                <div class="platform-customization-panel hidden" data-platform="${platform}">
                                    <div class="flex items-center gap-3 mb-4 pb-3 border-b" style="border-color: var(--gray-200)">
                                        ${components.platformBadge(platform)}
                                        <h4 class="font-semibold text-lg">${platform.charAt(0).toUpperCase() + platform.slice(1)} Listing</h4>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Title *</label>
                                        <input type="text" name="${platform}Title" class="form-input platform-title-input" value="${escapeHtml(baseItem.title)}" maxlength="80">
                                        <p class="text-xs text-gray-500 mt-1">Optimize for ${platform} search</p>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Description *</label>
                                        <textarea name="${platform}Description" class="form-input platform-description-input" rows="5">${escapeHtml(baseItem.description || '')}</textarea>
                                    </div>

                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="form-group">
                                            <label class="form-label">Price *</label>
                                            <input type="number" name="${platform}Price" class="form-input platform-price-input" value="${baseItem.list_price}" step="0.01" min="0">
                                        </div>

                                        <div class="form-group">
                                            <label class="form-label">Price Adjustment</label>
                                            <select name="${platform}PriceAdjust" class="form-select" onchange="handlers.applyPriceAdjustment('${platform}', this.value, ${baseItem.list_price})">
                                                <option value="0">No Change</option>
                                                <option value="-5">-5% (Competitive)</option>
                                                <option value="5">+5% (Premium)</option>
                                                <option value="10">+10% (Premium)</option>
                                                <option value="-10">-10% (Quick Sale)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">Tags</label>
                                        <input type="text" name="${platform}Tags" class="form-input platform-tags-input" value="${escapeHtml(tagsString)}">
                                    </div>

                                    ${platform === 'mercari' ? `
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="form-group">
                                            <label class="form-label" for="mercariCondition">Condition</label>
                                            <select id="mercariCondition" name="mercariCondition" class="form-select" aria-label="Mercari item condition">
                                                <option value="new">New</option>
                                                <option value="like_new">Like New</option>
                                                <option value="good" selected>Good</option>
                                                <option value="fair">Fair</option>
                                                <option value="poor">Poor</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label" for="mercariShippingMethod">Shipping Method</label>
                                            <select id="mercariShippingMethod" name="mercariShippingMethod" class="form-select" aria-label="Mercari shipping method">
                                                <option value="ship_own">Ship on your own</option>
                                                <option value="mercari_prepaid">Mercari prepaid</option>
                                            </select>
                                        </div>
                                    </div>
                                    ` : ''}

                                    ${platform === 'grailed' ? `
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="form-group">
                                            <label class="form-label" for="grailedDesigner">Designer</label>
                                            <input type="text" id="grailedDesigner" name="grailedDesigner" class="form-input" placeholder="e.g. Supreme, Off-White" aria-label="Grailed designer name">
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label" for="grailedCategory">Category</label>
                                            <select id="grailedCategory" name="grailedCategory" class="form-select" aria-label="Grailed listing category">
                                                <option value="tops">Tops</option>
                                                <option value="bottoms">Bottoms</option>
                                                <option value="outerwear">Outerwear</option>
                                                <option value="footwear">Footwear</option>
                                                <option value="accessories">Accessories</option>
                                            </select>
                                        </div>
                                    </div>
                                    ` : ''}

                                    ${platform === 'etsy' ? `
                                    <div class="grid grid-cols-2 gap-4">
                                        <div class="form-group">
                                            <label class="form-label" for="etsyWhoMade">Who Made It</label>
                                            <select id="etsyWhoMade" name="etsyWhoMade" class="form-select" aria-label="Etsy who made the item">
                                                <option value="i_did">I did</option>
                                                <option value="collective">A member of my shop</option>
                                                <option value="someone_else">Another company or person</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label" for="etsyWhenMade">When Was It Made</label>
                                            <select id="etsyWhenMade" name="etsyWhenMade" class="form-select" aria-label="Etsy when the item was made">
                                                <option value="made_to_order">Made to order</option>
                                                <option value="2020_2025">2020–2025</option>
                                                <option value="2010_2019">2010–2019</option>
                                                <option value="before_2010">Before 2010</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label class="flex items-center gap-2 cursor-pointer" style="min-height: 44px;">
                                            <input type="checkbox" name="etsyIsSupply" value="1" aria-label="Etsy: item is a craft supply or tool">
                                            <span class="form-label mb-0">This is a craft supply or tool</span>
                                        </label>
                                    </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('advanced-crosslist-form').requestSubmit()">
                    Create Listings
                </button>
            </div>
        `);

        // Add event listener for platform checkboxes
        setTimeout(() => {
            const platformCheckboxes = document.querySelectorAll('.platform-checkbox');
            platformCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    handlers.updatePlatformPanels();
                });
            });
        }, 100);
    },

    aiGenerateWizard() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">✨ AI Listing Generator</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div id="ai-wizard-step-1">
                    <div class="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-500 rounded">
                        <div class="font-semibold mb-2">🚀 AI-Powered Listing Creation</div>
                        <div class="text-sm text-gray-700">Upload a product image and let AI analyze it to generate an optimized listing with title, description, tags, and pricing suggestion.</div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Upload Product Image *</label>
                        <div id="ai-dropzone" class="dropzone" onclick="document.getElementById('ai-image-input').click()">
                            <div class="dropzone-content">
                                ${components.icon('upload', 32)}
                                <p style="font-weight: 500; margin-top: 8px;">Click to select product image</p>
                                <p style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">
                                    JPEG or PNG (max 5MB)
                                </p>
                            </div>
                            <input type="file" class="hidden" id="ai-image-input" accept="image/jpeg,image/png" onchange="handlers.handleAIImageSelect(event)">
                        </div>
                        <div id="ai-image-preview" class="hidden mt-3">
                            <img id="ai-preview-img" src="" alt="Preview" style="max-width: 100%; max-height: 300px; border-radius: var(--radius-md); border: 2px solid var(--gray-200);">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Target Platform</label>
                        <select id="ai-target-platform" class="form-select">
                            <option value="poshmark">Poshmark (80 char title)</option>
                            <option value="ebay">eBay (80 char title)</option>
                            <option value="mercari">Mercari (40 char title)</option>
                            <option value="depop">Depop (65 char title)</option>
                            <option value="grailed">Grailed (100 char title)</option>
                            <option value="facebook">Facebook Marketplace</option>
                        </select>
                        <p class="text-xs text-gray-500 mt-1">AI will optimize the listing for your selected platform</p>
                    </div>
                </div>

                <div id="ai-wizard-step-2" class="hidden">
                    <div class="text-center py-12">
                        <div class="inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-500 mb-4"></div>
                        <div class="text-lg font-semibold mb-2">✨ AI is analyzing your image...</div>
                        <div class="text-sm text-gray-600">This usually takes 5-10 seconds</div>
                    </div>
                </div>

                <div id="ai-wizard-step-3" class="hidden">
                    <div class="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                        <div class="font-semibold text-green-900 mb-1">✓ Analysis Complete!</div>
                        <div class="text-sm text-green-700">Review and edit the generated listing below, then click "Apply to Form"</div>
                    </div>

                    <div id="ai-results-container">
                        <!-- Results will be inserted here -->
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button id="ai-analyze-btn" class="btn btn-primary" onclick="handlers.startAIAnalysis()" disabled>
                    Analyze Image
                </button>
                <button id="ai-apply-btn" class="btn btn-primary hidden" onclick="handlers.applyAIResults()">
                    Apply to Form
                </button>
            </div>
        `);
    },

    // Generate listing from an existing inventory item
    generateListingFromItem(itemId) {
        const item = (store.state.inventory || []).find(i => i.id === itemId);
        if (!item) {
            toast.error('Item not found in inventory');
            return;
        }
        const itemTitle = escapeHtml(item.title || 'Untitled Item');
        const itemBrand = escapeHtml(item.brand || '');
        const itemCategory = escapeHtml(item.category || '');
        const itemCondition = item.condition || 'good';
        const itemSize = escapeHtml(item.size || '');
        const itemColor = escapeHtml(item.color || '');

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Generate AI Listing</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div id="gli-step-generate">
                    <div class="mb-4 p-3 bg-gray-50 rounded-lg flex items-start gap-3">
                        <div>
                            <div class="font-semibold text-sm">${itemTitle}</div>
                            <div class="text-xs text-gray-500">${[itemBrand, itemCategory, itemSize ? 'Size ' + itemSize : '', itemColor].filter(Boolean).join(' · ')}</div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Target Platform</label>
                        <select id="gli-platform" class="form-select">
                            <option value="poshmark">Poshmark (80 char title)</option>
                            <option value="ebay">eBay (80 char title)</option>
                            <option value="mercari">Mercari (40 char title)</option>
                            <option value="depop">Depop (65 char title)</option>
                            <option value="grailed">Grailed (100 char title)</option>
                            <option value="facebook">Facebook Marketplace</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Additional Notes <span class="text-gray-400 font-normal">(optional)</span></label>
                        <input type="text" id="gli-notes" class="form-input" placeholder="e.g. slight fade on collar, original box included" maxlength="300">
                        <p class="text-xs text-gray-500 mt-1">Add any details not captured in the item record</p>
                    </div>
                </div>

                <div id="gli-step-loading" class="hidden text-center py-10">
                    <div class="inline-block animate-spin rounded-full h-14 w-14 border-4 border-gray-200 border-t-primary-500 mb-4"></div>
                    <div class="text-base font-semibold mb-1">Generating listing...</div>
                    <div class="text-sm text-gray-500">Claude is writing your listing</div>
                </div>

                <div id="gli-step-results" class="hidden">
                    <div class="mb-4 p-3 bg-green-50 border-l-4 border-green-500 rounded">
                        <div class="font-semibold text-green-900 text-sm mb-1">Listing generated — review and edit below</div>
                        <div id="gli-ai-source" class="text-xs text-green-700"></div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" id="gli-result-title" class="form-input" maxlength="100">
                        <p class="text-xs text-gray-500 mt-1"><span id="gli-title-count">0</span> characters</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea id="gli-result-description" class="form-input" rows="7"></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tags</label>
                        <input type="text" id="gli-result-tags" class="form-input" placeholder="Comma-separated tags">
                        <p class="text-xs text-gray-500 mt-1"><span id="gli-tags-count">0</span> tags</p>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Price</label>
                        <div class="flex items-center gap-3">
                            <input type="number" id="gli-result-price" class="form-input" step="0.01" style="max-width: 140px;">
                            <span id="gli-price-range" class="text-sm text-gray-500"></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button id="gli-generate-btn" class="btn btn-primary" onclick="handlers.runGenerateListingFromItem('${itemId}')">
                    Generate with AI
                </button>
                <button id="gli-save-btn" class="btn btn-primary hidden" onclick="handlers.saveGeneratedListing('${itemId}')">
                    Save as Draft Listing
                </button>
            </div>
        `);

        // Wire up character counter for title after modal renders
        setTimeout(() => {
            const titleInput = document.getElementById('gli-result-title');
            if (titleInput) {
                titleInput.addEventListener('input', () => {
                    const counter = document.getElementById('gli-title-count');
                    if (counter) counter.textContent = titleInput.value.length;
                });
            }
            const tagsInput = document.getElementById('gli-result-tags');
            if (tagsInput) {
                tagsInput.addEventListener('input', () => {
                    const counter = document.getElementById('gli-tags-count');
                    if (counter) {
                        const tags = tagsInput.value.split(',').filter(t => t.trim());
                        counter.textContent = tags.length;
                    }
                });
            }
        }, 50);
    },

    // Create post modal
    createPost() {
        const currentTab = store.state.communityTab || 'discussion';
        const defaultType = currentTab === 'tips' ? 'tip' : currentTab === 'success' ? 'success' : 'discussion';

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Create Post</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form onsubmit="handlers.submitCreatePost(event)">
                    <div class="form-group">
                        <label class="form-label">Post Type</label>
                        <select class="form-select" name="type" id="post-type-select" onchange="handlers.toggleSuccessFields()">
                            <option value="discussion" ${defaultType === 'discussion' ? 'selected' : ''}>Discussion</option>
                            <option value="success" ${defaultType === 'success' ? 'selected' : ''}>Success Story</option>
                            <option value="tip" ${defaultType === 'tip' ? 'selected' : ''}>Tip & Trick</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Title *</label>
                        <input type="text" class="form-input" name="title" required maxlength="200"
                               placeholder="What's your post about?">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Content *</label>
                        <textarea class="form-textarea" name="content" rows="6" required
                                  placeholder="Share your thoughts, questions, or experiences..."></textarea>
                    </div>

                    <div id="success-fields" class="hidden">
                        <div class="grid grid-cols-2 gap-4">
                            <div class="form-group">
                                <label class="form-label">Sale Price</label>
                                <input type="number" class="form-input" name="salePrice" step="0.01" placeholder="0.00">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Profit</label>
                                <input type="number" class="form-input" name="profit" step="0.01" placeholder="0.00">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Platform</label>
                            <select class="form-select" name="platform">
                                <option value="">Select platform...</option>
                                <option value="poshmark">Poshmark</option>
                                <option value="ebay">eBay</option>
                                <option value="mercari">Mercari</option>
                                <option value="depop">Depop</option>
                                <option value="grailed">Grailed</option>
                                <option value="facebook">Facebook</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Tags (comma-separated)</label>
                        <input type="text" class="form-input" name="tags"
                               placeholder="vintage, poshmark, tips">
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Post</button>
                    </div>
                </form>
            </div>
        `);

        // Show/hide success fields based on initial type
        setTimeout(() => handlers.toggleSuccessFields(), 100);
    },

    // View post modal
    viewPost(data) {
        const { post, replies = [], reactions = [], user_reaction = null } = data;

        // Calculate reaction counts
        const upvotes = reactions.find(r => r.reaction_type === 'upvote')?.count || 0;
        const congratulates = reactions.find(r => r.reaction_type === 'congratulate')?.count || 0;
        const helpfuls = reactions.find(r => r.reaction_type === 'helpful')?.count || 0;

        this.show(`
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">${escapeHtml(post.title)}</h2>
                    <div class="text-sm text-gray-500">
                        by ${escapeHtml(post.author_email.split('@')[0])} • ${new Date(post.created_at).toLocaleDateString()}
                    </div>
                </div>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <!-- Post Content -->
                <div class="post-detail-content">
                    ${post.type === 'success' ? '<div class="badge badge-success mb-3">Success Story 🏆</div>' :
                      post.type === 'tip' ? '<div class="badge badge-primary mb-3">Tip & Trick 💡</div>' : ''}

                    <div class="mb-4" style="white-space: pre-wrap;">${escapeHtml(post.content)}</div>

                    ${post.sale_details ? `
                        <div class="success-details card mb-4">
                            <div class="card-body">
                                <h4 class="font-semibold mb-2">Sale Details</h4>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <div class="text-sm text-gray-500">Sale Price</div>
                                        <div class="text-lg font-bold text-success">$${post.sale_details.sale_price.toFixed(2)}</div>
                                    </div>
                                    <div>
                                        <div class="text-sm text-gray-500">Profit</div>
                                        <div class="text-lg font-bold text-primary">$${post.sale_details.profit.toFixed(2)}</div>
                                    </div>
                                    ${post.sale_details.platform ? `
                                        <div>
                                            <div class="text-sm text-gray-500">Platform</div>
                                            <div class="font-semibold">${escapeHtml(post.sale_details.platform)}</div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    ` : ''}

                    ${post.tags && post.tags.length > 0 ? `
                        <div class="post-tags mb-4">
                            ${post.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}

                    <!-- Reactions -->
                    <div class="post-reactions">
                        <button class="reaction-btn ${user_reaction === 'upvote' ? 'active' : ''}"
                                onclick="handlers.reactToPost('${post.id}', 'upvote')">
                            👍 Upvote <span class="count">${upvotes}</span>
                        </button>
                        <button class="reaction-btn ${user_reaction === 'congratulate' ? 'active' : ''}"
                                onclick="handlers.reactToPost('${post.id}', 'congratulate')">
                            🎉 Congrats <span class="count">${congratulates}</span>
                        </button>
                        <button class="reaction-btn ${user_reaction === 'helpful' ? 'active' : ''}"
                                onclick="handlers.reactToPost('${post.id}', 'helpful')">
                            ⭐ Helpful <span class="count">${helpfuls}</span>
                        </button>
                    </div>
                </div>

                <!-- Replies -->
                <div class="post-replies mt-6">
                    <h3 class="font-semibold mb-4">${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}</h3>

                    ${replies.map(reply => `
                        <div class="reply-item">
                            <div class="reply-author">${escapeHtml(reply.author_email.split('@')[0])}</div>
                            <div class="reply-date">${new Date(reply.created_at).toLocaleDateString()}</div>
                            <div class="reply-content">${escapeHtml(reply.content)}</div>
                        </div>
                    `).join('')}

                    <!-- Reply Form -->
                    <form onsubmit="handlers.submitReply(event, '${post.id}')" class="reply-form mt-4">
                        <textarea class="form-textarea" name="content" rows="3" placeholder="Add your reply..." required></textarea>
                        <div class="flex gap-2 mt-2">
                            <button type="submit" class="btn btn-primary btn-sm">Reply</button>
                        </div>
                    </form>
                </div>
            </div>
        `);
    },

    // View knowledge base article
    viewArticle: async function(slug) {
        try {
            const article = await handlers.loadArticle(slug);
            if (!article) return;

            this.show(`
                <div class="modal-header">
                    <div>
                        <nav style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span style="cursor: pointer; color: var(--primary-500);" onclick="modals.close(); router.navigate('help-support')">Help</span>
                            <span style="opacity: 0.5;">/</span>
                            ${article.category ? `<span style="cursor: pointer; color: var(--primary-500);" onclick="modals.close(); router.navigate('support-articles')">${escapeHtml(article.category)}</span><span style="opacity: 0.5;">/</span>` : ''}
                            <span>${escapeHtml(article.title.length > 40 ? article.title.substring(0, 40) + '...' : article.title)}</span>
                        </nav>
                        <h2 class="modal-title">${escapeHtml(article.title)}</h2>
                        ${article.category ? `
                            <span class="badge">${article.category}</span>
                        ` : ''}
                    </div>
                    <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;" id="article-scroll-body" onscroll="(function(el){var p=Math.round(el.scrollTop/(el.scrollHeight-el.clientHeight)*100); var bar=document.getElementById('article-progress'); if(bar) bar.style.width=p+'%';})(this)">
                    <div style="position: sticky; top: 0; height: 3px; background: var(--gray-200); z-index: 1; border-radius: 2px;">
                        <div id="article-progress" style="height: 100%; width: 0%; background: var(--primary-500); border-radius: 2px; transition: width 0.15s;"></div>
                    </div>
                    <div class="article-content" style="line-height: 1.6;">
                        ${article.content.split('\n').map(line => {
                            if (line.startsWith('# ')) return `<h2 style="font-size: 1.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 1rem;">${line.slice(2)}</h2>`;
                            if (line.startsWith('## ')) return `<h3 style="font-size: 1.25rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.75rem;">${line.slice(3)}</h3>`;
                            if (line.startsWith('- ')) return `<li style="margin-left: 1.5rem;">${line.slice(2)}</li>`;
                            if (line.trim() === '') return '<br>';
                            return `<p style="margin-bottom: 1rem;">${escapeHtml(line)}</p>`;
                        }).join('')}
                    </div>

                    <!-- Tags -->
                    ${article.tags && article.tags.length > 0 ? `
                        <div class="mt-6" style="border-top: 1px solid #e5e7eb; padding-top: 1rem;">
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${article.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Helpfulness -->
                    <div class="mt-6" style="border-top: 1px solid #e5e7eb; padding-top: 1rem;">
                        <p style="font-weight: 600; margin-bottom: 0.75rem;">Was this article helpful?</p>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary" onclick="handlers.voteArticle('${article.id}', true); modals.close();">
                                👍 Yes, helpful
                            </button>
                            <button class="btn" onclick="handlers.voteArticle('${article.id}', false); modals.close();">
                                👎 Not helpful
                            </button>
                        </div>
                    </div>
                </div>
            `);
        } catch (error) {
            toast.error('Failed to load article');
        }
    },

    // Create support ticket
    createTicket() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Submit Support Ticket</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form onsubmit="handlers.submitTicket(event)">
                    <div class="form-group">
                        <label class="form-label">Ticket Type *</label>
                        <select class="form-select" name="type" required>
                            <option value="">Select type...</option>
                            <option value="bug">🐛 Bug Report</option>
                            <option value="feature_request">💡 Feature Request</option>
                            <option value="contact">💬 General Contact</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Subject *</label>
                        <input type="text" class="form-input" name="subject" required maxlength="200"
                               placeholder="Brief description of the issue">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description *</label>
                        <textarea class="form-textarea" name="description" rows="6" required
                                  placeholder="Provide detailed information about your issue or request..."></textarea>
                        <p style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">
                            For bug reports, please include steps to reproduce the issue.
                        </p>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn" onclick="modals.close()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Submit Ticket</button>
                    </div>
                </form>
            </div>
        `);
    },

    // View support ticket with replies
    viewTicket(ticket, replies = []) {
        const statusColors = {
            open: 'primary',
            in_progress: 'warning',
            resolved: 'success',
            closed: 'secondary'
        };

        this.show(`
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">${escapeHtml(ticket.subject)}</h2>
                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                        <span class="badge badge-${statusColors[ticket.status]}">${ticket.status.replace(/_/g, ' ')}</span>
                        <span class="badge">${ticket.type.replace(/_/g, ' ')}</span>
                        <span class="badge">${ticket.priority || 'Normal'}</span>
                    </div>
                </div>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <!-- Original Ticket -->
                <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">
                        Created ${new Date(ticket.created_at).toLocaleString()}
                    </div>
                    <div style="white-space: pre-wrap;">${escapeHtml(ticket.description)}</div>
                </div>

                <!-- Replies -->
                ${replies.length > 0 ? `
                    <div class="mb-4">
                        <h3 class="font-semibold mb-3">${replies.length} ${replies.length === 1 ? 'Reply' : 'Replies'}</h3>
                        ${replies.map(reply => `
                            <div class="reply-item" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #e5e7eb;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                    <div style="font-weight: 600; ${reply.is_staff_reply ? 'color: #6366f1;' : ''}">
                                        ${reply.is_staff_reply ? '🛡️ Support Team' : escapeHtml(reply.user_email?.split('@')[0] || 'You')}
                                    </div>
                                    <div style="font-size: 0.875rem; color: #9ca3af;">
                                        ${new Date(reply.created_at).toLocaleString()}
                                    </div>
                                </div>
                                <div style="white-space: pre-wrap; color: #4b5563;">${escapeHtml(reply.message)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Reply Form (only if ticket is not closed) -->
                ${ticket.status !== 'closed' && ticket.status !== 'resolved' ? `
                    <form onsubmit="handlers.submitTicketReply(event, '${ticket.id}')" style="margin-top: 1.5rem;">
                        <label class="form-label">Add Reply</label>
                        <textarea class="form-textarea" name="message" rows="4" required
                                  placeholder="Add additional information or reply to support..."></textarea>
                        <div style="margin-top: 0.75rem;">
                            <button type="submit" class="btn btn-primary">Send Reply</button>
                        </div>
                    </form>
                ` : `
                    <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; text-align: center; color: #6b7280;">
                        This ticket is ${ticket.status}. No further replies can be added.
                    </div>
                `}
            </div>
        `);
    },

    // Add SKU Rule modal
    addSkuRule() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Create SKU Rule</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="add-sku-rule-form" onsubmit="handlers.addSkuRule(event)">
                    <div class="form-group">
                        <label class="form-label">Rule Name *</label>
                        <input type="text" class="form-input" name="name" required placeholder="e.g., Standard SKU, Vintage Items">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Pattern *</label>
                        <input type="text" class="form-input" name="pattern" required
                               placeholder="{brand}-{category}-{counter}"
                               oninput="handlers.livePreviewSkuPattern(this.value)">
                        <div class="sku-pattern-buttons mt-2">
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{brand}')">{brand}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{category}')">{category}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{color}')">{color}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{size}')">{size}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{year}')">{year}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{month}')">{month}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{counter}')">{counter}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{random}')">{random}</button>
                        </div>
                        <div id="sku-live-preview" class="sku-live-preview mt-2" style="display: none;">
                            <span class="text-sm text-gray-500">Preview:</span>
                            <code id="sku-preview-value" class="bg-primary-100 text-primary-700 px-2 py-1 rounded ml-2"></code>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-textarea" name="description" rows="2" placeholder="Optional description for this rule"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Prefix</label>
                            <input type="text" class="form-input" name="prefix" placeholder="e.g., VL-">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Suffix</label>
                            <input type="text" class="form-input" name="suffix" placeholder="e.g., -NEW">
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                        <div class="form-group">
                            <label class="form-label">Separator</label>
                            <input type="text" class="form-input" name="separator" value="-" maxlength="2">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Counter Start</label>
                            <input type="number" class="form-input" name="counterStart" value="1" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Counter Padding</label>
                            <select class="form-select" name="counterPadding">
                                <option value="2">2 digits (01)</option>
                                <option value="3">3 digits (001)</option>
                                <option value="4" selected>4 digits (0001)</option>
                                <option value="5">5 digits (00001)</option>
                                <option value="6">6 digits (000001)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" name="isDefault">
                            <span>Set as default rule for new items</span>
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('add-sku-rule-form').requestSubmit()">Create Rule</button>
            </div>
        `);
    },

    // Edit SKU Rule modal
    editSkuRule(rule) {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Edit SKU Rule</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="edit-sku-rule-form" onsubmit="handlers.updateSkuRule(event)">
                    <input type="hidden" name="ruleId" value="${rule.id}">

                    <div class="form-group">
                        <label class="form-label">Rule Name *</label>
                        <input type="text" class="form-input" name="name" required value="${escapeHtml(rule.name)}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Pattern *</label>
                        <input type="text" class="form-input" name="pattern" required
                               value="${escapeHtml(rule.pattern)}"
                               oninput="handlers.livePreviewSkuPattern(this.value)">
                        <div class="sku-pattern-buttons mt-2">
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{brand}')">{brand}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{category}')">{category}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{color}')">{color}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{size}')">{size}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{year}')">{year}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{month}')">{month}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{counter}')">{counter}</button>
                            <button type="button" class="btn btn-xs btn-outline" onclick="handlers.insertPatternToken('{random}')">{random}</button>
                        </div>
                        <div id="sku-live-preview" class="sku-live-preview mt-2" style="display: none;">
                            <span class="text-sm text-gray-500">Preview:</span>
                            <code id="sku-preview-value" class="bg-primary-100 text-primary-700 px-2 py-1 rounded ml-2"></code>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-textarea" name="description" rows="2">${escapeHtml(rule.description || '')}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group">
                            <label class="form-label">Prefix</label>
                            <input type="text" class="form-input" name="prefix" value="${escapeHtml(rule.prefix || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Suffix</label>
                            <input type="text" class="form-input" name="suffix" value="${escapeHtml(rule.suffix || '')}">
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                        <div class="form-group">
                            <label class="form-label">Separator</label>
                            <input type="text" class="form-input" name="separator" value="${escapeHtml(rule.separator || '-')}" maxlength="2">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Counter Start</label>
                            <input type="number" class="form-input" name="counterStart" value="${rule.counter_start || 1}" min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Counter Padding</label>
                            <select class="form-select" name="counterPadding">
                                <option value="2" ${rule.counter_padding == 2 ? 'selected' : ''}>2 digits (01)</option>
                                <option value="3" ${rule.counter_padding == 3 ? 'selected' : ''}>3 digits (001)</option>
                                <option value="4" ${!rule.counter_padding || rule.counter_padding == 4 ? 'selected' : ''}>4 digits (0001)</option>
                                <option value="5" ${rule.counter_padding == 5 ? 'selected' : ''}>5 digits (00001)</option>
                                <option value="6" ${rule.counter_padding == 6 ? 'selected' : ''}>6 digits (000001)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" name="isDefault" ${rule.is_default ? 'checked' : ''}>
                            <span>Set as default rule for new items</span>
                        </label>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Current Counter</label>
                        <div class="text-sm text-gray-600">
                            This rule has generated <strong>${rule.counter_current || 0}</strong> SKUs so far.
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('edit-sku-rule-form').requestSubmit()">Save Changes</button>
            </div>
        `);

        // Trigger initial preview
        setTimeout(() => handlers.livePreviewSkuPattern(rule.pattern), 100);
    },

    // Batch SKU Update modal
    batchSkuUpdate() {
        const rules = store.state.skuRules || [];
        const inventoryCount = (store.state.inventory || []).length;
        const noSkuCount = (store.state.inventory || []).filter(i => !i.sku || i.sku === '').length;

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Batch Update SKUs</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                ${rules.length === 0 ? `
                    <div class="text-center py-6">
                        <div class="text-4xl mb-3">📋</div>
                        <p class="text-gray-600 mb-4">You need to create a SKU rule first before running batch updates.</p>
                        <button class="btn btn-primary" onclick="modals.close(); setTimeout(() => handlers.showAddSkuRule(), 200)">
                            Create SKU Rule
                        </button>
                    </div>
                ` : `
                    <div class="mb-4">
                        <div class="flex justify-between text-sm">
                            <span>Total inventory items:</span>
                            <strong>${inventoryCount}</strong>
                        </div>
                        <div class="flex justify-between text-sm">
                            <span>Items without SKU:</span>
                            <strong>${noSkuCount}</strong>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Select SKU Rule *</label>
                        <select class="form-select" id="batch-sku-rule-select">
                            <option value="">Choose a rule...</option>
                            ${rules.map(rule => `
                                <option value="${rule.id}" ${rule.is_default ? 'selected' : ''}>
                                    ${escapeHtml(rule.name)} ${rule.is_default ? '(Default)' : ''}
                                </option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Apply To</label>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="radio" name="batchScope" value="empty" checked>
                                <span>Only items without SKU (${noSkuCount} items)</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="radio" name="batchScope" value="all">
                                <span>All inventory items (${inventoryCount} items) - will overwrite existing SKUs</span>
                            </label>
                        </div>
                    </div>

                    <div class="alert alert-warning mt-4">
                        <strong>Warning:</strong> This action cannot be undone. Make sure you've selected the correct rule and scope.
                    </div>
                `}
            </div>
            ${rules.length > 0 ? `
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                    <button class="btn btn-primary" onclick="handlers.executeBatchSkuUpdate()">
                        Apply SKUs
                    </button>
                </div>
            ` : ''}
        `);
    },

    // Review Receipt modal
    reviewReceipt(receipt) {
        if (!receipt) return;

        const parsed = receipt.parsed_data ?
            (typeof receipt.parsed_data === 'string' ? JSON.parse(receipt.parsed_data) : receipt.parsed_data) : {};

        const items = parsed.items || [];
        const inventoryItems = store.state.inventory || [];

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Review Receipt</h2>
                <button class="btn btn-icon btn-ghost" onclick="modals.close()" aria-label="Close modal">
                    ${components.icon('close', 20)}
                </button>
            </div>
            <form id="review-receipt-form" onsubmit="handlers.updateReceipt(event)">
                <input type="hidden" name="receiptId" value="${receipt.id}">
                <div class="modal-body">
                    <div class="receipt-review-layout">
                        <!-- Receipt Image Preview -->
                        <div class="receipt-image-preview">
                            ${receipt.image_data ? `
                                <img src="data:image/jpeg;base64,${receipt.image_data}"
                                     alt="Receipt" class="receipt-full-image"
                                     onclick="window.open(this.src, '_blank')">
                                <p class="text-xs text-gray-500 text-center mt-2">Click to enlarge</p>
                            ` : `
                                <div class="receipt-no-image">
                                    ${components.icon('image', 48)}
                                    <p>No image available</p>
                                </div>
                            `}
                            <button type="button" class="btn btn-sm btn-secondary mt-2 w-full"
                                    onclick="handlers.reparseReceipt('${receipt.id}')">
                                ${components.icon('refresh', 14)} Re-parse with AI
                            </button>
                        </div>

                        <!-- Receipt Details Form -->
                        <div class="receipt-details-form">
                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label class="form-label">Receipt Type</label>
                                    <select name="receiptType" class="form-select">
                                        <option value="purchase" ${parsed.receiptType === 'purchase' ? 'selected' : ''}>Purchase</option>
                                        <option value="sale" ${parsed.receiptType === 'sale' ? 'selected' : ''}>Sale</option>
                                        <option value="shipping" ${parsed.receiptType === 'shipping' ? 'selected' : ''}>Shipping</option>
                                        <option value="expense" ${parsed.receiptType === 'expense' ? 'selected' : ''}>Expense</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Date</label>
                                    <input type="date" name="date" class="form-input"
                                           value="${parsed.date || ''}">
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="form-label">Vendor Name</label>
                                <input type="text" name="vendorName" class="form-input"
                                       value="${escapeHtml(parsed.vendor?.name || '')}"
                                       placeholder="Store or platform name">
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label class="form-label">Vendor Address</label>
                                    <input type="text" name="vendorAddress" class="form-input"
                                           value="${escapeHtml(parsed.vendor?.address || '')}"
                                           placeholder="Optional">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Vendor Phone</label>
                                    <input type="text" name="vendorPhone" class="form-input"
                                           value="${escapeHtml(parsed.vendor?.phone || '')}"
                                           placeholder="Optional">
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="form-group">
                                    <label class="form-label">Payment Method</label>
                                    <select name="paymentMethod" class="form-select">
                                        <option value="">Select...</option>
                                        <option value="Cash" ${parsed.paymentMethod === 'Cash' ? 'selected' : ''}>Cash</option>
                                        <option value="Credit Card" ${parsed.paymentMethod === 'Credit Card' ? 'selected' : ''}>Credit Card</option>
                                        <option value="Debit Card" ${parsed.paymentMethod === 'Debit Card' ? 'selected' : ''}>Debit Card</option>
                                        <option value="PayPal" ${parsed.paymentMethod === 'PayPal' ? 'selected' : ''}>PayPal</option>
                                        <option value="Venmo" ${parsed.paymentMethod === 'Venmo' ? 'selected' : ''}>Venmo</option>
                                        <option value="Other" ${parsed.paymentMethod === 'Other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Order/Reference #</label>
                                    <input type="text" name="orderNumber" class="form-input"
                                           value="${escapeHtml(parsed.orderNumber || '')}"
                                           placeholder="Optional">
                                </div>
                            </div>

                            <!-- Line Items -->
                            <div class="form-group">
                                <div class="flex items-center justify-between mb-2">
                                    <label class="form-label mb-0">Line Items</label>
                                    <button type="button" class="btn btn-sm btn-secondary"
                                            onclick="handlers.addReceiptLineItem()">
                                        ${components.icon('plus', 14)} Add Item
                                    </button>
                                </div>
                                <div id="receipt-line-items" class="receipt-line-items">
                                    ${items.length > 0 ? items.map((item, idx) => `
                                        <div class="receipt-line-item-row">
                                            <input type="text" name="itemDescription" placeholder="Description"
                                                   class="form-input" value="${escapeHtml(item.description || '')}">
                                            <input type="number" name="itemQty" value="${item.quantity || 1}"
                                                   min="1" class="form-input" style="width:60px"
                                                   onchange="handlers.calculateReceiptTotals()">
                                            <input type="number" name="itemUnitPrice" step="0.01"
                                                   placeholder="0.00" class="form-input" style="width:80px"
                                                   value="${item.unitPrice || ''}"
                                                   onchange="handlers.calculateReceiptTotals()">
                                            <input type="number" name="itemTotal" step="0.01"
                                                   placeholder="0.00" class="form-input" style="width:80px"
                                                   value="${item.total || ''}">
                                            <select name="inventoryLink" class="form-select" style="width:120px">
                                                <option value="">Link inventory...</option>
                                                ${inventoryItems.map(inv =>
                                                    `<option value="${inv.id}" ${item.inventoryId === inv.id ? 'selected' : ''}>
                                                        ${escapeHtml(inv.title?.substring(0, 25) || 'Untitled')}
                                                    </option>`
                                                ).join('')}
                                            </select>
                                            <button type="button" class="btn btn-icon btn-sm btn-ghost" aria-label="Remove line item"
                                                    onclick="this.parentElement.remove(); handlers.calculateReceiptTotals()">
                                                <span class="icon">×</span>
                                            </button>
                                        </div>
                                    `).join('') : `
                                        <div class="receipt-line-item-row">
                                            <input type="text" name="itemDescription" placeholder="Description" class="form-input">
                                            <input type="number" name="itemQty" value="1" min="1" class="form-input" style="width:60px"
                                                   onchange="handlers.calculateReceiptTotals()">
                                            <input type="number" name="itemUnitPrice" step="0.01" placeholder="0.00"
                                                   class="form-input" style="width:80px" onchange="handlers.calculateReceiptTotals()">
                                            <input type="number" name="itemTotal" step="0.01" placeholder="0.00"
                                                   class="form-input" style="width:80px">
                                            <select name="inventoryLink" class="form-select" style="width:120px">
                                                <option value="">Link inventory...</option>
                                                ${inventoryItems.map(inv =>
                                                    `<option value="${inv.id}">${escapeHtml(inv.title?.substring(0, 25) || 'Untitled')}</option>`
                                                ).join('')}
                                            </select>
                                            <button type="button" class="btn btn-icon btn-sm btn-ghost" aria-label="Remove line item"
                                                    onclick="this.parentElement.remove(); handlers.calculateReceiptTotals()">
                                                <span class="icon">×</span>
                                            </button>
                                        </div>
                                    `}
                                </div>
                            </div>

                            <!-- Totals -->
                            <div class="receipt-totals-grid">
                                <div class="form-group">
                                    <label class="form-label">Subtotal</label>
                                    <input type="number" name="subtotal" id="receipt-subtotal"
                                           step="0.01" class="form-input"
                                           value="${parsed.subtotal || ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Tax</label>
                                    <input type="number" name="tax" id="receipt-tax"
                                           step="0.01" class="form-input"
                                           value="${parsed.tax || ''}"
                                           onchange="handlers.calculateReceiptTotals()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Shipping</label>
                                    <input type="number" name="shipping" id="receipt-shipping"
                                           step="0.01" class="form-input"
                                           value="${parsed.shipping || ''}"
                                           onchange="handlers.calculateReceiptTotals()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Discount</label>
                                    <input type="number" name="discount" id="receipt-discount"
                                           step="0.01" class="form-input"
                                           value="${parsed.discount || ''}"
                                           onchange="handlers.calculateReceiptTotals()">
                                </div>
                                <div class="form-group">
                                    <label class="form-label font-bold">Total</label>
                                    <input type="number" name="total" id="receipt-total"
                                           step="0.01" class="form-input font-bold"
                                           value="${parsed.total || ''}">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-error" onclick="handlers.deleteReceipt('${receipt.id}')">
                        ${components.icon('trash', 14)} Delete
                    </button>
                    <div class="flex gap-2" style="margin-left: auto;">
                        <button type="button" class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                        <button type="submit" class="btn btn-secondary">
                            ${components.icon('edit', 14)} Save Changes
                        </button>
                        <button type="button" class="btn btn-primary" onclick="handlers.processReceipt('${receipt.id}')">
                            ${components.icon('sales', 14)} Process Receipt
                        </button>
                    </div>
                </div>
            </form>
        `);
    },

    // Batch Photo Processing modal
    batchPhoto() {
        const selectedImages = store.state.selectedImages || [];
        const images = store.state.imageBankImages || [];
        const presets = store.state.batchPhotoPresets || [];
        const transformations = store.state.batchPhotoTransformations;
        const progress = store.state.batchPhotoProgress;

        // Get selected image objects for preview
        const selectedImageObjects = images.filter(img => selectedImages.includes(img.id)).slice(0, 12);

        // Check if processing
        const isProcessing = progress && (progress.status === 'starting' || progress.status === 'processing');

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Batch Photo Processing</h2>
                <button class="btn btn-icon btn-ghost" onclick="handlers.closeBatchPhotoModal()" aria-label="Close batch photo editor">
                    ${components.icon('close', 20)}
                </button>
            </div>
            <div class="modal-body">
                ${isProcessing ? `
                    <!-- Progress View -->
                    <div class="batch-photo-progress-view">
                        <div class="text-center mb-4">
                            <div class="spinner" style="margin: 0 auto 1rem;"></div>
                            <h3>Processing ${progress.total} Images...</h3>
                        </div>

                        <div class="batch-photo-progress-bar-container">
                            <div class="batch-photo-progress-bar">
                                <div class="batch-photo-progress-fill" style="width: ${Math.round((progress.processed / progress.total) * 100)}%"></div>
                            </div>
                            <div class="batch-photo-progress-text">
                                ${progress.processed}/${progress.total} (${Math.round((progress.processed / progress.total) * 100)}%)
                            </div>
                        </div>

                        <div class="batch-photo-stats">
                            <span class="badge badge-success">Completed: ${progress.processed - progress.failed}</span>
                            ${progress.failed > 0 ? `<span class="badge badge-error">Failed: ${progress.failed}</span>` : ''}
                            <span class="badge badge-secondary">Remaining: ${progress.total - progress.processed}</span>
                        </div>

                        <div class="text-center mt-4">
                            <button class="btn btn-secondary" onclick="handlers.cancelBatchPhotoJob('${progress.jobId}')">
                                Cancel Processing
                            </button>
                        </div>
                    </div>
                ` : `
                    <!-- Setup View -->
                    <div class="batch-photo-setup">
                        <!-- Selected Images Preview -->
                        <div class="batch-photo-section">
                            <h4>Selected Images (${selectedImages.length})</h4>
                            <div class="batch-photo-preview-grid">
                                ${selectedImageObjects.map(img => `
                                    <div class="batch-photo-preview-item">
                                        <img src="${img.file_path || '/assets/placeholder.png'}"
                                             alt="${escapeHtml(img.title || 'Image')}"
                                             onerror="this.src='/assets/placeholder.png'">
                                    </div>
                                `).join('')}
                                ${selectedImages.length > 12 ? `
                                    <div class="batch-photo-preview-more">
                                        +${selectedImages.length - 12} more
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Transformations -->
                        <div class="batch-photo-section">
                            <h4>AI Transformations</h4>
                            <div class="batch-photo-transformations">
                                <label class="batch-photo-checkbox">
                                    <input type="checkbox" ${transformations.removeBackground ? 'checked' : ''}
                                           onchange="handlers.setBatchPhotoTransformation('removeBackground', this.checked); modals.batchPhoto()">
                                    <span>Remove Background (AI)</span>
                                </label>
                                <label class="batch-photo-checkbox">
                                    <input type="checkbox" ${transformations.enhance ? 'checked' : ''}
                                           onchange="handlers.setBatchPhotoTransformation('enhance', this.checked); modals.batchPhoto()">
                                    <span>Auto Enhance</span>
                                </label>
                                <label class="batch-photo-checkbox">
                                    <input type="checkbox" ${transformations.upscale ? 'checked' : ''}
                                           onchange="handlers.setBatchPhotoTransformation('upscale', this.checked); modals.batchPhoto()">
                                    <span>AI Upscale</span>
                                </label>
                            </div>
                        </div>

                        <!-- Smart Crop -->
                        <div class="batch-photo-section">
                            <h4>Smart Crop</h4>
                            <div class="batch-photo-crop-presets">
                                <button class="btn btn-sm ${transformations.cropPreset === 'square' ? 'btn-primary' : 'btn-secondary'}"
                                        onclick="handlers.setBatchPhotoCropPreset('square'); modals.batchPhoto()">
                                    Square (1:1)
                                </button>
                                <button class="btn btn-sm ${transformations.cropPreset === 'portrait' ? 'btn-primary' : 'btn-secondary'}"
                                        onclick="handlers.setBatchPhotoCropPreset('portrait'); modals.batchPhoto()">
                                    Portrait
                                </button>
                                <button class="btn btn-sm ${transformations.cropPreset === 'landscape' ? 'btn-primary' : 'btn-secondary'}"
                                        onclick="handlers.setBatchPhotoCropPreset('landscape'); modals.batchPhoto()">
                                    Landscape
                                </button>
                                <button class="btn btn-sm ${transformations.cropPreset === 'ebay' ? 'btn-primary' : 'btn-secondary'}"
                                        onclick="handlers.setBatchPhotoCropPreset('ebay'); modals.batchPhoto()">
                                    eBay
                                </button>
                                <button class="btn btn-sm ${transformations.cropPreset === 'poshmark' ? 'btn-primary' : 'btn-secondary'}"
                                        onclick="handlers.setBatchPhotoCropPreset('poshmark'); modals.batchPhoto()">
                                    Poshmark
                                </button>
                                <button class="btn btn-sm ${transformations.cropPreset === 'whatnot' ? 'btn-primary' : 'btn-secondary'}"
                                        onclick="handlers.setBatchPhotoCropPreset('whatnot'); modals.batchPhoto()">
                                    Mercari
                                </button>
                            </div>
                            ${transformations.cropWidth && transformations.cropHeight ? `
                                <div class="batch-photo-crop-info mt-2">
                                    <span class="text-sm text-gray-600">
                                        Size: ${transformations.cropWidth} x ${transformations.cropHeight} px
                                    </span>
                                    <button class="btn btn-sm btn-ghost" onclick="handlers.clearBatchPhotoCrop(); modals.batchPhoto()">
                                        Clear
                                    </button>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Saved Presets -->
                        <div class="batch-photo-section">
                            <h4>Saved Presets</h4>
                            <div class="batch-photo-presets-row">
                                ${presets.length > 0 ? `
                                    <select class="form-select" style="flex: 1;" onchange="if(this.value) handlers.applyBatchPhotoPreset(this.value)">
                                        <option value="">Select a preset...</option>
                                        ${presets.map(p => `
                                            <option value="${p.id}">${escapeHtml(p.name)} ${p.is_default ? '(Default)' : ''}</option>
                                        `).join('')}
                                    </select>
                                ` : `
                                    <span class="text-sm text-gray-500">No saved presets</span>
                                `}
                                <button class="btn btn-sm btn-secondary" onclick="handlers.saveBatchPhotoPreset()">
                                    ${components.icon('plus', 14)} Save Current
                                </button>
                            </div>
                        </div>
                    </div>
                `}
            </div>
            ${!isProcessing ? `
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="handlers.closeBatchPhotoModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="handlers.createBatchPhotoJob()">
                        ${components.icon('automation', 16)} Process ${selectedImages.length} Images
                    </button>
                </div>
            ` : ''}
        `);
    },

    // Add Calendar Event Modal
    addCalendarEvent(dateStr = null) {
        const today = dateStr || toLocalDate(new Date());
        const eventTypes = [
            { value: 'listing', label: 'Listing Event', color: '#6366f1' },
            { value: 'sale', label: 'Sale/Order', color: '#10b981' },
            { value: 'shipping', label: 'Shipping Deadline', color: '#f59e0b' },
            { value: 'sourcing', label: 'Sourcing Trip', color: '#8b5cf6' },
            { value: 'other', label: 'Other', color: '#6b7280' }
        ];

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Add Event</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="add-event-form" onsubmit="handlers.saveCalendarEvent(event)">
                    <div class="form-group">
                        <label class="form-label">Event Title *</label>
                        <input type="text" name="title" class="form-input" placeholder="Enter event title" required>
                    </div>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input type="date" name="date" class="form-input" value="${today}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Time (optional)</label>
                            <input type="time" name="time" class="form-input">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Event Type</label>
                        <select name="type" class="form-select" onchange="document.querySelector('input[name=color]').value = this.options[this.selectedIndex].dataset.color">
                            ${eventTypes.map(t => `<option value="${t.value}" data-color="${t.color}">${t.label}</option>`).join('')}
                        </select>
                        <input type="hidden" name="color" value="#6366f1">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description (optional)</label>
                        <textarea name="description" class="form-textarea" rows="3" placeholder="Add details about this event..."></textarea>
                    </div>

                    <div class="form-group">
                        <label class="form-label flex items-center gap-2">
                            <input type="checkbox" name="reminder" value="1">
                            Send me a reminder
                        </label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('add-event-form').requestSubmit()">
                    ${components.icon('plus', 16)} Add Event
                </button>
            </div>
        `);
        // Wire auto-save for calendar event form
        setTimeout(() => autoSave.init('add-event-form', 'calendar-event', 1500), 100);
    },

    // Edit Calendar Event Modal
    editCalendarEvent(eventId) {
        const events = store.state.calendarEvents || [];
        const event = events.find(e => e.id === eventId);

        if (!event) {
            toast.error('Event not found');
            return;
        }

        const eventTypes = [
            { value: 'listing', label: 'Listing Event', color: '#6366f1' },
            { value: 'sale', label: 'Sale/Order', color: '#10b981' },
            { value: 'shipping', label: 'Shipping Deadline', color: '#f59e0b' },
            { value: 'sourcing', label: 'Sourcing Trip', color: '#8b5cf6' },
            { value: 'other', label: 'Other', color: '#6b7280' }
        ];

        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Edit Event</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="edit-event-form" onsubmit="handlers.updateCalendarEvent(event, '${eventId}')">
                    <div class="form-group">
                        <label class="form-label">Event Title *</label>
                        <input type="text" name="title" class="form-input" value="${escapeHtml(event.title || '')}" required>
                    </div>

                    <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label">Date *</label>
                            <input type="date" name="date" class="form-input" value="${event.date || ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Time (optional)</label>
                            <input type="time" name="time" class="form-input" value="${event.time || ''}">
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Event Type</label>
                        <select name="type" class="form-select" onchange="document.querySelector('input[name=color]').value = this.options[this.selectedIndex].dataset.color">
                            ${eventTypes.map(t => `<option value="${t.value}" data-color="${t.color}" ${event.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                        <input type="hidden" name="color" value="${event.color || '#6366f1'}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Description (optional)</label>
                        <textarea name="description" class="form-textarea" rows="3">${escapeHtml(event.description || '')}</textarea>
                    </div>

                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-danger" onclick="handlers.deleteCalendarEvent('${eventId}')" style="margin-right: auto;">
                    ${components.icon('trash', 16)} Delete
                </button>
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('edit-event-form').requestSubmit()">
                    Save Changes
                </button>
            </div>
        `);
    },

    // Barcode Scanner Modal
    barcodeScanner() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${components.icon('search', 24)} Barcode Scanner</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div class="barcode-scanner-container">
                    <video id="barcode-video" class="barcode-scanner-video" autoplay playsinline></video>
                    <div class="barcode-scanner-overlay"></div>
                </div>
                <p class="barcode-scanner-instructions">
                    Position the barcode within the frame. Scanning will happen automatically.
                </p>

                <div class="barcode-manual-entry">
                    <label>Or enter barcode manually:</label>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <input type="text" id="barcode-manual-input" class="form-input" placeholder="Enter UPC/EAN code" pattern="[0-9]{8,14}">
                        <button class="btn btn-primary" onclick="handlers.lookupBarcode()">
                            ${components.icon('search', 16)} Lookup
                        </button>
                    </div>
                </div>

                <div id="barcode-result" class="barcode-result" style="display: none;">
                    <h4>Product Found!</h4>
                    <dl class="barcode-result-data">
                        <dt>Title:</dt><dd id="barcode-title"></dd>
                        <dt>Brand:</dt><dd id="barcode-brand"></dd>
                        <dt>Category:</dt><dd id="barcode-category"></dd>
                    </dl>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="handlers.stopBarcodeScanner(); modals.close()">Cancel</button>
                <button class="btn btn-primary" id="barcode-apply-btn" onclick="handlers.applyBarcodeData()" disabled>
                    Apply to Form
                </button>
            </div>
        `);
        handlers.startBarcodeScanner();
    },

    // Duplicate Detection Modal
    duplicates() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${components.icon('alert', 24)} Duplicate Detection</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <p style="color: var(--gray-600);">Review potential duplicate items in your inventory.</p>
                    <button class="btn btn-primary btn-sm" onclick="handlers.scanForDuplicates()">
                        ${components.icon('search', 16)} Scan Now
                    </button>
                </div>

                <div id="duplicates-list" style="max-height: 400px; overflow-y: auto;">
                    <p style="text-align: center; color: var(--gray-500); padding: 32px;">
                        Click "Scan Now" to check for duplicate items.
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Close</button>
            </div>
        `);
    },

    // Team Management Modal
    teamManagement() {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${components.icon('users', 24)} Team Management</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div id="team-content">
                    <div style="text-align: center; padding: 32px;">
                        <div class="spinner"></div>
                        <p style="margin-top: 12px; color: var(--gray-600);">Loading teams...</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Close</button>
                <button class="btn btn-primary" onclick="modals.createTeam()">
                    ${components.icon('plus', 16)} Create Team
                </button>
            </div>
        `);
        handlers.loadTeams();
    },

    // Create Team Modal
    createTeam() {
        const tier = store.state.user?.subscription_tier || 'free';
        if (tier === 'free') {
            toast.info('Team features require a Pro or Business plan. Upgrade to get started.');
            return;
        }
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${components.icon('plus', 24)} Create New Team</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <form id="create-team-form" onsubmit="handlers.createTeam(event)">
                    <div class="form-group">
                        <label class="form-label">Team Name *</label>
                        <input type="text" class="form-input" name="name" required minlength="2" placeholder="e.g., My Reselling Team">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description (optional)</label>
                        <textarea class="form-textarea" name="description" rows="3" placeholder="What does this team do?"></textarea>
                    </div>

                    <div style="background: var(--gray-50); padding: 16px; border-radius: 8px; margin-top: 16px;">
                        <h4 style="margin-bottom: 12px;">Role Permissions</h4>
                        <table class="team-permissions-table">
                            <thead>
                                <tr>
                                    <th>Permission</th>
                                    <th>Owner</th>
                                    <th>Admin</th>
                                    <th>Manager</th>
                                    <th>Member</th>
                                    <th>Viewer</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>View Inventory</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                </tr>
                                <tr>
                                    <td>Edit Inventory</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-x">✗</td>
                                </tr>
                                <tr>
                                    <td>View Sales</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-x">✗</td>
                                    <td class="permission-x">✗</td>
                                </tr>
                                <tr>
                                    <td>View Financials</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-x">✗</td>
                                    <td class="permission-x">✗</td>
                                    <td class="permission-x">✗</td>
                                </tr>
                                <tr>
                                    <td>Manage Team</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-check">✓</td>
                                    <td class="permission-x">✗</td>
                                    <td class="permission-x">✗</td>
                                    <td class="permission-x">✗</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.teamManagement()">Back</button>
                <button class="btn btn-primary" onclick="document.getElementById('create-team-form').requestSubmit()">
                    Create Team
                </button>
            </div>
        `);
    },

    // Invite Team Member Modal
    inviteTeamMember(teamId, teamName) {
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${components.icon('mail', 24)} Invite Team Member</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 16px; color: var(--gray-600);">Invite someone to join <strong>${escapeHtml(teamName)}</strong></p>
                <form id="invite-member-form" onsubmit="handlers.inviteTeamMember(event, '${teamId}')">
                    <div class="form-group">
                        <label class="form-label">Email Address *</label>
                        <input type="email" class="form-input" name="email" required placeholder="colleague@email.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Role</label>
                        <select class="form-select" name="role">
                            <option value="member">Member - Can view and edit inventory</option>
                            <option value="viewer">Viewer - Can only view inventory</option>
                            <option value="manager">Manager - Can also view sales</option>
                            <option value="admin">Admin - Full access except delete team</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Personal Message (optional)</label>
                        <textarea class="form-textarea" name="message" rows="2" placeholder="Hey, join my team!"></textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="document.getElementById('invite-member-form').requestSubmit()">
                    ${components.icon('mail', 16)} Send Invitation
                </button>
            </div>
        `);
    },

    // Whatnot Live Event modals
    createWhatnotEvent() {
        store.setState({ editingWhatnotEvent: null });
        this.show(`
            <div class="modal-header">
                <h2>Create Live Event</h2>
                <button class="btn btn-icon btn-ghost" onclick="modals.close()" aria-label="Close modal">${components.icon('close', 20)}</button>
            </div>
            <div class="modal-body">
                <form id="whatnot-event-form">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group col-span-2">
                            <label class="form-label">Event Title *</label>
                            <input type="text" class="form-input" name="title" required placeholder="Friday Night Shoe Auction">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Start Time *</label>
                            <input type="datetime-local" class="form-input" name="start_time" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duration (minutes)</label>
                            <input type="number" class="form-input" name="duration" value="60" min="15" max="480">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select class="form-select" name="category">
                                <option value="general">General</option>
                                <option value="clothing">Clothing</option>
                                <option value="shoes">Shoes</option>
                                <option value="accessories">Accessories</option>
                                <option value="electronics">Electronics</option>
                                <option value="collectibles">Collectibles</option>
                                <option value="sports">Sports</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Shipping</label>
                            <select class="form-select" name="shipping">
                                <option value="standard">Standard Shipping</option>
                                <option value="flat_rate">Flat Rate</option>
                                <option value="calculated">Calculated</option>
                            </select>
                        </div>
                        <div class="form-group col-span-2">
                            <label class="form-label">Description</label>
                            <textarea class="form-textarea" name="description" rows="2" placeholder="Optional event description"></textarea>
                        </div>
                        <div class="form-group col-span-2">
                            <label class="form-label">Notes (private)</label>
                            <textarea class="form-textarea" name="notes" rows="2" placeholder="Internal notes for this event"></textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="handlers.saveWhatnotEvent(false)">Create Event</button>
            </div>
        `);
    },

    editWhatnotEvent(eventId) {
        const event = (store.state.whatnotEvents || []).find(e => e.id === eventId);
        if (!event) return;
        store.setState({ editingWhatnotEvent: event });

        const startTime = event.start_time ? new Date(event.start_time).toISOString().slice(0, 16) : '';

        this.show(`
            <div class="modal-header">
                <h2>Edit Live Event</h2>
                <button class="btn btn-icon btn-ghost" onclick="modals.close()" aria-label="Close modal">${components.icon('close', 20)}</button>
            </div>
            <div class="modal-body">
                <form id="whatnot-event-form">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-group col-span-2">
                            <label class="form-label">Event Title *</label>
                            <input type="text" class="form-input" name="title" required value="${escapeHtml(event.title || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Start Time *</label>
                            <input type="datetime-local" class="form-input" name="start_time" required value="${startTime}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Duration (minutes)</label>
                            <input type="number" class="form-input" name="duration" value="${event.estimated_duration || 60}" min="15" max="480">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category</label>
                            <select class="form-select" name="category">
                                ${['general', 'clothing', 'shoes', 'accessories', 'electronics', 'collectibles', 'sports'].map(c =>
                                    `<option value="${c}" ${event.category === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Shipping</label>
                            <select class="form-select" name="shipping">
                                ${['standard', 'flat_rate', 'calculated'].map(s =>
                                    `<option value="${s}" ${event.shipping_option === s ? 'selected' : ''}>${s.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group col-span-2">
                            <label class="form-label">Description</label>
                            <textarea class="form-textarea" name="description" rows="2">${escapeHtml(event.description || '')}</textarea>
                        </div>
                        <div class="form-group col-span-2">
                            <label class="form-label">Notes (private)</label>
                            <textarea class="form-textarea" name="notes" rows="2">${escapeHtml(event.notes || '')}</textarea>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                <button class="btn btn-primary" onclick="handlers.saveWhatnotEvent(true)">Save Changes</button>
            </div>
        `);
    },

    viewWhatnotEvent(event) {
        const items = event.items || [];
        const inventory = store.state.inventory || [];

        this.show(`
            <div class="modal-header">
                <h2>${escapeHtml(event.title || event.name || 'Untitled Event')}</h2>
                <button class="btn btn-icon btn-ghost" onclick="modals.close()" aria-label="Close modal">${components.icon('close', 20)}</button>
            </div>
            <div class="modal-body">
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <div class="text-sm text-gray-500">Start Time</div>
                        <div class="font-medium">${event.start_time ? new Date(event.start_time).toLocaleString() : 'TBD'}</div>
                    </div>
                    <div>
                        <div class="text-sm text-gray-500">Duration</div>
                        <div class="font-medium">${event.estimated_duration || 60} minutes</div>
                    </div>
                    <div>
                        <div class="text-sm text-gray-500">Category</div>
                        <div class="font-medium">${event.category || 'General'}</div>
                    </div>
                    <div>
                        <div class="text-sm text-gray-500">Status</div>
                        <span class="badge badge-${(event.status || 'scheduled') === 'completed' ? 'success' : (event.status || 'scheduled') === 'live' ? 'primary' : 'gray'}">${event.status || 'Scheduled'}</span>
                    </div>
                </div>

                ${event.description ? `<div class="mb-4"><div class="text-sm text-gray-500 mb-1">Description</div><p>${escapeHtml(event.description)}</p></div>` : ''}

                <div class="border-t pt-4">
                    <div class="flex items-center justify-between mb-3">
                        <h3 class="font-semibold">Event Items (${items.length})</h3>
                        <button class="btn btn-sm btn-primary" onclick="modals.addItemToEvent('${event.id}')">Add Item</button>
                    </div>
                    ${items.length > 0 ? `
                        <div class="space-y-2">
                            ${items.map((item, idx) => `
                                <div class="flex items-center justify-between p-2 border rounded">
                                    <div class="flex items-center gap-3">
                                        <span class="text-gray-400 text-sm">${idx + 1}</span>
                                        <div>
                                            <div class="font-medium">${escapeHtml(item.inventory_title || 'Item')}</div>
                                            <div class="text-xs text-gray-500">Start: $${item.starting_price || 0}${item.buy_now_price ? ` • BIN: $${item.buy_now_price}` : ''}</div>
                                        </div>
                                    </div>
                                    <button class="btn btn-icon btn-sm btn-error" onclick="handlers.removeItemFromWhatnotEvent('${event.id}', '${item.id}')" aria-label="Remove item">
                                        ${components.icon('trash', 14)}
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<div class="text-gray-500 text-sm">No items added yet</div>`}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Close</button>
                <button class="btn btn-primary" onclick="modals.editWhatnotEvent('${event.id}')">Edit Event</button>
            </div>
        `, 'modal-lg');
    },

    addItemToEvent(eventId) {
        const inventory = (store.state.inventory || []).filter(i => i.status === 'active');

        this.show(`
            <div class="modal-header">
                <h2>Add Item to Event</h2>
                <button class="btn btn-icon btn-ghost" onclick="modals.close()" aria-label="Close modal">${components.icon('close', 20)}</button>
            </div>
            <div class="modal-body">
                <div class="form-group mb-4">
                    <input type="text" class="form-input" placeholder="Search inventory..." onkeyup="handlers.filterEventItems(this.value)">
                </div>
                <div id="event-item-list" class="space-y-2" style="max-height: 400px; overflow-y: auto;">
                    ${inventory.map(item => `
                        <div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50 cursor-pointer" onclick="handlers.addItemToWhatnotEvent('${eventId}', '${item.id}')">
                            <div class="flex items-center gap-3">
                                ${item.images?.[0] ? `<img src="${item.images[0]}" class="w-10 h-10 rounded object-cover" alt="${escapeHtml(item.title || 'Product image')}">` : '<div class="w-10 h-10 rounded bg-gray-200" role="img" aria-label="No image"></div>'}
                                <div>
                                    <div class="font-medium">${escapeHtml(item.title)}</div>
                                    <div class="text-xs text-gray-500">$${item.list_price || 0}</div>
                                </div>
                            </div>
                            ${components.icon('plus', 16)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `);
    },

    // Duplicate viewReport removed — canonical version with null guard is below

    // Add item to Whatnot event modal
    addItemToEvent(eventId) {
        const inventory = store.state.inventory || [];
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">Add Item to Event</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body">
                <div class="form-group mb-4">
                    <label class="form-label">Search Inventory</label>
                    <input type="text" class="form-input" id="event-item-search" placeholder="Search by title, SKU, or brand..." oninput="handlers.filterEventItemSearch(this.value)">
                </div>
                <div id="event-item-list" style="max-height: 400px; overflow-y: auto;">
                    ${inventory.length === 0 ? '<p class="text-gray-500 text-center py-4">No items in inventory</p>' :
                    inventory.slice(0, 20).map(item => `
                        <div class="flex items-center gap-3 p-3 border-b hover:bg-gray-50 cursor-pointer" onclick="handlers.selectEventItem('${eventId}', '${item.id}')">
                            <div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                ${item.images ? `<img src="${(() => { try { return JSON.parse(item.images)[0] || ''; } catch { return ''; } })()}" class="w-full h-full object-cover rounded" alt="${escapeHtml(item.title || 'Product image')}">` : components.icon('image', 20)}
                            </div>
                            <div class="flex-1">
                                <div class="font-medium">${escapeHtml(item.title)}</div>
                                <div class="text-sm text-gray-500">${item.sku || 'No SKU'} • $${(item.list_price || 0).toFixed(2)}</div>
                            </div>
                            <button class="btn btn-sm btn-primary">Add</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
            </div>
        `);
    },

    // View report modal (called from report generation)
    viewReport(report, widgetData) {
        if (!report) {
            toast.error('Report data not available');
            return;
        }
        this.show(`
            <div class="modal-header">
                <h2 class="modal-title">${escapeHtml(report.title || report.name || 'Report')}</h2>
                <button class="modal-close" aria-label="Close" onclick="modals.close()">${components.icon('close')}</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <div class="report-meta mb-4">
                    <span class="text-sm text-gray-500">Generated: ${new Date().toLocaleString()}</span>
                </div>
                <div class="report-content">
                    ${widgetData ? `
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            ${Object.entries(widgetData).map(([key, value]) => `
                                <div class="stat-card p-4 bg-gray-50 rounded-lg">
                                    <div class="text-sm text-gray-500">${escapeHtml(key)}</div>
                                    <div class="text-xl font-bold">${typeof value === 'number' ? value.toLocaleString() : value}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="report-details p-4 bg-gray-50 rounded-lg">
                        <pre style="white-space: pre-wrap; font-size: 12px;">${JSON.stringify(report, null, 2)}</pre>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="modals.close()">Close</button>
                <button class="btn btn-primary" onclick="handlers.downloadReport('${report.id || 'report'}')">Download</button>
            </div>
        `, 'modal-xl');
    },

    // AR Preview modal — camera overlay with draggable/pinch-scalable item image
    arPreview(itemId) {
        // Resolve item from store state
        const inventory = store.state.inventory || [];
        const item = inventory.find(i => i.id === itemId);
        if (!item) {
            toast.error('Item not found');
            return;
        }
        let images = [];
        try { images = JSON.parse(item.images || '[]'); } catch { images = []; }
        const imageUrl = images[0] || '';
        const itemTitle = item.title || 'Item';

        if (!imageUrl) {
            toast.error('This item has no image to preview');
            return;
        }

        const container = document.getElementById('modal-container');
        // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        container.innerHTML =sanitizeHTML( sanitizeHTML(`
            <div class="ar-preview-backdrop" id="ar-backdrop" role="dialog" aria-modal="true" aria-label="AR Preview">
                <video id="ar-video" class="ar-video" autoplay playsinline muted aria-hidden="true"></video>
                <canvas id="ar-canvas" class="ar-canvas" style="display:none;" aria-hidden="true"></canvas>
                <img id="ar-overlay-img"
                     class="ar-overlay-img"
                     src="${escapeHtml(imageUrl)}"
                     alt="${escapeHtml(itemTitle)}"
                     draggable="false"
                     style="left:50%;top:50%;transform:translate(-50%,-50%) scale(1);"
                />
                <div class="ar-hud">
                    <span class="ar-hud-title">${escapeHtml(itemTitle)}</span>
                    <span class="ar-hud-hint">Drag to position &bull; Pinch to resize</span>
                </div>
                <div class="ar-controls">
                    <button class="ar-btn ar-btn-capture" id="ar-capture-btn" title="Capture photo" aria-label="Capture AR photo">
                        ${components.icon('camera', 22)}
                    </button>
                    <button class="ar-btn ar-btn-share" id="ar-share-btn" title="Share photo" aria-label="Share AR photo" style="display:none;">
                        ${components.icon('share', 22)}
                    </button>
                    <button class="ar-btn ar-btn-size" id="ar-size-s" title="Small (0.5×) — accessories, shoes" aria-label="Small size preset" aria-pressed="false">S</button>
                    <button class="ar-btn ar-btn-size ar-btn-size-active" id="ar-size-m" title="Medium (1.0×) — t-shirts, bags" aria-label="Medium size preset" aria-pressed="true">M</button>
                    <button class="ar-btn ar-btn-size" id="ar-size-l" title="Large (1.5×) — coats, dresses" aria-label="Large size preset" aria-pressed="false">L</button>
                    <button class="ar-btn ar-btn-close" id="ar-close-btn" title="Close" aria-label="Close AR preview">
                        ${components.icon('close', 22)}
                    </button>
                </div>
                <div id="ar-nocam-msg" class="ar-nocam-msg" style="display:none;">
                    Camera not available. Point your device at the scene and use the overlay below.
                </div>
            </div>
        `));

        let stream = null;
        const video = document.getElementById('ar-video');
        const overlay = document.getElementById('ar-overlay-img');
        const captureBtn = document.getElementById('ar-capture-btn');
        const shareBtn = document.getElementById('ar-share-btn');
        const closeBtn = document.getElementById('ar-close-btn');
        const sizeBtns = [
            { el: document.getElementById('ar-size-s'), scale: 0.5 },
            { el: document.getElementById('ar-size-m'), scale: 1.0 },
            { el: document.getElementById('ar-size-l'), scale: 1.5 },
        ];
        const setPresetScale = (targetScale) => {
            overlayScale = targetScale;
            overlay.style.transform = `translate(-50%, -50%) scale(${overlayScale})`;
            sizeBtns.forEach(({ el, scale }) => {
                const active = scale === targetScale;
                el.classList.toggle('ar-btn-size-active', active);
                el.setAttribute('aria-pressed', String(active));
            });
        };
        sizeBtns.forEach(({ el, scale }) => el.addEventListener('click', () => setPresetScale(scale)));

        // Hide Share button if Web Share API or file sharing is not supported
        const canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
        let latestBlob = null;
        let rafId = null;

        // Start rear camera
        const nocamMsg = document.getElementById('ar-nocam-msg');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
                .then(s => {
                    stream = s;
                    video.srcObject = s;
                })
                .catch((err) => {
                    video.style.display = 'none';
                    if (nocamMsg) {
                        const isDenied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
                        nocamMsg.textContent = isDenied
                            ? 'Camera access denied. Please allow camera permission and try again.'
                            : 'Camera not available on this device. Overlay mode only.';
                        nocamMsg.style.display = 'flex';
                    }
                });
        } else {
            video.style.display = 'none';
            if (nocamMsg) {
                nocamMsg.textContent = 'Camera not supported in this browser. Overlay mode only.';
                nocamMsg.style.display = 'flex';
            }
        }

        // Close handler — stop camera tracks and remove all document listeners
        const cleanup = () => {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
            container.innerHTML =sanitizeHTML( sanitizeHTML(''));  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            document.removeEventListener('keydown', escHandler);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        };
        const escHandler = (e) => { if (e.key === 'Escape') cleanup(); };
        document.addEventListener('keydown', escHandler);
        closeBtn.addEventListener('click', cleanup);

        // Capture: composite video + overlay onto canvas, then trigger download
        captureBtn.addEventListener('click', () => {
            const cvs = document.getElementById('ar-canvas');
            const w = video.videoWidth || window.innerWidth;
            const h = video.videoHeight || window.innerHeight;
            cvs.width = w;
            cvs.height = h;
            const ctx = cvs.getContext('2d');

            // Draw video frame (blank rect if no camera)
            if (video.readyState >= 2 && video.videoWidth > 0) {
                ctx.drawImage(video, 0, 0, w, h);
            } else {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, w, h);
            }

            // Draw overlay image at its current position/scale
            const rect = overlay.getBoundingClientRect();
            const videoRect = video.getBoundingClientRect();
            const scaleX = w / (videoRect.width || window.innerWidth);
            const scaleY = h / (videoRect.height || window.innerHeight);
            const overlayImg = new Image();
            overlayImg.crossOrigin = 'anonymous';
            overlayImg.onload = () => {
                ctx.drawImage(
                    overlayImg,
                    (rect.left - videoRect.left) * scaleX,
                    (rect.top - videoRect.top) * scaleY,
                    rect.width * scaleX,
                    rect.height * scaleY
                );
                const link = document.createElement('a');
                link.download = `ar-preview-${escapeHtml(itemId)}.png`;
                link.href = cvs.toDataURL('image/png');
                link.click();
                toast.success('AR photo saved');

                // Store blob and reveal Share button after first capture
                cvs.toBlob((blob) => {
                    if (!blob) return;
                    latestBlob = blob;
                    if (canShare) {
                        const testFile = new File([blob], 'ar-preview.png', { type: 'image/png' });
                        if (navigator.canShare({ files: [testFile] })) {
                            shareBtn.style.display = '';
                        }
                    }
                }, 'image/png');
            };
            overlayImg.onerror = () => toast.error('Could not capture image');
            overlayImg.src = imageUrl;
        });

        // Share handler — fires only after a capture has been taken
        shareBtn.addEventListener('click', () => {
            if (!latestBlob) return;
            const file = new File([latestBlob], 'ar-preview.png', { type: 'image/png' });
            navigator.share({
                title: 'VaultLister AR Preview',
                text: `Check out this ${escapeHtml(item.title)}!`,
                files: [file]
            }).catch((err) => {
                if (err.name !== 'AbortError') toast.error('Share failed');
            });
        });

        // Drag-to-position (mouse + touch) with RAF-based FPS limiter
        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let overlayLeft = window.innerWidth / 2;
        let overlayTop = window.innerHeight / 2;
        let overlayScale = 1;
        let pendingLeft = overlayLeft, pendingTop = overlayTop, pendingScale = overlayScale;
        const FPS_LIMIT = 1000 / 30; // cap overlay DOM updates at 30 fps
        let lastFrameTime = 0;

        const applyOverlayTransform = (timestamp) => {
            rafId = null;
            if (timestamp - lastFrameTime < FPS_LIMIT) {
                rafId = requestAnimationFrame(applyOverlayTransform);
                return;
            }
            lastFrameTime = timestamp;
            overlay.style.left = pendingLeft + 'px';
            overlay.style.top = pendingTop + 'px';
            overlay.style.transform = `translate(-50%, -50%) scale(${pendingScale})`;
            overlayLeft = pendingLeft;
            overlayTop = pendingTop;
            overlayScale = pendingScale;
        };

        const scheduleUpdate = () => {
            if (!rafId) rafId = requestAnimationFrame(applyOverlayTransform);
        };

        overlay.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartX = e.clientX - overlayLeft;
            dragStartY = e.clientY - overlayTop;
            e.preventDefault();
        });
        overlay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                dragStartX = e.touches[0].clientX - overlayLeft;
                dragStartY = e.touches[0].clientY - overlayTop;
            }
        }, { passive: true });

        const onMouseMove = (e) => {
            if (!isDragging) return;
            pendingLeft = e.clientX - dragStartX;
            pendingTop = e.clientY - dragStartY;
            scheduleUpdate();
        };
        const onMouseUp = () => { isDragging = false; };
        const onTouchMove = (e) => {
            if (e.touches.length === 1 && isDragging) {
                pendingLeft = e.touches[0].clientX - dragStartX;
                pendingTop = e.touches[0].clientY - dragStartY;
                scheduleUpdate();
            } else if (e.touches.length === 2 && lastPinchDist !== null) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                pendingScale = Math.min(5, Math.max(0.2, overlayScale * (dist / lastPinchDist)));
                lastPinchDist = dist;
                scheduleUpdate();
            }
        };
        const onTouchEnd = (e) => {
            if (e.touches.length < 2) lastPinchDist = null;
            if (e.touches.length === 0) isDragging = false;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd);

        // Pinch-to-zoom
        let lastPinchDist = null;
        overlay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastPinchDist = Math.sqrt(dx * dx + dy * dy);
                isDragging = false;
            }
        }, { passive: true });
    }
};
