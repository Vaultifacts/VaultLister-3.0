# Vault Buddy SSE Streaming — Design Spec
**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** Vault Buddy chatbot (floating widget + full-page UI) — stream AI responses word-by-word via Server-Sent Events

---

## Problem

The current Vault Buddy implementation waits for the full AI response before rendering anything. Claude Haiku responses are typically 200–500 tokens; users stare at a loading spinner for 2–6 seconds. Streaming renders each word as it arrives, cutting perceived wait time to near-zero.

---

## Architecture

Content-negotiation on the existing POST `/api/chatbot/message` endpoint. The client sends `{ stream: true }` in the request body to opt into SSE; the endpoint returns `text/event-stream` instead of JSON. The non-streaming path is unchanged.

No new route. No new URL. The shared pre-AI logic (conversation lookup, user message insert, auto-title, history fetch) runs once before branching.

---

## SSE Wire Format

Two event types, both prefixed `data: ` on a single line followed by `\n\n`:

```
data: {"type":"delta","content":"Hello"}

data: {"type":"delta","content":", how"}

data: {"type":"done","messageId":"msg_...","quickActions":[...]}

```

- `delta` — incremental text fragment (one or more tokens)
- `done` — signals end of stream; carries the persisted `messageId` and any `quickActions` for the message

---

## Backend — 3 files

### 1. `src/backend/services/grokService.js`

New export: `async function* streamResponse(messages, userContext)`

- **Claude path:** calls `anthropic.messages.stream({ model, system, messages, max_tokens: 1024 })` and uses the `.on('text')` / `.finalMessage()` pattern to yield `{ type: 'delta', content }` for each text event, then `{ type: 'done', quickActions, source: 'claude' }` after the stream finishes.
- **Grok path:** calls the x.ai Chat Completions endpoint with `stream: true`, reads the response body as a `ReadableStream`, parses OpenAI-style `data: {...}` SSE lines, yields `{ type: 'delta', content }` per `choices[0].delta.content`, then `{ type: 'done', quickActions, source: 'grok' }`.
- **Mock path:** yields the full canned response as a single `{ type: 'delta', content }`, then `{ type: 'done', quickActions: [], source: 'mock' }`.
- Quick actions are extracted by calling the existing `extractQuickActions(fullContent)` helper after accumulating the full content string during streaming.

### 2. `src/backend/routes/chatbot.js`

In the `POST /message` handler, after the shared pre-AI logic, add a branch:

```js
if (body.stream) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            let fullContent = '';
            try {
                for await (const chunk of streamResponse(historyMessages, { userId: user.id })) {
                    if (chunk.type === 'delta') {
                        fullContent += chunk.content;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                    } else if (chunk.type === 'done') {
                        // persist assistant message to DB
                        const assistantMessageId = `msg_${Date.now()}_${crypto.randomUUID().split('-')[0]}`;
                        const metadata = { source: chunk.source, quickActions: chunk.quickActions || [] };
                        const ts = new Date().toISOString();
                        await query.run(
                            `INSERT INTO chat_messages (id, conversation_id, user_id, role, content, metadata, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)`,
                            [assistantMessageId, conversation_id, user.id, fullContent, JSON.stringify(metadata), ts]
                        );
                        await query.run(
                            `UPDATE chat_conversations SET updated_at = ? WHERE id = ? AND user_id = ?`,
                            [ts, conversation_id, user.id]
                        );
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', messageId: assistantMessageId, quickActions: chunk.quickActions || [] })}\n\n`));
                        controller.close();
                    }
                }
            } catch (err) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`));
                controller.close();
            }
        }
    });
    return {
        isStream: true,
        body: readable,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        }
    };
}
```

### 3. `src/backend/server.js`

After `const result = await router(context)`, add one passthrough before the existing JSON branch:

```js
if (result?.isStream) {
    return new Response(result.body, {
        status: 200,
        headers: { ...result.headers, ...dynamicCorsHeaders }
    });
}
```

Security headers are applied to this response the same way as JSON responses (spread `applySecurityHeaders(context)` into the headers object).

---

## Frontend — 3 files

### 4. `src/frontend/core/api.js`

New method on the `api` object:

```js
async stream(endpoint, body, { onChunk, onDone, onError } = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
    };
    if (store.state.token) headers['Authorization'] = `Bearer ${store.state.token}`;
    if (this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, stream: true }),
    });

    if (!response.ok) {
        onError?.(`HTTP ${response.status}`);
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // incomplete last chunk
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const event = safeJsonParse(line.slice(6), null);
            if (!event) continue;
            if (event.type === 'delta') onChunk?.(event.content);
            else if (event.type === 'done') onDone?.(event);
            else if (event.type === 'error') onError?.(event.error);
        }
    }
}
```

This method bypasses `api.request()` entirely (which has a 30s timeout and forces JSON parsing). It reads the `ReadableStream` directly, splits on `\n\n` SSE boundaries, and dispatches to callbacks. Uses try/catch `JSON.parse` (not `safeJsonParse`, which is a backend-only utility).

### 5. `src/frontend/components/chatWidget.js`

`sendMessage()` (line 77) currently calls `api.post('/chatbot/message', ...)` and appends the assistant reply in the `.then()` callback. The widget uses a `this.messages[]` array + `this.render()` pattern where `render()` does a full `container.innerHTML` replacement via `sanitizeHTML`. Calling `this.render()` on every SSE chunk would be expensive.

Replace with `api.stream()` using a two-phase approach:

**Phase 1 (stream start):** Hide the typing indicator, push a placeholder message object into `this.messages`, call `this.render()` once. The placeholder object has `{ id: '_streaming', role: 'assistant', content: '', _streaming: true }`. `renderMessage()` gives `_streaming` messages a `data-streaming="true"` attribute on the bubble div so subsequent chunks can be appended directly.

**Phase 2 (per-chunk):** Find the bubble with `document.querySelector('[data-streaming="true"] .chat-message-bubble')` and append the chunk text directly — no `this.render()` call. Scroll to bottom on each chunk.

**Phase 3 (done):** Find the placeholder in `this.messages` by `_streaming: true`, replace it with the final message object `{ id: event.messageId, role: 'assistant', content: accumulatedContent, metadata: { quickActions: event.quickActions } }`, call `this.render()` once to finalize with correct ID and quick action buttons.

**On error:** Replace placeholder with an error message object and call `this.render()` once.

### 6. `src/frontend/handlers/handlers-deferred.js` and `handlers-community-help.js`

Both files have `sendVaultBuddyMessage` (lines 17628 and 478 respectively) that call `api.post('/chatbot/message', ...)` and update the DOM in the `.then()`. Replace with the same `api.stream()` + `_streaming` pattern as `chatWidget.js` above, adapted to the full-page UI's DOM structure (element IDs differ between the two clients but the logic is identical).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Network drop mid-stream | `reader.read()` throws → `onError` called → placeholder replaced with error text |
| Claude/Grok API error | Generator catches, yields `{type:'error'}` → controller enqueues error event → `onError` called |
| DB write fails in `done` handler | Error logged; `done` event still emitted with empty `messageId`; message not persisted — acceptable degraded mode |
| Client disconnects | Generator continues until next yield check (no explicit cancellation); minor inefficiency, acceptable |

---

## Testing

- Unit: mock `streamResponse` generator to yield 3 delta chunks + done; assert `onChunk` called 3×, `onDone` called once with correct `messageId`
- Integration: start real server, POST `{ stream: true }` to `/api/chatbot/message`, assert response is `text/event-stream`, parse SSE lines, confirm `done` event has a persisted `messageId` that exists in DB
- E2E: send a message in the Vault Buddy widget, assert assistant message renders incrementally (text length increases over time)

---

## What This Does NOT Change

- Non-streaming path (`body.stream` absent or false) — identical to current behaviour
- Rate limiting — chatbot messages are already on the `expensive` tier (10/window)
- Auth, CSRF, conversation ownership checks — all run before the streaming branch
- Quick actions — same `extractQuickActions()` logic, just called after content is accumulated
