// Mock Fetch Helper
// Provides spyOn(globalThis, 'fetch') with configurable responses
// Usage:
//   import { installFetchMock } from './helpers/mockFetch.js';
//   const fetchMock = installFetchMock();
//   fetchMock.respondWith({ ok: true, data: { url: 'https://...' } });

import { mock, spyOn } from 'bun:test';

/**
 * Create a mock Response object matching the Fetch API shape.
 */
function createMockResponse(options = {}) {
    const {
        status = 200,
        ok = status >= 200 && status < 300,
        data = {},
        text = null,
        headers = {},
    } = options;

    const headerMap = new Map(Object.entries(headers));

    return {
        status,
        ok,
        json: async () => data,
        text: async () => text ?? JSON.stringify(data),
        headers: {
            get: (key) => headerMap.get(key.toLowerCase()) ?? null,
            has: (key) => headerMap.has(key.toLowerCase()),
        },
        clone: function() { return { ...this }; },
    };
}

/**
 * Install a fetch spy on globalThis.
 * Returns an object with helpers to configure responses.
 */
export function installFetchMock() {
    const fetchSpy = spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue(createMockResponse());

    return {
        spy: fetchSpy,

        /** Set a single response for all fetch calls */
        respondWith(options) {
            fetchSpy.mockResolvedValue(createMockResponse(options));
        },

        /** Set different responses for sequential calls */
        respondSequence(responseList) {
            for (const opts of responseList) {
                fetchSpy.mockResolvedValueOnce(createMockResponse(opts));
            }
        },

        /** Make fetch reject with an error */
        rejectWith(error) {
            fetchSpy.mockRejectedValue(error instanceof Error ? error : new Error(error));
        },

        /** Reset the spy and restore default behavior */
        reset() {
            fetchSpy.mockClear();
            fetchSpy.mockResolvedValue(createMockResponse());
        },

        /** Restore the original fetch function */
        restore() {
            mock.restore();
        },
    };
}
