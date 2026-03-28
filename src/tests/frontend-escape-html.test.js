// Frontend escapeHtml — Unit Tests
// Verifies the escapeHtml function defined in src/frontend/core/utils.js
// and mirrored in src/frontend/core-bundle.js.
//
// Key contract (fixed 2026-03-28):
//   - null / undefined  → returns ''
//   - 0, false          → returns '0', 'false'  (falsy but valid content)
//   - empty string      → returns ''
//   - HTML special chars → escaped correctly

import { describe, expect, test } from 'bun:test';

// ─── Inline the function under test ─────────────────────────────────────────
// utils.js is a browser-only script (no exports); reproduce the function here
// so we can run unit tests in Bun without a DOM. The implementation must stay
// in sync with src/frontend/core/utils.js lines 24-34.

function escapeHtml(text) {
    if (text == null) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ─── null / undefined ────────────────────────────────────────────────────────

describe('escapeHtml — null / undefined', () => {
    test('returns empty string for null', () => {
        expect(escapeHtml(null)).toBe('');
    });

    test('returns empty string for undefined', () => {
        expect(escapeHtml(undefined)).toBe('');
    });
});

// ─── falsy-but-valid values ───────────────────────────────────────────────────

describe('escapeHtml — falsy-but-valid values (0, false)', () => {
    test('returns "0" for numeric zero', () => {
        expect(escapeHtml(0)).toBe('0');
    });

    test('returns "false" for boolean false', () => {
        expect(escapeHtml(false)).toBe('false');
    });

    test('returns "" for empty string', () => {
        expect(escapeHtml('')).toBe('');
    });
});

// ─── HTML special characters ─────────────────────────────────────────────────

describe('escapeHtml — HTML special characters', () => {
    test('escapes ampersand', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('escapes less-than', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('escapes greater-than', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    test('escapes double quote', () => {
        expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    test("escapes single quote", () => {
        expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    test('escapes all special chars in one string', () => {
        expect(escapeHtml('<a href="test">it\'s a&b</a>')).toBe(
            '&lt;a href=&quot;test&quot;&gt;it&#039;s a&amp;b&lt;/a&gt;'
        );
    });
});

// ─── safe inputs (no modification expected) ──────────────────────────────────

describe('escapeHtml — safe inputs', () => {
    test('leaves plain text unchanged', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    test('coerces number to string', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    test('coerces true to string', () => {
        expect(escapeHtml(true)).toBe('true');
    });
});
