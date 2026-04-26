'use strict';
// Route-group chunk: admin (pages)

Object.assign(pages, {
    adminFeatureFlags() {
        const user = store.state.user;
        if (!user || !user.is_admin) {
            return `
                <div class="page-header">
                    <h1 class="page-title">Feature Flags</h1>
                </div>
                <div class="card">
                    <div class="card-body text-center" style="padding: 48px;">
                        <h2 style="margin-bottom: 8px;">Access Denied</h2>
                        <p style="color: var(--text-secondary);">Admin access is required.</p>
                        <button class="btn btn-primary mt-4" onclick="router.navigate('dashboard')">Back to Dashboard</button>
                    </div>
                </div>
            `;
        }

        const flags = store.state.featureFlags || null;
        const isLoading = store.state.featureFlagsLoading;

        const categoryLabel = (name) => {
            const prefix = name.split('.')[0];
            const labels = { ui: 'UI', automation: 'Automation', ai: 'AI', integration: 'Integration', beta: 'Beta', perf: 'Performance' };
            return labels[prefix] || prefix;
        };

        const categoryColor = (name) => {
            const prefix = name.split('.')[0];
            const colors = { ui: 'badge-info', automation: 'badge-warning', ai: 'badge-success', integration: 'badge-primary', beta: 'badge-danger', perf: 'badge-secondary' };
            return colors[prefix] || 'badge-secondary';
        };

        return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Feature Flags</h1>
                    <p class="page-description">Enable or disable features without a deployment. Changes persist to the database.</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-secondary" onclick="handlers.loadFeatureFlags()" aria-label="Refresh feature flags" ${isLoading ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                        ${isLoading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            ${isLoading && !flags ? `
                <div style="display:flex;align-items:center;gap:12px;padding:24px 0;color:var(--text-secondary);">
                    <div class="loading-spinner"></div>
                    <span>Loading flags...</span>
                </div>
            ` : ''}

            ${!flags && !isLoading ? `
                <div class="card">
                    <div class="card-body text-center" style="padding: 48px; color: var(--text-secondary);">
                        No feature flag data. <button class="btn btn-primary btn-sm" onclick="handlers.loadFeatureFlags()">Load Flags</button>
                    </div>
                </div>
            ` : ''}

            ${flags ? (() => {
                const entries = Object.entries(flags);
                if (entries.length === 0) {
                    return `<div class="card"><div class="card-body" style="padding:32px;text-align:center;color:var(--text-secondary);">No flags defined.</div></div>`;
                }
                return `
                    <div class="card">
                        <div class="card-body" style="padding: 0;">
                            <table class="table" aria-label="Feature flags">
                                <thead>
                                    <tr>
                                        <th>Flag</th>
                                        <th>Category</th>
                                        <th style="text-align:right;">Rollout</th>
                                        <th style="text-align:center;">Enabled</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${entries.map(([name, config]) => {
                                        const enabled = config?.enabled ?? false;
                                        const rollout = config?.rolloutPercentage ?? 100;
                                        const safeId = escapeHtml(name).replace(/\./g, '-');
                                        return `
                                            <tr>
                                                <td>
                                                    <code style="font-size:13px;color:var(--primary-600);">${escapeHtml(name)}</code>
                                                    ${config?.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(config.description)}</div>` : ''}
                                                </td>
                                                <td><span class="badge ${categoryColor(name)}" style="font-size:11px;">${escapeHtml(categoryLabel(name))}</span></td>
                                                <td style="text-align:right;font-variant-numeric:tabular-nums;">${rollout}%</td>
                                                <td style="text-align:center;">
                                                    <label class="toggle-switch" aria-label="Toggle ${escapeHtml(name)}">
                                                        <input type="checkbox" id="ff-${safeId}"
                                                            ${enabled ? 'checked' : ''}
                                                            onchange="handlers.toggleFeatureFlag('${escapeHtml(name)}', this.checked)"
                                                        >
                                                        <span class="toggle-slider"></span>
                                                    </label>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            })() : ''}
        `;
    },

    adminBusinessMetrics() {
        const user = store.state.user;
        if (!(user?.is_admin || user?.role === 'admin')) {
            return `
                <div class="page-header">
                    <h1 class="page-title">Metrics Dashboard</h1>
                </div>
                <div class="card">
                    <div class="card-body text-center" style="padding: 48px;">
                        <div style="margin-bottom: 16px; color: var(--danger);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <h2 style="margin-bottom: 8px;">Access Denied</h2>
                        <p style="color: var(--text-secondary);">You do not have permission to view this page. Admin access is required.</p>
                        <button class="btn btn-primary mt-4" onclick="router.navigate('dashboard')">Back to Dashboard</button>
                    </div>
                </div>
            `;
        }

        const bm = store.state.businessMetrics;
        const bmLoading = store.state.businessMetricsLoading;

        if (!bm && !bmLoading) {
            setTimeout(() => handlers.loadBusinessMetrics(), 0);
        }

        const luStr = bm?.lastUpdated
            ? new Date(bm.lastUpdated).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Edmonton' })
            : 'Loading…';

        // Helper: derive traffic-light status from value vs target
        const statusFromVal = (val, target, dir = 'gte') => {
            if (val == null) return 'Watch';
            if (dir === 'gte') return val >= target ? 'On Target' : val >= target * 0.7 ? 'Watch' : 'Action Needed';
            return val <= target ? 'On Target' : val <= target * 1.5 ? 'Watch' : 'Action Needed';
        };
        const fmtPct = (n) => n != null ? `${n}%` : '—';
        const fmtN   = (n) => n != null ? String(n) : '—';

        // Real metrics (null when not yet loaded)
        const acq  = bm?.acquisition  || {};
        const actv = bm?.activation   || {};
        const conv = bm?.conversion   || {};
        const ret  = bm?.retention    || {};
        const abus = bm?.abuse        || {};

        // Mock data definitions with status evaluation
        const mkRow = (metric, current, target, status, checkpoint) => {
            const badgeClass = status === 'On Target' ? 'badge-success' : status === 'Watch' ? 'badge-warning' : 'badge-danger';
            return `
                <tr style="border-bottom: 1px solid var(--gray-100);">
                    <td style="padding: 10px 16px; font-size: 13px; font-weight: 500;">${escapeHtml(metric)}</td>
                    <td style="padding: 10px 16px; text-align: center; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;">${escapeHtml(current)}</td>
                    <td style="padding: 10px 16px; text-align: center;"><span class="badge badge-success" style="font-size: 11px;">${escapeHtml(target)}</span></td>
                    <td style="padding: 10px 16px; text-align: center;"><span class="badge ${badgeClass}" style="font-size: 11px;">${escapeHtml(status)}</span></td>
                    <td style="padding: 10px 16px; font-size: 11px; color: var(--text-secondary);">${escapeHtml(checkpoint)}</td>
                </tr>
            `;
        };

        const mkTable = (rows) => `
            <div class="card-body" style="padding:0;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;" role="table">
                    <thead>
                        <tr style="border-bottom:1px solid var(--gray-200); background:var(--gray-50);">
                            <th style="padding:10px 16px; text-align:left; color:var(--gray-600); font-weight:600; font-size:12px;">Metric</th>
                            <th style="padding:10px 16px; text-align:center; color:var(--gray-600); font-weight:600; font-size:12px;">Current</th>
                            <th style="padding:10px 16px; text-align:center; color:var(--gray-600); font-weight:600; font-size:12px;">Target</th>
                            <th style="padding:10px 16px; text-align:center; color:var(--gray-600); font-weight:600; font-size:12px;">Status</th>
                            <th style="padding:10px 16px; text-align:left; color:var(--gray-600); font-weight:600; font-size:12px;">Failure Checkpoint</th>
                        </tr>
                    </thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        `;

        const categories = [
            {
                id: 'acquisition',
                label: 'Acquisition',
                icon: 'users',
                rows: [
                    mkRow('New Signups (30d)', fmtN(acq.newUsers30d), '≥ 10', statusFromVal(acq.newUsers30d, 10), '<5/mo — investigate landing page and referral sources'),
                    mkRow('MoM Growth Rate', fmtPct(acq.growthRate), '≥ 20%', statusFromVal(acq.growthRate, 20), '<0% — review channels, ads, SEO'),
                ]
            },
            {
                id: 'activation',
                label: 'Activation',
                icon: 'zap',
                rows: [
                    mkRow('Listed Within 7d of Signup (%)', fmtPct(actv.activationRate), '≥ 50%', statusFromVal(actv.activationRate, 50), '<20% — onboarding flow issue'),
                    mkRow('Marketplace Connected Within 7d (%)', fmtPct(actv.connectionRate), '≥ 30%', statusFromVal(actv.connectionRate, 30), '<10% — connection flow broken or confusing'),
                ]
            },
            {
                id: 'conversion',
                label: 'Conversion',
                icon: 'dollar',
                rows: [
                    mkRow('Paid Users (% of total)', fmtPct(conv.paidConvRate), '≥ 5%', statusFromVal(conv.paidConvRate, 5), '<2% — pricing page or trial experience issue'),
                    mkRow('Total Paid Users', fmtN(conv.paidUsers), '≥ 1', statusFromVal(conv.paidUsers, 1), '0 — no conversions yet'),
                ]
            },
            {
                id: 'retention',
                label: 'Retention',
                icon: 'refresh-cw',
                rows: [
                    mkRow('DAU/MAU Ratio', fmtPct(ret.dauMauRatio), '≥ 20%', statusFromVal(ret.dauMauRatio, 20), '<5% — engagement or value problem'),
                    mkRow('Daily Active Users', fmtN(ret.dau), '≥ 5', statusFromVal(ret.dau, 5), '0 — no active sessions today'),
                ]
            },
            {
                id: 'abuse',
                label: 'Abuse',
                icon: 'alert-triangle',
                rows: [
                    mkRow('Unverified Signups (30d)', fmtN(abus.unverifiedSignups30d), '≤ 20% of new', statusFromVal(abus.unverifiedSignups30d, (acq.newUsers30d || 0) * 0.2, 'lte'), '>50% of signups unverified — add friction or email verification gate'),
                    mkRow('Monthly Active Users (30d)', fmtN(ret.mau), '≥ 5', statusFromVal(ret.mau, 5), '0 — no user activity tracked'),
                ]
            }
        ];

        const allStatuses = categories.flatMap(c => c.rows.map(r => {
            const m = r.match(/badge-(success|warning|danger)/);
            return m ? m[1] : 'warning';
        }));
        const totalMetrics = allStatuses.length;
        const onTargetCount = allStatuses.filter(s => s === 'success').length;
        const watchCount = allStatuses.filter(s => s === 'warning').length;
        const actionNeededCount = allStatuses.filter(s => s === 'danger').length;

        const iconSvg = (name, size = 16) => {
            const icons = {
                'users': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
                'zap': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
                'dollar': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
                'refresh-cw': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
                'alert-triangle': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
                'bar-chart': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
            };
            return icons[name] || '';
        };

        return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Metrics Dashboard</h1>
                    <p class="page-description">Internal business health metrics — admin only</p>
                </div>
                <div class="page-actions" style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:12px; color:var(--text-secondary);">Last updated: ${escapeHtml(luStr)}</span>
                    <button class="btn btn-secondary btn-sm" onclick="handlers.loadBusinessMetrics()" aria-label="Refresh business metrics">${bmLoading ? 'Loading…' : 'Refresh'}</button>
                    <button class="btn btn-secondary btn-sm" onclick="router.navigate('admin-metrics')" aria-label="Go to system health metrics">System Health</button>
                </div>
            </div>

            <!-- Summary card -->
            <div class="card mb-6" aria-labelledby="bm-summary-title">
                <div class="card-header">
                    <h2 class="card-title" id="bm-summary-title">${iconSvg('bar-chart', 18)} Summary</h2>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-4 gap-4">
                        <div style="padding:16px; background:var(--gray-50); border-radius:8px; text-align:center;">
                            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;">Total Metrics</div>
                            <div style="font-size:32px; font-weight:700;">${totalMetrics}</div>
                        </div>
                        <div style="padding:16px; background:var(--success-50,var(--green-50)); border-radius:8px; text-align:center;">
                            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;">On Target</div>
                            <div style="font-size:32px; font-weight:700; color:var(--success);">${onTargetCount}</div>
                        </div>
                        <div style="padding:16px; background:var(--warning-50,var(--primary-50)); border-radius:8px; text-align:center;">
                            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;">Watch</div>
                            <div style="font-size:32px; font-weight:700; color:var(--warning);">${watchCount}</div>
                        </div>
                        <div style="padding:16px; background:var(--danger-50,var(--error-50)); border-radius:8px; text-align:center;">
                            <div style="font-size:12px; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em;">Action Needed</div>
                            <div style="font-size:32px; font-weight:700; color:var(--danger);">${actionNeededCount}</div>
                        </div>
                    </div>
                </div>
            </div>

            ${categories.map(cat => `
            <div class="card mb-6" aria-labelledby="bm-${escapeHtml(cat.id)}-title">
                <div class="card-header">
                    <h2 class="card-title" id="bm-${escapeHtml(cat.id)}-title" style="display:flex; align-items:center; gap:8px;">
                        ${iconSvg(cat.icon, 18)} ${escapeHtml(cat.label)}
                    </h2>
                </div>
                ${mkTable(cat.rows)}
            </div>
            `).join('')}

        `;
    },

    adminMetrics() {
        const user = store.state.user;
        if (!user || !user.is_admin) {
            return `
                <div class="page-header">
                    <h1 class="page-title">Admin Metrics</h1>
                </div>
                <div class="card">
                    <div class="card-body text-center" style="padding: 48px;">
                        <div style="margin-bottom: 16px; color: var(--danger);">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                        </div>
                        <h2 style="margin-bottom: 8px;">Access Denied</h2>
                        <p style="color: var(--text-secondary);">You do not have permission to view this page. Admin access is required.</p>
                        <button class="btn btn-primary mt-4" onclick="router.navigate('dashboard')">Back to Dashboard</button>
                    </div>
                </div>
            `;
        }

        const metrics = store.state.adminMetrics || null;
        const alerts = store.state.adminAlerts || [];
        const errors = store.state.adminErrors || [];
        const securityEvents = store.state.adminSecurityEvents || null;
        const isLoading = store.state.adminMetricsLoading;

        const formatUptime = (seconds) => {
            if (!seconds && seconds !== 0) return '--';
            const d = Math.floor(seconds / 86400);
            const h = Math.floor((seconds % 86400) / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            if (d > 0) return `${d}d ${h}h ${m}m`;
            if (h > 0) return `${h}h ${m}m`;
            return `${m}m`;
        };

        const formatBytes = (bytes) => {
            if (!bytes && bytes !== 0) return '--';
            if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
            if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
            if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return bytes + ' B';
        };

        const formatTimestamp = (ts) => {
            if (!ts) return '--';
            const d = new Date(ts);
            if (isNaN(d.getTime())) return '--';
            return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        };

        const summary = metrics?.summary || {};
        const endpoints = metrics?.endpoints || [];
        const system = metrics?.system || {};
        const wsStats = metrics?.websocket || null;

        const cpuPct = system.cpu != null ? Math.round(system.cpu) : null;
        const memUsed = system.memoryUsed != null ? system.memoryUsed : null;
        const memTotal = system.memoryTotal != null ? system.memoryTotal : null;
        const memRss = system.memoryRss != null ? system.memoryRss : null;
        const memPct = (memUsed != null && memTotal && memTotal > 0) ? Math.round((memUsed / memTotal) * 100) : null;
        const uptimeSeconds = system.uptime != null ? system.uptime : null;

        const totalRequests = summary.totalRequests != null ? summary.totalRequests.toLocaleString() : '--';
        const totalErrors = summary.totalErrors != null ? summary.totalErrors.toLocaleString() : '--';
        const avgResponseTime = summary.avgResponseTime != null ? parseFloat(summary.avgResponseTime).toFixed(1) + ' ms' : '--';
        const errorRate = (summary.totalRequests && summary.totalErrors != null)
            ? ((summary.totalErrors / summary.totalRequests) * 100).toFixed(1) + '%'
            : '--';

        const healthStatusColor = (status) => {
            if (!status) return 'var(--gray-400)';
            if (status === 'healthy') return 'var(--success)';
            if (status === 'degraded') return 'var(--warning)';
            return 'var(--danger)';
        };

        const alertSeverityBadge = (type) => {
            const t = (type || '').toLowerCase();
            if (t.includes('critical') || t.includes('error')) return 'badge-danger';
            if (t.includes('warn')) return 'badge-warning';
            return 'badge-info';
        };

        const secCounters = securityEvents?.counters || {};
        const recentSecEvents = securityEvents?.recentEvents || [];

        return `
            <div class="page-header">
                <div>
                    <h1 class="page-title">Admin Metrics</h1>
                    <p class="page-description">System health, performance, and security monitoring</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-secondary" onclick="handlers.refreshAdminMetrics()" aria-label="Refresh metrics" ${isLoading ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                        </svg>
                        ${isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <!-- Admin Tools Quick Links -->
            <div class="card mb-6" aria-label="Admin tools">
                <div class="card-body" style="display:flex; gap:12px; flex-wrap:wrap; padding:16px;">
                    <button class="btn btn-secondary btn-sm" onclick="router.navigate('admin-business-metrics')" aria-label="View business health metrics" style="min-height:44px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="margin-right:6px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
                        Metrics Dashboard
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="handlers.loadFeatureFlags()" aria-label="View feature flags" style="min-height:44px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="margin-right:6px;"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                        Feature Flags
                    </button>
                </div>
            </div>

            ${isLoading && !metrics ? `
                <div style="display:flex;align-items:center;gap:12px;padding:24px 0;color:var(--text-secondary);">
                    <div class="loading-spinner"></div>
                    <span>Loading metrics...</span>
                </div>
            ` : ''}

            <!-- System Health Card -->
            <div class="card mb-6" aria-labelledby="system-health-title">
                <div class="card-header">
                    <h2 class="card-title" id="system-health-title">System Health</h2>
                    ${metrics ? `
                        <span style="color: ${healthStatusColor(metrics.status)}; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${healthStatusColor(metrics.status)}; display: inline-block;" aria-hidden="true"></span>
                            ${escapeHtml((metrics.status || 'unknown').charAt(0).toUpperCase() + (metrics.status || 'unknown').slice(1))}
                        </span>
                    ` : ''}
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-4 gap-4">
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">CPU Usage</div>
                            <div style="font-size: 28px; font-weight: 700; color: ${cpuPct != null && cpuPct > 80 ? 'var(--danger)' : cpuPct != null && cpuPct > 60 ? 'var(--warning)' : 'var(--text-primary)'};">
                                ${cpuPct != null ? cpuPct + '%' : '--'}
                            </div>
                            ${cpuPct != null ? `
                                <div style="margin-top: 8px; height: 4px; background: var(--gray-200); border-radius: 2px; overflow: hidden;" role="progressbar" aria-valuenow="${cpuPct}" aria-valuemin="0" aria-valuemax="100" aria-label="CPU usage">
                                    <div style="height: 100%; width: ${cpuPct}%; background: ${cpuPct > 80 ? 'var(--danger)' : cpuPct > 60 ? 'var(--warning)' : 'var(--success)'}; border-radius: 2px;"></div>
                                </div>
                            ` : ''}
                        </div>
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Memory</div>
                            <div style="font-size: 28px; font-weight: 700; color: ${memPct != null && memPct > 85 ? 'var(--danger)' : memPct != null && memPct > 70 ? 'var(--warning)' : 'var(--text-primary)'};">
                                ${memPct != null ? memPct + '%' : '--'}
                            </div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                                ${memUsed != null ? formatBytes(memUsed) : '--'} used / ${memRss != null ? formatBytes(memRss) : '--'} RSS
                            </div>
                            ${memPct != null ? `
                                <div style="margin-top: 8px; height: 4px; background: var(--gray-200); border-radius: 2px; overflow: hidden;" role="progressbar" aria-valuenow="${memPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Memory usage">
                                    <div style="height: 100%; width: ${memPct}%; background: ${memPct > 85 ? 'var(--danger)' : memPct > 70 ? 'var(--warning)' : 'var(--success)'}; border-radius: 2px;"></div>
                                </div>
                            ` : ''}
                        </div>
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Uptime</div>
                            <div style="font-size: 28px; font-weight: 700;">${formatUptime(uptimeSeconds)}</div>
                            ${system.startedAt ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Since ${formatTimestamp(system.startedAt)}</div>` : ''}
                        </div>
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">WebSocket Connections</div>
                            <div style="font-size: 28px; font-weight: 700;">${wsStats != null ? wsStats.totalConnections : '--'}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${wsStats != null ? `${wsStats.connectedUsers} user${wsStats.connectedUsers !== 1 ? 's' : ''}, ${wsStats.rooms} room${wsStats.rooms !== 1 ? 's' : ''}` : ''}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Request Metrics Card -->
            <div class="card mb-6" aria-labelledby="request-metrics-title">
                <div class="card-header">
                    <h2 class="card-title" id="request-metrics-title">Request Metrics</h2>
                </div>
                <div class="card-body">
                    <div class="grid grid-cols-4 gap-4">
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px; text-align: center;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Total Requests</div>
                            <div style="font-size: 28px; font-weight: 700;">${totalRequests}</div>
                        </div>
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px; text-align: center;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Total Errors</div>
                            <div style="font-size: 28px; font-weight: 700; color: ${summary.totalErrors > 0 ? 'var(--danger)' : 'var(--text-primary)'};">${totalErrors}</div>
                        </div>
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px; text-align: center;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Avg Response</div>
                            <div style="font-size: 28px; font-weight: 700;">${avgResponseTime}</div>
                        </div>
                        <div style="padding: 16px; background: var(--gray-50); border-radius: 8px; text-align: center;">
                            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Error Rate</div>
                            <div style="font-size: 28px; font-weight: 700; color: ${parseFloat(errorRate) > 5 ? 'var(--danger)' : parseFloat(errorRate) > 1 ? 'var(--warning)' : 'var(--text-primary)'};">${errorRate}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Endpoints Card -->
            <div class="card mb-6" aria-labelledby="top-endpoints-title">
                <div class="card-header">
                    <h2 class="card-title" id="top-endpoints-title">Top Endpoints by Request Count</h2>
                </div>
                <div class="card-body" style="padding: 0;">
                    ${endpoints.length === 0 ? `
                        <div style="padding: 32px; text-align: center; color: var(--text-secondary);">
                            No endpoint data available.
                        </div>
                    ` : `
                        <div style="overflow-x: auto;">
                            <table class="table" aria-label="Top endpoints by request count">
                                <thead>
                                    <tr>
                                        <th>Endpoint</th>
                                        <th style="text-align: right;">Requests</th>
                                        <th style="text-align: right;">Errors</th>
                                        <th style="text-align: right;">Avg Response</th>
                                        <th style="text-align: right;">Error Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${endpoints.slice(0, 15).map(ep => {
                                        const epErrorRate = ep.requests > 0 ? ((ep.errors / ep.requests) * 100).toFixed(1) : '0.0';
                                        const epAvg = ep.avgResponseTime != null ? parseFloat(ep.avgResponseTime).toFixed(0) + ' ms' : '--';
                                        return `
                                            <tr>
                                                <td><code style="font-size: 13px; color: var(--primary-600);">${escapeHtml(ep.endpoint || '--')}</code></td>
                                                <td style="text-align: right; font-variant-numeric: tabular-nums;">${(ep.requests || 0).toLocaleString()}</td>
                                                <td style="text-align: right; font-variant-numeric: tabular-nums; color: ${ep.errors > 0 ? 'var(--danger)' : 'inherit'};">${(ep.errors || 0).toLocaleString()}</td>
                                                <td style="text-align: right; font-variant-numeric: tabular-nums;">${epAvg}</td>
                                                <td style="text-align: right;">
                                                    <span style="color: ${parseFloat(epErrorRate) > 5 ? 'var(--danger)' : parseFloat(epErrorRate) > 1 ? 'var(--warning)' : 'var(--text-secondary)'}; font-size: 13px;">${epErrorRate}%</span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>

            <!-- Alerts and Errors row -->
            <div class="grid grid-cols-2 gap-6 mb-6">
                <!-- Recent Alerts -->
                <div class="card" aria-labelledby="recent-alerts-title">
                    <div class="card-header">
                        <h2 class="card-title" id="recent-alerts-title">Recent Alerts</h2>
                        ${alerts.length > 0 ? `<span class="badge badge-warning">${alerts.length}</span>` : ''}
                    </div>
                    <div class="card-body" style="padding: 0; max-height: 360px; overflow-y: auto;">
                        ${alerts.length === 0 ? `
                            <div style="padding: 32px; text-align: center; color: var(--text-secondary);">
                                No alerts in the last 7 days.
                            </div>
                        ` : alerts.slice(0, 20).map(alert => `
                            <div style="padding: 12px 16px; border-bottom: 1px solid var(--gray-100); display: flex; align-items: flex-start; gap: 10px;">
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                                        <span class="badge ${alertSeverityBadge(alert.alert_type)}" style="font-size: 11px;">${escapeHtml(alert.alert_type || 'alert')}</span>
                                        ${alert.acknowledged ? '<span style="font-size: 11px; color: var(--success);">Acknowledged</span>' : ''}
                                    </div>
                                    <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(JSON.stringify(alert.data || {}))}">
                                        ${escapeHtml(alert.data?.message || alert.data?.detail || JSON.stringify(alert.data || {}).slice(0, 80))}
                                    </div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${formatTimestamp(alert.created_at)}</div>
                                </div>
                                ${!alert.acknowledged ? `
                                    <button class="btn btn-sm btn-secondary" style="flex-shrink: 0; min-height: 44px;" onclick="handlers.acknowledgeAlert('${escapeHtml(alert.id)}')" aria-label="Acknowledge alert">
                                        Ack
                                    </button>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Recent Errors -->
                <div class="card" aria-labelledby="recent-errors-title">
                    <div class="card-header">
                        <h2 class="card-title" id="recent-errors-title">Recent Errors (24h)</h2>
                        ${errors.length > 0 ? `<span class="badge badge-danger">${errors.length}</span>` : ''}
                    </div>
                    <div class="card-body" style="padding: 0; max-height: 360px; overflow-y: auto;">
                        ${errors.length === 0 ? `
                            <div style="padding: 32px; text-align: center; color: var(--text-secondary);">
                                No errors in the last 24 hours.
                            </div>
                        ` : errors.slice(0, 20).map(err => `
                            <div style="padding: 12px 16px; border-bottom: 1px solid var(--gray-100);">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                                    <span class="badge badge-danger" style="font-size: 11px;">${escapeHtml(err.error_type || 'error')}</span>
                                </div>
                                <div style="font-size: 13px; color: var(--text-primary); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(err.message || '')}">
                                    ${escapeHtml((err.message || '--').slice(0, 120))}
                                </div>
                                <div style="font-size: 11px; color: var(--text-secondary);">${formatTimestamp(err.created_at)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- Security Events Card -->
            <div class="card mb-6" aria-labelledby="security-events-title">
                <div class="card-header">
                    <h2 class="card-title" id="security-events-title">Security Events (24h)</h2>
                </div>
                <div class="card-body">
                    ${!securityEvents ? `
                        <div style="text-align: center; color: var(--text-secondary); padding: 16px;">No security event data available.</div>
                    ` : `
                        <div class="grid grid-cols-4 gap-4 mb-6">
                            ${Object.entries(secCounters).slice(0, 8).map(([key, val]) => `
                                <div style="padding: 12px 16px; background: var(--gray-50); border-radius: 8px;">
                                    <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(key.replace(/_/g, ' '))}</div>
                                    <div style="font-size: 22px; font-weight: 700; color: ${val > 0 && (key.includes('fail') || key.includes('block') || key.includes('attack')) ? 'var(--danger)' : 'var(--text-primary)'};">${val != null ? Number(val).toLocaleString() : '0'}</div>
                                </div>
                            `).join('')}
                        </div>
                        ${recentSecEvents.length > 0 ? `
                            <h2 style="font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Recent Events</h2>
                            <div style="overflow-x: auto;">
                                <table class="table" aria-label="Recent security events">
                                    <thead>
                                        <tr>
                                            <th>Event Type</th>
                                            <th>IP / User</th>
                                            <th>Details</th>
                                            <th>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${recentSecEvents.slice(0, 15).map(ev => `
                                            <tr>
                                                <td><span class="badge badge-warning" style="font-size: 11px;">${escapeHtml(ev.event_type || '--')}</span></td>
                                                <td style="font-size: 13px; font-family: monospace;">${escapeHtml(ev.ip_or_user || '--')}</td>
                                                <td style="font-size: 13px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(ev.details || '')}">
                                                    ${escapeHtml((ev.details || '--').slice(0, 80))}
                                                </td>
                                                <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${formatTimestamp(ev.created_at)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}
                    `}
                </div>
            </div>

            <div style="font-size: 12px; color: var(--text-secondary); text-align: right; padding-bottom: 8px;">
                Auto-refreshes every 30 seconds.
                ${store.state.adminMetricsLastUpdated ? `Last updated: ${formatTimestamp(store.state.adminMetricsLastUpdated)}` : ''}
            </div>
        `;
    }
});
