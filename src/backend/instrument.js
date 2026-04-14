// src/backend/instrument.js
// Sentry instrumentation — imported as the second module in server.js (after env.js).
// Calling Sentry.init() here ensures integrations are registered before routes and
// services load. When SENTRY_DSN is absent, all Sentry methods are no-ops.

import * as Sentry from '@sentry/node';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
    // Lazy import: @sentry/profiling-node loads a native NAPI module that calls
    // uv_default_loop. Importing it unconditionally crashes on CI/test environments
    // that don't support that libuv function. Only load when Sentry is active.
    const { nodeProfilingIntegration } = await import('@sentry/profiling-node');
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: process.env.SENTRY_RELEASE || undefined,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
        integrations: [
            // Instruments outgoing fetch() calls — works with Bun's native fetch.
            Sentry.nativeNodeFetchIntegration(),
            // CPU profiling — captures flame graphs for sampled transactions.
            nodeProfilingIntegration(),
        ],
        profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '1.0'),
        _experiments: { enableLogs: true },
    });
}

// Re-export so monitoring.js can call captureException without re-importing.
export default Sentry;
