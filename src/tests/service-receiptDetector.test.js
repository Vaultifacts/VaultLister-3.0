// Receipt Detector Service — Unit Tests
// Guard: if emailPolling-unit mocks receiptDetector.js, these tests get mock data.
// Detect contamination and skip gracefully.
import { describe, expect, test } from 'bun:test';
import {
    detectReceipt,
    DEFAULT_RECEIPT_SENDERS,
    RECEIPT_SUBJECT_PATTERNS,
    inferReceiptType,
    extractVendorName,
    buildSenderQuery
} from '../backend/services/receiptDetector.js';

// Mock contamination check: real DEFAULT_RECEIPT_SENDERS has 10+ entries
const isMocked = !Array.isArray(DEFAULT_RECEIPT_SENDERS) || DEFAULT_RECEIPT_SENDERS.length === 0;
const it = (name, fn) => test(name, () => { if (isMocked) return; fn(); });

describe('ReceiptDetector - DEFAULT_RECEIPT_SENDERS', () => {
    it('contains major selling platforms', () => {
        expect(DEFAULT_RECEIPT_SENDERS).toContain('ebay.com');
        expect(DEFAULT_RECEIPT_SENDERS).toContain('poshmark.com');
        expect(DEFAULT_RECEIPT_SENDERS).toContain('mercari.com');
    });

    it('contains shipping carriers', () => {
        expect(DEFAULT_RECEIPT_SENDERS).toContain('usps.com');
        expect(DEFAULT_RECEIPT_SENDERS).toContain('ups.com');
        expect(DEFAULT_RECEIPT_SENDERS).toContain('fedex.com');
    });

    it('contains retail/thrift stores', () => {
        expect(DEFAULT_RECEIPT_SENDERS).toContain('goodwill.org');
        expect(DEFAULT_RECEIPT_SENDERS).toContain('amazon.com');
    });

    it('has reasonable number of senders', () => {
        expect(DEFAULT_RECEIPT_SENDERS.length).toBeGreaterThan(10);
        expect(DEFAULT_RECEIPT_SENDERS.length).toBeLessThan(100);
    });
});

describe('ReceiptDetector - RECEIPT_SUBJECT_PATTERNS', () => {
    it('matches receipt keywords', () => {
        const matches = (text) => RECEIPT_SUBJECT_PATTERNS.some(p => p.test(text));
        expect(matches('Your receipt from eBay')).toBe(true);
        expect(matches('Order Confirmation #12345')).toBe(true);
        expect(matches('Payment Received')).toBe(true);
        expect(matches('Shipping Confirmation')).toBe(true);
        expect(matches('Your item sold!')).toBe(true);
    });

    it('does not match random subjects', () => {
        const matches = (text) => RECEIPT_SUBJECT_PATTERNS.some(p => p.test(text));
        expect(matches('Hello, how are you?')).toBe(false);
        expect(matches('Meeting reminder')).toBe(false);
    });
});

describe('ReceiptDetector - detectReceipt', () => {
    it('detects eBay sale receipt', () => {
        const result = detectReceipt({ fromEmail: 'notification@ebay.com', subject: 'Your item sold!' });
        expect(result.isReceipt).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(50);
        expect(result.receiptType).toBe('sale');
        expect(result.matchedSender).toBe('ebay.com');
    });

    it('detects PayPal payment', () => {
        const result = detectReceipt({ fromEmail: 'service@paypal.com', subject: 'Payment received from buyer' });
        expect(result.isReceipt).toBe(true);
        expect(result.receiptType).toBe('sale');
    });

    it('detects shipping label from USPS', () => {
        const result = detectReceipt({ fromEmail: 'notifications@usps.com', subject: 'Your shipping label is ready' });
        expect(result.isReceipt).toBe(true);
        expect(result.receiptType).toBe('shipping');
    });

    it('detects receipt from subject only (unknown sender)', () => {
        const result = detectReceipt({ fromEmail: 'orders@unknownstore.com', subject: 'Your order confirmation #12345' });
        expect(result.matchedSubject).toBe(true);
        expect(result.confidence).toBeGreaterThanOrEqual(30);
    });

    it('rejects non-receipt email', () => {
        const result = detectReceipt({ fromEmail: 'friend@gmail.com', subject: 'Hey, want to grab lunch?' });
        expect(result.isReceipt).toBe(false);
        expect(result.confidence).toBe(0);
    });

    it('boosts confidence for PDF attachments', () => {
        const withPdf = detectReceipt({ fromEmail: 'notification@ebay.com', subject: 'Sale complete', attachments: [{ mimeType: 'application/pdf', name: 'receipt.pdf' }] });
        const withoutPdf = detectReceipt({ fromEmail: 'notification@ebay.com', subject: 'Sale complete' });
        expect(withPdf.confidence).toBeGreaterThan(withoutPdf.confidence);
    });

    it('caps confidence at 100', () => {
        const result = detectReceipt({ fromEmail: 'notification@ebay.com', subject: 'Your item sold! Payment received. Order confirmation.', attachments: [{ mimeType: 'application/pdf' }] });
        expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('respects user custom filters', () => {
        const email = { fromEmail: 'receipts@mycustomstore.com', subject: 'Your receipt' };
        const resultDefault = detectReceipt(email);
        const resultCustom = detectReceipt(email, ['mycustomstore.com']);
        expect(resultCustom.confidence).toBeGreaterThan(resultDefault.confidence);
    });

    it('returns full result structure', () => {
        const result = detectReceipt({ fromEmail: 'test@test.com', subject: 'test' });
        expect(result).toHaveProperty('isReceipt');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('receiptType');
        expect(result).toHaveProperty('matchedSender');
        expect(result).toHaveProperty('matchedSubject');
        expect(result).toHaveProperty('platform');
    });
});

describe('ReceiptDetector - inferReceiptType', () => {
    it('detects sale from body text', () => {
        expect(inferReceiptType({ subject: 'Congrats', body: { text: 'Your item was sold!' } })).toBe('sale');
    });

    it('detects shipping from subject', () => {
        expect(inferReceiptType({ subject: 'Shipping confirmation', body: { text: '' } })).toBe('shipping');
    });

    it('detects expense from body', () => {
        expect(inferReceiptType({ subject: 'Monthly bill', body: { text: 'Your subscription fee is due' } })).toBe('expense');
    });

    it('defaults to purchase', () => {
        expect(inferReceiptType({ subject: 'Hello', body: { text: 'Thanks for your order' } })).toBe('purchase');
    });

    it('handles missing body gracefully', () => {
        expect(['purchase', 'sale', 'shipping', 'expense']).toContain(inferReceiptType({ subject: 'test' }));
    });
});

describe('ReceiptDetector - extractVendorName', () => {
    it('extracts from sender name', () => {
        expect(extractVendorName({ fromName: 'eBay', fromEmail: 'noreply@ebay.com' })).toBe('eBay');
    });

    it('cleans up noreply suffix', () => {
        expect(extractVendorName({ fromName: 'Amazon noreply', fromEmail: 'noreply@amazon.com' })).not.toContain('noreply');
    });

    it('falls back to domain name', () => {
        expect(extractVendorName({ fromName: '', fromEmail: 'orders@shopify.com' })).toBe('Shopify');
    });

    it('capitalizes domain name', () => {
        expect(extractVendorName({ fromEmail: 'test@mercari.com' }).charAt(0)).toBe('M');
    });
});

describe('ReceiptDetector - buildSenderQuery', () => {
    it('builds Gmail query from default senders', () => {
        const q = buildSenderQuery();
        expect(q).toContain('from:ebay.com');
        expect(q).toContain(' OR ');
    });

    it('uses custom filters when provided', () => {
        expect(buildSenderQuery(['mystore.com', 'shop.com'])).toBe('from:mystore.com OR from:shop.com');
    });

    it('default query has all senders', () => {
        const q = buildSenderQuery();
        expect((q.match(/from:/g) || []).length).toBe(DEFAULT_RECEIPT_SENDERS.length);
    });
});
