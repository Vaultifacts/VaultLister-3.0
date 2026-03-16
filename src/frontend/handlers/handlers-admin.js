'use strict';
// Route-group chunk: admin (handlers)

Object.assign(handlers, {
    _adminRefreshInterval: null,

    async loadAdminMetrics() {
        const user = store.state.user;
        if (!user || !user.is_admin) return;

        store.setState({ adminMetricsLoading: true });
        renderApp(pages.adminMetrics());

        try {
            const [metricsRes, alertsRes, errorsRes, securityRes] = await Promise.allSettled([
                api.request('GET', '/api/metrics'),
                api.request('GET', '/api/alerts'),
                api.request('GET', '/api/errors'),
                api.request('GET', '/api/security/events')
            ]);

            const updates = { adminMetricsLoading: false, adminMetricsLastUpdated: new Date().toISOString() };

            if (metricsRes.status === 'fulfilled' && metricsRes.value?.data) {
                updates.adminMetrics = metricsRes.value.data;
            }
            if (alertsRes.status === 'fulfilled' && alertsRes.value?.data?.alerts) {
                updates.adminAlerts = alertsRes.value.data.alerts;
            }
            if (errorsRes.status === 'fulfilled' && errorsRes.value?.data?.errors) {
                updates.adminErrors = errorsRes.value.data.errors;
            }
            if (securityRes.status === 'fulfilled' && securityRes.value?.data) {
                updates.adminSecurityEvents = securityRes.value.data;
            }

            store.setState(updates);
        } catch (err) {
            console.error('[Admin] Failed to load metrics:', err);
            store.setState({ adminMetricsLoading: false });
            toast.error('Failed to load admin metrics.');
        }

        renderApp(pages.adminMetrics());
    },

    async refreshAdminMetrics() {
        await handlers.loadAdminMetrics();
    },

    startAdminAutoRefresh() {
        handlers.stopAdminAutoRefresh();
        handlers._adminRefreshInterval = setInterval(() => {
            if (store.state.currentPage === 'admin-metrics') {
                handlers.loadAdminMetrics();
            }
        }, 30000);
    },

    stopAdminAutoRefresh() {
        if (handlers._adminRefreshInterval) {
            clearInterval(handlers._adminRefreshInterval);
            handlers._adminRefreshInterval = null;
        }
    },

    async acknowledgeAlert(alertId) {
        if (!alertId) return;
        try {
            await api.request('POST', `/api/alerts/${alertId}/acknowledge`);
            const alerts = store.state.adminAlerts || [];
            store.setState({
                adminAlerts: alerts.map(a => a.id === alertId ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() } : a)
            });
            renderApp(pages.adminMetrics());
            toast.success('Alert acknowledged.');
        } catch (err) {
            console.error('[Admin] Failed to acknowledge alert:', err);
            toast.error('Failed to acknowledge alert.');
        }
    },

    async loadFeatureFlags() {
        const user = store.state.user;
        if (!user || !user.is_admin) return;

        store.setState({ featureFlagsLoading: true });
        renderApp(pages.adminFeatureFlags());

        try {
            const res = await api.request('GET', '/api/feature-flags/all');
            store.setState({ featureFlags: res?.data?.flags || {}, featureFlagsLoading: false });
        } catch (err) {
            console.error('[Admin] Failed to load feature flags:', err);
            store.setState({ featureFlagsLoading: false });
            toast.error('Failed to load feature flags.');
        }

        renderApp(pages.adminFeatureFlags());
    },

    async toggleFeatureFlag(flagName, enabled) {
        if (!flagName) return;
        try {
            await api.request('PUT', `/api/feature-flags/${encodeURIComponent(flagName)}`, { enabled });
            const flags = store.state.featureFlags || {};
            store.setState({
                featureFlags: {
                    ...flags,
                    [flagName]: { ...(flags[flagName] || {}), enabled }
                }
            });
            toast.success(`${flagName} ${enabled ? 'enabled' : 'disabled'}.`);
        } catch (err) {
            console.error('[Admin] Failed to toggle feature flag:', err);
            toast.error('Failed to update feature flag.');
            renderApp(pages.adminFeatureFlags());
        }
    }
});
