import { describe, test, expect } from 'bun:test';
import { scanListingContent } from '../backend/services/platformSync/contentSafetyScanner.js';

describe('Content Safety Scanner', () => {
    test('should PASS clean listing', () => {
        const result = scanListingContent({
            title: 'Nike Air Max 90 Size 10',
            description: 'Worn twice, excellent condition. No box included.',
            price: 85,
            platform: 'facebook',
        });
        expect(result.status).toBe('PASS');
        expect(result.issues).toHaveLength(0);
    });

    test('should BLOCK listing with $0 price', () => {
        const result = scanListingContent({
            title: 'Test Item',
            description: 'A test listing',
            price: 0,
            platform: 'facebook',
        });
        expect(result.status).toBe('BLOCK');
        expect(result.issues.some(i => i.includes('$0'))).toBe(true);
    });

    test('should BLOCK listing with Venmo keyword', () => {
        const result = scanListingContent({
            title: 'Vintage Jacket',
            description: 'Pay via Venmo for discount',
            price: 45,
            platform: 'depop',
        });
        expect(result.status).toBe('BLOCK');
        expect(result.issues.some(i => i.includes('venmo'))).toBe(true);
    });

    test('should BLOCK listing with CashApp keyword', () => {
        const result = scanListingContent({
            title: 'Sneakers',
            description: 'Also accept cashapp payments',
            price: 120,
            platform: 'mercari',
        });
        expect(result.status).toBe('BLOCK');
        expect(result.issues.some(i => i.includes('cashapp'))).toBe(true);
    });

    test('should BLOCK listing with Instagram handle', () => {
        const result = scanListingContent({
            title: 'Designer Bag',
            description: 'DM me on instagram for more pics',
            price: 200,
            platform: 'facebook',
        });
        expect(result.status).toBe('BLOCK');
        expect(result.issues.some(i => i.includes('instagram'))).toBe(true);
    });

    test('should WARN listing with external URL', () => {
        const result = scanListingContent({
            title: 'Handmade Bracelet',
            description: 'See more at https://myshop.com/bracelets',
            price: 25,
            platform: 'facebook',
        });
        expect(result.issues.some(i => i.includes('Prohibited pattern'))).toBe(true);
    });

    test('should WARN listing with phone number', () => {
        const result = scanListingContent({
            title: 'Moving Sale Furniture',
            description: 'Call 403-555-1234 for details',
            price: 150,
            platform: 'facebook',
        });
        expect(result.issues.some(i => i.includes('Prohibited pattern'))).toBe(true);
    });

    test('should WARN listing with excessive caps', () => {
        const result = scanListingContent({
            title: 'FREE SHIPPING BEST DEAL EVER BUY NOW',
            description: 'THIS IS THE BEST ITEM YOU WILL EVER FIND GUARANTEED',
            price: 50,
            platform: 'facebook',
        });
        expect(result.issues.some(i => i.includes('ALL CAPS'))).toBe(true);
    });

    test('should BLOCK listing with empty title', () => {
        const result = scanListingContent({
            title: '',
            description: 'Some description',
            price: 20,
            platform: 'facebook',
        });
        expect(result.status).toBe('BLOCK');
        expect(result.issues.some(i => i.includes('Title is empty'))).toBe(true);
    });

    test('should WARN when title equals description', () => {
        const result = scanListingContent({
            title: 'Nike Shoes Size 10',
            description: 'Nike Shoes Size 10',
            price: 80,
            platform: 'poshmark',
        });
        expect(result.issues.some(i => i.includes('identical'))).toBe(true);
    });

    test('should detect multiple issues simultaneously', () => {
        const result = scanListingContent({
            title: '',
            description: 'Pay venmo or call 555-123-4567',
            price: 0,
            platform: 'depop',
        });
        expect(result.status).toBe('BLOCK');
        expect(result.issues.length).toBeGreaterThanOrEqual(3);
    });

    test('should include Depop-specific warning for payment keywords', () => {
        const result = scanListingContent({
            title: 'Shirt',
            description: 'DM me on whatsapp',
            price: 30,
            platform: 'depop',
        });
        expect(result.issues.some(i => i.includes('Depop auto-suspends'))).toBe(true);
    });
});
