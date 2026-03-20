// WebSocket Client for VaultLister Frontend
// Real-time updates for inventory, sales, and notifications

class VaultListerSocket {
    constructor() {
        this.ws = null;
        this.url = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.handlers = new Map();
        this.pendingMessages = [];
        this.maxPendingMessages = 100;
        this.authenticated = false;
        this.connectionId = null;
        this.reconnectTimerId = null;
        this.connecting = false;
        this._explicitDisconnect = false;
        // Heartbeat — reset every time a server ping arrives.
        // If 60s pass without a ping the server is considered gone and we reconnect.
        this._pingTimeoutId = null;
        this._pingTimeoutMs = 60000;
    }

    // Initialize WebSocket connection
    connect(token) {
        // Guard against multiple simultaneous connections
        if (this.connecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
            return Promise.resolve();
        }

        // Cancel any pending reconnect
        this.cancelReconnect();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.url = `${protocol}//${window.location.host}/ws`;
        this.token = token;
        this.connecting = true;
        this._explicitDisconnect = false;

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('[WS] Connected');
                    this.reconnectAttempts = 0;
                    this.connecting = false;
                    this._explicitDisconnect = false;
                    this._dispatchStatus('connected');

                    // Start ping watchdog — server sends a ping every 30s.
                    this._resetPingTimeout();

                    // Authenticate immediately
                    if (this.token) {
                        this.send({ type: 'auth', token: this.token });
                    }

                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleMessage(data);
                    } catch (e) {
                        console.error('[WS] Parse error:', e);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('[WS] Disconnected:', event.code, event.reason);
                    this.authenticated = false;
                    this.connecting = false;
                    this._clearPingTimeout();
                    if (!this._explicitDisconnect) {
                        this._dispatchStatus('reconnecting');
                        this.attemptReconnect();
                    } else {
                        this._dispatchStatus('disconnected');
                    }
                };

                this.ws.onerror = () => {
                    console.warn('[WS] Connection error (will retry via onclose)');
                    this.connecting = false;
                    reject(new Error('WebSocket connection failed'));
                };
            } catch (error) {
                this.connecting = false;
                reject(error);
            }
        });
    }

    // Reset the 60s ping watchdog. Called each time a server ping arrives.
    _resetPingTimeout() {
        if (this._pingTimeoutId !== null) {
            clearTimeout(this._pingTimeoutId);
        }
        this._pingTimeoutId = setTimeout(() => {
            this._pingTimeoutId = null;
            if (!this._explicitDisconnect) {
                console.warn('[WS] No ping received in 60s — reconnecting');
                this.ws?.close();
            }
        }, this._pingTimeoutMs);
    }

    // Clear the ping watchdog (on explicit disconnect or connection close).
    _clearPingTimeout() {
        if (this._pingTimeoutId !== null) {
            clearTimeout(this._pingTimeoutId);
            this._pingTimeoutId = null;
        }
    }

    // Handle incoming messages
    handleMessage(data) {
        // Respond to server pings with a pong and reset the watchdog.
        if (data.type === 'ping') {
            this.send({ type: 'pong', timestamp: data.timestamp || Date.now() });
            this._resetPingTimeout();
            return;
        }

        // Handle auth response
        if (data.type === 'auth_success') {
            this.authenticated = true;
            this.flushPendingMessages();
            console.log('[WS] Authenticated');
        }

        if (data.type === 'auth_failed') {
            console.log('[WS] Auth failed — clearing token, stopping reconnect');
            this.token = null;
            this.cancelReconnect();
            this.ws?.close();
        }

        if (data.type === 'connected') {
            this.connectionId = data.connectionId;
        }

        // Call type-specific handlers
        const handlers = this.handlers.get(data.type) || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (e) {
                console.error('[WS] Handler error:', e);
            }
        });

        // Call wildcard handlers
        const wildcardHandlers = this.handlers.get('*') || [];
        wildcardHandlers.forEach(handler => {
            try {
                handler(data);
            } catch (e) {
                console.error('[WS] Wildcard handler error:', e);
            }
        });
    }

    // Send message
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else if (this.pendingMessages.length < this.maxPendingMessages) {
            this.pendingMessages.push(data);
        }
    }

    // Subscribe to topics
    subscribe(topics) {
        this.send({
            type: 'subscribe',
            topics: Array.isArray(topics) ? topics : [topics]
        });
    }

    // Unsubscribe from topics
    unsubscribe(topics) {
        this.send({
            type: 'unsubscribe',
            topics: Array.isArray(topics) ? topics : [topics]
        });
    }

    // Register event handler
    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type).push(handler);

        // Return unsubscribe function
        return () => this.off(type, handler);
    }

    // Remove event handler
    off(type, handler) {
        if (this.handlers.has(type)) {
            const handlers = this.handlers.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    // Flush pending messages after authentication
    flushPendingMessages() {
        while (this.pendingMessages.length > 0) {
            const message = this.pendingMessages.shift();
            this.send(message);
        }
    }

    // Cancel any pending reconnect timer
    cancelReconnect() {
        if (this.reconnectTimerId !== null) {
            clearTimeout(this.reconnectTimerId);
            this.reconnectTimerId = null;
        }
    }

    // Attempt reconnection with exponential backoff
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[WS] Max reconnect attempts reached');
            this._dispatchStatus('disconnected');
            this.emit('max_reconnect_reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimerId = setTimeout(() => {
            this.reconnectTimerId = null;
            if (this.token) {
                this.connect(this.token).catch(() => {});
            }
        }, delay);
    }

    // Dispatch a DOM custom event for connection status changes.
    // Listeners can subscribe via: document.addEventListener('vl:ws-status', e => { e.detail.status })
    // Possible statuses: 'connected' | 'reconnecting' | 'disconnected'
    _dispatchStatus(status) {
        document.dispatchEvent(new CustomEvent('vl:ws-status', { detail: { status } }));
    }

    // Emit event to handlers
    emit(type, data = {}) {
        this.handleMessage({ type, ...data });
    }

    // Disconnect (explicit — suppresses auto-reconnect)
    disconnect() {
        this._explicitDisconnect = true;
        this.cancelReconnect();
        this._clearPingTimeout();
        this.connecting = false;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.authenticated = false;
        }
    }

    // Check if connected
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN && this.authenticated;
    }
}

// Singleton instance
const wsClient = new VaultListerSocket();

// Export for use in app.js
window.VaultListerSocket = wsClient;

// Convenience methods for common events
window.wsSubscribe = {
    // Inventory updates
    onInventoryCreated: (handler) => wsClient.on('inventory.created', handler),
    onInventoryUpdated: (handler) => wsClient.on('inventory.updated', handler),
    onInventoryDeleted: (handler) => wsClient.on('inventory.deleted', handler),

    // Listing updates
    onListingCreated: (handler) => wsClient.on('listing.created', handler),
    onListingUpdated: (handler) => wsClient.on('listing.updated', handler),
    onListingSold: (handler) => wsClient.on('listing.sold', handler),

    // Sale updates
    onSaleCreated: (handler) => wsClient.on('sale.created', handler),
    onSaleShipped: (handler) => wsClient.on('sale.shipped', handler),
    onSaleDelivered: (handler) => wsClient.on('sale.delivered', handler),

    // Offer updates
    onOfferReceived: (handler) => wsClient.on('offer.received', handler),
    onOfferAccepted: (handler) => wsClient.on('offer.accepted', handler),

    // Monitoring updates
    onMonitoringUpdated: (handler) => wsClient.on('monitoring.updated', handler),

    // Generic notifications
    onNotification: (handler) => wsClient.on('notification', handler),

    // Connection events
    onConnected: (handler) => wsClient.on('auth_success', handler),
    onDisconnected: (handler) => wsClient.on('max_reconnect_reached', handler)
};

// Update the WS status dot when connection status changes
document.addEventListener('vl:ws-status', (e) => {
    const dot = document.getElementById('ws-status-dot');
    if (!dot) return;
    const { status } = e.detail;
    dot.classList.remove('ws-status-dot--connected', 'ws-status-dot--reconnecting', 'ws-status-dot--disconnected');
    if (status === 'connected') {
        dot.classList.add('ws-status-dot--connected');
        dot.setAttribute('aria-label', 'WebSocket connected');
        dot.setAttribute('title', 'Connected');
    } else if (status === 'reconnecting') {
        dot.classList.add('ws-status-dot--reconnecting');
        dot.setAttribute('aria-label', 'WebSocket reconnecting');
        dot.setAttribute('title', 'Reconnecting...');
    } else {
        dot.classList.add('ws-status-dot--disconnected');
        dot.setAttribute('aria-label', 'WebSocket disconnected');
        dot.setAttribute('title', 'Disconnected');
    }
});

// Auto-initialize when token is available
document.addEventListener('DOMContentLoaded', () => {
    // Read token from the app's persisted state (sessionStorage first, then localStorage)
    let token = null;
    try {
        const raw = sessionStorage.getItem('vaultlister_state') || localStorage.getItem('vaultlister_state');
        if (raw) token = JSON.parse(raw).token || null;
    } catch (_) {}
    if (token) {
        wsClient.connect(token).catch(err => {
            console.log('[WS] Initial connection failed:', err.message);
        });
    }

    // Desktop notification handler for automation events
    window.wsSubscribe.onNotification((data) => {
        const notif = data.notification;
        if (!notif) return;

        const prefs = window.store?.state?.automationNotifPrefs ||
            (() => { try { return JSON.parse(localStorage.getItem('vaultlister_automation_notif_prefs') || '{}'); } catch { return {}; } })();

        if (!prefs.desktop_enabled) return;

        const t = notif.type || '';
        if (t.includes('automation_completed') || t.includes('automation_success')) {
            if (!prefs.on_success) return;
        } else if (t.includes('automation_failed')) {
            if (!prefs.on_failure) return;
        } else if (t.includes('automation_partial')) {
            if (!prefs.on_partial) return;
        } else {
            return;
        }

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(notif.title || 'Automation Update', {
                body: notif.message || '',
                icon: '/icons/icon-192.png',
                tag: 'automation-' + (notif.id || Date.now())
            });
        }
    });
});

export default wsClient;
