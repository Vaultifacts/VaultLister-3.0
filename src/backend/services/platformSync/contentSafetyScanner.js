// Content Safety Scanner — Pre-flight checks before listing submission
// Per spec Layer 8: scan title, description, price, and images before publishing.
// Returns { status: 'PASS' | 'WARN' | 'BLOCK', issues: string[] }

import { logger } from '../../shared/logger.js';

// Off-platform payment keywords that trigger auto-bans (Depop confirmed, others similar)
const PAYMENT_KEYWORDS = [
    'venmo',
    'zelle',
    'cash app',
    'cashapp',
    'paypal f&f',
    'paypal friends',
    'interac',
    'interac e-transfer',
    'apple pay',
    'google pay',
    'dm me',
    'text me',
    'call me',
    'message me on',
    'instagram',
    'whatsapp',
    'telegram',
    'signal',
    'discord',
    'snapchat',
    'tiktok',
    'twitter',
    'x.com',
];

// Prohibited content patterns
const PROHIBITED_PATTERNS = [
    /https?:\/\/[^\s]+/i, // External URLs
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone numbers (US/CA)
    /\+\d{1,3}[-.\s]?\d{3,}/, // International phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
];

// Price sanity thresholds
const MIN_PRICE = 1;
const MAX_PRICE = 999999;

/**
 * Scan listing content before submission.
 * @param {Object} opts
 * @param {string} opts.title - Listing title
 * @param {string} opts.description - Listing description
 * @param {number} opts.price - Listing price
 * @param {string} opts.platform - Target platform (facebook, depop, etc.)
 * @returns {{ status: 'PASS'|'WARN'|'BLOCK', issues: string[] }}
 */
export function scanListingContent({ title = '', description = '', price = 0, platform = '' }) {
    const issues = [];
    const text = `${title} ${description}`.toLowerCase();

    // Check payment keywords
    for (const keyword of PAYMENT_KEYWORDS) {
        if (text.includes(keyword.toLowerCase())) {
            issues.push(
                `BLOCK: Off-platform payment/contact keyword "${keyword}" found in listing text. ${platform === 'depop' ? 'Depop auto-suspends for this.' : 'Most platforms prohibit this.'}`,
            );
        }
    }

    // Check prohibited patterns (URLs, phone numbers, emails)
    const fullText = `${title} ${description}`;
    for (const pattern of PROHIBITED_PATTERNS) {
        const match = fullText.match(pattern);
        if (match) {
            issues.push(
                `WARN: Prohibited pattern detected: "${match[0].slice(0, 40)}". Facebook and other platforms may flag this.`,
            );
        }
    }

    // Price sanity
    if (price <= 0) {
        issues.push('BLOCK: Price is $0 or negative. Placeholder prices trigger spam detection.');
    } else if (price < MIN_PRICE) {
        issues.push(`WARN: Price $${price} is below $${MIN_PRICE}. Very low prices may trigger spam flags.`);
    } else if (price > MAX_PRICE) {
        issues.push(`WARN: Price $${price} exceeds $${MAX_PRICE}. Verify this is intentional.`);
    }

    // ALL CAPS abuse (>30% capitals in text longer than 20 chars)
    if (fullText.length > 20) {
        const upperCount = (fullText.match(/[A-Z]/g) || []).length;
        const letterCount = (fullText.match(/[A-Za-z]/g) || []).length;
        if (letterCount > 0 && upperCount / letterCount > 0.3) {
            issues.push('WARN: Over 30% of text is ALL CAPS. Facebook may flag this as spam.');
        }
    }

    // Duplicate title check (title == description, a common template error)
    if (title && description && title.trim().toLowerCase() === description.trim().toLowerCase()) {
        issues.push('WARN: Title and description are identical. This looks like a template error.');
    }

    // Empty title or description
    if (!title.trim()) {
        issues.push('BLOCK: Title is empty.');
    }
    if (!description.trim()) {
        issues.push('WARN: Description is empty. Listings without descriptions get lower visibility.');
    }

    // Determine overall status
    const hasBlock = issues.some((i) => i.startsWith('BLOCK'));
    const hasWarn = issues.some((i) => i.startsWith('WARN'));
    const status = hasBlock ? 'BLOCK' : hasWarn ? 'WARN' : 'PASS';

    if (issues.length > 0) {
        logger.info('[ContentSafety] Scan result:', { status, platform, issueCount: issues.length });
    }

    return { status, issues };
}

export default { scanListingContent };
