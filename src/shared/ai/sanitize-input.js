// AI Input Sanitizer — strips prompt injection patterns and caps field lengths
// Used by listing-generator.js and image-analyzer.js before sending to Claude API

// RTL/LTR Unicode control characters that can visually reorder text to bypass filters
const BIDI_CONTROL_CHARS = /[\u200F\u200E\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// Unicode punctuation lookalikes that can bypass keyword blocklists
// Normalizes fullwidth, halfwidth, and mathematical alphanumeric variants
function normalizePunctuation(str) {
    return str
        .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // fullwidth ASCII → ASCII
        .normalize('NFKC'); // compatibility decomposition + canonical composition
}

/**
 * Sanitize a user-provided string before including it in an AI prompt.
 * Strips known injection patterns, XML/HTML-like tags, and caps length.
 *
 * @param {string} text - Raw user input
 * @param {number} [maxLength=500] - Maximum allowed character length
 * @returns {string} Sanitized text
 */
export function sanitizeForAI(text, maxLength = 500) {
    if (!text || typeof text !== 'string') return '';

    // Enforce maximum input length before any other processing
    let sanitized = text.slice(0, Math.min(text.length, maxLength * 4));

    // Strip RTL/LTR bidi override characters
    sanitized = sanitized.replace(BIDI_CONTROL_CHARS, '');

    // Strip ASCII control characters except newline (\n) and tab (\t)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize unicode punctuation lookalikes to prevent blocklist bypass
    sanitized = normalizePunctuation(sanitized);

    // Strip XML/HTML-like tags that could manipulate prompt structure
    sanitized = sanitized.replace(/<\/?[a-zA-Z][^>]*(>|$)/g, '');

    // Strip common prompt injection patterns (expanded blocklist)
    sanitized = sanitized.replace(/\b(ignore|disregard|forget|override|bypass|disregard)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?|context)/gi, '');
    sanitized = sanitized.replace(/\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as|switch\s+to|behave\s+as|become|simulate)\b/gi, '');
    sanitized = sanitized.replace(/\b(system\s*prompt|system\s*message|instructions?\s*:|hidden\s+instructions?|admin\s+commands?|developer\s+mode)\b/gi, '');
    sanitized = sanitized.replace(/\b(new\s+instructions?|additional\s+instructions?|ignore\s+previous|forget\s+everything|disregard\s+everything)\b/gi, '');
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '');

    // Collapse excessive whitespace
    sanitized = sanitized.replace(/\s{3,}/g, '  ').trim();

    // Final length cap after all transformations
    if (sanitized.length > maxLength) {
        sanitized = sanitized.slice(0, maxLength);
    }

    return sanitized;
}
