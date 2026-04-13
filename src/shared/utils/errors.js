// Standardized error response helper for backend route handlers.
// All error responses must use { error: string } — never nested objects.

/**
 * Returns a standardized route error response.
 * @param {number} status - HTTP status code
 * @param {string} message - Human-readable error message
 * @returns {{ status: number, data: { error: string } }}
 */
export function errorResponse(status, message) {
    return { status, data: { error: String(message) } };
}
