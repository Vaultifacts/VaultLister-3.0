// fetchWithTimeout / withTimeout — Unit Tests
// Targets: src/backend/shared/fetchWithTimeout.js
//   - fetchWithTimeout(url, opts): AbortSignal-based timeout wrapper
//   - withTimeout(promise, ms, label): Promise.race timeout wrapper

import { describe, expect, test, mock, afterEach } from 'bun:test';

import {
    fetchWithTimeout,
    withTimeout,
} from '../backend/shared/fetchWithTimeout.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

// ─── fetchWithTimeout ─────────────────────────────────────────────────────────

describe('fetchWithTimeout — basic behaviour', () => {
    test('calls fetch with the supplied URL', async () => {
        const mockFetch = mock(async () => new Response('ok', { status: 200 }));
        globalThis.fetch = mockFetch;

        await fetchWithTimeout('https://example.com/api');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url] = mockFetch.mock.calls[0];
        expect(url).toBe('https://example.com/api');
    });

    test('passes through additional fetch options', async () => {
        const mockFetch = mock(async () => new Response('', { status: 204 }));
        globalThis.fetch = mockFetch;

        await fetchWithTimeout('https://example.com/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });

        const [, opts] = mockFetch.mock.calls[0];
        expect(opts.method).toBe('POST');
        expect(opts.headers['Content-Type']).toBe('application/json');
        expect(opts.body).toBe('{}');
    });

    test('attaches an AbortSignal to the fetch options', async () => {
        const mockFetch = mock(async () => new Response('', { status: 200 }));
        globalThis.fetch = mockFetch;

        await fetchWithTimeout('https://example.com');

        const [, opts] = mockFetch.mock.calls[0];
        expect(opts.signal).toBeDefined();
        expect(typeof opts.signal.aborted).toBe('boolean');
    });

    test('does not include timeoutMs in the options passed to fetch', async () => {
        const mockFetch = mock(async () => new Response('', { status: 200 }));
        globalThis.fetch = mockFetch;

        await fetchWithTimeout('https://example.com', { timeoutMs: 5000 });

        const [, opts] = mockFetch.mock.calls[0];
        expect(opts.timeoutMs).toBeUndefined();
    });

    test('uses default timeout of 30000 ms when timeoutMs is omitted', async () => {
        // AbortSignal.timeout is a static factory that accepts a millisecond value.
        // Spy on it to confirm the default.
        const originalTimeout = AbortSignal.timeout;
        let capturedMs;
        AbortSignal.timeout = (ms) => {
            capturedMs = ms;
            return originalTimeout(ms);
        };

        const mockFetch = mock(async () => new Response('', { status: 200 }));
        globalThis.fetch = mockFetch;

        try {
            await fetchWithTimeout('https://example.com');
        } finally {
            AbortSignal.timeout = originalTimeout;
        }

        expect(capturedMs).toBe(30000);
    });

    test('forwards a custom timeoutMs to AbortSignal.timeout', async () => {
        const originalTimeout = AbortSignal.timeout;
        let capturedMs;
        AbortSignal.timeout = (ms) => {
            capturedMs = ms;
            return originalTimeout(ms);
        };

        const mockFetch = mock(async () => new Response('', { status: 200 }));
        globalThis.fetch = mockFetch;

        try {
            await fetchWithTimeout('https://example.com', { timeoutMs: 5000 });
        } finally {
            AbortSignal.timeout = originalTimeout;
        }

        expect(capturedMs).toBe(5000);
    });

    test('resolves with the Response returned by fetch', async () => {
        const mockResponse = new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        globalThis.fetch = mock(async () => mockResponse);

        const result = await fetchWithTimeout('https://example.com');
        expect(result).toBe(mockResponse);
    });

    test('propagates fetch errors', async () => {
        globalThis.fetch = mock(async () => { throw new Error('network failure'); });

        await expect(
            fetchWithTimeout('https://example.com')
        ).rejects.toThrow('network failure');
    });
});

// ─── withTimeout ─────────────────────────────────────────────────────────────

describe('withTimeout — resolves before deadline', () => {
    test('resolves with the promise value when it completes in time', async () => {
        const fast = Promise.resolve(42);
        const result = await withTimeout(fast, 1000, 'fast op');
        expect(result).toBe(42);
    });

    test('resolves with an object value', async () => {
        const data = { id: 1, name: 'test' };
        const result = await withTimeout(Promise.resolve(data), 1000);
        expect(result).toEqual(data);
    });

    test('resolves with undefined when the promise resolves to undefined', async () => {
        const result = await withTimeout(Promise.resolve(undefined), 1000);
        expect(result).toBeUndefined();
    });
});

describe('withTimeout — rejects on timeout', () => {
    test('rejects with a timeout error when the promise is too slow', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 200));

        await expect(
            withTimeout(slow, 50, 'slow op')
        ).rejects.toThrow('slow op timed out after 50ms');
    });

    test('error message includes the label', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 200));

        let error;
        try {
            await withTimeout(slow, 50, 'MyService.doThing');
        } catch (e) {
            error = e;
        }

        expect(error).toBeDefined();
        expect(error.message).toContain('MyService.doThing');
    });

    test('error message includes the timeout duration', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 200));

        let error;
        try {
            await withTimeout(slow, 75, 'op');
        } catch (e) {
            error = e;
        }

        expect(error.message).toContain('75ms');
    });

    test('uses default timeout of 30000 ms when ms is omitted', async () => {
        // Just verify it resolves instantly (default=30s >> fast promise)
        const result = await withTimeout(Promise.resolve('hi'), undefined, 'op');
        expect(result).toBe('hi');
    });

    test('uses default label "External call" when label is omitted', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 200));

        let error;
        try {
            await withTimeout(slow, 50);
        } catch (e) {
            error = e;
        }

        expect(error.message).toContain('External call');
    });
});

describe('withTimeout — propagates rejection', () => {
    test('re-throws the original error when the promise rejects before timeout', async () => {
        const failing = Promise.reject(new Error('upstream failure'));

        await expect(
            withTimeout(failing, 1000, 'op')
        ).rejects.toThrow('upstream failure');
    });
});
