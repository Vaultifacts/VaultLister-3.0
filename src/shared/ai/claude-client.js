// Shared Claude API client — single point of @anthropic-ai/sdk usage for route-level AI calls.
// All backend routes MUST import from here instead of instantiating Anthropic directly.
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Returns a configured Anthropic client using the ANTHROPIC_API_KEY env var.
 * Returns null when the key is not set (callers must handle the null case).
 */
export function getAnthropicClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    return new Anthropic({ apiKey });
}

/**
 * Wraps an Anthropic API call with retry logic (exponential backoff) and a timeout.
 * Respects Retry-After headers on 429 responses.
 * Logs API call duration for cost tracking.
 *
 * @param {Function} apiFn - Async function that calls the Anthropic SDK
 * @param {number} [timeoutMs] - Timeout in milliseconds (default 30s)
 * @returns {Promise<*>} Resolved value of apiFn
 */
async function callWithRetry(apiFn, timeoutMs = DEFAULT_TIMEOUT_MS) {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const startMs = Date.now();

        try {
            const result = await Promise.race([
                apiFn(controller.signal),
                new Promise((_, reject) =>
                    controller.signal.addEventListener('abort', () =>
                        reject(new Error(`Claude API call timed out after ${timeoutMs}ms`))
                    )
                )
            ]);

            const durationMs = Date.now() - startMs;
            if (process.env.NODE_ENV !== 'test') {
                console.info(JSON.stringify({ level: 'info', msg: 'Claude API call succeeded', durationMs, attempt, ts: new Date().toISOString() }));
            }
            return result;
        } catch (err) {
            lastError = err;
            const durationMs = Date.now() - startMs;

            // Timeout or abort — do not retry
            if (err.message?.includes('timed out')) {
                throw err;
            }

            // Rate limit — respect Retry-After header
            if (err.status === 429) {
                const retryAfterSec = parseInt(err.headers?.['retry-after'] || '0', 10);
                const waitMs = retryAfterSec > 0 ? retryAfterSec * 1000 : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                if (process.env.NODE_ENV !== 'test') {
                    console.warn(JSON.stringify({ level: 'warn', msg: 'Claude API rate limited', waitMs, attempt, durationMs, ts: new Date().toISOString() }));
                }
                if (attempt < MAX_RETRIES) await sleep(waitMs);
                continue;
            }

            // Transient server errors — retry with exponential backoff
            if (err.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
                const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
                if (process.env.NODE_ENV !== 'test') {
                    console.warn(JSON.stringify({ level: 'warn', msg: 'Claude API transient error, retrying', error: err.message, waitMs, attempt, durationMs, ts: new Date().toISOString() }));
                }
                if (attempt < MAX_RETRIES) await sleep(waitMs);
                continue;
            }

            // Non-retryable error
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }

    throw lastError;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Sends a vision (image + text) message to a Claude model.
 * @param {object} opts
 * @param {string} opts.imageBase64  - Base64-encoded image data
 * @param {string} opts.mimeType     - Image MIME type (e.g. 'image/jpeg')
 * @param {string} opts.prompt       - Text prompt to accompany the image
 * @param {string} [opts.model]      - Claude model ID (default: claude-sonnet-4-6)
 * @param {number} [opts.maxTokens]  - Max tokens (default: 2000)
 * @param {string} [opts.requestId]  - HTTP request ID for cross-service tracing
 * @param {number} [opts.timeoutMs] - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} Raw text content of the first response block
 */
export async function callVisionAPI({ imageBase64, mimeType, prompt, model = 'claude-sonnet-4-6', maxTokens = 2000, requestId = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const client = getAnthropicClient();
    if (!client) throw new Error('AI service not configured. Please set ANTHROPIC_API_KEY environment variable.');


    const response = await callWithRetry(
        () => client.messages.create({
            model,
            max_tokens: maxTokens,
            messages: [{
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
                    { type: 'text', text: prompt }
                ]
            }],
            ...(requestId && { metadata: { user_id: requestId } })
        }),
        timeoutMs
    );

    const response = await client.messages.create(params);
    return response.content[0].text;
}

/**
 * Sends a text-only message to a Claude model.
 * @param {object} opts
 * @param {string} opts.system       - System prompt
 * @param {string} opts.user         - User message content
 * @param {string} [opts.model]      - Claude model ID (default: claude-sonnet-4-6)
 * @param {number} [opts.maxTokens]  - Max tokens (default: 1500)
 * @param {string} [opts.requestId]  - HTTP request ID for cross-service tracing
 * @param {number} [opts.timeoutMs] - Timeout in milliseconds (default: 30000)
 * @returns {Promise<string>} Raw text content of the first response block
 */
export async function callTextAPI({ system, user, model = 'claude-sonnet-4-6', maxTokens = 1500, requestId = null, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const client = getAnthropicClient();
    if (!client) throw new Error('AI service not configured. Please set ANTHROPIC_API_KEY environment variable.');


    const response = await callWithRetry(
        () => client.messages.create({
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: user }],
            ...(requestId && { metadata: { user_id: requestId } })
        }),
        timeoutMs
    );

    const response = await client.messages.create(params);
    return response.content[0].text;
}
