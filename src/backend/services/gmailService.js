// Gmail API Service for VaultLister
// Handles Gmail OAuth token refresh and email fetching

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Refresh Gmail OAuth access token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token data
 */
export async function refreshGmailToken(refreshToken) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Gmail OAuth not configured (missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET)');
    }

    let response;
    try {
        response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            }),
            signal: AbortSignal.timeout(15000)
        });
    } catch (fetchError) {
        if (fetchError.name === 'TimeoutError' || fetchError.name === 'AbortError') {
            throw new Error('Gmail token refresh timed out after 15s');
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
 * @param {string} accessToken - Gmail access token
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of message IDs
 */
export async function fetchRecentEmails(accessToken, options = {}) {
    const {
        sinceMessageId,
        senderFilters = [],
        maxResults = 100,
        afterDate
    } = options;

    // Build Gmail search query
    const queryParts = [];

    // Filter by senders
    if (senderFilters.length > 0) {
        const senderQuery = senderFilters.map(s => `from:${s}`).join(' OR ');
        queryParts.push(`(${senderQuery})`);
    }

    // Filter by date (only emails from last 7 days if no sinceMessageId)
    if (afterDate) {
        const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');
        queryParts.push(`after:${dateStr}`);
    } else if (!sinceMessageId) {
        // Default to last 7 days for initial sync
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dateStr = sevenDaysAgo.toISOString().split('T')[0].replace(/-/g, '/');
        queryParts.push(`after:${dateStr}`);
    }

    const query = queryParts.join(' ');
    const url = new URL(`${GMAIL_API_BASE}/users/me/messages`);
    url.searchParams.set('maxResults', maxResults.toString());
    if (query) {
        url.searchParams.set('q', query);
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
            throw new Error('Gmail API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const messages = data.messages || [];

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
 * @param {string} accessToken - Gmail access token
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<Object>} Parsed email content
 */
export async function getEmailContent(accessToken, messageId) {
    const url = `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`;

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
            throw new Error('Gmail API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
    }

    const message = await response.json();
    return parseGmailMessage(message);
}

/**
 * Parse Gmail message into structured format
 * @param {Object} message - Raw Gmail message
 * @returns {Object} Parsed email data
 */
export function parseGmailMessage(message) {
    const headers = message.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    const parsed = {
        id: message.id,
        threadId: message.threadId,
        subject: getHeader('Subject') || '(No Subject)',
        from: getHeader('From') || '',
        to: getHeader('To') || '',
        date: getHeader('Date') || '',
        snippet: message.snippet || '',
        body: {
            text: '',
            html: ''
        },
        attachments: []
    };

    // Parse sender email
    const fromMatch = parsed.from.match(/<([^>]+)>/) || [null, parsed.from];
    parsed.fromEmail = fromMatch[1] || parsed.from;
    parsed.fromName = parsed.from.replace(/<[^>]+>/, '').trim();

    // Parse date
    try {
        parsed.dateObj = new Date(parsed.date);
        parsed.dateISO = parsed.dateObj.toISOString();
    } catch {
        parsed.dateObj = new Date();
        parsed.dateISO = parsed.dateObj.toISOString();
    }

    // Extract body and attachments from payload
    extractParts(message.payload, parsed);

    return parsed;
}

/**
 * Recursively extract parts from MIME message
 */
function extractParts(part, result) {
    if (!part) return;

    const mimeType = part.mimeType || '';

    // Handle multipart messages
    if (mimeType.startsWith('multipart/') && part.parts) {
        for (const subpart of part.parts) {
            extractParts(subpart, result);
        }
        return;
    }

    // Handle text body
    if (mimeType === 'text/plain' && part.body?.data) {
        result.body.text += decodeBase64Url(part.body.data);
    }

    // Handle HTML body
    if (mimeType === 'text/html' && part.body?.data) {
        result.body.html += decodeBase64Url(part.body.data);
    }

    // Handle attachments
    if (part.filename && part.body?.attachmentId) {
        result.attachments.push({
            filename: part.filename,
            mimeType: mimeType,
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId
        });
    }

    // Handle inline images
    if (mimeType.startsWith('image/') && part.body?.data) {
        result.attachments.push({
            filename: part.filename || `inline-image.${mimeType.split('/')[1]}`,
            mimeType: mimeType,
            size: part.body.size || 0,
            data: part.body.data, // Already base64
            inline: true
        });
    }
}

/**
 * Download attachment by ID
 * @param {string} accessToken - Gmail access token
 * @param {string} messageId - Gmail message ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<string>} Base64 encoded attachment data
 */
export async function getAttachment(accessToken, messageId, attachmentId) {
    const url = `${GMAIL_API_BASE}/users/me/messages/${messageId}/attachments/${attachmentId}`;

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
            throw new Error('Gmail API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data; // Base64 encoded
}

/**
 * Get user's email address from Gmail API
 * @param {string} accessToken - Gmail access token
 * @returns {Promise<string>} User's email address
 */
export async function getUserEmail(accessToken) {
    const url = `${GMAIL_API_BASE}/users/me/profile`;

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
            throw new Error('Gmail API request timed out after 15s');
        }
        throw fetchError;
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.emailAddress;
}

/**
 * Decode base64url encoded string (Gmail's encoding)
 */
function decodeBase64Url(data) {
    // Replace URL-safe characters and add padding
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);

    try {
        return Buffer.from(padded, 'base64').toString('utf-8');
    } catch {
        return '';
    }
}

/**
 * Convert base64url to standard base64
 */
export function base64UrlToBase64(data) {
    return data.replace(/-/g, '+').replace(/_/g, '/');
}
