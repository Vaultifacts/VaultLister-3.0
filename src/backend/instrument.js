// src/backend/instrument.js
// Sentry instrumentation — imported as the second module in server.js (after env.js).
// Calling Sentry.init() here ensures integrations are registered before routes and
// services load. When SENTRY_DSN is absent, all Sentry methods are no-ops.

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development';
const SENTRY_ALLOW_NON_PROD = process.env.SENTRY_ALLOW_NON_PROD === 'true';
const SHOULD_INIT_SENTRY = Boolean(
    SENTRY_DSN && (SENTRY_ENVIRONMENT === 'production' || SENTRY_ENVIRONMENT === 'staging' || SENTRY_ALLOW_NON_PROD),
);

if (SHOULD_INIT_SENTRY) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: SENTRY_ENVIRONMENT,
        release: process.env.SENTRY_RELEASE || undefined,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
        integrations: [
            // Instruments outgoing fetch() calls — works with Bun's native fetch.
            Sentry.nativeNodeFetchIntegration(),
        ],
        _experiments: { enableLogs: true },
    });
}

// Re-export so monitoring.js can call captureException without re-importing.
export default Sentry;
