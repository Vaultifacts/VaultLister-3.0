import { describe, expect, test } from 'bun:test';
import { getCountryCodeFromHeaders, normalizeCountryCode } from '../backend/utils/geo.js';

describe('geo utility', () => {
    test('normalizes valid two-letter country codes', () => {
        expect(normalizeCountryCode('ca')).toBe('CA');
        expect(normalizeCountryCode(' US ')).toBe('US');
    });

    test('rejects unknown or invalid country codes', () => {
        expect(normalizeCountryCode('')).toBe('');
        expect(normalizeCountryCode('XX')).toBe('');
        expect(normalizeCountryCode('T1')).toBe('');
        expect(normalizeCountryCode('USA')).toBe('');
        expect(normalizeCountryCode('1A')).toBe('');
    });

    test('reads Cloudflare country header case-insensitively', () => {
        expect(getCountryCodeFromHeaders({ 'cf-ipcountry': 'ca' })).toBe('CA');
        expect(getCountryCodeFromHeaders({ 'CF-IPCountry': 'US' })).toBe('US');
    });

    test('falls back to other edge country headers', () => {
        expect(getCountryCodeFromHeaders({ 'x-vercel-ip-country': 'gb' })).toBe('GB');
        expect(getCountryCodeFromHeaders({ 'cloudfront-viewer-country': 'de' })).toBe('DE');
    });
});
