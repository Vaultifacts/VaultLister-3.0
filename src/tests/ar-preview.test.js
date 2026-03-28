// AR Preview — Unit Tests
import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { ARPreview } from '../shared/utils/ar-preview.js';

// ─── Minimal DOM stubs ────────────────────────────────────────────────────────

function makeCanvas() {
    const listeners = {};
    return {
        style: { cssText: '' },
        getContext: () => ({
            clearRect: mock(() => {}),
            fillRect: mock(() => {}),
            drawImage: mock(() => {}),
            fillText: mock(() => {}),
            save: mock(() => {}),
            restore: mock(() => {}),
            translate: mock(() => {}),
            rotate: mock(() => {}),
            set fillStyle(_) {},
            set font(_) {},
            set textAlign(_) {},
            set shadowColor(_) {},
            set shadowBlur(_) {},
            set shadowOffsetX(_) {},
            set shadowOffsetY(_) {},
        }),
        width: 0,
        height: 0,
        toDataURL: () => 'data:image/png;base64,abc',
        addEventListener: (t, h) => { listeners[t] = h; },
        removeEventListener: mock(() => {}),
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
        _listeners: listeners,
    };
}

function makeVideo() {
    return {
        style: { cssText: '' },
        setAttribute: mock(() => {}),
        play: mock(async () => {}),
        srcObject: null,
        videoWidth: 1280,
        videoHeight: 720,
    };
}

function makeContainer() {
    const listeners = {};
    const el = {
        style: {},
        innerHTML: '',
        appendChild: mock(() => {}),
        removeEventListener: mock((t, h) => { delete listeners[t]; }),
        addEventListener: (t, h) => { listeners[t] = h; },
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
        _listeners: listeners,
    };
    return el;
}

function makeARPreview() {
    const ar = new ARPreview();
    ar.video = makeVideo();
    ar.canvas = makeCanvas();
    ar.ctx = ar.canvas.getContext('2d');
    ar._container = makeContainer();
    ar._boundListeners = [];
    return ar;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStream(tracks = 1) {
    const mockTracks = Array.from({ length: tracks }, () => ({ stop: mock(() => {}) }));
    return {
        getTracks: () => mockTracks,
        _tracks: mockTracks,
    };
}

// ─── start() — permission denied ──────────────────────────────────────────────

describe('ARPreview.start() — NotAllowedError', () => {
    test('returns false and does not throw on NotAllowedError', async () => {
        const ar = makeARPreview();
        globalThis.navigator = {
            mediaDevices: {
                getUserMedia: mock(async () => { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; }),
            },
        };

        const result = await ar.start();
        expect(result).toBe(false);
        expect(ar.isActive).toBe(false);
    });

    test('returns false and does not throw on NotFoundError', async () => {
        const ar = makeARPreview();
        globalThis.navigator = {
            mediaDevices: {
                getUserMedia: mock(async () => { const e = new Error('no cam'); e.name = 'NotFoundError'; throw e; }),
            },
        };

        const result = await ar.start();
        expect(result).toBe(false);
    });

    test('still throws on unexpected errors', async () => {
        const ar = makeARPreview();
        globalThis.navigator = {
            mediaDevices: {
                getUserMedia: mock(async () => { throw new Error('unknown'); }),
            },
        };

        expect(ar.start()).rejects.toThrow('unknown');
    });
});

describe('ARPreview.start() — success', () => {
    test('sets isActive true and returns true on success', async () => {
        const ar = makeARPreview();
        const stream = makeStream();
        globalThis.navigator = {
            mediaDevices: { getUserMedia: mock(async () => stream) },
        };
        globalThis.requestAnimationFrame = mock(() => {});

        const result = await ar.start();
        expect(result).toBe(true);
        expect(ar.isActive).toBe(true);
        expect(ar.stream).toBe(stream);
    });
});

// ─── stop() — double-stop safety ─────────────────────────────────────────────

describe('ARPreview.stop()', () => {
    test('does not throw when called twice', () => {
        const ar = makeARPreview();
        ar.stream = makeStream();
        ar.isActive = true;

        expect(() => {
            ar.stop();
            ar.stop();
        }).not.toThrow();
    });

    test('nulls stream before calling getTracks', () => {
        const ar = makeARPreview();
        const stream = makeStream();
        ar.stream = stream;
        ar.isActive = true;

        ar.stop();

        expect(ar.stream).toBeNull();
        expect(ar.isActive).toBe(false);
        // Each track should have been stopped exactly once
        for (const track of stream._tracks) {
            expect(track.stop).toHaveBeenCalledTimes(1);
        }
    });

    test('clears video srcObject', () => {
        const ar = makeARPreview();
        ar.stream = makeStream();
        ar.isActive = true;

        ar.stop();

        expect(ar.video.srcObject).toBeNull();
    });
});

// ─── renderLoop() — 30fps cap ─────────────────────────────────────────────────

describe('ARPreview.renderLoop() — FPS cap', () => {
    test('skips frame when timestamp delta is below 1000/30ms', () => {
        const ar = makeARPreview();
        ar.isActive = true;
        ar._lastFrameTime = 1000;

        const rafCalls = [];
        globalThis.requestAnimationFrame = mock((cb) => rafCalls.push(cb));

        // Call with a timestamp only 10ms later (well under ~33ms threshold)
        ar.renderLoop(1010);

        expect(rafCalls.length).toBe(1); // rAF queued for next tick
        // clearRect should NOT have been called because we skipped the frame
        expect(ar.ctx.clearRect).not.toHaveBeenCalled();
    });

    test('renders frame when timestamp delta exceeds 1000/30ms', () => {
        const ar = makeARPreview();
        ar.isActive = true;
        ar._lastFrameTime = 1000;

        globalThis.requestAnimationFrame = mock(() => {});

        // Call with timestamp 40ms later (above 33ms threshold)
        ar.renderLoop(1040);

        expect(ar.ctx.clearRect).toHaveBeenCalled();
        expect(ar._lastFrameTime).toBe(1040);
    });

    test('stops when isActive is false', () => {
        const ar = makeARPreview();
        ar.isActive = false;

        const rafCalled = mock(() => {});
        globalThis.requestAnimationFrame = rafCalled;

        ar.renderLoop(0);

        expect(rafCalled).not.toHaveBeenCalled();
    });
});

// ─── cleanup() — event listener removal ──────────────────────────────────────

describe('ARPreview.cleanup()', () => {
    test('calls removeEventListener for every registered listener', () => {
        const ar = makeARPreview();
        const target = ar._container;

        // Simulate setupControls having registered some listeners
        const h1 = () => {};
        const h2 = () => {};
        ar._boundListeners = [
            { target, type: 'mousedown', handler: h1 },
            { target, type: 'mousemove', handler: h2 },
        ];
        ar.stream = null;

        ar.cleanup();

        expect(target.removeEventListener).toHaveBeenCalledTimes(2);
        expect(ar._boundListeners).toHaveLength(0);
    });

    test('cleanup calls stop() — isActive becomes false', () => {
        const ar = makeARPreview();
        ar.isActive = true;
        ar.stream = makeStream();
        ar._boundListeners = [];

        ar.cleanup();

        expect(ar.isActive).toBe(false);
    });
});
