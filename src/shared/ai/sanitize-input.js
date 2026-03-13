// AI Input Sanitizer — strips prompt injection patterns and caps field lengths
// Used by listing-generator.js and image-analyzer.js before sending to Claude API

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

    let sanitized = text;

    // Strip XML/HTML-like tags that could manipulate prompt structure
    sanitized = sanitized.replace(/<\/?[a-zA-Z][^>]*>/g, '');

    // Strip common prompt injection patterns
    sanitized = sanitized.replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?|context)/gi, '');
    sanitized = sanitized.replace(/\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as|switch\s+to)\b/gi, '');
    sanitized = sanitized.replace(/\b(system\s*prompt|system\s*message|instructions?\s*:)/gi, '');
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '');

    // Collapse excessive whitespace
    sanitized = sanitized.replace(/\s{3,}/g, '  ').trim();

    // Cap length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.slice(0, maxLength);
    }

    return sanitized;
}
