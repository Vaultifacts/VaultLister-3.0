'use strict';
// Core handlers (eager) — auth, dashboard, navigation, file handling
// Loaded on initial page load

const handlers = {
    _selectedFiles: { add: [], edit: [] },

    // Debounce map for checklist item toggles (prevents race conditions),

    _pendingToggles: {},

    // --- Login & Registration Handlers ---,

    logout() {
        auth.logout();
    },

    validateLoginField(input) {
        const name = input.name;
        const value = input.value.trim();
        const errorSpan = document.getElementById(`login-${name}-error`);

        let isValid = false;
        if (name === 'email') {
            isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        } else if (name === 'password') {
            isValid = value.length > 0;
        }

        if (value.length === 0) {
            input.classList.remove('field-error', 'field-valid');
            if (errorSpan) errorSpan.style.display = 'none';
        } else if (isValid) {
            input.classList.remove('field-error');
            input.classList.add('field-valid');
            if (errorSpan) errorSpan.style.display = 'none';
        } else {
            input.classList.remove('field-valid');
            input.classList.add('field-error');
            if (errorSpan) errorSpan.style.display = 'block';
        }
    },

    checkRegisterPassword(input) {
        const pw = input.value;
        const rules = {
            length: pw.length >= 12,
            uppercase: /[A-Z]/.test(pw),
            lowercase: /[a-z]/.test(pw),
            number: /[0-9]/.test(pw),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)
        };

        Object.entries(rules).forEach(([key, met]) => {
            const item = document.querySelector(`.password-req-item[data-req="${key}"]`);
            if (!item) return;
            const icon = item.querySelector('.req-icon');
            if (met) {
                item.classList.add('met');
                if (icon) icon.innerHTML = '&#10003;';
            } else {
                item.classList.remove('met');
                if (icon) icon.innerHTML = '&#9675;';
            }
        });
    },

    socialLogin(provider) {
        const name = provider.charAt(0).toUpperCase() + provider.slice(1);
        toast.info(`${name} sign-in coming soon!`);
    },

    handleDragOver: function(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.add('dragover');
    },

    // Handle drag leave,

    handleDragLeave: function(event) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('dragover');
    },

    // Handle drop,

    handleDrop: function(event, mode) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.classList.remove('dragover');

        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files, mode);
    },

    // Handle file select from input,

    handleFileSelect: function(event, mode) {
        const files = Array.from(event.target.files);
        this.processFiles(files, mode);
    },

    // Process and validate files,

    processFiles: function(files, mode) {
        const existingFiles = this._selectedFiles[mode] || [];
        let photos = existingFiles.filter(f => f.type.startsWith('image/'));
        let videos = existingFiles.filter(f => f.type.startsWith('video/'));

        files.forEach(file => {
            // Validate file type
            if (!file.type.match(/^(image\/(png|jpeg)|video\/mp4)$/)) {
                toast.error(`${file.name}: Only PNG, JPEG images and MP4 videos are supported`);
                return;
            }

            // Validate limits
            if (file.type.startsWith('image/')) {
                if (photos.length >= 24) {
                    toast.warning('Maximum 24 photos allowed');
                    return;
                }
                if (file.size > 10 * 1024 * 1024) {
                    toast.error(`${file.name}: Photos must be under 10MB`);
                    return;
                }
                photos.push(file);
            } else if (file.type.startsWith('video/')) {
                if (videos.length >= 1) {
                    toast.warning('Maximum 1 video allowed');
                    return;
                }
                if (file.size > 50 * 1024 * 1024) {
                    toast.error(`${file.name}: Videos must be under 50MB`);
                    return;
                }
                videos.push(file);
            }
        });

        this._selectedFiles[mode] = [...photos, ...videos];
        this.renderMediaPreviews(mode);
    },

    // Render media previews,

    renderMediaPreviews: function(mode) {
        const container = document.getElementById(`media-preview-${mode}`);
        if (!container) return;

        // Revoke previous blob URLs to prevent memory leaks
        container.querySelectorAll('img[src^="blob:"], video[src^="blob:"], source[src^="blob:"]').forEach(el => {
            try { URL.revokeObjectURL(el.src); } catch (_) {}
        });

        const files = this._selectedFiles[mode] || [];
        container.innerHTML = files.map((file, index) => {
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video/');

            return `
                <div class="media-preview-item">
                    ${isVideo ? `
                        <video src="${url}" controls>
                            <source src="${url}" type="video/mp4">
                        </video>
                        <div class="media-label">VIDEO</div>
                    ` : `
                        <img src="${url}" alt="Preview ${index + 1}">
                    `}
                    <button type="button" class="media-remove-btn" onclick="handlers.removeFile('${mode}', ${index})" title="Remove">×</button>
                </div>
            `;
        }).join('');

        // Update file input to enable form submission with files
        const inputId = mode === 'add' ? 'item-images-input' : 'edit-item-images-input';
        const input = document.getElementById(inputId);
        if (input && files.length > 0) {
            // Create a new DataTransfer to set files
            const dt = new DataTransfer();
            files.forEach(file => dt.items.add(file));
            input.files = dt.files;
        }

        // Click dropzone to trigger file input
        const dropzone = document.getElementById(`dropzone-${mode}`);
        if (dropzone) {
            dropzone.onclick = () => input?.click();
        }
    },

    // Remove a file from selection,

    removeFile: function(mode, index) {
        this._selectedFiles[mode].splice(index, 1);
        this.renderMediaPreviews(mode);
    },

    // Legacy function for compatibility,

    handleImagePreview: function(event, containerId) {
        // Redirect to new implementation
        const mode = containerId.includes('edit') ? 'edit' : 'add';
        this.handleFileSelect(event, mode);
    },

    // Set monthly sales goal,

    setMonthlyGoal: async function() {
        const current = store.state.monthlySalesGoal || 2000;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title">Set Monthly Goal</h3>
                    <button class="modal-close" aria-label="Close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Monthly Revenue Goal ($)</label>
                        <input type="number" class="form-input" id="monthly-goal-input" value="${current}" min="0" step="100">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" onclick="handlers.saveMonthlyGoal()">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    saveMonthlyGoal: function() {
        const input = document.getElementById('monthly-goal-input');
        const goal = parseInt(input?.value) || 2000;
        store.setState({ monthlySalesGoal: goal });
        localStorage.setItem('vaultlister_monthly_goal', goal);
        document.querySelector('.modal-overlay')?.remove();
        toast.success(`Monthly goal set to $${goal.toLocaleString()}`);
        router.navigate('dashboard');
    },

    // Expand sparkline into full chart modal,

    expandSparkline: function(dataType) {
        const days = 30;
        const data = [];
        const labels = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = toLocalDate(date);
            labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            if (dataType === 'sales') {
                data.push(store.state.sales.filter(s => s.sold_at?.startsWith(dateStr)).length);
            } else if (dataType === 'revenue') {
                data.push(store.state.sales.filter(s => s.sold_at?.startsWith(dateStr)).reduce((sum, s) => sum + (s.sale_price || 0), 0));
            } else if (dataType === 'inventory') {
                const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
                data.push(store.state.inventory.filter(item => new Date(item.created_at) <= endOfDay).length);
            } else {
                const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);
                data.push(store.state.listings.filter(l => l.status === 'active' && new Date(l.listed_at || l.created_at) <= endOfDay).length);
            }
        }
        const max = Math.max(...data, 1);
        const min = Math.min(...data);
        const range = max - min || 1;
        const w = 560, h = 200, padX = 50, padY = 30;
        const chartW = w - padX * 2, chartH = h - padY * 2;
        const points = data.map((val, i) => {
            const x = padX + (i / Math.max(data.length - 1, 1)) * chartW;
            const y = padY + chartH - ((val - min) / range) * chartH;
            return { x, y, val };
        });
        const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
        const areaPath = `M${points[0].x},${padY + chartH} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length-1].x},${padY + chartH} Z`;
        const ySteps = 5;
        const yLines = Array.from({length: ySteps + 1}, (_, i) => {
            const val = min + (range / ySteps) * i;
            const y = padY + chartH - (i / ySteps) * chartH;
            return { y, label: dataType === 'revenue' ? '$' + Math.round(val) : Math.round(val) };
        });
        const xLabels = [0, Math.floor(days / 4), Math.floor(days / 2), Math.floor(days * 3 / 4), days - 1];
        const title = dataType.charAt(0).toUpperCase() + dataType.slice(1);
        modals.show(`
            <div class="modal" style="max-width: 660px;">
                <div class="modal-header">
                    <h3 class="modal-title">${title} — 30 Day Trend</h3>
                    <button class="modal-close" aria-label="Close" onclick="modals.close()">&times;</button>
                </div>
                <div class="modal-body" style="padding: 16px;">
                    <div class="sparkline-modal-chart">
                        <svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">
                            ${yLines.map(yl => `
                                <line x1="${padX}" y1="${yl.y}" x2="${w - padX}" y2="${yl.y}" stroke="var(--gray-200)" stroke-dasharray="4"/>
                                <text x="${padX - 8}" y="${yl.y + 4}" text-anchor="end" fill="var(--gray-400)" font-size="10">${yl.label}</text>
                            `).join('')}
                            ${xLabels.map(i => `
                                <text x="${points[i].x}" y="${h - 5}" text-anchor="middle" fill="var(--gray-400)" font-size="10">${labels[i]}</text>
                            `).join('')}
                            <path d="${areaPath}" fill="var(--primary-100)" opacity="0.5"/>
                            <polyline fill="none" stroke="var(--primary-500)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${polyline}"/>
                            ${points.filter((_, i) => i % 3 === 0 || i === points.length - 1).map(p => `
                                <circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--primary-500)"/>
                                <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" fill="var(--gray-600)" font-size="9">${dataType === 'revenue' ? '$' + Math.round(p.val) : p.val}</text>
                            `).join('')}
                        </svg>
                    </div>
                </div>
            </div>
        `);
    },

    // Set comparison period for dashboard,

    setComparisonPeriod: function(period) {
        store.setState({ comparisonPeriod: period });
        router.navigate('dashboard');
    },

    // Trigger celebration for first sale,

    triggerFirstSaleCelebration: function() {
        const hasFirstSale = localStorage.getItem('vaultlister_first_sale_celebrated');
        if (!hasFirstSale && store.state.sales?.length === 1) {
            localStorage.setItem('vaultlister_first_sale_celebrated', 'true');
            celebrations.confetti(150);
            setTimeout(() => {
                toast.success('Congratulations on your first sale!');
            }, 500);
            onboarding.complete('first-sale');
        }
    },

    // Switch between image upload tabs,

    updateFileInput: function(inputId) {
        // This removes the preview but keeps the file input functional
        // User can select new files after removing previews
    },

    fileToBase64: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    _isSearching: false,

    loadOffers: async function() {
        try {
            const data = await api.get('/offers');
            // Normalize field names - backend uses offer_amount, frontend uses amount
            const offers = (data.offers || []).map(o => ({
                ...o,
                amount: o.offer_amount || o.amount || 0
            }));
            store.setState({ offers });
        } catch (error) {
            console.error('Failed to load offers:', error);
            store.setState({ offers: [] });
            toast.error('Failed to load offers');
        }
    },

    setThemeMode: function(mode) {
        if (mode === 'dark') {
            document.body.classList.add('dark-mode');
            store.setState({ darkMode: true });
            localStorage.setItem('vaultlister_darkmode', 'true');
        } else if (mode === 'light') {
            document.body.classList.remove('dark-mode');
            store.setState({ darkMode: false });
            localStorage.setItem('vaultlister_darkmode', 'false');
        } else {
            // System preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.toggle('dark-mode', prefersDark);
            store.setState({ darkMode: prefersDark });
            localStorage.removeItem('vaultlister_darkmode');
        }
        renderApp(pages.settings());
    },

    setAccentColor: function(color) {
        themeManager.setAccent(color);
        renderApp(pages.settings());
    },

    loadTrendingFeedback: async function() {
        try {
            const response = await api.get('/feedback/trending');
            store.setState({ trendingSuggestions: response.feedback || [] });
            // Also compute stats
            const feedback = response.feedback || [];
            const stats = {
                submitted: feedback.length,
                accepted: feedback.filter(f => f.status === 'planned' || f.status === 'reviewing').length,
                implemented: feedback.filter(f => f.status === 'completed').length
            };
            store.setState({ feedbackStats: stats });
        } catch (error) {
            console.error('Failed to load trending feedback:', error);
            toast.error('Failed to load trending feedback');
        }
    },

    loadFeedbackAnalytics: async function() {
        try {
            const response = await api.get('/feedback/analytics');
            store.setState({ feedbackAnalytics: response.analytics || {} });
        } catch (error) {
            console.error('Failed to load feedback analytics:', error);
            toast.error('Failed to load feedback analytics');
        }
    },

    searchSimilarFeedback: (function() {
        let timeout = null;
        return function(queryText) {
            clearTimeout(timeout);
            if (!queryText || queryText.trim().length < 3) {
                store.setState({ similarFeedback: [] });
                const container = document.getElementById('similar-feedback-container');
                if (container) container.style.display = 'none';
                return;
            }
            timeout = setTimeout(async () => {
                try {
                    const response = await api.get('/feedback/similar?q=' + encodeURIComponent(queryText.trim()));
                    const items = response.feedback || [];
                    store.setState({ similarFeedback: items });
                    const container = document.getElementById('similar-feedback-container');
                    if (container) {
                        container.style.display = items.length > 0 ? 'block' : 'none';
                        const list = document.getElementById('similar-feedback-list');
                        if (list && items.length > 0) {
                            list.innerHTML = items.map(item => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; cursor: pointer;" onclick="handlers.showFeedbackDetail('${item.id}')">
                                    <span style="font-size: 13px; color: var(--gray-700);">${escapeHtml(item.title)}</span>
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <span class="badge badge-sm badge-outline">${item.status}</span>
                                        <span style="font-size: 12px; color: var(--gray-500);">${(item.votes_up || 0) - (item.votes_down || 0)} votes</span>
                                    </div>
                                </div>
                            `).join('');
                        }
                    }
                } catch (error) {
                    console.error('Error searching similar feedback:', error);
                }
            }, 500);
        };
    })(),

    _filterMenuClickHandler: null,

    _isApplyingFilters: false,

    _sortTimeout: null,

    _sortVersion: 0,

    loadInventory: async function() {
        try {
            const data = await api.get('/inventory?limit=200');
            store.setState({ inventory: data.items || [] });
            // Don't call router.handleRoute() - router handles rendering
        } catch (error) {
            console.error('Failed to load inventory:', error);
            toast.error('Failed to load inventory');
            store.setState({ inventory: [] });
        }
    },

    loadAutomations: async function() {
        try {
            const data = await api.get('/automations');
            store.setState({ automations: data.rules });
            // Also load run history for failure banner
            try {
                const histData = await api.get('/automations/history?limit=50');
                store.setState({ automationHistoryRuns: histData.runs || [] });
            } catch (histErr) {
                // Non-critical - failure banner just won't show
            }
            // Don't call router.handleRoute() - it creates an infinite loop
            // The router already handles rendering after calling this function
        } catch (error) {
            console.error('Failed to load automations:', error);
            store.setState({ automations: [] });
            toast.error('Failed to load automations');
        }
    },

    // Listings,

    loadListings: async function() {
        try {
            const data = await api.get('/listings');
            store.setState({ listings: data.listings || [] });
        } catch (error) {
            console.error('Failed to load listings:', error);
            // Show empty state instead of hanging
            store.setState({ listings: [] });
            toast.error('Failed to load listings. Please check server and refresh.');
        }
    },

    // Switch listings tab and load appropriate data,

    loadListingFolders: async function() {
        try {
            const data = await api.get('/listings/folders');
            store.setState({ listingFolders: data.folders || [] });
        } catch (error) {
            console.error('Failed to load listing folders:', error);
            store.setState({ listingFolders: [] });
            toast.error('Failed to load listing folders');
        }
    },

    loadOrders: async function() {
        try {
            const data = await api.get('/orders');
            store.setState({ orders: data.orders || [], orderStats: data.stats || {} });
        } catch (error) {
            console.error('Failed to load orders:', error);
            store.setState({ orders: [] });
            // Show more helpful error message
            const errorMsg = error.message || 'Unknown error';
            if (errorMsg.includes('401') || errorMsg.includes('Authentication') || errorMsg.includes('token')) {
                toast.error('Please log in to view orders');
            } else {
                toast.error('Failed to load orders: ' + errorMsg);
            }
        }
    },

    setDashboardPeriod: async function(period) {
        store.setState({ dashboardPeriod: period });
        try {
            toast.show('Updating metrics...', 'info');
            const res = await fetch(`/api/analytics/dashboard?period=${period}`, {
                headers: { 'Authorization': `Bearer ${store.state.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                store.setState({ dashboardStats: data.stats, dashboardLastRefresh: Date.now() });
                router.navigate('dashboard');
                toast.success('Metrics updated');
            } else {
                toast.show('Failed to load metrics', 'error');
            }
        } catch (err) {
            console.error('Period change failed:', err);
            toast.show('Failed to update metrics', 'error');
        }
    },

    // Count-up animation for stat card values,

    animateCountUp: function() {
        const elements = document.querySelectorAll('[data-countup]');
        elements.forEach(el => {
            const raw = el.getAttribute('data-countup');
            const isCurrency = raw.startsWith('$');
            const target = parseFloat(raw.replace(/[$,]/g, ''));
            if (isNaN(target) || target === 0) return;
            const duration = 800;
            const startTime = performance.now();
            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease-out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(target * eased);
                el.textContent = isCurrency ? '$' + current.toLocaleString() : current.toLocaleString();
                if (progress < 1) requestAnimationFrame(animate);
            };
            el.textContent = isCurrency ? '$0' : '0';
            requestAnimationFrame(animate);
        });
    },

    // Mobile dashboard quick actions speed dial,

    showDashboardQuickActions: function() {
        const existing = document.getElementById('dashboard-fab-menu');
        if (existing) { existing.remove(); return; }
        const menu = document.createElement('div');
        menu.id = 'dashboard-fab-menu';
        menu.className = 'dashboard-fab-menu';
        menu.innerHTML = `
            <button class="fab-action-item" onclick="router.navigate('inventory'); setTimeout(() => modals.addItem(), 100); document.getElementById('dashboard-fab-menu')?.remove();">
                ${components.icon('plus', 16)} Add Item
            </button>
            <button class="fab-action-item" onclick="router.navigate('sales'); document.getElementById('dashboard-fab-menu')?.remove();">
                ${components.icon('sales', 16)} Log Sale
            </button>
            <button class="fab-action-item" onclick="router.navigate('listings'); document.getElementById('dashboard-fab-menu')?.remove();">
                ${components.icon('list', 16)} New Listing
            </button>
            <button class="fab-action-item" onclick="handlers.refreshDashboard(); document.getElementById('dashboard-fab-menu')?.remove();">
                ${components.icon('refresh-cw', 16)} Refresh
            </button>
        `;
        document.body.appendChild(menu);
        // Close on outside click
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && !e.target.closest('.fab')) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 10);
    },

    // Daily Business Summary,

    loadChecklistItems: async function() {
        try {
            // Load all checklist items (no checklist grouping for now)
            const data = await api.get('/checklists/items');
            store.setState({ checklistItems: data.items || [] });
        } catch (error) {
            console.error('Failed to load checklist:', error);
            store.setState({ checklistItems: [] });
            toast.error('Failed to load checklist items');
        }
    },

    async loadHeatmapData() {
        try {
            const days = store.state.heatmapDays || 30;
            const platform = store.state.heatmapPlatform || '';
            const params = new URLSearchParams({ days });
            if (platform) params.set('platform', platform);
            const data = await api.get(`/analytics/heatmap?${params}`);
            store.setState({ heatmapData: data });
            renderApp(pages.heatmaps());
        } catch (err) {
            console.error('Failed to load heatmap data:', err);
            toast.error('Failed to load heatmap data');
            store.setState({ heatmapData: null });
            renderApp(pages.heatmaps());
        }
    },

    async loadPredictions() {
        try {
            const [predictions, forecasts] = await Promise.all([
                api.get('/predictions'),
                api.get('/predictions/demand')
            ]);
            store.setState({
                predictions: predictions.predictions || predictions || [],
                demandForecasts: forecasts.forecasts || forecasts || []
            });
        } catch (err) {
            console.error('Failed to load predictions:', err);
            toast.error('Failed to load predictions');
        }
    },

    async loadSuppliers() {
        try {
            const data = await api.get('/suppliers');
            store.setState({ suppliers: data.suppliers || data || [] });
        } catch (err) {
            console.error('Failed to load suppliers:', err);
            toast.error('Failed to load suppliers');
        }
    },

    async loadMarketIntel() {
        store.setState({ marketIntelLoading: true });
        if (store.state.currentPage === 'market-intel') renderApp(pages.marketIntel());
        try {
            const [competitors, insights] = await Promise.all([
                api.get('/market-intel/competitors'),
                api.get('/market-intel/insights')
            ]);
            store.setState({
                competitors: competitors.competitors || competitors || [],
                marketInsights: insights.insights || insights || [],
                marketIntelLastUpdated: new Date().toISOString(),
                marketIntelLoading: false
            });
        } catch (err) {
            console.error('Failed to load market intel:', err);
            toast.error('Failed to load market intel data');
            store.setState({ marketIntelLoading: false });
        }
    },

    async loadWebhooks() {
        try {
            const [endpoints, events, eventTypes] = await Promise.all([
                api.get('/webhooks/endpoints'),
                api.get('/webhooks/events?limit=50'),
                api.get('/webhooks/event-types')
            ]);
            store.setState({
                webhookEndpoints: endpoints || [],
                webhookEvents: events || [],
                webhookEventTypes: eventTypes || []
            });
        } catch (err) {
            console.error('Failed to load webhooks:', err);
            toast.error('Failed to load webhooks');
        }
    },

    async createWebhookEndpoint(data) {
        try {
            const result = await api.post('/webhooks/endpoints', data);
            toast.success('Webhook endpoint created');
            await handlers.loadWebhooks();
            return result;
        } catch (err) {
            toast.error('Failed to create endpoint');
            console.error(err);
        }
    },

    async loadPushStatus() {
        try {
            const [status, settings] = await Promise.all([
                api.get('/push-subscriptions/status'),
                api.get('/push-subscriptions/settings')
            ]);
            store.setState({
                pushSubscriptions: status.subscriptions || [],
                pushSubscribed: status.subscribed || false,
                pushSettings: settings || store.state.pushSettings
            });
        } catch (err) {
            console.error('Failed to load push status:', err);
            toast.error('Failed to load push status');
        }
    },

    loadTodoListsFromStorage: function() {
        try {
            const saved = localStorage.getItem('vaultlister_todo_lists');
            if (saved) {
                store.setState({ todoLists: JSON.parse(saved) });
            } else {
                store.setState({ todoLists: [{ id: 'default', name: 'My To-Do List', items: [] }] });
            }
        } catch (e) {
            console.error('Failed to load to-do lists:', e);
            store.setState({ todoLists: [{ id: 'default', name: 'My To-Do List', items: [] }] });
        }
    },

    // Load automation schedule from localStorage,

    loadAutomationScheduleFromStorage: function() {
        try {
            const saved = localStorage.getItem('vaultlister_automation_schedule');
            if (saved) {
                store.setState({ automationSchedule: JSON.parse(saved) });
            } else {
                store.setState({
                    automationSchedule: {
                        frequency: 'daily',
                        startTime: '09:00',
                        endTime: '21:00',
                        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                });
            }
        } catch (e) {
            console.error('Failed to load automation schedule:', e);
            store.setState({
                automationSchedule: {
                    frequency: 'daily',
                    startTime: '09:00',
                    endTime: '21:00',
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
            });
        }
    },

    loadAutomationCategoryFilterFromStorage: function() {
        try {
            const saved = localStorage.getItem('vaultlister_automation_category_filter');
            if (saved) store.setState({ automationCategoryFilter: saved });
        } catch (e) {}
    },

    // ============================================
    // Shipping Profile Handlers
    // ============================================,

    loadShippingProfiles: async function() {
        try {
            const data = await api.get('/shipping-profiles');
            store.setState({ shippingProfiles: data.profiles || [] });
        } catch (error) {
            console.error('Failed to load shipping profiles:', error);
            toast.error('Failed to load shipping profiles');
            store.setState({ shippingProfiles: [] });
        }
    },

    loadSales: async function() {
        try {
            const data = await api.get('/sales');
            store.setState({ sales: data.sales || [] });
        } catch (error) {
            console.error('Failed to load sales:', error);
            // Show empty state instead of hanging
            store.setState({ sales: [] });
            toast.error('Failed to load sales. Please check server and refresh.');
        }
    },

    loadAnalytics: async function() {
        try {
            const period = store.state.analyticsPeriod || '30d';
            const [dashboardData, salesData, metricsData, digestData] = await Promise.all([
                api.get(`/analytics/dashboard?period=${period}`).catch(() => ({ stats: {} })),
                api.get(`/analytics/sales?period=${period}&groupBy=day`).catch(() => ({ salesData: [], byPlatform: [], topItems: [] })),
                api.get('/analytics/custom-metrics').catch(() => ({ metrics: [] })),
                api.get('/analytics/digest-settings').catch(() => ({ settings: {} }))
            ]);

            store.setState({
                analyticsData: dashboardData,
                salesAnalytics: salesData,
                customMetrics: metricsData.metrics || [],
                digestSettings: digestData.settings || {}
            });
        } catch (error) {
            console.error('Failed to load analytics:', error);
            toast.error('Failed to load analytics data');
            store.setState({
                analyticsData: { stats: {} },
                salesAnalytics: { salesData: [], byPlatform: [] }
            });
        }
    },

    // ========== Financials Handlers ==========,

    loadPurchases: async function() {
        try {
            const data = await api.get('/financials/purchases');
            store.setState({ purchases: data.purchases || [] });
        } catch (error) {
            console.error('Failed to load purchases:', error);
            toast.error('Failed to load purchases');
            store.setState({ purchases: [] });
        }
    },

    loadAccounts: async function() {
        try {
            const data = await api.get('/financials/accounts');
            store.setState({
                accounts: data.accounts || [],
                accountsGrouped: data.grouped || {}
            });
        } catch (error) {
            console.error('Failed to load accounts:', error);
            toast.error('Failed to load accounts');
            store.setState({ accounts: [], accountsGrouped: {} });
        }
    },

    loadCategorizationRules: async function() {
        try {
            const data = await api.get('/financials/categorization-rules');
            store.setState({ categorizationRules: data.rules || [] });
        } catch (error) {
            console.error('Failed to load categorization rules:', error);
            toast.error('Failed to load categorization rules');
            store.setState({ categorizationRules: [] });
        }
    },

    loadShops: async function() {
        try {
            const data = await api.get('/shops');
            store.setState({ shops: data.shops || [] });
        } catch (error) {
            console.error('Failed to load shops:', error);
            // Set empty state and show error to user
            store.setState({ shops: [] });
            toast.error('Failed to load shops. Please refresh the page.');
        }
    },

    loadRoadmapFeatures: async function() {
        try {
            const response = await api.get('/roadmap');
            store.setState({ roadmapFeatures: response.features || [] });
        } catch (error) {
            console.error('Error loading roadmap features:', error);
            store.setState({ roadmapFeatures: [] });
            toast.error('Failed to load roadmap features');
        }
    },

    // Vote for a roadmap feature,

    loadUserFeedback: async function() {
        try {
            const response = await api.get('/feedback/user');
            store.setState({ userFeedback: response.feedback || [] });
        } catch (error) {
            console.error('Failed to load user feedback:', error);
            toast.error('Failed to load feedback');
            store.setState({ userFeedback: [] });
        }
    },

    // ========================================
    // Template Management
    // ========================================,

    loadTemplates: async function() {
        try {
            const templates = await api.get('/templates');
            store.setState({ templates });
        } catch (error) {
            console.error('Failed to load templates:', error);
            toast.error('Failed to load templates');
        }
    },

    _aiGeneratedData: null,

    _aiImageData: null,

    loadImageBank: async function() {
        try {
            const [imagesRes, foldersRes, jobsRes, presetsRes] = await Promise.all([
                api.get('/image-bank?limit=1000'),
                api.get('/image-bank/folders'),
                api.get('/batch-photo/jobs').catch(() => ({ jobs: [] })),
                api.get('/batch-photo/presets').catch(() => [])
            ]);

            store.setState({
                imageBankImages: imagesRes.images || [],
                imageBankFolders: foldersRes.folders || [],
                batchPhotoJobs: jobsRes.jobs || [],
                batchPhotoPresets: presetsRes || []
            });
        } catch (error) {
            toast.error('Failed to load Image Bank: ' + error.message);
        }
    },

    // Open file upload dialog,

    loadSkuRules: async function() {
        try {
            const result = await api.get('/sku-rules');
            const rules = result.rules || [];
            const defaultRule = rules.find(r => r.is_default);
            store.setState({
                skuRules: rules,
                defaultSkuRule: defaultRule || null
            });
        } catch (error) {
            console.error('Failed to load SKU rules:', error);
            toast.error('Failed to load SKU rules');
        }
    },

    // Show add SKU rule modal,

    loadReceiptQueue: async function() {
        try {
            const result = await api.get('/receipts/queue');
            store.setState({ receiptQueue: result.receipts || [] });
        } catch (error) {
            console.error('Failed to load receipt queue:', error);
            toast.error('Failed to load receipts');
        }
    },

    // Load saved vendors,

    loadReceiptVendors: async function() {
        try {
            const result = await api.get('/receipts/vendors');
            store.setState({ receiptVendors: result.vendors || [] });
        } catch (error) {
            console.error('Failed to load vendors:', error);
            toast.error('Failed to load vendors');
        }
    },

    // Upload and parse receipt,

    loadCommunity: async function() {
        try {
            const tab = store.state.communityTab || 'discussion';

            if (tab === 'leaderboard') {
                // Load leaderboard
                const result = await api.get('/community/leaderboard', { period: 'all', limit: 20 });
                store.setState({ leaderboard: result.leaderboard || [] });
            } else {
                // Load posts
                const type = tab === 'tips' ? 'tip' : tab === 'success' ? 'success' : 'discussion';
                const result = await api.get('/community/posts', { type, sort: 'recent', limit: 50 });
                store.setState({ communityPosts: result.posts || [] });
            }
        } catch (error) {
            console.error('Failed to load community:', error);
            toast.error('Failed to load community posts');
        }
    },

    // Set active community tab,

    loadFAQs: async function(category = null, search = null) {
        try {
            const params = {};
            if (category) params.category = category;
            if (search) params.search = search;

            const result = await api.get('/help/faq', params);
            store.setState({ helpFAQs: result.faqs || [] });
        } catch (error) {
            console.error('Failed to load FAQs:', error);
            toast.error('Failed to load FAQs');
        }
    },

    // Vote on FAQ helpfulness,

    loadArticles: async function(category = null, search = null) {
        try {
            const params = { limit: 20 };
            if (category) params.category = category;
            if (search) params.search = search;

            const result = await api.get('/help/articles', params);
            store.setState({ helpArticles: result.articles || [] });
        } catch (error) {
            console.error('Failed to load articles:', error);
            toast.error('Failed to load articles');
        }
    },

    // Load single article by slug,

    loadTickets: async function(status = null) {
        try {
            const params = status ? { status } : {};
            const result = await api.get('/help/tickets', params);
            store.setState({ supportTickets: result.tickets || [] });
        } catch (error) {
            console.error('Failed to load tickets:', error);
            toast.error('Failed to load support tickets');
        }
    },

    // Load single ticket with replies,

    loadEmailAccounts: async function() {
        try {
            const result = await api.get('/email/accounts');
            store.setState({ emailAccounts: result.accounts || [] });
        } catch (error) {
            console.error('Failed to load email accounts:', error);
            // Don't show error toast as this is optional functionality
        }
    },

    // Connect Gmail account via OAuth,

    _txSearchTimer: null,

    _barcodeStream: null,

    _barcodeData: null,

    loadTeamsPage: async function() {
        try {
            const response = await api.get('/teams');
            store.setState({ teams: response.teams || [] });
        } catch (error) {
            console.error('Failed to load teams:', error);
            store.setState({ teams: [] });
            toast.error('Failed to load teams');
        }
    },

    loadRelistingData: async function() {
        try {
            const [rulesData, staleData, queueData, perfData] = await Promise.all([
                api.get('/relisting/rules'),
                api.get('/relisting/stale?days=30'),
                api.get('/relisting/queue?status=all'),
                api.get('/relisting/performance')
            ]);
            store.setState({
                relistingRules: rulesData.rules || [],
                staleListings: staleData.listings || [],
                relistQueue: queueData.queue || [],
                relistingPerformance: perfData.stats || {}
            });
        } catch (e) {
            // Silently handle - data will load on next navigation
        }
    },

    loadShippingLabelsData: async function() {
        try {
            const [labelsData, addrData, batchData] = await Promise.all([
                api.get('/shipping-labels-mgmt/'),
                api.get('/shipping-labels-mgmt/addresses'),
                api.get('/shipping-labels-mgmt/batches')
            ]);
            store.setState({
                shippingLabelsList: labelsData.labels || [],
                returnAddresses: addrData.addresses || [],
                labelBatches: batchData.batches || []
            });
        } catch (e) {
            // Silently handle - data will load on next navigation
        }
    },

    loadImportData: async function() {
        try {
            const [jobsData, mappingsData] = await Promise.all([
                api.get('/inventory-import/jobs'),
                api.get('/inventory-import/mappings')
            ]);
            store.setState({
                importJobs: jobsData.jobs || [],
                importMappings: mappingsData.mappings || [],
                currentImportJob: null
            });
        } catch (e) {
            // Silently handle - data will load on next navigation
        }
    },

    loadWhatnotData: async function() {
        try {
            const [eventsData, statsData] = await Promise.all([
                api.get('/whatnot/events'),
                api.get('/whatnot/stats')
            ]);
            store.setState({
                whatnotEvents: eventsData.events || [],
                whatnotStats: statsData.stats || { total_events: 0, upcoming: 0, completed: 0, total_items_sold: 0 }
            });
        } catch (e) {
            store.setState({ whatnotEvents: [], whatnotStats: { total_events: 0, upcoming: 0, completed: 0, total_items_sold: 0 } });
        }
    },

    loadReportsData: async function() {
        try {
            const [reportsData, widgetsData] = await Promise.all([
                api.get('/reports'),
                api.get('/reports/widgets')
            ]);
            store.setState({
                customReports: reportsData.reports || [],
                reportWidgets: widgetsData.widgets || []
            });
        } catch (e) {
            console.error('Failed to load reports data:', e);
            store.setState({ customReports: [], reportWidgets: [] });
            toast.error('Failed to load reports data');
        }
    },

    loadImageStorageStats: async function() {
        try {
            const response = await api.get('/image-bank/storage-stats');
            store.setState({ imageStorageStats: response });
        } catch (error) {
            console.error('Error loading storage stats:', error);
            toast.error('Failed to load storage stats');
        }
    },

    // Scan inventory for image usage references,

    createWebhookEndpoint: async function(data) {
        try {
            await api.post('/webhooks/endpoints', data);
            toast.success('Webhook endpoint created!');
            modals.close();
            await this.loadWebhooks();
            renderApp();
        } catch (error) {
            toast.error('Failed to create webhook: ' + error.message);
        }
    },

    // Test webhook endpoint,

    _addChecklistAttachments: [],

    _editChecklistAttachments: [],

    _imageBankSelection: null,

    // Prediction Model Configuration,

    async loadDeletedItems(skipRender = false) {
        try {
            const params = new URLSearchParams();
            if (store.state.deletedItemTypeFilter) params.append('type', store.state.deletedItemTypeFilter);
            if (store.state.deletedReasonFilter) params.append('reason', store.state.deletedReasonFilter);
            if (store.state.deletedSearchTerm) params.append('search', store.state.deletedSearchTerm);

            const data = await api.get(`/recently-deleted?${params.toString()}`);
            store.setState({ deletedItems: data.items || [] });
            if (!skipRender) renderApp(pages.recentlyDeleted());
        } catch (err) {
            store.setState({ deletedItems: [] });
            if (!skipRender) renderApp(pages.recentlyDeleted());
            toast.error('Failed to load deleted items');
            console.error(err);
        }
    },

    async loadReports() {
        try {
            const data = await api.get('/reports');
            store.setState({ savedReports: data.reports || [] });
        } catch (err) {
            toast.error('Failed to load reports');
            console.error(err);
        }
    },

    _isSearching: false,

    _filterMenuClickHandler: null,

    _isApplyingFilters: false,

    _addChecklistAttachments: [],

    _editChecklistAttachments: [],

    _imageBankSelection: [],

    _barcodeStream: null,

    _barcodeData: null,

    // Calendar

    // --- Cross-cutting handlers (moved from deferred, used by core pages) ---

    async requestPasswordReset(event) {
        event.preventDefault();
        const form = document.getElementById('forgot-password-form');
        const email = form ? form.querySelector('input[name="email"]')?.value : '';
        if (!email) {
            toast.error('Please enter your email address');
            return;
        }
        try {
            await api.post('/auth/password-reset', { email });
        } catch (e) {
            // Always show success to prevent email enumeration
        }
        if (form) form.style.display = 'none';
        const successDiv = document.getElementById('forgot-password-success');
        if (successDiv) successDiv.style.display = 'block';
    },

    async resendVerification() {
        try {
            const email = store.state.pendingVerificationEmail || store.state.user?.email;
            if (email) {
                await api.post('/auth/resend-verification', { email });
                toast.success('Verification email resent!');
            } else {
                toast.error('No email address found. Please try logging in again.');
            }
        } catch (e) {
            // Still show success to prevent email enumeration
            toast.success('Verification email resent!');
        }
    },

    // --- Cross-cutting handlers (used by 2+ route groups) ---

    exportInventoryCSV() {
        // Stub — actual implementation loaded in inventory-catalog chunk
        toast.info('Loading export feature...');
    },

    exportSalesCSV() {
        toast.info('Loading export feature...');
    },

    searchHelp(query) {
        // Global search help — available from any page
        const helpItems = store.state.helpArticles || [];
        if (!query || query.length < 2) {
            store.setState({ helpSearchResults: helpItems });
            return;
        }
        const q = query.toLowerCase();
        const results = helpItems.filter(a =>
            (a.title || '').toLowerCase().includes(q) ||
            (a.content || '').toLowerCase().includes(q)
        );
        store.setState({ helpSearchResults: results });
    },

    downloadLegalPDF(docType) {
        toast.info(`Preparing ${docType} PDF...`);
        window.print();
    },

    printLegalDocument(docType) {
        window.print();
    },

    toggleLegalSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.toggle('collapsed');
        }
    },

    scrollToSection(sectionId) {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
};
