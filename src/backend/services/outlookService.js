// Outlook/Microsoft Graph API Service for VaultLister
// Handles Outlook OAuth token refresh and email fetching

import { logger } from '../shared/logger.js';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

/**
 * Refresh Outlook OAuth access token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token data
 */
export async function refreshOutlookToken(refreshToken) {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Outlook OAuth not configured (missing OUTLOOK_CLIENT_ID or OUTLOOK_CLIENT_SECRET)');
    }

    let response;
    try {
        response = await fetch(MICROSOFT_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access'
            }),
            signal: AbortSignal.timeout(15000)
        });
    } catch (fetchError) {
        if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
            throw new Error('Outlook token refresh timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Fetch recent emails matching filters
 * @param {string} accessToken - Outlook access token
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of messages
 */
export async function fetchRecentEmails(accessToken, options = {}) {
    const {
        sinceMessageId,
        senderFilters = [],
        maxResults = 100,
        afterDate
    } = options;

    // Build OData filter for senders
    let filterParts = [];

    if (senderFilters.length > 0) {
        const senderFilter = senderFilters
            .map(s => `contains(from/emailAddress/address, '${s.replace(/'/g, "''")}')`)
            .join(' or ');
        filterParts.push(`(${senderFilter})`);
    }

    // Filter by date
    if (afterDate) {
        const dateStr = afterDate.toISOString();
        filterParts.push(`receivedDateTime ge ${dateStr}`);
    } else if (!sinceMessageId) {
        // Default to last 7 days for initial sync
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        filterParts.push(`receivedDateTime ge ${sevenDaysAgo.toISOString()}`);
    }

    const url = new URL(`${GRAPH_API_BASE}/me/messages`);
    url.searchParams.set('$top', maxResults.toString());
    url.searchParams.set('$orderby', 'receivedDateTime desc');
    url.searchParams.set('$select', 'id,subject,from,receivedDateTime,body,hasAttachments');

    if (filterParts.length > 0) {
        url.searchParams.set('$filter', filterParts.join(' and '));
    }

    let response;
    try {
        response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
    } catch (fetchError) {
        if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
            throw new Error('Outlook API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const messages = data.value || [];

    // If we have a sinceMessageId, filter out messages we've already seen
    if (sinceMessageId) {
        const sinceIndex = messages.findIndex(m => m.id === sinceMessageId);
        if (sinceIndex !== -1) {
            return messages.slice(0, sinceIndex);
        }
    }

    return messages;
}

/**
 * Get full email content including attachments
 * @param {string} accessToken - Outlook access token
 * @param {string} messageId - Outlook message ID
 * @returns {Promise<Object>} Parsed email content
 */
export async function getEmailContent(accessToken, messageId) {
    const url = `${GRAPH_API_BASE}/me/messages/${messageId}?$select=id,subject,from,toRecipients,receivedDateTime,body,hasAttachments,attachments`;

    let response;
    try {
        response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
    } catch (fetchError) {
        if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
            throw new Error('Outlook API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
    }

    const message = await response.json();

    // If has attachments, fetch them
    let attachments = [];
    if (message.hasAttachments) {
        attachments = await getAttachments(accessToken, messageId);
    }

    return parseOutlookMessage(message, attachments);
}

/**
 * Parse Outlook message into structured format
 * @param {Object} message - Raw Outlook message
 * @param {Array} attachments - Attachment data
 * @returns {Object} Parsed email data
 */
export function parseOutlookMessage(message, attachments = []) {
    const parsed = {
        id: message.id,
        threadId: message.conversationId,
        subject: message.subject || '(No Subject)',
        from: message.from?.emailAddress?.address || '',
        fromName: message.from?.emailAddress?.name || '',
        to: message.toRecipients?.map(r => r.emailAddress?.address).join(', ') || '',
        date: message.receivedDateTime || '',
        snippet: message.bodyPreview || '',
        body: {
            text: '',
            html: ''
        },
        attachments: []
    };

    // Parse from email
    parsed.fromEmail = parsed.from;

    // Parse date
    try {
        parsed.dateObj = new Date(parsed.date);
        parsed.dateISO = parsed.dateObj.toISOString();
    } catch {
        parsed.dateObj = new Date();
        parsed.dateISO = parsed.dateObj.toISOString();
    }

    // Extract body
    if (message.body) {
        if (message.body.contentType === 'html') {
            parsed.body.html = message.body.content || '';
            // Strip HTML for text version
            parsed.body.text = stripHtml(message.body.content || '');
        } else {
            parsed.body.text = message.body.content || '';
        }
    }

    // Process attachments
    parsed.attachments = attachments.map(att => ({
        filename: att.name,
        mimeType: att.contentType,
        size: att.size || 0,
        attachmentId: att.id,
        data: att.contentBytes,
        inline: att.isInline || false
    }));

    return parsed;
}

/**
 * Get attachments for a message
 * @param {string} accessToken - Outlook access token
 * @param {string} messageId - Message ID
 * @returns {Promise<Array>} Attachment data
 */
async function getAttachments(accessToken, messageId) {
    const url = `${GRAPH_API_BASE}/me/messages/${messageId}/attachments`;

    let response;
    try {
        response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
    } catch (fetchError) {
        if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
            logger.error('[OutlookService] Outlook attachment fetch timed out after 15s', null, { detail: fetchError.message });
            return [];
        }
        logger.error('[OutlookService] Failed to fetch attachments', null, { detail: fetchError.message });
        return [];
    }

    if (!response.ok) {
        logger.error(`[OutlookService] Failed to fetch attachments: ${response.status}`);
        return [];
    }

    const data = await response.json();
    return data.value || [];
}

/**
 * Get user's email address from Microsoft Graph API
 * @param {string} accessToken - Outlook access token
 * @returns {Promise<string>} User's email address
 */
export async function getUserEmail(accessToken) {
    const url = `${GRAPH_API_BASE}/me`;

    let response;
    try {
        response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(15000)
        });
    } catch (fetchError) {
        if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
            throw new Error('Outlook API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.mail || data.userPrincipalName;
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html) {
    return html
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Generate mock Outlook emails for testing
 */
export function getMockOutlookEmails() {
    const now = new Date();
    return [
        {
            id: 'mock-outlook-1',
            subject: 'Your Amazon order has shipped',
            from: { emailAddress: { address: 'shipment-tracking@amazon.com', name: 'Amazon.com' } },
            receivedDateTime: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
            bodyPreview: 'Your order #123-456-789 has shipped and is on its way!',
            body: { contentType: 'text', content: 'Your order #123-456-789 has shipped...' },
            hasAttachments: false
        },
        {
            id: 'mock-outlook-2',
            subject: 'eBay: You made a sale!',
            from: { emailAddress: { address: 'ebay@ebay.com', name: 'eBay' } },
            receivedDateTime: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
            bodyPreview: 'Congratulations! Your item sold for $45.00',
            body: { contentType: 'text', content: 'Congratulations! Your item sold for $45.00...' },
            hasAttachments: false
        },
        {
            id: 'mock-outlook-3',
            subject: 'Receipt for your purchase at Target',
            from: { emailAddress: { address: 'receipts@target.com', name: 'Target' } },
            receivedDateTime: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
            bodyPreview: 'Thank you for shopping at Target. Total: $27.45',
            body: { contentType: 'html', content: '<p>Thank you for shopping at Target. Total: $27.45</p>' },
            hasAttachments: true
        }
    ];
}
