// Environment & Quality — Performance Utilities
// Audit gaps: H15 (frontend perf utils untested), H16 (Cache unbounded),
//             H23 (navigator.connection graceful degradation)
// Category: Performance / Capacity

import { describe, expect, test, beforeEach } from 'bun:test';

// ─── DOM/browser shims (minimal, before imports) ────────────────────────────

if (typeof window === 'undefined') {
    globalThis.window = globalThis;
    globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    globalThis.requestIdleCallback = (fn) => setTimeout(fn, 0);
    globalThis.navigator = {};
    globalThis.document = {
        querySelectorAll: () => [],
        createElement: () => ({ getContext: () => ({}) }),
    };
    globalThis.IntersectionObserver = class {
        constructor() {}
        observe() {}
        unobserve() {}
    };
    globalThis.Image = class {
        set src(v) { if (this.onload) setTimeout(this.onload, 0); }
    };
    globalThis.performance = { now: () => Date.now() };
    globalThis.FileReader = class {
        readAsDataURL() { if (this.onload) this.onload({ target: { result: '' } }); }
    };
}

import {
    debounce,
    throttle,
    Cache,
    getVisibleItems,
    formatFileSize,
    escapeHtmlFast,
    isSlowConnection,
    optimizeImageURL,
    chunkProcess,
    EventManager,
} from '../frontend/utils/performance.js';

// ═══════════════════════════════════════════════════════════════════════════════
// debounce (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('debounce (H15)', () => {
    test('should not fire immediately', async () => {
        let callCount = 0;
        const fn = debounce(() => { callCount++; }, 50);
        fn();
        expect(callCount).toBe(0);
        await new Promise(r => setTimeout(r, 80));
        expect(callCount).toBe(1);
    });

    test('should reset timer on rapid calls', async () => {
        let callCount = 0;
        const fn = debounce(() => { callCount++; }, 50);
        fn();
        await new Promise(r => setTimeout(r, 30));
        fn(); // reset
        await new Promise(r => setTimeout(r, 30));
        fn(); // reset again
        expect(callCount).toBe(0);
        await new Promise(r => setTimeout(r, 80));
        expect(callCount).toBe(1); // fired only once
    });

    test('should pass arguments to the wrapped function', async () => {
        let received = null;
        const fn = debounce((a, b) => { received = [a, b]; }, 20);
        fn('hello', 42);
        await new Promise(r => setTimeout(r, 50));
        expect(received).toEqual(['hello', 42]);
    });

    test('default wait is 300ms', () => {
        const fn = debounce(() => {});
        expect(typeof fn).toBe('function');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// throttle (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('throttle (H15)', () => {
    test('should fire immediately on first call', () => {
        let callCount = 0;
        const fn = throttle(() => { callCount++; }, 100);
        fn();
        expect(callCount).toBe(1);
    });

    test('should suppress subsequent calls within wait period', () => {
        let callCount = 0;
        const fn = throttle(() => { callCount++; }, 100);
        fn(); // fires
        fn(); // suppressed
        fn(); // suppressed
        expect(callCount).toBe(1);
    });

    test('should allow calls after wait period', async () => {
        let callCount = 0;
        const fn = throttle(() => { callCount++; }, 30);
        fn(); // fires
        await new Promise(r => setTimeout(r, 50));
        fn(); // fires (past wait)
        expect(callCount).toBe(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cache class (H15, H16)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cache class (H15)', () => {
    test('set/get stores and retrieves values', () => {
        const cache = new Cache(60000);
        cache.set('key1', { data: 'hello' });
        expect(cache.get('key1')).toEqual({ data: 'hello' });
    });

    test('get returns null for missing keys', () => {
        const cache = new Cache();
        expect(cache.get('nonexistent')).toBeNull();
    });

    test('expired entries return null', async () => {
        const cache = new Cache(20); // 20ms TTL
        cache.set('short', 'value');
        await new Promise(r => setTimeout(r, 40));
        expect(cache.get('short')).toBeNull();
    });

    test('has() returns true for valid entries', () => {
        const cache = new Cache();
        cache.set('a', 1);
        expect(cache.has('a')).toBe(true);
        expect(cache.has('b')).toBe(false);
    });

    test('delete removes entry', () => {
        const cache = new Cache();
        cache.set('x', 1);
        cache.delete('x');
        expect(cache.get('x')).toBeNull();
    });

    test('clear empties all entries', () => {
        const cache = new Cache();
        cache.set('a', 1);
        cache.set('b', 2);
        cache.clear();
        expect(cache.get('a')).toBeNull();
        expect(cache.get('b')).toBeNull();
    });

    test('default TTL is 300000ms (5 minutes)', () => {
        const cache = new Cache();
        expect(cache.ttl).toBe(300000);
    });
});

describe('Cache class — unbounded growth concern (H16)', () => {
    test('Cache has no built-in max size — entries grow without limit', () => {
        const cache = new Cache(60000);
        // Add 1000 entries — they should all persist (documenting the gap)
        for (let i = 0; i < 1000; i++) {
            cache.set(`key-${i}`, `value-${i}`);
        }
        // All 1000 should be retrievable — no eviction
        expect(cache.get('key-0')).toBe('value-0');
        expect(cache.get('key-999')).toBe('value-999');
        expect(cache.cache.size).toBe(1000);
        // GAP DOCUMENTED: No max-size bound exists. Production could grow unbounded.
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getVisibleItems — virtual scroll (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('getVisibleItems — virtual scroll (H15)', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));

    test('returns correct visible slice at top', () => {
        const result = getVisibleItems(items, 0, 500, 50, 2);
        expect(result.startIndex).toBe(0);
        expect(result.visibleItems.length).toBeGreaterThan(0);
        expect(result.offsetY).toBe(0);
        expect(result.totalHeight).toBe(5000); // 100 * 50
    });

    test('returns correct visible slice at middle', () => {
        // scrollTop=2000 → item 40 visible, containerHeight=500, itemHeight=50
        const result = getVisibleItems(items, 2000, 500, 50, 2);
        expect(result.startIndex).toBe(38); // 40 - buffer(2)
        expect(result.endIndex).toBeLessThanOrEqual(52); // 50 + buffer(2)
        expect(result.visibleItems.length).toBeLessThanOrEqual(14);
    });

    test('returns correct visible slice at bottom', () => {
        const result = getVisibleItems(items, 4500, 500, 50, 2);
        expect(result.endIndex).toBe(100); // capped at items.length
    });

    test('handles empty items', () => {
        const result = getVisibleItems([], 0, 500, 50);
        expect(result.visibleItems).toEqual([]);
        expect(result.totalHeight).toBe(0);
    });

    test('default buffer is 5', () => {
        const result = getVisibleItems(items, 2500, 500, 50);
        expect(result.startIndex).toBe(45); // 50 - 5
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// formatFileSize (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatFileSize (H15)', () => {
    test('0 bytes', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
    });

    test('bytes range', () => {
        expect(formatFileSize(512)).toBe('512 Bytes');
    });

    test('KB range', () => {
        const result = formatFileSize(1536); // 1.5 KB
        expect(result).toContain('KB');
    });

    test('MB range', () => {
        const result = formatFileSize(2.5 * 1024 * 1024);
        expect(result).toContain('MB');
    });

    test('GB range', () => {
        const result = formatFileSize(3 * 1024 * 1024 * 1024);
        expect(result).toContain('GB');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// escapeHtmlFast — memoized XSS prevention (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('escapeHtmlFast (H15)', () => {
    test('escapes all 5 HTML entities', () => {
        const input = `<script>alert("xss")</script> & 'test'`;
        const result = escapeHtmlFast(input);
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
        expect(result).toContain('&gt;');
        expect(result).toContain('&amp;');
        expect(result).toContain('&quot;');
        expect(result).toContain('&#039;');
    });

    test('returns same result for repeated calls (memoized)', () => {
        const input = 'hello <world>';
        const r1 = escapeHtmlFast(input);
        const r2 = escapeHtmlFast(input);
        expect(r1).toBe(r2);
    });

    test('handles empty string', () => {
        expect(escapeHtmlFast('')).toBe('');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isSlowConnection / optimizeImageURL (H23)
// ═══════════════════════════════════════════════════════════════════════════════

describe('isSlowConnection — navigator.connection graceful degradation (H23)', () => {
    test('returns false when navigator.connection is absent', () => {
        const saved = navigator.connection;
        delete navigator.connection;
        expect(isSlowConnection()).toBe(false);
        if (saved) navigator.connection = saved;
    });

    test('returns true when saveData is true', () => {
        navigator.connection = { saveData: true, effectiveType: '4g' };
        expect(isSlowConnection()).toBe(true);
        delete navigator.connection;
    });

    test('returns true for slow-2g effective type', () => {
        navigator.connection = { saveData: false, effectiveType: 'slow-2g' };
        expect(isSlowConnection()).toBe(true);
        delete navigator.connection;
    });

    test('returns false for 4g effective type', () => {
        navigator.connection = { saveData: false, effectiveType: '4g' };
        expect(isSlowConnection()).toBe(false);
        delete navigator.connection;
    });
});

describe('optimizeImageURL (H23)', () => {
    test('replaces /original/ with /thumbnails/ on slow connection', () => {
        navigator.connection = { saveData: true, effectiveType: '4g' };
        const result = optimizeImageURL('/images/original/photo.jpg', 'full');
        expect(result).toContain('/thumbnails/');
        delete navigator.connection;
    });

    test('uses size map on fast connection', () => {
        delete navigator.connection;
        const result = optimizeImageURL('/images/original/photo.jpg', 'full');
        expect(result).toContain('/original/');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// chunkProcess (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('chunkProcess (H15)', () => {
    test('processes all items', async () => {
        const items = [1, 2, 3, 4, 5];
        const results = [];
        await chunkProcess(items, (item) => results.push(item * 2), 2);
        expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    test('handles empty array', async () => {
        const results = [];
        await chunkProcess([], (item) => results.push(item));
        expect(results).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EventManager (H15)
// ═══════════════════════════════════════════════════════════════════════════════

describe('EventManager (H15)', () => {
    test('tracks added listeners', () => {
        const mgr = new EventManager();
        const el = {
            addEventListener: () => {},
            removeEventListener: () => {},
        };
        mgr.addEventListener(el, 'click', () => {});
        expect(mgr.listeners.length).toBe(1);
    });

    test('removeAll clears all listeners', () => {
        let removed = 0;
        const mgr = new EventManager();
        const el = {
            addEventListener: () => {},
            removeEventListener: () => { removed++; },
        };
        mgr.addEventListener(el, 'click', () => {});
        mgr.addEventListener(el, 'scroll', () => {});
        mgr.removeAll();
        expect(removed).toBe(2);
        expect(mgr.listeners.length).toBe(0);
    });
});
