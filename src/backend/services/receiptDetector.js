// Receipt Detection Service for VaultLister
// Identifies potential receipt emails based on sender and subject patterns

// Default sender domains that typically send receipts
export const DEFAULT_RECEIPT_SENDERS = [
    // Selling platforms
    'ebay.com',
    'paypal.com',
    'poshmark.com',
    'mercari.com',
    'depop.com',
    'grailed.com',
    'facebook.com',
    'marketplace.facebook.com',

    // Shipping carriers
    'usps.com',
    'ups.com',
    'fedex.com',
    'dhl.com',
    'pirateship.com',
    'shipstation.com',

    // Common retail/thrift
    'goodwill.org',
    'goodwillnynj.org',
    'salvationarmy.org',
    'target.com',
    'walmart.com',
    'amazon.com',
    'costco.com',
    'nordstrom.com',
    'macys.com',
    'kohls.com',
    'tjmaxx.com',
    'marshalls.com',
    'rossstores.com',

    // Office supplies (for reselling supplies)
    'staples.com',
    'officedepot.com',
    'uline.com'
];

// Subject line patterns that indicate receipts
export const RECEIPT_SUBJECT_PATTERNS = [
    /receipt/i,
    /order\s*confirm/i,
    /purchase\s*confirm/i,
    /your\s*order/i,
    /invoice/i,
    /payment\s*received/i,
    /payment\s*confirm/i,
    /transaction/i,
    /shipping\s*confirm/i,
    /shipment\s*confirm/i,
    /tracking/i,
    /your\s*sale/i,
    /item\s*sold/i,
    /you\s*sold/i,
    /congratulations.*sold/i,
    /payout/i,
    /earnings/i
];

// Platform-specific detection rules
const PLATFORM_RULES = {
    'ebay.com': {
        subjectPatterns: [/item sold/i, /order received/i, /payment received/i, /your ebay order/i],
        receiptType: 'sale'
    },
    'paypal.com': {
        subjectPatterns: [/payment received/i, /money received/i, /receipt for your payment/i],
        receiptType: 'sale'
    },
    'poshmark.com': {
        subjectPatterns: [/you made a sale/i, /order.*ship/i, /earnings/i],
        receiptType: 'sale'
    },
    'mercari.com': {
        subjectPatterns: [/your item sold/i, /order confirmed/i],
        receiptType: 'sale'
    },
    'usps.com': {
        subjectPatterns: [/label/i, /shipping/i, /tracking/i],
        receiptType: 'shipping'
    },
    'pirateship.com': {
        subjectPatterns: [/label/i, /shipment/i],
        receiptType: 'shipping'
    }
};

/**
 * Check if an email is likely a receipt
 * @param {Object} email - Parsed email object
 * @param {Array} userFilters - User's custom sender filters
 * @returns {Object} Detection result
 */
export function detectReceipt(email, userFilters = []) {
    const result = {
        isReceipt: false,
        confidence: 0,
        receiptType: 'purchase', // purchase, sale, shipping, expense
        matchedSender: null,
        matchedSubject: false,
        platform: null
    };

    const fromEmail = email.fromEmail?.toLowerCase() || '';
    const subject = email.subject || '';

    // Combine default and user filters
    const allSenders = [...DEFAULT_RECEIPT_SENDERS, ...userFilters];

    // Check sender against known receipt senders
    for (const sender of allSenders) {
        if (fromEmail.includes(sender.toLowerCase())) {
            result.matchedSender = sender;
            result.confidence += 50;

            // Check for platform-specific rules
            const platformRule = PLATFORM_RULES[sender];
            if (platformRule) {
                result.platform = sender;
                result.receiptType = platformRule.receiptType;

                // Check platform-specific subject patterns
                for (const pattern of platformRule.subjectPatterns) {
                    if (pattern.test(subject)) {
                        result.confidence += 30;
                        result.matchedSubject = true;
                        break;
                    }
                }
            }
            break;
        }
    }

    // Check subject against receipt patterns
    if (!result.matchedSubject) {
        for (const pattern of RECEIPT_SUBJECT_PATTERNS) {
            if (pattern.test(subject)) {
                result.matchedSubject = true;
                result.confidence += 30;

                // Determine receipt type from subject
                if (/sold|sale|payout|earnings/i.test(subject)) {
                    result.receiptType = 'sale';
                } else if (/shipping|tracking|label|shipment/i.test(subject)) {
                    result.receiptType = 'shipping';
                }
                break;
            }
        }
    }

    // Additional confidence boosts
    if (email.attachments?.length > 0) {
        // PDFs are often receipts
        const hasPdf = email.attachments.some(a => a.mimeType === 'application/pdf');
        if (hasPdf) {
            result.confidence += 10;
        }
    }

    // Determine if it's a receipt
    result.isReceipt = result.confidence >= 50;
    result.confidence = Math.min(result.confidence, 100);

    return result;
}

/**
 * Build Gmail search query from sender filters
 * @param {Array} senderFilters - List of sender domains
 * @returns {string} Gmail search query
 */
export function buildSenderQuery(senderFilters = []) {
    const filters = senderFilters.length > 0 ? senderFilters : DEFAULT_RECEIPT_SENDERS;
    return filters.map(s => `from:${s}`).join(' OR ');
}

/**
 * Extract likely receipt type from email content
 * @param {Object} email - Parsed email object
 * @returns {string} Receipt type
 */
export function inferReceiptType(email) {
    const text = (email.body?.text || email.body?.html || '').toLowerCase();
    const subject = (email.subject || '').toLowerCase();

    // Check for sale indicators
    if (/sold|sale|buyer|payout|earnings|commission/i.test(text + subject)) {
        return 'sale';
    }

    // Check for shipping indicators
    if (/shipping|tracking|label|carrier|delivery|shipped/i.test(text + subject)) {
        return 'shipping';
    }

    // Check for expense indicators
    if (/subscription|fee|service|renewal|bill/i.test(text + subject)) {
        return 'expense';
    }

    // Default to purchase
    return 'purchase';
}

/**
 * Extract vendor name from email
 * @param {Object} email - Parsed email object
 * @returns {string} Vendor name
 */
export function extractVendorName(email) {
    // Try to get vendor from sender name
    if (email.fromName && email.fromName.length > 0) {
        // Clean up common suffixes
        return email.fromName
            .replace(/\s*(support|info|noreply|no-reply|notifications?)\s*/gi, '')
            .replace(/\s*<.*>/, '')
            .trim();
    }

    // Extract from domain
    const domain = email.fromEmail?.split('@')[1] || '';
    const domainName = domain.split('.')[0];
    return domainName.charAt(0).toUpperCase() + domainName.slice(1);
}
