// src/backend/middleware/cache.js
// ETag generation and Cache-Control helpers for VaultLister route handlers.
//
// ── ETag (automatic — handled in server.js response pipeline) ───────────────
// The server automatically generates and checks ETags for all GET responses.
// A route does not need to do anything for basic ETag support.
//
// ── Cache-Control (opt-in per route) ────────────────────────────────────────
// Routes that serve stable data should set `cacheControl` in their return value:
//
//   return {
//       status: 200,
//       data: platforms,
//       cacheControl: cacheFor(60),                        // public, 60 s
//   };
//
//   return {
//       status: 200,
//       data: profile,
//       cacheControl: cacheForUser(300),                   // private, 5 min
//   };
//
// Routes with user-specific, real-time, or auth-sensitive data should NOT set
// cacheControl (or set it to NO_CACHE) — the server default is no-store.
//
// ── Quick reference ──────────────────────────────────────────────────────────
//   cacheFor(seconds)           → public, max-age=N, stale-while-revalidate=N*2
//   cacheForUser(seconds)       → private, max-age=N
//   immutable(seconds)          → public, max-age=N, immutable (for versioned assets)
//   NO_CACHE                    → no-store, no-cache (default for most routes)

import { createHash } from 'crypto';

/**
 * Generate a strong ETag from a response body string.
 * Returns a quoted ETag value, e.g. `"a3f2c1..."`.
 * @param {string} body - Serialized response body (typically JSON.stringify(data))
 * @returns {string}
 */
export function generateETag(body) {
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 32);
    return `"${hash}"`;
}

/**
 * Check whether the client's cached version matches the current ETag.
 * Returns true if the response can be a 304 Not Modified.
 * @param {Request} request - Incoming Bun Request object
 * @param {string} etag - Current resource ETag
 * @returns {boolean}
 */
export function etagMatches(request, etag) {
    const ifNoneMatch = request.headers.get('if-none-match');
    if (!ifNoneMatch) return false;
    // Support comma-separated ETags and wildcard
    if (ifNoneMatch === '*') return true;
    return ifNoneMatch
        .split(',')
        .map((t) => t.trim())
        .includes(etag);
}

// ── Cache-Control helpers ────────────────────────────────────────────────────

/**
 * Public shared cache, good for stable API data served to all users.
 * Includes stale-while-revalidate so clients get instant responses while
 * a background refresh happens.
 * @param {number} maxAgeSeconds
 * @returns {string}
 */
export function cacheFor(maxAgeSeconds) {
    const swr = Math.min(maxAgeSeconds * 2, 86400);
    return `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${swr}`;
}

/**
 * Private (per-user) cache. Use for authenticated responses that vary by user.
 * @param {number} maxAgeSeconds
 * @returns {string}
 */
export function cacheForUser(maxAgeSeconds) {
    return `private, max-age=${maxAgeSeconds}`;
}

/**
 * Immutable cache for content-addressed / versioned assets.
 * @param {number} maxAgeSeconds - Typically a year (31_536_000) for hashed assets
 * @returns {string}
 */
export function immutable(maxAgeSeconds = 31_536_000) {
    return `public, max-age=${maxAgeSeconds}, immutable`;
}

/**
 * No caching. Use for real-time, auth-sensitive, or write responses.
 * This is the server default — routes only need this constant when they want
 * to be explicit or override a parent middleware.
 */
export const NO_CACHE = 'no-store, no-cache, must-revalidate';
