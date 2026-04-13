// Shared input validation helpers for backend route handlers.
// Use these instead of bare parseInt/parseFloat to avoid NaN or out-of-bounds SQL params.

/**
 * Parse an integer from user input with bounds and fallback.
 * Returns the fallback when the value is missing, NaN, or outside [min, max].
 */
export function parseIntSafe(value, { min = 0, max = Infinity, fallback = 0 } = {}) {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n < min || n > max) return fallback;
    return n;
}

/**
 * Parse a float from user input with bounds and fallback.
 * Returns the fallback when the value is missing, NaN, or outside [min, max].
 */
export function parseFloatSafe(value, { min = 0, max = Infinity, fallback = 0 } = {}) {
    const n = parseFloat(value);
    if (!isFinite(n) || n < min || n > max) return fallback;
    return n;
}
