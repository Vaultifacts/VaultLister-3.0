// Shared timeout utilities for external service calls (REM-11)

/**
 * Fetch with an AbortSignal timeout.
 * Drop-in replacement for fetch() that aborts after `ms` milliseconds.
 *
 * @param {string|URL} url
 * @param {RequestInit & { timeoutMs?: number }} opts - Standard fetch opts + optional timeoutMs (default 30000)
 * @returns {Promise<Response>}
 */
export function fetchWithTimeout(url, opts = {}) {
    const { timeoutMs = 30000, ...fetchOpts } = opts;
    return fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Race a promise against a timeout.
 * Use for SDK calls (Anthropic, Notion) that don't accept AbortSignal.
 *
 * @param {Promise<T>} promise
 * @param {number} ms - Timeout in milliseconds (default 30000)
 * @param {string} label - Description for the timeout error message
 * @returns {Promise<T>}
 * @template T
 */
export function withTimeout(promise, ms = 30000, label = 'External call') {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
    ]);
}
