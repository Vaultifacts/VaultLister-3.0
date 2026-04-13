// src/backend/instrument.js
// Sentry instrumentation — imported as the second module in server.js (after env.js).
// Calling Sentry.init() here ensures integrations are registered before routes and
// services load. When SENTRY_DSN is absent, all Sentry methods are no-ops.

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        debug: true,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE || undefined,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
        integrations: [
            // Instruments outgoing fetch() calls — works with Bun's native fetch.
            Sentry.nativeNodeFetchIntegration(),
        ],
    });
    // Temporary: log flush and envelope events to confirm metrics pipeline
    const client = Sentry.getClient();
    if (client) {
        client.on('flushMetrics', () => {
            console.log('[Sentry-debug] flushMetrics fired — sending metric envelope');
        });
        client.on('beforeEnvelope', (envelope) => {
            const types = envelope[1]?.map(item => item[0]?.type).join(',') || 'unknown';
            console.log('[Sentry-debug] beforeEnvelope — types:', types);
        });
    }
}

// Re-export so monitoring.js can call captureException without re-importing.
export default Sentry;
