import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { analyticsService } from '../services/analytics.js';
import { logger } from '../shared/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', '..', '..', 'public');

export async function userAnalyticsRouter(ctx) {
    const { method, path, query, user } = ctx;

    if (!user) {
        return { status: 401, data: { error: 'Authentication required' } };
    }

    // Track page view
    if (method === 'POST' && path === '/page-view') {
        const { page } = ctx.body;
        analyticsService.trackPageView(page, user, ctx.request);
        return { status: 200, data: { success: true } };
    }

    // Track action
    if (method === 'POST' && path === '/action') {
        const { action, target } = ctx.body;
        analyticsService.trackAction(action, target, user, ctx.request);
        return { status: 200, data: { success: true } };
    }

    // Get user sessions (admin)
    if (method === 'GET' && path === '/sessions') {
        if (!user.is_admin) {
            return { status: 403, data: { error: 'Admin access required' } };
        }
        const userId = query.userId;
        const sessions = analyticsService.getUserSessions(userId || user.id);
        return { status: 200, data: { sessions } };
    }

    return { status: 404, data: { error: 'Not found' } };
}

export async function csrfTokenRouter(ctx) {
    // Simple route to get CSRF token - token is already in ctx.csrfToken from middleware
    return { status: 200, data: { csrfToken: ctx.csrfToken || 'token-not-available' } };
}

export async function docsRouter(ctx) {
    const { method } = ctx;
    if (method !== 'GET') {
        return { status: 405, data: { error: 'Method not allowed' } };
    }
    const openapiPath = join(PUBLIC_DIR, 'api-docs', 'openapi.yaml');
    if (!existsSync(openapiPath)) {
        return { status: 404, data: { error: 'OpenAPI spec not found' } };
    }
    // Return spec location and redirect hint; YAML content served as static file
    return {
        status: 200,
        data: {
            specUrl: '/api-docs/openapi.yaml',
            uiUrl: '/api-docs/index.html',
            format: 'OpenAPI 3.0',
            description: 'VaultLister API specification — visit specUrl for the raw YAML or uiUrl for Swagger UI'
        }
    };
}

export async function cspReportRouter(ctx) {
    // CSP violation report endpoint — referenced in Content-Security-Policy report-uri directive.
    // Accepts POST from browsers when a CSP violation occurs. Must be public (no CSRF, no auth).
    if (ctx.method !== 'POST') return { status: 405, data: { error: 'Method not allowed' } };
    const report = ctx.body?.['csp-report'] || ctx.body || {};
    logger.warn('[CSP] Violation report', {
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        originalPolicy: report['original-policy'],
    });
    return { status: 204, data: null };
}
