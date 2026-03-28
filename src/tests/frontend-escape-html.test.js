import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const utilsSource = readFileSync(new URL('../frontend/core/utils.js', import.meta.url), 'utf8');
const functionStart = utilsSource.indexOf('function escapeHtml(text) {');
if (functionStart === -1) {
    throw new Error('escapeHtml function not found in src/frontend/core/utils.js');
}

let braceDepth = 0;
let functionEnd = -1;
for (let i = functionStart; i < utilsSource.length; i++) {
    const char = utilsSource[i];
    if (char === '{') braceDepth++;
    if (char === '}') {
        braceDepth--;
        if (braceDepth === 0) {
            functionEnd = i + 1;
            break;
        }
    }
}

if (functionEnd === -1) {
    throw new Error('Unable to parse escapeHtml function body');
}

const escapeHtmlSource = utilsSource.slice(functionStart, functionEnd);
const context = {};
context.globalThis = context;
vm.runInNewContext(`${escapeHtmlSource}; globalThis.escapeHtml = escapeHtml;`, context);
const { escapeHtml } = context;

if (typeof escapeHtml !== 'function') {
    throw new Error('escapeHtml function not found in src/frontend/core/utils.js');
}

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
