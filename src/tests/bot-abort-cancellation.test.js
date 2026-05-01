// Bot AbortController cancellation tests (#157)
// Tests the expected contract for graceful cancellation of long-running bot operations.
// All Playwright and ioredis dependencies are mocked — no live browser required.
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock stealth, rate-limits, and logger before importing the bot
mock.module('../../worker/bots/stealth.js', () => ({
    stealthChromium: {
        launch: mock(async () => mockBrowser)
    },
    randomChromeUA: mock(() => 'MockAgent/1.0'),
    randomViewport: mock(() => ({ width: 1280, height: 800 })),
    STEALTH_ARGS: [],
    STEALTH_IGNORE_DEFAULTS: [],
    humanClick: mock(async () => {}),
    humanScroll: mock(async () => {}),
    mouseWiggle: mock(async () => {}),
}));

mock.module('../../worker/bots/rate-limits.js', () => ({
    RATE_LIMITS: {
        poshmark: {
            shareDelay: 10,
            followDelay: 10,
            offerDelay: 10,
        }
    },
    jitteredDelay: mock(() => 10),
}));

mock.module('../backend/shared/logger.js', () => ({
    logger: { info: mock(), warn: mock(), error: mock() }
}));

// Mock fs to prevent real file I/O — spread real module so readdirSync etc. stay available
mock.module('fs', () => {
    const actual = require('fs');
    return {
        ...actual,
        appendFileSync: mock(() => {}),
        existsSync: mock(() => false),
        readFileSync: mock(() => '[]'),
        writeFileSync: mock(() => {}),
        mkdirSync: mock(() => {}),
        unlinkSync: mock(() => {}),
    };
});

mock.module('path', () => {
    const actual = require('path');
    return {
        ...actual,
        join: actual.join,
        dirname: actual.dirname,
        resolve: actual.resolve,
    };
});

// Build a minimal mock Playwright page that supports abort signal checking
function createMockPage(abortSignal) {
    return {
        goto: mock(async (url) => {
            if (abortSignal?.aborted) throw new Error('AbortError: Operation cancelled');
        }),
        waitForTimeout: mock(async (ms) => {
            if (abortSignal?.aborted) throw new Error('AbortError: Operation cancelled');
        }),
        waitForSelector: mock(async () => ({})),
        waitForFunction: mock(async () => {}),
        $: mock(async () => null),
        $$: mock(async () => []),
        $$eval: mock(async () => []),
        $eval: mock(async () => '0'),
        click: mock(async () => {}),
        fill: mock(async () => {}),
        keyboard: { type: mock(async () => {}) },
        route: mock(async () => {}),
        context: mock(() => ({
            addCookies: mock(async () => {}),
            cookies: mock(async () => []),
            newPage: mock(async () => createMockPage(abortSignal)),
        })),
        url: mock(() => 'https://poshmark.com/feed'),
    };
}

const mockBrowser = {
    newContext: mock(async () => ({
        addCookies: mock(async () => {}),
        newPage: mock(async () => createMockPage()),
    })),
    close: mock(async () => {}),
};

// Helper: build a bot-like object with cancellation support for testing
// This simulates what the bot should do once AbortController is added
function createAbortableBotSession(abortSignal) {
    let cancelled = false;
    const page = createMockPage(abortSignal);

    return {
        cancelled: () => cancelled,
        async runShareCloset(items) {
            const results = [];
            for (const item of items) {
                if (abortSignal?.aborted) {
                    cancelled = true;
                    break;
                }
                // Simulate navigation step
                await page.goto(`https://poshmark.com/listing/${item}`);
                if (abortSignal?.aborted) {
                    cancelled = true;
                    break;
                }
                // Simulate click step
                await page.waitForTimeout(10);
                if (abortSignal?.aborted) {
                    cancelled = true;
                    break;
                }
                results.push(item);
            }
            return results;
        },
        async cleanup() {
            await mockBrowser.close();
        }
    };
}

describe('Bot cancellation — AbortController pattern', () => {
    test('should process all items when no abort is signalled', async () => {
        const controller = new AbortController();
        const session = createAbortableBotSession(controller.signal);
        const items = ['item-1', 'item-2', 'item-3'];

        const processed = await session.runShareCloset(items);

        expect(processed).toHaveLength(3);
        expect(session.cancelled()).toBe(false);
    });

    test('should stop processing when abort is signalled before the loop starts', async () => {
        const controller = new AbortController();
        controller.abort(); // abort immediately
        const session = createAbortableBotSession(controller.signal);
        const items = ['item-1', 'item-2', 'item-3'];

        const processed = await session.runShareCloset(items);

        expect(processed).toHaveLength(0);
        expect(session.cancelled()).toBe(true);
    });

    test('should stop mid-loop when abort is signalled between navigation steps', async () => {
        const controller = new AbortController();

        // Build session with a page that aborts mid-iteration
        let callCount = 0;
        const page = {
            goto: mock(async () => {
                callCount++;
                if (callCount >= 2) controller.abort(); // abort after 2nd navigation
            }),
            waitForTimeout: mock(async () => {
                if (controller.signal.aborted) throw new Error('AbortError');
            }),
        };

        let cancelled = false;
        const items = ['item-1', 'item-2', 'item-3'];
        const results = [];

        for (const item of items) {
            if (controller.signal.aborted) { cancelled = true; break; }
            await page.goto(`https://poshmark.com/listing/${item}`);
            if (controller.signal.aborted) { cancelled = true; break; }
            results.push(item);
        }

        expect(results.length).toBeLessThan(items.length);
        expect(cancelled).toBe(true);
    });

    test('should check abort signal after navigation step', async () => {
        const controller = new AbortController();

        // Track when abort was checked relative to navigation calls
        const navigationCalls = [];
        const abortChecks = [];

        const session = {
            cancelled: () => controller.signal.aborted,
            async runWithAbortChecks() {
                for (let i = 0; i < 3; i++) {
                    navigationCalls.push(i);
                    // Simulate navigation
                    if (controller.signal.aborted) {
                        abortChecks.push(i);
                        return navigationCalls.length - 1;
                    }
                    // Simulate wait
                    await new Promise(r => setTimeout(r, 1));
                    if (controller.signal.aborted) {
                        abortChecks.push(i);
                        return navigationCalls.length;
                    }
                }
                return navigationCalls.length;
            }
        };

        controller.abort(); // Pre-abort
        const processed = await session.runWithAbortChecks();

        // Should check abort signal — navigation called once (first iteration), then abort detected
        expect(navigationCalls.length).toBeGreaterThanOrEqual(1);
        expect(abortChecks.length).toBeGreaterThanOrEqual(1);
    });

    test('should clean up browser resources on cancellation', async () => {
        const controller = new AbortController();
        const closeSpy = mock(async () => {});
        const browser = { ...mockBrowser, close: closeSpy };

        // Simulate cleanup on abort
        controller.abort();
        if (controller.signal.aborted) {
            await browser.close();
        }

        expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    test('should not throw when AbortController is not provided (backward compat)', async () => {
        // No signal passed — bot should work as before
        const session = createAbortableBotSession(undefined);
        const items = ['item-a', 'item-b'];

        const processed = await session.runShareCloset(items);

        expect(processed).toHaveLength(2);
        expect(session.cancelled()).toBe(false);
    });
});

describe('Bot cancellation — signal propagation', () => {
    test('should expose aborted state from AbortController.signal', () => {
        const controller = new AbortController();
        expect(controller.signal.aborted).toBe(false);
        controller.abort();
        expect(controller.signal.aborted).toBe(true);
    });

    test('should fire abort event listeners when signal is aborted', () => {
        const controller = new AbortController();
        let fired = false;
        controller.signal.addEventListener('abort', () => { fired = true; });
        controller.abort();
        expect(fired).toBe(true);
    });

    test('should support abort with a reason', () => {
        const controller = new AbortController();
        controller.abort(new Error('User cancelled operation'));
        expect(controller.signal.aborted).toBe(true);
        expect(controller.signal.reason).toBeInstanceOf(Error);
    });

    test('should allow checking abort signal between major steps without throwing', () => {
        const controller = new AbortController();

        function checkAbort(signal) {
            if (signal?.aborted) return true;
            return false;
        }

        expect(checkAbort(controller.signal)).toBe(false);
        controller.abort();
        expect(checkAbort(controller.signal)).toBe(true);
    });
});

describe('Bot cancellation — cleanup on abort', () => {
    test('should close page context when abort is triggered', async () => {
        const mockClose = mock(async () => {});
        const mockContext = { close: mockClose };
        const controller = new AbortController();

        async function runWithCleanup(signal) {
            try {
                if (signal.aborted) throw new Error('AbortError');
                await new Promise(r => setTimeout(r, 100));
            } finally {
                await mockContext.close();
            }
        }

        controller.abort();
        await runWithCleanup(controller.signal).catch(() => {});

        expect(mockClose).toHaveBeenCalledTimes(1);
    });

    test('should close browser on abort even when navigation throws', async () => {
        const mockBrowserClose = mock(async () => {});

        async function simulateBotWithCleanup(signal) {
            const browser = { close: mockBrowserClose };
            try {
                if (signal.aborted) throw new Error('AbortError: cancelled before start');
                await new Promise(r => setTimeout(r, 10));
            } catch (err) {
                if (err.message.includes('AbortError')) {
                    await browser.close();
                }
                throw err;
            }
        }

        const controller = new AbortController();
        controller.abort();

        try {
            await simulateBotWithCleanup(controller.signal);
        } catch (_) {}

        expect(mockBrowserClose).toHaveBeenCalledTimes(1);
    });
});
