import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const utilsSource = readFileSync(new URL('../frontend/core/utils.js', import.meta.url), 'utf8');
const escapeHtmlMatch = utilsSource.match(/function escapeHtml\(text\)\s*\{[\s\S]*?\n\}/);

if (!escapeHtmlMatch) {
    throw new Error('escapeHtml function not found in src/frontend/core/utils.js');
}

// Evaluate exactly the implementation from frontend/core/utils.js
const escapeHtml = new Function(`${escapeHtmlMatch[0]}; return escapeHtml;`)();

describe('frontend escapeHtml', () => {
    test('escapes HTML special characters', () => {
        expect(escapeHtml(`<tag attr="x">&'`)).toBe('&lt;tag attr=&quot;x&quot;&gt;&amp;&#039;');
    });

    test('preserves numeric zero as text', () => {
        expect(escapeHtml(0)).toBe('0');
    });

    test('preserves boolean false as text', () => {
        expect(escapeHtml(false)).toBe('false');
    });

    test('returns empty string for nullish values', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});
