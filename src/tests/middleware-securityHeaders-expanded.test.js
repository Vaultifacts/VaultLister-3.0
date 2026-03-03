// Security Headers Middleware — Pure Function Unit Tests
import { describe, expect, test } from 'bun:test';
import {
    cspConfig,
    securityHeadersConfig,
    securityPresets,
    buildCSPWithNonce,
    getPresetHeaders,
    applySecurityHeaders,
    applyDevelopmentHeaders
} from '../backend/middleware/securityHeaders.js';

describe('cspConfig', () => {
    test('has required CSP directive keys', () => {
        const requiredKeys = ['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'connect-src'];
        for (const key of requiredKeys) {
            expect(cspConfig).toHaveProperty(key);
        }
    });

    test('all directive values are arrays', () => {
        for (const [key, value] of Object.entries(cspConfig)) {
            if (key === 'upgrade-insecure-requests') continue;
            expect(Array.isArray(value)).toBe(true);
        }
    });

    test('default-src includes self', () => {
        expect(cspConfig['default-src']).toContain("'self'");
    });

    test('script-src includes self and unsafe-inline', () => {
        expect(cspConfig['script-src']).toContain("'self'");
        expect(cspConfig['script-src']).toContain("'unsafe-inline'");
    });

    test('script-src does NOT include unsafe-eval', () => {
        expect(cspConfig['script-src']).not.toContain("'unsafe-eval'");
    });
});

describe('securityHeadersConfig', () => {
    test('has Content-Security-Policy header', () => {
        expect(typeof securityHeadersConfig['Content-Security-Policy']).toBe('string');
        expect(securityHeadersConfig['Content-Security-Policy'].length).toBeGreaterThan(0);
    });

    test('has X-Frame-Options set to DENY', () => {
        expect(securityHeadersConfig['X-Frame-Options']).toBe('DENY');
    });

    test('has X-Content-Type-Options set to nosniff', () => {
        expect(securityHeadersConfig['X-Content-Type-Options']).toBe('nosniff');
    });

    test('has Referrer-Policy', () => {
        expect(securityHeadersConfig['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    test('has Permissions-Policy string', () => {
        expect(typeof securityHeadersConfig['Permissions-Policy']).toBe('string');
        expect(securityHeadersConfig['Permissions-Policy']).toContain('geolocation=()');
    });

    test('has Cache-Control for sensitive data', () => {
        expect(securityHeadersConfig['Cache-Control']).toContain('no-store');
    });

    test('has Cross-Origin headers', () => {
        expect(securityHeadersConfig['Cross-Origin-Opener-Policy']).toBe('same-origin');
        expect(securityHeadersConfig['Cross-Origin-Resource-Policy']).toBe('same-origin');
    });
});

describe('securityPresets', () => {
    test('has api preset with JSON content type', () => {
        expect(securityPresets.api['Content-Type']).toBe('application/json; charset=utf-8');
        expect(securityPresets.api['X-Content-Type-Options']).toBe('nosniff');
    });

    test('has html preset with HTML content type', () => {
        expect(securityPresets.html['Content-Type']).toBe('text/html; charset=utf-8');
    });

    test('has download preset with attachment disposition', () => {
        expect(securityPresets.download['Content-Disposition']).toBe('attachment');
    });
});

describe('buildCSPWithNonce', () => {
    test('returns a string', () => {
        const csp = buildCSPWithNonce('abc123');
        expect(typeof csp).toBe('string');
    });

    test('embeds the nonce in the CSP string', () => {
        const csp = buildCSPWithNonce('test-nonce-xyz');
        expect(csp).toContain("'nonce-test-nonce-xyz'");
    });

    test('different nonces produce different CSP strings', () => {
        const csp1 = buildCSPWithNonce('nonce-aaa');
        const csp2 = buildCSPWithNonce('nonce-bbb');
        expect(csp1).not.toBe(csp2);
    });

    test('includes self in script-src', () => {
        const csp = buildCSPWithNonce('n1');
        expect(csp).toContain("'self'");
    });

    test('includes unsafe-inline as fallback', () => {
        const csp = buildCSPWithNonce('n1');
        expect(csp).toContain("'unsafe-inline'");
    });
});

describe('getPresetHeaders', () => {
    test('api preset merges security headers with api content type', () => {
        const headers = getPresetHeaders('api');
        expect(headers['Content-Type']).toBe('application/json; charset=utf-8');
        expect(headers['X-Frame-Options']).toBe('DENY');
    });

    test('html preset merges security headers with html content type', () => {
        const headers = getPresetHeaders('html');
        expect(headers['Content-Type']).toBe('text/html; charset=utf-8');
        expect(headers['X-Frame-Options']).toBe('DENY');
    });

    test('unknown preset returns base security headers only', () => {
        const headers = getPresetHeaders('nonexistent');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['Content-Type']).toBeUndefined();
    });

    test('additionalHeaders override preset and base headers', () => {
        const headers = getPresetHeaders('api', { 'X-Custom': 'value', 'X-Frame-Options': 'SAMEORIGIN' });
        expect(headers['X-Custom']).toBe('value');
        expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    });
});

describe('applySecurityHeaders', () => {
    test('returns object with security headers for basic ctx', () => {
        const headers = applySecurityHeaders({ path: '/api/test' });
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    test('overrides Cache-Control for static .js assets', () => {
        const headers = applySecurityHeaders({ path: '/assets/app.js' });
        expect(headers['Cache-Control']).toContain('immutable');
    });

    test('overrides Cache-Control for static .css assets', () => {
        const headers = applySecurityHeaders({ path: '/styles/main.css' });
        expect(headers['Cache-Control']).toContain('immutable');
    });

    test('overrides Cache-Control for image assets', () => {
        const headers = applySecurityHeaders({ path: '/img/logo.png' });
        expect(headers['Cache-Control']).toContain('immutable');
    });

    test('includes CSRF token from ctx', () => {
        const headers = applySecurityHeaders({ path: '/api/test', csrfToken: 'my-csrf-token' });
        expect(headers['X-CSRF-Token']).toBe('my-csrf-token');
    });

    test('merges rate limit headers from ctx', () => {
        const headers = applySecurityHeaders({
            path: '/api/test',
            rateLimitHeaders: { 'X-RateLimit-Remaining': '99' }
        });
        expect(headers['X-RateLimit-Remaining']).toBe('99');
    });

    test('merges additionalHeaders', () => {
        const headers = applySecurityHeaders({ path: '/api/test' }, { 'X-Custom': 'hello' });
        expect(headers['X-Custom']).toBe('hello');
    });
});

describe('applyDevelopmentHeaders', () => {
    test('returns object (empty in non-development env)', () => {
        const headers = applyDevelopmentHeaders({});
        expect(typeof headers).toBe('object');
    });
});
