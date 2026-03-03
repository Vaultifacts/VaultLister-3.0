// WebSocket Service for VaultLister Mobile
import Config from 'react-native-config';

const WS_URL = Config.WS_URL || 'ws://localhost:3000/ws';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.handlers = new Map();
    this.pendingMessages = [];
    this.token = null;
    this.isConnected = false;
  }

  connect(token) {
    this.token = token;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Authenticate
          if (this.token) {
            this.send({ type: 'auth', token: this.token });
          }

          // Flush pending messages
          this.flushPendingMessages();

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

        this.ws.onclose = () => {
          console.log('[WS] Disconnected');
          this.isConnected = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  handleMessage(data) {
    // Call specific handlers
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

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.pendingMessages.push(data);
    }
  }

  subscribe(topics) {
    this.send({
      type: 'subscribe',
      topics: Array.isArray(topics) ? topics : [topics],
    });
  }

  unsubscribe(topics) {
    this.send({
      type: 'unsubscribe',
      topics: Array.isArray(topics) ? topics : [topics],
    });
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type).push(handler);

    // Return unsubscribe function
    return () => this.off(type, handler);
  }

  off(type, handler) {
    if (this.handlers.has(type)) {
      const handlers = this.handlers.get(type);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  flushPendingMessages() {
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      this.send(message);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token).catch(() => {});
      }
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}

// Singleton instance
export const wsService = new WebSocketService();

// Initialize WebSocket with token
export function initWebSocket(token) {
  return wsService.connect(token);
}

// Event handlers for common events
export function onInventoryUpdate(handler) {
  return wsService.on('inventory.updated', handler);
}

export function onSaleCreated(handler) {
  return wsService.on('sale.created', handler);
}

export function onOfferReceived(handler) {
  return wsService.on('offer.received', handler);
}

export function onNotification(handler) {
  return wsService.on('notification', handler);
}

export default wsService;
