// src/backend/server.js - VaultLister Backend Server - Bun.js with robust shutdown hooks and logging (beginner-friendly)
const startTime = performance.now();
import './env.js'; // Validate required env vars before anything else — exits with clear errors on misconfiguration
import Sentry from './instrument.js'; // Init Sentry before any other module loads
import { readFileSync, existsSync, appendFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { gzipSync } from 'zlib';
import crypto from 'crypto';
import path from 'path';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, closeDatabase, getStatementCacheStats } from './db/database.js';
import { authRouter } from './routes/auth.js';
import { inventoryRouter } from './routes/inventory.js';
import { listingsRouter } from './routes/listings.js';
import { shopsRouter } from './routes/shops.js';
import { salesRouter } from './routes/sales.js';
import { offersRouter } from './routes/offers.js';
import { automationsRouter } from './routes/automations.js';
import { analyticsRouter } from './routes/analytics.js';
import { aiRouter } from './routes/ai.js';
import { tasksRouter } from './routes/tasks.js';
import { templatesRouter } from './routes/templates.js';
import { oauthRouter } from './routes/oauth.js';
const { mockOAuthRouter } = process.env.NODE_ENV !== 'production'
    ? await import('./routes/mock-oauth.js')
    : { mockOAuthRouter: null };
import { imageBankRouter } from './routes/imageBank.js';
import { chatbotRouter } from './routes/chatbot.js';
import { communityRouter } from './routes/community.js';
import { extensionRouter } from './routes/extension.js';
import { helpRouter } from './routes/help.js';
import { roadmapRouter } from './routes/roadmap.js';
import { feedbackRouter } from './routes/feedback.js';
import { calendarRouter } from './routes/calendar.js';
import { checklistsRouter } from './routes/checklists.js';
import { financialsRouter } from './routes/financials.js';
import { shippingProfilesRouter } from './routes/shippingProfiles.js';
import { websocketService } from './services/websocket.js';
import { skuRulesRouter } from './routes/skuRules.js';
import { receiptParserRouter } from './routes/receiptParser.js';
import { batchPhotoRouter } from './routes/batchPhoto.js';
import { notificationsRouter } from './routes/notifications.js';
import { emailOAuthRouter } from './routes/emailOAuth.js';
import { ordersRouter } from './routes/orders.js';
import { webhooksRouter } from './routes/webhooks.js';
import { pushSubscriptionsRouter } from './routes/pushSubscriptions.js';
import { predictionsRouter } from './routes/predictions.js';
import { suppliersRouter } from './routes/suppliers.js';
import { marketIntelRouter } from './routes/marketIntel.js';
import { duplicatesRouter } from './routes/duplicates.js';
import { barcodeRouter } from './routes/barcode.js';
import { teamsRouter } from './routes/teams.js';
import { relistingRouter } from './routes/relisting.js';
import { shippingLabelsRouter } from './routes/shippingLabels.js';
import { inventoryImportRouter } from './routes/inventoryImport.js';
import { whatnotRouter } from './routes/whatnot.js';
import { reportsRouter } from './routes/reports.js';
import { securityRouter } from './routes/security.js';
import { rateLimitDashboardRouter, stopRateLimitDashboard } from './routes/rateLimitDashboard.js';
import { socialAuthRouter } from './routes/socialAuth.js';
import { gdprRouter } from './routes/gdpr.js';
import { outgoingWebhooksRouter } from './services/outgoingWebhooks.js';
import { emailMarketingRouter, emailMarketing } from './services/emailMarketing.js';
import { enhancedMFARouter } from './services/enhancedMFA.js';
import { auditLogRouter, auditLog } from './services/auditLog.js';
import { pushNotificationsRouter } from './routes/pushNotifications.js';
// Notion integration removed 2026-04-03 (see docs/LAUNCH_AUDIT_2026-04-03.md)
import { sizeChartsRouter } from './routes/sizeCharts.js';
import { legalRouter } from './routes/legal.js';
import { affiliateRouter } from './routes/affiliate.js';
import { recentlyDeletedRouter } from './routes/recentlyDeleted.js';
import { billingRouter } from './routes/billing.js';
import { salesEnhancementsRouter } from './routes/salesEnhancements.js';
import { competitorTrackingRouter } from './routes/competitorTracking.js';
import { searchAnalyticsRouter } from './routes/searchAnalytics.js';
import { expenseTrackerRouter } from './routes/expenseTracker.js';
import { skuSyncRouter } from './routes/skuSync.js';
import { syncAuditLogRouter } from './routes/syncAuditLog.js';

import { qrAnalyticsRouter } from './routes/qrAnalytics.js';
import { watermarkRouter } from './routes/watermark.js';
import { whatnotEnhancedRouter } from './routes/whatnotEnhanced.js';
import { onboardingRouter } from './routes/onboarding.js';
import { offlineSyncRouter } from './routes/offlineSync.js';
import { integrationsRouter } from './routes/integrations.js';
import { contactRouter } from './routes/contact.js';
import { currencyRouter } from './routes/currency.js';
import { monitoring } from './services/monitoring.js';
import { monitoringRouter } from './routes/monitoring.js';
import { register as promRegister, recordHttpRequest } from './services/prometheusMetrics.js';
import { featureFlags } from './services/featureFlags.js';
import { settingsRouter } from './routes/settings.js';
import { accountRouter } from './routes/account.js';
import { analyticsService } from './services/analytics.js';
import { authenticateToken } from './middleware/auth.js';
import redisService from './services/redis.js';
import { get as redisGet } from './services/redis.js';
import emailService from './services/email.js';
import { applyRateLimit, stopRateLimiter } from './middleware/rateLimiter.js';
import { applyCSRFProtection, addCSRFToken, stopCSRF } from './middleware/csrf.js';
import { applySecurityHeaders, securityHeadersConfig, buildCSPWithNonce } from './middleware/securityHeaders.js';
import { handleError } from './middleware/errorHandler.js';
import { logRequestComplete } from './middleware/requestLogger.js';
import { generateETag, etagMatches } from './middleware/cache.js';
import { CDN_URL, getPreloadHints } from './middleware/cdn.js';
import { compressBody } from './middleware/compression.js';
import { logger } from './shared/logger.js';
import { TIMEOUTS, INTERVALS } from './shared/constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');
const PUBLIC_DIR = join(ROOT_DIR, 'public');
const FRONTEND_DIR = join(ROOT_DIR, 'src', 'frontend');
const SHARED_DIR = join(ROOT_DIR, 'src', 'shared');
const DIST_DIR = join(ROOT_DIR, 'dist');
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

// Build hash — injected into sw.js at serve time so every deploy busts the SW cache.
// Falls back to a startup timestamp so the cache always invalidates on server restart.
// Sanitized to only allow alphanumeric/hex characters to prevent injection via git output.
const BUILD_HASH = (() => {
    try {
        const raw = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], { cwd: ROOT_DIR })
            .stdout.toString().trim() || Date.now().toString(36);
        // Allow only hex chars (git short hash) or base-36 digits (timestamp fallback)
        return /^[0-9a-z]+$/i.test(raw) ? raw : Date.now().toString(36);
    } catch {
        return Date.now().toString(36);
    }
})();

// Valid chunk filename pattern: alphanumeric, hyphens, dots, forward slashes for subdirs.
// Prevents path traversal via chunk filenames requested by the SPA router.
const SAFE_CHUNK_RE = /^\/[a-zA-Z0-9_\-./]+\.(js|css|json|html|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|webp|webmanifest|xml|txt|yaml|yml)$/;

// File extensions to gzip on the fly
const GZIP_EXTS = new Set(['.js', '.css', '.json', '.html', '.svg']);
const LOG_PATH = join(ROOT_DIR, 'logs', 'server.log');  // Log in root/logs

// Logging function — buffered async writes to avoid blocking the event loop
let _logBuffer = '';
let _logFlushTimer = null;
function _flushLog() {
    if (!_logBuffer) return;
    const data = _logBuffer;
    _logBuffer = '';
    _logFlushTimer = null;
    try {
        appendFileSync(LOG_PATH, data, 'utf8');
    } catch (e) {
        // Silently ignore write failures — don't crash the server over logging
    }
}
function log(message) {
    _logBuffer += `[${new Date().toISOString()}] ${message}\n`;
    if (!_logFlushTimer) {
        _logFlushTimer = setTimeout(_flushLog, 100);
    }
}
// Ensure logs are flushed on exit
process.on('exit', _flushLog);

// Log startup early (test log function)
log('Server starting...');

// PID file (local dev only — Railway is single-process, Railway captures stdout)
const PID_PATH = join(ROOT_DIR, 'logs', 'server.pid');
if (process.env.NODE_ENV !== 'production') {
    mkdirSync(join(ROOT_DIR, 'logs'), { recursive: true });
    writeFileSync(PID_PATH, String(process.pid));
    log(`PID ${process.pid} written to ${PID_PATH}`);
}

// Hoisted for access in gracefulShutdown (declared inside main())
let server;
async function main() {

// Initialize database
await initializeDatabase();
log('Database initialized');

// Initialize Redis service (with in-memory fallback)
redisService.init();
log('Redis service initialized');

// Initialize Email service
emailService.init();
log('Email service initialized');

// Initialize monitoring once before accepting traffic
monitoring.init();
log('Monitoring initialized');

// MIME types for static files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webp': 'image/webp',
    '.webmanifest': 'application/manifest+json',
    '.xml': 'application/xml',
    '.txt': 'text/plain'
};

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL;
const allowedOrigins = [
    // Localhost origins only allowed in non-production environments
    ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:5173'] : []),
    // Only allow FRONTEND_URL if it's a valid HTTP(S) URL (reject wildcards)
    ...(frontendUrl && frontendUrl !== '*' && /^https?:\/\//.test(frontendUrl) ? [frontendUrl] : []),
    // Additional origins from CORS_ORIGINS env var (comma-separated)
    ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(s => s && /^https?:\/\//.test(s))
];

// Generate CORS headers based on request origin
function getCorsHeaders(request) {
    const origin = request.headers.get('origin');
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
        'Access-Control-Max-Age': '86400'
    };

    // Allow whitelisted origins only — never wildcard when credentials are used
    if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Access-Control-Expose-Headers'] = 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After, X-CSRF-Token';
        // Vary header signals to proxies that the response varies by Origin
        headers['Vary'] = 'Origin';
    }
    // Same-origin requests (no Origin header) need no CORS headers

    return headers;
}

// Compression helper
function shouldCompress(contentType) {
    return contentType && (
        contentType.includes('text/') ||
        contentType.includes('application/json') ||
        contentType.includes('application/javascript')
    );
}

// Module-level caches — computed once at startup
let _APP_VERSION = '1.0.0';
try {
    const pkg = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'));
    _APP_VERSION = pkg.version || _APP_VERSION;
} catch {}

// SECURITY: Warn if OAUTH_MODE is not 'real' in production — all marketplace connections will use mock tokens
if (IS_PROD && process.env.OAUTH_MODE !== 'real') {
    logger.warn('[SECURITY] OAUTH_MODE is not set to "real" in production — all marketplace connections will use mock tokens. Set OAUTH_MODE=real in environment variables.');
}

const _landingHtmlPath = join(PUBLIC_DIR, 'landing.html');
// landing.html is read fresh on each request in dev so edits are visible without restart

const _indexHtmlPath = join(FRONTEND_DIR, 'index.html');
// index.html is read fresh on each request in dev so edits are visible without restart

// Route handlers
// Route prefix registry — each key is a unique prefix, dispatched longest-first.
// Audited 2026-03-28: no duplicate method+path conflicts across route files (#173).
const apiRoutes = {
    '/api/auth': authRouter,
    '/api/inventory': inventoryRouter,
    '/api/listings': listingsRouter,
    '/api/shops': shopsRouter,
    '/api/sales': salesRouter,
    '/api/offers': offersRouter,
    '/api/automations': automationsRouter,
    '/api/analytics': analyticsRouter,
    '/api/ai': aiRouter,
    '/api/tasks': tasksRouter,
    '/api/templates': templatesRouter,
    '/api/oauth': oauthRouter,
    '/api/image-bank': imageBankRouter,
    '/api/chatbot': chatbotRouter,
    '/api/community': communityRouter,
    '/api/extension': extensionRouter,
    '/api/help': helpRouter,
    '/api/roadmap': roadmapRouter,
    '/api/feedback': feedbackRouter,
    '/api/calendar': calendarRouter,
    '/api/checklists': checklistsRouter,
    '/api/financials': financialsRouter,
    '/api/shipping-profiles': shippingProfilesRouter,
    '/api/sku-rules': skuRulesRouter,
    '/api/receipts': receiptParserRouter,
    '/api/batch-photo': batchPhotoRouter,
    '/api/notifications': notificationsRouter,
    '/api/email': emailOAuthRouter,
    '/api/orders': ordersRouter,
    '/api/webhooks': webhooksRouter,
    '/api/push-subscriptions': pushSubscriptionsRouter,
    '/api/predictions': predictionsRouter,
    '/api/suppliers': suppliersRouter,
    '/api/market-intel': marketIntelRouter,
    '/api/size-charts': sizeChartsRouter,
    '/api/legal': legalRouter,
    '/api/affiliate': affiliateRouter,
    '/api/recently-deleted': recentlyDeletedRouter,
    '/api/billing': billingRouter,
    '/api/sales-tools': salesEnhancementsRouter,
    '/api/duplicates': duplicatesRouter,
    '/api/barcode': barcodeRouter,
    '/api/teams': teamsRouter,
    '/api/relisting': relistingRouter,
    '/api/shipping-labels-mgmt': shippingLabelsRouter,
    '/api/inventory-import': inventoryImportRouter,
    '/api/whatnot': whatnotRouter,
    '/api/reports': reportsRouter,
    '/api/security': securityRouter,
    '/api/rate-limits': rateLimitDashboardRouter,
    '/api/social-auth': socialAuthRouter,
    '/api/gdpr': gdprRouter,
    '/api/account': accountRouter,
    '/api/outgoing-webhooks': outgoingWebhooksRouter,
    '/api/email-marketing': emailMarketingRouter,
    '/api/mfa': enhancedMFARouter,
    '/api/audit': auditLogRouter,
    '/api/push-notifications': pushNotificationsRouter,
    // '/api/notion': removed 2026-04-03
    '/api/competitor-tracking': competitorTrackingRouter,
    '/api/search-analytics': searchAnalyticsRouter,
    '/api/expenses': expenseTrackerRouter,
    '/api/sku-sync': skuSyncRouter,
    '/api/sync': syncAuditLogRouter,
    '/api/qr-analytics': qrAnalyticsRouter,
    '/api/watermark': watermarkRouter,
    '/api/whatnot-enhanced': whatnotEnhancedRouter,
    '/api/onboarding': onboardingRouter,
    '/api/offline-sync': offlineSyncRouter,
    '/api/integrations': integrationsRouter,
    '/api/currency': currencyRouter,
    '/api/monitoring': monitoringRouter,
    '/api/settings': settingsRouter,
    '/api/contact': contactRouter,
    '/api/feature-flags': async (ctx) => {
        const { method, path, user } = ctx;

        // GET /api/feature-flags - Get flags for current user
        if (method === 'GET' && (path === '/' || path === '')) {
            const flags = await featureFlags.getFlagsForUser(user);
            return { status: 200, data: { flags } };
        }

        // GET /api/feature-flags/all - Admin: get all flags
        if (method === 'GET' && path === '/all') {
            if (!user || !user.is_admin) {
                return { status: 403, data: { error: 'Admin access required' } };
            }
            return { status: 200, data: { flags: featureFlags.getAllFlags() } };
        }

        // PUT /api/feature-flags/:name - Admin: update a flag
        if (method === 'PUT' && path.startsWith('/')) {
            if (!user || !user.is_admin) {
                return { status: 403, data: { error: 'Admin access required' } };
            }
            const flagName = path.slice(1);
            if (!flagName) {
                return { status: 400, data: { error: 'Flag name required' } };
            }
            const { enabled, rolloutPercentage } = ctx.body || {};
            if (typeof enabled !== 'boolean') {
                return { status: 400, data: { error: 'enabled (boolean) is required' } };
            }
            const update = { enabled };
            if (rolloutPercentage !== undefined) {
                update.rolloutPercentage = rolloutPercentage;
            }
            featureFlags.setFlag(flagName, update);
            return { status: 200, data: { success: true, flag: flagName, enabled } };
        }

        return { status: 404, data: { error: 'Not found' } };
    },
    '/api/user-analytics': async (ctx) => {
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
    },
    '/api/csrf-token': async (ctx) => {
        // Simple route to get CSRF token - token is already in ctx.csrfToken from middleware
        return { status: 200, data: { csrfToken: ctx.csrfToken || 'token-not-available' } };
    },
    '/api/docs': async (ctx) => {
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
    },
    '/api/health': async () => {
        // Health check endpoint - returns basic status only (no sensitive metrics)
        let dbStatus = 'ok';
        try {
            const { query } = await import('./db/database.js');
            await query.get('SELECT 1');
        } catch (e) {
            dbStatus = 'error';
        }

        return {
            status: 200,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: _APP_VERSION,
                database: { status: dbStatus }
            }
        };
    },
    '/api/health/live': async () => {
        // Liveness probe — answers: "is the process running?"
        // Always returns 200 as long as the server is up. Used by load balancers
        // and Docker HEALTHCHECK to distinguish "process crashed" from "dependency down".
        return { status: 200, data: { status: 'ok' } };
    },
    '/api/health/ready': async () => {
        // Readiness probe — answers: "is the server ready to handle traffic?"
        // Returns 503 if any critical dependency is unavailable.
        const checks = {};
        let ready = true;

        // Database check
        try {
            const { query } = await import('./db/database.js');
            await query.get('SELECT 1');
            checks.database = 'ok';
        } catch (e) {
            checks.database = 'error';
            ready = false;
        }

        // Redis check (optional dependency — degraded but not fatal if unavailable)
        try {
            const redisClient = redisService.getClient();
            if (redisClient) {
                const pong = await Promise.race([
                    redisClient.ping(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUTS.DB_HEALTH_CHECK_MS))
                ]);
                checks.redis = pong === 'PONG' ? 'ok' : 'degraded';
            } else {
                checks.redis = 'degraded';
            }
        } catch (e) {
            checks.redis = 'unavailable';
            // Redis is optional (in-memory fallback exists) — not a readiness failure
        }

        return {
            status: ready ? 200 : 503,
            data: {
                status: ready ? 'ok' : 'degraded',
                checks,
                timestamp: new Date().toISOString(),
            }
        };
    },
    '/api/health/detailed': async () => {
        // Detailed health check — unauthenticated, safe for external uptime monitors
        const { query: dbQuery } = await import('./db/database.js');
        let dbConnected = false;
        try {
            await dbQuery.get('SELECT 1');
            dbConnected = true;
        } catch (_) {}

        const mem = process.memoryUsage();
        return {
            status: dbConnected ? 200 : 503,
            data: {
                status: dbConnected ? 'healthy' : 'unhealthy',
                uptime: Math.floor(process.uptime()),
                memory: {
                    rss: Math.round(mem.rss / (1024 * 1024)),
                    heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
                    heapTotal: Math.round(mem.heapTotal / (1024 * 1024))
                },
                db: { connected: dbConnected },
                timestamp: new Date().toISOString()
            }
        };
    },
    '/api/status': async () => {
        const appVersion = _APP_VERSION;

        const monMetrics = monitoring.getMetrics();

        // In production, only return minimal safe information
        if (IS_PROD) {
            return {
                status: 200,
                data: {
                    status: 'ok',
                    timestamp: new Date().toISOString()
                }
            };
        }

        // In development, return full details
        return {
            status: 200,
            data: {
                status: 'ok',
                version: appVersion,
                runtime: process.version,
                uptime: Math.floor(process.uptime()),
                environment: process.env.NODE_ENV || 'development',
                database: monMetrics.database,
                statementCache: getStatementCacheStats(),
                websocket: websocketService.getStats()
            }
        };
    },
    '/api/workers/health': async () => {
        // Background worker health — returns last-run timestamps and stale detection.
        // Public (no auth), matching the /api/health pattern. Safe for external monitoring.
        const now = Date.now();
        const workerDefs = [
            { key: 'taskWorker',            intervalMs: 10 * 1000,      staleThresholdMs: 30_000 },
            { key: 'gdprWorker',            intervalMs: 60 * 60 * 1000, staleThresholdMs: 3 * 60 * 60 * 1000 },
            { key: 'priceCheckWorker',      intervalMs: 30 * 60 * 1000, staleThresholdMs: 90 * 60 * 1000 },
            { key: 'emailPollingWorker',    intervalMs: 5 * 60 * 1000,  staleThresholdMs: 15 * 60 * 1000 },
            { key: 'tokenRefreshScheduler', intervalMs: 5 * 60 * 1000,  staleThresholdMs: 15 * 60 * 1000 },
        ];

        const workers = {};
        let overallOk = true;

        for (const { key, intervalMs, staleThresholdMs } of workerDefs) {
            let heartbeat = null;
            try {
                const rawHeartbeat = await redisGet(`worker:health:${key}`);
                heartbeat = rawHeartbeat ? JSON.parse(rawHeartbeat) : null;
            } catch {
                heartbeat = null;
            }

            const lastRunMs = heartbeat?.lastRun ? new Date(heartbeat.lastRun).getTime() : 0;
            let workerStatus;
            if (!heartbeat) {
                workerStatus = 'stopped';
                overallOk = false;
            } else if (!lastRunMs) {
                workerStatus = 'starting';
            } else if (now - lastRunMs > staleThresholdMs) {
                workerStatus = 'stale';
                overallOk = false;
            } else {
                workerStatus = 'ok';
            }
            workers[key] = {
                status: workerStatus,
                lastRun: heartbeat?.lastRun || null,
                intervalMs,
                staleThresholdMs,
            };
        }

        return {
            status: overallOk ? 200 : 503,
            data: {
                version: 'v1',
                overall: overallOk ? 'ok' : 'degraded',
                workers,
                timestamp: new Date().toISOString(),
            }
        };
    },
    '/api/csp-report': async (ctx) => {
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
    },
    ...(process.env.NODE_ENV !== 'production' ? { '/mock-oauth': mockOAuthRouter } : {})
};

// Sorted once at startup — longest prefix first so most-specific routes match first
const _sortedApiRoutes = Object.entries(apiRoutes).sort((a, b) => b[0].length - a[0].length);

// Protected routes that require authentication
const protectedPrefixes = [
    '/api/inventory',
    '/api/listings',
    '/api/shops',
    '/api/sales',
    '/api/offers',
    '/api/automations',
    '/api/analytics',
    '/api/ai',
    '/api/tasks',
    '/api/templates',
    '/api/oauth',
    '/api/image-bank',
    '/api/chatbot',
    '/api/community',
    '/api/extension',
    '/api/help',
    '/api/roadmap',
    '/api/feedback',
    '/api/calendar',
    '/api/checklists',
    '/api/financials',
    '/api/shipping-profiles',
    '/api/sku-rules',
    '/api/receipts',
    '/api/batch-photo',
    '/api/notifications',
    '/api/email',
    '/api/orders',
    '/api/webhooks',
    '/api/push-subscriptions',
    '/api/predictions',
    '/api/suppliers',
    '/api/market-intel',
    '/api/size-charts',
    '/api/duplicates',
    '/api/barcode',
    '/api/teams',
    '/api/relisting',
    '/api/shipping-labels-mgmt',
    '/api/inventory-import',
    '/api/whatnot',
    '/api/reports',
    '/api/legal',
    '/api/affiliate',
    '/api/recently-deleted',
    '/api/billing',
    '/api/sales-tools',
    '/api/csrf-token',
    '/api/security',
    '/api/push-notifications',
    // '/api/notion', // removed 2026-04-03
    '/api/competitor-tracking',
    '/api/search-analytics',
    '/api/expenses',
    '/api/sku-sync',
    '/api/qr-analytics',
    '/api/watermark',
    '/api/whatnot-enhanced',
    '/api/onboarding',
    '/api/offline-sync',
    '/api/rate-limits',
    '/api/social-auth',
    '/api/gdpr',
    '/api/account',
    '/api/outgoing-webhooks',
    '/api/email-marketing',
    '/api/mfa',
    '/api/audit',
    '/api/feature-flags',
    '/api/user-analytics',
    '/api/auth/password',
    '/api/auth/sessions',
    '/api/auth/me',
    '/api/auth/profile',
    '/api/integrations',
    '/api/monitoring',
    '/api/settings'
];

// Parse JSON body
const MAX_BODY_SIZE_DEFAULT = 10 * 1024 * 1024; // 10MB default
const MAX_BODY_SIZE_JSON    =  1 * 1024 * 1024; //  1MB for standard JSON API routes
const MAX_BODY_SIZE_UPLOAD  = 50 * 1024 * 1024; // 50MB for file upload routes

const UPLOAD_ROUTE_PREFIXES = ['/api/image-bank', '/api/batch-photo'];

function getBodySizeLimit(pathname) {
    for (const prefix of UPLOAD_ROUTE_PREFIXES) {
        if (pathname.startsWith(prefix)) return MAX_BODY_SIZE_UPLOAD;
    }
    if (pathname.startsWith('/api/')) return MAX_BODY_SIZE_JSON;
    return MAX_BODY_SIZE_DEFAULT;
}

async function parseBody(request, maxSize = MAX_BODY_SIZE_DEFAULT) {
    try {
        // Check content-length header first (fast reject)
        const contentLength = parseInt(request.headers.get('content-length') || '0');
        if (contentLength > maxSize) {
            return { error: 'Request body too large' };
        }

        const text = await request.text();

        // Also check actual body size (content-length can be spoofed)
        if (text.length > maxSize) {
            return { error: 'Request body too large' };
        }

        return text ? JSON.parse(text) : {};
    } catch {
        return { error: 'Invalid JSON in request body' };
    }
}

// Parse URL parameters
function parseParams(url, pattern) {
    const urlParts = url.split('/').filter(Boolean);
    const patternParts = pattern.split('/').filter(Boolean);
    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = urlParts[i];
        }
    }

    return params;
}

// In-memory gzip cache — keyed by absolute filePath; populated once per file per process lifetime.
// Eliminates the blocking gzipSync cost on every request for large static assets.
const gzipCache = new Map();

// Idempotency key cache — prevents double-submit on POST/PUT/PATCH.
// Stored in Redis (with in-memory fallback) via redisService.

// Serve static files
function serveStatic(pathname, request) {
    // Reject null bytes in path (potential bypass vector)
    if (pathname.includes('\0')) return null;

    // Reject paths that don't match the safe filename pattern.
    // This blocks path traversal sequences (../, ..\) and unexpected characters
    // before the directory-resolution checks below have a chance to run.
    if (!SAFE_CHUNK_RE.test(pathname)) return null;

    // In production, prefer dist/ for app.js (minified build)
    let filePath;
    let isValidPath = false;

    const resolvedPublicDir = path.resolve(PUBLIC_DIR);
    const resolvedFrontendDir = path.resolve(FRONTEND_DIR);
    const resolvedSharedDir = path.resolve(SHARED_DIR);
    const resolvedDistDir = path.resolve(DIST_DIR);

    if (IS_PROD && pathname.endsWith('.js')) {
        // Remap /core-bundle.js to /app.js (minified build output from dist/)
        const distName = pathname === '/core-bundle.js' ? '/app.js' : pathname;
        const distPath = join(DIST_DIR, distName);
        const resolvedDist = path.resolve(distPath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (resolvedDist.startsWith(resolvedDistDir) && existsSync(distPath)) {
            filePath = distPath;
            isValidPath = true;
        }
    }

    // In production, prefer dist/main.css (purged by build step) for the main stylesheet
    if (IS_PROD && !filePath && pathname === '/styles/main.css') {
        const distCss = join(DIST_DIR, 'main.css');
        const resolvedDist = path.resolve(distCss); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (resolvedDist.startsWith(resolvedDistDir) && existsSync(distCss)) {
            filePath = distCss;
            isValidPath = true;
        }
    }

    if (!filePath) {
        // Try public directory first
        filePath = join(PUBLIC_DIR, pathname);
        const resolvedPath = path.resolve(filePath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        isValidPath = resolvedPath.startsWith(resolvedPublicDir);

        if (!existsSync(filePath)) {
            // Try frontend directory
            filePath = join(FRONTEND_DIR, pathname);
            const newResolvedPath = path.resolve(filePath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            isValidPath = newResolvedPath.startsWith(resolvedFrontendDir);

            if (!isValidPath || !existsSync(filePath)) {
                // Try dist directory for chunk files (dev mode fallback)
                const distPath = join(DIST_DIR, pathname);
                const resolvedDist = path.resolve(distPath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                if (resolvedDist.startsWith(resolvedDistDir) && existsSync(distPath)) {
                    filePath = distPath;
                    isValidPath = true;
                } else {
                    // Try shared directory (for /shared/* paths like presets.js)
                    const sharedPath = join(SHARED_DIR, pathname.replace(/^\/shared\//, '/'));
                    const resolvedShared = path.resolve(sharedPath); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
                    if (resolvedShared.startsWith(resolvedSharedDir) && existsSync(sharedPath)) {
                        filePath = sharedPath;
                        isValidPath = true;
                    } else {
                        return null;
                    }
                }
            }
        }
    }

    // Block access if path traversal detected
    if (!isValidPath) {
        return null;
    }

    if (!existsSync(filePath)) {
        return null;
    }

    try {
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const dynamicHeaders = getCorsHeaders(request);

        // Gzip compressible assets if client supports it
        const acceptEncoding = request.headers.get('Accept-Encoding') || '';
        const supportsGzip = acceptEncoding.includes('gzip') && GZIP_EXTS.has(ext);

        let content = readFileSync(filePath);
        // Service worker must never be cached — browser needs to check for updates.
        // Inject BUILD_HASH so the SW's internal cache name changes on every deploy,
        // forcing the browser to install the new SW and discard stale cached assets.
        const isServiceWorker = filePath.endsWith('sw.js');
        if (isServiceWorker) {
            content = Buffer.from(
                content.toString().replace(/CACHE_VERSION\s*=\s*'[^']*'/, `CACHE_VERSION = '${BUILD_HASH}'`)
            );
        }
        // app.js?v=HASH and chunk-*.js?v=HASH: content-addressed → cache forever
        // Everything else in prod: no-cache (URL is mutable, content may change on deploy)
        const isVersionedAsset = request.url.includes('?v=');
        const cacheControl = isServiceWorker
            ? 'no-cache, no-store, must-revalidate'
            : isVersionedAsset && IS_PROD
                ? 'public, max-age=31536000, immutable'
                : IS_PROD ? 'no-cache, must-revalidate' : 'public, max-age=3600';

        const responseHeaders = {
            'Content-Type': contentType,
            'Cache-Control': cacheControl,
            'Vary': 'Accept-Encoding',
            ...dynamicHeaders
        };

        if (supportsGzip) {
            if (IS_PROD) {
                if (!gzipCache.has(filePath)) {
                    gzipCache.set(filePath, gzipSync(content, { level: 6 }));
                }
                content = gzipCache.get(filePath);
            } else {
                content = gzipSync(content, { level: 6 });
            }
            responseHeaders['Content-Encoding'] = 'gzip';
            responseHeaders['Content-Length'] = String(content.length);
        }

        return new Response(content, { headers: responseHeaders });
    } catch {
        return null;
    }
}

// Request timeout helper.
// Races a handler promise against a deadline. On timeout returns a 408 response.
// timeoutMs of 0 disables the timeout (used for WebSocket upgrades and streaming routes).
function withRequestTimeout(handlerPromise, timeoutMs) {
    if (!timeoutMs) return handlerPromise;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve(new Response(
                JSON.stringify({ error: 'Request Timeout', status: 408 }),
                { status: 408, headers: { 'Content-Type': 'application/json' } }
            ));
        }, timeoutMs);
        handlerPromise.then((result) => {
            clearTimeout(timer);
            resolve(result);
        }).catch((err) => {
            clearTimeout(timer);
            resolve(new Response(
                JSON.stringify({ error: 'Internal Server Error', status: 500 }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            ));
        });
    });
}

// Main server handler
server = Bun.serve({
    port: process.env.PORT || 3000,
    hostname: '0.0.0.0',

    async fetch(request, server) {
        const url = new URL(request.url);
        const pathname = url.pathname;
        const method = request.method;

        // Reject excessively long URLs (DoS prevention)
        if (request.url.length > 8192) {
            return new Response(JSON.stringify({ error: 'URI too long' }), {
                status: 414,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Maintenance mode — checked before all routing except health probes.
        // Set MAINTENANCE_MODE=true in .env to activate. Health endpoints bypass it.
        if (process.env.MAINTENANCE_MODE === 'true') {
            const isHealthPath = pathname === '/api/health' ||
                pathname === '/api/health/live' ||
                pathname === '/api/health/ready' ||
                pathname === '/api/workers/health' ||
                pathname === '/api/status';
            if (!isHealthPath) {
                if (pathname.startsWith('/api/')) {
                    return new Response(
                        JSON.stringify({ error: 'Service temporarily unavailable', status: 503 }),
                        {
                            status: 503,
                            headers: {
                                'Content-Type': 'application/json',
                                'Retry-After': '300'
                            }
                        }
                    );
                }
                const maintenanceHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VaultLister – Maintenance</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f0f13;
    color: #e2e2e8;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }
  .card {
    max-width: 480px;
    background: #1a1a24;
    border: 1px solid #2e2e3e;
    border-radius: 16px;
    padding: 48px 40px;
  }
  .logo { font-size: 1.5rem; font-weight: 700; color: #a78bfa; margin-bottom: 32px; letter-spacing: -0.5px; }
  h1 { font-size: 1.4rem; font-weight: 600; margin-bottom: 12px; }
  p { color: #9898b0; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">VaultLister</div>
  <h1>We'll be right back</h1>
  <p>VaultLister is temporarily down for scheduled maintenance.<br>Check back shortly — we appreciate your patience.</p>
</div>
</body>
</html>`;
                return new Response(maintenanceHtml, {
                    status: 503,
                    headers: {
                        'Content-Type': 'text/html',
                        'Retry-After': '300'
                    }
                });
            }
        }

        // WebSocket upgrade for /ws endpoint
        // Auth is intentionally deferred to the first message, not the upgrade request.
        // The browser WebSocket API (RFC 6455) does not allow setting custom request
        // headers (e.g. Authorization: Bearer <token>) on the HTTP/1.1 upgrade handshake —
        // only the browser's built-in headers (Origin, Sec-WebSocket-Key, etc.) are sent.
        // Attempting to validate a JWT at upgrade time would therefore always fail for
        // browser clients. Instead, userId is initialised to null here and populated once
        // the client sends a JSON { type: 'auth', token: '<jwt>' } message over the
        // established socket. websocket.js handleAuth() performs that validation.
        if (pathname === '/ws') {
            const upgraded = server.upgrade(request, { data: { userId: null, user: null } });
            if (upgraded) return undefined;
            return new Response('WebSocket upgrade failed', { status: 400 });
        }

        // Get dynamic CORS headers based on origin
        const dynamicCorsHeaders = getCorsHeaders(request);

        // Handle CORS preflight
        if (method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: dynamicCorsHeaders });
        }

        // Handle /mock-oauth routes (dev/demo only — disabled in production)
        if (process.env.NODE_ENV !== 'production' && (pathname.startsWith('/mock-oauth/') || pathname.startsWith('/api/mock-oauth/'))) {
            const context = {
                method,
                path: pathname.replace('/api/mock-oauth', '').replace('/mock-oauth', ''),
                body: await parseBody(request),
                query: Object.fromEntries(url.searchParams),
                user: null,
                request,
                ip: 'unknown',
                headers: Object.fromEntries(request.headers.entries())
            };

            try {
                const result = await mockOAuthRouter(context);

                // Check if result has HTML body (for authorize page)
                if (result.body) {
                    return new Response(result.body, {
                        status: result.status || 200,
                        headers: { 'Content-Type': 'text/html', ...dynamicCorsHeaders }
                    });
                }

                return new Response(JSON.stringify(result.data), {
                    status: result.status || 200,
                    headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
                });
            } catch (error) {
                logger.error('Mock OAuth Error:', error);
                return new Response(JSON.stringify({ error: 'OAuth processing failed' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
                });
            }
        }

        // Handle /oauth-callback route (OAuth flow completion)
        if (pathname === '/oauth-callback') {
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            const error = url.searchParams.get('error');
            const errorDescription = url.searchParams.get('error_description');

            // Return HTML that handles the callback and communicates with the opener
            const callbackHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>OAuth Callback</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea, #764ba2);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            text-align: center;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .success { color: #10b981; }
        .error { color: #ef4444; }
        .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e5e7eb;
            border-top-color: #f59e0b;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        ${error ? `
            <h2 class="error">Authorization Failed</h2>
            <p>${String(errorDescription || error).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}</p>
        ` : `
            <div class="spinner"></div>
            <h2>Completing Authorization...</h2>
            <p>Please wait while we connect your account.</p>
        `}
    </div>
    <script>
        (async function() {
            const code = ${JSON.stringify(code || '')};
            const state = ${JSON.stringify(state || '')};
            const error = ${JSON.stringify(error || '')};

            if (error) {
                // Notify opener of failure
                if (window.opener) {
                    var errMsg = ${JSON.stringify(errorDescription || error || '')};
                    try { window.opener.dispatchEvent(new CustomEvent('oauthComplete', { detail: { success: false, error: errMsg } })); } catch(e) {}
                    window.opener.postMessage({ type: 'oauthComplete', success: false, error: errMsg }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
                return;
            }

            if (!code || !state) {
                if (window.opener) {
                    try { window.opener.dispatchEvent(new CustomEvent('oauthComplete', { detail: { success: false, error: 'Missing authorization code or state' } })); } catch(e) {}
                    window.opener.postMessage({ type: 'oauthComplete', success: false, error: 'Missing authorization code or state' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
                return;
            }

            try {
                // Decode state to get platform (format: platformName_hextoken)
                const VALID_PLATFORMS = ['poshmark', 'ebay', 'mercari', 'depop', 'grailed', 'facebook', 'etsy', 'shopify', 'whatnot', 'amazon', 'other'];
                const stateData = state.split('_');
                const platform = stateData.length > 1 ? stateData[0] : 'poshmark';
                if (!VALID_PLATFORMS.includes(platform)) {
                    document.querySelector('.container').innerHTML = '<h2>Invalid platform</h2><p>The OAuth callback contained an unrecognized platform.</p>';  // nosemgrep: javascript.browser.security.insecure-document-method
                    return;
                }

                // Exchange code for tokens via backend
                const response = await fetch('/api/oauth/callback/' + encodeURIComponent(platform) + '?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state), {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const result = await response.json();

                if (result.success) {
                    document.querySelector('.container').innerHTML = '<h2 class="success">✓ Connected Successfully!</h2><p>This window will close automatically.</p>';  // nosemgrep: javascript.browser.security.insecure-document-method
                    // Signal the main window via localStorage (works even when window.opener is null after cross-origin navigation)
                    try { localStorage.setItem('oauth_complete', Date.now().toString()); } catch(e) {}
                } else {
                    var c = document.querySelector('.container');
                    c.textContent = '';
                    var h = document.createElement('h2'); h.className = 'error'; h.textContent = 'Connection Failed'; c.appendChild(h);
                    var p = document.createElement('p'); p.textContent = result.error || 'Unknown error'; c.appendChild(p);
                    if (window.opener) {
                        var errDetail = result.error || 'Connection failed';
                        try { window.opener.dispatchEvent(new CustomEvent('oauthComplete', { detail: { success: false, error: errDetail } })); } catch(e) {}
                        window.opener.postMessage({ type: 'oauthComplete', success: false, error: errDetail }, window.location.origin);
                    }
                }
            } catch (err) {
                var c = document.querySelector('.container');
                c.textContent = '';
                var h = document.createElement('h2'); h.className = 'error'; h.textContent = 'Error'; c.appendChild(h);
                var p = document.createElement('p'); p.textContent = err.message; c.appendChild(p);
                if (window.opener) {
                    try { window.opener.dispatchEvent(new CustomEvent('oauthComplete', { detail: { success: false, error: err.message } })); } catch(e) {}
                    window.opener.postMessage({ type: 'oauthComplete', success: false, error: err.message }, window.location.origin);
                }
            }

            setTimeout(() => window.close(), 3000);
        })();
    </script>
</body>
</html>`;

            return new Response(callbackHtml, {
                status: 200,
                headers: { 'Content-Type': 'text/html', ...dynamicCorsHeaders }
            });
        }

        // Prometheus metrics endpoint — scraped by Grafana Cloud
        if (pathname === '/metrics') {
            const expectedToken = process.env.PROMETHEUS_METRICS_TOKEN;
            if (expectedToken) {
                const authHeader = request.headers.get('authorization') || '';
                if (authHeader !== `Bearer ${expectedToken}`) {
                    return new Response('Unauthorized', { status: 401 });
                }
            }
            const metrics = await promRegister.metrics();
            return new Response(metrics, {
                status: 200,
                headers: { 'Content-Type': promRegister.contentType }
            });
        }

        // API routes
        if (pathname.startsWith('/api/')) {
            // Select per-request timeout:
            //   - File uploads (multipart/form-data): 60s
            //   - All other API requests: 30s
            const contentType = request.headers.get('content-type') || '';
            const isUpload = contentType.includes('multipart/form-data');
            const apiTimeoutMs = isUpload ? 60_000 : 30_000;

            return withRequestTimeout(Sentry.continueTrace(
                {
                    sentryTrace: request.headers.get('sentry-trace') || '',
                    baggage: request.headers.get('baggage') || '',
                },
                () => Sentry.startSpan(
                    { name: `${method} ${pathname}`, op: 'http.server', forceTransaction: true },
                    async () => {

            // Normalize versioned API paths: /api/v1/... → /api/...
            // All existing routes gain a /api/v1/ alias automatically.
            // New routes should be written against /api/ — versioning is additive.
            const effectivePath = /^\/api\/v\d+\//.test(pathname)
                ? pathname.replace(/^\/api\/v\d+\//, '/api/')
                : pathname;

            // Get client IP — proxy headers only when TRUST_PROXY is set, otherwise use socket IP
            const trustProxy = process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
            const ip = (trustProxy && (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip'))) ||
                       server.requestIP(request)?.address ||
                       'unknown';

            // Check authentication for protected routes
            let user = null;
            const isProtected = protectedPrefixes.some(prefix => effectivePath.startsWith(prefix));

            // Public endpoints that don't require auth
            const isPublicWebhook = effectivePath.startsWith('/api/webhooks/incoming') ||
                effectivePath.startsWith('/api/webhooks/ebay/account-deletion') ||
                effectivePath === '/api/webhooks/stripe';
            const isOAuthCallback = effectivePath.startsWith('/api/oauth/callback') ||
                /^\/api\/oauth\/[^/]+\/callback$/.test(effectivePath) ||
                effectivePath.match(/^\/api\/social-auth\/[^/]+\/callback/) ||
                effectivePath.startsWith('/api/email/callback') ||
                effectivePath === '/api/integrations/google/callback';
            const isPublicSecurity = [
                '/api/security/verify-email',
                '/api/security/forgot-password',
                '/api/security/reset-password'
            ].includes(effectivePath);

            const isPublicMonitoring = effectivePath === '/api/monitoring/rum' && method === 'POST';
            const isPublicAnnouncement = effectivePath === '/api/settings/announcement' && method === 'GET';
            const isSocialAuthInit = /^\/api\/social-auth\/[^/]+$/.test(effectivePath) && method === 'GET';
            if (isProtected && !isPublicWebhook && !isOAuthCallback && !isPublicSecurity && !isPublicMonitoring && !isPublicAnnouncement && !isSocialAuthInit) {
                const authResult = await authenticateToken(request);
                if (!authResult.success) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
                    });
                }
                user = authResult.user;
            } else if (isPublicMonitoring) {
                // Optional auth: attribute RUM data to user if token/cookie present, but don't reject if absent
                const authResult = await authenticateToken(request);
                if (authResult.success) user = authResult.user;
            }

            // Parse body only for methods that have a body
            const bodySizeLimit = getBodySizeLimit(effectivePath);
            const isStripeWebhook = effectivePath === '/api/webhooks/stripe';
            let rawBodyText = null;
            let body;
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                body = {};
            } else if (isStripeWebhook) {
                // Stripe signature verification requires the raw unparsed body text
                rawBodyText = await request.text();
                try { body = rawBodyText ? JSON.parse(rawBodyText) : {}; } catch { body = {}; }
            } else {
                body = await parseBody(request, bodySizeLimit);
            }

            // Reject oversized requests
            if (body && body.error === 'Request body too large') {
                const maxMB = Math.round(bodySizeLimit / (1024 * 1024));
                return new Response(JSON.stringify({ error: 'Request body too large', maxSize: `${maxMB}MB` }), {
                    status: 413,
                    headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
                });
            }

            // Reject malformed JSON
            if (body && body.error === 'Invalid JSON in request body') {
                return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
                });
            }

            const query = Object.fromEntries(url.searchParams);

            // Create context with security middleware support
            const context = {
                method,
                path: effectivePath,
                body,
                rawBody: rawBodyText,
                query,
                user,
                request,
                ip,
                headers: Object.fromEntries(request.headers.entries()),
                // Capture nginx $request_id (or any upstream correlation ID) for error log tracing
                requestId: request.headers.get('x-request-id') || undefined,
                // Expose original versioned path in case a route needs it
                requestedPath: pathname,
            };

            // Apply rate limiting
            const rateLimitError = await applyRateLimit(context, 'auto');
            if (rateLimitError) {
                const headers = {
                    'Content-Type': 'application/json',
                    ...dynamicCorsHeaders,
                    ...rateLimitError.headers
                };
                return new Response(JSON.stringify(rateLimitError.data), {
                    status: rateLimitError.status,
                    headers
                });
            }

            // Apply CSRF protection for state-changing requests
            const csrfError = await applyCSRFProtection(context);
            if (csrfError) {
                return new Response(JSON.stringify(csrfError.data), {
                    status: csrfError.status,
                    headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
                });
            }

            // Generate CSRF token for response
            await addCSRFToken(context);

            // Idempotency — check/store for POST, PUT, PATCH
            const idempotencyKey = request.headers.get('Idempotency-Key');
            const isMutatingMethod = method === 'POST' || method === 'PUT' || method === 'PATCH';
            if (idempotencyKey && isMutatingMethod) {
                const cached = await redisService.getJson('idempotency:' + idempotencyKey);
                if (cached) {
                    const responseHeaders = {
                        'Content-Type': 'application/json',
                        'X-API-Version': '1.0.0',
                        'X-Idempotency-Replayed': 'true',
                        ...dynamicCorsHeaders,
                        ...(cached.headers || {})
                    };
                    if (context.csrfToken) responseHeaders['X-CSRF-Token'] = context.csrfToken;
                    return new Response(JSON.stringify(cached.data), {
                        status: cached.status,
                        headers: responseHeaders
                    });
                }
            }

            // Find matching router (pre-sorted at startup by prefix length, most specific first)
            for (const [prefix, router] of _sortedApiRoutes) {
                if (effectivePath === prefix || effectivePath.startsWith(prefix + '/')) {
                    const subPath = effectivePath.slice(prefix.length) || '/';
                    context.path = subPath;

                    try {
                        const _t0 = performance.now();
                        const result = await router(context);
                        const _statusStr = String(result.status || 200);
                        recordHttpRequest(method, prefix, _statusStr, (performance.now() - _t0) / 1000);

                        // Apply security headers
                        const securityHeaders = applySecurityHeaders(context);
                        const responseHeaders = {
                            'Content-Type': 'application/json',
                            'X-API-Version': '1.0.0',
                            ...dynamicCorsHeaders,
                            ...(result.headers || {}),
                            ...securityHeaders
                        };

                        // Add CSRF token to response headers
                        if (context.csrfToken) {
                            responseHeaders['X-CSRF-Token'] = context.csrfToken;
                        }

                        // Apply HttpOnly auth cookies when the route requests it
                        // Note: multiple Set-Cookie headers are set via Response init below


                        const responseBody = JSON.stringify(result.data);

                        // Cache-Control — routes opt in by setting result.cacheControl
                        if (result.cacheControl) {
                            responseHeaders['Cache-Control'] = result.cacheControl;
                        }

                        // ETag + conditional GET (304 Not Modified) for all successful GET responses
                        if (method === 'GET' && (result.status || 200) < 300) {
                            const etag = generateETag(responseBody);
                            responseHeaders['ETag'] = etag;
                            if (etagMatches(request, etag)) {
                                return new Response(null, { status: 304, headers: responseHeaders });
                            }
                        }

                        // Compress response body if client supports it and payload is large enough
                        const { body: finalBody, encoding } = compressBody(
                            responseBody,
                            request.headers.get('Accept-Encoding') || ''
                        );
                        if (encoding) {
                            responseHeaders['Content-Encoding'] = encoding;
                            responseHeaders['Vary'] = 'Accept-Encoding';
                        }

                        const response = new Response(finalBody, {
                            status: result.status || 200,
                            headers: responseHeaders
                        });

                        // Set-Cookie must be separate headers (not comma-joined)
                        if (result.cookies?.length) {
                            for (const cookie of result.cookies) {
                                response.headers.append('Set-Cookie', cookie);
                            }
                        }

                        // Cache idempotent response for replay
                        if (idempotencyKey && isMutatingMethod) {
                            await redisService.setJson('idempotency:' + idempotencyKey, {
                                status: result.status || 200,
                                data: result.data,
                                headers: result.headers || {}
                            }, 300);
                        }

                        return response;
                    } catch (error) {
                        // Use structured error handler
                        const errorResult = handleError(error, context);
                        recordHttpRequest(method, prefix, String(errorResult.status || 500), 0);
                        const securityHeaders = applySecurityHeaders(context);
                        logRequestComplete(context, errorResult, error);
                        return new Response(JSON.stringify(errorResult.data), {
                            status: errorResult.status || 500,
                            headers: {
                                'Content-Type': 'application/json',
                                'X-API-Version': '1.0.0',
                                ...dynamicCorsHeaders,
                                ...securityHeaders
                            }
                        });
                    }
                }
            }

            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...dynamicCorsHeaders }
            });

            })), apiTimeoutMs);
        }

        // Redirect /api-docs to /api-docs/index.html
        if (pathname === '/api-docs' || pathname === '/api-docs/') {
            return new Response(null, { status: 302, headers: { Location: '/api-docs/index.html' } });
        }

        // Static files - only serve if NOT an API route
        if (pathname !== '/' && pathname.includes('.') && !pathname.startsWith('/api/')) {
            const staticResponse = serveStatic(pathname, request);
            if (staticResponse) return staticResponse;
        }

        // Landing page — serve public/landing.html for unauthenticated root visits.
        // If the request is for "/" and has no vl_access cookie, show the marketing page.
        // Authenticated users (vl_access cookie present) go straight to the SPA.
        if (pathname === '/') {
            const cookieHeader = request.headers.get('Cookie') || '';
            const hasAuthCookie = /(?:^|;\s*)vl_access=/.test(cookieHeader);
            if (!hasAuthCookie && !url.searchParams.has('app')) {
                const _landingHtml = existsSync(_landingHtmlPath) ? readFileSync(_landingHtmlPath, 'utf-8') : null;
                if (_landingHtml !== null) {
                    return new Response(_landingHtml, {
                        headers: {
                            'Content-Type': 'text/html',
                            'Cache-Control': 'no-cache, must-revalidate',
                            ...dynamicCorsHeaders
                        }
                    });
                }
            }
        }

        // SPA fallback - serve index.html (with security headers)
        const spaSecHeaders = {};
        for (const [key, value] of Object.entries(securityHeadersConfig)) {
            if (value) spaSecHeaders[key] = value;
        }

        // Generate a per-request CSP nonce and inject it into every <script> tag.
        // 'strict-dynamic' + nonce makes unsafe-inline inert in modern browsers while
        // legacy browsers fall back gracefully. unsafe-eval is never included.
        // Nonces are production-only: in dev/test mode, 'unsafe-inline' from the base
        // CSP is honored by all browsers (Firefox ignores script-src-attr when a nonce
        // is present, breaking inline event handlers like onsubmit/onclick).
        const useNonce = IS_PROD;
        const cspNonce = useNonce ? crypto.randomBytes(16).toString('base64') : null;
        spaSecHeaders['Content-Security-Policy'] = cspNonce
            ? buildCSPWithNonce(cspNonce)
            : spaSecHeaders['Content-Security-Policy'];

        const injectNonce = (html) =>
            cspNonce
                ? html.replace(/<script(\b[^>]*)>/gi, (_, attrs) => `<script${attrs} nonce="${cspNonce}">`)
                : html;

        const _indexHtml = existsSync(_indexHtmlPath) ? readFileSync(_indexHtmlPath, 'utf-8') : null;
        if (_indexHtml !== null) {
            const cdnScript = CDN_URL ? `<script>window.__CDN_URL__='${CDN_URL}';</script>` : '';
            const htmlWithCdn = cdnScript ? _indexHtml.replace('</head>', cdnScript + '</head>') : _indexHtml;
            const content = injectNonce(htmlWithCdn);
            const preloadHeader = getPreloadHints();
            const htmlHeaders = {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache, must-revalidate',
                ...(preloadHeader && { 'Link': preloadHeader }),
                ...dynamicCorsHeaders,
                ...spaSecHeaders
            };
            return new Response(content, { headers: htmlHeaders });
        }

        // Development fallback
        return new Response(injectNonce(generateDevHTML()), {
            headers: { 'Content-Type': 'text/html', ...dynamicCorsHeaders, ...spaSecHeaders }
        });
    },

    websocket: {
        idleTimeout: 120,

        open(ws) {
            // Initialize connection metadata on ws.data (Bun's ServerWebSocket
            // doesn't allow setting arbitrary properties on ws directly)
            const connectionId = crypto.randomUUID();
            ws.data.connectionId = connectionId;
            ws.data.isAlive = true;
            ws.data.userId = null;
            ws.data.subscriptions = new Set();

            websocketService.send(ws, {
                type: 'connected',
                connectionId,
                serverTime: new Date().toISOString()
            });
            logger.info(`[WebSocket] New connection: ${connectionId}`);
        },

        async message(ws, message) {
            await websocketService.handleMessage(ws, message);
        },

        close(ws) {
            websocketService.handleDisconnect(ws);
        },

        pong(ws) {
            websocketService.handlePong(ws);
        },
    },

    error(error) {
        logger.error('Server error:', error);
        log(`Server Error: ${error.message}`);
        return new Response('Internal Server Error', { status: 500 });
    }
});

// Wire websocketService to the running server and start the heartbeat timer.
// We set server directly instead of calling .init() to avoid double-registering
// the heartbeat interval if the module is somehow re-evaluated.
websocketService.server = server;
websocketService.heartbeatInterval = setInterval(
    () => websocketService.heartbeat(),
    INTERVALS.WEBSOCKET_HEARTBEAT_MS
);
await websocketService.initRedisPubSub();

// Generate development HTML if index.html doesn't exist
function generateDevHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VaultLister</title>
    <script type="module" src="/app.js?v=${BUILD_HASH}"></script>
    <link rel="stylesheet" href="/styles/main.css">
    <link rel="manifest" href="/manifest.webmanifest">
</head>
<body>
    <div id="app"></div>
</body>
</html>`;
}

logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██╗   ██╗ █████╗ ██╗   ██║██╗  ████████╗               ║
║   ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝               ║
║   ██║   ██║███████║██║   ██║██║     ██║                  ║
║   ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║                  ║
║    ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║                  ║
║     ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝LISTER            ║
║                                                           ║
║   🚀 Server running at http://localhost:${server.port}          ║
║   📦 Database: PostgreSQL (DATABASE_URL)                 ║
║   🔒 Auth: JWT + CSRF Protection                          ║
║   🛡️  Security: Rate Limiting + CSP + XSS Protection      ║
║   🔄 OAuth: Token Refresh Scheduler Active                ║
║   ⚙️  Workers: Background Task Processing Active          ║
║   📧 Email: Gmail + Outlook Polling Active                ║
║   💰 Pricing: Price Check Worker Active                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

log(`Server started`);
const startupMs = Math.round(performance.now() - startTime);
logger.info(`[Server] Started in ${startupMs}ms on port ${server.port}`);

} // end async function main()

main().catch((err) => {
    logger.error('Fatal startup error:', err);
    process.exit(1);
});

// Graceful shutdown helper
async function gracefulShutdown(signal) {
    logger.info(`${signal} received. Shutting down gracefully...`);

    // Force exit after 30s if graceful shutdown stalls
    const forceExitTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out after 30s, forcing exit');
        log('Forced shutdown after 30s timeout');
        process.exit(1);
    }, TIMEOUTS.GRACEFUL_SHUTDOWN_MS);
    forceExitTimer.unref();

    // Stop API-local services first
    stopRateLimiter();
    stopCSRF();
    monitoring.stopMetricsCollection();
    await websocketService.cleanup();
    auditLog.stop();
    emailMarketing.cleanup();
    stopRateLimitDashboard();
    await analyticsService.shutdown();
    logger.info('Background services stopped.');

    // Stop accepting new requests before closing dependencies
    server.stop();
    logger.info('Server closed.');

    // Close Redis connection
    await redisService.close();
    logger.info('Redis connection closed.');

    // Close database connection pool
    await closeDatabase();
    logger.info('Database connection closed.');

    // Clean up PID file (local dev only)
    if (process.env.NODE_ENV !== 'production') {
        try { unlinkSync(PID_PATH); } catch {}
    }
    log(`Server shutdown (${signal})`);
    process.exit(0);
}

// Shutdown hooks (added for clean exit)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Error handling (catches unhandled errors)
process.on('uncaughtException', (err) => {
    logger.error('Uncaught error:', err.message);
    log(`Uncaught error: ${err.message}`);
    monitoring.reportToSentry(err, { source: 'uncaughtException' });
    _flushLog(); // Flush buffered logs before exit
    process.exit(1);
});

// Unhandled rejection handling (for promises) — log but do not crash
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    log(`Unhandled rejection: ${reason}`);
    if (reason instanceof Error) {
        monitoring.reportToSentry(reason, { source: 'unhandledRejection' });
    }
    _flushLog();
});
