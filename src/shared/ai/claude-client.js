// Shared Claude API client — single point of @anthropic-ai/sdk usage for route-level AI calls.
// All backend routes MUST import from here instead of instantiating Anthropic directly.
import Anthropic from '@anthropic-ai/sdk';

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
 * Sends a vision (image + text) message to a Claude model.
 * @param {object} opts
 * @param {string} opts.imageBase64  - Base64-encoded image data
 * @param {string} opts.mimeType     - Image MIME type (e.g. 'image/jpeg')
 * @param {string} opts.prompt       - Text prompt to accompany the image
 * @param {string} [opts.model]      - Claude model ID (default: claude-sonnet-4-6)
 * @param {number} [opts.maxTokens]  - Max tokens (default: 2000)
 * @param {string} [opts.requestId]  - HTTP request ID for cross-service tracing
 * @returns {Promise<string>} Raw text content of the first response block
 */
export async function callVisionAPI({ imageBase64, mimeType, prompt, model = 'claude-sonnet-4-6', maxTokens = 2000, requestId = null }) {
    const client = getAnthropicClient();
    if (!client) throw new Error('AI service not configured. Please set ANTHROPIC_API_KEY environment variable.');

    const params = {
        model,
        max_tokens: maxTokens,
        messages: [{
            role: 'user',
            content: [
                { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
                { type: 'text', text: prompt }
            ]
        }]
    };
    if (requestId) params.metadata = { user_id: requestId };

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
 * @returns {Promise<string>} Raw text content of the first response block
 */
export async function callTextAPI({ system, user, model = 'claude-sonnet-4-6', maxTokens = 1500, requestId = null }) {
    const client = getAnthropicClient();
    if (!client) throw new Error('AI service not configured. Please set ANTHROPIC_API_KEY environment variable.');

    const params = {
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }]
    };
    if (requestId) params.metadata = { user_id: requestId };

    const response = await client.messages.create(params);
    return response.content[0].text;
}
