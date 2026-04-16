import { describe, test, expect, mock } from 'bun:test';

mock.module('playwright-extra', () => ({
    chromium: { use: mock(() => {}) },
}));

mock.module('puppeteer-extra-plugin-stealth', () => ({
    default: mock(() => ({})),
}));

const {
    randomChromeUA,
    randomFirefoxUA,
    randomViewport,
    randomSlowMo,
    STEALTH_ARGS,
    STEALTH_IGNORE_DEFAULTS,
    stealthContextOptions,
    humanClick,
    humanScroll,
    mouseWiggle,
    injectChromeRuntimeStub,
    injectBrowserApiStubs,
} = await import('../../worker/bots/stealth.js');

const mockPage = {
    mouse: {
        move: mock(() => Promise.resolve()),
        click: mock(() => Promise.resolve()),
        wheel: mock(() => Promise.resolve()),
    },
    waitForTimeout: mock(() => Promise.resolve()),
    addInitScript: mock(() => Promise.resolve()),
    $: mock(() => Promise.resolve({
        boundingBox: () => Promise.resolve({ x: 100, y: 100, width: 200, height: 50 }),
    })),
};

describe('randomChromeUA', () => {
    test('should return a Chrome UA string', () => {
        const ua = randomChromeUA();
        expect(typeof ua).toBe('string');
        expect(ua).toContain('Chrome/');
    });

    test('should return different values across calls', () => {
        const results = new Set(Array.from({ length: 20 }, () => randomChromeUA()));
        expect(results.size).toBeGreaterThan(1);
    });
});

describe('randomFirefoxUA', () => {
    test('should return a Firefox UA string', () => {
        const ua = randomFirefoxUA();
        expect(typeof ua).toBe('string');
        expect(ua).toContain('Firefox/');
    });
});

describe('randomViewport', () => {
    test('should return an object with width and height', () => {
        const vp = randomViewport();
        expect(typeof vp.width).toBe('number');
        expect(typeof vp.height).toBe('number');
    });

    test('should return realistic desktop dimensions', () => {
        const vp = randomViewport();
        expect(vp.width).toBeGreaterThanOrEqual(1280);
        expect(vp.height).toBeGreaterThanOrEqual(720);
    });

    test('should return a copy so mutations do not affect pool', () => {
        const vp1 = randomViewport();
        const vp2 = randomViewport();
        vp1.width = 9999;
        expect(vp2.width).not.toBe(9999);
    });
});

describe('randomSlowMo', () => {
    test('should return a number between 30 and 79 inclusive', () => {
        for (let i = 0; i < 50; i++) {
            const val = randomSlowMo();
            expect(val).toBeGreaterThanOrEqual(30);
            expect(val).toBeLessThan(80);
        }
    });
});

describe('STEALTH_ARGS', () => {
    test('should be a non-empty array of strings', () => {
        expect(Array.isArray(STEALTH_ARGS)).toBe(true);
        expect(STEALTH_ARGS.length).toBeGreaterThan(0);
        expect(STEALTH_ARGS.every(a => typeof a === 'string')).toBe(true);
    });

    test('should include --disable-blink-features=AutomationControlled', () => {
        expect(STEALTH_ARGS).toContain('--disable-blink-features=AutomationControlled');
    });
});

describe('STEALTH_IGNORE_DEFAULTS', () => {
    test('should contain --enable-automation', () => {
        expect(STEALTH_IGNORE_DEFAULTS).toContain('--enable-automation');
    });
});

describe('stealthContextOptions', () => {
    test('should include userAgent, viewport, locale, and timezoneId', () => {
        const opts = stealthContextOptions('chrome');
        expect(typeof opts.userAgent).toBe('string');
        expect(typeof opts.viewport).toBe('object');
        expect(typeof opts.locale).toBe('string');
        expect(typeof opts.timezoneId).toBe('string');
    });

    test('should use a Firefox UA when browser is firefox', () => {
        const opts = stealthContextOptions('firefox');
        expect(opts.userAgent).toContain('Firefox/');
    });

    test('should use a Chrome UA when browser is chrome', () => {
        const opts = stealthContextOptions('chrome');
        expect(opts.userAgent).toContain('Chrome/');
    });

    test('should apply overrides on top of defaults', () => {
        const opts = stealthContextOptions('chrome', { locale: 'fr-FR', extraProp: 42 });
        expect(opts.locale).toBe('fr-FR');
        expect(opts.extraProp).toBe(42);
        expect(typeof opts.userAgent).toBe('string');
    });

    test('should default to chrome UA when no browser argument is provided', () => {
        const opts = stealthContextOptions();
        expect(opts.userAgent).toContain('Chrome/');
    });
});

describe('humanClick', () => {
    test('should return true when element and boundingBox are found', async () => {
        mockPage.$.mockImplementation(() => Promise.resolve({
            boundingBox: () => Promise.resolve({ x: 100, y: 100, width: 200, height: 50 }),
        }));

        const result = await humanClick(mockPage, '#some-button');
        expect(result).toBe(true);
    });

    test('should return false when element is not found', async () => {
        mockPage.$.mockImplementation(() => Promise.resolve(null));

        const result = await humanClick(mockPage, '#missing');
        expect(result).toBe(false);
    });

    test('should return false when boundingBox returns null', async () => {
        mockPage.$.mockImplementation(() => Promise.resolve({
            boundingBox: () => Promise.resolve(null),
        }));

        const result = await humanClick(mockPage, '#no-box');
        expect(result).toBe(false);
    });

    test('should call mouse.move and mouse.click when element is found', async () => {
        mockPage.mouse.move.mockClear();
        mockPage.mouse.click.mockClear();
        mockPage.$.mockImplementation(() => Promise.resolve({
            boundingBox: () => Promise.resolve({ x: 50, y: 50, width: 100, height: 40 }),
        }));

        await humanClick(mockPage, '#btn');

        expect(mockPage.mouse.move).toHaveBeenCalled();
        expect(mockPage.mouse.click).toHaveBeenCalled();
    });
});

describe('humanScroll', () => {
    test('should call mouse.wheel multiple times for chunked scrolling', async () => {
        mockPage.mouse.wheel.mockClear();

        await humanScroll(mockPage, 600);

        expect(mockPage.mouse.wheel.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test('should scroll downward (positive y delta)', async () => {
        mockPage.mouse.wheel.mockClear();

        await humanScroll(mockPage, 300);

        const calls = mockPage.mouse.wheel.mock.calls;
        expect(calls.every(([x, y]) => x === 0 && y > 0)).toBe(true);
    });
});

describe('mouseWiggle', () => {
    test('should call mouse.move exactly once', async () => {
        mockPage.mouse.move.mockClear();

        await mouseWiggle(mockPage);

        expect(mockPage.mouse.move).toHaveBeenCalledTimes(1);
    });
});

describe('injectChromeRuntimeStub', () => {
    test('should call page.addInitScript once', async () => {
        mockPage.addInitScript.mockClear();

        await injectChromeRuntimeStub(mockPage);

        expect(mockPage.addInitScript).toHaveBeenCalledTimes(1);
    });
});

describe('injectBrowserApiStubs', () => {
    test('should call page.addInitScript once', async () => {
        mockPage.addInitScript.mockClear();

        await injectBrowserApiStubs(mockPage);

        expect(mockPage.addInitScript).toHaveBeenCalledTimes(1);
    });
});
