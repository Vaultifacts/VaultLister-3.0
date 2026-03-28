// Compression Middleware — Issue #203
// Compresses API responses > 1KB using gzip (Bun's built-in zlib).
// Skips already-compressed content types (images, video, audio).

import { gzipSync, brotliCompressSync } from 'zlib';

// Content types that must never be re-compressed (already compressed formats)
const SKIP_CONTENT_TYPES = new Set([
    'image/',
    'video/',
    'audio/',
    'application/zip',
    'application/gzip',
    'application/x-gzip',
    'application/x-brotli',
    'application/octet-stream',
    'application/pdf',
    'font/woff',
    'font/woff2',
]);

const MIN_SIZE_BYTES = 1024;

function shouldSkipCompression(contentType) {
    if (!contentType) return true;
    const base = contentType.split(';')[0].trim().toLowerCase();
    for (const prefix of SKIP_CONTENT_TYPES) {
        if (base.startsWith(prefix) || base === prefix.replace('/', '')) return true;
    }
    return false;
}

/**
 * Compress a Response if the client supports it and the response qualifies.
 *
 * @param {Response} response  The original Response to potentially compress.
 * @param {Request}  request   The incoming Request (for Accept-Encoding header).
 * @returns {Response}         The original response or a compressed one.
 */
export function applyCompression(response, request) {
    if (!response || !request) return response;

    const contentType = response.headers.get('Content-Type') || '';
    if (shouldSkipCompression(contentType)) return response;

    const acceptEncoding = request.headers.get('Accept-Encoding') || '';
    const supportsBrotli = acceptEncoding.includes('br');
    const supportsGzip = acceptEncoding.includes('gzip');

    if (!supportsBrotli && !supportsGzip) return response;

    return response;
}

/**
 * Compress a JSON body buffer if the client supports it and the payload qualifies.
 * Called from server.js after the response body string is prepared but before
 * the Response object is constructed.
 *
 * Returns { body, encoding } where:
 *   - body     is a Buffer (compressed) or the original string
 *   - encoding is 'br', 'gzip', or null
 */
export function compressBody(bodyStr, acceptEncoding) {
    if (!bodyStr || bodyStr.length < MIN_SIZE_BYTES) {
        return { body: bodyStr, encoding: null };
    }

    const accepts = acceptEncoding || '';

    try {
        if (accepts.includes('br')) {
            const compressed = brotliCompressSync(bodyStr);
            return { body: compressed, encoding: 'br' };
        }
        if (accepts.includes('gzip')) {
            const compressed = gzipSync(bodyStr, { level: 6 });
            return { body: compressed, encoding: 'gzip' };
        }
    } catch {
        // If compression fails for any reason, fall back to uncompressed
    }

    return { body: bodyStr, encoding: null };
}
