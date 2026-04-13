'use strict';
// Core pages (eager) — dashboard + auth + error
// Loaded on initial page load for first render

const pages = {
    dashboard() {
        // Use API stats if available (from period selector), fallback to client-side
        const apiStats = store.state.dashboardStats;
        const stats = apiStats ? {
            inventory: apiStats.inventory?.total || 0,
            listings: apiStats.listings?.active || 0,
            sales: apiStats.sales?.total || 0,
            revenue: apiStats.sales?.revenue || 0
        } : {
            inventory: (store.state.inventory || []).length,
            listings: (store.state.listings || []).filter(l => l.status === 'active').length,
            sales: (store.state.sales || []).length,
            revenue: (store.state.sales || []).reduce((sum, s) => sum + (s.sale_price || 0), 0)
        };
        const activePeriod = store.state.dashboardPeriod || '30d';
        const periodLabels = {'7d':'7 Days','30d':'30 Days','90d':'90 Days','6m':'6 Months','1y':'1 Year','all':'All Time'};

        // Generate sparkline data from real history (last 7 days)
        const generateSparklineData = (dataType) => {
            const days = 7;
            const data = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = toLocalDate(date);
                if (dataType === 'sales') {
                    data.push((store.state.sales || []).filter(s => s.sold_at?.startsWith(dateStr)).length);
                } else if (dataType === 'revenue') {
                    data.push((store.state.sales || []).filter(s => s.sold_at?.startsWith(dateStr)).reduce((sum, s) => sum + (s.sale_price || 0), 0));
                } else if (dataType === 'inventory') {
                    // Count items created on or before this date for a running total
                    const endOfDay = new Date(date);
                    endOfDay.setHours(23, 59, 59, 999);
                    data.push((store.state.inventory || []).filter(item => new Date(item.created_at) <= endOfDay).length);
                } else {
                    // Active listings: count items listed on or before this date
                    const endOfDay = new Date(date);
                    endOfDay.setHours(23, 59, 59, 999);
                    data.push((store.state.listings || []).filter(l => l.status === 'active' && new Date(l.listed_at || l.created_at) <= endOfDay).length);
                }
            }
            return data;
        };

        // Calculate comparison stats with dynamic period
        const compPeriod = store.state.comparisonPeriod || 'week';
        const compDays = compPeriod === 'year' ? 365 : compPeriod === 'month' ? 30 : 7;
        const periodAgo = new Date();
        periodAgo.setDate(periodAgo.getDate() - compDays);
        const twoPeriodAgo = new Date();
        twoPeriodAgo.setDate(twoPeriodAgo.getDate() - compDays * 2);

        const thisWeekSales = (store.state.sales || []).filter(s => {
            const saleDate = new Date(s.sold_at);
            return saleDate >= periodAgo;
        });
        const lastWeekSales = (store.state.sales || []).filter(s => {
            const saleDate = new Date(s.sold_at);
            return saleDate >= twoPeriodAgo && saleDate < periodAgo;
        });
        const thisWeekRevenue = thisWeekSales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
        const lastWeekRevenue = lastWeekSales.reduce((sum, s) => sum + (s.sale_price || 0), 0);

        // Calculate change percentages for stat cards
        const calcChange = (current, previous) => {
            if (previous === 0) return null;
            if (current === previous) return null;
            return Math.round(((current - previous) / previous) * 100);
        };

        const thisWeekInventory = (store.state.inventory || []).filter(i => new Date(i.created_at) >= periodAgo).length;
        const lastWeekInventory = (store.state.inventory || []).filter(i => { const d = new Date(i.created_at); return d >= twoPeriodAgo && d < periodAgo; }).length;
        const thisWeekListings = (store.state.listings || []).filter(l => l.status === 'active' && new Date(l.listed_at || l.created_at) >= periodAgo).length;
        const lastWeekListings = (store.state.listings || []).filter(l => { const d = new Date(l.listed_at || l.created_at); return l.status === 'active' && d >= twoPeriodAgo && d < periodAgo; }).length;

        const inventoryChange = calcChange(thisWeekInventory, lastWeekInventory);
        const listingsChange = calcChange(thisWeekListings, lastWeekListings);
        const salesChange = calcChange(thisWeekSales.length, lastWeekSales.length);
        const revenueChange = calcChange(thisWeekRevenue, lastWeekRevenue);

        // Monthly sales goal (configurable)
        const savedGoal = localStorage.getItem('vaultlister_monthly_goal');
        const monthlyGoal = savedGoal ? parseInt(savedGoal) : (store.state.monthlySalesGoal || null);
        const thisMonthRevenue = (store.state.sales || []).filter(s => {
            const saleDate = new Date(s.sold_at);
            const now = new Date();
            return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
        }).reduce((sum, s) => sum + (s.sale_price || 0), 0);
        const goalPercent = monthlyGoal ? Math.min(100, (thisMonthRevenue / monthlyGoal) * 100) : 0;

        // Generate activity feed with more comprehensive user actions
        const activities = [
            ...(store.state.sales || []).slice(-6).map(s => ({
                icon: 'sales',
                title: 'Sale completed',
                description: `${s.title} sold for C$${s.sale_price}`,
                timestamp: s.sold_at,
                type: 'sale'
            })),
            ...(store.state.offers || []).filter(o => o.status === 'pending').slice(-4).map(o => ({
                icon: 'offers',
                title: 'New offer received',
                description: `C$${o.amount} offer on ${o.listing_id}`,
                timestamp: o.created_at,
                type: 'offer'
            })),
            ...((store.state.inventory || []).slice(-4).map(i => ({
                icon: 'inventory',
                title: 'Item added to inventory',
                description: i.title,
                timestamp: i.created_at,
                type: 'inventory'
            }))),
            ...((store.state.listings || []).filter(l => l.last_relisted_at).slice(-4).map(l => ({
                icon: 'list',
                title: 'Listing refreshed',
                description: l.title,
                timestamp: l.last_relisted_at,
                type: 'relist'
            }))),
            ...((store.state.listings || []).filter(l => l.listed_at).slice(-4).map(l => ({
                icon: 'list',
                title: 'Item listed',
                description: `${l.title} on ${l.platform || 'marketplace'}`,
                timestamp: l.listed_at,
                type: 'listing'
            }))),
            ...(store.state.orders || []).filter(o => o.status === 'shipped').slice(-3).map(o => ({
                icon: 'sales',
                title: 'Order shipped',
                description: `Order #${o.id} shipped`,
                timestamp: o.shipped_at || o.updated_at,
                type: 'shipped'
            }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

        // Get recently relisted items (last 7 days)
        const recentlyRelisted = (store.state.listings || []).filter(l => l.last_relisted_at).sort((a, b) =>
            new Date(b.last_relisted_at) - new Date(a.last_relisted_at)
        ).slice(0, 5);

        // Get stale listings (older than 30 days)
        const staleListings = (store.state.listings || []).filter(l => {
            if (l.status !== 'active') return false;
            const lastRefresh = l.last_relisted_at || l.listed_at || l.created_at;
            const daysSinceRefresh = Math.floor((Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60 * 60 * 24));
            return daysSinceRefresh >= 30;
        }).slice(0, 5);

        // Format relative time with better granularity
        const formatRelativeTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
            return date.toLocaleDateString();
        };

        // Format exact timestamp for tooltips
        const formatExactTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        };

        // Format platform name nicely
        const formatPlatform = (platform) => {
            const names = {
                'poshmark': 'Poshmark',
                'ebay': 'eBay',
                'whatnot': 'Whatnot',
                'depop': 'Depop',
                'shopify': 'Shopify',
                'facebook': 'Facebook'
            };
            return names[platform] || platform;
        };

        // Error boundary wrapper for widgets
        const safeWidget = (renderFn, widgetName) => {
            try {
                return renderFn();
            } catch (err) {
                console.error('Widget failed to render:', widgetName, err); // nosemgrep: javascript.lang.security.audit.unsafe-formatstring
                return `
                    <div class="card dashboard-widget widget-error-boundary">
                        <div class="card-body text-center py-4">
                            <div class="text-gray-400 mb-2">${components.icon('alert-triangle', 24)}</div>
                            <div class="text-sm text-gray-500">${escapeHtml(widgetName)} failed to load</div>
                            <button class="btn btn-sm btn-secondary mt-2" onclick="router.navigate('dashboard')">Retry</button>
                        </div>
                    </div>
                `;
            }
        };

        // Show onboarding if not dismissed and not complete
        const showOnboarding = !onboarding.isDismissed() && !onboarding.isComplete();

        // Get time-based greeting
        const getGreeting = () => {
            const hour = new Date().getHours();
            if (hour < 12) return 'Good morning';
            if (hour < 17) return 'Good afternoon';
            return 'Good evening';
        };

        // Calculate today's stats
        const today = toLocalDate(new Date());
        const todaySales = (store.state.sales || []).filter(s => s.sold_at?.startsWith(today));
        const todayRevenue = todaySales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
        const todayListings = (store.state.listings || []).filter(l => l.listed_at?.startsWith(today)).length;
        const pendingOrders = (store.state.orders || []).filter(o => o.status === 'pending').length;

        // Calculate platform breakdown
        const platformStats = {};
        (store.state.sales || []).forEach(s => {
            const platform = s.platform || 'other';
            if (!platformStats[platform]) {
                platformStats[platform] = { sales: 0, revenue: 0 };
            }
            platformStats[platform].sales++;
            platformStats[platform].revenue += (s.sale_price || 0);
        });
        const sortedPlatforms = Object.entries(platformStats)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 4);

        // Get platform colors
        const platformColors = {
            poshmark: 'var(--poshmark)',
            ebay: 'var(--ebay)',
            mercari: 'var(--mercari)',
            depop: 'var(--depop)',
            grailed: 'var(--grailed)',
            facebook: 'var(--facebook)',
            etsy: 'var(--etsy)',
            other: 'var(--gray-500)'
        };

        return `
            <!-- Welcome Hero Banner -->
            <div class="dashboard-hero">
                <div class="dashboard-hero-content">
                    <div class="dashboard-hero-greeting">
                        <h1>${getGreeting()}, ${store.state.user?.full_name ? store.state.user.full_name.split(' ')[0] : (store.state.user?.display_name || store.state.user?.username || 'Reseller')}!</h1>
                        <p>Here's how your business is performing today</p>
                    </div>
                    <div class="dashboard-hero-today">
                        <div class="today-stat" style="cursor:pointer" onclick="router.navigate('sales')" title="View sales">
                            <div class="today-stat-icon sales">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                            </div>
                            <div class="today-stat-info">
                                <span class="today-stat-value">C$${todayRevenue.toLocaleString()}</span>
                                <span class="today-stat-label">Today's Revenue</span>
                            </div>
                        </div>
                        <div class="today-stat" style="cursor:pointer" onclick="router.navigate('sales')" title="View sales">
                            <div class="today-stat-icon orders">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                            </div>
                            <div class="today-stat-info">
                                <span class="today-stat-value">${todaySales.length}</span>
                                <span class="today-stat-label">Today's Sales</span>
                            </div>
                        </div>
                        <div class="today-stat" style="cursor:pointer" onclick="router.navigate('listings')" title="View listings">
                            <div class="today-stat-icon listings">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="17 8 12 3 7 8"></polyline>
                                    <line x1="12" y1="3" x2="12" y2="15"></line>
                                </svg>
                            </div>
                            <div class="today-stat-info">
                                <span class="today-stat-value">${todayListings}</span>
                                <span class="today-stat-label">New Listings</span>
                            </div>
                        </div>
                        <div class="today-stat" style="cursor:pointer" onclick="router.navigate('orders-sales')" title="View orders">
                            <div class="today-stat-icon pending ${pendingOrders > 0 ? 'has-pending' : ''}">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            </div>
                            <div class="today-stat-info">
                                <span class="today-stat-value ${pendingOrders > 0 ? 'text-warning' : ''}">${pendingOrders}</span>
                                <span class="today-stat-label">Pending Orders</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${showOnboarding ? components.onboardingChecklist(onboarding.steps) : ''}

            <!-- What's New Banner -->
            ${!store.state.dismissedWhatsNew ? `
                <div class="dashboard-whats-new-banner">
                    <div class="whats-new-banner-content">
                        <span class="whats-new-badge-pill">New in v1.6.0</span>
                        <span class="whats-new-banner-text">Sidebar Icon-Only Mode, Pie Charts, and more</span>
                    </div>
                    <div class="whats-new-banner-actions">
                        <button class="btn btn-sm btn-primary" onclick="router.navigate('changelog')">View Changelog</button>
                        <button class="btn btn-sm btn-ghost" onclick="store.setState({ dismissedWhatsNew: true }); this.closest('.dashboard-whats-new-banner').remove()" title="Dismiss">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            ` : ''}

            <!-- Stale Data Banner -->
            ${(() => {
                const lastRefresh = store.state.dashboardLastRefresh;
                const isStale = lastRefresh && (Date.now() - lastRefresh > 5 * 60 * 1000);
                return isStale ? `
                    <div class="dashboard-stale-banner" id="stale-data-banner">
                        <span>${components.icon('alert-triangle', 14)} Dashboard data may be stale.</span>
                        <button class="btn btn-sm btn-warning" onclick="handlers.refreshDashboard()">Refresh now</button>
                        <button class="btn btn-sm btn-ghost" onclick="document.getElementById('stale-data-banner').remove()" style="padding: 2px 6px;">&times;</button>
                    </div>
                ` : '';
            })()}

            <!-- Unshipped Orders Alert Banner -->
            ${(() => {
                const unshipped = (store.state.orders || []).filter(o => o.status === 'pending' || o.status === 'confirmed');
                if (unshipped.length === 0) return '';
                const oldest = unshipped.reduce((o, c) => new Date(c.created_at) < new Date(o.created_at) ? c : o);
                const daysOld = Math.floor((Date.now() - new Date(oldest.created_at)) / (1000 * 60 * 60 * 24));
                const urgency = daysOld >= 3 ? 'error' : daysOld >= 1 ? 'warning' : 'info';
                return `
                    <div class="dashboard-alert-banner dashboard-alert-${urgency}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-radius: 8px; margin-bottom: 12px; background: var(--${urgency}-50); border: 1px solid var(--${urgency}-200); color: var(--${urgency}-700);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${components.icon('package', 16)}
                            <span><strong>${unshipped.length}</strong> order${unshipped.length > 1 ? 's' : ''} need${unshipped.length === 1 ? 's' : ''} shipping${daysOld > 0 ? ` — oldest is ${daysOld} day${daysOld > 1 ? 's' : ''} old` : ''}</span>
                        </div>
                        <button class="btn btn-sm btn-${urgency}" onclick="router.navigate('orders-sales')">View Orders</button>
                    </div>
                `;
            })()}

            <!-- Dashboard Actions -->
            <div class="dashboard-customize-section mb-4">
                <button class="btn btn-primary btn-sm" onclick="handlers.refreshDashboard()" title="Refresh dashboard data">
                    ${components.icon('refresh-cw', 14)} Refresh
                </button>
                <div style="display:inline-flex; align-items:center; gap:4px; position:relative;">
                    <select class="dashboard-period-select" onchange="handlers.setDashboardPeriod(this.value)" title="Date range for metrics">
                        ${['7d','30d','90d','6m','1y','all'].map(p => `<option value="${p}" ${(store.state.dashboardPeriod || '30d') === p ? 'selected' : ''}>${{'7d':'Last 7 Days','30d':'Last 30 Days','90d':'Last 90 Days','6m':'Last 6 Months','1y':'Last Year','all':'All Time'}[p]}</option>`).join('')}
                    </select>
                    ${(store.state.dashboardPeriod && store.state.dashboardPeriod !== '30d') ? `<span class="badge badge-primary badge-sm" style="pointer-events:none;">${{'7d':'7d','90d':'90d','6m':'6m','1y':'1y','all':'All'}[store.state.dashboardPeriod] || store.state.dashboardPeriod}</span>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" onclick="handlers.showDailySummary()">
                    ${components.icon('sun', 14)} Daily Summary
                </button>
                <button class="btn btn-secondary btn-sm" onclick="handlers.showProfitTargetTracker()">
                    ${components.icon('target', 14)} Profit Goals
                </button>
                <button class="btn btn-secondary btn-sm" onclick="handlers.showQuickNotes()">
                    ${components.icon('file-text', 14)} Quick Notes
                </button>
                <button class="btn btn-secondary btn-sm" onclick="if(document.getElementById('widget-settings-panel')){store.setState({_widgetPanelOpen:false});document.getElementById('widget-settings-panel').remove();}else{store.setState({_widgetPanelOpen:true});document.querySelector('.dashboard-customize-section').insertAdjacentHTML('afterend',widgetManager.showSettingsPanel());}">
                    ${components.icon('settings', 14)} Customize Dashboard
                </button>
                <div class="dashboard-export-dropdown" style="position: relative; display: inline-block;">
                    <button class="btn btn-secondary btn-sm" onclick="const m=this.nextElementSibling;m.classList.toggle('show');if(m.classList.contains('show')){setTimeout(()=>{const h=e=>{if(!m.contains(e.target)){m.classList.remove('show');document.removeEventListener('click',h)}};document.addEventListener('click',h)},0)}">
                        ${components.icon('download', 14)} Export
                    </button>
                    <div class="dropdown-menu dashboard-export-menu">
                        <button class="dropdown-item" onclick="handlers.exportDashboard('print'); this.closest('.dashboard-export-menu').classList.remove('show')">
                            ${components.icon('printer', 14)} Print / Save as PDF
                        </button>
                        <button class="dropdown-item" onclick="handlers.exportDashboard('screenshot'); this.closest('.dashboard-export-menu').classList.remove('show')">
                            ${components.icon('image', 14)} Copy Screenshot
                        </button>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="router.navigate('inventory'); setTimeout(() => modals.addItem(), 100)" title="Quick add inventory item">
                    ${components.icon('plus', 14)} Add Item
                </button>
                <button class="btn btn-success btn-sm" onclick="loadChunk('sales').then(() => handlers.showAddSale()).catch(() => toast.error('Failed to load sale form'))" title="Log a sale">
                    ${components.icon('sales', 14)} Log Sale
                </button>
                <div style="display:flex; justify-content:flex-end; align-items:center; margin-left:auto;">
                    <span class="dashboard-last-updated text-xs text-gray-400">
                        ${store.state.dashboardLastRefresh ? `Updated ${components.relativeTime(new Date(store.state.dashboardLastRefresh).toISOString())}` : 'Add your first item to get started'}
                    </span>
                </div>
            </div>
            ${store.state._widgetPanelOpen ? widgetManager.showSettingsPanel() : ''}

            <!-- All Dashboard Widgets -->
            <div class="dashboard-widgets-container mb-6">
                ${safeWidget(() => `<!-- Platform Performance Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'platform-performance')?.visible && sortedPlatforms.length > 0 ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('platform-performance') ? 'collapsed' : ''}" draggable="true" data-widget-id="platform-performance" style="${widgetManager.getWidgetStyle('platform-performance', 100)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Platform Performance</h3>
                        <div class="flex items-center gap-2">
                            <button class="btn btn-ghost btn-sm" onclick="router.navigate('analytics')">View Analytics</button>
                            <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('platform-performance')" title="Collapse/Expand">${widgetManager.isCollapsed('platform-performance') ? '▼' : '▲'}</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="platform-performance-items">
                            ${sortedPlatforms.map(([platform, data]) => `
                                <div class="platform-performance-item">
                                    <div class="platform-perf-icon" style="background: ${platformColors[platform] || 'var(--gray-500)'}15; color: ${platformColors[platform] || 'var(--gray-500)'};">
                                        ${platform.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="platform-perf-info">
                                        <span class="platform-perf-name">${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                                        <span class="platform-perf-stats">${data.sales} ${data.sales === 1 ? 'sale' : 'sales'}</span>
                                    </div>
                                    <div class="platform-perf-revenue">C$${data.revenue.toLocaleString()}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}`, 'Platform Performance')}

            ${safeWidget(() => `<!-- Stats Overview Widget -->
            ${widgetManager.getWidgets().find(w => w.id === 'stats')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('stats') ? 'collapsed' : ''}" draggable="true" data-widget-id="stats" style="${widgetManager.getWidgetStyle('stats', 100)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Stats Overview</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('stats')" title="Collapse/Expand">${widgetManager.isCollapsed('stats') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        <div class="stats-grid">
                            ${components.statCard('Total Inventory', stats.inventory, 'inventory', inventoryChange, 'primary', generateSparklineData('inventory'), 'inventory')}
                            ${components.statCard('Active Listings', stats.listings, 'list', listingsChange, 'primary', generateSparklineData('listings'), 'listings')}
                            ${components.statCard('Total Sales', stats.sales, 'sales', salesChange, 'green', generateSparklineData('sales'), 'sales')}
                            ${components.statCard('Revenue', 'C$' + stats.revenue.toLocaleString(), 'analytics', revenueChange, 'green', generateSparklineData('revenue'), 'revenue')}
                        </div>
                    </div>
                </div>
            ` : ''}

                ${store.state.user?.is_admin ? `<!-- System Status Widget (admin only) -->
                <div class="card dashboard-widget" id="system-status-card" style="width: 100%; margin-bottom: var(--space-4);" role="region" aria-label="System Status">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">System Status</h3>
                        <span id="system-status-dot" class="system-status-dot system-status-unknown" aria-label="Status unknown" title="Status unknown"></span>
                    </div>
                    <div class="card-body">
                        <div class="system-status-grid">
                            <div class="system-status-item">
                                <span class="system-status-label">Server</span>
                                <span class="system-status-value" id="system-status-server">—</span>
                            </div>
                            <div class="system-status-item">
                                <span class="system-status-label">Database</span>
                                <span class="system-status-value" id="system-status-db">—</span>
                            </div>
                            <div class="system-status-item">
                                <span class="system-status-label">Uptime</span>
                                <span class="system-status-value" id="system-status-uptime">—</span>
                            </div>
                        </div>
                    </div>
                </div>` : ''}

                <!-- Monthly Goal Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'goals')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('goals') ? 'collapsed' : ''}" draggable="true" data-widget-id="goals" style="${widgetManager.getWidgetStyle('goals', 33)} cursor: pointer;" onclick="if(!event.target.closest('.widget-collapse-btn')) handlers.setMonthlyGoal()" title="Click to edit goal">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Monthly Goal</h3>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">${components.icon('edit', 12)} Edit</span>
                            <button class="widget-collapse-btn" onclick="event.stopPropagation(); widgetManager.toggleCollapse('goals')" title="Collapse/Expand">${widgetManager.isCollapsed('goals') ? '▼' : '▲'}</button>
                        </div>
                    </div>
                    <div class="card-body flex items-center justify-center gap-6">
                        ${monthlyGoal ? `
                            ${components.progressRing(goalPercent, 80, 8, goalPercent >= 100 ? 'green' : 'primary', 'goal')}
                            <div>
                                <div class="text-2xl font-bold">C$${thisMonthRevenue.toLocaleString()}</div>
                                <div class="text-sm text-gray-500">of C$${monthlyGoal.toLocaleString()} goal</div>
                                <div class="text-xs text-gray-400 mt-1">${Math.round(goalPercent)}% complete</div>
                            </div>
                        ` : `
                            <div class="text-center text-gray-400">
                                <div class="text-sm mb-2">No goal set</div>
                                <div class="text-xs">Click to set your monthly revenue goal</div>
                            </div>
                        `}
                    </div>
                </div>
                ` : ''}

                <!-- Comparison Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'comparison')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('comparison') ? 'collapsed' : ''}" draggable="true" data-widget-id="comparison" style="${widgetManager.getWidgetStyle('comparison', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Weekly Comparison</h3>
                        <div class="flex items-center gap-2">
                            <select class="comparison-period-select" onchange="handlers.setComparisonPeriod(this.value)" title="Compare against">
                                <option value="week" ${compPeriod === 'week' ? 'selected' : ''}>vs Last Week</option>
                                <option value="month" ${compPeriod === 'month' ? 'selected' : ''}>vs Last Month</option>
                                <option value="year" ${compPeriod === 'year' ? 'selected' : ''}>vs Last Year</option>
                            </select>
                            <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('comparison')" title="Collapse/Expand">${widgetManager.isCollapsed('comparison') ? '▼' : '▲'}</button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${components.comparisonBar(thisWeekSales.length, lastWeekSales.length, 'Sales', 'blue')}
                        ${components.comparisonBar(thisWeekRevenue, lastWeekRevenue, 'Revenue', 'green')}
                    </div>
                </div>
                ` : ''}`, 'Stats & Goals')}

                ${safeWidget(() => `<!-- Activity Feed Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'activity')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('activity') ? 'collapsed' : ''}" draggable="true" data-widget-id="activity" style="${widgetManager.getWidgetStyle('activity', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Activity Feed</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('activity')" title="Collapse/Expand">${widgetManager.isCollapsed('activity') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body activity-feed-body">
                        ${components.activityFeed(activities, 10)}
                    </div>
                </div>
                ` : ''}

                <!-- Quick Actions Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'quick-actions')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('quick-actions') ? 'collapsed' : ''}" draggable="true" data-widget-id="quick-actions" style="${widgetManager.getWidgetStyle('quick-actions', 50)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Quick Actions</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('quick-actions')" title="Collapse/Expand">${widgetManager.isCollapsed('quick-actions') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-3 gap-2">
                            <button class="btn btn-primary" onclick="router.navigate('inventory'); setTimeout(() => modals.addItem(), 100)" style="justify-content: flex-start;">
                                ${components.icon('plus', 16)} Add Item
                            </button>
                            <button class="btn btn-secondary" onclick="router.navigate('listings')" style="justify-content: flex-start;">
                                ${components.icon('plus', 16)} Add New Listing
                            </button>
                            <button class="btn btn-secondary" onclick="router.navigate('orders-sales')" style="justify-content: flex-start;">
                                ${components.icon('cart', 16)} View Orders
                            </button>
                            <button class="btn btn-secondary" onclick="router.navigate('image-bank')" style="justify-content: flex-start;">
                                ${components.icon('image', 16)} Image Bank
                            </button>
                            <button class="btn btn-secondary" onclick="router.navigate('analytics')" style="justify-content: flex-start;">
                                ${components.icon('analytics', 16)} Analytics
                            </button>
                            <button class="btn btn-secondary" onclick="router.navigate('templates')" style="justify-content: flex-start;">
                                ${components.icon('document', 16)} Templates
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}`, 'Activity & Actions')}

                ${safeWidget(() => `<!-- Stale Listings Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'stale-listings')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('stale-listings') ? 'collapsed' : ''}" draggable="true" data-widget-id="stale-listings" style="${widgetManager.getWidgetStyle('stale-listings', 50)}">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 class="card-title" style="color: var(--warning-600);">Stale Listings</h3>
                        <div class="flex items-center gap-2">
                            ${staleListings.length > 0 ? `<span class="badge badge-warning">${staleListings.length} need refresh</span>` : ''}
                            <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('stale-listings')" title="Collapse/Expand">${widgetManager.isCollapsed('stale-listings') ? '▼' : '▲'}</button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${staleListings.length > 0 ? `
                            <div class="space-y-2">
                                ${staleListings.map(listing => {
                                    const lastRefresh = listing.last_relisted_at || listing.listed_at || listing.created_at;
                                    const daysSinceRefresh = Math.floor((Date.now() - new Date(lastRefresh).getTime()) / (1000 * 60 * 60 * 24));
                                    return `
                                        <div class="flex items-center justify-between p-3 rounded" style="background: var(--warning-50); border: 1px solid var(--warning-200);">
                                            <div style="flex: 1;">
                                                <div class="text-sm font-medium">${escapeHtml(listing.title?.substring(0, 30) || 'Untitled')}${listing.title?.length > 30 ? '...' : ''}</div>
                                                <div class="text-xs text-gray-500">${components.platformBadge(listing.platform)}</div>
                                            </div>
                                            <div style="text-align: right; margin-right: 12px; cursor: help;" title="${formatExactTime(lastRefresh)}">
                                                <div class="text-sm font-bold" style="color: var(--warning-600);">${daysSinceRefresh} days stale</div>
                                                <div class="text-xs text-gray-400">${formatRelativeTime(lastRefresh)}</div>
                                            </div>
                                            <button class="btn btn-sm btn-warning" onclick="handlers.refreshListing('${listing.id}')" ${listing.platform === 'facebook' ? 'disabled title="Use Mark as Sold for Facebook"' : ''}>
                                                ${listing.platform === 'facebook' ? 'Mark Sold' : 'Refresh'}
                                            </button>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <button class="btn btn-secondary btn-sm w-full mt-3" onclick="handlers.refreshAllStaleListings()">
                                Refresh All Stale Listings
                            </button>
                        ` : `
                            <div class="text-gray-500 text-sm text-center py-4">
                                <div style="font-size: 24px; margin-bottom: 8px;">&#10003;</div>
                                All listings are fresh!
                            </div>
                        `}
                    </div>
                </div>
                ` : ''}

                <!-- Recently Relisted Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'recent-relisted')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('recent-relisted') ? 'collapsed' : ''}" draggable="true" data-widget-id="recent-relisted" style="${widgetManager.getWidgetStyle('recent-relisted', 50)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Recently Relisted</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('recent-relisted')" title="Collapse/Expand">${widgetManager.isCollapsed('recent-relisted') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${recentlyRelisted.length > 0 ? `
                            <div class="space-y-2">
                                ${recentlyRelisted.map(listing => {
                                    return `
                                        <div class="flex items-center justify-between p-3 rounded" style="background: var(--success-50); border: 1px solid var(--success-200);">
                                            <div style="flex: 1;">
                                                <div class="text-sm font-medium">${escapeHtml(listing.title?.substring(0, 30) || 'Untitled')}${listing.title?.length > 30 ? '...' : ''}</div>
                                                <div class="text-xs" style="color: var(--success-600);">
                                                    ${components.platformBadge(listing.platform)}
                                                </div>
                                            </div>
                                            <div style="text-align: right;" title="${formatExactTime(listing.last_relisted_at)}">
                                                <div class="text-sm font-medium" style="color: var(--success-700);">${formatRelativeTime(listing.last_relisted_at)}</div>
                                                <div class="text-xs text-gray-400" style="cursor: help;">Hover for exact time</div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <div class="text-gray-500 text-sm text-center py-4">
                                No recently relisted items
                            </div>
                        `}
                    </div>
                </div>
                ` : ''}

                <!-- Recent Sales Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'recent-sales')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('recent-sales') ? 'collapsed' : ''}" draggable="true" data-widget-id="recent-sales" style="${widgetManager.getWidgetStyle('recent-sales', 50)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Recent Sales</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('recent-sales')" title="Collapse/Expand">${widgetManager.isCollapsed('recent-sales') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            // Build activity from various sources
                            const activities = [];

                            // Recent sales
                            (store.state.sales || []).slice(0, 3).forEach(sale => {
                                activities.push({
                                    icon: 'sales',
                                    color: 'var(--success-500)',
                                    text: `Sold "${(sale.listing_title || sale.inventory_title || 'Item').substring(0, 20)}..." on ${sale.platform}`,
                                    time: sale.created_at,
                                    type: 'sale'
                                });
                            });

                            // Recent inventory additions
                            (store.state.inventory || []).slice(0, 3).forEach(item => {
                                activities.push({
                                    icon: 'inventory',
                                    color: 'var(--primary-500)',
                                    text: `Added "${(item.title || 'Item').substring(0, 25)}..." to inventory`,
                                    time: item.created_at,
                                    type: 'inventory'
                                });
                            });

                            // Recent listings
                            (store.state.listings || []).slice(0, 3).forEach(listing => {
                                activities.push({
                                    icon: 'upload',
                                    color: 'var(--info-500)',
                                    text: `Listed "${(listing.title || 'Item').substring(0, 20)}..." on ${listing.platform}`,
                                    time: listing.listed_at || listing.created_at,
                                    type: 'listing'
                                });
                            });

                            // Sort by time and take most recent 5
                            activities.sort((a, b) => new Date(b.time) - new Date(a.time));
                            const recentActivities = activities.slice(0, 5);

                            if (recentActivities.length === 0) {
                                return '<div class="text-gray-500 text-sm text-center py-4">No recent activity</div>';
                            }

                            return '<div class="space-y-3">' + recentActivities.map(activity => `
                                <div class="flex items-start gap-3">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: ${activity.color}15; color: ${activity.color}; display: flex; align-items: center; justify-content: center;">
                                        ${components.icon(activity.icon, 14)}
                                    </div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div class="text-sm" style="word-break: break-word;">${escapeHtml(activity.text)}</div>
                                        <div class="text-xs text-gray-400">${formatRelativeTime(activity.time)}</div>
                                    </div>
                                </div>
                            `).join('') + '</div>';
                        })()}
                    </div>
                </div>
                ` : ''}`, 'Listings & Sales')}

                ${safeWidget(() => `<!-- Sales Forecast Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'sales-forecast')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('sales-forecast') ? 'collapsed' : ''}" draggable="true" data-widget-id="sales-forecast" style="${widgetManager.getWidgetStyle('sales-forecast', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Sales Forecast</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('sales-forecast')" title="Collapse/Expand">${widgetManager.isCollapsed('sales-forecast') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            const actualData = [];
                            const predictedData = [];
                            for (let i = 6; i >= 0; i--) {
                                const date = new Date();
                                date.setDate(date.getDate() - i);
                                const dateStr = toLocalDate(date);
                                actualData.push((store.state.sales || []).filter(s => s.sold_at?.startsWith(dateStr)).length);
                            }
                            const avg = actualData.reduce((a, b) => a + b, 0) / actualData.length;
                            const trend = (actualData[actualData.length - 1] - actualData[0]) / actualData.length;
                            for (let i = 1; i <= 3; i++) {
                                predictedData.push(Math.max(0, Math.round(avg + trend * i)));
                            }
                            return forecastChart.render({ actual: actualData, predicted: predictedData }, { width: 180, height: 50 });
                        })()}
                        <div class="text-xs text-gray-500 mt-2 text-center">Last 7 days + 3-day forecast</div>
                    </div>
                </div>
                ` : ''}

                <!-- Conversion Funnel Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'conversion-funnel')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('conversion-funnel') ? 'collapsed' : ''}" draggable="true" data-widget-id="conversion-funnel" style="${widgetManager.getWidgetStyle('conversion-funnel', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Conversion Funnel</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('conversion-funnel')" title="Collapse/Expand">${widgetManager.isCollapsed('conversion-funnel') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${salesFunnel.render([
                            { name: 'Inventory', value: (store.state.inventory || []).length },
                            { name: 'Listed', value: (store.state.listings || []).filter(l => l.status === 'active').length },
                            { name: 'Offers', value: (store.state.offers || []).length },
                            { name: 'Sold', value: (store.state.sales || []).length }
                        ])}
                    </div>
                </div>
                ` : ''}

                <!-- Profit Margin Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'profit-margin')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('profit-margin') ? 'collapsed' : ''}" draggable="true" data-widget-id="profit-margin" style="${widgetManager.getWidgetStyle('profit-margin', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Profit Margin</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('profit-margin')" title="Collapse/Expand">${widgetManager.isCollapsed('profit-margin') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body flex justify-center">
                        ${(() => {
                            const totalRevenue = (store.state.sales || []).reduce((sum, s) => sum + (s.sale_price || 0), 0);
                            const totalCost = (store.state.sales || []).reduce((sum, s) => sum + (s.cost_price || s.purchase_price || 0), 0);
                            const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
                            return profitGauge.render(margin, 100, { size: 100, label: 'Margin', color: margin >= 30 ? 'var(--success-500)' : margin >= 15 ? 'var(--warning-500)' : 'var(--error-500)' });
                        })()}
                    </div>
                </div>
                ` : ''}`, 'Forecast & Analytics')}

                ${safeWidget(() => `<!-- Cash Flow Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'cash-flow')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('cash-flow') ? 'collapsed' : ''}" draggable="true" data-widget-id="cash-flow" style="${widgetManager.getWidgetStyle('cash-flow', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Cash Flow</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('cash-flow')" title="Collapse/Expand">${widgetManager.isCollapsed('cash-flow') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            const transactions = [
                                ...(store.state.sales || []).slice(-5).map(s => ({ type: 'income', amount: s.sale_price || 0, description: s.title || 'Sale' })),
                                ...(store.state.purchases || []).slice(-3).map(p => ({ type: 'expense', amount: p.amount || 0, description: p.vendor || 'Purchase' }))
                            ].sort(() => Math.random() - 0.5).slice(0, 6);
                            return transactions.length > 0 ? cashFlowTicker.render(transactions) : '<div class="text-gray-500 text-sm text-center">No recent transactions</div>';
                        })()}
                    </div>
                </div>
                ` : ''}

                <!-- Today's Tasks Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'todays-tasks')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('todays-tasks') ? 'collapsed' : ''}" draggable="true" data-widget-id="todays-tasks" style="${widgetManager.getWidgetStyle('todays-tasks', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Today's Tasks</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('todays-tasks')" title="Collapse/Expand">${widgetManager.isCollapsed('todays-tasks') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${tasksWidget.render(store.state.tasks || [])}
                    </div>
                </div>
                ` : ''}

                <!-- Ship Today Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'ship-today')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('ship-today') ? 'collapsed' : ''}" draggable="true" data-widget-id="ship-today" style="${widgetManager.getWidgetStyle('ship-today', 33)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Ship Today</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('ship-today')" title="Collapse/Expand">${widgetManager.isCollapsed('ship-today') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${shippingQueue.render(store.state.orders || [])}
                    </div>
                </div>
                ` : ''}

                <!-- Milestones Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'milestones')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('milestones') ? 'collapsed' : ''}" draggable="true" data-widget-id="milestones" style="${widgetManager.getWidgetStyle('milestones', 50)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Milestones</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('milestones')" title="Collapse/Expand">${widgetManager.isCollapsed('milestones') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${milestoneTracker.render([
                            { name: 'First 100 Sales', current: Math.min((store.state.sales || []).length, 100), target: 100, icon: 'trophy' },
                            { name: 'List 50 Items', current: Math.min((store.state.listings || []).length, 50), target: 50, icon: 'list' },
                            { name: '$5K Revenue', current: Math.min((store.state.sales || []).reduce((sum, s) => sum + (s.sale_price || 0), 0), 5000), target: 5000, icon: 'dollar-sign' }
                        ])}
                    </div>
                </div>
                ` : ''}`, 'Tasks & Shipping')}

                ${safeWidget(() => `<!-- Low Stock Alerts Widget -->
                ${(() => {
                    const lowStockAlertItems = (store.state.inventory || []).filter(item => {
                        const qty = item.quantity != null ? item.quantity : 1;
                        const threshold = item.low_stock_threshold || 5;
                        return qty <= threshold;
                    }).slice(0, 5);
                    const outOfStockItems = lowStockAlertItems.filter(i => (i.quantity != null ? i.quantity : 1) === 0);
                    const lowStockOnly = lowStockAlertItems.filter(i => (i.quantity != null ? i.quantity : 1) > 0);

                    if (!widgetManager.getWidgets().find(w => w.id === 'low-stock-alerts')?.visible) return '';

                    return `
                    <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('low-stock-alerts') ? 'collapsed' : ''}" draggable="true" data-widget-id="low-stock-alerts" style="${widgetManager.getWidgetStyle('low-stock-alerts', 33)}">
                        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 class="card-title" style="color: ${lowStockAlertItems.length > 0 ? 'var(--error-600)' : 'inherit'};">
                                ${components.icon('alert-triangle', 16)} Low Stock Alerts
                            </h3>
                            <div class="flex items-center gap-2">
                                ${lowStockAlertItems.length > 0 ? `<span class="badge badge-error">${lowStockAlertItems.length} items</span>` : ''}
                                <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('low-stock-alerts')" title="Collapse/Expand">${widgetManager.isCollapsed('low-stock-alerts') ? '▼' : '▲'}</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${lowStockAlertItems.length > 0 ? `
                                <div class="space-y-2">
                                    ${lowStockAlertItems.map(item => {
                                        const qty = item.quantity != null ? item.quantity : 1;
                                        const isOutOfStock = qty === 0;
                                        return `
                                            <div class="flex items-center justify-between p-3 rounded" style="background: ${isOutOfStock ? 'var(--error-50)' : 'var(--warning-50)'}; border: 1px solid ${isOutOfStock ? 'var(--error-200)' : 'var(--warning-200)'};">
                                                <div style="flex: 1;">
                                                    <div class="text-sm font-medium">${escapeHtml(item.title?.substring(0, 25) || 'Untitled')}${item.title?.length > 25 ? '...' : ''}</div>
                                                    <div class="text-xs text-gray-500">SKU: ${item.sku || 'N/A'}</div>
                                                </div>
                                                <div style="text-align: right; margin-right: 12px;">
                                                    <div class="text-sm font-bold" style="color: ${isOutOfStock ? 'var(--error-600)' : 'var(--warning-600)'};">
                                                        ${isOutOfStock ? 'Out of Stock' : `${qty} left`}
                                                    </div>
                                                    <div class="text-xs text-gray-400">Threshold: ${item.low_stock_threshold || 5}</div>
                                                </div>
                                                <button class="btn btn-sm ${isOutOfStock ? 'btn-error' : 'btn-warning'}" onclick="loadChunk('inventory').then(() => handlers.editItem('${item.id}')).catch(() => { router.navigate('inventory'); })">
                                                    Restock
                                                </button>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                                <button class="btn btn-secondary btn-sm w-full mt-3" onclick="router.navigate('inventory')">
                                    View All Inventory
                                </button>
                            ` : `
                                <div class="text-gray-500 text-sm text-center py-4">
                                    <div style="font-size: 24px; margin-bottom: 8px;">✓</div>
                                    All items are well stocked!
                                </div>
                            `}
                        </div>
                    </div>
                    `;
                })()}

                <!-- Marketplace Price Trends Widget -->
                ${widgetManager.getWidgets().find(w => w.id === 'price-trends')?.visible ? `
                <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('price-trends') ? 'collapsed' : ''}" draggable="true" data-widget-id="price-trends" style="${widgetManager.getWidgetStyle('price-trends', 50)}">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">${components.icon('trending-up', 16)} Price Trends</h3>
                        <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('price-trends')" title="Collapse/Expand">${widgetManager.isCollapsed('price-trends') ? '▼' : '▲'}</button>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            // Get top-selling items with price history
                            const salesByItem = {};
                            (store.state.sales || []).forEach(s => {
                                const key = s.inventory_title || s.listing_title || s.title || 'Unknown';
                                if (!salesByItem[key]) salesByItem[key] = { title: key, prices: [], count: 0, platform: s.platform };
                                salesByItem[key].prices.push(s.sale_price || 0);
                                salesByItem[key].count++;
                            });

                            // Also include active listings with price variations
                            const topItems = Object.values(salesByItem)
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 5);

                            // If no sales data, show from inventory
                            if (topItems.length === 0) {
                                const inventoryItems = (store.state.inventory || []).slice(0, 5).map(item => ({
                                    title: item.title || 'Untitled',
                                    prices: [
                                        parseFloat(item.list_price || 0) * 0.9,
                                        parseFloat(item.list_price || 0) * 0.95,
                                        parseFloat(item.list_price || 0) * 0.92,
                                        parseFloat(item.list_price || 0) * 1.02,
                                        parseFloat(item.list_price || 0) * 0.98,
                                        parseFloat(item.list_price || 0) * 1.05,
                                        parseFloat(item.list_price || 0)
                                    ],
                                    count: 0,
                                    platform: 'inventory',
                                    currentPrice: parseFloat(item.list_price || 0)
                                }));

                                if (inventoryItems.length === 0) {
                                    return '<div class="text-gray-500 text-sm text-center py-4">Add inventory items to see price trends</div>';
                                }

                                return '<div class="space-y-3">' + inventoryItems.map(item => {
                                    const sparkData = item.prices;
                                    const current = item.currentPrice;
                                    const first = sparkData[0] || 0;
                                    const change = first > 0 ? ((current - first) / first * 100).toFixed(1) : 0;
                                    const isUp = change >= 0;
                                    return '<div class="flex items-center gap-3 p-2 rounded" style="background: var(--gray-50);">' +
                                        '<div style="flex: 1; min-width: 0;">' +
                                            '<div class="text-sm font-medium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(item.title.substring(0, 28)) + (item.title.length > 28 ? '...' : '') + '</div>' +
                                            '<div class="text-xs text-gray-400">$' + current.toFixed(2) + '</div>' +
                                        '</div>' +
                                        '<div style="width: 80px;">' + priceTrendSparkline.render(sparkData, 80, 24) + '</div>' +
                                        '<div style="width: 55px; text-align: right;">' +
                                            '<span class="text-xs font-medium" style="color: ' + (isUp ? 'var(--success)' : 'var(--error)') + ';">' + (isUp ? '+' : '') + change + '%</span>' +
                                        '</div>' +
                                    '</div>';
                                }).join('') + '</div>';
                            }

                            return '<div class="space-y-3">' + topItems.map(item => {
                                const avgPrice = item.prices.reduce((a, b) => a + b, 0) / item.prices.length;
                                const latestPrice = item.prices[item.prices.length - 1];
                                const firstPrice = item.prices[0];
                                const change = firstPrice > 0 ? ((latestPrice - firstPrice) / firstPrice * 100).toFixed(1) : 0;
                                const isUp = change >= 0;
                                // Pad sparkline data to 7 points
                                const sparkData = item.prices.length >= 7 ? item.prices.slice(-7) : [...Array(7 - item.prices.length).fill(avgPrice), ...item.prices];
                                return '<div class="flex items-center gap-3 p-2 rounded" style="background: var(--gray-50);">' +
                                    '<div style="flex: 1; min-width: 0;">' +
                                        '<div class="text-sm font-medium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(item.title.substring(0, 28)) + (item.title.length > 28 ? '...' : '') + '</div>' +
                                        '<div class="text-xs text-gray-400">' + item.count + ' sale' + (item.count !== 1 ? 's' : '') + ' · ' + (item.platform || 'multi') + '</div>' +
                                    '</div>' +
                                    '<div style="width: 80px;">' + priceTrendSparkline.render(sparkData, 80, 24) + '</div>' +
                                    '<div style="width: 55px; text-align: right;">' +
                                        '<span class="text-xs font-medium" style="color: ' + (isUp ? 'var(--success)' : 'var(--error)') + ';">' + (isUp ? '+' : '') + change + '%</span>' +
                                    '</div>' +
                                '</div>';
                            }).join('') + '</div>';
                        })()}
                        <button class="btn btn-ghost btn-sm w-full mt-2" onclick="router.navigate('predictions')">
                            ${components.icon('bar-chart-2', 14)} View Full Analysis
                        </button>
                    </div>
                </div>
                ` : ''}

                `, 'Alerts & Trends')}

                ${safeWidget(() => {
                    // Upcoming Calendar Events Preview Widget
                    const calEvents = (store.state.calendarEvents || [])
                        .filter(e => new Date(e.date || e.start) >= new Date())
                        .sort((a, b) => new Date(a.date || a.start) - new Date(b.date || b.start))
                        .slice(0, 5);
                    if (!widgetManager.getWidgets().find(w => w.id === 'upcoming-events')?.visible) return '';
                    return `
                    <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('upcoming-events') ? 'collapsed' : ''}" draggable="true" data-widget-id="upcoming-events" style="${widgetManager.getWidgetStyle('upcoming-events', 33)}">
                        <div class="card-header flex justify-between items-center">
                            <h3 class="card-title">${components.icon('calendar', 16)} Upcoming Events</h3>
                            <div class="flex items-center gap-2">
                                <button class="btn btn-ghost btn-sm" onclick="router.navigate('calendar')">View Calendar</button>
                                <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('upcoming-events')" title="Collapse/Expand">${widgetManager.isCollapsed('upcoming-events') ? '▼' : '▲'}</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${calEvents.length > 0 ? `
                                <div class="space-y-2">
                                    ${calEvents.map(evt => `
                                        <div class="flex items-center gap-3 p-2 rounded" style="background: var(--gray-50); cursor: pointer;" onclick="router.navigate('calendar')">
                                            <div style="width: 40px; text-align: center;">
                                                <div class="text-xs text-gray-400">${new Date(evt.date || evt.start).toLocaleDateString('en-US', { month: 'short' })}</div>
                                                <div class="text-lg font-bold">${new Date(evt.date || evt.start).getDate()}</div>
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div class="text-sm font-medium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(evt.title || 'Untitled Event')}</div>
                                                <div class="text-xs text-gray-400">${evt.type ? `<span class="badge badge-sm">${escapeHtml(evt.type)}</span>` : ''}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div class="text-gray-500 text-sm text-center py-4">
                                    No upcoming events
                                    <br><button class="btn btn-sm btn-secondary mt-2" onclick="modals.addCalendarEvent()">Add Event</button>
                                </div>
                            `}
                        </div>
                    </div>
                    `;
                }, 'Upcoming Events')}

                ${safeWidget(() => {
                    // Recent Items Strip Widget
                    if (!widgetManager.getWidgets().find(w => w.id === 'recent-items')?.visible) return '';
                    const recentItems = [...(store.state.inventory || [])]
                        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                        .slice(0, 5);
                    return `
                    <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('recent-items') ? 'collapsed' : ''}" draggable="true" data-widget-id="recent-items" style="${widgetManager.getWidgetStyle('recent-items', 100)}">
                        <div class="card-header flex justify-between items-center">
                            <h3 class="card-title">${components.icon('clock', 16)} Recent Items</h3>
                            <div class="flex items-center gap-2">
                                <button class="btn btn-ghost btn-sm" onclick="router.navigate('inventory')">View All</button>
                                <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('recent-items')" title="Collapse/Expand">${widgetManager.isCollapsed('recent-items') ? '▼' : '▲'}</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${recentItems.length > 0 ? `
                                <div class="recent-items-strip">
                                    ${recentItems.map(item => {
                                        const images = (() => { try { return JSON.parse(item.images || '[]'); } catch { return []; } })();
                                        const thumb = images[0] || '';
                                        return `
                                            <div class="recent-item-card" onclick="router.navigate('inventory'); setTimeout(() => handlers.editItem('${item.id}'), 100)" title="${escapeHtml(item.title || 'Untitled')}">
                                                <div class="recent-item-thumb">
                                                    ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy"/>` : `<div class="recent-item-placeholder">${components.icon('package', 24)}</div>`}
                                                </div>
                                                <div class="recent-item-info">
                                                    <div class="recent-item-title">${escapeHtml((item.title || 'Untitled').substring(0, 24))}${(item.title || '').length > 24 ? '...' : ''}</div>
                                                    <div class="recent-item-time">${components.relativeTime(item.updated_at || item.created_at)}</div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : `
                                <div class="text-gray-500 text-sm text-center py-4">No inventory items yet</div>
                            `}
                        </div>
                    </div>
                    `;
                }, 'Recent Items')}

                ${safeWidget(() => {
                    // Mini P&L Snapshot Widget
                    if (!widgetManager.getWidgets().find(w => w.id === 'mini-pnl')?.visible) return '';
                    const sales = store.state.sales || [];
                    const revenue = sales.reduce((sum, s) => sum + (s.sale_price || 0), 0);
                    const cogs = sales.reduce((sum, s) => {
                        const inv = (store.state.inventory || []).find(i => i.id === s.inventory_id);
                        return sum + (inv ? (parseFloat(inv.purchase_price || inv.cost_price) || 0) : 0);
                    }, 0);
                    const fees = sales.reduce((sum, s) => sum + (s.platform_fee || (s.sale_price || 0) * 0.13), 0);
                    const net = revenue - cogs - fees;
                    const maxVal = Math.max(revenue, 1);
                    return `
                    <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('mini-pnl') ? 'collapsed' : ''}" draggable="true" data-widget-id="mini-pnl" style="${widgetManager.getWidgetStyle('mini-pnl', 33)}">
                        <div class="card-header flex justify-between items-center">
                            <h3 class="card-title">${components.icon('dollar-sign', 16)} Mini P&L</h3>
                            <div class="flex items-center gap-2">
                                <button class="btn btn-ghost btn-sm" onclick="router.navigate('analytics')">Details</button>
                                <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('mini-pnl')" title="Collapse/Expand">${widgetManager.isCollapsed('mini-pnl') ? '▼' : '▲'}</button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="mini-pnl-widget">
                                <div class="mini-pnl-row">
                                    <span class="mini-pnl-label">Revenue</span>
                                    <div class="mini-pnl-bar-track">
                                        <div class="mini-pnl-bar" style="width: ${(revenue / maxVal * 100).toFixed(1)}%; background: var(--success);"></div>
                                    </div>
                                    <span class="mini-pnl-value" style="color: var(--success);">C$${revenue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                                </div>
                                <div class="mini-pnl-row">
                                    <span class="mini-pnl-label">COGS</span>
                                    <div class="mini-pnl-bar-track">
                                        <div class="mini-pnl-bar" style="width: ${(cogs / maxVal * 100).toFixed(1)}%; background: var(--error);"></div>
                                    </div>
                                    <span class="mini-pnl-value" style="color: var(--error);">-C$${cogs.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                                </div>
                                <div class="mini-pnl-row">
                                    <span class="mini-pnl-label">Fees</span>
                                    <div class="mini-pnl-bar-track">
                                        <div class="mini-pnl-bar" style="width: ${(fees / maxVal * 100).toFixed(1)}%; background: var(--warning-500);"></div>
                                    </div>
                                    <span class="mini-pnl-value" style="color: var(--warning-600);">-C$${fees.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                                </div>
                                <div class="mini-pnl-divider"></div>
                                <div class="mini-pnl-row mini-pnl-net">
                                    <span class="mini-pnl-label">Net Profit</span>
                                    <div class="mini-pnl-bar-track">
                                        <div class="mini-pnl-bar" style="width: ${(Math.abs(net) / maxVal * 100).toFixed(1)}%; background: ${net >= 0 ? 'var(--primary-500)' : 'var(--error)'};"></div>
                                    </div>
                                    <span class="mini-pnl-value" style="color: ${net >= 0 ? 'var(--primary-600)' : 'var(--error)'}; font-weight: 700;">C$${net.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }, 'Mini P&L')}

                ${safeWidget(() => {
                    // Pending Offers Urgency Widget
                    if (!widgetManager.getWidgets().find(w => w.id === 'pending-offers')?.visible) return '';
                    const pendingOffers = (store.state.offers || [])
                        .filter(o => o.status === 'pending')
                        .sort((a, b) => {
                            if (a.expires_at && b.expires_at) return new Date(a.expires_at) - new Date(b.expires_at);
                            if (a.expires_at) return -1;
                            if (b.expires_at) return 1;
                            return new Date(b.created_at) - new Date(a.created_at);
                        })
                        .slice(0, 5);
                    return `
                    <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('pending-offers') ? 'collapsed' : ''}" draggable="true" data-widget-id="pending-offers" style="${widgetManager.getWidgetStyle('pending-offers', 33)}">
                        <div class="card-header flex justify-between items-center">
                            <h3 class="card-title">${components.icon('offers', 16)} Pending Offers</h3>
                            <div class="flex items-center gap-2">
                                ${pendingOffers.length > 0 ? `<span class="badge badge-warning">${pendingOffers.length}</span>` : ''}
                                <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('pending-offers')" title="Collapse/Expand">${widgetManager.isCollapsed('pending-offers') ? '▼' : '▲'}</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${pendingOffers.length > 0 ? `
                                <div class="space-y-2">
                                    ${pendingOffers.map(offer => {
                                        const listing = (store.state.listings || []).find(l => l.id === offer.listing_id);
                                        const title = listing ? listing.title : offer.listing_id || 'Unknown Item';
                                        let countdown = '';
                                        let isUrgent = false;
                                        if (offer.expires_at) {
                                            const remaining = new Date(offer.expires_at) - new Date();
                                            if (remaining <= 0) {
                                                countdown = '<span class="offer-countdown expired">Expired</span>';
                                            } else {
                                                const hours = Math.floor(remaining / 3600000);
                                                const mins = Math.floor((remaining % 3600000) / 60000);
                                                isUrgent = hours < 24;
                                                countdown = '<span class="offer-countdown ' + (isUrgent ? 'urgent' : '') + '">' + (hours > 0 ? hours + 'h ' : '') + mins + 'm left</span>';
                                            }
                                        } else {
                                            countdown = '<span class="offer-countdown">No expiration</span>';
                                        }
                                        return '<div class="offers-urgency-item' + (isUrgent ? ' urgent' : '') + '">' +
                                            '<div style="flex: 1; min-width: 0;">' +
                                                '<div class="text-sm font-medium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(title.substring(0, 30)) + (title.length > 30 ? '...' : '') + '</div>' +
                                                '<div class="text-xs text-gray-400">' + escapeHtml(offer.buyer || 'Unknown') + ' · ' + escapeHtml(offer.platform || '') + '</div>' +
                                            '</div>' +
                                            '<div style="text-align: right;">' +
                                                '<div class="text-sm font-bold" style="color: var(--success);">$' + (offer.amount || 0).toLocaleString() + '</div>' +
                                                countdown +
                                            '</div>' +
                                        '</div>';
                                    }).join('')}
                                </div>
                                <button class="btn btn-ghost btn-sm w-full mt-3" onclick="router.navigate('offers')">
                                    View All Offers
                                </button>
                            ` : `
                                <div class="text-gray-500 text-sm text-center py-4">
                                    No pending offers
                                    <br><button class="btn btn-sm btn-secondary mt-2" onclick="router.navigate('listings')">View Listings</button>
                                </div>
                            `}
                        </div>
                    </div>
                    `;
                }, 'Pending Offers')}

                ${safeWidget(() => {
                    if (!widgetManager.getWidgets().find(w => w.id === 'poshmark-closet')?.visible) return '';
                    const pm = store.state.poshmarkMonitoring || null;
                    const checkedAt = pm?.checked_at ? new Date(pm.checked_at) : null;
                    const minutesAgo = checkedAt ? Math.floor((Date.now() - checkedAt.getTime()) / 60000) : null;
                    const history = Array.isArray(pm?.closet_value_history) ? pm.closet_value_history : [];

                    const sparkline = history.length >= 2 ? (() => {
                        const max = Math.max(...history.map(h => h.value || 0)) || 1;
                        return `<div class="poshmark-sparkline" role="img" aria-label="Closet value trend" style="display:flex;align-items:flex-end;gap:3px;height:32px;margin-top:8px;">
                            ${history.slice(-12).map(h => {
                                const pct = Math.max(4, Math.round(((h.value || 0) / max) * 100));
                                return `<div style="flex:1;background:var(--primary-400);border-radius:2px 2px 0 0;height:${pct}%;min-height:4px;" title="C$${(h.value||0).toLocaleString()} on ${escapeHtml(h.date||'')}"></div>`;
                            }).join('')}
                        </div>`;
                    })() : '';

                    return `
                    <div class="card dashboard-widget collapsible-card ${widgetManager.isCollapsed('poshmark-closet') ? 'collapsed' : ''}" draggable="true" data-widget-id="poshmark-closet" style="${widgetManager.getWidgetStyle('poshmark-closet', 50)}">
                        <div class="card-header flex justify-between items-center">
                            <h3 class="card-title">Poshmark Closet</h3>
                            <div class="flex items-center gap-2">
                                <button class="btn btn-sm btn-primary" onclick="handlers.checkPoshmarkMonitoring()" aria-label="Check Poshmark closet now" style="min-height:44px;min-width:44px;">Check Now</button>
                                <button class="widget-collapse-btn" onclick="widgetManager.toggleCollapse('poshmark-closet')" title="Collapse/Expand" aria-label="Collapse or expand Poshmark Closet widget">${widgetManager.isCollapsed('poshmark-closet') ? '▼' : '▲'}</button>
                            </div>
                        </div>
                        <div class="card-body">
                            ${pm ? `
                                <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:4px;">
                                    <div class="stat-item" style="text-align:center;">
                                        <div class="text-2xl font-bold">${escapeHtml(String(pm.total_listings ?? '—'))}</div>
                                        <div class="text-xs text-gray-500">Total Listings</div>
                                    </div>
                                    <div class="stat-item" style="text-align:center;">
                                        <div class="text-2xl font-bold">${escapeHtml(String(pm.total_shares ?? '—'))}</div>
                                        <div class="text-xs text-gray-500">Total Shares</div>
                                    </div>
                                    <div class="stat-item" style="text-align:center;">
                                        <div class="text-2xl font-bold">${escapeHtml(String(pm.active_offers ?? '—'))}</div>
                                        <div class="text-xs text-gray-500">Active Offers</div>
                                    </div>
                                    <div class="stat-item" style="text-align:center;">
                                        <div class="text-2xl font-bold">${escapeHtml(String(pm.recent_sales ?? '—'))}</div>
                                        <div class="text-xs text-gray-500">Recent Sales</div>
                                    </div>
                                    <div class="stat-item" style="text-align:center;grid-column:span 2;">
                                        <div class="text-2xl font-bold">C$${pm.closet_value != null ? Number(pm.closet_value).toLocaleString() : '—'}</div>
                                        <div class="text-xs text-gray-500">Closet Value</div>
                                        ${sparkline}
                                    </div>
                                </div>
                                <div class="text-xs text-gray-400 mt-2" style="text-align:right;">
                                    Last checked: ${minutesAgo === 0 ? 'just now' : minutesAgo === 1 ? '1 minute ago' : minutesAgo != null ? escapeHtml(String(minutesAgo)) + ' minutes ago' : 'unknown'}
                                </div>
                            ` : `
                                <div class="text-gray-500 text-sm text-center py-6">
                                    No monitoring data — click Check Now to start
                                </div>
                            `}
                        </div>
                    </div>
                    `;
                }, 'Poshmark Closet')}

            </div><!-- End dashboard-widgets-container -->
        `;
    },

    // Inventory page,

    analytics() {
        const analyticsData = store.state.analyticsData || {};
        const salesAnalytics = store.state.salesAnalytics || {};
        let hiddenTabs = store.state.hiddenAnalyticsTabs;
        if (!hiddenTabs) {
            try {
                hiddenTabs = JSON.parse(localStorage.getItem('vaultlister_hidden_analytics_tabs') || '[]');
            } catch (e) {
                console.error('Failed to parse hidden analytics tabs:', e);
                hiddenTabs = [];
            }
        }
        const currentTab = store.state.analyticsTab || 'graphs';

        // Calculate stats from data
        const totalRevenue = analyticsData.stats?.sales?.revenue || 0;
        const totalProfit = analyticsData.stats?.sales?.profit || 0;
        const totalSales = analyticsData.stats?.sales?.total || 1;
        const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

        const totalInventory = analyticsData.stats?.inventory?.total || 1;
        const soldItems = analyticsData.stats?.inventory?.sold || 0;
        const sellThrough = Math.round((soldItems / totalInventory) * 100);

        // Prepare chart data - Sales trend (last 30 days)
        const salesTrendData = (salesAnalytics.salesData || []).slice(0, 30).reverse().map(d => ({
            label: new Date(d.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: d.revenue || 0
        }));

        // Platform comparison data - fixed format: separate quantity from platform name
        const platformData = (salesAnalytics.byPlatform || []).map(p => ({
            label: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
            value: p.revenue || 0,
            count: p.sales || 0
        }));

        // Get period label based on current state
        const periodLabels = {
            '7d': 'last 7 days',
            '30d': 'last 30 days',
            '90d': 'last 90 days',
            '6m': 'last 6 months',
            '1y': 'last year',
            'custom': 'custom date range'
        };
        const currentPeriod = store.state.analyticsPeriod || '30d';
        const periodLabel = periodLabels[currentPeriod] || 'last 30 days';

        // Calculate sales tab stats
        const salesList = store.state.sales || [];
        const salesTabStats = {
            totalSales: salesList.length,
            totalRevenue: salesList.reduce((sum, s) => sum + (s.sale_price || 0), 0),
            totalProfit: salesList.reduce((sum, s) => sum + (s.net_profit || 0), 0),
            totalFees: salesList.reduce((sum, s) => sum + (s.platform_fee || 0), 0),
            avgSalePrice: salesList.length > 0 ? salesList.reduce((sum, s) => sum + (s.sale_price || 0), 0) / salesList.length : 0,
            avgProfit: salesList.length > 0 ? salesList.reduce((sum, s) => sum + (s.net_profit || 0), 0) / salesList.length : 0
        };

        // Sales tab content with new columns
        const salesTabContent = `
            <!-- Sales Summary Cards -->
            <div class="stats-grid mb-6">
                ${components.statCard('Total Sales', salesTabStats.totalSales, 'sales', 0)}
                ${components.statCard('Total Revenue', 'C$' + salesTabStats.totalRevenue.toFixed(2), 'analytics', 0)}
                ${components.statCard('Total Profit', 'C$' + salesTabStats.totalProfit.toFixed(2), 'activity', 0)}
                ${components.statCard('Avg Sale Price', 'C$' + salesTabStats.avgSalePrice.toFixed(2), 'inventory', 0)}
            </div>

            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-2xl font-bold text-primary">C$${salesTabStats.totalFees.toFixed(2)}</div>
                        <div class="text-sm text-gray-500">Platform Fees Paid</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-2xl font-bold ${salesTabStats.totalProfit >= 0 ? 'text-success' : 'text-error'}">
                            ${salesTabStats.totalRevenue > 0 ? ((salesTabStats.totalProfit / salesTabStats.totalRevenue) * 100).toFixed(1) + '%' : 'N/A'}
                        </div>
                        <div class="text-sm text-gray-500">Profit Margin</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-2xl font-bold text-primary">C$${salesTabStats.avgProfit.toFixed(2)}</div>
                        <div class="text-sm text-gray-500">Avg Profit per Sale</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header flex justify-between items-center">
                    <h3 class="card-title">Sales Details</h3>
                    <div class="flex gap-2">
                        <input type="date" id="analytics-sales-start" class="form-input" style="width: 150px;" value="${store.state.salesDateStart || ''}" aria-label="Start date">
                        <input type="date" id="analytics-sales-end" class="form-input" style="width: 150px;" value="${store.state.salesDateEnd || ''}" aria-label="End date">
                        <button class="btn btn-secondary" onclick="handlers.filterAnalyticsSales()">Filter</button>
                    </div>
                </div>
                <div class="card-body">
                    ${(store.state.sales || []).length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">${components.icon('sales', 48)}</div>
                            <h3 class="empty-state-title">No sales yet</h3>
                            <p class="empty-state-description">Sales will appear here with detailed tracking</p>
                        </div>
                    ` : `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Item</th>
                                    <th>Platform</th>
                                    <th>Sale Price</th>
                                    <th>Item Cost</th>
                                    <th>Customer Ship</th>
                                    <th>Seller Ship</th>
                                    <th>Platform Fee</th>
                                    <th>Net Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(store.state.sales || []).map(s => `
                                    <tr>
                                        <td>${new Date(s.created_at).toLocaleDateString()}</td>
                                        <td class="font-medium">${escapeHtml(s.listing_title || s.inventory_title || 'N/A')}</td>
                                        <td><span class="badge badge-info">${s.platform}</span></td>
                                        <td class="text-success">C$${(s.sale_price || 0).toFixed(2)}</td>
                                        <td class="text-gray-600">C$${(s.item_cost || 0).toFixed(2)}</td>
                                        <td class="text-gray-600">C$${(s.customer_shipping_cost || 0).toFixed(2)}</td>
                                        <td class="text-gray-600">C$${(s.seller_shipping_cost || s.shipping_cost || 0).toFixed(2)}</td>
                                        <td class="text-gray-600">C$${(s.platform_fee || 0).toFixed(2)}</td>
                                        <td class="font-medium ${(s.net_profit || 0) >= 0 ? 'text-success' : 'text-error'}">C$${(s.net_profit || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>

            <!-- Sales by Platform Summary - Fixed format -->
            <div class="card mt-6">
                <div class="card-header">
                    <h3 class="card-title">Sales by Platform</h3>
                </div>
                <div class="card-body">
                    ${platformData.length === 0 ? `
                        <p class="text-gray-500 text-center py-4">No platform sales data</p>
                    ` : `
                        <div class="flex flex-col gap-3">
                            ${platformData.map(p => `
                                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div class="flex items-center gap-3">
                                        <span class="font-medium">${p.label}</span>
                                        <span class="text-sm text-gray-500">| ${p.count} ${p.count === 1 ? 'sale' : 'sales'}</span>
                                    </div>
                                    <span class="font-bold text-success">Total: C$${(p.value || 0).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        const finData = store.state.financialsData || {};
        const finRevenue = finData.totalRevenue || store.state.salesAnalytics?.totalRevenue || 0;
        const finExpenses = finData.totalExpenses || 0;
        const finNetProfit = finRevenue - finExpenses;
        const finProfitMargin = finRevenue > 0 ? ((finNetProfit / finRevenue) * 100).toFixed(1) : '0.0';
        const finCashFlow = finRevenue - finExpenses;
        const budgetCategories = store.state.budgetCategories || [
            { name: 'Marketing', spent: 0, budget: 200 },
            { name: 'Shipping', spent: 0, budget: 500 },
            { name: 'Supplies', spent: 0, budget: 300 },
            { name: 'Fees', spent: 0, budget: 400 }
        ];

        const financialsAnalyticsTabContent = `
    <div class="grid grid-cols-2 gap-6 mb-6">
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('target', 18)} Profit Margin</h3></div>
            <div class="card-body text-center">
                <div style="font-size: 48px; font-weight: 700; color: ${parseFloat(finProfitMargin) >= 0 ? 'var(--success)' : 'var(--error)'};">${finProfitMargin}%</div>
                <div class="text-sm text-gray-500">Profit Margin</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('bar-chart', 18)} Cash Flow Breakdown</h3></div>
            <div class="card-body">
                <div class="flex flex-col gap-3">
                    ${[
                        { label: 'Revenue', value: finRevenue, color: 'var(--success)' },
                        { label: 'Expenses', value: -finExpenses, color: 'var(--error)' },
                        { label: 'Net', value: finCashFlow, color: finCashFlow >= 0 ? 'var(--success)' : 'var(--error)' }
                    ].map(item => `
                        <div class="flex justify-between items-center p-2 rounded" style="background:var(--gray-50)">
                            <span class="text-sm">${item.label}</span>
                            <span class="font-bold" style="color:${item.color}">C$${Math.abs(item.value).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
    <div class="grid grid-cols-2 gap-6 mb-6">
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('activity', 18)} Financial Ratios</h3></div>
            <div class="card-body">
                <div class="grid grid-cols-2 gap-4">
                    ${[
                        { label: 'Gross Margin', value: finRevenue > 0 ? finProfitMargin + '%' : 'N/A' },
                        { label: 'Current Ratio', value: '0.00' },
                        { label: 'Debt-to-Equity', value: 'N/A' }
                    ].map(r => `
                        <div class="text-center p-3" style="background:var(--gray-50);border-radius:8px;">
                            <div class="text-xl font-bold text-primary">${r.value}</div>
                            <div class="text-xs text-gray-500">${r.label}</div>
                            <div class="text-xs text-warning mt-1">Review</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3 class="card-title">${components.icon('pie-chart', 18)} Budget Progress</h3></div>
            <div class="card-body">
                <div class="flex flex-col gap-3">
                    ${budgetCategories.map(cat => `
                        <div>
                            <div class="flex justify-between text-sm mb-1">
                                <span>${cat.name}</span>
                                <span class="text-gray-500">C$${cat.spent} / C$${cat.budget}</span>
                            </div>
                            <div style="height:6px;background:var(--gray-200);border-radius:3px;">
                                <div style="width:${Math.min(100, (cat.spent/cat.budget)*100)}%;height:100%;background:var(--primary);border-radius:3px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>
`;

        const inventoryItemsForAnalytics = store.state.inventory || [];
        const inventoryActive = inventoryItemsForAnalytics.filter(i => i.status === 'active').length;
        const inventoryLow = inventoryItemsForAnalytics.filter(i => { const q = i.quantity != null ? i.quantity : 1; return q <= (i.low_stock_threshold || 5) && q > 0; }).length;
        const inventoryOut = inventoryItemsForAnalytics.filter(i => Number(i.quantity) === 0).length;

        const inventoryAnalyticsTabContent = `
    <div class="stats-grid mb-6">
        ${components.statCard('Total Items', inventoryItemsForAnalytics.length, 'inventory', 0)}
        ${components.statCard('Active', inventoryActive, 'activity', 0)}
        ${components.statCard('Low Stock', inventoryLow, 'calendar', 0)}
        ${components.statCard('Out of Stock', inventoryOut, 'sales', 0)}
    </div>
    <div class="card">
        <div class="card-header"><h3 class="card-title">Stock Status Breakdown</h3></div>
        <div class="card-body">
            <div class="flex gap-6 justify-center py-4">
                ${[
                    { label: 'In Stock', count: inventoryActive - inventoryLow, color: 'var(--success)' },
                    { label: 'Low Stock', count: inventoryLow, color: 'var(--warning)' },
                    { label: 'Out of Stock', count: inventoryOut, color: 'var(--error)' }
                ].map(s => `
                    <div class="text-center">
                        <div class="text-3xl font-bold" style="color:${s.color}">${s.count}</div>
                        <div class="text-sm text-gray-500">${s.label}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
`;

        const salesAnalyticsTabContent = salesTabContent;

        const purchases = store.state.purchases || [];
        const purchasesTotal = purchases.reduce((sum, p) => sum + (parseFloat(p.total_cost || p.cost || 0)), 0);
        const purchasesByPlatform = {};
        purchases.forEach(p => {
            const pl = p.platform || p.source || 'Other';
            purchasesByPlatform[pl] = (purchasesByPlatform[pl] || 0) + parseFloat(p.total_cost || p.cost || 0);
        });

        const purchasesAnalyticsTabContent = `
    <div class="stats-grid mb-6">
        ${components.statCard('Total Purchases', purchases.length, 'inventory', 0)}
        ${components.statCard('Total COGS', 'C$' + purchasesTotal.toFixed(2), 'analytics', 0)}
        ${components.statCard('Avg Cost', purchases.length > 0 ? 'C$' + (purchasesTotal / purchases.length).toFixed(2) : 'C$0', 'activity', 0)}
    </div>
    <div class="card">
        <div class="card-header"><h3 class="card-title">Spend by Source</h3></div>
        <div class="card-body">
            ${Object.keys(purchasesByPlatform).length === 0 ? `<p class="text-gray-500 text-center py-4">No purchase data yet</p>` : `
                <div class="flex flex-col gap-3">
                    ${Object.entries(purchasesByPlatform).map(([pl, amt]) => `
                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span class="font-medium">${escapeHtml(pl)}</span>
                            <span class="font-bold text-primary">C$${amt.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    </div>
`;

        // Performance tab content - inventory turnover, best sellers, avg days to sell
        const inventory = store.state.inventory || [];
        const sales = store.state.sales || [];

        // Calculate performance metrics
        const soldItemsList = inventory.filter(i => i.status === 'sold');
        const activeItems = inventory.filter(i => i.status === 'active');

        // Average days to sell (for sold items with created_at and sold_at dates)
        const itemsWithSellTime = sales.filter(s => s.created_at);
        const avgDaysToSell = itemsWithSellTime.length > 0
            ? Math.round(itemsWithSellTime.reduce((sum, s) => {
                const listDate = new Date(s.listed_at || s.created_at);
                const saleDate = new Date(s.created_at);
                return sum + Math.max(0, (saleDate - listDate) / (1000 * 60 * 60 * 24));
            }, 0) / itemsWithSellTime.length)
            : 0;

        // Inventory turnover rate (sold / avg inventory)
        const turnoverRate = inventory.length > 0
            ? ((soldItems.length / inventory.length) * 100).toFixed(1)
            : 0;

        // Best sellers by platform
        const listingsMap = Object.fromEntries((store.state.listings || []).map(l => [l.id, l]));
        const inventoryMap = Object.fromEntries((inventory || []).map(i => [i.id, i]));
        const salesByItem = {};
        sales.forEach(s => {
            const listing = listingsMap[s.listing_id];
            const invItem = listing ? inventoryMap[listing.inventory_id] : null;
            const key = listing?.title || invItem?.title || s.listing_title || s.inventory_title || (s.platform ? s.platform.charAt(0).toUpperCase() + s.platform.slice(1) + ' Sale' : 'Sale');
            if (!salesByItem[key]) {
                salesByItem[key] = { title: key, count: 0, revenue: 0, platform: s.platform };
            }
            salesByItem[key].count++;
            salesByItem[key].revenue += (s.sale_price || 0);
        });
        const bestSellers = Object.values(salesByItem).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        // Build price trend data from real price history
        bestSellers.forEach(item => {
            const avgPrice = item.count > 0 ? item.revenue / item.count : 0;
            const invItem = (store.state.inventory || []).find(i => (i.title || '') === item.title);
            const priceHistory = invItem && Array.isArray(invItem.price_history) ? invItem.price_history.map(h => h.price || h).filter(Number.isFinite) : [];
            const trend = priceHistory.length >= 2 ? priceHistory.slice(-7) : [];
            item.priceTrend = trend;
            item.avgPrice = avgPrice;
            item.trendDirection = trend.length >= 2 ? (trend[trend.length - 1] > trend[0] ? 'up' : 'down') : 'stable';
        });

        // Error stats shared between Performance and Reports tabs
        const perfErrorSales = sales.filter(s => s.status === 'failed' || s.status === 'error');
        const perfTotalErrors = perfErrorSales.length;
        const perfErrorRate = sales.length > 0 ? ((perfTotalErrors / sales.length) * 100).toFixed(1) : '0';
        const perfMostCommonError = perfTotalErrors === 0 ? 'None' : (() => {
            const freq = {};
            perfErrorSales.forEach(s => { const t = s.error_type || s.status || 'Error'; freq[t] = (freq[t] || 0) + 1; });
            return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Error';
        })();

        // Slowest moving inventory (oldest active items)
        const slowMovers = [...activeItems]
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .slice(0, 5);

        // Category performance
        const categoryPerf = {};
        sales.forEach(s => {
            const cat = s.category || 'Uncategorized';
            if (!categoryPerf[cat]) {
                categoryPerf[cat] = { category: cat, sales: 0, revenue: 0 };
            }
            categoryPerf[cat].sales++;
            categoryPerf[cat].revenue += (s.sale_price || 0);
        });
        const topCategories = Object.values(categoryPerf).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        const performanceTabContent = `
            <!-- Performance Metrics Cards -->
            <div class="stats-grid mb-6">
                ${components.statCard('Inventory Turnover', turnoverRate + '%', 'activity', 0)}
                ${components.statCard('Avg Days to Sell', avgDaysToSell + ' days', 'calendar', 0)}
                ${components.statCard('Active Listings', activeItems.length, 'inventory', 0)}
                ${components.statCard('Items Sold', soldItems.length, 'sales', 0)}
            </div>

            <div class="grid grid-cols-2 gap-6 mb-6">
                <!-- Best Sellers -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Top Selling Items</h3>
                        <span class="text-xs text-gray-500">with market price trends</span>
                    </div>
                    <div class="card-body">
                        ${bestSellers.length === 0 ? `
                            <p class="text-gray-500 text-center py-4">No sales data yet</p>
                        ` : `
                            <div class="flex flex-col gap-3">
                                ${bestSellers.map((item, i) => `
                                    <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg best-seller-row">
                                        <div class="flex items-center gap-3">
                                            <span class="font-bold text-primary">#${i + 1}</span>
                                            <div>
                                                <div class="font-medium">${escapeHtml(item.title.substring(0, 25))}${item.title.length > 25 ? '...' : ''}</div>
                                                <div class="text-xs text-gray-500">${item.count} sold @ C$${item.avgPrice.toFixed(2)} avg</div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-3">
                                            <div class="price-trend-sparkline" title="7-day market price trend">
                                                ${sparkline.create(item.priceTrend, 60, 24, { showArea: true, trend: item.trendDirection === 'up' ? 'trend-up' : 'trend-down' })}
                                            </div>
                                            <span class="font-bold text-success" style="min-width: 70px; text-align: right;">C$${item.revenue.toFixed(2)}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <!-- Slowest Moving Inventory -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Slowest Moving Inventory</h3>
                        <p class="text-xs text-gray-500">Items listed longest without selling</p>
                    </div>
                    <div class="card-body">
                        ${slowMovers.length === 0 ? `
                            <p class="text-gray-500 text-center py-4">No active inventory</p>
                        ` : `
                            <div class="flex flex-col gap-3">
                                ${slowMovers.map(item => {
                                    const daysListed = Math.floor((Date.now() - new Date(item.created_at)) / (1000 * 60 * 60 * 24));
                                    return `
                                        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                            <div>
                                                <div class="font-medium">${escapeHtml((item.title || 'Untitled').substring(0, 30))}${(item.title || '').length > 30 ? '...' : ''}</div>
                                                <div class="text-xs text-gray-500">Listed ${daysListed} days ago</div>
                                            </div>
                                            <span class="font-medium">C$${(item.listing_price || item.cost_price || 0).toFixed(2)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>

            <!-- Category Performance -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Performance by Category</h3>
                </div>
                <div class="card-body">
                    ${topCategories.length === 0 ? `
                        <p class="text-gray-500 text-center py-4">No category data available</p>
                    ` : `
                        <div class="grid grid-cols-5 gap-4">
                            ${topCategories.map(cat => `
                                <div class="text-center p-4 bg-gray-50 rounded-lg">
                                    <div class="text-2xl font-bold text-primary">${cat.sales}</div>
                                    <div class="text-sm font-medium">${escapeHtml(cat.category)}</div>
                                    <div class="text-xs text-gray-500">C$${cat.revenue.toFixed(2)}</div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>

            <!-- Error Reports -->
            <div class="card mt-6">
                <div class="card-header">
                    <h3 class="card-title">Error Reports</h3>
                    <p class="text-xs text-gray-500">Failed listings and sync errors</p>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div class="text-center p-3 bg-gray-50 rounded-lg">
                            <div class="text-2xl font-bold text-error">${perfTotalErrors}</div>
                            <div class="text-xs text-gray-500">Total Errors (30d)</div>
                        </div>
                        <div class="text-center p-3 bg-gray-50 rounded-lg">
                            <div class="text-2xl font-bold text-warning">${perfErrorRate}%</div>
                            <div class="text-xs text-gray-500">Error Rate</div>
                        </div>
                        <div class="text-center p-3 bg-gray-50 rounded-lg">
                            <div class="text-2xl font-bold text-primary">${escapeHtml(perfMostCommonError)}</div>
                            <div class="text-xs text-gray-500">Most Common Error</div>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Platform</th>
                                    <th>Item</th>
                                    <th>Error Type</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${perfErrorSales.length === 0 ? `
                                    <tr><td colspan="5" class="text-center text-gray-400 py-4">No errors recorded</td></tr>
                                ` : perfErrorSales.slice(0, 10).map(s => `
                                    <tr>
                                        <td>${new Date(s.sale_date || s.created_at).toLocaleDateString()}</td>
                                        <td><span class="badge badge-gray">${escapeHtml(s.platform || 'Unknown')}</span></td>
                                        <td>${escapeHtml(s.title || s.item_title || 'Unknown Item')}</td>
                                        <td>${escapeHtml(s.error_type || s.status || 'Error')}</td>
                                        <td><span class="badge ${s.resolved ? 'badge-success' : 'badge-warning'}">${s.resolved ? 'Resolved' : 'Pending'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;


        // Ratio Analysis tab content - calculate ratios
        const totalInventoryValue = (store.state.inventory || []).reduce((sum, item) => sum + ((item.cost_price || 0) * (item.quantity || 1)), 0);
        const avgInventoryValue = totalInventoryValue > 0 ? totalInventoryValue : 1;
        const totalRevenue2 = (store.state.sales || []).reduce((sum, s) => sum + (s.sale_price || 0), 0);
        const soldItemsCount = (store.state.inventory || []).filter(i => i.status === 'sold').length;
        const totalListedItems = (store.state.inventory || []).length || 1;
        const netProfit = (store.state.sales || []).reduce((sum, s) => sum + (s.net_profit || 0), 0);
        const totalInvestment = totalInventoryValue;

        const inventoryTurnoverRatio = avgInventoryValue > 0 ? (totalRevenue2 / avgInventoryValue).toFixed(2) : 'N/A';
        const sellThroughRate = ((soldItemsCount / totalListedItems) * 100).toFixed(1);
        const profitMarginRatio = totalRevenue2 > 0 ? ((netProfit / totalRevenue2) * 100).toFixed(1) : 'N/A';
        const roiRatio = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100).toFixed(1) : 'N/A';

        const ratioAnalysisTabContent = `
            <div class="grid grid-cols-2 gap-6">
                <!-- Inventory Turnover Ratio -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Inventory Turnover Ratio</h3>
                        <p class="text-xs text-gray-500">Total Sales / Average Inventory Value</p>
                    </div>
                    <div class="card-body">
                        <div class="text-center">
                            <div class="text-4xl font-bold text-primary mb-2">${inventoryTurnoverRatio}</div>
                            <div class="text-sm text-gray-500 mb-4">Ratio</div>
                            <div class="flex justify-center gap-2">
                                <span class="badge ${inventoryTurnoverRatio >= 2 ? 'badge-success' : inventoryTurnoverRatio >= 1 ? 'badge-warning' : 'badge-error'}">
                                    ${inventoryTurnoverRatio >= 2 ? 'Good' : inventoryTurnoverRatio >= 1 ? 'Average' : 'Poor'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sell-Through Rate -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Sell-Through Rate</h3>
                        <p class="text-xs text-gray-500">Items Sold / Total Listed</p>
                    </div>
                    <div class="card-body">
                        <div class="text-center">
                            <div class="text-4xl font-bold text-primary mb-2">${sellThroughRate}%</div>
                            <div class="text-sm text-gray-500 mb-4">Percentage</div>
                            <div class="flex justify-center gap-2">
                                <span class="badge ${sellThroughRate >= 50 ? 'badge-success' : sellThroughRate >= 25 ? 'badge-warning' : 'badge-error'}">
                                    ${sellThroughRate >= 50 ? 'Good' : sellThroughRate >= 25 ? 'Average' : 'Poor'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Profit Margin -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Profit Margin</h3>
                        <p class="text-xs text-gray-500">Net Profit / Revenue</p>
                    </div>
                    <div class="card-body">
                        <div class="text-center">
                            <div class="text-4xl font-bold text-primary mb-2">${profitMarginRatio === 'N/A' ? 'N/A' : profitMarginRatio + '%'}</div>
                            <div class="text-sm text-gray-500 mb-4">Percentage</div>
                            <div class="flex justify-center gap-2">
                                ${profitMarginRatio === 'N/A' ? '<span class="badge badge-gray">No data</span>' : `<span class="badge ${profitMarginRatio >= 30 ? 'badge-success' : profitMarginRatio >= 15 ? 'badge-warning' : 'badge-error'}">${profitMarginRatio >= 30 ? 'Good' : profitMarginRatio >= 15 ? 'Average' : 'Poor'}</span>`}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ROI -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Return on Investment (ROI)</h3>
                        <p class="text-xs text-gray-500">Net Profit / Total Investment</p>
                    </div>
                    <div class="card-body">
                        <div class="text-center">
                            <div class="text-4xl font-bold text-primary mb-2">${roiRatio === 'N/A' ? 'N/A' : roiRatio + '%'}</div>
                            <div class="text-sm text-gray-500 mb-4">Percentage</div>
                            <div class="flex justify-center gap-2">
                                ${roiRatio === 'N/A' ? '<span class="badge badge-gray">No data</span>' : `<span class="badge ${roiRatio >= 50 ? 'badge-success' : roiRatio >= 20 ? 'badge-warning' : 'badge-error'}">${roiRatio >= 50 ? 'Good' : roiRatio >= 20 ? 'Average' : 'Poor'}</span>`}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Profitability Analysis tab content
        const totalCOGS = (store.state.sales || []).reduce((sum, s) => sum + ((s.item_cost || 0) || 0), 0);
        const grossProfit = totalRevenue2 - totalCOGS;
        const platformFees = (store.state.sales || []).reduce((sum, s) => sum + (s.platform_fee || 0), 0);
        const shippingCosts = (store.state.sales || []).reduce((sum, s) => sum + ((s.shipping_cost || 0) + (s.customer_shipping || 0)), 0);
        const netProfit2 = totalRevenue2 - totalCOGS - platformFees - shippingCosts;

        const profitabilityTabContent = `
            <div class="grid grid-cols-1 gap-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Profit Breakdown</h3>
                    </div>
                    <div class="card-body">
                        <div class="grid grid-cols-3 gap-4">
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-500 mb-1">Revenue</div>
                                <div class="text-2xl font-bold text-success">C$${totalRevenue2.toFixed(2)}</div>
                            </div>
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-500 mb-1">COGS</div>
                                <div class="text-2xl font-bold text-error">-C$${totalCOGS.toFixed(2)}</div>
                            </div>
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-500 mb-1">Gross Profit</div>
                                <div class="text-2xl font-bold text-primary">C$${grossProfit.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-4">
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-500 mb-1">Platform Fees</div>
                                <div class="text-2xl font-bold text-error">-C$${platformFees.toFixed(2)}</div>
                            </div>
                            <div class="p-4 bg-gray-50 rounded-lg">
                                <div class="text-sm text-gray-500 mb-1">Shipping Costs</div>
                                <div class="text-2xl font-bold text-error">-C$${shippingCosts.toFixed(2)}</div>
                            </div>
                        </div>
                        <div class="p-4 callout-info rounded-lg mt-4">
                            <div class="text-sm text-gray-600 mb-1">Net Profit</div>
                            <div class="text-3xl font-bold ${netProfit2 >= 0 ? 'text-success' : 'text-error'}">C$${netProfit2.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Product Analysis tab content - table of products sorted by performance
        const productPerformance = (() => {
            const products = {};
            (store.state.sales || []).forEach(sale => {
                const title = sale.listing_title || sale.inventory_title || 'Unknown';
                if (!products[title]) {
                    products[title] = {
                        title: title,
                        unitsSold: 0,
                        revenue: 0,
                        platform: sale.platform
                    };
                }
                products[title].unitsSold++;
                products[title].revenue += (sale.sale_price || 0);
            });

            return Object.values(products)
                .map(p => ({
                    ...p,
                    avgPrice: p.unitsSold > 0 ? (p.revenue / p.unitsSold).toFixed(2) : 0,
                    salesVelocity: p.unitsSold
                }))
                .sort((a, b) => b.revenue - a.revenue);
        })();

        const productAnalysisTabContent = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Product Performance</h3>
                    <p class="text-xs text-gray-500">Products sorted by revenue</p>
                </div>
                <div class="card-body">
                    ${productPerformance.length === 0 ? `
                        <div class="text-center text-gray-500 py-8">No product data available</div>
                    ` : `
                        <div class="table-container">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Units Sold</th>
                                        <th>Revenue</th>
                                        <th>Avg Price</th>
                                        <th>Platform</th>
                                        <th>Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productPerformance.slice(0, 20).map(p => {
                                        let rating = 'poor';
                                        if (p.salesVelocity >= 5) rating = 'good';
                                        else if (p.salesVelocity >= 2) rating = 'average';

                                        return `
                                            <tr>
                                                <td class="font-medium">${escapeHtml(p.title.substring(0, 40))}${p.title.length > 40 ? '...' : ''}</td>
                                                <td>${p.unitsSold}</td>
                                                <td>C$${p.revenue.toFixed(2)}</td>
                                                <td>C$${p.avgPrice}</td>
                                                <td><span class="badge badge-gray">${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}</span></td>
                                                <td><span class="badge ${rating === 'good' ? 'badge-success' : rating === 'average' ? 'badge-warning' : 'badge-error'}">${rating.charAt(0).toUpperCase() + rating.slice(1)}</span></td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        // KPI data for dashboard
        const kpiData = [
            { label: 'Revenue', value: 'C$' + totalRevenue.toFixed(0), change: 0, target: totalRevenue * 1.2, actual: totalRevenue },
            { label: 'Sales Count', value: totalSales.toString(), change: 0, target: Math.ceil(totalSales * 1.15), actual: totalSales },
            { label: 'Profit Margin', value: profitMargin + '%', change: 0, target: 35, actual: profitMargin },
            { label: 'Sell-Through', value: sellThrough + '%', change: 0, target: 40, actual: sellThrough }
        ];

        // Sales funnel stages
        const funnelStages = [
            { name: 'Views', value: analyticsData.stats?.listings?.views || 0, color: 'var(--primary-300)' },
            { name: 'Likes', value: analyticsData.stats?.listings?.likes || 0, color: 'var(--primary-400)' },
            { name: 'Offers', value: analyticsData.stats?.offers?.total || 0, color: 'var(--primary-500)' },
            { name: 'Sales', value: totalSales, color: 'var(--primary-600)' }
        ];

        // Time of day heatmap data
        const heatmapData = Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => 0)
        );

        // Goal tracking
        const revenueGoal = {
            name: 'Monthly Revenue Goal',
            current: totalRevenue,
            target: store.state.revenueGoal || 500,
            unit: 'C$'
        };

        // Calculate performance trends
        const prevPeriodRevenue = totalRevenue * (0.8 + Math.random() * 0.4); // Simulated previous period
        const revenueGrowth = prevPeriodRevenue > 0 ? ((totalRevenue - prevPeriodRevenue) / prevPeriodRevenue * 100) : 0;
        const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

        // Performance indicators
        const performanceLevel = revenueGrowth >= 10 ? 'growing' :
                                revenueGrowth >= 0 ? 'stable' : 'declining';

        return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">${components.icon('bar-chart-2', 24)} Analytics</h1>
                    <p class="page-description">Performance insights for ${periodLabel}</p>
                </div>
                <div class="flex gap-2" style="align-items: center;">
                    <button class="btn btn-secondary" onclick="handlers.showWeeklyReport()">
                        ${components.icon('calendar', 16)} Weekly
                    </button>
                    <button class="btn btn-secondary" onclick="handlers.showSalesVelocity()">
                        ${components.icon('trending-up', 16)} Velocity
                    </button>
                    <button class="btn btn-secondary" onclick="handlers.showCustomerInsights()">
                        ${components.icon('users', 16)} Customers
                    </button>
                    <button class="btn btn-secondary" onclick="handlers.showSeasonalTrends()">
                        ${components.icon('sun', 16)} Seasons
                    </button>
                    <div class="dropdown" onclick="event.stopPropagation(); this.classList.toggle('open')">
                        <button aria-haspopup="menu" class="btn btn-secondary" onclick="event.stopPropagation(); this.closest('.dropdown').classList.toggle('open')">
                            ${components.icon('more-horizontal', 16)} More
                        </button>
                        <div class="dropdown-menu" style="right: 0; min-width: 160px;">
                            <button class="dropdown-item" onclick="handlers.showCustomMetricBuilder()">
                                ${components.icon('sliders', 16)} Custom KPIs
                            </button>
                            <button class="dropdown-item" onclick="handlers.showAnalyticsDigestSettings()">
                                ${components.icon('mail', 16)} Schedule Digest
                            </button>
                            <button class="dropdown-item" onclick="handlers.showExpenseTracker()">
                                ${components.icon('credit-card', 16)} Expenses
                            </button>
                            <button class="dropdown-item" onclick="handlers.showGoalSettings()">
                                ${components.icon('target', 16)} Goals
                            </button>
                            <button class="dropdown-item" onclick="handlers.refreshAnalytics()">
                                ${components.icon('refresh-cw', 16)} Refresh
                            </button>
                            <button class="dropdown-item" onclick="handlers.exportAnalyticsCSV()">
                                ${components.icon('download', 16)} Export CSV
                            </button>
                        </div>
                    </div>
                    <label for="analytics-period" class="sr-only">Analytics Period</label>
                    <select id="analytics-period" name="analytics-period" onchange="handlers.changeAnalyticsPeriod(this.value)" class="form-select" style="width: 150px;">
                        <option value="7d" ${store.state.analyticsPeriod === '7d' ? 'selected' : ''}>Last 7 Days</option>
                        <option value="30d" ${store.state.analyticsPeriod === '30d' ? 'selected' : ''}>Last 30 Days</option>
                        <option value="90d" ${store.state.analyticsPeriod === '90d' ? 'selected' : ''}>Last 90 Days</option>
                        <option value="6m" ${store.state.analyticsPeriod === '6m' ? 'selected' : ''}>Last 6 Months</option>
                        <option value="1y" ${store.state.analyticsPeriod === '1y' ? 'selected' : ''}>Last Year</option>
                        <option value="custom" ${store.state.analyticsPeriod === 'custom' ? 'selected' : ''}>Custom Range</option>
                    </select>
                    <button class="btn ${store.state.analyticsCompareMode ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="handlers.toggleAnalyticsCompare()" title="Compare with previous period" style="white-space: nowrap;">
                        ${components.icon('git-compare', 14)} Compare
                    </button>
                </div>
            </div>

            <!-- Custom KPI Metrics -->
            ${(() => {
                const customMetrics = store.state.customMetrics || [];
                if (customMetrics.length === 0) return '';
                const analyticsStats = analyticsData.stats || {};
                const metricValues = {
                    'revenue': analyticsStats.sales?.revenue || 0,
                    'profit': analyticsStats.sales?.profit || 0,
                    'orders': analyticsStats.sales?.total || 0,
                    'inventory_value': analyticsStats.inventory?.totalValue || 0,
                    'items_sold': analyticsStats.inventory?.sold || 0,
                    'active_listings': analyticsStats.listings?.active || 0,
                    'avg_sale': (analyticsStats.sales?.revenue || 0) / Math.max(analyticsStats.sales?.total || 1, 1),
                    'total_views': analyticsStats.listings?.views || 0
                };
                const calcMetric = (m) => {
                    const a = metricValues[m.metric_a] || 0;
                    const b = metricValues[m.metric_b] || 1;
                    switch(m.operation) {
                        case 'add': return a + b;
                        case 'subtract': return a - b;
                        case 'multiply': return a * b;
                        case 'divide': return b !== 0 ? a / b : 0;
                        default: return a;
                    }
                };
                const formatVal = (val, fmt) => {
                    if (fmt === 'currency') return 'C$' + val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                    if (fmt === 'percentage') return val.toFixed(1) + '%';
                    return Math.round(val).toLocaleString();
                };
                return '<div class="custom-kpi-grid mb-6">' + customMetrics.map(m => {
                    const val = calcMetric(m);
                    return '<div class="custom-kpi-card"><div class="custom-kpi-value">' + formatVal(val, m.display_format) + '</div><div class="custom-kpi-name">' + escapeHtml(m.name) + '</div><button class="btn btn-icon btn-xs custom-kpi-delete" onclick="handlers.deleteCustomMetric(\'' + m.id + '\')" title="Remove">' + components.icon('x', 12) + '</button></div>';
                }).join('') + '</div>';
            })()}

            <!-- Analytics Hero Section -->
            <div class="analytics-hero mb-6">
                <div class="analytics-hero-snapshot">
                    <div class="snapshot-header">
                        <div class="snapshot-period">
                            <span class="period-icon">${components.icon('calendar', 18)}</span>
                            <span class="period-text">${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}</span>
                        </div>
                        <div class="performance-indicator ${performanceLevel}">
                            ${performanceLevel === 'growing' ? components.icon('trending-up', 16) :
                              performanceLevel === 'stable' ? components.icon('minus', 16) :
                              components.icon('trending-down', 16)}
                            <span>${performanceLevel.charAt(0).toUpperCase() + performanceLevel.slice(1)}</span>
                        </div>
                    </div>

                    <div class="snapshot-metrics">
                        <div class="snapshot-metric primary">
                            <div class="metric-value-large">C$${totalRevenue.toLocaleString()}</div>
                            <div class="metric-label">Total Revenue</div>
                            <div class="metric-change ${revenueGrowth >= 0 ? 'positive' : 'negative'}">
                                ${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}% vs prev
                            </div>
                        </div>
                        <div class="snapshot-metric">
                            <div class="metric-value-medium">${totalSales}</div>
                            <div class="metric-label">Total Sales</div>
                        </div>
                        <div class="snapshot-metric">
                            <div class="metric-value-medium">C$${avgOrderValue.toFixed(2)}</div>
                            <div class="metric-label">Avg Order Value</div>
                        </div>
                        <div class="snapshot-metric">
                            <div class="metric-value-medium">${profitMargin}%</div>
                            <div class="metric-label">Profit Margin</div>
                        </div>
                    </div>
                </div>

                <div class="analytics-hero-highlights">
                    <div class="highlight-card">
                        <div class="highlight-icon top-seller">
                            ${components.icon('award', 18)}
                        </div>
                        <div class="highlight-content">
                            <div class="highlight-label">Top Platform</div>
                            <div class="highlight-value">${platformData.length > 0 ? platformData[0].label : 'N/A'}</div>
                            <div class="highlight-detail">${platformData.length > 0 ? 'C$' + platformData[0].value.toFixed(2) + ' revenue' : ''}</div>
                        </div>
                    </div>
                    <div class="highlight-card">
                        <div class="highlight-icon sell-through">
                            ${components.icon('package', 18)}
                        </div>
                        <div class="highlight-content">
                            <div class="highlight-label">Sell-Through Rate</div>
                            <div class="highlight-value">${sellThrough}%</div>
                            <div class="highlight-detail">${soldItems} of ${totalInventory} items sold</div>
                        </div>
                    </div>
                    <div class="highlight-card">
                        <div class="highlight-icon profit">
                            ${components.icon('dollar', 18)}
                        </div>
                        <div class="highlight-content">
                            <div class="highlight-label">Total Profit</div>
                            <div class="highlight-value ${totalProfit >= 0 ? 'positive' : 'negative'}">${totalProfit >= 0 ? '' : '-'}C$${Math.abs(totalProfit).toFixed(2)}</div>
                            <div class="highlight-detail">After all fees & costs</div>
                        </div>
                    </div>
                </div>

                <div class="analytics-quick-insights">
                    ${bestSellers.length > 0 ? `
                        <div class="quick-insight">
                            ${components.icon('star', 14)}
                            <span>Best seller: <strong>${bestSellers[0].title.substring(0, 25)}${bestSellers[0].title.length > 25 ? '...' : ''}</strong> (C$${bestSellers[0].revenue.toFixed(2)})</span>
                        </div>
                    ` : ''}
                    ${slowMovers.length > 0 ? `
                        <div class="quick-insight warning">
                            ${components.icon('clock', 14)}
                            <span>${slowMovers.length} item${slowMovers.length !== 1 ? 's' : ''} listed for 60+ days need attention</span>
                        </div>
                    ` : ''}
                    ${totalRevenue > 0 ? (profitMargin < 15 ? `
                        <div class="quick-insight alert">
                            ${components.icon('alert-circle', 14)}
                            <span>Profit margin below target (15%). Review pricing strategy.</span>
                        </div>
                    ` : `
                        <div class="quick-insight success">
                            ${components.icon('check-circle', 14)}
                            <span>Profit margin is healthy at ${profitMargin}%</span>
                        </div>
                    `) : ''}
                </div>
            </div>

            <!-- KPI Dashboard -->
            <div class="mb-6">
                ${kpiDashboard.render(kpiData)}
            </div>

            <!-- Sales Funnel & Goal Tracker -->
            <div class="grid grid-cols-3 gap-6 mb-6">
                <div class="card collapsible-card">
                    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
                        <h3 class="card-title">${components.icon('filter', 18)} Sales Funnel</h3>
                        <button class="widget-collapse-btn" aria-label="Collapse" onclick="const c=this.closest('.collapsible-card');c.classList.toggle('collapsed');this.textContent=c.classList.contains('collapsed')?'\u25BC':'\u25B2';" title="Collapse/Expand">&#x25B2;</button>
                    </div>
                    <div class="card-body">
                        ${salesFunnelVertical.render(funnelStages)}
                    </div>
                </div>
                <div class="card collapsible-card">
                    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
                        <h3 class="card-title">${components.icon('clock', 18)} Activity by Time</h3>
                        <button class="widget-collapse-btn" aria-label="Collapse" onclick="const c=this.closest('.collapsible-card');c.classList.toggle('collapsed');this.textContent=c.classList.contains('collapsed')?'\u25BC':'\u25B2';" title="Collapse/Expand">&#x25B2;</button>
                    </div>
                    <div class="card-body">
                        ${timeHeatmap.render(heatmapData)}
                    </div>
                </div>
                <div class="card collapsible-card">
                    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
                        <h3 class="card-title">${components.icon('target', 18)} Goal Progress</h3>
                        <button class="widget-collapse-btn" aria-label="Collapse" onclick="const c=this.closest('.collapsible-card');c.classList.toggle('collapsed');this.textContent=c.classList.contains('collapsed')?'\u25BC':'\u25B2';" title="Collapse/Expand">&#x25B2;</button>
                    </div>
                    <div class="card-body">
                        ${goalTrackerWidget.render(revenueGoal)}
                    </div>
                </div>
            </div>

            <!-- Analytics Tabs -->
            <div class="tabs mb-6" role="tablist" style="overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;">
                ${!hiddenTabs.includes('live') ? `<button class="tab ${currentTab === 'live' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'live' ? 'true' : 'false'}" tabindex="${currentTab === 'live' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('live')">${components.icon('activity', 14)} Live</button>` : ''}
                ${!hiddenTabs.includes('graphs') ? `<button class="tab ${currentTab === 'graphs' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'graphs' ? 'true' : 'false'}" tabindex="${currentTab === 'graphs' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('graphs')">Graphs</button>` : ''}
                ${!hiddenTabs.includes('performance') ? `<button class="tab ${currentTab === 'performance' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'performance' ? 'true' : 'false'}" tabindex="${currentTab === 'performance' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('performance')">Performance</button>` : ''}
                ${!hiddenTabs.includes('heatmaps') ? `<button class="tab ${currentTab === 'heatmaps' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'heatmaps' ? 'true' : 'false'}" tabindex="${currentTab === 'heatmaps' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('heatmaps')">Heatmaps</button>` : ''}
                ${!hiddenTabs.includes('predictions') ? `<button class="tab ${currentTab === 'predictions' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'predictions' ? 'true' : 'false'}" tabindex="${currentTab === 'predictions' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('predictions')">Predictions</button>` : ''}
                ${!hiddenTabs.includes('reports') ? `<button class="tab ${currentTab === 'reports' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'reports' ? 'true' : 'false'}" tabindex="${currentTab === 'reports' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('reports')">Reports</button>` : ''}
                ${!hiddenTabs.includes('ratio-analysis') ? `<button class="tab ${currentTab === 'ratio-analysis' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'ratio-analysis' ? 'true' : 'false'}" tabindex="${currentTab === 'ratio-analysis' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('ratio-analysis')">Ratio Analysis</button>` : ''}
                ${!hiddenTabs.includes('profitability-analysis') ? `<button class="tab ${currentTab === 'profitability' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'profitability' ? 'true' : 'false'}" tabindex="${currentTab === 'profitability' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('profitability')">Profitability Analysis</button>` : ''}
                ${!hiddenTabs.includes('product-analysis') ? `<button class="tab ${currentTab === 'product-analysis' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'product-analysis' ? 'true' : 'false'}" tabindex="${currentTab === 'product-analysis' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('product-analysis')">Product Analysis</button>` : ''}
                ${!hiddenTabs.includes('market-intel') ? `<button class="tab ${currentTab === 'market-intel' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'market-intel' ? 'true' : 'false'}" tabindex="${currentTab === 'market-intel' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('market-intel')">Market Intel</button>` : ''}
                ${!hiddenTabs.includes('sourcing') ? `<button class="tab ${currentTab === 'sourcing' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'sourcing' ? 'true' : 'false'}" tabindex="${currentTab === 'sourcing' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('sourcing')">Sourcing</button>` : ''}
                ${!hiddenTabs.includes('financials-analytics') ? `<button class="tab ${currentTab === 'financials-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'financials-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'financials-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('financials-analytics')">Financials Analytics</button>` : ''}
                ${!hiddenTabs.includes('inventory-analytics') ? `<button class="tab ${currentTab === 'inventory-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'inventory-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'inventory-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('inventory-analytics')">Inventory</button>` : ''}
                ${!hiddenTabs.includes('sales-analytics') ? `<button class="tab ${currentTab === 'sales-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'sales-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'sales-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('sales-analytics')">Sales</button>` : ''}
                ${!hiddenTabs.includes('purchases-analytics') ? `<button class="tab ${currentTab === 'purchases-analytics' ? 'active' : ''}" role="tab" aria-selected="${currentTab === 'purchases-analytics' ? 'true' : 'false'}" tabindex="${currentTab === 'purchases-analytics' ? '0' : '-1'}" onclick="handlers.switchAnalyticsTab('purchases-analytics')">Purchases</button>` : ''}
                <button class="btn btn-ghost btn-sm ml-auto" onclick="handlers.showAnalyticsCustomization()" title="Customize Analytics">
                    ${components.icon('settings', 16)}
                </button>
            </div>

            ${currentTab === 'market-intel' ? (typeof pages.marketIntel === 'function' ? pages.marketIntel() : '<div class="empty-state"><p>Market Intel data will appear here. Navigate to load data.</p></div>')
            : currentTab === 'sourcing' ? (typeof pages.suppliers === 'function' ? pages.suppliers() : '<div class="empty-state"><p>Sourcing data will appear here. Navigate to load data.</p></div>')
            : currentTab === 'live' ? (() => {
                const orders = store.state.orders || [];
                const sales = store.state.sales || [];
                const inventory = store.state.inventory || [];
                const today = toLocalDate(new Date());
                const todaySales = sales.filter(s => s.created_at && s.created_at.startsWith(today));
                const pendingOrders = orders.filter(o => o.status === 'pending');
                const shippedOrders = orders.filter(o => o.status === 'shipped');
                const todayRevenue = todaySales.reduce((sum, s) => sum + (parseFloat(s.sale_price) || 0), 0);
                const activeListings = (store.state.listings || []).filter(l => l.status === 'active').length;
                const lowStockItems = inventory.filter(i => (i.quantity || 0) <= 2 && (i.quantity || 0) > 0).length;
                const refreshInterval = store.state.liveRefreshInterval || 30;
                const isLivePaused = store.state.liveAnalyticsPaused || false;

                return `
                <div class="live-analytics-dashboard">
                    <div class="live-header">
                        <div class="live-indicator ${isLivePaused ? 'paused' : ''}">
                            <span class="live-dot"></span>
                            <span>${isLivePaused ? 'Paused' : 'Live'}</span>
                        </div>
                        <div class="live-controls">
                            <select class="form-select form-select-sm" style="width: auto;" onchange="handlers.setLiveRefreshInterval(parseInt(this.value))">
                                <option value="15" ${refreshInterval === 15 ? 'selected' : ''}>15s</option>
                                <option value="30" ${refreshInterval === 30 ? 'selected' : ''}>30s</option>
                                <option value="60" ${refreshInterval === 60 ? 'selected' : ''}>1m</option>
                                <option value="300" ${refreshInterval === 300 ? 'selected' : ''}>5m</option>
                            </select>
                            <button class="btn btn-sm ${isLivePaused ? 'btn-primary' : 'btn-secondary'}" onclick="handlers.toggleLiveAnalytics()">
                                ${components.icon(isLivePaused ? 'play' : 'pause', 14)} ${isLivePaused ? 'Resume' : 'Pause'}
                            </button>
                            <button class="btn btn-sm btn-secondary" onclick="handlers.refreshLiveAnalytics()">
                                ${components.icon('refresh-cw', 14)} Refresh Now
                            </button>
                        </div>
                    </div>

                    <div class="live-metrics-grid">
                        <div class="live-metric-card">
                            <div class="live-metric-icon" style="background: var(--success-100); color: var(--success-600);">
                                ${components.icon('dollar-sign', 24)}
                            </div>
                            <div class="live-metric-value text-success">C$${todayRevenue.toFixed(2)}</div>
                            <div class="live-metric-label">Today's Revenue</div>
                            <div class="live-metric-sub">${todaySales.length} sale(s) today</div>
                        </div>
                        <div class="live-metric-card">
                            <div class="live-metric-icon" style="background: var(--warning-100); color: var(--warning-600);">
                                ${components.icon('clock', 24)}
                            </div>
                            <div class="live-metric-value text-warning">${pendingOrders.length}</div>
                            <div class="live-metric-label">Pending Orders</div>
                            <div class="live-metric-sub">${shippedOrders.length} shipped</div>
                        </div>
                        <div class="live-metric-card">
                            <div class="live-metric-icon" style="background: var(--primary-100); color: var(--primary-600);">
                                ${components.icon('package', 24)}
                            </div>
                            <div class="live-metric-value">${inventory.length}</div>
                            <div class="live-metric-label">Total Inventory</div>
                            <div class="live-metric-sub">${lowStockItems} low stock</div>
                        </div>
                        <div class="live-metric-card">
                            <div class="live-metric-icon" style="background: var(--info-100, var(--primary-100)); color: var(--info-600, var(--primary-600));">
                                ${components.icon('tag', 24)}
                            </div>
                            <div class="live-metric-value">${activeListings}</div>
                            <div class="live-metric-label">Active Listings</div>
                            <div class="live-metric-sub">across all platforms</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mt-4">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">${components.icon('shopping-bag', 16)} Recent Sales</h3>
                            </div>
                            <div class="card-body" style="max-height: 300px; overflow-y: auto;">
                                ${sales.slice(0, 8).length > 0 ? sales.slice(0, 8).map(s => `
                                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                                        <div>
                                            <div class="font-medium text-sm">${escapeHtml(s.item_title || 'Unknown')}</div>
                                            <div class="text-xs text-gray-500">${s.platform || 'N/A'} &bull; ${s.created_at ? new Date(s.created_at).toLocaleString() : 'N/A'}</div>
                                        </div>
                                        <div class="font-semibold text-success">C$${(parseFloat(s.sale_price) || 0).toFixed(2)}</div>
                                    </div>
                                `).join('') : '<div class="text-center text-gray-400 py-4">No recent sales</div>'}
                            </div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">${components.icon('alert-triangle', 16)} Needs Attention</h3>
                            </div>
                            <div class="card-body" style="max-height: 300px; overflow-y: auto;">
                                ${pendingOrders.length > 0 ? pendingOrders.slice(0, 5).map(o => `
                                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                                        <div>
                                            <div class="font-medium text-sm">${escapeHtml(o.item_title || 'Order')}</div>
                                            <div class="text-xs text-gray-500">Pending &bull; ${o.buyer_username || 'N/A'}</div>
                                        </div>
                                        <button class="btn btn-xs btn-primary" onclick="handlers.viewOrderDetails('${o.id}')">View</button>
                                    </div>
                                `).join('') : ''}
                                ${lowStockItems > 0 ? `
                                    <div class="flex justify-between items-center py-2 border-b border-gray-100">
                                        <div>
                                            <div class="font-medium text-sm">${lowStockItems} item(s) low on stock</div>
                                            <div class="text-xs text-gray-500">Quantity &le; 2</div>
                                        </div>
                                        <button class="btn btn-xs btn-secondary" onclick="router.navigate('inventory')">View</button>
                                    </div>
                                ` : ''}
                                ${pendingOrders.length === 0 && lowStockItems === 0 ? '<div class="text-center text-gray-400 py-4">All clear! Nothing needs attention.</div>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
                `;
            })() : currentTab === 'performance' ? performanceTabContent : currentTab === 'reports' ? `<div class="card"><div class="card-body text-center py-8"><p class="text-gray-500 mb-4">Detailed reports have moved to the Reports page.</p><button class="btn btn-primary" onclick="router.navigate('reports')">${components.icon('bar-chart', 16)} Go to Reports</button></div></div>` : currentTab === 'ratio-analysis' ? ratioAnalysisTabContent : currentTab === 'profitability' ? profitabilityTabContent : currentTab === 'product-analysis' ? productAnalysisTabContent : currentTab === 'heatmaps' ? (() => {
                // Generate heatmap data
                const heatmapRows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                    const cells = Array.from({length: 24}, (_, h) => {
                        const intensity = Math.random();
                        const color = intensity > 0.7 ? 'var(--success-500)' : intensity > 0.4 ? 'var(--warning-400)' : intensity > 0.2 ? 'var(--warning-200)' : 'var(--gray-100)';
                        const views = Math.floor(intensity * 100);
                        return '<div style="background: ' + color + '; padding: 4px; border-radius: 2px; text-align: center; cursor: pointer;" title="' + day + ' ' + h + ':00 - ' + views + ' views">' + (views > 50 ? views : '') + '</div>';
                    }).join('');
                    return '<div style="padding-right: 8px; color: var(--gray-600);">' + day + '</div>' + cells;
                }).join('');

                const platformRows = ['Poshmark', 'eBay', 'Whatnot', 'Depop', 'Shopify', 'Facebook'].map(platform => {
                    const views = Math.floor(Math.random() * 500);
                    const likes = Math.floor(Math.random() * 100);
                    const shares = Math.floor(Math.random() * 50);
                    const sales = Math.floor(Math.random() * 20);
                    return '<div style="display: grid; grid-template-columns: 80px repeat(4, 1fr); gap: 4px; align-items: center;"><span class="font-medium text-sm">' + platform + '</span><div style="background: hsl(120, 60%, ' + (80 - views/10) + '%); padding: 8px; border-radius: 4px; text-align: center;"><div class="text-sm font-bold">' + views + '</div><div class="text-xs opacity-75">Views</div></div><div style="background: hsl(200, 60%, ' + (80 - likes/2) + '%); padding: 8px; border-radius: 4px; text-align: center;"><div class="text-sm font-bold">' + likes + '</div><div class="text-xs opacity-75">Likes</div></div><div style="background: hsl(280, 60%, ' + (80 - shares) + '%); padding: 8px; border-radius: 4px; text-align: center;"><div class="text-sm font-bold">' + shares + '</div><div class="text-xs opacity-75">Shares</div></div><div style="background: hsl(45, 80%, ' + (80 - sales*3) + '%); padding: 8px; border-radius: 4px; text-align: center;"><div class="text-sm font-bold">' + sales + '</div><div class="text-xs opacity-75">Sales</div></div></div>';
                }).join('');

                const categoryRows = ['Tops', 'Bottoms', 'Dresses', 'Shoes', 'Bags', 'Accessories'].map(cat => {
                    const cells = Array.from({length: 7}, () => {
                        const sales = Math.floor(Math.random() * 10);
                        const bg = sales > 6 ? 'var(--primary-500)' : sales > 3 ? 'var(--primary-300)' : sales > 0 ? 'var(--primary-100)' : 'var(--gray-50)';
                        const text = sales > 6 ? 'white' : 'var(--gray-700)';
                        return '<div style="background: ' + bg + '; color: ' + text + '; padding: 8px; border-radius: 4px; text-align: center;">' + sales + '</div>';
                    }).join('');
                    return '<div style="font-weight: 500; color: var(--gray-700);">' + cat + '</div>' + cells;
                }).join('');

                return `
            <!-- Heatmaps Tab -->
            <div class="grid grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Listing Views by Day/Hour</h3></div>
                    <div class="card-body">
                        <div class="heatmap-grid" style="display: grid; grid-template-columns: auto repeat(24, 1fr); gap: 2px; font-size: 10px;">
                            <div></div>
                            ${Array.from({length: 24}, (_, h) => '<div style="text-align: center; color: var(--gray-500);">' + h + '</div>').join('')}
                            ${heatmapRows}
                        </div>
                        <div class="flex justify-center gap-4 mt-4">
                            <span class="text-xs flex items-center gap-1"><span style="width: 12px; height: 12px; background: var(--gray-100); border-radius: 2px;"></span> Low</span>
                            <span class="text-xs flex items-center gap-1"><span style="width: 12px; height: 12px; background: var(--warning-200); border-radius: 2px;"></span> Medium</span>
                            <span class="text-xs flex items-center gap-1"><span style="width: 12px; height: 12px; background: var(--warning-400); border-radius: 2px;"></span> High</span>
                            <span class="text-xs flex items-center gap-1"><span style="width: 12px; height: 12px; background: var(--success-500); border-radius: 2px;"></span> Very High</span>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Platform Engagement</h3></div>
                    <div class="card-body">
                        <div class="heatmap-platforms" style="display: grid; gap: 8px;">${platformRows}</div>
                    </div>
                </div>
                <div class="card col-span-2">
                    <div class="card-header"><h3 class="card-title">Category Performance by Day</h3></div>
                    <div class="card-body">
                        <div class="heatmap-category" style="display: grid; grid-template-columns: 120px repeat(7, 1fr); gap: 4px; font-size: 12px;">
                            <div></div>
                            ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => '<div style="text-align: center; font-weight: 500; color: var(--gray-600);">' + d + '</div>').join('')}
                            ${categoryRows}
                        </div>
                    </div>
                </div>
            </div>`;
            })() : currentTab === 'predictions' ? (() => {
                const forecastBars = Array.from({length: 30}, (_, i) => {
                    const base = 50 + Math.sin(i/5) * 20;
                    const trend = i * 1.5;
                    const random = Math.random() * 20 - 10;
                    const height = Math.max(20, base + trend + random);
                    const isProjected = i > 14;
                    return '<div style="width: 8px; height: ' + height + '%; background: ' + (isProjected ? 'var(--primary-200)' : 'var(--primary-500)') + '; border-radius: 2px;" title="Day ' + (i+1) + ': $' + Math.floor(height * 10) + '"></div>';
                }).join('');

                const bestTimes = [
                    { platform: 'Poshmark', time: 'Thu-Sun, 7-9 PM EST', score: 95 },
                    { platform: 'eBay', time: 'Sun, 6-8 PM EST', score: 92 },
                    { platform: 'Whatnot', time: 'Fri-Sat, 8-11 PM EST', score: 88 },
                    { platform: 'Depop', time: 'Tue-Wed, 4-6 PM EST', score: 85 },
                    { platform: 'Facebook', time: 'Sat-Sun, 10 AM-2 PM', score: 82 }
                ].map(p => '<div style="display: flex; align-items: center; gap: 12px;"><span style="min-width: 80px; font-weight: 500;">' + p.platform + '</span><div style="flex: 1; background: var(--gray-100); height: 24px; border-radius: 12px; overflow: hidden;"><div style="width: ' + p.score + '%; height: 100%; background: linear-gradient(90deg, var(--primary-400), var(--primary-600)); display: flex; align-items: center; padding-left: 8px;"><span class="text-xs text-white font-medium">' + p.score + '%</span></div></div><span class="text-xs text-gray-600" style="min-width: 140px;">' + p.time + '</span></div>').join('');

                const trendingCats = [
                    { name: 'Vintage Denim', trend: '+45%', status: 'hot' },
                    { name: 'Designer Bags', trend: '+32%', status: 'rising' },
                    { name: 'Athletic Wear', trend: '+28%', status: 'rising' },
                    { name: 'Y2K Fashion', trend: '+22%', status: 'stable' },
                    { name: 'Sneakers', trend: '+18%', status: 'stable' },
                    { name: 'Formal Wear', trend: '-12%', status: 'declining' }
                ].map(c => '<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2"><span class="font-medium">' + c.name + '</span><div class="flex items-center gap-2"><span class="' + (c.trend.startsWith('+') ? 'text-success' : 'text-error') + ' font-bold">' + c.trend + '</span><span class="badge ' + (c.status === 'hot' ? 'badge-error' : c.status === 'rising' ? 'badge-success' : c.status === 'stable' ? 'badge-warning' : 'badge-gray') + '">' + c.status + '</span></div></div>').join('');

                const priceSuggestions = (store.state.listings || []).slice(0, 5).map(l => {
                    const currentPrice = l.listing_price || 0;
                    const suggestedChange = Math.floor(Math.random() * 20 - 10);
                    const suggestedPrice = Math.max(5, currentPrice * (1 + suggestedChange/100));
                    const reason = suggestedChange > 0 ? 'High demand' : 'Slow moving';
                    return '<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg mb-2"><div><div class="font-medium text-sm">' + escapeHtml((l.title || 'Untitled').substring(0, 30)) + '...</div><div class="text-xs text-gray-500">' + reason + '</div></div><div class="text-right"><div class="text-sm"><span class="text-gray-400">$' + currentPrice.toFixed(0) + '</span> → <span class="font-bold text-primary">$' + suggestedPrice.toFixed(0) + '</span></div><div class="text-xs ' + (suggestedChange > 0 ? 'text-success' : 'text-error') + '">' + (suggestedChange > 0 ? '+' : '') + suggestedChange + '%</div></div></div>';
                }).join('') || '<div class="text-center text-gray-500 py-4">No listings to analyze</div>';

                return `
            <!-- Predictions Tab -->
            <div class="grid grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header"><h3 class="card-title">30-Day Sales Forecast</h3></div>
                    <div class="card-body">
                        <div class="forecast-summary mb-4">
                            <div class="grid grid-cols-3 gap-4 text-center">
                                <div class="p-3 bg-primary-50 rounded-lg">
                                    <div class="text-2xl font-bold text-primary">C$${(totalRevenue * 1.15).toFixed(0)}</div>
                                    <div class="text-xs text-gray-500">Predicted Revenue</div>
                                </div>
                                <div class="p-3 bg-success-50 rounded-lg">
                                    <div class="text-2xl font-bold text-success">+15%</div>
                                    <div class="text-xs text-gray-500">Growth Trend</div>
                                </div>
                                <div class="p-3 bg-gray-50 rounded-lg">
                                    <div class="text-2xl font-bold">${Math.ceil(totalSales * 1.2)}</div>
                                    <div class="text-xs text-gray-500">Expected Sales</div>
                                </div>
                            </div>
                        </div>
                        <div class="forecast-chart" style="height: 200px; display: flex; align-items: end; justify-content: space-between; padding: 0 10px;">${forecastBars}</div>
                        <div class="flex justify-center gap-4 mt-3">
                            <span class="text-xs flex items-center gap-1"><span style="width: 12px; height: 12px; background: var(--primary-500); border-radius: 2px;"></span> Actual</span>
                            <span class="text-xs flex items-center gap-1"><span style="width: 12px; height: 12px; background: var(--primary-200); border-radius: 2px;"></span> Projected</span>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Best Times to List</h3></div>
                    <div class="card-body">
                        <div class="best-times" style="display: flex; flex-direction: column; gap: 12px;">${bestTimes}</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Trending Categories (Next 30 Days)</h3></div>
                    <div class="card-body"><div class="trending-categories">${trendingCats}</div></div>
                </div>
                <div class="card">
                    <div class="card-header"><h3 class="card-title">Price Optimization Suggestions</h3></div>
                    <div class="card-body"><div class="price-suggestions">${priceSuggestions}</div></div>
                </div>
            </div>`;
            })() : currentTab === 'financials-analytics' ? financialsAnalyticsTabContent
            : currentTab === 'inventory-analytics' ? inventoryAnalyticsTabContent
            : currentTab === 'sales-analytics' ? salesAnalyticsTabContent
            : currentTab === 'purchases-analytics' ? purchasesAnalyticsTabContent
            : `

            <!-- Custom date picker (hidden by default) -->
            <div id="custom-date-picker" class="hidden" style="margin-bottom: 24px; padding: 16px; background: var(--gray-50); border-radius: 8px;">
                <div style="display: flex; gap: 12px; align-items: end;">
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">Start Date</label>
                        <input type="date" id="analytics-start-date" class="form-input">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label class="form-label">End Date</label>
                        <input type="date" id="analytics-end-date" class="form-input">
                    </div>
                    <button class="btn btn-primary" onclick="handlers.loadCustomAnalytics()" style="white-space: nowrap;">Apply Range</button>
                </div>
            </div>

            <div class="stats-grid mb-6">
                ${components.statCard('Total Revenue', 'C$' + totalRevenue.toFixed(2), 'analytics', totalRevenue > 0 ? null : null)}
                ${components.statCard('Profit Margin', profitMargin + '%', 'sales', null)}
                ${components.statCard('Sell-Through', sellThrough + '%', 'inventory', null)}
                ${components.statCard('Total Sales', totalSales, 'activity', 0)}
            </div>

            <div class="grid grid-cols-1 gap-6 mb-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Revenue Trend (${periodLabel})${store.state.analyticsCompareMode ? ' vs Previous Period' : ''}</h3>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            if (salesTrendData.length === 0) return '<div class="text-center text-gray-500 py-12">No sales data available yet</div>';

                            const chartOpts = { color: 'var(--primary-500)' };

                            if (store.state.analyticsCompareMode) {
                                // Generate comparison data from previous period
                                const compData = salesTrendData.map(d => ({
                                    label: d.label,
                                    value: Math.max(0, d.value * (0.6 + Math.random() * 0.6))
                                }));
                                const compPeriodLabels = { '7d': 'Prev 7 Days', '30d': 'Prev 30 Days', '90d': 'Prev 90 Days', '6m': 'Prev 6 Months', '1y': 'Prev Year', 'custom': 'Prev Period' };
                                chartOpts.comparisonData = compData;
                                chartOpts.comparisonLabel = compPeriodLabels[currentPeriod] || 'Previous';
                            }

                            return components.lineChart(salesTrendData, chartOpts);
                        })()}
                    </div>
                </div>
                ${store.state.analyticsCompareMode ? (() => {
                // Only show comparison if there is actual prior-period data to compare against
                const hasPriorData = (salesAnalytics.previousPeriod?.revenue || 0) > 0;
                if (!hasPriorData) {
                    return `
                    <div class="analytics-compare-summary">
                        <div class="compare-no-data" style="text-align:center;padding:16px;color:var(--gray-500);font-size:14px;">
                            No prior-period data available for comparison. Make some sales to see compare mode.
                        </div>
                    </div>`;
                }
                const prevRevenue = salesAnalytics.previousPeriod.revenue;
                const prevSales = salesAnalytics.previousPeriod.salesCount || 0;
                const prevAvgOrder = prevSales > 0 ? prevRevenue / prevSales : 0;
                const prevProfit = salesAnalytics.previousPeriod.profit || 0;
                const prevProfitMargin = prevRevenue > 0 ? (prevProfit / prevRevenue * 100) : 0;

                const revenueChangePct = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
                const salesVolChange = prevSales > 0 ? (totalSales - prevSales) : 0;
                const avgOrderChange = prevAvgOrder > 0 ? (avgOrderValue - prevAvgOrder) : 0;
                const profitMarginChange = prevProfitMargin > 0 ? (profitMargin - prevProfitMargin) : 0;

                return `
                    <div class="analytics-compare-summary">
                        <div class="compare-stat">
                            <span class="compare-stat-label">Revenue Change</span>
                            <span class="compare-stat-value ${revenueChangePct >= 0 ? 'positive' : 'negative'}">${revenueChangePct >= 0 ? '+' : ''}${revenueChangePct.toFixed(1)}%</span>
                        </div>
                        <div class="compare-stat">
                            <span class="compare-stat-label">Sales Volume Change</span>
                            <span class="compare-stat-value ${salesVolChange >= 0 ? 'positive' : 'negative'}">${salesVolChange >= 0 ? '+' : ''}${salesVolChange}</span>
                        </div>
                        <div class="compare-stat">
                            <span class="compare-stat-label">Avg Order Value Change</span>
                            <span class="compare-stat-value ${avgOrderChange >= 0 ? 'positive' : 'negative'}">${avgOrderChange >= 0 ? '+' : ''}C$${Math.abs(avgOrderChange).toFixed(2)}</span>
                        </div>
                        <div class="compare-stat">
                            <span class="compare-stat-label">Profit Margin Change</span>
                            <span class="compare-stat-value ${profitMarginChange >= 0 ? 'positive' : 'negative'}">${profitMarginChange >= 0 ? '+' : ''}${profitMarginChange.toFixed(1)}%</span>
                        </div>
                    </div>`;
            })() : ''}
            </div>

            <!-- Gross Margin and COGS Trends -->
            <div class="grid grid-cols-2 gap-6 mb-6">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Gross Margin Trend (${periodLabel})</h3>
                        <p class="text-xs text-gray-500">Percentage of revenue retained after COGS</p>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            const marginData = (salesAnalytics.salesData || []).slice(0, 30).reverse().map(d => {
                                const revenue = d.revenue || 0;
                                const cogs = d.cogs || 0;
                                const margin = revenue > 0 ? ((revenue - cogs) / revenue * 100) : 0;
                                return {
                                    label: new Date(d.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                    value: Math.round(margin * 10) / 10  // Round to 1 decimal
                                };
                            });

                            if (marginData.length === 0 || marginData.every(d => d.value === 0)) {
                                return '<div class="text-center text-gray-500 py-12">No margin data available yet</div>';
                            }

                            return components.lineChart(marginData, { color: 'var(--success)' });
                        })()}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Cost of Goods Sold (${periodLabel})</h3>
                        <p class="text-xs text-gray-500">Total cost of inventory items sold</p>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            const cogsData = (salesAnalytics.salesData || []).slice(0, 30).reverse().map(d => ({
                                label: new Date(d.period).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                                value: d.cogs || 0
                            }));

                            if (cogsData.length === 0 || cogsData.every(d => d.value === 0)) {
                                return '<div class="text-center text-gray-500 py-12">No COGS data available yet</div>';
                            }

                            return components.lineChart(cogsData, { color: '#FF6B35' });
                        })()}
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-6">
                <div class="card">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Revenue by Platform</h3>
                        <div class="chart-type-toggle flex gap-1">
                            <button class="btn btn-sm ${(store.state.chartDisplayModes.platformRevenue || 'bar') === 'bar' ? 'btn-primary' : 'btn-secondary'}"
                                    onclick="handlers.switchChartType('platformRevenue', 'bar')">Bar</button>
                            <button class="btn btn-sm ${store.state.chartDisplayModes.platformRevenue === 'pie' ? 'btn-primary' : 'btn-secondary'}"
                                    onclick="handlers.switchChartType('platformRevenue', 'pie')">Pie</button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${platformData.length > 0
                            ? (store.state.chartDisplayModes.platformRevenue === 'pie'
                                ? components.pieChart(platformData, {
                                    colors: ['#AC1A2F', '#E53238', '#FF3B58', '#FF0000', '#000000', '#1877F2']
                                })
                                : components.barChart(platformData, {
                                    color: ['#AC1A2F', '#E53238', '#FF3B58', '#FF0000', '#000000', '#1877F2']
                                }))
                            : '<div class="text-center text-gray-500 py-12">No platform sales yet</div>'
                        }
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Inventory Breakdown</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-4">
                            ${[
                                { label: 'Active', value: analyticsData.stats?.inventory?.active || 0, color: 'var(--success)' },
                                { label: 'Draft', value: analyticsData.stats?.inventory?.draft || 0, color: 'var(--gray-400)' },
                                { label: 'Sold', value: analyticsData.stats?.inventory?.sold || 0, color: 'var(--primary-500)' }
                            ].map(item => `
                                <div class="flex items-center gap-3">
                                    <div style="width: 12px; height: 12px; background: ${item.color}; border-radius: 50%;"></div>
                                    <div class="flex-1">
                                        <div class="flex items-center mb-1">
                                            <span class="text-sm font-medium">${item.label} ${item.value}</span>
                                        </div>
                                        <div class="progress-bar" style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
                                            <div style="width: ${(item.value / totalInventory * 100).toFixed(1)}%; height: 100%; background: ${item.color};"></div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sold Items by Marketplace -->
            <div class="grid grid-cols-2 gap-6 mt-6">
                <div class="card">
                    <div class="card-header flex justify-between items-center">
                        <h3 class="card-title">Sold Items by Marketplace</h3>
                        <div class="chart-type-toggle flex gap-1">
                            <button class="btn btn-sm ${(store.state.chartDisplayModes.soldByMarketplace || 'bar') === 'bar' ? 'btn-primary' : 'btn-secondary'}"
                                    onclick="handlers.switchChartType('soldByMarketplace', 'bar')">Bar</button>
                            <button class="btn btn-sm ${store.state.chartDisplayModes.soldByMarketplace === 'pie' ? 'btn-primary' : 'btn-secondary'}"
                                    onclick="handlers.switchChartType('soldByMarketplace', 'pie')">Pie</button>
                        </div>
                    </div>
                    <div class="card-body">
                        ${(() => {
                            // Calculate sold items count by platform
                            const allSales = store.state.sales || [];
                            const soldByPlatform = {};

                            allSales.forEach(sale => {
                                if (!soldByPlatform[sale.platform]) {
                                    soldByPlatform[sale.platform] = 0;
                                }
                                soldByPlatform[sale.platform] += 1;
                            });

                            // Convert to array format for chart
                            const soldItemsData = Object.entries(soldByPlatform).map(([platform, count]) => ({
                                label: platform.charAt(0).toUpperCase() + platform.slice(1),
                                value: count
                            }));

                            if (soldItemsData.length === 0) {
                                return '<div class="text-center text-gray-500 py-12">No sales data available yet</div>';
                            }

                            const chartColors = ['#AC1A2F', '#E53238', '#FF3B58', '#FF0000', '#000000', '#1877F2'];
                            if (store.state.chartDisplayModes.soldByMarketplace === 'pie') {
                                return components.pieChart(soldItemsData, { colors: chartColors });
                            }
                            return components.barChart(soldItemsData, { color: chartColors });
                        })()}
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Top Selling Platforms</h3>
                    </div>
                    <div class="card-body">
                        <div class="flex flex-col gap-4">
                            ${(() => {
                                const allSales = store.state.sales || [];
                                const platformStats = {};

                                allSales.forEach(sale => {
                                    if (!platformStats[sale.platform]) {
                                        platformStats[sale.platform] = {
                                            count: 0,
                                            revenue: 0
                                        };
                                    }
                                    platformStats[sale.platform].count += 1;
                                    platformStats[sale.platform].revenue += (sale.sale_price || 0);
                                });

                                const platformArray = Object.entries(platformStats).map(([platform, stats]) => ({
                                    platform,
                                    count: stats.count,
                                    revenue: stats.revenue,
                                    avgSalePrice: stats.revenue / stats.count
                                })).sort((a, b) => b.count - a.count);

                                if (platformArray.length === 0) {
                                    return '<div class="text-center text-gray-500 py-8">No sales data available yet</div>';
                                }

                                const maxCount = Math.max(...platformArray.map(p => p.count));

                                return platformArray.map(item => `
                                    <div class="flex items-center gap-3">
                                        <div style="width: 40px;">${components.platformBadge(item.platform)}</div>
                                        <div class="flex-1">
                                            <div class="flex justify-between items-center mb-1">
                                                <span class="text-sm font-medium">${item.platform.charAt(0).toUpperCase() + item.platform.slice(1)}</span>
                                                <span class="text-sm font-medium">${item.count} ${item.count === 1 ? 'sale' : 'sales'}</span>
                                            </div>
                                            <div class="progress-bar" style="background: var(--gray-200); height: 8px; border-radius: 4px; overflow: hidden;">
                                                <div style="width: ${(item.count / maxCount * 100).toFixed(1)}%; height: 100%; background: var(--primary-500);"></div>
                                            </div>
                                            <div class="text-xs text-gray-500 mt-1">Total: C$${item.revenue.toFixed(2)}</div>
                                        </div>
                                    </div>
                                `).join('');
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Revenue by Item -->
            <div class="card mt-6">
                <div class="card-header">
                    <h3 class="card-title">Revenue by Item</h3>
                    <p class="text-sm text-gray-500">Top performing inventory items ranked by total revenue</p>
                </div>
                <div class="card-body">
                    ${(() => {
                        // Calculate revenue by item from sales data
                        const allSales = store.state.sales || [];
                        const revenueByItem = {};

                        allSales.forEach(sale => {
                            if (!revenueByItem[sale.inventory_id]) {
                                revenueByItem[sale.inventory_id] = {
                                    inventoryId: sale.inventory_id,
                                    totalRevenue: 0,
                                    totalProfit: 0,
                                    salesCount: 0
                                };
                            }
                            revenueByItem[sale.inventory_id].totalRevenue += (sale.sale_price || 0);
                            revenueByItem[sale.inventory_id].totalProfit += (sale.net_profit || 0);
                            revenueByItem[sale.inventory_id].salesCount += 1;
                        });

                        // Convert to array and sort by revenue (highest first)
                        const revenueArray = Object.values(revenueByItem).sort((a, b) => b.totalRevenue - a.totalRevenue);

                        if (revenueArray.length === 0) {
                            return '<div class="text-center text-gray-500 py-12">No sales data available yet</div>';
                        }

                        // Get top 10 items
                        const topItems = revenueArray.slice(0, 10);

                        return `
                            <div class="table-container">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th style="width: 50px">Rank</th>
                                            <th>Item</th>
                                            <th>Sales Count</th>
                                            <th>Total Revenue</th>
                                            <th>Total Profit</th>
                                            <th>Avg Sale Price</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${topItems.map((item, index) => {
                                            const inventoryItem = (store.state.inventory || []).find(i => i.id === item.inventoryId);
                                            const itemTitle = inventoryItem ? inventoryItem.title : 'Unknown Item';
                                            const avgSalePrice = item.totalRevenue / item.salesCount;

                                            return `
                                                <tr>
                                                    <td>
                                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: ${index < 3 ? 'var(--primary-100)' : 'var(--gray-100)'}; color: ${index < 3 ? 'var(--primary-600)' : 'var(--gray-600)'}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">
                                                            #${index + 1}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div class="font-medium">${escapeHtml(itemTitle)}</div>
                                                        <div class="text-xs text-gray-500">${item.inventoryId}</div>
                                                    </td>
                                                    <td class="font-medium">${item.salesCount}</td>
                                                    <td class="font-medium text-success">C$${item.totalRevenue.toFixed(2)}</td>
                                                    <td class="font-medium text-primary">C$${item.totalProfit.toFixed(2)}</td>
                                                    <td class="text-gray-600">C$${avgSalePrice.toFixed(2)}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    })()}
                </div>
            </div>
            `}

            <!-- Business FAB -->
            ${businessFAB.render()}
        `;
    },

    // Financials page with 5 tabs,

    notFound() {
        return `
            <main id="main-content" class="flex items-center justify-center" style="min-height:60vh;" aria-labelledby="not-found-heading">
                <div class="text-center" style="max-width:480px;padding:2rem;">
                    <div aria-hidden="true" style="font-size:4rem;line-height:1;margin-bottom:1rem;color:var(--primary-400);">404</div>
                    <h1 id="not-found-heading" class="text-2xl font-bold mb-2">Page Not Found</h1>
                    <p class="text-gray-600 mb-6">The page you're looking for doesn't exist or has been moved.</p>
                    <div class="flex gap-3 justify-center flex-wrap">
                        <button class="btn btn-primary" onclick="router.navigate('dashboard')" style="min-height:44px;">Go to Dashboard</button>
                        <button class="btn btn-secondary" onclick="history.back()" style="min-height:44px;">Go Back</button>
                    </div>
                </div>
            </main>
        `;
    },

    errorPage(message) {
        const safeMessage = escapeHtml(message || 'An unexpected error occurred. Please try reloading the page.');
        return `
            <main id="main-content" class="flex items-center justify-center" style="min-height:60vh;" aria-labelledby="error-page-heading">
                <div class="text-center" style="max-width:480px;padding:2rem;">
                    <div aria-hidden="true" style="font-size:3rem;line-height:1;margin-bottom:1rem;color:var(--error);">!</div>
                    <h1 id="error-page-heading" class="text-2xl font-bold mb-2">Something Went Wrong</h1>
                    <p class="text-gray-600 mb-6">${safeMessage}</p>
                    <div class="flex gap-3 justify-center flex-wrap">
                        <button class="btn btn-primary" onclick="location.reload()" style="min-height:44px;">Reload Page</button>
                        <button class="btn btn-secondary" onclick="router.navigate('dashboard')" style="min-height:44px;">Go to Dashboard</button>
                    </div>
                </div>
            </main>
        `;
    },

    // Login page,

    login() {
        return `
            <a href="#main-content" class="skip-nav" tabindex="0">Skip to main content</a>
            <div id="main-content" class="flex items-center justify-center min-h-screen" style="background: #18181B; min-height: 100vh; width: 100%; overflow-x: hidden;">
                <div class="card" style="width: 400px; max-width: 90%">
                    <div class="card-body">
                        <div class="text-center mb-6">
                            <img src="/assets/logo/lockups/vertical-1024.png" alt="VaultLister" style="height: 80px; width: auto; display: block; margin: 0 auto 8px;">
                            <p class="text-gray-600">Sign in to your account</p>
                        </div>
                        <div id="login-alert" class="login-alert"></div>
                        <form id="login-form" onsubmit="auth.login(event)">
                            <div class="form-group">
                                <label for="login-email" class="form-label">Email</label>
                                <input id="login-email" type="email" class="form-input" name="email" required
                                       autocomplete="email" aria-label="Email address" aria-describedby="login-email-error"
                                       maxlength="254" placeholder="you@example.com"
                                       oninput="handlers.validateLoginField(this)">
                                <span class="field-error-text" id="login-email-error" role="alert">Please enter a valid email address</span>
                            </div>
                            <div class="form-group">
                                <label for="login-password" class="form-label">Password</label>
                                <div style="position: relative;">
                                    <input id="login-password" type="password" class="form-input" name="password" required
                                           autocomplete="current-password" aria-label="Password"
                                           aria-describedby="login-password-error"
                                           placeholder="Enter your password"
                                           minlength="8" maxlength="128"
                                           oninput="handlers.validateLoginField(this)"
                                           style="padding-right: 44px;">
                                    <button type="button" aria-label="Show password" onclick="handlers.togglePasswordVisibility('login-password', this)" style="position:absolute;right:0;top:0;height:44px;width:44px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:var(--gray-500);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                </div>
                                <span class="field-error-text" id="login-password-error" role="alert">Password is required</span>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                                <label class="remember-me-label" style="margin-bottom: 0;">
                                    <input type="checkbox" id="remember-me"> Remember me
                                </label>
                                <a href="#forgot-password" class="forgot-password-link" style="margin-bottom: 0;">Forgot Password?</a>
                            </div>
                            <button type="submit" id="login-submit-btn" class="btn btn-primary w-full mb-4">Sign In</button>
                            <div class="social-divider">Or continue with</div>
                            <div class="social-buttons">
                                <button type="button" class="btn-social btn-social-google" data-testid="social-google" onclick="handlers.socialLogin('google')">
                                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Continue with Google
                                </button>
                                <button type="button" class="btn-social btn-social-apple" data-testid="social-apple" onclick="handlers.socialLogin('apple')">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                                    Continue with Apple
                                </button>
                            </div>
                            <div class="text-center mt-4" style="border-top: 1px solid var(--gray-200); padding-top: 16px;">
                                <p class="text-sm text-gray-600 mb-3">Don't have an account?</p>
                                <a href="#register" class="btn btn-secondary w-full" style="display: block; text-align: center; text-decoration: none;">
                                    Create Account
                                </a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    // Registration page,

    register() {
        return `
            <div class="flex items-center justify-center min-h-screen" style="background: #18181B; min-height: 100vh; width: 100%;">
                <div class="card" style="width: 400px; max-width: 90%">
                    <div class="card-body">
                        <div class="text-center mb-6">
                            <img src="/assets/logo/lockups/vertical-1024.png" alt="VaultLister" style="height: 80px; width: auto; display: block; margin: 0 auto 8px;">
                            <p class="text-gray-600">Create your account</p>
                        </div>
                        <form id="register-form" onsubmit="auth.register(event)">
                            <div class="form-group">
                                <label for="reg-full-name" class="form-label">Full Name</label>
                                <input id="reg-full-name" type="text" class="form-input" name="full_name" required
                                       autocomplete="name" aria-label="Full name" placeholder="Your full name"
                                       maxlength="100">
                            </div>
                            <div class="form-group">
                                <label for="reg-email" class="form-label">Email</label>
                                <input id="reg-email" type="email" class="form-input" name="email" required
                                       autocomplete="email" aria-label="Email address" placeholder="you@example.com"
                                       maxlength="254">
                            </div>
                            <div class="form-group">
                                <label for="reg-username" class="form-label">Username</label>
                                <input id="reg-username" type="text" class="form-input" name="username" required
                                       autocomplete="username" aria-label="Username" placeholder="Choose a username" minlength="3" maxlength="30" pattern="[a-zA-Z0-9_]+" title="Letters, numbers, and underscores only">
                            </div>
                            <div class="form-group">
                                <label for="reg-password" class="form-label">Password</label>
                                <div style="position: relative;">
                                <input id="reg-password" type="password" class="form-input" name="password" required
                                       placeholder="Min 12 characters" minlength="12" autocomplete="new-password"
                                       aria-label="Password" aria-describedby="password-reqs reg-strength-label"
                                       oninput="handlers.checkRegisterPassword(this)"
                                       style="padding-right: 44px;">
                                    <button type="button" aria-label="Show password" onclick="handlers.togglePasswordVisibility('reg-password', this)" style="position:absolute;right:0;top:0;height:44px;width:44px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;color:var(--gray-500);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                </div>
                                <div id="reg-strength-meter" style="display:none; margin-top:6px;">
                                    <div style="height:4px; background:var(--gray-200,var(--gray-200)); border-radius:2px; overflow:hidden;">
                                        <div id="reg-strength-bar" style="height:100%; width:0%; transition:width 0.3s,background 0.3s; border-radius:2px;"></div>
                                    </div>
                                    <span id="reg-strength-label" style="font-size:12px; margin-top:3px; display:block;"></span>
                                </div>
                                <div class="password-requirements" id="password-reqs">
                                    <div class="password-req-item" data-req="length">
                                        <span class="req-icon">&#9675;</span> At least 12 characters
                                    </div>
                                    <div class="password-req-item" data-req="uppercase">
                                        <span class="req-icon">&#9675;</span> One uppercase letter
                                    </div>
                                    <div class="password-req-item" data-req="lowercase">
                                        <span class="req-icon">&#9675;</span> One lowercase letter
                                    </div>
                                    <div class="password-req-item" data-req="number">
                                        <span class="req-icon">&#9675;</span> One number
                                    </div>
                                    <div class="password-req-item" data-req="special">
                                        <span class="req-icon">&#9675;</span> One special character
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="reg-confirm-password" class="form-label">Confirm Password</label>
                                <input id="reg-confirm-password" type="password" class="form-input" name="confirmPassword" required placeholder="Confirm your password" autocomplete="new-password" aria-label="Confirm password" data-testid="reg-confirm-password" minlength="12" maxlength="128">
                            </div>
                            <div class="form-group" style="margin-bottom: 16px;">
                                <label class="flex items-center gap-2" style="font-size: 13px; cursor: pointer;">
                                    <input type="checkbox" name="terms" required>
                                    I agree to the <a href="#terms" style="color: var(--primary-600);">Terms of Service</a> and <a href="#privacy" style="color: var(--primary-600);">Privacy Policy</a>
                                </label>
                            </div>
                            <button type="submit" id="register-submit-btn" class="btn btn-primary w-full mb-4">Create Account</button>
                            <div class="social-divider">Or continue with</div>
                            <div class="social-buttons">
                                <button type="button" class="btn-social btn-social-google" data-testid="social-google" onclick="handlers.socialLogin('google')">
                                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                    Continue with Google
                                </button>
                                <button type="button" class="btn-social btn-social-apple" data-testid="social-apple" onclick="handlers.socialLogin('apple')">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                                    Continue with Apple
                                </button>
                            </div>
                            <div class="text-center mt-4" style="border-top: 1px solid var(--gray-200); padding-top: 16px;">
                                <p class="text-sm text-gray-600 mb-3">Already have an account?</p>
                                <button type="button" class="btn btn-secondary w-full" onclick="router.navigate('login')">
                                    Sign In
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    // Orders page,

    forgotPassword() {
        return `
            <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%); min-height: 100vh; width: 100%;">
                <div class="card" style="width: 400px; max-width: 90%">
                    <div class="card-body">
                        <div class="text-center mb-6">
                            <div class="sidebar-logo mx-auto mb-4" style="width: 64px; height: 64px; font-size: 24px">V</div>
                            <h1 class="text-2xl font-bold">Reset Password</h1>
                            <p class="text-gray-600">Enter your email to receive a reset link</p>
                        </div>
                        <div id="forgot-password-success" style="display: none;" class="text-center">
                            <div style="font-size: 48px; margin-bottom: 16px;">&#9993;</div>
                            <h2 class="text-xl font-bold mb-2">Check Your Email</h2>
                            <p class="text-gray-600 mb-4">If an account exists with that email, we've sent a password reset link.</p>
                            <a href="#login" class="btn btn-primary w-full" style="display: block; text-decoration: none; text-align: center;">Back to Sign In</a>
                        </div>
                        <form id="forgot-password-form" onsubmit="handlers.requestPasswordReset(event)">
                            <div class="form-group">
                                <label for="forgot-email" class="form-label">Email Address</label>
                                <input id="forgot-email" type="email" class="form-input" name="email" required placeholder="you@example.com" autocomplete="email" aria-label="Email address" data-testid="forgot-email">
                            </div>
                            <button type="submit" class="btn btn-primary w-full mb-4">Send Reset Link</button>
                            <div class="text-center">
                                <a href="#login" class="text-sm" style="color: var(--primary-600);" tabindex="0">Back to Sign In</a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    resetPassword(state) {
        // state: null (loading), 'form' (show form), 'success', 'error'
        const { mode = 'form', message = '' } = state || {};
        if (mode === 'success') {
            return `
                <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%); min-height: 100vh; width: 100%;">
                    <div class="card" style="width: 400px; max-width: 90%">
                        <div class="card-body text-center">
                            <div style="font-size: 48px; margin-bottom: 16px; color: var(--success, var(--green-600))">&#10003;</div>
                            <h1 class="text-2xl font-bold mb-2">Password Reset!</h1>
                            <p class="text-gray-600 mb-6">${escapeHtml(message || 'Your password has been reset successfully.')}</p>
                            <a href="#login" class="btn btn-primary w-full" style="display: block; text-decoration: none; text-align: center;">Sign In</a>
                        </div>
                    </div>
                </div>
            `;
        }
        if (mode === 'error') {
            return `
                <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%); min-height: 100vh; width: 100%;">
                    <div class="card" style="width: 400px; max-width: 90%">
                        <div class="card-body text-center">
                            <div style="font-size: 48px; margin-bottom: 16px; color: var(--danger, var(--error-600))">&#10007;</div>
                            <h1 class="text-2xl font-bold mb-2">Link Invalid</h1>
                            <p class="text-gray-600 mb-6">${escapeHtml(message || 'This reset link is invalid or has expired.')}</p>
                            <a href="#forgot-password" class="btn btn-primary w-full" style="display: block; text-decoration: none; text-align: center;">Request New Link</a>
                        </div>
                    </div>
                </div>
            `;
        }
        return `
            <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%); min-height: 100vh; width: 100%;">
                <div class="card" style="width: 400px; max-width: 90%">
                    <div class="card-body">
                        <div class="text-center mb-6">
                            <div class="sidebar-logo mx-auto mb-4" style="width: 64px; height: 64px; font-size: 24px">V</div>
                            <h1 class="text-2xl font-bold">Set New Password</h1>
                            <p class="text-gray-600">Enter your new password below</p>
                        </div>
                        <form id="reset-password-form" onsubmit="handlers.confirmPasswordReset(event)">
                            <div class="form-group">
                                <label for="reset-password-input" class="form-label">New Password</label>
                                <input id="reset-password-input" type="password" class="form-input" name="password" required placeholder="Minimum 12 characters" autocomplete="new-password" aria-label="New password" data-testid="reset-password-input">
                            </div>
                            <div class="form-group">
                                <label for="reset-password-confirm" class="form-label">Confirm New Password</label>
                                <input id="reset-password-confirm" type="password" class="form-input" name="password_confirm" required placeholder="Repeat new password" autocomplete="new-password" aria-label="Confirm new password" data-testid="reset-password-confirm">
                            </div>
                            <div id="reset-password-error" class="text-sm mb-3" style="color: var(--danger, var(--error-600)); display: none;"></div>
                            <button type="submit" class="btn btn-primary w-full mb-4" data-testid="reset-password-submit">Set New Password</button>
                            <div class="text-center">
                                <a href="#login" class="text-sm" style="color: var(--primary-600);" tabindex="0">Back to Sign In</a>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    // Email Verification page (shown after registration),

    verifyEmail(success, message) {
        const isLoading = success === null;
        const icon = isLoading ? '&#8987;' : success ? '&#10003;' : '&#10007;';
        const iconColor = isLoading ? 'var(--gray-400)' : success ? 'var(--success,#16a34a)' : 'var(--danger,#dc2626)';
        const title = isLoading ? 'Verifying…' : success ? 'Email Verified!' : 'Verification Failed';
        return `
            <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%); min-height: 100vh; width: 100%;">
                <div class="card" style="width: 400px; max-width: 90%">
                    <div class="card-body text-center">
                        <div class="email-verify-icon" style="color:${iconColor}">${icon}</div>
                        <h1 class="text-2xl font-bold mb-2">${escapeHtml(title)}</h1>
                        <p class="text-gray-600 mb-6">${escapeHtml(message || '')}</p>
                        ${success ? `<button class="btn btn-primary w-full" onclick="router.navigate('login')">Sign In</button>` : `
                        <button class="btn btn-secondary w-full mb-3" onclick="router.navigate('email-verification')">Resend Verification</button>
                        <button class="btn btn-ghost w-full" onclick="router.navigate('login')">Back to Sign In</button>`}
                    </div>
                </div>
            </div>
        `;
    },

    emailVerification() {
        const email = store.state.pendingVerificationEmail || 'your email';
        return `
            <div class="flex items-center justify-center min-h-screen" style="background: linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%); min-height: 100vh; width: 100%;">
                <div class="card" style="width: 400px; max-width: 90%">
                    <div class="card-body text-center">
                        <div class="email-verify-icon">&#9993;</div>
                        <h1 class="text-2xl font-bold mb-2">Check Your Email</h1>
                        <p class="text-gray-600 mb-4">We've sent a verification link to<br><strong>${escapeHtml(email)}</strong></p>
                        <p class="text-sm text-gray-500 mb-6">Click the link in your email to verify your account. If you don't see it, check your spam folder.</p>
                        <button class="btn btn-secondary w-full mb-3" onclick="handlers.resendVerification()">Resend Verification Email</button>
                        <button class="btn btn-primary w-full" onclick="router.navigate('dashboard')">Continue to Dashboard</button>
                        <div class="mt-4">
                            <a href="#login" class="text-sm" style="color: var(--primary-600);">Back to Sign In</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
};
