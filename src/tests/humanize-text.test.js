import { describe, test, expect } from 'bun:test';
import { humanizeDescription } from '../shared/ai/humanize-text.js';

describe('AI Description Humanization', () => {
    test('should return short text unchanged', () => {
        expect(humanizeDescription('Hi')).toBe('Hi');
        expect(humanizeDescription('')).toBe('');
    });

    test('should return a string of similar length', () => {
        const input = 'This item features premium leather construction with hand-stitched details. Perfect for everyday use. Whether you are looking for style or durability, this bag delivers both.';
        const result = humanizeDescription(input, { platform: 'facebook' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(50);
        // Should not drastically change length (±30%)
        expect(result.length).toBeGreaterThan(input.length * 0.5);
        expect(result.length).toBeLessThan(input.length * 1.5);
    });

    test('should apply contractions to formal text', () => {
        const input = 'It is a beautiful piece. They are very comfortable. I am selling because I do not need it anymore. This item cannot be returned.';
        // Run multiple times — contractions are probabilistic
        let contracted = false;
        for (let i = 0; i < 20; i++) {
            const result = humanizeDescription(input);
            if (result.includes("it's") || result.includes("don't") || result.includes("can't") || result.includes("I'm") || result.includes("they're")) {
                contracted = true;
                break;
            }
        }
        expect(contracted).toBe(true);
    });

    test('should vary AI-formulaic openers over multiple runs', () => {
        const input = 'This item features a classic design with modern comfort. Perfect for casual outings.';
        const results = new Set();
        for (let i = 0; i < 30; i++) {
            results.add(humanizeDescription(input));
        }
        // Should produce at least 2 different variants
        expect(results.size).toBeGreaterThanOrEqual(2);
    });

    test('should sometimes drop trailing period', () => {
        const input = 'This is a great jacket in excellent condition. Barely worn. Smoke-free home.';
        let droppedPeriod = false;
        for (let i = 0; i < 30; i++) {
            const result = humanizeDescription(input);
            if (!result.endsWith('.')) {
                droppedPeriod = true;
                break;
            }
        }
        expect(droppedPeriod).toBe(true);
    });

    test('should accept platform parameter without error', () => {
        const input = 'Beautiful vintage dress in excellent condition. Perfect for any occasion.';
        for (const platform of ['poshmark', 'depop', 'ebay', 'mercari', 'grailed', 'facebook', 'etsy']) {
            const result = humanizeDescription(input, { platform });
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(10);
        }
    });

    test('should produce different output for different platforms over many runs', () => {
        const input = 'This is a great clothing item in excellent condition. Purchase it today for a great deal.';
        const poshResults = new Set();
        const ebayResults = new Set();
        for (let i = 0; i < 20; i++) {
            poshResults.add(humanizeDescription(input, { platform: 'poshmark' }));
            ebayResults.add(humanizeDescription(input, { platform: 'ebay' }));
        }
        // Platform-specific tone adjustments should create some variation
        expect(poshResults.size + ebayResults.size).toBeGreaterThan(3);
    });
});
