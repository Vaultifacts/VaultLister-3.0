// WebSocket Service — Unit Tests (constants + getStats, no real WebSocket needed)
import { describe, expect, test } from 'bun:test';
import { websocketService, MESSAGE_TYPES } from '../backend/services/websocket.js';

describe('MESSAGE_TYPES constants', () => {
    test('has PING and PONG', () => {
        expect(MESSAGE_TYPES.PING).toBeDefined();
        expect(MESSAGE_TYPES.PONG).toBeDefined();
        expect(typeof MESSAGE_TYPES.PING).toBe('string');
    });

    test('has AUTH types', () => {
        expect(MESSAGE_TYPES.AUTH).toBeDefined();
        expect(MESSAGE_TYPES.AUTH_SUCCESS).toBeDefined();
        expect(MESSAGE_TYPES.AUTH_FAILED).toBeDefined();
    });

    test('has SUBSCRIBE types', () => {
        expect(MESSAGE_TYPES.SUBSCRIBE).toBeDefined();
        expect(MESSAGE_TYPES.UNSUBSCRIBE).toBeDefined();
        expect(MESSAGE_TYPES.SUBSCRIBED).toBeDefined();
    });

    test('has INVENTORY event types', () => {
        expect(MESSAGE_TYPES.INVENTORY_CREATED).toBeDefined();
        expect(MESSAGE_TYPES.INVENTORY_UPDATED).toBeDefined();
        expect(MESSAGE_TYPES.INVENTORY_DELETED).toBeDefined();
        expect(MESSAGE_TYPES.INVENTORY_SYNC).toBeDefined();
    });

    test('has LISTING event types', () => {
        expect(MESSAGE_TYPES.LISTING_CREATED).toBeDefined();
        expect(MESSAGE_TYPES.LISTING_UPDATED).toBeDefined();
        expect(MESSAGE_TYPES.LISTING_SOLD).toBeDefined();
    });

    test('has SALE event types', () => {
        expect(MESSAGE_TYPES.SALE_CREATED).toBeDefined();
        expect(MESSAGE_TYPES.SALE_SHIPPED).toBeDefined();
        expect(MESSAGE_TYPES.SALE_DELIVERED).toBeDefined();
    });

    test('has OFFER event types', () => {
        expect(MESSAGE_TYPES.OFFER_RECEIVED).toBeDefined();
        expect(MESSAGE_TYPES.OFFER_ACCEPTED).toBeDefined();
        expect(MESSAGE_TYPES.OFFER_DECLINED).toBeDefined();
    });

    test('has NOTIFICATION type', () => {
        expect(MESSAGE_TYPES.NOTIFICATION).toBeDefined();
    });

    test('has CHAT_MESSAGE type', () => {
        expect(MESSAGE_TYPES.CHAT_MESSAGE).toBeDefined();
    });

    test('has ERROR type', () => {
        expect(MESSAGE_TYPES.ERROR).toBeDefined();
    });

    test('all values are unique strings', () => {
        const values = Object.values(MESSAGE_TYPES);
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).toBe(values.length);
        for (const v of values) {
            expect(typeof v).toBe('string');
        }
    });
});

describe('websocketService object', () => {
    test('has init method', () => {
        expect(typeof websocketService.init).toBe('function');
    });

    test('has handleConnection method', () => {
        expect(typeof websocketService.handleConnection).toBe('function');
    });

    test('has handleMessage method', () => {
        expect(typeof websocketService.handleMessage).toBe('function');
    });

    test('has handleDisconnect method', () => {
        expect(typeof websocketService.handleDisconnect).toBe('function');
    });

    test('has send method', () => {
        expect(typeof websocketService.send).toBe('function');
    });

    test('has sendToUser method', () => {
        expect(typeof websocketService.sendToUser).toBe('function');
    });

    test('has broadcast method', () => {
        expect(typeof websocketService.broadcast).toBe('function');
    });

    test('has broadcastAll method', () => {
        expect(typeof websocketService.broadcastAll).toBe('function');
    });

    test('has getStats method', () => {
        expect(typeof websocketService.getStats).toBe('function');
    });

    test('getStats returns connection info', () => {
        const stats = websocketService.getStats();
        expect(stats).toHaveProperty('connectedUsers');
        expect(stats).toHaveProperty('totalConnections');
        expect(typeof stats.connectedUsers).toBe('number');
        expect(typeof stats.totalConnections).toBe('number');
    });

    test('has cleanup method', () => {
        expect(typeof websocketService.cleanup).toBe('function');
    });

    test('has disconnectAllForUser method', () => {
        expect(typeof websocketService.disconnectAllForUser).toBe('function');
    });

    test('has notification methods', () => {
        expect(typeof websocketService.notifyInventoryCreated).toBe('function');
        expect(typeof websocketService.notifyListingCreated).toBe('function');
        expect(typeof websocketService.notifySaleCreated).toBe('function');
    });
});
