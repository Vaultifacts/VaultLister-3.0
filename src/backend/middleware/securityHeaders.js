// Security Headers Middleware
// Implements comprehensive security headers including CSP, HSTS, X-Frame-Options, etc.

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Content Security Policy configuration
 * Prevents XSS, clickjacking, and other code injection attacks
 *
 * SECURITY NOTE: 'unsafe-inline' and 'unsafe-eval' are required for this SPA architecture.
 * For maximum security, migrate to:
 * 1. External script files with nonces
 * 2. Avoid eval() in code and dependencies
 * 3. Use CSP nonces for inline scripts
 */
export const cspConfig = {
    // Default source for all content
    'default-src': ["'self'"],

    // Script sources
    // 'unsafe-eval' removed from both envs — the app does not need eval().
    // 'unsafe-inline' is kept for compatibility but is superseded by the per-request
    // nonce + 'strict-dynamic' that the HTML-serving path injects at runtime.
    'script-src': [
        "'self'",
        "'unsafe-inline'", // Overridden by nonce+strict-dynamic when HTML is served
        'https://www.googletagmanager.com'
    ],

    // Style sources
    'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for dynamic styling
        'https://fonts.googleapis.com'
    ],

    // Font sources
    'font-src': [
        "'self'",
        'data:',
        'https://fonts.gstatic.com'
    ],

    // Image sources - more restrictive in production
    'img-src': IS_PRODUCTION ? [
        "'self'",
        'data:',
        'blob:',
        'https://images.unsplash.com', // Demo images
        'https://res.cloudinary.com',  // User uploads
        'https://www.google-analytics.com'
    ] : [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'http://localhost:*'
    ],

    // Connect sources (AJAX, WebSocket, EventSource)
    'connect-src': IS_PRODUCTION ? [
        "'self'",
        'https://api.anthropic.com',   // AI API
        'wss://vaultlister.com',       // WebSocket (bare domain — wildcard doesn't match it)
        'wss://*.vaultlister.com',     // WebSocket (subdomains)
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://*.analytics.google.com'
    ] : [
        "'self'",
        'http://localhost:*',
        'ws://localhost:*'
    ],

    // Media sources (audio, video)
    'media-src': ["'self'"],

    // Object sources (Flash, Java applets) - none allowed
    'object-src': ["'none'"],

    // Form action sources
    'form-action': ["'self'"],

    // Frame ancestors (who can embed this in iframe) - none allowed
    'frame-ancestors': ["'none'"],

    // Base URI
    'base-uri': ["'self'"],

    // Upgrade insecure requests (HTTP → HTTPS) in production
    'upgrade-insecure-requests': IS_PRODUCTION,

    // Report violations to endpoint (production only)
    ...(IS_PRODUCTION && { 'report-uri': ['/api/csp-report'] })
};

/**
 * Build CSP header string from config
 */
function buildCSPHeader(config) {
    const directives = [];

    for (const [directive, sources] of Object.entries(config)) {
        if (directive === 'upgrade-insecure-requests') {
            if (sources === true) {
                directives.push('upgrade-insecure-requests');
            }
        } else if (Array.isArray(sources) && sources.length > 0) {
            directives.push(`${directive} ${sources.join(' ')}`);
        }
    }

    return directives.join('; ');
}

/**
 * Report-Only CSP — stricter than the enforced policy.
 * Removes 'unsafe-inline' from script-src; nonce + strict-dynamic enforced.
 * Violations are reported to /api/csp-report without breaking the page.
 * Promote to enforced once violation rate reaches zero in production.
 */
export const cspReportOnlyConfig = {
    ...cspConfig,
    'script-src': [
        "'self'",
        // No 'unsafe-inline' — this is the point of the report-only policy
        ...(IS_PRODUCTION ? ["'strict-dynamic'"] : ['http://localhost:*'])
    ],
    'report-uri': ['/api/csp-report']
};

/**
 * Security headers configuration
 */
export const securityHeadersConfig = {
    // Content Security Policy (enforced)
    'Content-Security-Policy': buildCSPHeader(cspConfig),

    // Report-Only CSP — stricter (no unsafe-inline in script-src).
    // Violations reported to /api/csp-report without breaking the page.
    // Promote to enforced once violation rate is zero in production.
    'Content-Security-Policy-Report-Only': buildCSPHeader(cspReportOnlyConfig),

    // Strict Transport Security (HTTPS only in production)
    'Strict-Transport-Security': process.env.NODE_ENV === 'production'
        ? 'max-age=31536000; includeSubDomains; preload'
        : null,

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',

    // XSS filter (legacy but still useful)
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy (feature policy)
    'Permissions-Policy': [
        'geolocation=()',       // Disable geolocation
        'microphone=()',        // Disable microphone
        'camera=(self)',        // Allow camera for AR preview (self only)
        'payment=()',           // Disable payment API
        'usb=()',               // Disable USB
        'magnetometer=()',      // Disable magnetometer
        'interest-cohort=()'    // Opt out of FLoC/Topics API
    ].join(', '),

    // Cross-Origin policies
    // COEP is 'unsafe-none' (not 'require-corp') to allow loading cross-origin
    // images and resources required by the AR preview feature without needing
    // CORP headers on every third-party asset.
    'Cross-Origin-Embedder-Policy': 'unsafe-none',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',

    // Cache control for sensitive data
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(ctx, additionalHeaders = {}) {
    const headers = {};

    // Add all security headers
    for (const [name, value] of Object.entries(securityHeadersConfig)) {
        if (value !== null && value !== undefined) {
            headers[name] = value;
        }
    }

    // Override for static assets (allow caching)
    if (ctx.path && (
        ctx.path.endsWith('.js') ||
        ctx.path.endsWith('.css') ||
        ctx.path.endsWith('.png') ||
        ctx.path.endsWith('.jpg') ||
        ctx.path.endsWith('.svg') ||
        ctx.path.endsWith('.woff') ||
        ctx.path.endsWith('.woff2')
    )) {
        headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        delete headers['Pragma'];
        delete headers['Expires'];
    }

    // Add rate limit headers if present
    if (ctx.rateLimitHeaders) {
        Object.assign(headers, ctx.rateLimitHeaders);
    }

    // Add CSRF token header if present
    if (ctx.csrfToken) {
        headers['X-CSRF-Token'] = ctx.csrfToken;
    }

    // Add any additional headers
    Object.assign(headers, additionalHeaders);

    return headers;
}

/**
 * Development-specific security settings
 */
export function applyDevelopmentHeaders(ctx) {
    // In development, relax some CSP rules
    if (process.env.NODE_ENV === 'development') {
        const devCSP = {
            ...cspConfig,
            'script-src': [
                "'self'",
                "'unsafe-inline'", // Overridden by nonce+strict-dynamic when HTML is served
                'http://localhost:*'
            ],
            'connect-src': [
                "'self'",
                'http://localhost:*',
                'ws://localhost:*'
            ]
        };

        return {
            'Content-Security-Policy': buildCSPHeader(devCSP)
        };
    }

    return {};
}

/**
 * Security header presets for different response types
 */
export const securityPresets = {
    // API responses (JSON)
    api: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
    },

    // HTML responses
    html: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
    },

    // File downloads
    download: {
        'Content-Disposition': 'attachment',
        'X-Content-Type-Options': 'nosniff'
    }
};

/**
 * Build a per-request CSP string that replaces unsafe-inline with a cryptographic
 * nonce + strict-dynamic.  Nonce-capable browsers (all modern ones) honour the nonce
 * and ignore unsafe-inline entirely; legacy browsers fall back to unsafe-inline.
 * unsafe-eval is intentionally absent from both.
 */
export function buildCSPWithNonce(nonce) {
    const noncedConfig = {
        ...cspConfig,
        'script-src': [
            "'self'",
            `'nonce-${nonce}'`,
            ...(IS_PRODUCTION ? ["'strict-dynamic'"] : []),
            "'unsafe-inline'",
            ...(IS_PRODUCTION ? [] : ['http://localhost:*'])
        ],
        // Allow inline event handlers (onclick, onsubmit, etc.) in all envs.
        // When a nonce is present, 'unsafe-inline' in script-src is ignored for
        // event handlers — script-src-attr re-enables them explicitly without
        // weakening the nonce-based inline <script> block protection.
        'script-src-attr': ["'unsafe-inline'"]
    };
    return buildCSPHeader(noncedConfig);
}

/**
 * Build the Report-Only CSP with a per-request nonce.
 * Used alongside buildCSPWithNonce() so both enforced and report-only headers
 * carry matching nonces — without this, nonce-bearing inline scripts would still
 * be blocked by the report-only policy and generate spurious violation reports.
 */
export function buildReportOnlyCSPWithNonce(nonce) {
    const noncedConfig = {
        ...cspReportOnlyConfig,
        'script-src': [
            "'self'",
            `'nonce-${nonce}'`,
            ...(IS_PRODUCTION ? ["'strict-dynamic'"] : ['http://localhost:*'])
            // Intentionally no 'unsafe-inline' — that is the whole point
        ]
    };
    return buildCSPHeader(noncedConfig);
}

/**
 * Get security headers for a specific preset
 */
export function getPresetHeaders(preset, additionalHeaders = {}) {
    const presetHeaders = securityPresets[preset] || {};

    return {
        ...securityHeadersConfig,
        ...presetHeaders,
        ...additionalHeaders
    };
}
