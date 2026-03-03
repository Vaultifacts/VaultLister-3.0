// WebSocket Service for Real-Time Features
// Live updates, inventory sync, and sale notifications

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { logger } from '../shared/logger.js';

// Connection store
const connections = new Map(); // userId -> Set of WebSocket connections
const rooms = new Map(); // roomId -> Set of userIds
const subscriptions = new Map(); // connectionId -> Set of topics

// Message types
const MESSAGE_TYPES = {
    // Connection
    PING: 'ping',
    PONG: 'pong',
    AUTH: 'auth',
    AUTH_SUCCESS: 'auth_success',
    AUTH_FAILED: 'auth_failed',

    // Subscriptions
    SUBSCRIBE: 'subscribe',
    UNSUBSCRIBE: 'unsubscribe',
    SUBSCRIBED: 'subscribed',

    // Inventory
    INVENTORY_CREATED: 'inventory.created',
    INVENTORY_UPDATED: 'inventory.updated',
    INVENTORY_DELETED: 'inventory.deleted',
    INVENTORY_SYNC: 'inventory.sync',

    // Listings
    LISTING_CREATED: 'listing.created',
    LISTING_UPDATED: 'listing.updated',
    LISTING_SOLD: 'listing.sold',
    LISTING_VIEW: 'listing.view',

    // Sales
    SALE_CREATED: 'sale.created',
    SALE_SHIPPED: 'sale.shipped',
    SALE_DELIVERED: 'sale.delivered',

    // Offers
    OFFER_RECEIVED: 'offer.received',
    OFFER_ACCEPTED: 'offer.accepted',
    OFFER_DECLINED: 'offer.declined',

    // Notifications
    NOTIFICATION: 'notification',

    // Chat/Support
    CHAT_MESSAGE: 'chat.message',

    // Presence
    USER_ONLINE: 'user.online',
    USER_OFFLINE: 'user.offline',

    // Error
    ERROR: 'error'
};

// WebSocket Service
const websocketService = {
    // Initialize with Bun's WebSocket server or ws library
    server: null,

    init(server) {
        this.server = server;
        logger.info('[WebSocket] Service initialized');

        // Start heartbeat interval
        this.heartbeatInterval = setInterval(() => this.heartbeat(), 30000);

        return this;
    },

    // Handle new WebSocket connection (used by ws-library path; Bun uses the
    // websocket.open handler in server.js instead)
    handleConnection(ws, req) {
        if (!ws.data) ws.data = {};
        const connectionId = uuidv4();
        ws.data.connectionId = connectionId;
        ws.data.isAlive = true;
        ws.data.userId = null;
        ws.data.subscriptions = new Set();

        // Send connection acknowledgment
        this.send(ws, {
            type: 'connected',
            connectionId,
            serverTime: new Date().toISOString()
        });

        // Set up handlers
        ws.on('message', (data) => this.handleMessage(ws, data));
        ws.on('close', () => this.handleDisconnect(ws));
        ws.on('error', (error) => logger.error('[WebSocket] Error:', error));
        ws.on('pong', () => { ws.data.isAlive = true; });

        logger.info(`[WebSocket] New connection: ${connectionId}`);
    },

    // Handle incoming messages
    async handleMessage(ws, data) {
        try {
            // Fix 2: Add message rate limiting
            const now = Date.now();
            if (!ws.data.messageWindowStart) {
                ws.data.messageWindowStart = now;
                ws.data.messageCount = 0;
            }

            // Reset counter if window expired (10 seconds)
            if (now - ws.data.messageWindowStart > 10000) {
                ws.data.messageWindowStart = now;
                ws.data.messageCount = 0;
            }

            ws.data.messageCount++;

            // Max 60 messages per 10 seconds
            if (ws.data.messageCount > 60) {
                this.send(ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: 'Rate limit exceeded. Max 60 messages per 10 seconds.'
                });
                ws.close();
                return;
            }

            const message = JSON.parse(data.toString());

            switch (message.type) {
                case MESSAGE_TYPES.PING:
                    this.send(ws, { type: MESSAGE_TYPES.PONG, timestamp: Date.now() });
                    break;

                case MESSAGE_TYPES.AUTH:
                    await this.handleAuth(ws, message);
                    break;

                case MESSAGE_TYPES.SUBSCRIBE:
                    this.handleSubscribe(ws, message.topics);
                    break;

                case MESSAGE_TYPES.UNSUBSCRIBE:
                    this.handleUnsubscribe(ws, message.topics);
                    break;

                case MESSAGE_TYPES.CHAT_MESSAGE:
                    if (ws.data.userId) {
                        this.handleChatMessage(ws, message);
                    }
                    break;

                default:
                    logger.info(`[WebSocket] Unknown message type: ${message.type}`);
            }
        } catch (error) {
            logger.error('[WebSocket] Message parse error:', error);
            this.send(ws, { type: MESSAGE_TYPES.ERROR, message: 'Invalid message format' });
        }
    },

    // Handle authentication
    async handleAuth(ws, message) {
        const { token } = message;

        try {
            // Fix 1: Remove hardcoded JWT fallback
            if (!process.env.JWT_SECRET) {
                throw new Error('JWT_SECRET not configured');
            }

            // Verify JWT token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            ws.data.userId = decoded.userId || decoded.id;
            ws.data.authToken = token;
            ws.data.lastTokenCheck = Date.now();

            // Add to connections map (max 10 per user)
            if (!connections.has(ws.data.userId)) {
                connections.set(ws.data.userId, new Set());
            }
            const userConns = connections.get(ws.data.userId);
            if (userConns.size >= 10) {
                this.send(ws, { type: MESSAGE_TYPES.ERROR, message: 'Too many connections' });
                ws.close();
                return;
            }
            userConns.add(ws);

            // Auto-subscribe to user-specific topics
            this.handleSubscribe(ws, [
                `user.${ws.data.userId}`,
                `inventory.${ws.data.userId}`,
                `listings.${ws.data.userId}`,
                `sales.${ws.data.userId}`,
                `notifications.${ws.data.userId}`
            ]);

            this.send(ws, {
                type: MESSAGE_TYPES.AUTH_SUCCESS,
                userId: ws.data.userId,
                subscriptions: Array.from(ws.data.subscriptions)
            });

            logger.info(`[WebSocket] User authenticated: ${ws.data.userId}`);
        } catch (error) {
            this.send(ws, {
                type: MESSAGE_TYPES.AUTH_FAILED,
                message: 'Invalid or expired token'
            });
            // Close connection after auth failure
            ws.close();
        }
    },

    // Handle subscription requests
    handleSubscribe(ws, topics) {
        if (!Array.isArray(topics)) topics = [topics];

        // Fix 5: Max 50 subscriptions per connection
        if (ws.data.subscriptions.size + topics.length > 50) {
            this.send(ws, {
                type: MESSAGE_TYPES.ERROR,
                message: 'Maximum 50 subscriptions per connection'
            });
            return;
        }

        for (const topic of topics) {
            // Fix 5: Validate topic format and length
            if (typeof topic !== 'string' || topic.length > 100) {
                this.send(ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: 'Invalid topic: must be string under 100 characters'
                });
                continue;
            }

            // Only allow alphanumeric, dots, hyphens, underscores
            if (!/^[a-zA-Z0-9.\-_*]+$/.test(topic)) {
                this.send(ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: `Invalid topic format: ${topic}`
                });
                continue;
            }

            // Fix 6: Restrict presence to authenticated only
            if (topic === 'presence' && !ws.data.userId) {
                this.send(ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: 'Must be authenticated to subscribe to presence'
                });
                continue;
            }

            // Fix 3: Add topic subscription authorization
            if (ws.data.userId) {
                const allowedPatterns = [
                    `user.${ws.data.userId}`,
                    `inventory.${ws.data.userId}`,
                    `listings.${ws.data.userId}`,
                    `sales.${ws.data.userId}`,
                    `notifications.${ws.data.userId}`,
                    'presence'
                ];

                // Allow chat.* for any authenticated user
                const isAllowed = allowedPatterns.includes(topic) || topic.startsWith('chat.');

                // Check if topic contains another user's ID
                const userIdPattern = /\.([\w-]+)$/;
                const match = topic.match(userIdPattern);
                if (match && match[1] !== ws.data.userId && !topic.startsWith('chat.') && topic !== 'presence') {
                    this.send(ws, {
                        type: MESSAGE_TYPES.ERROR,
                        message: `Unauthorized: cannot subscribe to topic ${topic}`
                    });
                    continue;
                }

                if (!isAllowed) {
                    this.send(ws, {
                        type: MESSAGE_TYPES.ERROR,
                        message: `Unauthorized: cannot subscribe to topic ${topic}`
                    });
                    continue;
                }
            } else {
                // Not authenticated - reject all subscriptions
                this.send(ws, {
                    type: MESSAGE_TYPES.ERROR,
                    message: 'Must be authenticated to subscribe to topics'
                });
                continue;
            }

            ws.data.subscriptions.add(topic);

            // Add to room
            if (!rooms.has(topic)) {
                rooms.set(topic, new Set());
            }
            if (ws.data.userId) {
                rooms.get(topic).add(ws.data.userId);
            }
        }

        this.send(ws, {
            type: MESSAGE_TYPES.SUBSCRIBED,
            topics: Array.from(ws.data.subscriptions)
        });
    },

    // Handle unsubscribe requests
    handleUnsubscribe(ws, topics) {
        if (!Array.isArray(topics)) topics = [topics];

        for (const topic of topics) {
            ws.data.subscriptions.delete(topic);

            // Remove from room
            if (rooms.has(topic) && ws.data.userId) {
                rooms.get(topic).delete(ws.data.userId);
            }
        }
    },

    // Handle disconnect
    handleDisconnect(ws) {
        logger.info(`[WebSocket] Disconnected: ${ws.data.connectionId}`);

        // Remove from user connections
        if (ws.data.userId && connections.has(ws.data.userId)) {
            connections.get(ws.data.userId).delete(ws);

            // If no more connections, clean up
            if (connections.get(ws.data.userId).size === 0) {
                connections.delete(ws.data.userId);
            }
        }

        // Remove from rooms and clean up empty rooms.
        // Only drop the userId from a room if none of their other active connections
        // are still subscribed to that topic — otherwise we'd silently evict a live user.
        for (const topic of ws.data.subscriptions) {
            if (rooms.has(topic)) {
                if (ws.data.userId) {
                    const userConns = connections.get(ws.data.userId);
                    const stillSubscribed = userConns
                        ? [...userConns].some(c => c !== ws && c.data.subscriptions?.has(topic))
                        : false;
                    if (!stillSubscribed) {
                        rooms.get(topic).delete(ws.data.userId);
                    }
                }
                if (rooms.get(topic).size === 0) rooms.delete(topic);
            }
        }

        // Clean up subscriptions entry for this connection
        subscriptions.delete(ws.data.connectionId);
    },

    // Handle chat messages
    handleChatMessage(ws, message) {
        const { roomId, content } = message;

        // Fix 4: Sanitize chat message content
        const sanitizedContent = String(content || '').replace(/<[^>]*>/g, '').slice(0, 2000);

        this.broadcast(`chat.${roomId}`, {
            type: MESSAGE_TYPES.CHAT_MESSAGE,
            roomId,
            senderId: ws.data.userId,
            content: sanitizedContent,
            timestamp: new Date().toISOString()
        });
    },

    // Send message to specific WebSocket
    send(ws, data) {
        if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(data));
        }
    },

    // Send to specific user (all their connections)
    sendToUser(userId, data) {
        const userConnections = connections.get(userId);
        if (userConnections) {
            for (const ws of userConnections) {
                this.send(ws, data);
            }
        }
    },

    // Broadcast to topic subscribers
    broadcast(topic, data) {
        for (const [userId, userConnections] of connections) {
            for (const ws of userConnections) {
                if (ws.data.subscriptions.has(topic)) {
                    this.send(ws, data);
                }
            }
        }
    },

    // Broadcast to all connections
    broadcastAll(data) {
        for (const [userId, userConnections] of connections) {
            for (const ws of userConnections) {
                this.send(ws, data);
            }
        }
    },

    // Heartbeat to keep connections alive
    heartbeat() {
        for (const [userId, userConnections] of connections) {
            for (const ws of [...userConnections]) {
                if (!ws.data.isAlive) {
                    ws.close();
                    // Belt-and-suspenders: manually evict in case the 'close' event
                    // doesn't fire (seen in some Bun.js versions). handleDisconnect
                    // is idempotent so calling it twice is safe.
                    this.handleDisconnect(ws);
                    continue;
                }

                // Re-verify JWT every 5 minutes
                if (ws.data.authToken && Date.now() - (ws.data.lastTokenCheck || 0) > 5 * 60 * 1000) {
                    try {
                        jwt.verify(ws.data.authToken, process.env.JWT_SECRET);
                        ws.data.lastTokenCheck = Date.now();
                    } catch (err) {
                        ws.close();
                        continue;
                    }
                }

                ws.data.isAlive = false;
                ws.ping();
            }
        }
    },

    // ========================================
    // Business Event Methods
    // ========================================

    // Inventory events
    notifyInventoryCreated(userId, item) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.INVENTORY_CREATED,
            item,
            timestamp: new Date().toISOString()
        });
    },

    notifyInventoryUpdated(userId, item) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.INVENTORY_UPDATED,
            item,
            timestamp: new Date().toISOString()
        });
    },

    notifyInventoryDeleted(userId, itemId) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.INVENTORY_DELETED,
            itemId,
            timestamp: new Date().toISOString()
        });
    },

    notifyInventorySync(userId, items) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.INVENTORY_SYNC,
            items,
            timestamp: new Date().toISOString()
        });
    },

    // Listing events
    notifyListingCreated(userId, listing) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.LISTING_CREATED,
            listing,
            timestamp: new Date().toISOString()
        });
    },

    notifyListingUpdated(userId, listing) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.LISTING_UPDATED,
            listing,
            timestamp: new Date().toISOString()
        });
    },

    notifyListingSold(userId, listing, sale) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.LISTING_SOLD,
            listing,
            sale,
            timestamp: new Date().toISOString()
        });
    },

    notifyListingView(userId, listingId, viewData) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.LISTING_VIEW,
            listingId,
            ...viewData,
            timestamp: new Date().toISOString()
        });
    },

    // Sale events
    notifySaleCreated(userId, sale) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.SALE_CREATED,
            sale,
            timestamp: new Date().toISOString()
        });
    },

    notifySaleShipped(userId, sale) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.SALE_SHIPPED,
            sale,
            timestamp: new Date().toISOString()
        });
    },

    notifySaleDelivered(userId, sale) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.SALE_DELIVERED,
            sale,
            timestamp: new Date().toISOString()
        });
    },

    // Offer events
    notifyOfferReceived(userId, offer) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.OFFER_RECEIVED,
            offer,
            timestamp: new Date().toISOString()
        });
    },

    notifyOfferAccepted(userId, offer) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.OFFER_ACCEPTED,
            offer,
            timestamp: new Date().toISOString()
        });
    },

    notifyOfferDeclined(userId, offer) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.OFFER_DECLINED,
            offer,
            timestamp: new Date().toISOString()
        });
    },

    // Generic notification
    notify(userId, notification) {
        this.sendToUser(userId, {
            type: MESSAGE_TYPES.NOTIFICATION,
            notification,
            timestamp: new Date().toISOString()
        });
    },

    // Cleanup heartbeat interval for graceful shutdown
    // Force-close all WebSocket connections for a user (call on logout / password change)
    disconnectAllForUser(userId) {
        const userConns = connections.get(userId);
        if (!userConns) return;
        for (const ws of userConns) {
            try { ws.close(1000, 'Session invalidated'); } catch { /* already closed */ }
        }
        // handleDisconnect will clean up connections/rooms when close fires
    },

    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    },

    // Get connection stats
    getStats() {
        let totalConnections = 0;
        for (const [userId, userConnections] of connections) {
            totalConnections += userConnections.size;
        }

        return {
            connectedUsers: connections.size,
            totalConnections,
            rooms: rooms.size
        };
    }
};

// Client-side WebSocket wrapper (for frontend use)
export const WebSocketClient = `
// VaultLister WebSocket Client
class VaultListerSocket {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.handlers = new Map();
        this.pendingMessages = [];
        this.authenticated = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectAttempts = 0;
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
                this.authenticated = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('[WS] Error:', error);
                reject(error);
            };
        });
    }

    authenticate(token) {
        this.send({ type: 'auth', token });
    }

    subscribe(topics) {
        this.send({ type: 'subscribe', topics: Array.isArray(topics) ? topics : [topics] });
    }

    unsubscribe(topics) {
        this.send({ type: 'unsubscribe', topics: Array.isArray(topics) ? topics : [topics] });
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            if (this.pendingMessages.length < 100) {
                this.pendingMessages.push(data);
            }
        }
    }

    on(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type).push(handler);
    }

    off(type, handler) {
        if (this.handlers.has(type)) {
            const handlers = this.handlers.get(type);
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
        }
    }

    handleMessage(data) {
        const handlers = this.handlers.get(data.type) || [];
        handlers.forEach(handler => handler(data));

        // Also call wildcard handlers
        const wildcardHandlers = this.handlers.get('*') || [];
        wildcardHandlers.forEach(handler => handler(data));

        // Handle auth success
        if (data.type === 'auth_success') {
            this.authenticated = true;
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

        console.log(\`[WS] Reconnecting in \${delay}ms (attempt \${this.reconnectAttempts})\`);

        setTimeout(() => {
            this.connect().catch(() => {});
        }, delay);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Usage:
// const socket = new VaultListerSocket('ws://localhost:3000/ws');
// await socket.connect();
// socket.authenticate(authToken);
// socket.on('inventory.updated', (data) => logger.info('Inventory updated:', data));
// socket.on('sale.created', (data) => showNotification('New sale!', data));
`;

// Export
export { MESSAGE_TYPES };
export { websocketService };
export default websocketService;
