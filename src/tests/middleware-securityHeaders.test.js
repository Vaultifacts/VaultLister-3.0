// Security Headers Middleware Unit Tests
// Verifies CSP, HSTS, X-Frame-Options, and other OWASP-recommended headers
import { describe, expect, test, beforeAll } from 'bun:test';

const BASE = `http://localhost:${process.env.PORT || 3001}`;
let headers = {};

beforeAll(async () => {
    const resp = await fetch(`${BASE}/api/health`);
    headers = Object.fromEntries(resp.headers.entries());
});

describe('Content Security Policy', () => {
    test('CSP header should be present', () => {
        const csp = headers['content-security-policy'];
        expect(csp).toBeTruthy();
    });

    test('CSP should include default-src directive', () => {
        const csp = headers['content-security-policy'] || '';
        expect(csp).toContain("default-src");
    });

    test('CSP should include script-src with self', () => {
        const csp = headers['content-security-policy'] || '';
        expect(csp).toContain("script-src");
        expect(csp).toContain("'self'");
    });

    test('CSP must include unsafe-inline for SPA compatibility', () => {
        const csp = headers['content-security-policy'] || '';
        expect(csp).toContain("'unsafe-inline'");
    });

    test('CSP should NOT include unsafe-eval', () => {
        const csp = headers['content-security-policy'] || '';
        expect(csp).not.toContain("'unsafe-eval'");
    });

    test('CSP should restrict frame-ancestors', () => {
        const csp = headers['content-security-policy'] || '';
        // frame-ancestors or X-Frame-Options should prevent clickjacking
        const hasFrameAncestors = csp.includes('frame-ancestors');
        const hasXFrameOptions = headers['x-frame-options'];
        expect(hasFrameAncestors || hasXFrameOptions).toBe(true);
    });
});

describe('Anti-Clickjacking', () => {
    test('X-Frame-Options should be DENY or SAMEORIGIN', () => {
        const xfo = headers['x-frame-options'];
        expect(xfo).toBeTruthy();
        expect(['DENY', 'SAMEORIGIN', 'deny', 'sameorigin']).toContain(xfo);
    });
});

describe('MIME Sniffing Protection', () => {
    test('X-Content-Type-Options should be nosniff', () => {
        const xcto = headers['x-content-type-options'];
        expect(xcto).toBe('nosniff');
    });
});

describe('XSS Protection', () => {
    test('X-XSS-Protection should be set', () => {
        const xxp = headers['x-xss-protection'];
        expect(xxp).toBeTruthy();
        expect(xxp).toContain('1');
    });
});

describe('Referrer Policy', () => {
    test('Referrer-Policy should be set', () => {
        const rp = headers['referrer-policy'];
        expect(rp).toBeTruthy();
        // Should be a privacy-respecting policy
        const acceptable = [
            'no-referrer',
            'strict-origin',
            'strict-origin-when-cross-origin',
            'same-origin',
            'origin-when-cross-origin'
        ];
        expect(acceptable.some(p => rp.includes(p))).toBe(true);
    });
});

describe('Permissions Policy', () => {
    test('Permissions-Policy should restrict dangerous features', () => {
        const pp = headers['permissions-policy'];
        expect(pp).toBeTruthy();
        // Should disable geolocation and camera at minimum
        expect(pp).toContain('geolocation=()');
        expect(pp).toContain('camera=()');
    });
});

describe('Cross-Origin Policies', () => {
    test('Cross-Origin-Opener-Policy should be set', () => {
        const coop = headers['cross-origin-opener-policy'];
        expect(coop).toBeTruthy();
    });

    test('Cross-Origin-Resource-Policy should be set', () => {
        const corp = headers['cross-origin-resource-policy'];
        expect(corp).toBeTruthy();
    });
});

describe('Cache Control for API', () => {
    test('API responses should have no-store cache control', () => {
        const cc = headers['cache-control'];
        expect(cc).toBeTruthy();
        expect(cc).toContain('no-store');
    });
});

describe('Headers on Authenticated Endpoints', () => {
    let authHeaders = {};

    test('Authenticated API responses should have same security headers', async () => {
        // Login first
        const loginResp = await fetch(`${BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'demo@vaultlister.com', password: 'DemoPassword123!' })
        });
        const { token } = await loginResp.json();

        // Make authenticated request
        const resp = await fetch(`${BASE}/api/inventory`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        authHeaders = Object.fromEntries(resp.headers.entries());

        // Same security headers should be present
        expect(authHeaders['x-frame-options']).toBeTruthy();
        expect(authHeaders['x-content-type-options']).toBe('nosniff');
        expect(authHeaders['content-security-policy']).toBeTruthy();
    });
});
